const Expense = require('../models/Expense');
const Category = require('../models/Category');
const { NUDGE_TYPES, NUDGE_PRIORITY, PAYMENT_METHODS } = require('../config/constants');
const moment = require('moment');

class AIService {
  /**
   * Generate AI-powered spending insights and nudges
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date for analysis
   * @param {Date} endDate - End date for analysis
   * @returns {object} Insights and nudges
   */
  async generateInsights(userId, startDate = null, endDate = null) {
    try {
      // Set default date range if not provided (last 30 days)
      if (!startDate) {
        startDate = moment().subtract(30, 'days').startOf('day').toDate();
      }
      if (!endDate) {
        endDate = moment().endOf('day').toDate();
      }

      // Get user data for analysis
      const [expenses, categories, user] = await Promise.all([
        this.getUserExpenses(userId, startDate, endDate),
        this.getUserCategories(userId),
        this.getUserInfo(userId),
      ]);

      // Generate all types of nudges
      const nudges = await this.generateAllNudges(userId, expenses, categories, user, startDate, endDate);

      // Generate insights
      const insights = {
        spendingPatterns: await this.analyzeSpendingTrends(userId, startDate, endDate),
        categoryAlerts: await this.analyzeCategorySpending(userId, categories, startDate, endDate),
        streakInfo: {
          current: user.streak.current,
          longest: user.streak.longest,
          lastActiveDate: user.streak.lastActiveDate,
        },
      };

      // Limit nudges to most relevant ones (max 5)
      const prioritizedNudges = this.prioritizeNudges(nudges).slice(0, 5);

      return {
        nudges: prioritizedNudges,
        insights,
        period: {
          start: startDate,
          end: endDate,
        },
      };
    } catch (error) {
      console.error('Error generating insights:', error);
      throw error;
    }
  }

  /**
   * Generate all types of nudges
   */
  async generateAllNudges(userId, expenses, categories, user, startDate, endDate) {
    const nudges = [];

    try {
      // Weekend spending detection
      const weekendNudge = await this.detectWeekendSpending(userId, expenses);
      if (weekendNudge) nudges.push(weekendNudge);

      // Budget overage detection
      const budgetNudges = await this.detectBudgetOverspend(userId, categories, startDate, endDate);
      nudges.push(...budgetNudges);

      // Spending trend analysis
      const trendNudge = await this.analyzeSpendingTrendsForNudge(userId, startDate, endDate);
      if (trendNudge) nudges.push(trendNudge);

      // Streak and motivation
      const motivationNudges = await this.generateMotivationalNudges(user);
      nudges.push(...motivationNudges);

      // Category pattern detection
      const patternNudges = await this.detectCategoryPatterns(userId, expenses, categories);
      nudges.push(...patternNudges);

      // Savings milestones
      const savingsNudges = await this.detectSavingsMilestones(userId);
      nudges.push(...savingsNudges);

    } catch (error) {
      console.error('Error generating nudges:', error);
    }

    return nudges;
  }

  /**
   * Detect weekend spending patterns
   */
  async detectWeekendSpending(userId, expenses) {
    const weekendExpenses = expenses.filter(expense => {
      const dayOfWeek = moment(expense.date).day();
      return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    });

    const weekdayExpenses = expenses.filter(expense => {
      const dayOfWeek = moment(expense.date).day();
      return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
    });

    if (weekendExpenses.length === 0 || weekdayExpenses.length === 0) {
      return null;
    }

    const weekendAvg = weekendExpenses.reduce((sum, e) => sum + e.amount, 0) / weekendExpenses.length;
    const weekdayAvg = weekdayExpenses.reduce((sum, e) => sum + e.amount, 0) / weekdayExpenses.length;

    const ratio = weekendAvg / weekdayAvg;

    if (ratio > 1.8) { // Weekend spending > 1.8x weekday average
      return {
        id: `weekend_spending_${Date.now()}`,
        type: NUDGE_TYPES.WEEKEND_SPENDING,
        title: 'Weekend Spending Alert',
        message: `Your weekend spending is ${ratio.toFixed(1)}× weekday average — try a low-cost activity or set a ₹${Math.round(weekendAvg)} limit this weekend.`,
        priority: ratio > 2.5 ? NUDGE_PRIORITY.HIGH : NUDGE_PRIORITY.MEDIUM,
        actionable: true,
        promptTemplate: 'User weekend spending is {ratio}× weekday. Give 1 friendly 20–30 word actionable suggestion to reduce weekend expenses without sacrificing enjoyment.',
        metadata: {
          ratio: parseFloat(ratio.toFixed(2)),
          weekendAvg: parseFloat(weekendAvg.toFixed(2)),
          weekdayAvg: parseFloat(weekdayAvg.toFixed(2)),
        },
      };
    }

    return null;
  }

