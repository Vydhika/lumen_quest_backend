/**
 * Authentication middleware
 * Handles JWT token validation and user authentication
 */

const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');
const { errorResponse, logger } = require('../utils/helpers');

/**
 * Middleware to authenticate JWT tokens
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json(
        errorResponse('Access token required', { code: 'MISSING_TOKEN' })
      );
    }

    // Extract token from "Bearer TOKEN" format
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader;

    if (!token) {
      return res.status(401).json(
        errorResponse('Invalid token format', { code: 'INVALID_TOKEN_FORMAT' })
      );
    }

    // For Supabase JWT tokens, we can verify them using the Supabase client
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      logger.warn(`Authentication failed: ${error?.message || 'User not found'}`);
      return res.status(401).json(
        errorResponse('Invalid or expired token', { code: 'INVALID_TOKEN' })
      );
    }

    // Get user role from user metadata or profiles table
    let userRole = 'user'; // default role
    
    try {
      // Try to get role from user metadata first
      if (user.user_metadata?.role) {
        userRole = user.user_metadata.role;
      } else if (user.app_metadata?.role) {
        userRole = user.app_metadata.role;
      } else {
        // Fallback: query profiles table for role
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        if (profile?.role) {
          userRole = profile.role;
        }
      }
    } catch (roleError) {
      logger.warn(`Could not determine user role: ${roleError.message}`);
      // Continue with default role
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email,
      role: userRole,
      emailConfirmed: user.email_confirmed_at ? true : false,
      lastSignIn: user.last_sign_in_at,
      metadata: user.user_metadata || {}
    };

    logger.debug(`User authenticated: ${user.email} (${userRole})`);
    next();

  } catch (error) {
    logger.error('Authentication error:', error);
    
    // Handle specific JWT errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json(
        errorResponse('Invalid token', { code: 'INVALID_TOKEN' })
      );
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json(
        errorResponse('Token expired', { code: 'TOKEN_EXPIRED' })
      );
    }

    return res.status(500).json(
      errorResponse('Authentication service error')
    );
  }
};

/**
 * Alternative JWT authentication for custom tokens
 * Use this if you're issuing your own JWT tokens instead of using Supabase auth
 */
const authenticateCustomToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json(
        errorResponse('Access token required', { code: 'MISSING_TOKEN' })
      );
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader;

    if (!token) {
      return res.status(401).json(
        errorResponse('Invalid token format', { code: 'INVALID_TOKEN_FORMAT' })
      );
    }

    // Verify custom JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', decoded.sub || decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json(
        errorResponse('User not found', { code: 'USER_NOT_FOUND' })
      );
    }

    // Attach user info to request
    req.user = {
      id: user.user_id,
      email: user.email,
      role: user.role || 'user',
      ...user
    };

    next();

  } catch (error) {
    logger.error('Custom token authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json(
        errorResponse('Invalid token', { code: 'INVALID_TOKEN' })
      );
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json(
        errorResponse('Token expired', { code: 'TOKEN_EXPIRED' })
      );
    }

    return res.status(500).json(
      errorResponse('Authentication service error')
    );
  }
};

/**
 * Optional authentication middleware
 * Attaches user info if token is provided, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return next(); // No token provided, continue without user info
  }

  try {
    await authenticateToken(req, res, next);
  } catch (error) {
    // Don't fail the request, just continue without user info
    logger.debug('Optional auth failed, continuing without user info');
    next();
  }
};

module.exports = {
  authenticateToken,
  authenticateCustomToken,
  optionalAuth
};