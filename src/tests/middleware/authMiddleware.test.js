/**
 * Authentication Middleware Tests
 */

const { authenticateToken } = require('../../middleware/authMiddleware');
const { supabase } = require('../../config/supabase');

describe('Authentication Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = global.testUtils.mockRequest();
    res = global.testUtils.mockResponse();
    next = global.testUtils.mockNext();
  });

  describe('authenticateToken', () => {
    it('should authenticate user with valid token', async () => {
      // Setup
      req.headers.authorization = 'Bearer valid_token';
      supabase.auth.getUser.mockResolvedValue({
        data: { user: global.testUtils.mockUser },
        error: null
      });

      // Execute
      await authenticateToken(req, res, next);

      // Assert
      expect(req.user).toEqual(global.testUtils.mockUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject request without authorization header', async () => {
      // Setup - no authorization header

      // Execute
      await authenticateToken(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access token required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token format', async () => {
      // Setup
      req.headers.authorization = 'InvalidFormat token';

      // Execute
      await authenticateToken(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access token required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with expired/invalid token', async () => {
      // Setup
      req.headers.authorization = 'Bearer invalid_token';
      supabase.auth.getUser.mockResolvedValue({
        data: null,
        error: { message: 'Invalid token' }
      });

      // Execute
      await authenticateToken(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle authentication service errors', async () => {
      // Setup
      req.headers.authorization = 'Bearer test_token';
      supabase.auth.getUser.mockRejectedValue(new Error('Service unavailable'));

      // Execute
      await authenticateToken(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication service error'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should extract token from different authorization formats', async () => {
      // Setup
      req.headers.authorization = 'Bearer   token_with_spaces   ';
      supabase.auth.getUser.mockResolvedValue({
        data: { user: global.testUtils.mockUser },
        error: null
      });

      // Execute
      await authenticateToken(req, res, next);

      // Assert
      expect(supabase.auth.getUser).toHaveBeenCalled();
      expect(req.user).toEqual(global.testUtils.mockUser);
      expect(next).toHaveBeenCalled();
    });

    it('should handle missing user data in response', async () => {
      // Setup
      req.headers.authorization = 'Bearer valid_token';
      supabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      // Execute
      await authenticateToken(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired token'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});