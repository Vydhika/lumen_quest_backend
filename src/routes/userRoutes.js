/**
 * User routes
 * Handles authenticated user operations including subscriptions and billing
 */

const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/authMiddleware');
const { successResponse, errorResponse, logger } = require('../utils/helpers');
const { validateBody, validateParams, validateQuery, schemas } = require('../utils/validators');
const subscriptionService = require('../services/subscriptionService');
const billingService = require('../services/billingService');
const Joi = require('joi');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Validation schemas
const subscriptionCreateSchema = Joi.object({
  plan_id: schemas.subscription.plan_id,
  billing_cycle: schemas.subscription.billing_cycle,
  payment_method_id: Joi.string().required(),
  billing_address: Joi.object({
    line1: Joi.string().required(),
    line2: Joi.string().allow('', null),
    city: Joi.string().required(),
    state: Joi.string().required(),
    postal_code: Joi.string().required(),
    country: Joi.string().required()
  }).required()
});

const subscriptionUpdateSchema = Joi.object({
  plan_id: schemas.subscription.plan_id.optional(),
  billing_cycle: schemas.subscription.billing_cycle.optional(),
  auto_renewal: Joi.boolean().optional(),
  notes: Joi.string().max(500).allow('', null).optional()
});

const paymentMethodSchema = Joi.object({
  type: Joi.string().valid('card', 'bank_account').required(),
  card_token: Joi.string().when('type', { is: 'card', then: Joi.required() }),
  bank_token: Joi.string().when('type', { is: 'bank_account', then: Joi.required() }),
  is_default: Joi.boolean().default(false)
});

// =============================================================================
// SUBSCRIPTION MANAGEMENT
// =============================================================================

/**
 * @route GET /api/user/subscriptions
 * @desc Get user's subscriptions
 * @access Private
 */
router.get('/subscriptions',
  validateQuery(schemas.pagination.query),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status } = req.query;

    const result = await subscriptionService.getUserSubscriptions(
      req.user.id,
      { page: parseInt(page), limit: parseInt(limit), status }
    );

    res.json(successResponse(result, 'Subscriptions retrieved successfully'));
  })
);

/**
 * @route GET /api/user/subscriptions/:id
 * @desc Get specific subscription details
 * @access Private
 */
router.get('/subscriptions/:id',
  validateParams(schemas.subscription.params),
  asyncHandler(async (req, res) => {
    const subscription = await subscriptionService.getSubscriptionById(
      req.params.id, 
      req.user.id
    );

    if (!subscription) {
      return res.status(404).json(
        errorResponse('Subscription not found')
      );
    }

    res.json(successResponse(subscription, 'Subscription retrieved successfully'));
  })
);

/**
 * @route POST /api/user/subscriptions
 * @desc Create new subscription
 * @access Private
 */
router.post('/subscriptions',
  validateBody(subscriptionCreateSchema),
  asyncHandler(async (req, res) => {
    const subscriptionData = {
      ...req.body,
      user_id: req.user.id
    };

    const subscription = await subscriptionService.createSubscription(subscriptionData);

    logger.info(`Subscription created: ${subscription.id} for user: ${req.user.id}`);
    
    res.status(201).json(
      successResponse(subscription, 'Subscription created successfully')
    );
  })
);

/**
 * @route PUT /api/user/subscriptions/:id
 * @desc Update subscription
 * @access Private
 */
router.put('/subscriptions/:id',
  validateParams(schemas.subscription.params),
  validateBody(subscriptionUpdateSchema),
  asyncHandler(async (req, res) => {
    const subscription = await subscriptionService.updateSubscription(
      req.params.id,
      req.body,
      req.user.id
    );

    logger.info(`Subscription updated: ${req.params.id} by user: ${req.user.id}`);
    
    res.json(successResponse(subscription, 'Subscription updated successfully'));
  })
);

/**
 * @route POST /api/user/subscriptions/:id/cancel
 * @desc Cancel subscription
 * @access Private
 */