  /**
   * Detect budget overspending
   */
  async detectBudgetOverspend(userId, categories, startDate, endDate) {
    const nudges = [];

    for (const category of categories) {
      if (!category.monthlyBudget || category.monthlyBudget <= 0) continue;

      const spentThisMonth = await this.getCategorySpendingThisMonth(userId, category._id);
      const percentage = (spentThisMonth / category.monthlyBudget) * 100;

      if (percentage >= 100) {
        nudges.push({
          id: `budget_overage_${category._id}_${Date.now()}`,
          type: NUDGE_TYPES.BUDGET_OVERAGE,
          title: `${category.name} Budget Exceeded`,
          message: `You've exceeded your ${category.name} budget by ${Math.round(percentage - 100)}%. Pause non-essentials & reallocate funds.`,
          priority: NUDGE_PRIORITY.HIGH,
          actionable: true,
          promptTemplate: 'User exceeded {category} budget by {percentage}%. Provide 1 encouraging 20–30 word suggestion for getting back on track this month.',
          metadata: {
            categoryId: category._id,
            categoryName: category.name,
            budget: category.monthlyBudget,
            spent: spentThisMonth,
            percentage: parseFloat(percentage.toFixed(1)),
          },
        });
      } else if (percentage >= 80) {
        const remainingDays = moment().endOf('month').diff(moment(), 'days');
        const dailyAverageAllowed = (category.monthlyBudget - spentThisMonth) / Math.max(1, remainingDays);

        nudges.push({
          id: `budget_warning_${category._id}_${Date.now()}`,
          type: NUDGE_TYPES.BUDGET_OVERAGE,
          title: `${category.name} Budget Warning`,
          message: `You're approaching your ${category.name} budget limit. ₹${Math.round(category.monthlyBudget - spentThisMonth)} remaining for ${remainingDays} days.`,
          priority: NUDGE_PRIORITY.MEDIUM,
          actionable: true,
          promptTemplate: 'User approaching {category} budget limit with {remaining} remaining for {days} days. Give 1 preventive 20–30 word spending tip.',
          metadata: {
            categoryId: category._id,
            categoryName: category.name,
            budget: category.monthlyBudget,
            spent: spentThisMonth,
            percentage: parseFloat(percentage.toFixed(1)),
            remainingDays,
          },
        });
      }
    }

    return nudges;
  }

  /**
   * Analyze spending trends for nudges
   */
  async analyzeSpendingTrendsForNudge(userId, startDate, endDate) {
    const previousPeriodStart = moment(startDate).subtract(moment(endDate).diff(moment(startDate), 'days'), 'days').toDate();
    const previousPeriodEnd = moment(startDate).subtract(1, 'day').toDate();

    const [currentPeriodTotal, previousPeriodTotal] = await Promise.all([
      this.getTotalSpending(userId, startDate, endDate),
      this.getTotalSpending(userId, previousPeriodStart, previousPeriodEnd),
    ]);

    if (previousPeriodTotal === 0) return null;

    const changePercentage = ((currentPeriodTotal - previousPeriodTotal) / previousPeriodTotal) * 100;

    if (Math.abs(changePercentage) < 15) return null; // Only significant changes

    if (changePercentage > 15) {
      return {
        id: `spending_increase_${Date.now()}`,
        type: NUDGE_TYPES.SPENDING_TREND,
        title: 'Spending Increasing',
        message: `Your spending increased ${Math.round(changePercentage)}% this period. Review your largest expenses and consider cutting back.`,
        priority: NUDGE_PRIORITY.MEDIUM,
        actionable: true,
        promptTemplate: 'User spending increased {percentage}% this month. Provide 1 friendly 20–30 word actionable suggestion to control expenses.',
        metadata: {
          currentPeriodTotal: parseFloat(currentPeriodTotal.toFixed(2)),
          previousPeriodTotal: parseFloat(previousPeriodTotal.toFixed(2)),
          changePercentage: parseFloat(changePercentage.toFixed(1)),
        },
      };
    } else if (changePercentage < -10) {
      return {
        id: `spending_decrease_${Date.now()}`,
        type: NUDGE_TYPES.SPENDING_TREND,
        title: 'Great Job!',
        message: `Great job! You reduced spending by ${Math.abs(Math.round(changePercentage))}% this month. Keep up the good work!`,
        priority: NUDGE_PRIORITY.LOW,
        actionable: false,
        promptTemplate: 'User reduced spending by {percentage}% this month. Give 1 congratulatory 20–30 word message that encourages continued good habits.',
        metadata: {
          currentPeriodTotal: parseFloat(currentPeriodTotal.toFixed(2)),
          previousPeriodTotal: parseFloat(previousPeriodTotal.toFixed(2)),
          changePercentage: parseFloat(changePercentage.toFixed(1)),
        },
      };
    }

    return null;
  }

