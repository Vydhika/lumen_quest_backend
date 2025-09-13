/**
 * Analytics routes
 * Handles analytics and reporting endpoints
 */

const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { successResponse, errorResponse, logger } = require('../utils/helpers');
const { validateQuery } = require('../utils/validators');
const analyticsService = require('../services/analyticsService');
const Joi = require('joi');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Validation schemas
const periodSchema = Joi.object({
  period: Joi.string().valid('7d', '30d', '90d', '1y').default('30d'),
  granularity: Joi.string().valid('hour', 'day', 'week', 'month').default('day')
});

const dateRangeSchema = Joi.object({
  date_from: Joi.date().iso().required(),
  date_to: Joi.date().iso().required(),
  granularity: Joi.string().valid('hour', 'day', 'week', 'month').default('day')
});

const cohortSchema = Joi.object({
  cohort_period: Joi.string().valid('week', 'month', 'quarter').default('month'),
  analysis_period: Joi.string().valid('30d', '90d', '180d', '1y').default('90d')
});

// =============================================================================
// USER ANALYTICS (Available to all authenticated users)
// =============================================================================

/**
 * @route GET /api/analytics/user/usage
 * @desc Get user's personal usage analytics
 * @access Private
 */
router.get('/user/usage',
  validateQuery(periodSchema),
  asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;

    const usage = await analyticsService.getUserUsageAnalytics(
      req.user.id,
      period
    );

    res.json(successResponse(usage, 'User usage analytics retrieved successfully'));
  })
);

/**
 * @route GET /api/analytics/user/subscription-history
 * @desc Get user's subscription analytics
 * @access Private
 */
router.get('/user/subscription-history', asyncHandler(async (req, res) => {
  const analytics = await analyticsService.getUserSubscriptionAnalytics(req.user.id);

  res.json(successResponse(analytics, 'User subscription analytics retrieved successfully'));
}));

/**
 * @route GET /api/analytics/user/spending
 * @desc Get user's spending analytics
 * @access Private
 */
router.get('/user/spending',
  validateQuery(periodSchema),
  asyncHandler(async (req, res) => {
    const { period = '1y', granularity = 'month' } = req.query;

    const spending = await analyticsService.getUserSpendingAnalytics(
      req.user.id,
      { period, granularity }
    );

    res.json(successResponse(spending, 'User spending analytics retrieved successfully'));
  })
);

/**
 * @route GET /api/analytics/user/recommendations
 * @desc Get personalized recommendations based on usage
 * @access Private
 */
router.get('/user/recommendations', asyncHandler(async (req, res) => {
  const recommendations = await analyticsService.getUserRecommendations(req.user.id);

  res.json(successResponse(recommendations, 'User recommendations retrieved successfully'));
}));

// =============================================================================
// ADMIN ANALYTICS (Admin access required)
// =============================================================================

/**
 * @route GET /api/analytics/admin/dashboard
 * @desc Get comprehensive admin dashboard analytics
 * @access Admin
 */
router.get('/admin/dashboard',
  requireRole('admin'),
  validateQuery(periodSchema),
  asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;

    const dashboard = await analyticsService.getAdminDashboard(period);

    res.json(successResponse(dashboard, 'Admin dashboard analytics retrieved successfully'));
  })
);

/**
 * @route GET /api/analytics/admin/revenue
 * @desc Get detailed revenue analytics
 * @access Admin
 */
router.get('/admin/revenue',
  requireRole('admin'),
  validateQuery(periodSchema),
  asyncHandler(async (req, res) => {
    const { period = '30d', granularity = 'day' } = req.query;

    const revenue = await analyticsService.getRevenueAnalytics({
      period,
      granularity
    });

    res.json(successResponse(revenue, 'Revenue analytics retrieved successfully'));
  })
);

/**
 * @route GET /api/analytics/admin/revenue/forecast
 * @desc Get revenue forecast
 * @access Admin
 */
router.get('/admin/revenue/forecast',
  requireRole('admin'),
  validateQuery(Joi.object({
    months_ahead: Joi.number().integer().min(1).max(12).default(3),
    confidence_level: Joi.number().min(0.5).max(0.99).default(0.95)
  })),
  asyncHandler(async (req, res) => {
    const { months_ahead = 3, confidence_level = 0.95 } = req.query;

    const forecast = await analyticsService.getRevenueForecast({
      months_ahead: parseInt(months_ahead),
      confidence_level: parseFloat(confidence_level)
    });

    res.json(successResponse(forecast, 'Revenue forecast retrieved successfully'));
  })
);

/**
 * @route GET /api/analytics/admin/subscriptions
 * @desc Get subscription analytics
 * @access Admin
 */
router.get('/admin/subscriptions',
  requireRole('admin'),
  validateQuery(periodSchema),
  asyncHandler(async (req, res) => {
    const { period = '30d', granularity = 'day' } = req.query;

    const subscriptions = await analyticsService.getSubscriptionAnalytics({
      period,
      granularity
    });

    res.json(successResponse(subscriptions, 'Subscription analytics retrieved successfully'));
  })
);

/**
 * @route GET /api/analytics/admin/churn
 * @desc Get churn analysis
 * @access Admin
 */
router.get('/admin/churn',
  requireRole('admin'),
  validateQuery(cohortSchema),
  asyncHandler(async (req, res) => {
    const { cohort_period = 'month', analysis_period = '90d' } = req.query;

    const churn = await analyticsService.getChurnAnalytics({
      cohort_period,
      analysis_period
    });

    res.json(successResponse(churn, 'Churn analytics retrieved successfully'));
  })
);

/**
 * @route GET /api/analytics/admin/churn/prediction
 * @desc Get churn prediction
 * @access Admin
 */
