/**
 * Subscription service
 * Business logic for subscription lifecycle operations
 */

const SubscriptionModel = require('../models/subscriptionModel');
const PlanModel = require('../models/planModel');
const BillingModel = require('../models/billingModel');
const { NotFoundError, ValidationError, ConflictError } = require('../middleware/errorHandler');
const { logger, paginate, createPaginationMeta, dateHelpers } = require('../utils/helpers');
const { SUBSCRIPTION_STATUS, SUBSCRIPTION_ACTIONS, PAYMENT_STATUS } = require('../utils/constants');

class SubscriptionService {
  /**
   * Get all subscriptions with filtering and pagination
   * @param {Object} query - Query parameters
   * @param {Object} userContext - User context for filtering
   * @returns {Promise<Object>} Subscriptions with pagination
   */
  static async getAllSubscriptions(query = {}, userContext = {}) {
    try {
      const { page = 1, limit = 10, ...filters } = query;
      const pagination = paginate(page, limit);

      // Apply user-based filtering for non-admin users
      if (userContext.role !== 'admin' && userContext.userId) {
        filters.user_id = userContext.userId;
      }

      const result = await SubscriptionModel.getAll(filters, pagination);
      
      return {
        subscriptions: result.data,
        pagination: createPaginationMeta(result.total, page, limit)
      };
    } catch (error) {
      logger.error('SubscriptionService.getAllSubscriptions error:', error);
      throw error;
    }
  }

  /**
   * Get subscription by ID
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} userContext - User context for authorization
   * @returns {Promise<Object>} Subscription details
   */
  static async getSubscriptionById(subscriptionId, userContext = {}) {
    try {
      if (!subscriptionId) {
        throw new ValidationError('Subscription ID is required');
      }

      const subscription = await SubscriptionModel.getById(subscriptionId);

      // Check ownership for non-admin users
      if (userContext.role !== 'admin' && userContext.userId !== subscription.user_id) {
        throw new NotFoundError('Subscription not found');
      }

      return subscription;
    } catch (error) {
      logger.error('SubscriptionService.getSubscriptionById error:', error);
      throw error;
    }
  }

  /**
   * Get user's subscriptions
   * @param {string} userId - User ID
   * @param {Object} filters - Additional filters
   * @returns {Promise<Array>} User's subscriptions
   */
  static async getUserSubscriptions(userId, filters = {}) {
    try {
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      const subscriptions = await SubscriptionModel.getByUserId(userId, filters);
      return subscriptions;
    } catch (error) {
      logger.error('SubscriptionService.getUserSubscriptions error:', error);
      throw error;
    }
  }

  /**
   * Create new subscription
   * @param {Object} subscriptionData - Subscription data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Created subscription
   */
  static async createSubscription(subscriptionData, userId) {
    try {
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      if (!subscriptionData.plan_id) {
        throw new ValidationError('Plan ID is required');
      }

      // Validate plan exists and is active
      const plan = await PlanModel.getById(subscriptionData.plan_id);
      if (!plan.is_active) {
        throw new ValidationError('Selected plan is not available');
      }

      // Check for existing active subscription for the same plan
      const existingSubscriptions = await SubscriptionModel.getByUserId(userId, { 
        status: SUBSCRIPTION_STATUS.ACTIVE 
      });
      
      const existingForPlan = existingSubscriptions.find(sub => sub.plan_id === subscriptionData.plan_id);
      if (existingForPlan) {
        throw new ConflictError('You already have an active subscription for this plan');
      }

      // Prepare subscription data
      const newSubscriptionData = {
        user_id: userId,
        plan_id: subscriptionData.plan_id,
        start_date: subscriptionData.start_date || new Date().toISOString(),
        auto_renew: subscriptionData.auto_renew !== undefined ? subscriptionData.auto_renew : true,
        quota_snapshot: plan.quota, // Store quota at time of subscription
        status: SUBSCRIPTION_STATUS.ACTIVE
      };

      // Create subscription
      const subscription = await SubscriptionModel.create(newSubscriptionData);

      // Generate initial billing record
      try {
        await BillingModel.generateForSubscription(subscription.id, {
          status: PAYMENT_STATUS.PENDING
        });
      } catch (billingError) {
        logger.warn('Failed to create initial billing record:', billingError);
        // Don't fail the subscription creation for billing issues
      }

      logger.info(`Subscription created: ${subscription.id} for user: ${userId} on plan: ${plan.name}`);
      return subscription;
    } catch (error) {
      logger.error('SubscriptionService.createSubscription error:', error);
      throw error;
    }
  }

