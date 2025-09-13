/**
 * Authentication routes
 * Handles user authentication, registration, and token management
 */

const express = require('express');
const { supabase } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/authMiddleware');
const { successResponse, errorResponse, logger } = require('../utils/helpers');
const { validateBody, schemas } = require('../utils/validators');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const signUpSchema = Joi.object({
  email: schemas.user.email,
  password: schemas.user.password,
  full_name: Joi.string().min(2).max(100),
  role: Joi.string().valid('user', 'admin').default('user')
});

const signInSchema = Joi.object({
  email: schemas.user.email,
  password: schemas.user.password
});

const resetPasswordSchema = Joi.object({
  email: schemas.user.email
});

const updatePasswordSchema = Joi.object({
  current_password: Joi.string().required(),
  new_password: schemas.user.password
});

/**
 * @route POST /api/auth/signup
 * @desc Register a new user
 * @access Public
 */
router.post('/signup',
  validateBody(signUpSchema),
  asyncHandler(async (req, res) => {
    const { email, password, full_name, role = 'user' } = req.body;

    // Sign up user with Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          role
        }
      }
    });

    if (authError) {
      logger.error('Signup error:', authError);
      return res.status(400).json(
        errorResponse(authError.message || 'Registration failed')
      );
    }

    // If user is created successfully
    if (authData.user) {
      // Create or update profile record
      try {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            user_id: authData.user.id,
            email: authData.user.email,
            full_name,
            role,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (profileError) {
          logger.warn('Profile creation warning:', profileError);
        }
      } catch (profileError) {
        logger.warn('Could not create profile:', profileError);
      }

      logger.info(`User registered: ${email} (${authData.user.id})`);
      
      res.status(201).json(successResponse({
        user: {
          id: authData.user.id,
          email: authData.user.email,
          full_name,
          role,
          email_confirmed: authData.user.email_confirmed_at ? true : false
        },
        session: authData.session
      }, 'User registered successfully'));
    } else {
      res.status(400).json(
        errorResponse('Registration failed - please try again')
      );
    }
  })
);

/**
 * @route POST /api/auth/signin
 * @desc Sign in user
 * @access Public
 */
router.post('/signin',
  validateBody(signInSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      logger.warn(`Failed signin attempt for: ${email}`);
      return res.status(401).json(
        errorResponse('Invalid email or password')
      );
    }

    // Get user profile
    let userProfile = null;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', authData.user.id)
        .single();
      
      userProfile = profile;
    } catch (profileError) {
      logger.warn('Could not fetch user profile:', profileError);
    }

    logger.info(`User signed in: ${email}`);
    
    res.json(successResponse({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: userProfile?.role || authData.user.user_metadata?.role || 'user',
        full_name: userProfile?.full_name || authData.user.user_metadata?.full_name,
        email_confirmed: authData.user.email_confirmed_at ? true : false,
        last_sign_in: authData.user.last_sign_in_at,
        profile: userProfile
      },
      session: authData.session
    }, 'Signed in successfully'));
  })
);

/**
 * @route POST /api/auth/signout
 * @desc Sign out user
 * @access Private
 */
router.post('/signout',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      logger.error('Signout error:', error);
      return res.status(400).json(
        errorResponse('Sign out failed')
      );
    }

    logger.info(`User signed out: ${req.user.email}`);
    
    res.json(successResponse(null, 'Signed out successfully'));
  })
);

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token
 * @access Public
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json(
      errorResponse('Refresh token is required')
    );
  }

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token
  });

  if (error) {
    logger.error('Token refresh error:', error);
    return res.status(401).json(
      errorResponse('Invalid refresh token')
    );
  }

  res.json(successResponse({
    session: data.session,
    user: data.user
  }, 'Token refreshed successfully'));
}));

/**
 * @route POST /api/auth/forgot-password
 * @desc Request password reset
 * @access Public
 */
router.post('/forgot-password',
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password`
    });

    if (error) {
      logger.error('Password reset request error:', error);
      return res.status(400).json(
        errorResponse(error.message || 'Password reset request failed')
      );
    }

    logger.info(`Password reset requested for: ${email}`);
    
    // Always return success for security (don't reveal if email exists)
    res.json(successResponse(null, 'If the email exists, a password reset link has been sent'));
  })
);

/**
 * @route POST /api/auth/update-password
 * @desc Update user password
 * @access Private
 */
router.post('/update-password',
  authenticateToken,
  validateBody(updatePasswordSchema),
  asyncHandler(async (req, res) => {
    const { new_password } = req.body;

    const { error } = await supabase.auth.updateUser({
      password: new_password
    });

    if (error) {
      logger.error('Password update error:', error);
      return res.status(400).json(
        errorResponse(error.message || 'Password update failed')
      );
    }

    logger.info(`Password updated for user: ${req.user.email}`);
    
    res.json(successResponse(null, 'Password updated successfully'));
  })
);

/**
 * @route GET /api/auth/me
 * @desc Get current user info
 * @access Private
 */
router.get('/me',
  authenticateToken,
  asyncHandler(async (req, res) => {
    // Get fresh user data from Supabase
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      return res.status(401).json(
        errorResponse('Invalid session')
      );
    }

    // Get user profile
    let userProfile = null;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userData.user.id)
        .single();
      
      userProfile = profile;
    } catch (profileError) {
      logger.warn('Could not fetch user profile:', profileError);
    }

    res.json(successResponse({
      id: userData.user.id,
      email: userData.user.email,
      role: userProfile?.role || userData.user.user_metadata?.role || 'user',
      full_name: userProfile?.full_name || userData.user.user_metadata?.full_name,
      email_confirmed: userData.user.email_confirmed_at ? true : false,
      created_at: userData.user.created_at,
      last_sign_in: userData.user.last_sign_in_at,
      profile: userProfile
    }, 'User info retrieved successfully'));
  })
);

/**
 * @route POST /api/auth/resend-confirmation
 * @desc Resend email confirmation
 * @access Public
 */
router.post('/resend-confirmation',
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email
    });

    if (error) {
      logger.error('Resend confirmation error:', error);
      return res.status(400).json(
        errorResponse(error.message || 'Failed to resend confirmation')
      );
    }

    logger.info(`Confirmation email resent to: ${email}`);
    
    res.json(successResponse(null, 'Confirmation email sent'));
  })
);

module.exports = router;