router.get('/admin/churn/prediction',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const prediction = await analyticsService.getChurnPrediction();

    res.json(successResponse(prediction, 'Churn prediction retrieved successfully'));
  })
);

/**
 * @route GET /api/analytics/admin/cohort
 * @desc Get cohort analysis
 * @access Admin
 */
router.get('/admin/cohort',
  requireRole('admin'),
  validateQuery(cohortSchema),
  asyncHandler(async (req, res) => {
    const { cohort_period = 'month', analysis_period = '90d' } = req.query;

    const cohort = await analyticsService.getCohortAnalysis({
      cohort_period,
      analysis_period
    });

    res.json(successResponse(cohort, 'Cohort analysis retrieved successfully'));
  })
);

/**
 * @route GET /api/analytics/admin/plans
 * @desc Get plan performance analytics
 * @access Admin
 */
router.get('/admin/plans',
  requireRole('admin'),
  validateQuery(periodSchema),
  asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;

    const plans = await analyticsService.getPlanAnalytics(period);

    res.json(successResponse(plans, 'Plan analytics retrieved successfully'));
  })
);

/**
 * @route GET /api/analytics/admin/customer-lifetime-value
 * @desc Get customer lifetime value analytics
 * @access Admin
 */
router.get('/admin/customer-lifetime-value',
  requireRole('admin'),
  validateQuery(Joi.object({
    segment: Joi.string().valid('all', 'new', 'existing', 'churned').default('all'),
    period: Joi.string().valid('30d', '90d', '1y', 'all').default('1y')
  })),
  asyncHandler(async (req, res) => {
    const { segment = 'all', period = '1y' } = req.query;

    const clv = await analyticsService.getCustomerLifetimeValue({
      segment,
      period
    });

    res.json(successResponse(clv, 'Customer lifetime value analytics retrieved successfully'));
  })
);

/**
 * @route GET /api/analytics/admin/geographic
 * @desc Get geographic distribution analytics
 * @access Admin
 */
router.get('/admin/geographic',
  requireRole('admin'),
  validateQuery(periodSchema),
  asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;

    const geographic = await analyticsService.getGeographicAnalytics(period);

    res.json(successResponse(geographic, 'Geographic analytics retrieved successfully'));
  })
);

/**
 * @route GET /api/analytics/admin/payment-methods
 * @desc Get payment method analytics
 * @access Admin
 */
router.get('/admin/payment-methods',
  requireRole('admin'),
  validateQuery(periodSchema),
  asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;

    const paymentMethods = await analyticsService.getPaymentMethodAnalytics(period);

    res.json(successResponse(paymentMethods, 'Payment method analytics retrieved successfully'));
  })
);

/**
 * @route GET /api/analytics/admin/failed-payments
 * @desc Get failed payment analytics
 * @access Admin
 */
router.get('/admin/failed-payments',
  requireRole('admin'),
  validateQuery(periodSchema),
  asyncHandler(async (req, res) => {
    const { period = '30d', granularity = 'day' } = req.query;

    const failedPayments = await analyticsService.getFailedPaymentAnalytics({
      period,
      granularity
    });

    res.json(successResponse(failedPayments, 'Failed payment analytics retrieved successfully'));
  })
);

// =============================================================================
// CUSTOM REPORTS
// =============================================================================

/**
 * @route POST /api/analytics/admin/custom-report
 * @desc Generate custom analytics report
 * @access Admin
 */
router.post('/admin/custom-report',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const {
      metrics,
      dimensions,
      filters,
      date_range,
      granularity = 'day'
    } = req.body;

    const report = await analyticsService.generateCustomReport({
      metrics,
      dimensions,
      filters,
      date_range,
      granularity
    });

    logger.info(`Custom report generated by admin: ${req.user.id}`);
    
    res.json(successResponse(report, 'Custom report generated successfully'));
  })
);

/**
 * @route GET /api/analytics/admin/export
 * @desc Export analytics data
 * @access Admin
 */
router.get('/admin/export',
  requireRole('admin'),
  validateQuery(Joi.object({
    type: Joi.string().valid(
      'revenue',
      'subscriptions',
      'users',
      'churn',
      'plans',
      'payments'
    ).required(),
    format: Joi.string().valid('csv', 'json', 'xlsx').default('csv'),
    period: Joi.string().valid('7d', '30d', '90d', '1y').default('30d')
  })),
  asyncHandler(async (req, res) => {
    const { type, format = 'csv', period = '30d' } = req.query;

    const exportData = await analyticsService.exportAnalyticsData({
      type,
      format,
      period
    });

    const contentType = {
      csv: 'text/csv',
      json: 'application/json',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }[format];

    const fileExtension = format;
    const timestamp = new Date().toISOString().split('T')[0];

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="analytics-${type}-${timestamp}.${fileExtension}"`
    );

    logger.info(`Analytics data exported: ${type} by admin: ${req.user.id}`);
    
    res.send(exportData);
  })
);

// =============================================================================
// REAL-TIME ANALYTICS
// =============================================================================

/**
 * @route GET /api/analytics/admin/realtime
 * @desc Get real-time analytics
 * @access Admin
 */
router.get('/admin/realtime',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const realtime = await analyticsService.getRealtimeAnalytics();

    res.json(successResponse(realtime, 'Real-time analytics retrieved successfully'));
  })
);

/**
 * @route GET /api/analytics/admin/alerts
 * @desc Get analytics alerts
 * @access Admin
 */
router.get('/admin/alerts',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const alerts = await analyticsService.getAnalyticsAlerts();

    res.json(successResponse(alerts, 'Analytics alerts retrieved successfully'));
  })
);

module.exports = router;