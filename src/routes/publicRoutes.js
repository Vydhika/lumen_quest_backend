/**
 * Public routes
 * Handles public endpoints that don't require authentication
 */

const express = require('express');
const PlanService = require('../services/planService');
const { asyncHandler } = require('../middleware/errorHandler');
const { successResponse } = require('../utils/helpers');
const { validateUuidParam, validateQuery, validateSearch } = require('../utils/validators');

const router = express.Router();

/**
 * @route GET /api/plans
 * @desc Get all active plans (public)
 * @access Public
 */
router.get('/', asyncHandler(async (req, res) => {
  const plans = await PlanService.getActivePlans();
  
  res.json(successResponse(plans, 'Plans retrieved successfully'));
}));

/**
 * @route GET /api/plans/search
 * @desc Search plans by name or description
 * @access Public
 */
router.get('/search', 
  validateSearch,
  asyncHandler(async (req, res) => {
    const { q: searchTerm, ...options } = req.query;
    
    if (!searchTerm) {
      const plans = await PlanService.getActivePlans();
      return res.json(successResponse(plans, 'All active plans retrieved'));
    }

    const result = await PlanService.searchPlans(searchTerm, options);
    
    res.json(successResponse(result, 'Search completed successfully'));
  })
);

/**
 * @route GET /api/plans/compare
 * @desc Compare multiple plans
 * @access Public
 */
router.get('/compare', asyncHandler(async (req, res) => {
  const { plan_ids } = req.query;
  
  if (!plan_ids) {
    return res.status(400).json({
      success: false,
      message: 'plan_ids query parameter is required',
      example: '/api/plans/compare?plan_ids=uuid1,uuid2,uuid3'
    });
  }

  const planIds = plan_ids.split(',').map(id => id.trim()).filter(id => id);
  const comparison = await PlanService.comparePlans(planIds);
  
  res.json(successResponse(comparison, 'Plan comparison retrieved successfully'));
}));

/**
 * @route GET /api/plans/:planId
 * @desc Get plan details by ID
 * @access Public
 */
router.get('/:planId', 
  validateUuidParam('planId'),
  asyncHandler(async (req, res) => {
    const { planId } = req.params;
    const plan = await PlanService.getPlanById(planId);
    
    res.json(successResponse(plan, 'Plan details retrieved successfully'));
  })
);

module.exports = router;