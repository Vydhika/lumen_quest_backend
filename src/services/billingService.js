/**
 * Billing service
 * Business logic for billing and payment operations
 */

const BillingModel = require('../models/billingModel');
const SubscriptionModel = require('../models/subscriptionModel');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const { logger, paginate, createPaginationMeta, dateHelpers } = require('../utils/helpers');
const { PAYMENT_STATUS, SUBSCRIPTION_STATUS } = require('../utils/constants');

class BillingService {
  /**
   * Get user's billing history
   * @param {string} userId - User ID
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Billing history with pagination
   */
  static async getUserBillingHistory(userId, query = {}) {
    try {
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      const { page = 1, limit = 10, ...filters } = query;
      const pagination = paginate(page, limit);

      const result = await BillingModel.getByUserId(userId, filters, pagination);
      
      return {
        billing_history: result.data,
        pagination: createPaginationMeta(result.total, page, limit)
      };
    } catch (error) {
      logger.error('BillingService.getUserBillingHistory error:', error);
      throw error;
    }
  }

  /**
   * Get all billing records (admin only)
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} All billing records with pagination
   */
  static async getAllBillingRecords(query = {}) {
    try {
      const { page = 1, limit = 10, ...filters } = query;
      const pagination = paginate(page, limit);

      const result = await BillingModel.getAll(filters, pagination);
      
      return {
        billing_records: result.data,
        pagination: createPaginationMeta(result.total, page, limit)
      };
    } catch (error) {
      logger.error('BillingService.getAllBillingRecords error:', error);
      throw error;
    }
  }

  /**
   * Get billing record by ID
   * @param {string} billingId - Billing record ID
   * @param {Object} userContext - User context for authorization
   * @returns {Promise<Object>} Billing record
   */
  static async getBillingRecordById(billingId, userContext = {}) {
    try {
      if (!billingId) {
        throw new ValidationError('Billing ID is required');
      }

      const billingRecord = await BillingModel.getById(billingId);

      // Check ownership for non-admin users
      if (userContext.role !== 'admin' && userContext.userId !== billingRecord.user_id) {
        throw new NotFoundError('Billing record not found');
      }

      return billingRecord;
    } catch (error) {
      logger.error('BillingService.getBillingRecordById error:', error);
      throw error;
    }
  }

  /**
   * Generate billing record for subscription
   * @param {string} subscriptionId - Subscription ID
   * @param {Object} billingData - Additional billing data
   * @returns {Promise<Object>} Generated billing record
   */
  static async generateBillingRecord(subscriptionId, billingData = {}) {
    try {
      if (!subscriptionId) {
        throw new ValidationError('Subscription ID is required');
      }

      // Verify subscription exists and is active
      const subscription = await SubscriptionModel.getById(subscriptionId);
      if (subscription.status !== SUBSCRIPTION_STATUS.ACTIVE) {
        throw new ValidationError('Can only generate billing for active subscriptions');
      }

      const billingRecord = await BillingModel.generateForSubscription(subscriptionId, billingData);
      
      logger.info(`Billing record generated for subscription: ${subscriptionId}`);
      return billingRecord;
    } catch (error) {
      logger.error('BillingService.generateBillingRecord error:', error);
      throw error;
    }
  }

  /**
   * Process payment for billing record
   * @param {string} billingId - Billing record ID
   * @param {Object} paymentData - Payment processing data
   * @returns {Promise<Object>} Updated billing record
   */
  static async processPayment(billingId, paymentData = {}) {
    try {
      if (!billingId) {
        throw new ValidationError('Billing ID is required');
      }

      const billingRecord = await BillingModel.getById(billingId);
      
      if (billingRecord.status === PAYMENT_STATUS.COMPLETED) {
        throw new ValidationError('Payment has already been processed');
      }

      if (billingRecord.status === PAYMENT_STATUS.CANCELLED) {
        throw new ValidationError('Cannot process payment for cancelled billing record');
      }

      // Simulate payment processing
      const paymentSuccess = await this.simulatePaymentProcessing(billingRecord, paymentData);
      
      if (paymentSuccess) {
        const updatedRecord = await BillingModel.markPaymentSuccessful(billingId, {
          transaction_id: paymentData.transaction_id || this.generateTransactionId(),
          payment_method: paymentData.payment_method || 'credit_card',
          payment_gateway: paymentData.payment_gateway || 'stripe',
          gateway_response: paymentData.gateway_response
        });

        logger.info(`Payment processed successfully for billing: ${billingId}`);
        return {
          success: true,
          billing_record: updatedRecord,
          transaction_id: updatedRecord.transaction_id
        };
      } else {
        const updatedRecord = await BillingModel.markPaymentFailed(billingId, {
          reason: paymentData.failure_reason || 'Payment processing failed',
          gateway_response: paymentData.gateway_response
        });

        logger.warn(`Payment failed for billing: ${billingId}`);
        return {
          success: false,
          billing_record: updatedRecord,
          error: paymentData.failure_reason || 'Payment processing failed'
        };
      }
    } catch (error) {
      logger.error('BillingService.processPayment error:', error);
      throw error;
    }
  }

