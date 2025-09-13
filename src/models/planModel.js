/**
 * Plan data access layer
 * Handles all database operations for subscription plans
 */

const { supabase, supabaseAdmin } = require('../config/supabase');
const { TABLES, SUBSCRIPTION_STATUS } = require('../utils/constants');
const { logger } = require('../utils/helpers');
const { NotFoundError, ConflictError } = require('../middleware/errorHandler');

class PlanModel {
  /**
   * Get all plans with optional filtering
   * @param {Object} filters - Filtering options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Plans data with pagination
   */
  static async getAll(filters = {}, pagination = { offset: 0, limit: 10 }) {
    try {
      let query = supabase
        .from(TABLES.PLANS)
        .select('*', { count: 'exact' });

      // Apply filters
      if (filters.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }

      if (filters.billing_cycle) {
        query = query.eq('billing_cycle', filters.billing_cycle);
      }

      if (filters.price_min !== undefined) {
        query = query.gte('price', filters.price_min);
      }

      if (filters.price_max !== undefined) {
        query = query.lte('price', filters.price_max);
      }

      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      // Apply sorting
      const sortBy = filters.sort_by || 'created_at';
      const sortOrder = filters.sort || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);

      const { data, error, count } = await query;

      if (error) {
        logger.error('Error fetching plans:', error);
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
      logger.error('PlanModel.getAll error:', error);
      throw error;
    }
  }

  /**
   * Get plan by ID
   * @param {string} planId - Plan ID
   * @returns {Promise<Object>} Plan data
   */
  static async getById(planId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.PLANS)
        .select('*')
        .eq('id', planId)
        .single();

      if (error || !data) {
        throw new NotFoundError('Plan not found');
      }

      return data;
    } catch (error) {
      logger.error('PlanModel.getById error:', error);
      throw error;
    }
  }

  /**
   * Create new plan
   * @param {Object} planData - Plan data
   * @returns {Promise<Object>} Created plan
   */
  static async create(planData) {
    try {
      // Check for existing plan with same name
      const { data: existing } = await supabase
        .from(TABLES.PLANS)
        .select('id')
        .eq('name', planData.name)
        .single();

      if (existing) {
        throw new ConflictError('Plan with this name already exists');
      }

      const { data, error } = await supabaseAdmin
        .from(TABLES.PLANS)
        .insert([{
          ...planData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        logger.error('Error creating plan:', error);
        throw error;
      }

      logger.info(`Plan created: ${data.name} (${data.id})`);
      return data;
    } catch (error) {
      logger.error('PlanModel.create error:', error);
      throw error;
    }
  }

  /**
   * Update plan
   * @param {string} planId - Plan ID
   * @param {Object} planData - Updated plan data
   * @returns {Promise<Object>} Updated plan
   */
  static async update(planId, planData) {
    try {
      // Check if plan exists
      await this.getById(planId);

      // Check for name conflict if name is being updated
      if (planData.name) {
        const { data: existing } = await supabase
          .from(TABLES.PLANS)
          .select('id')
          .eq('name', planData.name)
          .neq('id', planId)
          .single();

        if (existing) {
          throw new ConflictError('Plan with this name already exists');
        }
      }

      const { data, error } = await supabaseAdmin
        .from(TABLES.PLANS)
        .update({
          ...planData,
          updated_at: new Date().toISOString()
        })
        .eq('id', planId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating plan:', error);
        throw error;
      }

      logger.info(`Plan updated: ${planId}`);
      return data;
    } catch (error) {
      logger.error('PlanModel.update error:', error);
      throw error;
    }
  }

  /**
   * Soft delete plan (mark as inactive)
   * @param {string} planId - Plan ID
   * @returns {Promise<Object>} Updated plan
   */
  static async softDelete(planId) {
    try {
      // Check if plan has active subscriptions
      const { data: activeSubscriptions } = await supabase
        .from(TABLES.SUBSCRIPTIONS)
        .select('id')
        .eq('plan_id', planId)
        .eq('status', SUBSCRIPTION_STATUS.ACTIVE);

      if (activeSubscriptions && activeSubscriptions.length > 0) {
        throw new ConflictError('Cannot delete plan with active subscriptions');
      }

      const { data, error } = await supabaseAdmin
        .from(TABLES.PLANS)
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', planId)
        .select()
        .single();

      if (error) {
        logger.error('Error soft deleting plan:', error);
        throw error;
      }

      logger.info(`Plan soft deleted: ${planId}`);
      return data;
    } catch (error) {
      logger.error('PlanModel.softDelete error:', error);
      throw error;
    }
  }

  /**
   * Hard delete plan (permanent removal)
   * @param {string} planId - Plan ID
   * @returns {Promise<boolean>} Success status
   */
  static async hardDelete(planId) {
    try {
      // Check if plan has any subscriptions
      const { data: subscriptions } = await supabase
        .from(TABLES.SUBSCRIPTIONS)
        .select('id')
        .eq('plan_id', planId);

      if (subscriptions && subscriptions.length > 0) {
        throw new ConflictError('Cannot permanently delete plan with subscription history');
      }

      const { error } = await supabaseAdmin
        .from(TABLES.PLANS)
        .delete()
        .eq('id', planId);

      if (error) {
        logger.error('Error hard deleting plan:', error);
        throw error;
      }

      logger.info(`Plan hard deleted: ${planId}`);
      return true;
    } catch (error) {
      logger.error('PlanModel.hardDelete error:', error);
      throw error;
    }
  }

  /**
   * Get plans with subscription statistics
   * @returns {Promise<Array>} Plans with stats
   */
  static async getWithStats() {
    try {
      const { data, error } = await supabase
        .from(TABLES.PLANS)
        .select(`
          *,
          subscriptions:${TABLES.SUBSCRIPTIONS}(
            id,
            status,
            created_at
          )
        `);

      if (error) {
        logger.error('Error fetching plans with stats:', error);
        throw error;
      }

      // Calculate statistics for each plan
      const plansWithStats = data.map(plan => {
        const subscriptions = plan.subscriptions || [];
        const activeSubscriptions = subscriptions.filter(
          sub => sub.status === SUBSCRIPTION_STATUS.ACTIVE
        );

        return {
          ...plan,
          stats: {
            total_subscriptions: subscriptions.length,
            active_subscriptions: activeSubscriptions.length,
            inactive_subscriptions: subscriptions.length - activeSubscriptions.length
          },
          subscriptions: undefined // Remove detailed subscriptions from response
        };
      });

      return plansWithStats;
    } catch (error) {
      logger.error('PlanModel.getWithStats error:', error);
      throw error;
    }
  }

  /**
   * Search plans by name or description
   * @param {string} searchTerm - Search term
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Search results
   */
  static async search(searchTerm, pagination = { offset: 0, limit: 10 }) {
    try {
      const { data, error, count } = await supabase
        .from(TABLES.PLANS)
        .select('*', { count: 'exact' })
        .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .eq('is_active', true)
        .order('name')
        .range(pagination.offset, pagination.offset + pagination.limit - 1);

      if (error) {
        logger.error('Error searching plans:', error);
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
      logger.error('PlanModel.search error:', error);
      throw error;
    }
  }

  /**
   * Get active plans only
   * @returns {Promise<Array>} Active plans
   */
  static async getActive() {
    try {
      const { data, error } = await supabase
        .from(TABLES.PLANS)
        .select('*')
        .eq('is_active', true)
        .order('price');

      if (error) {
        logger.error('Error fetching active plans:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('PlanModel.getActive error:', error);
      throw error;
    }
  }
}

module.exports = PlanModel;