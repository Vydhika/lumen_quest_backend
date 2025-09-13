/**
 * Admin routes
 * Handles administrative operations and management
 */

const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { successResponse, errorResponse, logger } = require('../utils/helpers');
const { validateBody, validateParams, validateQuery, schemas } = require('../utils/validators');
const planService = require('../services/planService');
const subscriptionService = require('../services/subscriptionService');
const billingService = require('../services/billingService');
const analyticsService = require('../services/analyticsService');
const notificationService = require('../services/notificationService');
const Joi = require('joi');

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireRole('admin'));

// Validation schemas
const planCreateSchema = Joi.object({
  name: schemas.plan.name,
  description: schemas.plan.description,
  price: schemas.plan.price,
  billing_cycle: schemas.plan.billing_cycle,
  features: schemas.plan.features,
  limits: schemas.plan.limits,
  is_active: Joi.boolean().default(true),
  trial_days: Joi.number().integer().min(0).max(365).default(0),
  setup_fee: Joi.number().min(0).default(0),
  category: Joi.string().max(50).optional(),
  sort_order: Joi.number().integer().min(0).default(0)
});

const planUpdateSchema = planCreateSchema.fork(['name', 'price', 'billing_cycle'], (schema) => schema.optional());

const userManagementSchema = Joi.object({
  full_name: Joi.string().min(2).max(100).optional(),
  role: Joi.string().valid('user', 'admin').optional(),
  is_active: Joi.boolean().optional(),
  notes: Joi.string().max(1000).optional()
});

const subscriptionAdminUpdateSchema = Joi.object({
  status: Joi.string().valid('active', 'cancelled', 'paused', 'expired').optional(),
  plan_id: schemas.subscription.plan_id.optional(),
  billing_cycle: schemas.subscription.billing_cycle.optional(),
  auto_renewal: Joi.boolean().optional(),
  next_billing_date: Joi.date().iso().optional(),
  admin_notes: Joi.string().max(1000).optional()
});

// =============================================================================
// PLAN MANAGEMENT
// =============================================================================

/**
 * @route GET /api/admin/plans
 * @desc Get all plans with admin details
 * @access Admin
 */
router.get('/plans',
  validateQuery(schemas.pagination.query),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, is_active, category } = req.query;

    const result = await planService.getPlans({
      page: parseInt(page),
      limit: parseInt(limit),
      is_active: is_active !== undefined ? is_active === 'true' : undefined,
      category,
      includeInactive: true // Admin can see inactive plans
    });

    res.json(successResponse(result, 'Plans retrieved successfully'));
  })
);

/**
 * @route POST /api/admin/plans
 * @desc Create new plan
 * @access Admin
 */
router.post('/plans',
  validateBody(planCreateSchema),
  asyncHandler(async (req, res) => {
    const plan = await planService.createPlan(req.body);

    logger.info(`Plan created: ${plan.id} by admin: ${req.user.id}`);
    
    res.status(201).json(
      successResponse(plan, 'Plan created successfully')
    );
  })
);

/**
 * @route PUT /api/admin/plans/:id
 * @desc Update plan
 * @access Admin
 */
router.put('/plans/:id',
  validateParams(schemas.plan.params),
  validateBody(planUpdateSchema),
  asyncHandler(async (req, res) => {
    const plan = await planService.updatePlan(req.params.id, req.body);

    logger.info(`Plan updated: ${req.params.id} by admin: ${req.user.id}`);
    
    res.json(successResponse(plan, 'Plan updated successfully'));
  })
);

/**
 * @route DELETE /api/admin/plans/:id
 * @desc Soft delete plan
 * @access Admin
 */
router.delete('/plans/:id',
  validateParams(schemas.plan.params),
  asyncHandler(async (req, res) => {
    await planService.deletePlan(req.params.id);

    logger.info(`Plan deleted: ${req.params.id} by admin: ${req.user.id}`);
    
    res.json(successResponse(null, 'Plan deleted successfully'));
  })
);

/**
 * @route POST /api/admin/plans/:id/activate
 * @desc Activate plan
 * @access Admin
 */
router.post('/plans/:id/activate',
  validateParams(schemas.plan.params),
  asyncHandler(async (req, res) => {
    const plan = await planService.updatePlan(req.params.id, { is_active: true });

    logger.info(`Plan activated: ${req.params.id} by admin: ${req.user.id}`);
    
    res.json(successResponse(plan, 'Plan activated successfully'));
  })
);

/**
 * @route POST /api/admin/plans/:id/deactivate
 * @desc Deactivate plan
 * @access Admin
 */
router.post('/plans/:id/deactivate',
  validateParams(schemas.plan.params),
  asyncHandler(async (req, res) => {
    const plan = await planService.updatePlan(req.params.id, { is_active: false });

    logger.info(`Plan deactivated: ${req.params.id} by admin: ${req.user.id}`);
    
    res.json(successResponse(plan, 'Plan deactivated successfully'));
  })
);

// =============================================================================
// USER MANAGEMENT
// =============================================================================

