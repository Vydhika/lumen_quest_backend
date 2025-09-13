/**
 * Utility helper functions
 * Common utilities used across the application
 */

/**
 * Simple logger utility
 */
const logger = {
  info: (message, ...args) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
  },
  warn: (message, ...args) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
  },
  error: (message, ...args) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
  },
  debug: (message, ...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }
};

/**
 * Standardized API response format
 */
const createResponse = (success, data = null, message = '', errors = null) => {
  const response = {
    success,
    timestamp: new Date().toISOString()
  };

  if (message) response.message = message;
  if (data !== null) response.data = data;
  if (errors) response.errors = errors;

  return response;
};

/**
 * Success response helper
 */
const successResponse = (data, message = 'Operation successful') => {
  return createResponse(true, data, message);
};

/**
 * Error response helper
 */
const errorResponse = (message = 'Operation failed', errors = null) => {
  return createResponse(false, null, message, errors);
};

/**
 * Pagination helper
 */
const paginate = (page = 1, limit = 10) => {
  const offset = (parseInt(page) - 1) * parseInt(limit);
  return {
    offset: Math.max(0, offset),
    limit: Math.min(parseInt(limit), 100) // Max 100 items per page
  };
};

/**
 * Generate pagination metadata
 */
const createPaginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
};

/**
 * Date helper functions
 */
const dateHelpers = {
  /**
   * Get start and end of month
   */
  getMonthRange: (date = new Date()) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  },

  /**
   * Get start and end of year
   */
  getYearRange: (date = new Date()) => {
    const start = new Date(date.getFullYear(), 0, 1);
    const end = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { start, end };
  },

  /**
   * Add months to date
   */
  addMonths: (date, months) => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  },

  /**
   * Format date for SQL
   */
  toSQLDate: (date) => {
    return date.toISOString().split('T')[0];
  },

  /**
   * Check if date is within range
   */
  isWithinRange: (date, startDate, endDate) => {
    return date >= startDate && date <= endDate;
  }
};

/**
 * Calculate percentage
 */
const calculatePercentage = (value, total) => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100 * 100) / 100; // Round to 2 decimal places
};

/**
 * Sanitize object for logging (remove sensitive data)
 */
const sanitizeForLog = (obj) => {
  const sensitive = ['password', 'token', 'secret', 'key', 'authorization'];
  const sanitized = { ...obj };
  
  for (const key in sanitized) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  return sanitized;
};

/**
 * Generate random string
 */
const generateRandomString = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Deep clone object
 */
const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const cloned = {};
    for (const key in obj) {
      cloned[key] = deepClone(obj[key]);
    }
    return cloned;
  }
};

/**
 * Sleep function for delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  logger,
  createResponse,
  successResponse,
  errorResponse,
  paginate,
  createPaginationMeta,
  dateHelpers,
  calculatePercentage,
  sanitizeForLog,
  generateRandomString,
  isValidEmail,
  deepClone,
  sleep
};