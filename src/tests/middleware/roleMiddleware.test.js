/**
 * Role Middleware Tests
 */

const { requireRole, requireOwnership } = require('../../middleware/roleMiddleware');

describe('Role Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = global.testUtils.mockRequest();
    res = global.testUtils.mockResponse();
    next = global.testUtils.mockNext();
  });

  describe('requireRole', () => {
    it('should allow access for user with correct role', () => {
      // Setup
      req.user = { ...global.testUtils.mockAdmin, role: 'admin' };
      const middleware = requireRole('admin');

      // Execute
      middleware(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should deny access for user with incorrect role', () => {
      // Setup
      req.user = { ...global.testUtils.mockUser, role: 'user' };
      const middleware = requireRole('admin');

      // Execute
      middleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should deny access when user has no role', () => {
      // Setup
      req.user = { id: 'test', email: 'test@example.com' }; // No role property
      const middleware = requireRole('admin');

      // Execute
      middleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle multiple allowed roles', () => {
      // Setup
      req.user = { ...global.testUtils.mockUser, role: 'user' };
      const middleware = requireRole(['admin', 'user']);

      // Execute
      middleware(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should deny access when user role not in allowed roles', () => {
      // Setup
      req.user = { ...global.testUtils.mockUser, role: 'user' };
      const middleware = requireRole(['admin', 'moderator']);

      // Execute
      middleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireOwnership', () => {
    it('should allow access for resource owner', () => {
      // Setup
      req.user = global.testUtils.mockUser;
      req.params = { userId: global.testUtils.mockUser.id };
      const middleware = requireOwnership('userId');

      // Execute
      middleware(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow access for admin regardless of ownership', () => {
      // Setup
      req.user = { ...global.testUtils.mockAdmin, role: 'admin' };
      req.params = { userId: global.testUtils.mockUser.id }; // Different user
      const middleware = requireOwnership('userId');

      // Execute
      middleware(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should deny access for non-owner non-admin', () => {
      // Setup
      req.user = global.testUtils.mockUser;
      req.params = { userId: 'different-user-id' };
      const middleware = requireOwnership('userId');

      // Execute
      middleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle missing parameter', () => {
      // Setup
      req.user = global.testUtils.mockUser;
      req.params = {}; // No userId parameter
      const middleware = requireOwnership('userId');

      // Execute
      middleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Resource identifier required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should work with different parameter names', () => {
      // Setup
      req.user = global.testUtils.mockUser;
      req.params = { subscriptionId: 'sub-123' };
      req.body = { user_id: global.testUtils.mockUser.id };
      const middleware = requireOwnership('subscriptionId', 'user_id');

      // Execute
      middleware(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should check body for user ID when specified', () => {
      // Setup
      req.user = global.testUtils.mockUser;
      req.params = { id: 'resource-123' };
      req.body = { user_id: 'different-user-id' };
      const middleware = requireOwnership('id', 'user_id');

      // Execute
      middleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});