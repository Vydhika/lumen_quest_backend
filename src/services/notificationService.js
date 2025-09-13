/**
 * Notification service
 * Business logic for managing notifications and logs
 */

const { supabase, supabaseAdmin } = require('../config/supabase');
const { TABLES, NOTIFICATION_TYPES, SUBSCRIPTION_ACTIONS } = require('../utils/constants');
const { logger, paginate, createPaginationMeta } = require('../utils/helpers');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

class NotificationService {
  /**
   * Create a new notification
   * @param {Object} notificationData - Notification data
   * @returns {Promise<Object>} Created notification
   */
  static async createNotification(notificationData) {
    try {
      const { type, user_id, title, message, metadata = {} } = notificationData;

      if (!type || !user_id || !title || !message) {
        throw new ValidationError('Type, user_id, title, and message are required');
      }

      const { data, error } = await supabaseAdmin
        .from(TABLES.NOTIFICATIONS)
        .insert([{
          type,
          user_id,
          title,
          message,
          metadata,
          is_read: false,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        logger.error('Error creating notification:', error);
        throw error;
      }

      logger.info(`Notification created: ${data.id} for user: ${user_id}`);
      return data;
    } catch (error) {
      logger.error('NotificationService.createNotification error:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a user
   * @param {string} userId - User ID
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} User notifications with pagination
   */
  static async getUserNotifications(userId, query = {}) {
    try {
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      const { page = 1, limit = 20, unread_only = false, type } = query;
      const pagination = paginate(page, limit);

      let queryBuilder = supabase
        .from(TABLES.NOTIFICATIONS)
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      if (unread_only) {
        queryBuilder = queryBuilder.eq('is_read', false);
      }

      if (type) {
        queryBuilder = queryBuilder.eq('type', type);
      }

      const { data, error, count } = await queryBuilder
        .order('created_at', { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.limit - 1);

      if (error) {
        logger.error('Error fetching user notifications:', error);
        throw error;
      }

      return {
        notifications: data || [],
        pagination: createPaginationMeta(count, page, limit),
        unread_count: unread_only ? count : undefined
      };
    } catch (error) {
      logger.error('NotificationService.getUserNotifications error:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for ownership check)
   * @returns {Promise<Object>} Updated notification
   */
  static async markAsRead(notificationId, userId) {
    try {
      if (!notificationId || !userId) {
        throw new ValidationError('Notification ID and User ID are required');
      }

      const { data, error } = await supabaseAdmin
        .from(TABLES.NOTIFICATIONS)
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError('Notification not found');
        }
        logger.error('Error marking notification as read:', error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('NotificationService.markAsRead error:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of notifications updated
   */
  static async markAllAsRead(userId) {
    try {
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      const { count, error } = await supabaseAdmin
        .from(TABLES.NOTIFICATIONS)
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        logger.error('Error marking all notifications as read:', error);
        throw error;
      }

      logger.info(`Marked ${count} notifications as read for user: ${userId}`);
      return count || 0;
    } catch (error) {
      logger.error('NotificationService.markAllAsRead error:', error);
      throw error;
    }
  }

  /**
   * Delete notification
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for ownership check)
   * @returns {Promise<boolean>} Success status
   */
  static async deleteNotification(notificationId, userId) {
    try {
      if (!notificationId || !userId) {
        throw new ValidationError('Notification ID and User ID are required');
      }

      const { error } = await supabaseAdmin
        .from(TABLES.NOTIFICATIONS)
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Error deleting notification:', error);
        throw error;
      }

      logger.info(`Notification deleted: ${notificationId}`);
      return true;
    } catch (error) {
      logger.error('NotificationService.deleteNotification error:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count for user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Unread count
   */
  static async getUnreadCount(userId) {
    try {
      if (!userId) {
        throw new ValidationError('User ID is required');
      }

      const { count, error } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        logger.error('Error getting unread count:', error);
        throw error;
      }

      return count || 0;
    } catch (error) {
      logger.error('NotificationService.getUnreadCount error:', error);
      throw error;
    }
  }

  /**
   * Send subscription-related notification
   * @param {string} userId - User ID
   * @param {string} action - Subscription action
   * @param {Object} data - Additional data
   * @returns {Promise<Object>} Created notification
   */
  static async sendSubscriptionNotification(userId, action, data = {}) {
    try {
      const notificationMap = {
        [SUBSCRIPTION_ACTIONS.SUBSCRIBE]: {
          type: NOTIFICATION_TYPES.SUBSCRIPTION_CREATED,
          title: 'Subscription Created',
          message: `You have successfully subscribed to ${data.plan_name || 'a plan'}!`
        },
        [SUBSCRIPTION_ACTIONS.UPGRADE]: {
          type: NOTIFICATION_TYPES.SUBSCRIPTION_UPGRADED,
          title: 'Subscription Upgraded',
          message: `Your subscription has been upgraded to ${data.new_plan_name || 'a higher plan'}!`
        },
        [SUBSCRIPTION_ACTIONS.DOWNGRADE]: {
          type: NOTIFICATION_TYPES.SUBSCRIPTION_DOWNGRADED,
          title: 'Subscription Downgraded',
          message: `Your subscription has been downgraded to ${data.new_plan_name || 'a lower plan'}.`
        },
        [SUBSCRIPTION_ACTIONS.CANCEL]: {
          type: NOTIFICATION_TYPES.SUBSCRIPTION_CANCELLED,
          title: 'Subscription Cancelled',
          message: 'Your subscription has been cancelled successfully.'
        },
        [SUBSCRIPTION_ACTIONS.RENEW]: {
          type: NOTIFICATION_TYPES.SUBSCRIPTION_RENEWED,
          title: 'Subscription Renewed',
          message: `Your ${data.plan_name || 'subscription'} has been renewed!`
        }
      };

      const notificationConfig = notificationMap[action];
      if (!notificationConfig) {
        logger.warn(`No notification config for action: ${action}`);
        return null;
      }

      return await this.createNotification({
        user_id: userId,
        type: notificationConfig.type,
        title: notificationConfig.title,
        message: notificationConfig.message,
        metadata: {
          action,
          subscription_id: data.subscription_id,
          plan_id: data.plan_id,
          ...data
        }
      });
    } catch (error) {
      logger.error('NotificationService.sendSubscriptionNotification error:', error);
      throw error;
    }
  }

  /**
   * Send payment-related notification
   * @param {string} userId - User ID
   * @param {string} status - Payment status
   * @param {Object} data - Payment data
   * @returns {Promise<Object>} Created notification
   */
  static async sendPaymentNotification(userId, status, data = {}) {
    try {
      let notification;

      switch (status) {
        case 'success':
          notification = {
            type: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
            title: 'Payment Successful',
            message: `Your payment of $${data.amount || '0.00'} has been processed successfully.`
          };
          break;
        case 'failed':
          notification = {
            type: NOTIFICATION_TYPES.PAYMENT_FAILED,
            title: 'Payment Failed',
            message: `Your payment of $${data.amount || '0.00'} could not be processed. Please update your payment method.`
          };
          break;
        default:
          logger.warn(`Unknown payment status: ${status}`);
          return null;
      }

      return await this.createNotification({
        user_id: userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        metadata: {
          payment_status: status,
          amount: data.amount,
          billing_id: data.billing_id,
          transaction_id: data.transaction_id,
          ...data
        }
      });
    } catch (error) {
      logger.error('NotificationService.sendPaymentNotification error:', error);
      throw error;
    }
  }

  /**
   * Send plan recommendation notification
   * @param {string} userId - User ID
   * @param {Object} recommendation - Recommendation data
   * @returns {Promise<Object>} Created notification
   */
  static async sendRecommendationNotification(userId, recommendation) {
    try {
      const { plan, recommendation_type, reason } = recommendation;

      let message;
      switch (recommendation_type) {
        case 'upgrade':
          message = `We recommend upgrading to ${plan.name} - ${reason}`;
          break;
        case 'downgrade':
          message = `Consider switching to ${plan.name} - ${reason}`;
          break;
        default:
          message = `Check out ${plan.name} - ${reason}`;
      }

      return await this.createNotification({
        user_id: userId,
        type: NOTIFICATION_TYPES.PLAN_RECOMMENDATION,
        title: 'Plan Recommendation',
        message,
        metadata: {
          recommended_plan_id: plan.id,
          recommendation_type,
          reason,
          plan_details: plan
        }
      });
    } catch (error) {
      logger.error('NotificationService.sendRecommendationNotification error:', error);
      throw error;
    }
  }

  /**
   * Send churn warning notification
   * @param {string} userId - User ID
   * @param {Object} data - Churn warning data
   * @returns {Promise<Object>} Created notification
   */
  static async sendChurnWarningNotification(userId, data = {}) {
    try {
      const message = data.custom_message || 
        'We notice you might be considering cancelling your subscription. Let us help you find the perfect plan!';

      return await this.createNotification({
        user_id: userId,
        type: NOTIFICATION_TYPES.CHURN_WARNING,
        title: 'We want to help!',
        message,
        metadata: {
          churn_indicators: data.indicators || [],
          suggested_actions: data.suggested_actions || [],
          ...data
        }
      });
    } catch (error) {
      logger.error('NotificationService.sendChurnWarningNotification error:', error);
      throw error;
    }
  }

  /**
   * Clean up old notifications
   * @param {number} daysOld - Delete notifications older than this many days
   * @returns {Promise<number>} Number of notifications deleted
   */
  static async cleanupOldNotifications(daysOld = 90) {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

      const { count, error } = await supabaseAdmin
        .from(TABLES.NOTIFICATIONS)
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        logger.error('Error cleaning up old notifications:', error);
        throw error;
      }

      logger.info(`Cleaned up ${count || 0} old notifications (older than ${daysOld} days)`);
      return count || 0;
    } catch (error) {
      logger.error('NotificationService.cleanupOldNotifications error:', error);
      throw error;
    }
  }

  /**
   * Get notification statistics (admin)
   * @param {Object} filters - Filtering options
   * @returns {Promise<Object>} Notification statistics
   */
  static async getNotificationStatistics(filters = {}) {
    try {
      const { period = 'month' } = filters;

      // Get all notifications for statistics
      const { data: notifications, error } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .select('type, is_read, created_at');

      if (error) {
        logger.error('Error fetching notification statistics:', error);
        throw error;
      }

      const stats = {
        total_notifications: notifications.length,
        unread_notifications: notifications.filter(n => !n.is_read).length,
        read_notifications: notifications.filter(n => n.is_read).length,
        by_type: {},
        read_rate: 0
      };

      // Group by type
      notifications.forEach(notification => {
        const type = notification.type || 'unknown';
        if (!stats.by_type[type]) {
          stats.by_type[type] = {
            total: 0,
            read: 0,
            unread: 0
          };
        }
        stats.by_type[type].total++;
        if (notification.is_read) {
          stats.by_type[type].read++;
        } else {
          stats.by_type[type].unread++;
        }
      });

      // Calculate read rate
      if (stats.total_notifications > 0) {
        stats.read_rate = (stats.read_notifications / stats.total_notifications) * 100;
      }

      return stats;
    } catch (error) {
      logger.error('NotificationService.getNotificationStatistics error:', error);
      throw error;
    }
  }

  /**
   * Bulk send notifications
   * @param {Array} notifications - Array of notification objects
   * @returns {Promise<Array>} Created notifications
   */
  static async bulkSendNotifications(notifications) {
    try {
      if (!Array.isArray(notifications) || notifications.length === 0) {
        throw new ValidationError('Notifications array is required and must not be empty');
      }

      const notificationsToCreate = notifications.map(notification => ({
        ...notification,
        is_read: false,
        created_at: new Date().toISOString()
      }));

      const { data, error } = await supabaseAdmin
        .from(TABLES.NOTIFICATIONS)
        .insert(notificationsToCreate)
        .select();

      if (error) {
        logger.error('Error bulk creating notifications:', error);
        throw error;
      }

      logger.info(`Bulk created ${data.length} notifications`);
      return data;
    } catch (error) {
      logger.error('NotificationService.bulkSendNotifications error:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;