  /**
   * Generate motivational nudges based on user streak
   */
  async generateMotivationalNudges(user) {
    const nudges = [];
    const { current, longest } = user.streak;

    if (current === 7) {
      nudges.push({
        id: `streak_7_${Date.now()}`,
        type: NUDGE_TYPES.STREAK_CELEBRATION,
        title: '🔥 7-Day Streak!',
        message: '7-day streak! You\'re building a great habit of tracking expenses consistently.',
        priority: NUDGE_PRIORITY.LOW,
        actionable: false,
        promptTemplate: 'User achieved 7-day expense tracking streak. Provide 1 encouraging 20–30 word message about building good financial habits.',
        metadata: { streakDays: current },
      });
    }

    if (current === longest && current > longest - 1 && current > 0) {
      nudges.push({
        id: `personal_best_${Date.now()}`,
        type: NUDGE_TYPES.STREAK_CELEBRATION,
        title: '🎉 New Personal Record!',
        message: `New personal record: ${current} days! Consistency is key to financial success.`,
        priority: NUDGE_PRIORITY.LOW,
        actionable: false,
        promptTemplate: 'User achieved new personal record of {streak} days tracking expenses. Provide 1 motivational 20–30 word message about consistency.',
        metadata: { streakDays: current, personalBest: true },
      });
    }

    return nudges;
  }

  /**
   * Detect category spending patterns
   */
  async detectCategoryPatterns(userId, expenses, categories) {
    const nudges = [];

    // Group expenses by category
    const categoryExpenses = {};
    expenses.forEach(expense => {
      const categoryId = expense.categoryId.toString();
      if (!categoryExpenses[categoryId]) {
        categoryExpenses[categoryId] = [];
      }
      categoryExpenses[categoryId].push(expense);
    });

    for (const [categoryId, categoryExpenseList] of Object.entries(categoryExpenses)) {
      const category = categories.find(c => c._id.toString() === categoryId);
      if (!category) continue;

      // Check for frequent small purchases
      const smallPurchases = categoryExpenseList.filter(e => e.amount < 200);
      if (smallPurchases.length >= 10) {
        const totalSmall = smallPurchases.reduce((sum, e) => sum + e.amount, 0);
        nudges.push({
          id: `small_purchases_${categoryId}_${Date.now()}`,
          type: NUDGE_TYPES.CATEGORY_PATTERN,
          title: `${category.name} Small Purchases`,
          message: `You made ${smallPurchases.length} small purchases in ${category.name} totaling ₹${Math.round(totalSmall)}. Consider bundling or setting a weekly limit.`,
          priority: NUDGE_PRIORITY.MEDIUM,
          actionable: true,
          promptTemplate: 'User made {count} small purchases in {category} totaling {amount}. Provide 1 practical 20–30 word tip to manage frequent small expenses.',
          metadata: {
            categoryId,
            categoryName: category.name,
            count: smallPurchases.length,
            totalAmount: parseFloat(totalSmall.toFixed(2)),
          },
        });
      }

      // Check for unusual spending spikes
      const amounts = categoryExpenseList.map(e => e.amount).sort((a, b) => b - a);
      if (amounts.length >= 3) {
        const median = amounts[Math.floor(amounts.length / 2)];
        const largest = amounts[0];

        if (largest > median * 5) { // Largest expense is 5x the median
          nudges.push({
            id: `unusual_spike_${categoryId}_${Date.now()}`,
            type: NUDGE_TYPES.CATEGORY_PATTERN,
            title: `${category.name} Spending Spike`,
            message: `Unusual spending detected in ${category.name}. Was this planned, or should you review these expenses?`,
            priority: NUDGE_PRIORITY.MEDIUM,
            actionable: true,
            promptTemplate: 'User has unusual spending spike in {category} with largest expense {amount}. Provide 1 thoughtful 20–30 word question to help them review.',
            metadata: {
              categoryId,
              categoryName: category.name,
              largestExpense: parseFloat(largest.toFixed(2)),
              medianExpense: parseFloat(median.toFixed(2)),
            },
          });
        }
      }
    }

    return nudges;
  }

