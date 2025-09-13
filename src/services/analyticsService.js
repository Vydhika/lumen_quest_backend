/**
 * Analytics service
 * Business logic for analytics, recommendations, and churn analysis
 */

const SubscriptionModel = require('../models/subscriptionModel');
const PlanModel = require('../models/planModel');
const BillingModel = require('../models/billingModel');
const { logger, dateHelpers, calculatePercentage } = require('../utils/helpers');
const { SUBSCRIPTION_STATUS, PAYMENT_STATUS, ANALYTICS_PERIODS } = require('../utils/constants');

class AnalyticsService {
  /**
   * Get churn analytics
   * @param {Object} filters - Filtering options
   * @returns {Promise<Object>} Churn analytics data
   */
  static async getChurnAnalytics(filters = {}) {
    try {
      const { period = 'month', start_date, end_date } = filters;
      let dateRange = {};

      // Set date range based on period
      if (start_date && end_date) {
        dateRange = { start_date, end_date };
      } else {
        switch (period) {
          case 'month':
            const { start, end } = dateHelpers.getMonthRange();
            dateRange = { start_date: start.toISOString(), end_date: end.toISOString() };
            break;
          case 'year':
            const yearRange = dateHelpers.getYearRange();
            dateRange = { start_date: yearRange.start.toISOString(), end_date: yearRange.end.toISOString() };
            break;
          default:
            // Last 30 days
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            dateRange = { start_date: thirtyDaysAgo.toISOString(), end_date: new Date().toISOString() };
        }
      }

      // Get all subscriptions in the period
      const allSubscriptionsResult = await SubscriptionModel.getAll({}, { offset: 0, limit: 10000 });
      const allSubscriptions = allSubscriptionsResult.data;

      // Get subscriptions that were cancelled in the period
      const cancelledSubscriptions = allSubscriptions.filter(sub => {
        if (sub.status !== SUBSCRIPTION_STATUS.CANCELLED || !sub.cancel_date) {
          return false;
        }
        const cancelDate = new Date(sub.cancel_date);
        return cancelDate >= new Date(dateRange.start_date) && cancelDate <= new Date(dateRange.end_date);
      });

      // Get subscriptions that were active at the start of the period
      const activeAtStart = allSubscriptions.filter(sub => {
        const startDate = new Date(sub.start_date);
        const periodStart = new Date(dateRange.start_date);
        return startDate <= periodStart && (
          sub.status === SUBSCRIPTION_STATUS.ACTIVE || 
          (sub.status === SUBSCRIPTION_STATUS.CANCELLED && new Date(sub.cancel_date) > periodStart)
        );
      });

      const churnRate = activeAtStart.length > 0 ? 
        calculatePercentage(cancelledSubscriptions.length, activeAtStart.length) : 0;

      // Group churn by plan
      const churnByPlan = {};
      cancelledSubscriptions.forEach(sub => {
        const planName = sub.plan?.name || 'Unknown';
        churnByPlan[planName] = (churnByPlan[planName] || 0) + 1;
      });

      // Group churn by reason
      const churnByReason = {};
      cancelledSubscriptions.forEach(sub => {
        const reason = sub.cancel_reason || 'No reason provided';
        churnByReason[reason] = (churnByReason[reason] || 0) + 1;
      });

      // Calculate monthly churn trend (last 12 months)
      const monthlyTrend = await this.getMonthlyChurnTrend(12);

      return {
        period: {
          start: dateRange.start_date,
          end: dateRange.end_date,
          period_type: period
        },
        churn_metrics: {
          total_cancellations: cancelledSubscriptions.length,
          active_at_start: activeAtStart.length,
          churn_rate: churnRate,
          retention_rate: 100 - churnRate
        },
        churn_by_plan: Object.entries(churnByPlan).map(([plan, count]) => ({
          plan_name: plan,
          cancellations: count,
          percentage: calculatePercentage(count, cancelledSubscriptions.length)
        })),
        churn_by_reason: Object.entries(churnByReason).map(([reason, count]) => ({
          reason,
          cancellations: count,
          percentage: calculatePercentage(count, cancelledSubscriptions.length)
        })),
        monthly_trend: monthlyTrend
      };
    } catch (error) {
      logger.error('AnalyticsService.getChurnAnalytics error:', error);
      throw error;
    }
  }