/**
 * @route GET /api/admin/users
 * @desc Get all users
 * @access Admin
 */
router.get('/users',
  validateQuery(schemas.pagination.query.keys({
    search: Joi.string().min(2).optional(),
    role: Joi.string().valid('user', 'admin').optional(),
    is_active: Joi.boolean().optional()
  })),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, search, role, is_active } = req.query;
    const { supabase } = require('../config/supabase');

    let query = supabase
      .from('profiles')
      .select(`
        *,
        subscriptions:subscriptions(count)
      `, { count: 'exact' });

    // Apply filters
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    if (role) {
      query = query.eq('role', role);
    }
    if (is_active !== undefined) {
      query = query.eq('is_active', is_active);
    }

    // Apply pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: users, error, count } = await query;

    if (error) {
      throw error;
    }

    const result = {
      users: users || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / parseInt(limit))
      }
    };

    res.json(successResponse(result, 'Users retrieved successfully'));
  })
);

/**
 * @route GET /api/admin/users/:id
 * @desc Get user details
 * @access Admin
 */
router.get('/users/:id',
  validateParams(Joi.object({ id: Joi.string().uuid().required() })),
  asyncHandler(async (req, res) => {
    const { supabase } = require('../config/supabase');

    const { data: user, error } = await supabase
      .from('profiles')
      .select(`
        *,
        subscriptions:subscriptions(*,
          plan:plans(*)
        )
      `)
      .eq('user_id', req.params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json(errorResponse('User not found'));
      }
      throw error;
    }

    res.json(successResponse(user, 'User retrieved successfully'));
  })
);

/**
 * @route PUT /api/admin/users/:id
 * @desc Update user
 * @access Admin
 */
router.put('/users/:id',
  validateParams(Joi.object({ id: Joi.string().uuid().required() })),
  validateBody(userManagementSchema),
  asyncHandler(async (req, res) => {
    const { supabase } = require('../config/supabase');

    const updateData = {
      ...req.body,
      updated_at: new Date().toISOString()
    };

    const { data: user, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('user_id', req.params.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info(`User updated: ${req.params.id} by admin: ${req.user.id}`);
    
    res.json(successResponse(user, 'User updated successfully'));
  })
);

// =============================================================================
// SUBSCRIPTION MANAGEMENT
// =============================================================================

/**
 * @route GET /api/admin/subscriptions
 * @desc Get all subscriptions with admin details
 * @access Admin
 */
router.get('/subscriptions',
  validateQuery(schemas.pagination.query.keys({
    status: Joi.string().valid('active', 'cancelled', 'paused', 'expired').optional(),
    plan_id: Joi.string().uuid().optional(),
    user_id: Joi.string().uuid().optional()
  })),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, plan_id, user_id } = req.query;

    const result = await subscriptionService.getAllSubscriptions({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      plan_id,
      user_id
    });

    res.json(successResponse(result, 'Subscriptions retrieved successfully'));
  })
);

/**
 * @route PUT /api/admin/subscriptions/:id
 * @desc Update subscription (admin override)
 * @access Admin
 */
router.put('/subscriptions/:id',
  validateParams(schemas.subscription.params),
  validateBody(subscriptionAdminUpdateSchema),
  asyncHandler(async (req, res) => {
    const subscription = await subscriptionService.adminUpdateSubscription(
      req.params.id,
      req.body,
      req.user.id
    );

    logger.info(`Subscription admin updated: ${req.params.id} by admin: ${req.user.id}`);
    
    res.json(successResponse(subscription, 'Subscription updated successfully'));
  })
);

/**
 * @route POST /api/admin/subscriptions/:id/force-cancel
 * @desc Force cancel subscription
 * @access Admin
 */
router.post('/subscriptions/:id/force-cancel',
  validateParams(schemas.subscription.params),
  asyncHandler(async (req, res) => {
    const { reason = 'Admin cancellation' } = req.body;

    const subscription = await subscriptionService.adminCancelSubscription(
      req.params.id,
      req.user.id,
      reason
    );

    logger.info(`Subscription force cancelled: ${req.params.id} by admin: ${req.user.id}`);
    
    res.json(successResponse(subscription, 'Subscription cancelled successfully'));
  })
);

// =============================================================================
// BILLING & FINANCIAL MANAGEMENT
// =============================================================================

/**
 * @route GET /api/admin/billing/invoices
 * @desc Get all invoices
 * @access Admin
 */
router.get('/billing/invoices',
  validateQuery(schemas.pagination.query.keys({
    status: Joi.string().valid('pending', 'paid', 'failed', 'cancelled').optional(),
    user_id: Joi.string().uuid().optional(),
    subscription_id: Joi.string().uuid().optional()
  })),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, user_id, subscription_id } = req.query;

    const result = await billingService.getAllInvoices({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      user_id,
      subscription_id
    });

    res.json(successResponse(result, 'Invoices retrieved successfully'));
  })
);

