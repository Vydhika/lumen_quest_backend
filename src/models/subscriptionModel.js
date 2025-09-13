/**
 * Subscription data access layer
 * Handles all database operations for subscriptions
 */

const { supabase, supabaseAdmin } = require('../config/supabase');
const { TABLES, SUBSCRIPTION_STATUS, SUBSCRIPTION_ACTIONS } = require('../utils/constants');
const { logger } = require('../utils/helpers');
const { NotFoundError, ConflictError } = require('../middleware/errorHandler');

class SubscriptionModel {
  /**
   * Get all subscriptions with optional filtering
   * @param {Object} filters - Filtering options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Subscriptions data with pagination
   */
  static async getAll(filters = {}, pagination = { offset: 0, limit: 10 }) {
    try {
      let query = supabase
        .from(TABLES.SUBSCRIPTIONS)
        .select(`
          *,
          plan:${TABLES.PLANS}(
            id, name, price, billing_cycle, quota, features
          )
        `, { count: 'exact' });

      // Apply filters
      if (filters.user_id) {
        query = query.eq('user_id', filters.user_id);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.plan_id) {
        query = query.eq('plan_id', filters.plan_id);
      }

      if (filters.start_date_from) {
        query = query.gte('start_date', filters.start_date_from);
      }

      if (filters.start_date_to) {
        query = query.lte('start_date', filters.start_date_to);
      }

      if (filters.auto_renew !== undefined) {
        query = query.eq('auto_renew', filters.auto_renew);
      }

      // Apply sorting
      const sortBy = filters.sort_by || 'created_at';
      const sortOrder = filters.sort || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);

      const { data, error, count } = await query;

      if (error) {
        logger.error('Error fetching subscriptions:', error);
        throw error;
      }

      return {
        data,
        total: count,
        pagination: {
          offset: pagination.offset,
          limit: pagination.limit,
          total: count
        }
      };
    } catch (error) {
      logger.error('SubscriptionModel.getAll error:', error);
      throw error;
    }
  }

  /**
   * Get subscription by ID
   * @param {string} subscriptionId - Subscription ID
   * @returns {Promise<Object>} Subscription data
   */
  static async getById(subscriptionId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.SUBSCRIPTIONS)
        .select(`
          *,
          plan:${TABLES.PLANS}(
            id, name, price, billing_cycle, quota, features, description
          )
        `)
        .eq('id', subscriptionId)
        .single();

      if (error || !data) {
        throw new NotFoundError('Subscription not found');
      }

      return data;
    } catch (error) {
      logger.error('SubscriptionModel.getById error:', error);
      throw error;
    }
  }

  /**
   * Get user's subscriptions
   * @param {string} userId - User ID
   * @param {Object} filters - Additional filters
   * @returns {Promise<Array>} User's subscriptions
   */
  static async getByUserId(userId, filters = {}) {
    try {
      let query = supabase
        .from(TABLES.SUBSCRIPTIONS)
        .select(`
          *,
          plan:${TABLES.PLANS}(
            id, name, price, billing_cycle, quota, features, description
          )
        `)
        .eq('user_id', userId);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.active_only) {
        query = query.eq('status', SUBSCRIPTION_STATUS.ACTIVE);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching user subscriptions:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('SubscriptionModel.getByUserId error:', error);
      throw error;
    }
  }

  /**
   * Create new subscription
   * @param {Object} subscriptionData - Subscription data
   * @returns {Promise<Object>} Created subscription
   */
  static async create(subscriptionData) {
    try {
      // Check for existing active subscription for the same user and plan
      const { data: existing } = await supabase
        .from(TABLES.SUBSCRIPTIONS)
        .select('id')
        .eq('user_id', subscriptionData.user_id)
        .eq('plan_id', subscriptionData.plan_id)
        .eq('status', SUBSCRIPTION_STATUS.ACTIVE)
        .single();

      if (existing) {
        throw new ConflictError('User already has an active subscription for this plan');
      }

      const { data, error } = await supabaseAdmin
        .from(TABLES.SUBSCRIPTIONS)
        .insert([{
          ...subscriptionData,
          status: SUBSCRIPTION_STATUS.ACTIVE,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select(`
          *,
          plan:${TABLES.PLANS}(
            id, name, price, billing_cycle, quota, features
          )
        `)
        .single();

      if (error) {
        logger.error('Error creating subscription:', error);
        throw error;
      }

      // Log the subscription creation
      await this.logAction(data.id, SUBSCRIPTION_ACTIONS.SUBSCRIBE, {
        plan_id: data.plan_id,
        user_id: data.user_id
      });

      logger.info(`Subscription created: ${data.id} for user: ${data.user_id}`);
      return data;
    } catch (error) {
      logger.error('SubscriptionModel.create error:', error);
      throw error;
    }
  }

  /**
   * Update subscription
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} updateData - Updated subscription data
   * @returns {Promise<Object>} Updated subscription
   */
  static async update(subscriptionId, updateData) {
    try {
      // Check if subscription exists
      const existing = await this.getById(subscriptionId);

      const { data, error } = await supabaseAdmin
        .from(TABLES.SUBSCRIPTIONS)
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId)
        .select(`
          *,
          plan:${TABLES.PLANS}(
            id, name, price, billing_cycle, quota, features
          )
        `)
        .single();

      if (error) {
        logger.error('Error updating subscription:', error);
        throw error;
      }

      // Log the update
      await this.logAction(subscriptionId, SUBSCRIPTION_ACTIONS.MODIFY, {
        changes: updateData,
        previous_plan_id: existing.plan_id
      });

      logger.info(`Subscription updated: ${subscriptionId}`);
      return data;
    } catch (error) {
      logger.error('SubscriptionModel.update error:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} cancellationData - Cancellation details
   * @returns {Promise<Object>} Updated subscription
   */
  static async cancel(subscriptionId, cancellationData = {}) {
    try {
      const existing = await this.getById(subscriptionId);

      if (existing.status === SUBSCRIPTION_STATUS.CANCELLED) {
        throw new ConflictError('Subscription is already cancelled');
      }

      const { data, error } = await supabaseAdmin
        .from(TABLES.SUBSCRIPTIONS)
        .update({
          status: SUBSCRIPTION_STATUS.CANCELLED,
          cancel_date: new Date().toISOString(),
          cancel_reason: cancellationData.reason || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId)
        .select(`
          *,
          plan:${TABLES.PLANS}(
            id, name, price, billing_cycle, quota, features
          )
        `)
        .single();

      if (error) {
        logger.error('Error cancelling subscription:', error);
        throw error;
      }

      // Log the cancellation
      await this.logAction(subscriptionId, SUBSCRIPTION_ACTIONS.CANCEL, {
        reason: cancellationData.reason,
        cancelled_by: cancellationData.cancelled_by
      });

      logger.info(`Subscription cancelled: ${subscriptionId}`);
      return data;
    } catch (error) {
      logger.error('SubscriptionModel.cancel error:', error);
      throw error;
    }
  }

  /**
   * Upgrade subscription to a different plan
   * @param {string} subscriptionId - Subscription ID
   * @param {string} targetPlanId - Target plan ID
   * @param {Object} upgradeData - Upgrade details
   * @returns {Promise<Object>} Updated subscription
   */
  static async upgrade(subscriptionId, targetPlanId, upgradeData = {}) {
    try {
      const existing = await this.getById(subscriptionId);

      if (existing.status !== SUBSCRIPTION_STATUS.ACTIVE) {
        throw new ConflictError('Can only upgrade active subscriptions');
      }

      const { data, error } = await supabaseAdmin
        .from(TABLES.SUBSCRIPTIONS)
        .update({
          plan_id: targetPlanId,
          upgrade_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...upgradeData
        })
        .eq('id', subscriptionId)
        .select(`
          *,
          plan:${TABLES.PLANS}(
            id, name, price, billing_cycle, quota, features
          )
        `)
        .single();

      if (error) {
        logger.error('Error upgrading subscription:', error);
        throw error;
      }

      // Log the upgrade
      await this.logAction(subscriptionId, SUBSCRIPTION_ACTIONS.UPGRADE, {
        from_plan_id: existing.plan_id,
        to_plan_id: targetPlanId,
        effective_date: upgradeData.effective_date
      });

      logger.info(`Subscription upgraded: ${subscriptionId} to plan: ${targetPlanId}`);
      return data;
    } catch (error) {
      logger.error('SubscriptionModel.upgrade error:', error);
      throw error;
    }
  }

  /**
   * Downgrade subscription to a different plan
   * @param {string} subscriptionId - Subscription ID
   * @param {string} targetPlanId - Target plan ID
   * @param {Object} downgradeData - Downgrade details
   * @returns {Promise<Object>} Updated subscription
   */
  static async downgrade(subscriptionId, targetPlanId, downgradeData = {}) {
    try {
      const existing = await this.getById(subscriptionId);

      if (existing.status !== SUBSCRIPTION_STATUS.ACTIVE) {
        throw new ConflictError('Can only downgrade active subscriptions');
      }

      const { data, error } = await supabaseAdmin
        .from(TABLES.SUBSCRIPTIONS)
        .update({
          plan_id: targetPlanId,
          downgrade_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...downgradeData
        })
        .eq('id', subscriptionId)
        .select(`
          *,
          plan:${TABLES.PLANS}(
            id, name, price, billing_cycle, quota, features
          )
        `)
        .single();

      if (error) {
        logger.error('Error downgrading subscription:', error);
        throw error;
      }

      // Log the downgrade
      await this.logAction(subscriptionId, SUBSCRIPTION_ACTIONS.DOWNGRADE, {
        from_plan_id: existing.plan_id,
        to_plan_id: targetPlanId,
        effective_date: downgradeData.effective_date
      });

      logger.info(`Subscription downgraded: ${subscriptionId} to plan: ${targetPlanId}`);
      return data;
    } catch (error) {
      logger.error('SubscriptionModel.downgrade error:', error);
      throw error;
    }
  }

  /**
   * Get subscription usage data
   * @param {string} subscriptionId - Subscription ID
   * @returns {Promise<Object>} Usage data
   */
  static async getUsage(subscriptionId) {
    try {
      // Get subscription with plan details
      const subscription = await this.getById(subscriptionId);

      // Get usage metrics (if you have a usage_metrics table)
      const { data: usage, error } = await supabase
        .from(TABLES.USAGE_METRICS)
        .select('*')
        .eq('subscription_id', subscriptionId)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();

      let usageData = {
        subscription_id: subscriptionId,
        plan_quota: subscription.plan?.quota || 0,
        current_usage: 0,
        usage_percentage: 0,
        last_updated: null
      };

      if (!error && usage) {
        usageData = {
          ...usageData,
          current_usage: usage.usage_amount || 0,
          usage_percentage: subscription.plan?.quota ? 
            Math.round((usage.usage_amount / subscription.plan.quota) * 100) : 0,
          last_updated: usage.recorded_at
        };
      }

      return usageData;
    } catch (error) {
      logger.error('SubscriptionModel.getUsage error:', error);
      throw error;
    }
  }

  /**
   * Log subscription action
   * @param {string} subscriptionId - Subscription ID
   * @param {string} action - Action type
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Log entry
   */
  static async logAction(subscriptionId, action, metadata = {}) {
    try {
      const { data, error } = await supabaseAdmin
        .from(TABLES.SUBSCRIPTION_LOGS)
        .insert([{
          subscription_id: subscriptionId,
          action,
          metadata,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        logger.error('Error logging subscription action:', error);
        // Don't throw error for logging failures
        return null;
      }

      return data;
    } catch (error) {
      logger.error('SubscriptionModel.logAction error:', error);
      return null;
    }
  }

  /**
   * Get subscription logs
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Subscription logs
   */
  static async getLogs(subscriptionId, pagination = { offset: 0, limit: 10 }) {
    try {
      const { data, error, count } = await supabase
        .from(TABLES.SUBSCRIPTION_LOGS)
        .select('*', { count: 'exact' })
        .eq('subscription_id', subscriptionId)
        .order('created_at', { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.limit - 1);

      if (error) {
        logger.error('Error fetching subscription logs:', error);
        throw error;
      }

      return {
        data,
        total: count,
        pagination: {
          offset: pagination.offset,
          limit: pagination.limit,
          total: count
        }
      };
    } catch (error) {
      logger.error('SubscriptionModel.getLogs error:', error);
      throw error;
    }
  }

  /**
   * Get active subscriptions count by plan
   * @returns {Promise<Array>} Subscription counts by plan
   */
  static async getActiveCountsByPlan() {
    try {
      const { data, error } = await supabase
        .from(TABLES.SUBSCRIPTIONS)
        .select(`
          plan_id,
          plan:${TABLES.PLANS}(name),
          count
        `)
        .eq('status', SUBSCRIPTION_STATUS.ACTIVE);

      if (error) {
        logger.error('Error fetching subscription counts:', error);
        throw error;
      }

      // Group by plan_id and count
      const counts = {};
      data.forEach(sub => {
        const planId = sub.plan_id;
        counts[planId] = (counts[planId] || 0) + 1;
      });

      return Object.entries(counts).map(([planId, count]) => ({
        plan_id: planId,
        plan_name: data.find(d => d.plan_id === planId)?.plan?.name || 'Unknown',
        active_subscriptions: count
      }));
    } catch (error) {
      logger.error('SubscriptionModel.getActiveCountsByPlan error:', error);
      throw error;
    }
  }
}

module.exports = SubscriptionModel;