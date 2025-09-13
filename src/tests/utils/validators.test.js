/**
 * Validators Utility Tests
 */

const { validateBody, validateParams, validateQuery, schemas } = require('../../utils/validators');

describe('Validator Utilities', () => {
  let req, res, next;

  beforeEach(() => {
    req = global.testUtils.mockRequest();
    res = global.testUtils.mockResponse();
    next = global.testUtils.mockNext();
  });

  describe('validateBody', () => {
    it('should pass validation with valid data', () => {
      // Setup
      const schema = schemas.user.create;
      req.body = {
        email: 'test@example.com',
        password: 'password123',
        full_name: 'Test User'
      };

      const middleware = validateBody(schema);

      // Execute
      middleware(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should fail validation with invalid data', () => {
      // Setup
      const schema = schemas.user.create;
      req.body = {
        email: 'invalid-email',
        password: '123', // Too short
        // Missing full_name
      };

      const middleware = validateBody(schema);

      // Execute
      middleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Validation error',
          errors: expect.any(Array)
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should sanitize input data', () => {
      // Setup
      const schema = schemas.user.create;
      req.body = {
        email: '  TEST@EXAMPLE.COM  ',
        password: 'password123',
        full_name: 'Test User'
      };

      const middleware = validateBody(schema);

      // Execute
      middleware(req, res, next);

      // Assert
      expect(req.body.email).toBe('test@example.com');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('validateParams', () => {
    it('should validate URL parameters', () => {
      // Setup
      const schema = schemas.common.uuid;
      req.params = { id: '12345678-1234-1234-1234-123456789012' };

      const middleware = validateParams(schema);

      // Execute
      middleware(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject invalid UUID parameters', () => {
      // Setup
      const schema = schemas.common.uuid;
      req.params = { id: 'invalid-uuid' };

      const middleware = validateParams(schema);

      // Execute
      middleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Invalid parameters'
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('validateQuery', () => {
    it('should validate query parameters', () => {
      // Setup
      const schema = schemas.pagination.query;
      req.query = { page: '1', limit: '10' };

      const middleware = validateQuery(schema);

      // Execute
      middleware(req, res, next);

      // Assert
      expect(req.query.page).toBe(1); // Should be converted to number
      expect(req.query.limit).toBe(10);
      expect(next).toHaveBeenCalled();
    });

    it('should apply default values', () => {
      // Setup
      const schema = schemas.pagination.query;
      req.query = {}; // Empty query

      const middleware = validateQuery(schema);

      // Execute
      middleware(req, res, next);

      // Assert
      expect(req.query.page).toBe(1);
      expect(req.query.limit).toBe(10);
      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid query parameters', () => {
      // Setup
      const schema = schemas.pagination.query;
      req.query = { page: 'invalid', limit: '0' };

      const middleware = validateQuery(schema);

      // Execute
      middleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('schemas', () => {
    describe('user schemas', () => {
      it('should validate user email', () => {
        const result = schemas.user.email.validate('test@example.com');
        expect(result.error).toBeUndefined();
        expect(result.value).toBe('test@example.com');
      });

      it('should reject invalid email', () => {
        const result = schemas.user.email.validate('invalid-email');
        expect(result.error).toBeDefined();
      });

      it('should validate password strength', () => {
        const result = schemas.user.password.validate('StrongPass123!');
        expect(result.error).toBeUndefined();
      });

      it('should reject weak password', () => {
        const result = schemas.user.password.validate('123');
        expect(result.error).toBeDefined();
      });
    });

    describe('plan schemas', () => {
      it('should validate plan name', () => {
        const result = schemas.plan.name.validate('Professional Plan');
        expect(result.error).toBeUndefined();
      });

      it('should reject empty plan name', () => {
        const result = schemas.plan.name.validate('');
        expect(result.error).toBeDefined();
      });

      it('should validate plan price', () => {
        const result = schemas.plan.price.validate(29.99);
        expect(result.error).toBeUndefined();
      });

      it('should reject negative price', () => {
        const result = schemas.plan.price.validate(-10);
        expect(result.error).toBeDefined();
      });

      it('should validate billing cycle', () => {
        const validCycles = ['monthly', 'yearly', 'quarterly', 'weekly'];
        
        validCycles.forEach(cycle => {
          const result = schemas.plan.billing_cycle.validate(cycle);
          expect(result.error).toBeUndefined();
        });
      });

      it('should reject invalid billing cycle', () => {
        const result = schemas.plan.billing_cycle.validate('daily');
        expect(result.error).toBeDefined();
      });
    });

    describe('subscription schemas', () => {
      it('should validate subscription status', () => {
        const validStatuses = ['active', 'cancelled', 'paused', 'expired', 'trial'];
        
        validStatuses.forEach(status => {
          const result = schemas.subscription.status.validate(status);
          expect(result.error).toBeUndefined();
        });
      });

      it('should reject invalid subscription status', () => {
        const result = schemas.subscription.status.validate('invalid');
        expect(result.error).toBeDefined();
      });
    });

    describe('pagination schemas', () => {
      it('should validate pagination parameters', () => {
        const result = schemas.pagination.query.validate({
          page: 2,
          limit: 20
        });
        
        expect(result.error).toBeUndefined();
        expect(result.value.page).toBe(2);
        expect(result.value.limit).toBe(20);
      });

      it('should apply default pagination values', () => {
        const result = schemas.pagination.query.validate({});
        
        expect(result.error).toBeUndefined();
        expect(result.value.page).toBe(1);
        expect(result.value.limit).toBe(10);
      });

      it('should enforce pagination limits', () => {
        const result = schemas.pagination.query.validate({
          page: 0,
          limit: 1000
        });
        
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('error handling', () => {
    it('should handle validation errors gracefully', () => {
      // Setup
      const invalidSchema = null; // This should cause an error
      req.body = { test: 'data' };

      // Execute & Assert
      expect(() => {
        const middleware = validateBody(invalidSchema);
        middleware(req, res, next);
      }).not.toThrow();

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should provide detailed error messages', () => {
      // Setup
      const schema = schemas.user.create;
      req.body = {
        email: 'invalid',
        password: '123',
        full_name: ''
      };

      const middleware = validateBody(schema);

      // Execute
      middleware(req, res, next);

      // Assert
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.stringContaining('email'),
            expect.stringContaining('password'),
            expect.stringContaining('full_name')
          ])
        })
      );
    });
  });
});