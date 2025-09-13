/**
 * Plan service
 * Business logic for subscription plan operations
 */

const PlanModel = require('../models/planModel');
const { NotFoundError, ValidationError, ConflictError } = require('../middleware/errorHandler');
const { logger, paginate, createPaginationMeta } = require('../utils/helpers');
const { PLAN_TYPES } = require('../utils/constants');

class PlanService {
  /**
   * Get all plans with filtering and pagination
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Plans with pagination metadata
   */
  static async getAllPlans(query = {}) {
    try {
      const { page = 1, limit = 10, ...filters } = query;
      const pagination = paginate(page, limit);

      const result = await PlanModel.getAll(filters, pagination);
      
      return {
        plans: result.data,
        pagination: createPaginationMeta(result.total, page, limit)
      };
    } catch (error) {
      logger.error('PlanService.getAllPlans error:', error);
      throw error;
    }
  }

  /**
   * Get active plans only (for public viewing)
   * @returns {Promise<Array>} Active plans
   */
  static async getActivePlans() {
    try {
      const plans = await PlanModel.getActive();
      
      // Sort plans by price for better UX
      return plans.sort((a, b) => a.price - b.price);
    } catch (error) {
      logger.error('PlanService.getActivePlans error:', error);
      throw error;
    }
  }

  /**
   * Get plan by ID
   * @param {string} planId - Plan ID
   * @returns {Promise<Object>} Plan details
   */
  static async getPlanById(planId) {
    try {
      if (!planId) {
        throw new ValidationError('Plan ID is required');
      }

      const plan = await PlanModel.getById(planId);
      return plan;
    } catch (error) {
      logger.error('PlanService.getPlanById error:', error);
      throw error;
    }
  }