  /**
   * Get top performing plans
   * @param {Object} filters - Filtering options
   * @returns {Promise<Object>} Top plans analytics
   */
  static async getTopPlans(filters = {}) {
    try {
      const { period = 'month', limit = 10 } = filters;
      
      // Get all active subscriptions
      const activeSubscriptionsResult = await SubscriptionModel.getAll({
        status: SUBSCRIPTION_STATUS.ACTIVE
      }, { offset: 0, limit: 10000 });
      
      const activeSubscriptions = activeSubscriptionsResult.data;

      // Group by plan
      const planStats = {};
      activeSubscriptions.forEach(sub => {
        const planId = sub.plan_id;
        const planName = sub.plan?.name || 'Unknown';
        const planPrice = sub.plan?.price || 0;

        if (!planStats[planId]) {
          planStats[planId] = {
            plan_id: planId,
            plan_name: planName,
            plan_price: planPrice,
            active_subscriptions: 0,
            total_revenue: 0,
            avg_revenue_per_user: 0
          };
        }

        planStats[planId].active_subscriptions++;
        planStats[planId].total_revenue += planPrice;
      });

      // Calculate ARPU and sort by active subscriptions
      const topPlans = Object.values(planStats)
        .map(plan => ({
          ...plan,
          avg_revenue_per_user: plan.active_subscriptions > 0 ? 
            plan.total_revenue / plan.active_subscriptions : 0,
          market_share: calculatePercentage(plan.active_subscriptions, activeSubscriptions.length)
        }))
        .sort((a, b) => b.active_subscriptions - a.active_subscriptions)
        .slice(0, limit);

      // Get revenue trend for top plans
      const revenueTrend = await this.getRevenueByPlan(period);

      return {
        period_type: period,
        total_active_subscriptions: activeSubscriptions.length,
        total_plans: Object.keys(planStats).length,
        top_plans: topPlans,
        revenue_by_plan: revenueTrend
      };
    } catch (error) {
      logger.error('AnalyticsService.getTopPlans error:', error);
      throw error;
    }
  }

  /**
   * Get plan recommendations for a user
   * @param {string} userId - User ID
   * @param {Object} options - Recommendation options
   * @returns {Promise<Object>} Plan recommendations
   */
  static async getUserRecommendations(userId, options = {}) {
    try {
      // Get user's current subscriptions
      const userSubscriptions = await SubscriptionModel.getByUserId(userId, {
        status: SUBSCRIPTION_STATUS.ACTIVE
      });

      if (userSubscriptions.length === 0) {
        // New user recommendations - suggest starter plans
        return await this.getNewUserRecommendations();
      }

      const recommendations = [];

      for (const subscription of userSubscriptions) {
        const usage = await SubscriptionModel.getUsage(subscription.id);
        const planRecommendations = await this.getRecommendationsForSubscription(subscription, usage);
        recommendations.push(...planRecommendations);
      }

      // Remove duplicates and limit results
      const uniqueRecommendations = recommendations
        .filter((rec, index, self) => 
          index === self.findIndex(r => r.plan.id === rec.plan.id)
        )
        .slice(0, options.limit || 5);

      return {
        user_id: userId,
        current_subscriptions: userSubscriptions.length,
        recommendations: uniqueRecommendations,
        generated_at: new Date().toISOString()
      };
    } catch (error) {
      logger.error('AnalyticsService.getUserRecommendations error:', error);
      throw error;
    }
  }

  /**
   * Get dashboard overview analytics
   * @param {Object} filters - Filtering options
   * @returns {Promise<Object>} Dashboard overview
   */
  static async getDashboardOverview(filters = {}) {
    try {
      const { period = 'month' } = filters;
      
      // Get basic subscription metrics
      const allSubscriptionsResult = await SubscriptionModel.getAll({}, { offset: 0, limit: 10000 });
      const allSubscriptions = allSubscriptionsResult.data;

      const activeSubscriptions = allSubscriptions.filter(s => s.status === SUBSCRIPTION_STATUS.ACTIVE);
      const cancelledSubscriptions = allSubscriptions.filter(s => s.status === SUBSCRIPTION_STATUS.CANCELLED);

      // Get revenue data
      const revenueAnalytics = await BillingModel.getRevenueAnalytics({
        status: PAYMENT_STATUS.COMPLETED
      });

      // Get recent activity
      const recentSubscriptions = allSubscriptions
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10);

      // Calculate growth metrics
      const thisMonth = new Date();
      const lastMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 1, 1);
      
