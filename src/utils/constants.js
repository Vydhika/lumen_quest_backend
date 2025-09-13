/**
 * Application constants
 * Centralized configuration and constant values
 */

/**
 * Subscription statuses
 */
const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  SUSPENDED: 'suspended',
  EXPIRED: 'expired',
  PENDING: 'pending'
};

/**
 * Billing cycles
 */
const BILLING_CYCLE = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  WEEKLY: 'weekly',
  DAILY: 'daily'
};

/**
 * User roles
 */
const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  MODERATOR: 'moderator'
};

/**
 * Subscription actions for logging
 */
const SUBSCRIPTION_ACTIONS = {
  SUBSCRIBE: 'subscribe',
  UPGRADE: 'upgrade',
  DOWNGRADE: 'downgrade',
  CANCEL: 'cancel',
  RENEW: 'renew',
  SUSPEND: 'suspend',
  REACTIVATE: 'reactivate',
  MODIFY: 'modify'
};

/**
 * Plan types
 */
const PLAN_TYPES = {
  BASIC: 'basic',
  PREMIUM: 'premium',
  ENTERPRISE: 'enterprise',
  FREE: 'free'
};

/**
 * Payment statuses
 */
const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled'
};

/**
 * Analytics periods
 */
const ANALYTICS_PERIODS = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
  YEAR: 'year',
  ALL: 'all'
};

/**
 * Notification types
 */
const NOTIFICATION_TYPES = {
  SUBSCRIPTION_CREATED: 'subscription_created',
  SUBSCRIPTION_UPGRADED: 'subscription_upgraded',
  SUBSCRIPTION_DOWNGRADED: 'subscription_downgraded',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  SUBSCRIPTION_RENEWED: 'subscription_renewed',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  PLAN_RECOMMENDATION: 'plan_recommendation',
  CHURN_WARNING: 'churn_warning'
};

/**
 * API response codes
 */
const API_CODES = {
  SUCCESS: 'SUCCESS',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
};

/**
 * HTTP status codes
 */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

/**
 * Database table names
 */
const TABLES = {
  PLANS: 'plans',
  SUBSCRIPTIONS: 'subscriptions',
  SUBSCRIPTION_LOGS: 'subscription_logs',
  BILLING_INFORMATION: 'billing_information',
  PROFILES: 'profiles',
  NOTIFICATIONS: 'notifications',
  DISCOUNTS: 'discounts',
  USAGE_METRICS: 'usage_metrics'
};

/**
 * Cache keys
 */
const CACHE_KEYS = {
  PLANS: 'plans:all',
  PLAN: 'plan:',
  USER_SUBSCRIPTIONS: 'user:subscriptions:',
  ANALYTICS_CHURN: 'analytics:churn:',
  ANALYTICS_TOP_PLANS: 'analytics:top_plans:',
  USER_RECOMMENDATIONS: 'user:recommendations:'
};

/**
 * Cache TTL (Time To Live) in seconds
 */
const CACHE_TTL = {
  SHORT: 300,      // 5 minutes
  MEDIUM: 1800,    // 30 minutes
  LONG: 3600,      // 1 hour
  VERY_LONG: 86400 // 24 hours
};

/**
 * Pagination defaults
 */
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
  DEFAULT_SORT: 'desc'
};

/**
 * Rate limiting
 */
const RATE_LIMITS = {
  GENERAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  },
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5 // limit each IP to 5 auth requests per windowMs
  },
  API: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000 // limit each IP to 1000 API requests per windowMs
  }
};

/**
 * File upload limits
 */
const FILE_LIMITS = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
  MAX_FILES: 5
};

/**
 * JWT configuration
 */
const JWT_CONFIG = {
  EXPIRES_IN: '7d',
  REFRESH_EXPIRES_IN: '30d',
  ALGORITHM: 'HS256',
  ISSUER: 'lumen-quest-api'
};

/**
 * Email templates
 */
const EMAIL_TEMPLATES = {
  WELCOME: 'welcome',
  SUBSCRIPTION_CONFIRMATION: 'subscription_confirmation',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  PASSWORD_RESET: 'password_reset',
  PLAN_RECOMMENDATION: 'plan_recommendation'
};

/**
 * Environment configurations
 */
const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
  TEST: 'test'
};

/**
 * API versions
 */
const API_VERSIONS = {
  V1: 'v1',
  V2: 'v2'
};

/**
 * Regex patterns
 */
const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  PHONE: /^\+?[1-9]\d{1,14}$/
};

/**
 * Error messages
 */
const ERROR_MESSAGES = {
  VALIDATION: {
    REQUIRED: 'This field is required',
    INVALID_EMAIL: 'Please provide a valid email address',
    INVALID_PASSWORD: 'Password must be at least 8 characters with uppercase, lowercase, and number',
    INVALID_UUID: 'Invalid ID format',
    INVALID_DATE: 'Invalid date format'
  },
  AUTH: {
    INVALID_CREDENTIALS: 'Invalid email or password',
    TOKEN_EXPIRED: 'Access token has expired',
    TOKEN_INVALID: 'Invalid access token',
    UNAUTHORIZED: 'Authorization required',
    FORBIDDEN: 'Access denied'
  },
  SUBSCRIPTION: {
    NOT_FOUND: 'Subscription not found',
    ALREADY_EXISTS: 'Active subscription already exists',
    CANNOT_UPGRADE: 'Cannot upgrade to the same or lower plan',
    CANNOT_DOWNGRADE: 'Cannot downgrade to the same or higher plan',
    ALREADY_CANCELLED: 'Subscription is already cancelled'
  },
  PLAN: {
    NOT_FOUND: 'Plan not found',
    INACTIVE: 'Plan is not active',
    ALREADY_EXISTS: 'Plan already exists'
  },
  GENERAL: {
    NOT_FOUND: 'Resource not found',
    INTERNAL_ERROR: 'An internal error occurred',
    SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
    RATE_LIMIT: 'Too many requests. Please try again later.'
  }
};

/**
 * Success messages
 */
const SUCCESS_MESSAGES = {
  SUBSCRIPTION: {
    CREATED: 'Subscription created successfully',
    UPDATED: 'Subscription updated successfully',
    CANCELLED: 'Subscription cancelled successfully',
    UPGRADED: 'Subscription upgraded successfully',
    DOWNGRADED: 'Subscription downgraded successfully'
  },
  PLAN: {
    CREATED: 'Plan created successfully',
    UPDATED: 'Plan updated successfully',
    DELETED: 'Plan deleted successfully'
  },
  GENERAL: {
    SUCCESS: 'Operation completed successfully',
    CREATED: 'Resource created successfully',
    UPDATED: 'Resource updated successfully',
    DELETED: 'Resource deleted successfully'
  }
};

module.exports = {
  SUBSCRIPTION_STATUS,
  BILLING_CYCLE,
  USER_ROLES,
  SUBSCRIPTION_ACTIONS,
  PLAN_TYPES,
  PAYMENT_STATUS,
  ANALYTICS_PERIODS,
  NOTIFICATION_TYPES,
  API_CODES,
  HTTP_STATUS,
  TABLES,
  CACHE_KEYS,
  CACHE_TTL,
  PAGINATION,
  RATE_LIMITS,
  FILE_LIMITS,
  JWT_CONFIG,
  EMAIL_TEMPLATES,
  ENVIRONMENTS,
  API_VERSIONS,
  REGEX_PATTERNS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES
};