  /**
   * Create new plan
   * @param {Object} planData - Plan data
   * @returns {Promise<Object>} Created plan
   */
  static async createPlan(planData) {
    try {
      // Validate required fields
      const requiredFields = ['name', 'price', 'billing_cycle', 'quota'];
      const missingFields = requiredFields.filter(field => !planData[field]);
      
      if (missingFields.length > 0) {
        throw new ValidationError(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Validate price
      if (planData.price < 0) {
        throw new ValidationError('Price cannot be negative');
      }

      // Validate quota
      if (planData.quota < 0) {
        throw new ValidationError('Quota cannot be negative');
      }

      // Validate billing cycle
      const validCycles = ['monthly', 'yearly', 'weekly'];
      if (!validCycles.includes(planData.billing_cycle)) {
        throw new ValidationError('Invalid billing cycle. Must be monthly, yearly, or weekly');
      }

      // Set default values
      const planToCreate = {
        ...planData,
        is_active: planData.is_active !== undefined ? planData.is_active : true,
        features: planData.features || [],
        description: planData.description || ''
      };

      const newPlan = await PlanModel.create(planToCreate);
      
      logger.info(`Plan created successfully: ${newPlan.name} (${newPlan.id})`);
      return newPlan;
    } catch (error) {
      logger.error('PlanService.createPlan error:', error);
      throw error;
    }
  }

  /**
   * Update plan
   * @param {string} planId - Plan ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated plan
   */
  static async updatePlan(planId, updateData) {
    try {
      if (!planId) {
        throw new ValidationError('Plan ID is required');
      }

      // Validate price if provided
      if (updateData.price !== undefined && updateData.price < 0) {
        throw new ValidationError('Price cannot be negative');
      }

      // Validate quota if provided
      if (updateData.quota !== undefined && updateData.quota < 0) {
        throw new ValidationError('Quota cannot be negative');
      }

      // Validate billing cycle if provided
      if (updateData.billing_cycle) {
        const validCycles = ['monthly', 'yearly', 'weekly'];
        if (!validCycles.includes(updateData.billing_cycle)) {
          throw new ValidationError('Invalid billing cycle. Must be monthly, yearly, or weekly');
        }
      }

      const updatedPlan = await PlanModel.update(planId, updateData);
      
      logger.info(`Plan updated successfully: ${planId}`);
      return updatedPlan;
    } catch (error) {
      logger.error('PlanService.updatePlan error:', error);
      throw error;
    }
  }

  /**
   * Delete plan (soft delete)
   * @param {string} planId - Plan ID
   * @returns {Promise<Object>} Deleted plan
   */
  static async deletePlan(planId) {
    try {
      if (!planId) {
        throw new ValidationError('Plan ID is required');
      }

      const deletedPlan = await PlanModel.softDelete(planId);
      
      logger.info(`Plan deleted successfully: ${planId}`);
      return deletedPlan;
    } catch (error) {
      logger.error('PlanService.deletePlan error:', error);
      throw error;
    }
  }

  /**
   * Get plans with subscription statistics
   * @returns {Promise<Array>} Plans with stats
   */
  static async getPlansWithStats() {
    try {
      const plansWithStats = await PlanModel.getWithStats();
      
      // Sort by active subscriptions count
      return plansWithStats.sort((a, b) => 
        b.stats.active_subscriptions - a.stats.active_subscriptions
      );
    } catch (error) {
      logger.error('PlanService.getPlansWithStats error:', error);
      throw error;
    }
  }

  /**
   * Search plans
   * @param {string} searchTerm - Search term
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  static async searchPlans(searchTerm, options = {}) {
    try {
      if (!searchTerm || searchTerm.trim().length < 2) {
        throw new ValidationError('Search term must be at least 2 characters long');
      }

      const { page = 1, limit = 10 } = options;
      const pagination = paginate(page, limit);

      const result = await PlanModel.search(searchTerm.trim(), pagination);
      
      return {
        plans: result.data,
        pagination: createPaginationMeta(result.total, page, limit),
        searchTerm: searchTerm.trim()
      };
    } catch (error) {
      logger.error('PlanService.searchPlans error:', error);
      throw error;
    }
  }

  /**
   * Get plan recommendations based on usage
   * @param {Object} userUsage - User's current usage pattern
   * @param {string} currentPlanId - Current plan ID (optional)
   * @returns {Promise<Array>} Recommended plans
   */
  static async getRecommendations(userUsage, currentPlanId = null) {
    try {
      const activePlans = await PlanModel.getActive();
      
      if (activePlans.length === 0) {
        return [];
      }

      const { current_usage = 0, plan_quota = 100 } = userUsage;
      const usagePercentage = plan_quota > 0 ? (current_usage / plan_quota) * 100 : 0;

      let recommendations = [];

      // If usage is high (>80%), recommend higher plans
      if (usagePercentage > 80) {
        recommendations = activePlans
          .filter(plan => plan.id !== currentPlanId && plan.quota > plan_quota)
          .sort((a, b) => a.quota - b.quota)
          .slice(0, 3);
      }
      // If usage is low (<30%), recommend lower plans
      else if (usagePercentage < 30 && currentPlanId) {
        recommendations = activePlans
          .filter(plan => plan.id !== currentPlanId && plan.quota < plan_quota && plan.quota >= current_usage * 1.2)
          .sort((a, b) => b.quota - a.quota)
          .slice(0, 2);
      }
      // If no current plan, recommend starter plans
      else if (!currentPlanId) {
        recommendations = activePlans
          .filter(plan => plan.quota >= current_usage * 1.5)
          .sort((a, b) => a.price - b.price)
          .slice(0, 3);
      }

      // Add recommendation reasons
      return recommendations.map(plan => ({
        ...plan,
        recommendation_reason: this.getRecommendationReason(usagePercentage, plan, userUsage)
      }));
    } catch (error) {
      logger.error('PlanService.getRecommendations error:', error);
      throw error;
    }
  }

  /**
   * Get recommendation reason
   * @param {number} usagePercentage - Current usage percentage
   * @param {Object} plan - Recommended plan
   * @param {Object} userUsage - User usage data
   * @returns {string} Recommendation reason
   */
  static getRecommendationReason(usagePercentage, plan, userUsage) {
    if (usagePercentage > 80) {
      return `Upgrade recommended - You're using ${Math.round(usagePercentage)}% of your current quota. This plan offers ${plan.quota} units.`;
    } else if (usagePercentage < 30) {
      return `Consider downgrading - You're only using ${Math.round(usagePercentage)}% of your current quota. This plan would save you money.`;
    } else {
      return `Good fit for your usage pattern - This plan provides ${plan.quota} units at $${plan.price}/${plan.billing_cycle}.`;
    }
  }

  /**
   * Compare plans
   * @param {Array} planIds - Array of plan IDs to compare
   * @returns {Promise<Array>} Plan comparison data
   */
  static async comparePlans(planIds) {
    try {
      if (!Array.isArray(planIds) || planIds.length < 2) {
        throw new ValidationError('At least 2 plan IDs are required for comparison');
      }

      if (planIds.length > 5) {
        throw new ValidationError('Cannot compare more than 5 plans at once');
      }

      const plans = await Promise.all(
        planIds.map(async (planId) => {
          try {
            return await PlanModel.getById(planId);
          } catch (error) {
            logger.warn(`Plan not found for comparison: ${planId}`);
            return null;
          }
        })
      );

      // Filter out null values (plans that weren't found)
      const validPlans = plans.filter(plan => plan !== null);

      if (validPlans.length < 2) {
        throw new ValidationError('At least 2 valid plans are required for comparison');
      }

      // Add comparison metadata
      return validPlans.map(plan => ({
        ...plan,
        value_per_unit: plan.quota > 0 ? plan.price / plan.quota : 0,
        is_most_expensive: plan.price === Math.max(...validPlans.map(p => p.price)),
        is_least_expensive: plan.price === Math.min(...validPlans.map(p => p.price)),
        is_highest_quota: plan.quota === Math.max(...validPlans.map(p => p.quota)),
        is_lowest_quota: plan.quota === Math.min(...validPlans.map(p => p.quota))
      }));
    } catch (error) {
      logger.error('PlanService.comparePlans error:', error);
      throw error;
    }
  }

  /**
   * Validate plan data
   * @param {Object} planData - Plan data to validate
   * @returns {boolean} Validation result
   */
  static validatePlanData(planData) {
    const errors = [];

    if (!planData.name || planData.name.trim().length < 2) {
      errors.push('Plan name must be at least 2 characters long');
    }

    if (planData.price === undefined || planData.price < 0) {
      errors.push('Price must be a non-negative number');
    }

    if (!planData.billing_cycle || !['monthly', 'yearly', 'weekly'].includes(planData.billing_cycle)) {
      errors.push('Billing cycle must be monthly, yearly, or weekly');
    }

    if (planData.quota === undefined || planData.quota < 0) {
      errors.push('Quota must be a non-negative number');
    }

    if (planData.features && !Array.isArray(planData.features)) {
      errors.push('Features must be an array');
    }

    if (errors.length > 0) {
      throw new ValidationError('Plan validation failed', { fields: errors });
    }

    return true;
  }
}

module.exports = PlanService;