      const thisMonthSubscriptions = allSubscriptions.filter(s => 
        new Date(s.created_at) >= new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1)
      );
      
      const lastMonthSubscriptions = allSubscriptions.filter(s => {
        const createdDate = new Date(s.created_at);
        return createdDate >= lastMonth && createdDate < new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
      });

      const subscriptionGrowth = lastMonthSubscriptions.length > 0 ?
        calculatePercentage(
          thisMonthSubscriptions.length - lastMonthSubscriptions.length,
          lastMonthSubscriptions.length
        ) : 0;

      return {
        overview: {
          total_subscriptions: allSubscriptions.length,
          active_subscriptions: activeSubscriptions.length,
          cancelled_subscriptions: cancelledSubscriptions.length,
          total_revenue: revenueAnalytics.total_revenue || 0,
          average_revenue_per_user: activeSubscriptions.length > 0 ?
            (revenueAnalytics.total_revenue || 0) / activeSubscriptions.length : 0
        },
        growth_metrics: {
          subscription_growth: subscriptionGrowth,
          monthly_new_subscriptions: thisMonthSubscriptions.length,
          revenue_growth: revenueAnalytics.monthly_growth_percentage || 0
        },
        recent_activity: recentSubscriptions.map(sub => ({
          id: sub.id,
          user_id: sub.user_id,
          plan_name: sub.plan?.name || 'Unknown',
          status: sub.status,
          created_at: sub.created_at,
          action: 'subscription_created'
        })),
        period: period
      };
    } catch (error) {
      logger.error('AnalyticsService.getDashboardOverview error:', error);
      throw error;
    }
  }

  /**
   * Get usage analytics
   * @param {Object} filters - Filtering options
   * @returns {Promise<Object>} Usage analytics
   */
  static async getUsageAnalytics(filters = {}) {
    try {
      const { plan_id, period = 'month' } = filters;

      // Get active subscriptions
      let subscriptionsFilter = { status: SUBSCRIPTION_STATUS.ACTIVE };
      if (plan_id) {
        subscriptionsFilter.plan_id = plan_id;
      }

      const subscriptionsResult = await SubscriptionModel.getAll(subscriptionsFilter, { offset: 0, limit: 1000 });
      const subscriptions = subscriptionsResult.data;

      const usageStats = {
        total_subscriptions: subscriptions.length,
        high_usage_users: 0, // >80% usage
        moderate_usage_users: 0, // 30-80% usage
        low_usage_users: 0, // <30% usage
        average_usage_percentage: 0,
        at_risk_users: [], // High usage users who might churn
        upgrade_candidates: [], // High usage users for upgrade recommendations
        downgrade_candidates: [] // Low usage users for downgrade recommendations
      };

      let totalUsagePercentage = 0;

      for (const subscription of subscriptions) {
        try {
          const usage = await SubscriptionModel.getUsage(subscription.id);
          const usagePercentage = usage.usage_percentage || 0;
          
          totalUsagePercentage += usagePercentage;

          if (usagePercentage >= 80) {
            usageStats.high_usage_users++;
            if (usagePercentage >= 90) {
              usageStats.upgrade_candidates.push({
                subscription_id: subscription.id,
                user_id: subscription.user_id,
                current_plan: subscription.plan?.name,
                usage_percentage: usagePercentage,
                recommendation: 'upgrade'
              });
            }
          } else if (usagePercentage >= 30) {
            usageStats.moderate_usage_users++;
          } else {
            usageStats.low_usage_users++;
            if (usagePercentage <= 20) {
              usageStats.downgrade_candidates.push({
                subscription_id: subscription.id,
                user_id: subscription.user_id,
                current_plan: subscription.plan?.name,
                usage_percentage: usagePercentage,
                recommendation: 'downgrade'
              });
            }
          }
        } catch (usageError) {
          logger.warn(`Could not get usage for subscription ${subscription.id}:`, usageError);
        }
      }

      usageStats.average_usage_percentage = subscriptions.length > 0 ?
        totalUsagePercentage / subscriptions.length : 0;

      return {
        period,
        usage_distribution: usageStats,
        recommendations: {
          upgrade_candidates: usageStats.upgrade_candidates.slice(0, 10),
          downgrade_candidates: usageStats.downgrade_candidates.slice(0, 10)
        }
      };
    } catch (error) {
      logger.error('AnalyticsService.getUsageAnalytics error:', error);
      throw error;
    }
  }

  /**
   * Get monthly churn trend
   * @param {number} months - Number of months to analyze
   * @returns {Promise<Array>} Monthly churn data
   */
  static async getMonthlyChurnTrend(months = 12) {
    try {
      const trend = [];
      const currentDate = new Date();

      for (let i = months - 1; i >= 0; i--) {
        const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const { start, end } = dateHelpers.getMonthRange(monthDate);
        
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

        // Get subscriptions cancelled in this month
        const cancelledResult = await SubscriptionModel.getAll({
          status: SUBSCRIPTION_STATUS.CANCELLED,
          cancel_date_from: start.toISOString(),
          cancel_date_to: end.toISOString()
        }, { offset: 0, limit: 1000 });

        // Get active subscriptions at start of month
        const activeResult = await SubscriptionModel.getAll({
          start_date_to: start.toISOString()
        }, { offset: 0, limit: 1000 });

        const cancelled = cancelledResult.total || 0;
        const active = activeResult.total || 0;
        const churnRate = active > 0 ? calculatePercentage(cancelled, active) : 0;

        trend.push({
          month: monthKey,
          cancelled_subscriptions: cancelled,
          active_subscriptions: active,
          churn_rate: churnRate
        });
      }

      return trend;
    } catch (error) {
      logger.error('AnalyticsService.getMonthlyChurnTrend error:', error);
      return [];
    }
  }

  /**
   * Get revenue by plan
   * @param {string} period - Period type
   * @returns {Promise<Array>} Revenue by plan data
   */
  static async getRevenueByPlan(period = 'month') {
    try {
      const revenueData = await BillingModel.getRevenueAnalytics({
        status: PAYMENT_STATUS.COMPLETED
      });

      // This would typically query billing data grouped by plan
      // For now, return a simplified structure
      return revenueData.monthly_breakdown || [];
    } catch (error) {
      logger.error('AnalyticsService.getRevenueByPlan error:', error);
      return [];
    }
  }

  /**
   * Get new user recommendations
   * @returns {Promise<Object>} New user recommendations
   */
  static async getNewUserRecommendations() {
    try {
      const activePlans = await PlanModel.getActive();
      
      // Recommend 3 starter plans
      const starterPlans = activePlans
        .sort((a, b) => a.price - b.price)
        .slice(0, 3)
        .map(plan => ({
          plan,
          recommendation_type: 'starter',
          reason: 'Great for getting started',
          confidence: 0.8
        }));

      return {
        user_type: 'new_user',
        recommendations: starterPlans,
        generated_at: new Date().toISOString()
      };
    } catch (error) {
      logger.error('AnalyticsService.getNewUserRecommendations error:', error);
      throw error;
    }
  }

  /**
   * Get recommendations for a specific subscription
   * @param {Object} subscription - Subscription object
   * @param {Object} usage - Usage data
   * @returns {Promise<Array>} Recommendations
   */
  static async getRecommendationsForSubscription(subscription, usage) {
    try {
      const recommendations = [];
      const usagePercentage = usage.usage_percentage || 0;
      const activePlans = await PlanModel.getActive();

      // High usage - recommend upgrade
      if (usagePercentage >= 80) {
        const higherPlans = activePlans.filter(plan => 
          plan.id !== subscription.plan_id && 
          plan.quota > (subscription.plan?.quota || 0)
        );

        if (higherPlans.length > 0) {
          const bestUpgrade = higherPlans.sort((a, b) => a.quota - b.quota)[0];
          recommendations.push({
            plan: bestUpgrade,
            recommendation_type: 'upgrade',
            reason: `You're using ${Math.round(usagePercentage)}% of your quota`,
            confidence: 0.9,
            current_subscription_id: subscription.id
          });
        }
      }
      // Low usage - recommend downgrade
      else if (usagePercentage <= 30) {
        const lowerPlans = activePlans.filter(plan => 
          plan.id !== subscription.plan_id && 
          plan.quota < (subscription.plan?.quota || Infinity) &&
          plan.quota >= usage.current_usage * 1.2 // Ensure sufficient quota
        );

        if (lowerPlans.length > 0) {
          const bestDowngrade = lowerPlans.sort((a, b) => b.quota - a.quota)[0];
          recommendations.push({
            plan: bestDowngrade,
            recommendation_type: 'downgrade',
            reason: `You're only using ${Math.round(usagePercentage)}% of your quota`,
            confidence: 0.7,
            current_subscription_id: subscription.id
          });
        }
      }

      return recommendations;
    } catch (error) {
      logger.error('AnalyticsService.getRecommendationsForSubscription error:', error);
      return [];
    }
  }
}

module.exports = AnalyticsService;