  /**
   * Upgrade subscription to a higher plan
   * @param {string} subscriptionId - Subscription ID
   * @param {string} targetPlanId - Target plan ID
   * @param {Object} upgradeOptions - Upgrade options
   * @param {Object} userContext - User context
   * @returns {Promise<Object>} Updated subscription
   */
  static async upgradeSubscription(subscriptionId, targetPlanId, upgradeOptions = {}, userContext = {}) {
    try {
      // Validate inputs
      if (!subscriptionId || !targetPlanId) {
        throw new ValidationError('Subscription ID and target plan ID are required');
      }

      // Get current subscription
      const subscription = await this.getSubscriptionById(subscriptionId, userContext);
      
      if (subscription.status !== SUBSCRIPTION_STATUS.ACTIVE) {
        throw new ValidationError('Can only upgrade active subscriptions');
      }

      // Get current and target plans
      const [currentPlan, targetPlan] = await Promise.all([
        PlanModel.getById(subscription.plan_id),
        PlanModel.getById(targetPlanId)
      ]);

      if (!targetPlan.is_active) {
        throw new ValidationError('Target plan is not available');
      }

      // Validate it's actually an upgrade (higher price or quota)
      if (targetPlan.price <= currentPlan.price && targetPlan.quota <= currentPlan.quota) {
        throw new ValidationError('Target plan must be an upgrade (higher price or quota)');
      }

      // Calculate effective date
      const effectiveDate = upgradeOptions.effective_date || new Date().toISOString();

      // Update subscription
      const updatedSubscription = await SubscriptionModel.upgrade(subscriptionId, targetPlanId, {
        effective_date: effectiveDate,
        previous_plan_id: currentPlan.id,
        upgrade_reason: upgradeOptions.reason
      });

      // Generate billing record for upgrade
      if (upgradeOptions.generate_bill !== false) {
        try {
          await BillingModel.generateForSubscription(subscriptionId, {
            status: PAYMENT_STATUS.PENDING,
            billing_date: effectiveDate,
            notes: `Upgrade from ${currentPlan.name} to ${targetPlan.name}`
          });
        } catch (billingError) {
          logger.warn('Failed to create upgrade billing record:', billingError);
        }
      }

      logger.info(`Subscription upgraded: ${subscriptionId} from ${currentPlan.name} to ${targetPlan.name}`);
      return {
        subscription: updatedSubscription,
        previous_plan: currentPlan,
        new_plan: targetPlan,
        upgrade_details: {
          effective_date: effectiveDate,
          price_difference: targetPlan.price - currentPlan.price,
          quota_increase: targetPlan.quota - currentPlan.quota
        }
      };
    } catch (error) {
      logger.error('SubscriptionService.upgradeSubscription error:', error);
      throw error;
    }
  }

