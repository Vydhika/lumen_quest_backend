/**
 * Main routes index
 * Aggregates and mounts all route modules
 */

const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');

// Import route modules
const publicRoutes = require('./publicRoutes');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const adminRoutes = require('./adminRoutes');
const billingRoutes = require('./billingRoutes');
const analyticsRoutes = require('./analyticsRoutes');

const router = express.Router();

// API information endpoint
router.get('/', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'Lumen Quest Backend API',
    version: '1.0.0',
    documentation: '/api/docs',
    endpoints: {
      public: '/api/plans',
      auth: '/api/auth',
      user: '/api/users',
      subscriptions: '/api/subscriptions',
      admin: '/api/admin',
      billing: '/api/billing',
      analytics: '/api/analytics',
      recommendations: '/api/recommendations'
    },
    timestamp: new Date().toISOString()
  });
}));

// Mount route modules
router.use('/plans', publicRoutes); // Public plan routes
router.use('/auth', authRoutes); // Authentication routes
router.use('/users', userRoutes); // User profile routes
router.use('/subscriptions', userRoutes); // User subscription routes (reuse userRoutes)
router.use('/admin', adminRoutes); // Admin routes
router.use('/billing', billingRoutes); // Billing routes
router.use('/analytics', analyticsRoutes); // Analytics routes
router.use('/recommendations', analyticsRoutes); // Recommendation routes (reuse analyticsRoutes)

module.exports = router;