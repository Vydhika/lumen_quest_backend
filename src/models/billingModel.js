/**
 * Billing data access layer
 * Handles all database operations for billing and payment information
 */

const { supabase, supabaseAdmin } = require('../config/supabase');
const { TABLES, PAYMENT_STATUS } = require('../utils/constants');
const { logger, dateHelpers } = require('../utils/helpers');
const { NotFoundError } = require('../middleware/errorHandler');

class BillingModel {
  /**
   * Get all billing records with optional filtering
   * @param {Object} filters - Filtering options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Billing data with pagination
   */
  static async getAll(filters = {}, pagination = { offset: 0, limit: 10 }) {
    try {
      let query = supabase
        .from(TABLES.BILLING_INFORMATION)
        .select(`
          *,
          subscription:${TABLES.SUBSCRIPTIONS}(
            id,
            plan:${TABLES.PLANS}(id, name, price, billing_cycle)
          )
        `, { count: 'exact' });

      // Apply filters
      if (filters.user_id) {
        query = query.eq('user_id', filters.user_id);
      }

      if (filters.subscription_id) {
        query = query.eq('subscription_id', filters.subscription_id);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.billing_date_from) {
        query = query.gte('billing_date', filters.billing_date_from);
      }

      if (filters.billing_date_to) {
        query = query.lte('billing_date', filters.billing_date_to);
      }

      if (filters.amount_min !== undefined) {
        query = query.gte('amount', filters.amount_min);
      }

      if (filters.amount_max !== undefined) {
        query = query.lte('amount', filters.amount_max);
      }

      // Apply sorting
      const sortBy = filters.sort_by || 'billing_date';
      const sortOrder = filters.sort || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);

      const { data, error, count } = await query;

      if (error) {
        logger.error('Error fetching billing records:', error);
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
      logger.error('BillingModel.getAll error:', error);
      throw error;
    }
  }

  /**
   * Get billing record by ID
   * @param {string} billingId - Billing record ID
   * @returns {Promise<Object>} Billing data
   */
  static async getById(billingId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.BILLING_INFORMATION)
        .select(`
          *,
          subscription:${TABLES.SUBSCRIPTIONS}(
            id,
            user_id,
            plan:${TABLES.PLANS}(id, name, price, billing_cycle, description)
          )
        `)
        .eq('id', billingId)
        .single();

      if (error || !data) {
        throw new NotFoundError('Billing record not found');
      }