router.post('/subscriptions/:id/cancel',
  validateParams(schemas.subscription.params),
  asyncHandler(async (req, res) => {
    const { immediate = false, reason } = req.body;

    const subscription = await subscriptionService.cancelSubscription(
      req.params.id,
      req.user.id,
      { immediate, reason }
    );

    logger.info(`Subscription cancelled: ${req.params.id} by user: ${req.user.id}`);
    
    res.json(successResponse(subscription, 'Subscription cancelled successfully'));
  })
);

/**
 * @route POST /api/user/subscriptions/:id/reactivate
 * @desc Reactivate cancelled subscription
 * @access Private
 */
router.post('/subscriptions/:id/reactivate',
  validateParams(schemas.subscription.params),
  asyncHandler(async (req, res) => {
    const subscription = await subscriptionService.reactivateSubscription(
      req.params.id,
      req.user.id
    );

    logger.info(`Subscription reactivated: ${req.params.id} by user: ${req.user.id}`);
    
    res.json(successResponse(subscription, 'Subscription reactivated successfully'));
  })
);

/**
 * @route POST /api/user/subscriptions/:id/pause
 * @desc Pause subscription
 * @access Private
 */
router.post('/subscriptions/:id/pause',
  validateParams(schemas.subscription.params),
  asyncHandler(async (req, res) => {
    const { duration_days, reason } = req.body;

    const subscription = await subscriptionService.pauseSubscription(
      req.params.id,
      req.user.id,
      { duration_days, reason }
    );

    logger.info(`Subscription paused: ${req.params.id} by user: ${req.user.id}`);
    
    res.json(successResponse(subscription, 'Subscription paused successfully'));
  })
);

/**
 * @route POST /api/user/subscriptions/:id/resume
 * @desc Resume paused subscription
 * @access Private
 */
router.post('/subscriptions/:id/resume',
  validateParams(schemas.subscription.params),
  asyncHandler(async (req, res) => {
    const subscription = await subscriptionService.resumeSubscription(
      req.params.id,
      req.user.id
    );

    logger.info(`Subscription resumed: ${req.params.id} by user: ${req.user.id}`);
    
    res.json(successResponse(subscription, 'Subscription resumed successfully'));
  })
);

// =============================================================================
// BILLING MANAGEMENT
// =============================================================================

/**
 * @route GET /api/user/billing/invoices
 * @desc Get user's billing invoices
 * @access Private
 */
router.get('/billing/invoices',
  validateQuery(schemas.pagination.query),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status, subscription_id } = req.query;

    const result = await billingService.getUserInvoices(
      req.user.id,
      { page: parseInt(page), limit: parseInt(limit), status, subscription_id }
    );

    res.json(successResponse(result, 'Invoices retrieved successfully'));
  })
);

/**
 * @route GET /api/user/billing/invoices/:id
 * @desc Get specific invoice details
 * @access Private
 */
router.get('/billing/invoices/:id',
  validateParams(Joi.object({ id: Joi.string().uuid().required() })),
  asyncHandler(async (req, res) => {
    const invoice = await billingService.getInvoiceById(
      req.params.id, 
      req.user.id
    );

    if (!invoice) {
      return res.status(404).json(
        errorResponse('Invoice not found')
      );
    }

    res.json(successResponse(invoice, 'Invoice retrieved successfully'));
  })
);

/**
 * @route POST /api/user/billing/invoices/:id/pay
 * @desc Pay invoice
 * @access Private
 */
router.post('/billing/invoices/:id/pay',
  validateParams(Joi.object({ id: Joi.string().uuid().required() })),
  asyncHandler(async (req, res) => {
    const { payment_method_id } = req.body;

    const payment = await billingService.processInvoicePayment(
      req.params.id,
      req.user.id,
      { payment_method_id }
    );

    logger.info(`Invoice payment processed: ${req.params.id} by user: ${req.user.id}`);
    
    res.json(successResponse(payment, 'Payment processed successfully'));
  })
);

/**
 * @route GET /api/user/billing/payment-methods
 * @desc Get user's payment methods
 * @access Private
 */
router.get('/billing/payment-methods', asyncHandler(async (req, res) => {
  const paymentMethods = await billingService.getUserPaymentMethods(req.user.id);

  res.json(successResponse(paymentMethods, 'Payment methods retrieved successfully'));
}));

/**
 * @route POST /api/user/billing/payment-methods
 * @desc Add payment method
 * @access Private
 */
