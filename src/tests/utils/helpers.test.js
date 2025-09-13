/**
 * Helpers Utility Tests
 */

const { 
  successResponse, 
  errorResponse, 
  calculatePagination,
  formatCurrency,
  generateSlug,
  validateEmail,
  logger
} = require('../../utils/helpers');

describe('Helper Utilities', () => {
  describe('successResponse', () => {
    it('should create success response with data', () => {
      const data = { id: 1, name: 'test' };
      const message = 'Success';
      
      const response = successResponse(data, message);
      
      expect(response).toEqual({
        success: true,
        message: 'Success',
        data: { id: 1, name: 'test' }
      });
    });

    it('should create success response without message', () => {
      const data = { id: 1 };
      
      const response = successResponse(data);
      
      expect(response).toEqual({
        success: true,
        message: 'Operation successful',
        data: { id: 1 }
      });
    });

    it('should handle null data', () => {
      const response = successResponse(null, 'No data');
      
      expect(response).toEqual({
        success: true,
        message: 'No data',
        data: null
      });
    });
  });

  describe('errorResponse', () => {
    it('should create error response with message', () => {
      const message = 'Something went wrong';
      
      const response = errorResponse(message);
      
      expect(response).toEqual({
        success: false,
        message: 'Something went wrong'
      });
    });

    it('should create error response with default message', () => {
      const response = errorResponse();
      
      expect(response).toEqual({
        success: false,
        message: 'An error occurred'
      });
    });

    it('should create error response with errors array', () => {
      const message = 'Validation failed';
      const errors = ['Email is required', 'Password too short'];
      
      const response = errorResponse(message, errors);
      
      expect(response).toEqual({
        success: false,
        message: 'Validation failed',
        errors: ['Email is required', 'Password too short']
      });
    });
  });

  describe('calculatePagination', () => {
    it('should calculate pagination correctly', () => {
      const result = calculatePagination(50, 1, 10);
      
      expect(result).toEqual({
        page: 1,
        limit: 10,
        total: 50,
        pages: 5,
        hasNext: true,
        hasPrev: false
      });
    });

    it('should handle last page correctly', () => {
      const result = calculatePagination(25, 3, 10);
      
      expect(result).toEqual({
        page: 3,
        limit: 10,
        total: 25,
        pages: 3,
        hasNext: false,
        hasPrev: true
      });
    });

    it('should handle single page', () => {
      const result = calculatePagination(5, 1, 10);
      
      expect(result).toEqual({
        page: 1,
        limit: 10,
        total: 5,
        pages: 1,
        hasNext: false,
        hasPrev: false
      });
    });

    it('should handle zero total', () => {
      const result = calculatePagination(0, 1, 10);
      
      expect(result).toEqual({
        page: 1,
        limit: 10,
        total: 0,
        pages: 0,
        hasNext: false,
        hasPrev: false
      });
    });
  });

  describe('formatCurrency', () => {
    it('should format USD currency correctly', () => {
      const result = formatCurrency(29.99, 'USD');
      expect(result).toBe('$29.99');
    });

    it('should format EUR currency correctly', () => {
      const result = formatCurrency(29.99, 'EUR');
      expect(result).toBe('€29.99');
    });

    it('should handle zero amount', () => {
      const result = formatCurrency(0, 'USD');
      expect(result).toBe('$0.00');
    });

    it('should handle large amounts', () => {
      const result = formatCurrency(1234567.89, 'USD');
      expect(result).toBe('$1,234,567.89');
    });

    it('should default to USD if currency not provided', () => {
      const result = formatCurrency(29.99);
      expect(result).toBe('$29.99');
    });
  });

  describe('generateSlug', () => {
    it('should generate slug from text', () => {
      const result = generateSlug('Hello World Test');
      expect(result).toBe('hello-world-test');
    });

    it('should handle special characters', () => {
      const result = generateSlug('Hello, World! Test @ 123');
      expect(result).toBe('hello-world-test-123');
    });

    it('should handle multiple spaces', () => {
      const result = generateSlug('Hello    World   Test');
      expect(result).toBe('hello-world-test');
    });

    it('should handle empty string', () => {
      const result = generateSlug('');
      expect(result).toBe('');
    });

    it('should handle only special characters', () => {
      const result = generateSlug('!@#$%^&*()');
      expect(result).toBe('');
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(validateEmail('user+tag@example.org')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('test..test@example.com')).toBe(false);
    });

    it('should handle empty and null values', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail(null)).toBe(false);
      expect(validateEmail(undefined)).toBe(false);
    });
  });

  describe('logger', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log info messages', () => {
      logger.info('Test info message');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      logger.error('Test error message');
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('should log warning messages', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      logger.warn('Test warning message');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});