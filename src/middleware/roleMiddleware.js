/**
 * Role-based access control middleware
 * Handles authorization based on user roles
 */

const { errorResponse, logger } = require('../utils/helpers');

/**
 * Middleware to check if user has required role
 * @param {string|string[]} allowedRoles - Single role or array of allowed roles
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    // Ensure user is authenticated first
    if (!req.user) {
      return res.status(401).json(
        errorResponse('Authentication required', { code: 'NOT_AUTHENTICATED' })
      );
    }

    const userRole = req.user.role;
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    // Check if user has one of the required roles
    if (!roles.includes(userRole)) {
      logger.warn(`Access denied for user ${req.user.email} (${userRole}) to endpoint requiring roles: ${roles.join(', ')}`);
      
      return res.status(403).json(
        errorResponse('Insufficient permissions', { 
          code: 'INSUFFICIENT_PERMISSIONS',
          required: roles,
          current: userRole
        })
      );
    }

    logger.debug(`Access granted for user ${req.user.email} (${userRole})`);
    next();
  };
};

/**
 * Middleware to check if user is admin
 */
const requireAdmin = requireRole('admin');

/**
 * Middleware to check if user is admin or the resource owner
 * @param {string} userIdParam - Name of the parameter containing the user ID to check ownership
 */
const requireAdminOrOwner = (userIdParam = 'userId') => {
  return (req, res, next) => {
    // Ensure user is authenticated first
    if (!req.user) {
      return res.status(401).json(
        errorResponse('Authentication required', { code: 'NOT_AUTHENTICATED' })
      );
    }

    const userRole = req.user.role;
    const userId = req.user.id;
    const resourceUserId = req.params[userIdParam] || req.body[userIdParam] || req.query[userIdParam];

    // Allow if user is admin
    if (userRole === 'admin') {
      logger.debug(`Admin access granted for user ${req.user.email}`);
      return next();
    }

    // Allow if user is the owner of the resource
    if (userId === resourceUserId) {
      logger.debug(`Owner access granted for user ${req.user.email}`);
      return next();
    }

    logger.warn(`Access denied for user ${req.user.email} (${userRole}) - not admin or owner`);
    
    return res.status(403).json(
      errorResponse('Access denied - admin role or resource ownership required', { 
        code: 'ACCESS_DENIED' 
      })
    );
  };
};

/**
 * Middleware to check if user can access their own resources
 * Automatically allows admins and checks ownership for regular users
 */
const requireOwnershipOrAdmin = (userIdParam = 'userId') => {
  return async (req, res, next) => {
    // Ensure user is authenticated first
    if (!req.user) {
      return res.status(401).json(
        errorResponse('Authentication required', { code: 'NOT_AUTHENTICATED' })
      );
    }

    const userRole = req.user.role;
    const currentUserId = req.user.id;

    // Allow if user is admin
    if (userRole === 'admin') {
      return next();
    }

    // For non-admin users, check if they're accessing their own resources
    const resourceUserId = req.params[userIdParam] || req.body[userIdParam] || req.query[userIdParam];

    // If no userId parameter specified, assume they're accessing their own resources
    if (!resourceUserId) {
      return next();
    }

    // Check ownership
    if (currentUserId !== resourceUserId) {
      logger.warn(`Access denied for user ${req.user.email} - accessing another user's resources`);
      
      return res.status(403).json(
        errorResponse('Access denied - can only access your own resources', { 
          code: 'OWNERSHIP_REQUIRED' 
        })
      );
    }

    next();
  };
};

/**
 * Middleware to add role-based filtering to queries
 * Admins see everything, users see only their own data
 */
const addRoleBasedFilter = (userIdField = 'user_id') => {
  return (req, res, next) => {
    // Ensure user is authenticated first
    if (!req.user) {
      return res.status(401).json(
        errorResponse('Authentication required', { code: 'NOT_AUTHENTICATED' })
      );
    }

    // Admins can see everything - no filter needed
    if (req.user.role === 'admin') {
      return next();
    }

    // For regular users, add filter to only show their own data
    req.userFilter = {
      [userIdField]: req.user.id
    };

    next();
  };
};

/**
 * Check if current user has specific permission
 * @param {string} permission - Permission string to check
 */
const hasPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(
        errorResponse('Authentication required', { code: 'NOT_AUTHENTICATED' })
      );
    }

    // Simple role-based permissions
    const rolePermissions = {
      admin: [
        'plans:create', 'plans:update', 'plans:delete', 'plans:read',
        'subscriptions:create', 'subscriptions:update', 'subscriptions:delete', 'subscriptions:read',
        'users:read', 'users:update', 'users:delete',
        'analytics:read', 'billing:read', 'logs:read'
      ],
      user: [
        'plans:read',
        'subscriptions:create', 'subscriptions:update', 'subscriptions:read',
        'billing:read', 'recommendations:read'
      ]
    };

    const userRole = req.user.role;
    const allowedPermissions = rolePermissions[userRole] || [];

    if (!allowedPermissions.includes(permission)) {
      return res.status(403).json(
        errorResponse(`Permission '${permission}' required`, { 
          code: 'INSUFFICIENT_PERMISSIONS',
          permission 
        })
      );
    }

    next();
  };
};

module.exports = {
  requireRole,
  requireAdmin,
  requireAdminOrOwner,
  requireOwnershipOrAdmin,
  addRoleBasedFilter,
  hasPermission
};