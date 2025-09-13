/**
 * Authentication Routes Tests
 */

const request = require('supertest');
const express = require('express');
const authRoutes = require('../../routes/authRoutes');
const { supabase } = require('../../config/supabase');

// Create test app
const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('Authentication Routes', () => {
  beforeEach(() => {
    global.testUtils.resetMocks();
  });

  describe('POST /auth/signup', () => {
    const signupData = {
      email: 'test@example.com',
      password: 'password123',
      full_name: 'Test User',
      role: 'user'
    };

    it('should register user successfully', async () => {
      // Setup
      supabase.auth.signUp.mockResolvedValue({
        data: {
          user: { id: 'user-id', email: signupData.email, email_confirmed_at: null },
          session: { access_token: 'token' }
        },
        error: null
      });

      supabase.from.mockReturnValue({
        upsert: jest.fn().mockResolvedValue({ error: null })
      });

      // Execute
      const response = await request(app)
        .post('/auth/signup')
        .send(signupData);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(signupData.email);
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: signupData.email,
        password: signupData.password,
        options: {
          data: {
            full_name: signupData.full_name,
            role: signupData.role
          }
        }
      });
    });

    it('should handle signup validation errors', async () => {
      // Execute
      const response = await request(app)
        .post('/auth/signup')
        .send({ email: 'invalid-email' }); // Missing required fields

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle Supabase signup errors', async () => {
      // Setup
      supabase.auth.signUp.mockResolvedValue({
        data: null,
        error: { message: 'User already registered' }
      });

      // Execute
      const response = await request(app)
        .post('/auth/signup')
        .send(signupData);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User already registered');
    });

    it('should validate email format', async () => {
      // Execute
      const response = await request(app)
        .post('/auth/signup')
        .send({
          ...signupData,
          email: 'invalid-email'
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate password strength', async () => {
      // Execute
      const response = await request(app)
        .post('/auth/signup')
        .send({
          ...signupData,
          password: '123' // Too short
        });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/signin', () => {
    const signinData = {
      email: 'test@example.com',
      password: 'password123'
    };

    it('should sign in user successfully', async () => {
      // Setup
      const mockUser = global.testUtils.mockUser;
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: mockUser,
          session: { access_token: 'access_token' }
        },
        error: null
      });

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'user', full_name: 'Test User' },
              error: null
            })
          })
        })
      });

      // Execute
      const response = await request(app)
        .post('/auth/signin')
        .send(signinData);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(signinData.email);
      expect(response.body.data.session).toBeDefined();
    });

    it('should handle invalid credentials', async () => {
      // Setup
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' }
      });

      // Execute
      const response = await request(app)
        .post('/auth/signin')
        .send(signinData);

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid email or password');
    });

    it('should validate signin input', async () => {
      // Execute
      const response = await request(app)
        .post('/auth/signin')
        .send({ email: 'invalid' }); // Missing password

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/signout', () => {
    it('should sign out user successfully', async () => {
      // Setup
      supabase.auth.signOut.mockResolvedValue({ error: null });

      // Mock authentication middleware
      const mockReq = (req, res, next) => {
        req.user = global.testUtils.mockUser;
        next();
      };

      const testApp = express();
      testApp.use(express.json());
      testApp.use(mockReq); // Mock auth middleware
      testApp.use('/auth', authRoutes);

      // Execute
      const response = await request(testApp)
        .post('/auth/signout');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Signed out successfully');
    });

    it('should handle signout errors', async () => {
      // Setup
      supabase.auth.signOut.mockResolvedValue({
        error: { message: 'Signout failed' }
      });

      const mockReq = (req, res, next) => {
        req.user = global.testUtils.mockUser;
        next();
      };

      const testApp = express();
      testApp.use(express.json());
      testApp.use(mockReq);
      testApp.use('/auth', authRoutes);

      // Execute
      const response = await request(testApp)
        .post('/auth/signout');

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh token successfully', async () => {
      // Setup
      const refreshToken = 'refresh_token_123';
      supabase.auth.refreshSession.mockResolvedValue({
        data: {
          session: { access_token: 'new_access_token' },
          user: global.testUtils.mockUser
        },
        error: null
      });

      // Execute
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refresh_token: refreshToken });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.session).toBeDefined();
    });

    it('should handle invalid refresh token', async () => {
      // Setup
      supabase.auth.refreshSession.mockResolvedValue({
        data: null,
        error: { message: 'Invalid refresh token' }
      });

      // Execute
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refresh_token: 'invalid_token' });

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should require refresh token', async () => {
      // Execute
      const response = await request(app)
        .post('/auth/refresh')
        .send({});

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Refresh token is required');
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should send password reset email', async () => {
      // Setup
      supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null });

      // Execute
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'test@example.com' });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('password reset link');
    });

    it('should handle password reset errors', async () => {
      // Setup
      supabase.auth.resetPasswordForEmail.mockResolvedValue({
        error: { message: 'Invalid email' }
      });

      // Execute
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'invalid@example.com' });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate email format', async () => {
      // Execute
      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'invalid-email' });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user info', async () => {
      // Setup
      const mockUser = global.testUtils.mockUser;
      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'user', full_name: 'Test User' },
              error: null
            })
          })
        })
      });

      const mockAuth = (req, res, next) => {
        req.user = mockUser;
        next();
      };

      const testApp = express();
      testApp.use(express.json());
      testApp.use(mockAuth);
      testApp.use('/auth', authRoutes);

      // Execute
      const response = await request(testApp)
        .get('/auth/me');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(mockUser.email);
    });

    it('should handle invalid session', async () => {
      // Setup
      supabase.auth.getUser.mockResolvedValue({
        data: null,
        error: { message: 'Invalid session' }
      });

      const mockAuth = (req, res, next) => {
        req.user = global.testUtils.mockUser;
        next();
      };

      const testApp = express();
      testApp.use(express.json());
      testApp.use(mockAuth);
      testApp.use('/auth', authRoutes);

      // Execute
      const response = await request(testApp)
        .get('/auth/me');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});