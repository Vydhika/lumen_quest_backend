/**
 * Request validation utilities
 * Handles input validation for API endpoints using Joi
 */

const Joi = require('joi');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * Joi validation schemas
 */
const schemas = {
  // User schemas
  user: {
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    role: Joi.string().valid('user', 'admin').default('user')
  },

  // Plan schemas
  plan: {
    name: Joi.string().min(2).max(100).required(),
    description: Joi.string().max(500),
    price: Joi.number().min(0).required(),
    billing_cycle: Joi.string().valid('monthly', 'yearly').required(),
    quota: Joi.number().min(0).required(),
    features: Joi.array().items(Joi.string()),
    is_active: Joi.boolean().default(true)
  },

  // Subscription schemas
  subscription: {
    plan_id: Joi.string().uuid().required(),
    start_date: Joi.date().iso(),
    auto_renew: Joi.boolean().default(true)
  },

  // Subscription update schemas
  subscriptionUpdate: {
    target_plan_id: Joi.string().uuid().required(),
    effective_date: Joi.date().iso().min('now'),
    reason: Joi.string().max(200)
  },

  // Cancellation schema
  cancellation: {
    reason: Joi.string().max(200),
    immediate: Joi.boolean().default(false)
  },

  // Pagination schema
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string().valid('asc', 'desc').default('desc'),
    sort_by: Joi.string()
  },

  // Date range schema
  dateRange: {
    start_date: Joi.date().iso(),
    end_date: Joi.date().iso().min(Joi.ref('start_date')),
    period: Joi.string().valid('day', 'week', 'month', 'year', 'all').default('month')
  },

  // UUID parameter
  uuid: Joi.string().uuid().required(),

  // Search schema
  search: {
    q: Joi.string().min(1).max(100),
    filter: Joi.object(),
    include: Joi.array().items(Joi.string())
  }
};

/**
 * Validation middleware factory
 * @param {Object} schema - Joi schema object
 * @param {string} source - Where to validate ('body', 'params', 'query')
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = req[source];
    const { error, value } = schema.validate(data, {
      abortEarly: false, // Report all errors
      stripUnknown: true, // Remove unknown fields
      allowUnknown: false // Don't allow unknown fields
    });

    if (error) {
      const errors = {};
      error.details.forEach(detail => {
        const key = detail.path.join('.');
        errors[key] = detail.message.replace(/"/g, ''); // Remove quotes from error messages
      });

      throw new ValidationError('Validation failed', errors);
    }

    // Replace original data with validated data
    req[source] = value;
    next();
  };
};

/**
 * Specific validation middleware functions
 */

// Body validation
const validateBody = (schema) => validate(schema, 'body');
const validateParams = (schema) => validate(schema, 'params');
const validateQuery = (schema) => validate(schema, 'query');

// Common validations
const validatePlanCreation = validateBody(Joi.object(schemas.plan));
const validatePlanUpdate = validateBody(Joi.object(schemas.plan).fork(
  Object.keys(schemas.plan), 
  (schema) => schema.optional()
));

const validateSubscriptionCreation = validateBody(Joi.object(schemas.subscription));
const validateSubscriptionUpdate = validateBody(Joi.object(schemas.subscriptionUpdate));
const validateCancellation = validateBody(Joi.object(schemas.cancellation));

const validateUuidParam = (paramName = 'id') => {
  return validateParams(Joi.object({
    [paramName]: schemas.uuid
  }));
};

const validatePagination = validateQuery(Joi.object(schemas.pagination));
const validateDateRange = validateQuery(Joi.object(schemas.dateRange));
const validateSearch = validateQuery(Joi.object(schemas.search));

/**
 * Custom validation functions
 */

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  const emailSchema = Joi.string().email();
  const { error } = emailSchema.validate(email);
  return !error;
};

/**
 * Validate UUID format
 */
const isValidUuid = (uuid) => {
  const uuidSchema = Joi.string().uuid();
  const { error } = uuidSchema.validate(uuid);
  return !error;
};

/**
 * Validate date range
 */
const isValidDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return start <= end;
};

/**
 * Sanitize input data
 */
const sanitizeInput = (data) => {
  if (typeof data === 'string') {
    return data.trim();
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeInput);
  }
  
  if (data && typeof data === 'object') {
    const sanitized = {};
    for (const key in data) {
      sanitized[key] = sanitizeInput(data[key]);
    }
    return sanitized;
  }
  
  return data;
};

/**
 * Validation schema builders
 */
const buildPaginationSchema = (allowedSortFields = []) => {
  let schema = Joi.object(schemas.pagination);
  
  if (allowedSortFields.length > 0) {
    schema = schema.keys({
      sort_by: Joi.string().valid(...allowedSortFields)
    });
  }
  
  return schema;
};

const buildFilterSchema = (allowedFilters = {}) => {
  return Joi.object(allowedFilters);
};

/**
 * Request sanitization middleware
 */
const sanitizeRequest = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeInput(req.body);
  }
  if (req.query) {
    req.query = sanitizeInput(req.query);
  }
  if (req.params) {
    req.params = sanitizeInput(req.params);
  }
  next();
};

/**
 * File validation schemas
 */
const fileValidation = {
  image: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxSize: 5 * 1024 * 1024, // 5MB
  },
  document: {
    mimeTypes: ['application/pdf', 'text/plain', 'application/msword'],
    maxSize: 10 * 1024 * 1024, // 10MB
  }
};

/**
 * File validation middleware
 */
const validateFile = (type = 'image') => {
  return (req, res, next) => {
    if (!req.file) {
      return next();
    }

    const config = fileValidation[type];
    if (!config) {
      throw new ValidationError('Invalid file type configuration');
    }

    // Check MIME type
    if (!config.mimeTypes.includes(req.file.mimetype)) {
      throw new ValidationError('Invalid file type', {
        file: `Allowed types: ${config.mimeTypes.join(', ')}`
      });
    }

    // Check file size
    if (req.file.size > config.maxSize) {
      throw new ValidationError('File too large', {
        file: `Maximum size: ${config.maxSize / (1024 * 1024)}MB`
      });
    }

    next();
  };
};

module.exports = {
  schemas,
  validate,
  validateBody,
  validateParams,
  validateQuery,
  validatePlanCreation,
  validatePlanUpdate,
  validateSubscriptionCreation,
  validateSubscriptionUpdate,
  validateCancellation,
  validateUuidParam,
  validatePagination,
  validateDateRange,
  validateSearch,
  isValidEmail,
  isValidUuid,
  isValidDateRange,
  sanitizeInput,
  sanitizeRequest,
  buildPaginationSchema,
  buildFilterSchema,
  validateFile,
  fileValidation
};