  /**
   * Downgrade subscription to a lower plan
   * @param {string} subscriptionId - Subscription ID
   * @param {string} targetPlanId - Target plan ID
   * @param {Object} downgradeOptions - Downgrade options
   * @param {Object} userContext - User context
   * @returns {Promise<Object>} Updated subscription
   */
  static async downgradeSubscription(subscriptionId, targetPlanId, downgradeOptions = {}, userContext = {}) {
    try {
      // Validate inputs
      if (!subscriptionId || !targetPlanId) {
        throw new ValidationError('Subscription ID and target plan ID are required');
      }

      // Get current subscription
      const subscription = await this.getSubscriptionById(subscriptionId, userContext);
      
      if (subscription.status !== SUBSCRIPTION_STATUS.ACTIVE) {
        throw new ValidationError('Can only downgrade active subscriptions');
      }

      // Get current and target plans
      const [currentPlan, targetPlan] = await Promise.all([
        PlanModel.getById(subscription.plan_id),
        PlanModel.getById(targetPlanId)
      ]);

      if (!targetPlan.is_active) {
        throw new ValidationError('Target plan is not available');
      }

      // Validate it's actually a downgrade
      if (targetPlan.price >= currentPlan.price && targetPlan.quota >= currentPlan.quota) {
        throw new ValidationError('Target plan must be a downgrade (lower price or quota)');
      }

      // Check current usage to prevent data loss
      try {
        const usageData = await SubscriptionModel.getUsage(subscriptionId);
        if (usageData.current_usage > targetPlan.quota) {
          if (!downgradeOptions.force) {
            throw new ValidationError(
              `Cannot downgrade: Current usage (${usageData.current_usage}) exceeds target plan quota (${targetPlan.quota}). Use force=true to override.`
            );
          }
        }
      } catch (usageError) {
        logger.warn('Could not check usage for downgrade:', usageError);
        // Continue with downgrade if usage check fails
      }

      // Calculate effective date (downgrades typically take effect at next billing cycle)
      const effectiveDate = downgradeOptions.immediate ? 
        new Date().toISOString() : 
        (downgradeOptions.effective_date || this.calculateNextBillingDate(subscription));

      // Update subscription
      const updatedSubscription = await SubscriptionModel.downgrade(subscriptionId, targetPlanId, {
        effective_date: effectiveDate,
        previous_plan_id: currentPlan.id,
        downgrade_reason: downgradeOptions.reason,
        immediate: downgradeOptions.immediate || false
      });

      logger.info(`Subscription downgraded: ${subscriptionId} from ${currentPlan.name} to ${targetPlan.name}`);
      return {
        subscription: updatedSubscription,
        previous_plan: currentPlan,
        new_plan: targetPlan,
        downgrade_details: {
          effective_date: effectiveDate,
          price_difference: currentPlan.price - targetPlan.price,
          quota_reduction: currentPlan.quota - targetPlan.quota,
          immediate: downgradeOptions.immediate || false
        }
      };
    } catch (error) {
      logger.error('SubscriptionService.downgradeSubscription error:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} cancellationData - Cancellation details
   * @param {Object} userContext - User context
   * @returns {Promise<Object>} Cancelled subscription
   */
  static async cancelSubscription(subscriptionId, cancellationData = {}, userContext = {}) {
    try {
      if (!subscriptionId) {
        throw new ValidationError('Subscription ID is required');
      }

      // Get current subscription
      const subscription = await this.getSubscriptionById(subscriptionId, userContext);
      
      if (subscription.status === SUBSCRIPTION_STATUS.CANCELLED) {
        throw new ConflictError('Subscription is already cancelled');
      }

      // Cancel subscription
      const cancelledSubscription = await SubscriptionModel.cancel(subscriptionId, {
        reason: cancellationData.reason,
        cancelled_by: userContext.userId,
        immediate: cancellationData.immediate || false
      });

      // Calculate refund amount if applicable
      let refundAmount = 0;
      if (cancellationData.immediate && subscription.plan) {
        const daysRemaining = this.calculateRemainingDays(subscription);
        const totalDays = subscription.plan.billing_cycle === 'monthly' ? 30 : 365;
        refundAmount = (daysRemaining / totalDays) * subscription.plan.price;
      }

      logger.info(`Subscription cancelled: ${subscriptionId}, reason: ${cancellationData.reason || 'Not specified'}`);
      return {
        subscription: cancelledSubscription,
        cancellation_details: {
          cancelled_at: cancelledSubscription.cancel_date,
          reason: cancellationData.reason,
          immediate: cancellationData.immediate || false,
          refund_amount: refundAmount
        }
      };
    } catch (error) {
      logger.error('SubscriptionService.cancelSubscription error:', error);
      throw error;
    }
  }

  /**
   * Get subscription usage data
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} userContext - User context
   * @returns {Promise<Object>} Usage data
   */
  static async getSubscriptionUsage(subscriptionId, userContext = {}) {
    try {
      // Verify subscription access
      await this.getSubscriptionById(subscriptionId, userContext);

      const usageData = await SubscriptionModel.getUsage(subscriptionId);
      return usageData;
    } catch (error) {
      logger.error('SubscriptionService.getSubscriptionUsage error:', error);
      throw error;
    }
  }

  /**
   * Get subscription logs
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} query - Query parameters
   * @param {Object} userContext - User context
   * @returns {Promise<Object>} Subscription logs
   */
  static async getSubscriptionLogs(subscriptionId, query = {}, userContext = {}) {
    try {
      // Verify subscription access
      await this.getSubscriptionById(subscriptionId, userContext);

      const { page = 1, limit = 10 } = query;
      const pagination = paginate(page, limit);

      const result = await SubscriptionModel.getLogs(subscriptionId, pagination);
      
      return {
        logs: result.data,
        pagination: createPaginationMeta(result.total, page, limit)
      };
    } catch (error) {
      logger.error('SubscriptionService.getSubscriptionLogs error:', error);
      throw error;
    }
  }

  /**
   * Renew subscription
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} renewalOptions - Renewal options
   * @returns {Promise<Object>} Renewed subscription
   */
  static async renewSubscription(subscriptionId, renewalOptions = {}) {
    try {
      const subscription = await SubscriptionModel.getById(subscriptionId);

      if (subscription.status !== SUBSCRIPTION_STATUS.ACTIVE) {
        throw new ValidationError('Can only renew active subscriptions');
      }

      // Generate billing record for renewal
      const billingRecord = await BillingModel.generateForSubscription(subscriptionId, {
        status: PAYMENT_STATUS.PENDING,
        billing_date: renewalOptions.billing_date || new Date().toISOString(),
        notes: 'Subscription renewal'
      });

      // Log renewal action
      await SubscriptionModel.logAction(subscriptionId, SUBSCRIPTION_ACTIONS.RENEW, {
        billing_record_id: billingRecord.id,
        renewal_date: billingRecord.billing_date
      });

      logger.info(`Subscription renewed: ${subscriptionId}`);
      return {
        subscription,
        billing_record: billingRecord,
        renewal_date: billingRecord.billing_date
      };
    } catch (error) {
      logger.error('SubscriptionService.renewSubscription error:', error);
      throw error;
    }
  }

  /**
   * Calculate next billing date
   * @param {Object} subscription - Subscription object
   * @returns {string} Next billing date ISO string
   */
  static calculateNextBillingDate(subscription) {
    const currentDate = new Date();
    const plan = subscription.plan;

    if (!plan) {
      return dateHelpers.addMonths(currentDate, 1).toISOString();
    }

    switch (plan.billing_cycle) {
      case 'weekly':
        return new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      case 'yearly':
        return dateHelpers.addMonths(currentDate, 12).toISOString();
      case 'monthly':
      default:
        return dateHelpers.addMonths(currentDate, 1).toISOString();
    }
  }

  /**
   * Calculate remaining days in subscription
   * @param {Object} subscription - Subscription object
   * @returns {number} Remaining days
   */
  static calculateRemainingDays(subscription) {
    const now = new Date();
    const nextBilling = new Date(this.calculateNextBillingDate(subscription));
    const diffTime = nextBilling.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  /**
   * Get subscription analytics for admin
   * @param {Object} filters - Filtering options
   * @returns {Promise<Object>} Subscription analytics
   */
  static async getSubscriptionAnalytics(filters = {}) {
    try {
      const result = await SubscriptionModel.getAll(filters, { offset: 0, limit: 1000 });
      const subscriptions = result.data;

      const analytics = {
        total_subscriptions: subscriptions.length,
        active_subscriptions: subscriptions.filter(s => s.status === SUBSCRIPTION_STATUS.ACTIVE).length,
        cancelled_subscriptions: subscriptions.filter(s => s.status === SUBSCRIPTION_STATUS.CANCELLED).length,
        by_plan: {},
        by_status: {},
        monthly_growth: []
      };

      // Group by plan
      subscriptions.forEach(sub => {
        const planName = sub.plan?.name || 'Unknown';
        analytics.by_plan[planName] = (analytics.by_plan[planName] || 0) + 1;
      });

      // Group by status
      subscriptions.forEach(sub => {
        analytics.by_status[sub.status] = (analytics.by_status[sub.status] || 0) + 1;
      });

      return analytics;
    } catch (error) {
      logger.error('SubscriptionService.getSubscriptionAnalytics error:', error);
      throw error;
    }
  }
}

module.exports = SubscriptionService;