  /**
   * Get billing summary for user
   * @param {string} userId - User ID
   * @param {Object} dateRange - Date range for summary
   * @returns {Promise<Object>} Billing summary
   */
  static async getUserBillingSummary(userId, dateRange = {}) {
    try {
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      // Set default date range to current year if not provided
      if (!dateRange.start && !dateRange.end) {
        const { start, end } = dateHelpers.getYearRange();
        dateRange = { start: start.toISOString(), end: end.toISOString() };
      }

      const summary = await BillingModel.getSummaryForUser(userId, dateRange);
      
      // Get upcoming bills
      const upcomingBills = await BillingModel.getUpcomingBills(userId, 30);
      
      return {
        ...summary,
        upcoming_bills: upcomingBills,
        period: {
          start: dateRange.start,
          end: dateRange.end
        }
      };
    } catch (error) {
      logger.error('BillingService.getUserBillingSummary error:', error);
      throw error;
    }
  }

  /**
   * Get revenue analytics (admin only)
   * @param {Object} filters - Filtering options
   * @returns {Promise<Object>} Revenue analytics
   */
  static async getRevenueAnalytics(filters = {}) {
    try {
      // Set default date range to current year if not provided
      if (!filters.start_date && !filters.end_date) {
        const { start, end } = dateHelpers.getYearRange();
        filters.start_date = start.toISOString();
        filters.end_date = end.toISOString();
      }

      const analytics = await BillingModel.getRevenueAnalytics(filters);
      
      // Calculate additional metrics
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      const previousMonthKey = currentMonth === 0 ? 
        `${currentYear - 1}-12` : 
        `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

      const currentMonthData = analytics.monthly_breakdown.find(m => m.month === currentMonthKey);
      const previousMonthData = analytics.monthly_breakdown.find(m => m.month === previousMonthKey);

      const monthlyGrowth = previousMonthData && previousMonthData.revenue > 0 ?
        ((currentMonthData?.revenue || 0) - previousMonthData.revenue) / previousMonthData.revenue * 100 : 0;

      return {
        ...analytics,
        monthly_growth_percentage: Math.round(monthlyGrowth * 100) / 100,
        current_month_revenue: currentMonthData?.revenue || 0,
        previous_month_revenue: previousMonthData?.revenue || 0,
        period: {
          start: filters.start_date,
          end: filters.end_date
        }
      };
    } catch (error) {
      logger.error('BillingService.getRevenueAnalytics error:', error);
      throw error;
    }
  }

  /**
   * Generate invoice for billing record
   * @param {string} billingId - Billing record ID
   * @param {Object} invoiceOptions - Invoice generation options
   * @returns {Promise<Object>} Invoice data
   */
  static async generateInvoice(billingId, invoiceOptions = {}) {
    try {
      const billingRecord = await BillingModel.getById(billingId);
      
      const invoice = {
        invoice_number: billingRecord.invoice_number || BillingModel.generateInvoiceNumber(),
        billing_record_id: billingId,
        issue_date: new Date().toISOString(),
        due_date: invoiceOptions.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        amount: billingRecord.amount,
        status: billingRecord.status,
        customer: {
          user_id: billingRecord.user_id,
          subscription_id: billingRecord.subscription_id
        },
        line_items: [{
          description: `${billingRecord.subscription?.plan?.name || 'Subscription'} - ${billingRecord.subscription?.plan?.billing_cycle || 'monthly'} billing`,
          quantity: 1,
          unit_price: billingRecord.amount,
          total: billingRecord.amount
        }],
        payment_info: {
          method: billingRecord.payment_method,
          transaction_id: billingRecord.transaction_id,
          payment_date: billingRecord.payment_date
        },
        notes: invoiceOptions.notes || ''
      };

      logger.info(`Invoice generated for billing: ${billingId}`);
      return invoice;
    } catch (error) {
      logger.error('BillingService.generateInvoice error:', error);
      throw error;
    }
  }

  /**
   * Retry failed payment
   * @param {string} billingId - Billing record ID
   * @param {Object} retryOptions - Retry options
   * @returns {Promise<Object>} Retry result
   */
  static async retryFailedPayment(billingId, retryOptions = {}) {
    try {
      const billingRecord = await BillingModel.getById(billingId);
      
      if (billingRecord.status !== PAYMENT_STATUS.FAILED) {
        throw new ValidationError('Can only retry failed payments');
      }

      // Reset to pending status
      await BillingModel.update(billingId, {
        status: PAYMENT_STATUS.PENDING,
        retry_count: (billingRecord.retry_count || 0) + 1,
        last_retry_date: new Date().toISOString()
      });

      // Attempt payment processing again
      return await this.processPayment(billingId, retryOptions);
    } catch (error) {
      logger.error('BillingService.retryFailedPayment error:', error);
      throw error;
    }
  }

  /**
   * Cancel billing record
   * @param {string} billingId - Billing record ID
   * @param {Object} cancellationData - Cancellation data
   * @returns {Promise<Object>} Updated billing record
   */
  static async cancelBillingRecord(billingId, cancellationData = {}) {
    try {
      const billingRecord = await BillingModel.getById(billingId);
      
      if (billingRecord.status === PAYMENT_STATUS.COMPLETED) {
        throw new ValidationError('Cannot cancel completed payments');
      }

      const updatedRecord = await BillingModel.update(billingId, {
        status: PAYMENT_STATUS.CANCELLED,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: cancellationData.reason || 'Cancelled by user'
      });

      logger.info(`Billing record cancelled: ${billingId}`);
      return updatedRecord;
    } catch (error) {
      logger.error('BillingService.cancelBillingRecord error:', error);
      throw error;
    }
  }

  /**
   * Simulate payment processing (for demo purposes)
   * @param {Object} billingRecord - Billing record
   * @param {Object} paymentData - Payment data
   * @returns {Promise<boolean>} Payment success status
   */
  static async simulatePaymentProcessing(billingRecord, paymentData = {}) {
    try {
      // Simulate random payment success/failure for demo
      if (paymentData.force_success) {
        return true;
      }
      
      if (paymentData.force_failure) {
        return false;
      }

      // 90% success rate simulation
      const successRate = paymentData.success_rate || 0.9;
      return Math.random() < successRate;
    } catch (error) {
      logger.error('Payment simulation error:', error);
      return false;
    }
  }

  /**
   * Generate transaction ID
   * @returns {string} Transaction ID
   */
  static generateTransactionId() {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `TXN-${timestamp}-${random}`;
  }

  /**
   * Get payment statistics
   * @param {Object} filters - Filtering options
   * @returns {Promise<Object>} Payment statistics
   */
  static async getPaymentStatistics(filters = {}) {
    try {
      const { page = 1, limit = 1000 } = filters;
      const pagination = paginate(page, limit);

      const result = await BillingModel.getAll(filters, pagination);
      const records = result.data;

      const stats = {
        total_payments: records.length,
        successful_payments: records.filter(r => r.status === PAYMENT_STATUS.COMPLETED).length,
        failed_payments: records.filter(r => r.status === PAYMENT_STATUS.FAILED).length,
        pending_payments: records.filter(r => r.status === PAYMENT_STATUS.PENDING).length,
        cancelled_payments: records.filter(r => r.status === PAYMENT_STATUS.CANCELLED).length,
        total_revenue: records
          .filter(r => r.status === PAYMENT_STATUS.COMPLETED)
          .reduce((sum, r) => sum + r.amount, 0),
        average_payment_amount: 0,
        success_rate: 0
      };

      const completedPayments = records.filter(r => r.status === PAYMENT_STATUS.COMPLETED);
      if (completedPayments.length > 0) {
        stats.average_payment_amount = stats.total_revenue / completedPayments.length;
      }

      if (records.length > 0) {
        stats.success_rate = (stats.successful_payments / records.length) * 100;
      }

      return stats;
    } catch (error) {
      logger.error('BillingService.getPaymentStatistics error:', error);
      throw error;
    }
  }
}

module.exports = BillingService;