  /**
   * Detect savings milestones
   */
  async detectSavingsMilestones(userId) {
    // This would integrate with the Goal model to check for savings milestones
    // For now, returning empty array as this is typically handled by the badge system
    return [];
  }

  /**
   * Prioritize nudges by importance
   */
  prioritizeNudges(nudges) {
    const priorityOrder = {
      [NUDGE_PRIORITY.HIGH]: 1,
      [NUDGE_PRIORITY.MEDIUM]: 2,
      [NUDGE_PRIORITY.LOW]: 3,
    };

    return nudges.sort((a, b) => {
      const priorityA = priorityOrder[a.priority] || 3;
      const priorityB = priorityOrder[b.priority] || 3;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // If same priority, sort by most recent
      return parseInt(b.id.split('_').pop()) - parseInt(a.id.split('_').pop());
    });
  }

  /**
   * Analyze spending trends
   */
  async analyzeSpendingTrends(userId, startDate, endDate) {
    const currentPeriodTotal = await this.getTotalSpending(userId, startDate, endDate);
    const previousPeriodStart = moment(startDate).subtract(moment(endDate).diff(moment(startDate), 'days'), 'days').toDate();
    const previousPeriodEnd = moment(startDate).subtract(1, 'day').toDate();
    const previousPeriodTotal = await this.getTotalSpending(userId, previousPeriodStart, previousPeriodEnd);

    let trend = 'stable';
    let changePercentage = 0;

    if (previousPeriodTotal > 0) {
      changePercentage = ((currentPeriodTotal - previousPeriodTotal) / previousPeriodTotal) * 100;
      if (changePercentage > 5) {
        trend = 'up';
      } else if (changePercentage < -5) {
        trend = 'down';
      }
    }

    return {
      isIncreasing: trend === 'up',
      trend,
      changePercentage: parseFloat(changePercentage.toFixed(1)),
      currentPeriod: parseFloat(currentPeriodTotal.toFixed(2)),
      previousPeriod: parseFloat(previousPeriodTotal.toFixed(2)),
    };
  }

  /**
   * Analyze category spending
   */
  async analyzeCategorySpending(userId, categories, startDate, endDate) {
    const categoryAlerts = [];

    for (const category of categories) {
      if (!category.monthlyBudget || category.monthlyBudget <= 0) continue;

      const spent = await this.getCategorySpending(userId, category._id, startDate, endDate);
      const percentage = (spent / category.monthlyBudget) * 100;

      if (percentage >= 100) {
        categoryAlerts.push({
          categoryId: category._id,
          name: category.name,
          spent: parseFloat(spent.toFixed(2)),
          budget: category.monthlyBudget,
          percentage: parseFloat(percentage.toFixed(1)),
          overBudget: true,
        });
      } else if (percentage >= 80) {
        categoryAlerts.push({
          categoryId: category._id,
          name: category.name,
          spent: parseFloat(spent.toFixed(2)),
          budget: category.monthlyBudget,
          percentage: parseFloat(percentage.toFixed(1)),
          overBudget: false,
        });
      }
    }

    return categoryAlerts;
  }

  // Helper methods
  async getUserExpenses(userId, startDate, endDate) {
    return await Expense.find({
      userId,
      isActive: true,
      date: { $gte: startDate, $lte: endDate },
    }).populate('categoryId', 'name color');
  }

  async getUserCategories(userId) {
    return await Category.find({ userId, isActive: true });
  }

  async getUserInfo(userId) {
    const User = require('../models/User');
    return await User.findById(userId);
  }

  async getTotalSpending(userId, startDate, endDate) {
    const result = await Expense.aggregate([
      {
        $match: {
          userId: new require('mongoose').Types.ObjectId(userId),
          isActive: true,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    return result[0]?.total || 0;
  }

  async getCategorySpendingThisMonth(userId, categoryId) {
    const startOfMonth = moment().startOf('month').toDate();
    const endOfMonth = moment().endOf('month').toDate();

    return await this.getCategorySpending(userId, categoryId, startOfMonth, endOfMonth);
  }

  async getCategorySpending(userId, categoryId, startDate, endDate) {
    const result = await Expense.aggregate([
      {
        $match: {
          userId: new require('mongoose').Types.ObjectId(userId),
          categoryId: new require('mongoose').Types.ObjectId(categoryId),
          isActive: true,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    return result[0]?.total || 0;
  }
}

module.exports = new AIService();