      return data;
    } catch (error) {
      logger.error('BillingModel.getById error:', error);
      throw error;
    }
  }

  /**
   * Get user's billing history
   * @param {string} userId - User ID
   * @param {Object} filters - Additional filters
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} User's billing history
   */
  static async getByUserId(userId, filters = {}, pagination = { offset: 0, limit: 10 }) {
    try {
      let query = supabase
        .from(TABLES.BILLING_INFORMATION)
        .select(`
          *,
          subscription:${TABLES.SUBSCRIPTIONS}(
            id,
            plan:${TABLES.PLANS}(id, name, price, billing_cycle)
          )
        `, { count: 'exact' })
        .eq('user_id', userId);

      // Apply additional filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.year) {
        const yearStart = new Date(filters.year, 0, 1).toISOString();
        const yearEnd = new Date(filters.year, 11, 31, 23, 59, 59).toISOString();
        query = query.gte('billing_date', yearStart).lte('billing_date', yearEnd);
      }

      if (filters.month && filters.year) {
        const monthStart = new Date(filters.year, filters.month - 1, 1).toISOString();
        const monthEnd = new Date(filters.year, filters.month, 0, 23, 59, 59).toISOString();
        query = query.gte('billing_date', monthStart).lte('billing_date', monthEnd);
      }

      query = query
        .order('billing_date', { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.limit - 1);

      const { data, error, count } = await query;

      if (error) {
        logger.error('Error fetching user billing history:', error);
        throw error;
      }

      return {
        data: data || [],
        total: count,
        pagination: {
          offset: pagination.offset,
          limit: pagination.limit,
          total: count
        }
      };
    } catch (error) {
      logger.error('BillingModel.getByUserId error:', error);
      throw error;
    }
  }

  /**
   * Create new billing record
   * @param {Object} billingData - Billing data
   * @returns {Promise<Object>} Created billing record
   */
  static async create(billingData) {
    try {
      const { data, error } = await supabaseAdmin
        .from(TABLES.BILLING_INFORMATION)
        .insert([{
          ...billingData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select(`
          *,
          subscription:${TABLES.SUBSCRIPTIONS}(
            id,
            plan:${TABLES.PLANS}(id, name, price, billing_cycle)
          )
        `)
        .single();

      if (error) {
        logger.error('Error creating billing record:', error);
        throw error;
      }

      logger.info(`Billing record created: ${data.id} for user: ${data.user_id}`);
      return data;
    } catch (error) {
      logger.error('BillingModel.create error:', error);
      throw error;
    }
  }

  /**
   * Update billing record
   * @param {string} billingId - Billing record ID
   * @param {Object} updateData - Updated billing data
   * @returns {Promise<Object>} Updated billing record
   */
  static async update(billingId, updateData) {
    try {
      // Check if billing record exists
      await this.getById(billingId);

      const { data, error } = await supabaseAdmin
        .from(TABLES.BILLING_INFORMATION)
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', billingId)
        .select(`
          *,
          subscription:${TABLES.SUBSCRIPTIONS}(
            id,
            plan:${TABLES.PLANS}(id, name, price, billing_cycle)
          )
        `)
        .single();

      if (error) {
        logger.error('Error updating billing record:', error);
        throw error;
      }

      logger.info(`Billing record updated: ${billingId}`);
      return data;
    } catch (error) {
      logger.error('BillingModel.update error:', error);
      throw error;
    }
  }

  /**
   * Generate billing record for subscription
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} billingData - Additional billing data
   * @returns {Promise<Object>} Generated billing record
   */
  static async generateForSubscription(subscriptionId, billingData = {}) {
    try {
      // Get subscription details
      const { data: subscription, error: subError } = await supabase
        .from(TABLES.SUBSCRIPTIONS)
        .select(`
          *,
          plan:${TABLES.PLANS}(*)
        `)
        .eq('id', subscriptionId)
        .single();

      if (subError || !subscription) {
        throw new NotFoundError('Subscription not found');
      }

      // Calculate billing amount and next billing date
      const plan = subscription.plan;
      const amount = plan.price;
      const billingDate = billingData.billing_date || new Date().toISOString();
      
      // Calculate next billing date based on billing cycle
      let nextBillingDate;
      const currentDate = new Date(billingDate);
      
      switch (plan.billing_cycle) {
        case 'monthly':
          nextBillingDate = dateHelpers.addMonths(currentDate, 1);
          break;
        case 'yearly':
          nextBillingDate = dateHelpers.addMonths(currentDate, 12);
          break;
        case 'weekly':
          nextBillingDate = new Date(currentDate);
          nextBillingDate.setDate(currentDate.getDate() + 7);
          break;
        default:
          nextBillingDate = dateHelpers.addMonths(currentDate, 1);
      }

      const newBillingRecord = {
        user_id: subscription.user_id,
        subscription_id: subscriptionId,
        amount,
        billing_date: billingDate,
        next_billing_date: nextBillingDate.toISOString(),
        status: billingData.status || PAYMENT_STATUS.PENDING,
        payment_method: billingData.payment_method || 'credit_card',
        transaction_id: billingData.transaction_id || null,
        invoice_number: billingData.invoice_number || this.generateInvoiceNumber(),
        ...billingData
      };

      return await this.create(newBillingRecord);
    } catch (error) {
      logger.error('BillingModel.generateForSubscription error:', error);
      throw error;
    }
  }

  /**
   * Get billing summary for user
   * @param {string} userId - User ID
   * @param {Object} dateRange - Date range for summary
   * @returns {Promise<Object>} Billing summary
   */
  static async getSummaryForUser(userId, dateRange = {}) {
    try {
      let query = supabase
        .from(TABLES.BILLING_INFORMATION)
        .select('amount, status, billing_date')
        .eq('user_id', userId);

      // Apply date range if provided
      if (dateRange.start) {
        query = query.gte('billing_date', dateRange.start);
      }
      if (dateRange.end) {
        query = query.lte('billing_date', dateRange.end);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching billing summary:', error);
        throw error;
      }

      // Calculate summary statistics
      const summary = {
        total_bills: data.length,
        total_amount: 0,
        paid_amount: 0,
        pending_amount: 0,
        failed_amount: 0,
        successful_payments: 0,
        failed_payments: 0,
        pending_payments: 0
      };

      data.forEach(bill => {
        summary.total_amount += bill.amount;
        
        switch (bill.status) {
          case PAYMENT_STATUS.COMPLETED:
            summary.paid_amount += bill.amount;
            summary.successful_payments++;
            break;
          case PAYMENT_STATUS.PENDING:
            summary.pending_amount += bill.amount;
            summary.pending_payments++;
            break;
          case PAYMENT_STATUS.FAILED:
            summary.failed_amount += bill.amount;
            summary.failed_payments++;
            break;
        }
      });

      return summary;
    } catch (error) {
      logger.error('BillingModel.getSummaryForUser error:', error);
      throw error;
    }
  }

  /**
   * Get revenue analytics
   * @param {Object} filters - Filtering options
   * @returns {Promise<Object>} Revenue analytics
   */
  static async getRevenueAnalytics(filters = {}) {
    try {
      let query = supabase
        .from(TABLES.BILLING_INFORMATION)
        .select('amount, billing_date, status')
        .eq('status', PAYMENT_STATUS.COMPLETED);

      // Apply date range if provided
      if (filters.start_date) {
        query = query.gte('billing_date', filters.start_date);
      }
      if (filters.end_date) {
        query = query.lte('billing_date', filters.end_date);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching revenue analytics:', error);
        throw error;
      }

      // Group revenue by month
      const monthlyRevenue = {};
      data.forEach(bill => {
        const date = new Date(bill.billing_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyRevenue[monthKey]) {
          monthlyRevenue[monthKey] = {
            month: monthKey,
            revenue: 0,
            transaction_count: 0
          };
        }
        
        monthlyRevenue[monthKey].revenue += bill.amount;
        monthlyRevenue[monthKey].transaction_count++;
      });

      const analytics = {
        total_revenue: data.reduce((sum, bill) => sum + bill.amount, 0),
        total_transactions: data.length,
        average_transaction_value: data.length > 0 ? 
          data.reduce((sum, bill) => sum + bill.amount, 0) / data.length : 0,
        monthly_breakdown: Object.values(monthlyRevenue).sort((a, b) => a.month.localeCompare(b.month))
      };

      return analytics;
    } catch (error) {
      logger.error('BillingModel.getRevenueAnalytics error:', error);
      throw error;
    }
  }

  /**
   * Mark payment as successful
   * @param {string} billingId - Billing record ID
   * @param {Object} paymentData - Payment confirmation data
   * @returns {Promise<Object>} Updated billing record
   */
  static async markPaymentSuccessful(billingId, paymentData = {}) {
    try {
      return await this.update(billingId, {
        status: PAYMENT_STATUS.COMPLETED,
        payment_date: new Date().toISOString(),
        transaction_id: paymentData.transaction_id,
        payment_method: paymentData.payment_method,
        ...paymentData
      });
    } catch (error) {
      logger.error('BillingModel.markPaymentSuccessful error:', error);
      throw error;
    }
  }

  /**
   * Mark payment as failed
   * @param {string} billingId - Billing record ID
   * @param {Object} failureData - Payment failure data
   * @returns {Promise<Object>} Updated billing record
   */
  static async markPaymentFailed(billingId, failureData = {}) {
    try {
      return await this.update(billingId, {
        status: PAYMENT_STATUS.FAILED,
        failure_reason: failureData.reason,
        failure_date: new Date().toISOString(),
        ...failureData
      });
    } catch (error) {
      logger.error('BillingModel.markPaymentFailed error:', error);
      throw error;
    }
  }

  /**
   * Generate unique invoice number
   * @returns {string} Invoice number
   */
  static generateInvoiceNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const timestamp = Date.now().toString().slice(-6);
    
    return `INV-${year}${month}${day}-${timestamp}`;
  }

  /**
   * Get upcoming bills for user
   * @param {string} userId - User ID
   * @param {number} days - Number of days to look ahead
   * @returns {Promise<Array>} Upcoming bills
   */
  static async getUpcomingBills(userId, days = 30) {
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      const { data, error } = await supabase
        .from(TABLES.BILLING_INFORMATION)
        .select(`
          *,
          subscription:${TABLES.SUBSCRIPTIONS}(
            id,
            plan:${TABLES.PLANS}(id, name, price, billing_cycle)
          )
        `)
        .eq('user_id', userId)
        .gte('next_billing_date', new Date().toISOString())
        .lte('next_billing_date', futureDate.toISOString())
        .order('next_billing_date');

      if (error) {
        logger.error('Error fetching upcoming bills:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('BillingModel.getUpcomingBills error:', error);
      throw error;
    }
  }
}

module.exports = BillingModel;