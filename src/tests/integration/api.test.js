/**
 * Integration Tests
 * End-to-end tests for complete workflows
 */

const request = require('supertest');
const app = require('../../app');
const { supabase } = require('../../config/supabase');

describe('Integration Tests', () => {
  beforeEach(() => {
    global.testUtils.resetMocks();
  });

  describe('User Registration and Authentication Flow', () => {
    const userData = {
      email: 'integration.test@example.com',
      password: 'SecurePassword123!',
      full_name: 'Integration Test User'
    };

    it('should complete full user registration flow', async () => {
      // Step 1: Register user
      supabase.auth.signUp.mockResolvedValue({
        data: {
          user: {
            id: 'new-user-id',
            email: userData.email,
            email_confirmed_at: null
          },
          session: null
        },
        error: null
      });

      supabase.from.mockReturnValue({
        upsert: jest.fn().mockResolvedValue({ error: null })
      });

      const signupResponse = await request(app)
        .post('/api/auth/signup')
        .send(userData);

      expect(signupResponse.status).toBe(201);
      expect(signupResponse.body.success).toBe(true);

      // Step 2: Sign in user
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: {
            id: 'new-user-id',
            email: userData.email,
            email_confirmed_at: new Date().toISOString()
          },
          session: {
            access_token: 'access_token_123',
            refresh_token: 'refresh_token_123'
          }
        },
        error: null
      });

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                role: 'user',
                full_name: userData.full_name
              },
              error: null
            })
          })
        })
      });

      const signinResponse = await request(app)
        .post('/api/auth/signin')
        .send({
          email: userData.email,
          password: userData.password
        });

      expect(signinResponse.status).toBe(200);
      expect(signinResponse.body.success).toBe(true);
      expect(signinResponse.body.data.session.access_token).toBe('access_token_123');
    });
  });

  describe('Subscription Management Flow', () => {
    const mockAuthToken = 'Bearer mock_access_token';

    beforeEach(() => {
      // Mock authentication for all subscription tests
      supabase.auth.getUser.mockResolvedValue({
        data: { user: global.testUtils.mockUser },
        error: null
      });
    });

    it('should complete subscription creation flow', async () => {
      // Step 1: Get available plans
      const mockPlans = [global.testUtils.mockPlan];
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: jest.fn().mockResolvedValue({
                data: mockPlans,
                error: null,
                count: 1
              })
            })
          })
        })
      });

      const plansResponse = await request(app)
        .get('/api/public/plans');

      expect(plansResponse.status).toBe(200);
      expect(plansResponse.body.data.plans).toEqual(mockPlans);

      // Step 2: Create subscription
      const subscriptionData = {
        plan_id: global.testUtils.mockPlan.id,
        billing_cycle: 'monthly',
        payment_method_id: 'pm_test_123',
        billing_address: {
          line1: '123 Test St',
          city: 'Test City',
          state: 'TS',
          postal_code: '12345',
          country: 'US'
        }
      };

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                ...global.testUtils.mockSubscription,
                ...subscriptionData
              },
              error: null
            })
          })
        })
      });

      const subscriptionResponse = await request(app)
        .post('/api/user/subscriptions')
        .set('Authorization', mockAuthToken)
        .send(subscriptionData);

      expect(subscriptionResponse.status).toBe(201);
      expect(subscriptionResponse.body.success).toBe(true);
      expect(subscriptionResponse.body.data.plan_id).toBe(subscriptionData.plan_id);
    });

    it('should handle subscription cancellation flow', async () => {
      const subscriptionId = global.testUtils.mockSubscription.id;

      // Mock subscription update
      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  ...global.testUtils.mockSubscription,
                  status: 'cancelled',
                  cancelled_at: new Date().toISOString()
                },
                error: null
              })
            })
          })
        })
      });

      const cancelResponse = await request(app)
        .post(`/api/user/subscriptions/${subscriptionId}/cancel`)
        .set('Authorization', mockAuthToken)
        .send({ reason: 'No longer needed' });

      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body.success).toBe(true);
      expect(cancelResponse.body.data.status).toBe('cancelled');
    });
  });

  describe('Billing and Payment Flow', () => {
    const mockAuthToken = 'Bearer mock_access_token';

    beforeEach(() => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: global.testUtils.mockUser },
        error: null
      });
    });

    it('should complete invoice payment flow', async () => {
      // Step 1: Get user invoices
      const mockInvoices = [global.testUtils.mockInvoice];
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: jest.fn().mockResolvedValue({
                data: mockInvoices,
                error: null,
                count: 1
              })
            })
          })
        })
      });

      const invoicesResponse = await request(app)
        .get('/api/billing/invoices')
        .set('Authorization', mockAuthToken);

      expect(invoicesResponse.status).toBe(200);
      expect(invoicesResponse.body.data.invoices).toEqual(mockInvoices);

      // Step 2: Pay invoice
      const invoiceId = global.testUtils.mockInvoice.id;
      const paymentData = {
        payment_method_id: 'pm_test_123'
      };

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                ...global.testUtils.mockPayment,
                status: 'succeeded'
              },
              error: null
            })
          })
        })
      });

      const paymentResponse = await request(app)
        .post(`/api/billing/invoices/${invoiceId}/pay`)
        .set('Authorization', mockAuthToken)
        .send(paymentData);

      expect(paymentResponse.status).toBe(200);
      expect(paymentResponse.body.success).toBe(true);
      expect(paymentResponse.body.data.status).toBe('succeeded');
    });
  });

  describe('Admin Operations Flow', () => {
    const mockAdminToken = 'Bearer mock_admin_token';

    beforeEach(() => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: global.testUtils.mockAdmin },
        error: null
      });
    });

    it('should complete admin plan management flow', async () => {
      // Step 1: Create new plan
      const planData = {
        name: 'Premium Plan',
        description: 'Premium features',
        price: 49.99,
        billing_cycle: 'monthly',
        features: ['Premium Feature 1', 'Premium Feature 2'],
        limits: { projects: 50 }
      };

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'new-plan-id',
                ...planData
              },
              error: null
            })
          })
        })
      });

      const createResponse = await request(app)
        .post('/api/admin/plans')
        .set('Authorization', mockAdminToken)
        .send(planData);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.data.name).toBe(planData.name);

      // Step 2: Update plan
      const updateData = { price: 39.99 };
      const planId = 'new-plan-id';

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: planId,
                  ...planData,
                  ...updateData
                },
                error: null
              })
            })
          })
        })
      });

      const updateResponse = await request(app)
        .put(`/api/admin/plans/${planId}`)
        .set('Authorization', mockAdminToken)
        .send(updateData);

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.price).toBe(updateData.price);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle authentication errors consistently', async () => {
      // Test with invalid token
      const response = await request(app)
        .get('/api/user/subscriptions')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should handle validation errors consistently', async () => {
      // Test with invalid data
      const response = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'invalid-email',
          password: '123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should handle database errors consistently', async () => {
      global.testUtils.simulateDbError('Database connection failed');

      const response = await request(app)
        .get('/api/public/plans');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('API Rate Limiting and Security', () => {
    it('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api/public/plans')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/public/plans');

      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBeDefined();
    });
  });
});