/**
 * @route POST /api/admin/billing/invoices/:id/refund
 * @desc Refund invoice
 * @access Admin
 */
router.post('/billing/invoices/:id/refund',
  validateParams(Joi.object({ id: Joi.string().uuid().required() })),
  validateBody(Joi.object({
    amount: Joi.number().positive().optional(),
    reason: Joi.string().max(500).required()
  })),
  asyncHandler(async (req, res) => {
    const { amount, reason } = req.body;

    const refund = await billingService.processRefund(
      req.params.id,
      { amount, reason, admin_id: req.user.id }
    );

    logger.info(`Refund processed: ${req.params.id} by admin: ${req.user.id}`);
    
    res.json(successResponse(refund, 'Refund processed successfully'));
  })
);

// =============================================================================
// ANALYTICS & REPORTING
// =============================================================================

/**
 * @route GET /api/admin/analytics/dashboard
 * @desc Get admin dashboard analytics
 * @access Admin
 */
router.get('/analytics/dashboard', asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;

  const analytics = await analyticsService.getAdminDashboard(period);

  res.json(successResponse(analytics, 'Dashboard analytics retrieved successfully'));
}));

/**
 * @route GET /api/admin/analytics/revenue
 * @desc Get revenue analytics
 * @access Admin
 */
router.get('/analytics/revenue',
  validateQuery(Joi.object({
    period: Joi.string().valid('7d', '30d', '90d', '1y').default('30d'),
    granularity: Joi.string().valid('day', 'week', 'month').default('day')
  })),
  asyncHandler(async (req, res) => {
    const { period = '30d', granularity = 'day' } = req.query;

    const analytics = await analyticsService.getRevenueAnalytics({
      period,
      granularity
    });

    res.json(successResponse(analytics, 'Revenue analytics retrieved successfully'));
  })
);

/**
 * @route GET /api/admin/analytics/churn
 * @desc Get churn analytics
 * @access Admin
 */
router.get('/analytics/churn',
  validateQuery(Joi.object({
    period: Joi.string().valid('30d', '90d', '1y').default('90d')
  })),
  asyncHandler(async (req, res) => {
    const { period = '90d' } = req.query;

    const analytics = await analyticsService.getChurnAnalytics(period);

    res.json(successResponse(analytics, 'Churn analytics retrieved successfully'));
  })
);

/**
 * @route GET /api/admin/analytics/plans
 * @desc Get plan performance analytics
 * @access Admin
 */
router.get('/analytics/plans', asyncHandler(async (req, res) => {
  const analytics = await analyticsService.getPlanAnalytics();

  res.json(successResponse(analytics, 'Plan analytics retrieved successfully'));
}));

// =============================================================================
// NOTIFICATION MANAGEMENT
// =============================================================================

/**
 * @route POST /api/admin/notifications/send
 * @desc Send notification to users
 * @access Admin
 */
router.post('/notifications/send',
  validateBody(Joi.object({
    type: Joi.string().valid('email', 'sms', 'push').required(),
    recipients: Joi.array().items(Joi.string().uuid()).required(),
    subject: Joi.string().max(255).required(),
    message: Joi.string().max(2000).required(),
    template: Joi.string().optional(),
    data: Joi.object().optional(),
    scheduled_at: Joi.date().iso().optional()
  })),
  asyncHandler(async (req, res) => {
    const notification = await notificationService.sendBulkNotification({
      ...req.body,
      admin_id: req.user.id
    });

    logger.info(`Bulk notification sent by admin: ${req.user.id}`);
    
    res.json(successResponse(notification, 'Notification sent successfully'));
  })
);

/**
 * @route GET /api/admin/notifications/templates
 * @desc Get notification templates
 * @access Admin
 */
router.get('/notifications/templates', asyncHandler(async (req, res) => {
  const templates = await notificationService.getNotificationTemplates();

  res.json(successResponse(templates, 'Templates retrieved successfully'));
}));

// =============================================================================
// SYSTEM MANAGEMENT
// =============================================================================

/**
 * @route GET /api/admin/system/health
 * @desc Get system health status
 * @access Admin
 */
router.get('/system/health', asyncHandler(async (req, res) => {
  const { supabase } = require('../config/supabase');

  // Check database connection
  const { data: dbHealth, error: dbError } = await supabase
    .from('plans')
    .select('count')
    .limit(1);

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: {
        status: dbError ? 'unhealthy' : 'healthy',
        response_time: 'N/A'
      },
      api: {
        status: 'healthy',
        uptime: process.uptime()
      }
    }
  };

  if (dbError) {
    health.status = 'degraded';
    health.services.database.error = dbError.message;
  }

  res.json(successResponse(health, 'System health retrieved successfully'));
}));

/**
 * @route GET /api/admin/system/stats
 * @desc Get system statistics
 * @access Admin
 */
router.get('/system/stats', asyncHandler(async (req, res) => {
  const stats = await analyticsService.getSystemStats();

  res.json(successResponse(stats, 'System statistics retrieved successfully'));
}));

module.exports = router;