router.post('/billing/payment-methods',
  validateBody(paymentMethodSchema),
  asyncHandler(async (req, res) => {
    const paymentMethodData = {
      ...req.body,
      user_id: req.user.id
    };

    const paymentMethod = await billingService.addPaymentMethod(paymentMethodData);

    logger.info(`Payment method added for user: ${req.user.id}`);
    
    res.status(201).json(
      successResponse(paymentMethod, 'Payment method added successfully')
    );
  })
);

/**
 * @route DELETE /api/user/billing/payment-methods/:id
 * @desc Remove payment method
 * @access Private
 */
router.delete('/billing/payment-methods/:id',
  validateParams(Joi.object({ id: Joi.string().uuid().required() })),
  asyncHandler(async (req, res) => {
    await billingService.removePaymentMethod(
      req.params.id,
      req.user.id
    );

    logger.info(`Payment method removed: ${req.params.id} by user: ${req.user.id}`);
    
    res.json(successResponse(null, 'Payment method removed successfully'));
  })
);

/**
 * @route PUT /api/user/billing/payment-methods/:id/default
 * @desc Set default payment method
 * @access Private
 */
router.put('/billing/payment-methods/:id/default',
  validateParams(Joi.object({ id: Joi.string().uuid().required() })),
  asyncHandler(async (req, res) => {
    const paymentMethod = await billingService.setDefaultPaymentMethod(
      req.params.id,
      req.user.id
    );

    logger.info(`Default payment method set: ${req.params.id} by user: ${req.user.id}`);
    
    res.json(successResponse(paymentMethod, 'Default payment method updated'));
  })
);

// =============================================================================
// USER PROFILE & PREFERENCES
// =============================================================================

/**
 * @route GET /api/user/profile
 * @desc Get user profile
 * @access Private
 */
router.get('/profile', asyncHandler(async (req, res) => {
  const { supabase } = require('../config/supabase');
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', req.user.id)
    .single();

  if (error && error.code !== 'PGRST116') { // Not found is ok
    throw error;
  }

  res.json(successResponse(profile || {}, 'Profile retrieved successfully'));
}));

/**
 * @route PUT /api/user/profile
 * @desc Update user profile
 * @access Private
 */
router.put('/profile',
  validateBody(Joi.object({
    full_name: Joi.string().min(2).max(100).optional(),
    phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional(),
    billing_address: Joi.object({
      line1: Joi.string().required(),
      line2: Joi.string().allow('', null),
      city: Joi.string().required(),
      state: Joi.string().required(),
      postal_code: Joi.string().required(),
      country: Joi.string().required()
    }).optional(),
    preferences: Joi.object({
      email_notifications: Joi.boolean().default(true),
      sms_notifications: Joi.boolean().default(false),
      marketing_emails: Joi.boolean().default(false),
      language: Joi.string().default('en'),
      timezone: Joi.string().default('UTC')
    }).optional()
  })),
  asyncHandler(async (req, res) => {
    const { supabase } = require('../config/supabase');
    
    const updateData = {
      ...req.body,
      updated_at: new Date().toISOString()
    };

    const { data: profile, error } = await supabase
      .from('profiles')
      .upsert({
        user_id: req.user.id,
        email: req.user.email,
        ...updateData
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info(`Profile updated for user: ${req.user.id}`);
    
    res.json(successResponse(profile, 'Profile updated successfully'));
  })
);

/**
 * @route GET /api/user/usage
 * @desc Get user's subscription usage statistics
 * @access Private
 */
router.get('/usage', asyncHandler(async (req, res) => {
  const { subscription_id, period = '30d' } = req.query;

  const usage = await subscriptionService.getUserUsageStats(
    req.user.id,
    { subscription_id, period }
  );

  res.json(successResponse(usage, 'Usage statistics retrieved successfully'));
}));

/**
 * @route GET /api/user/recommendations
 * @desc Get personalized plan recommendations
 * @access Private
 */
router.get('/recommendations', asyncHandler(async (req, res) => {
  const recommendations = await subscriptionService.getPersonalizedRecommendations(
    req.user.id
  );

  res.json(successResponse(recommendations, 'Recommendations retrieved successfully'));
}));

module.exports = router;