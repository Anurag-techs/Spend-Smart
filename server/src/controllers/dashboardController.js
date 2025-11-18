const Expense = require('../models/Expense');
const Category = require('../models/Category');
const Goal = require('../models/Goal');
const { DASHBOARD_RANGES } = require('../config/constants');
const { asyncHandler } = require('../middleware/errorHandler');
const moment = require('moment');

/**
 * Get dashboard summary statistics
 */
const getSummary = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { range = '30' } = req.query;
  const days = parseInt(range);

  const endDate = moment().endOf('day').toDate();
  const startDate = moment().subtract(days, 'days').startOf('day').toDate();

  // Get total expenses and summary
  const [totalExpensesResult, topCategories, recentExpenses, budgetStatus, goalsProgress] = await Promise.all([
    getTotalExpenses(userId, startDate, endDate),
    getTopCategories(userId, startDate, endDate),
    getRecentExpenses(userId, 5),
    getBudgetStatus(userId),
    getGoalsProgress(userId),
  ]);

  const totalExpenses = totalExpensesResult.totalAmount || 0;
  const expenseCount = totalExpensesResult.expenseCount || 0;
  const averageDaily = days > 0 ? totalExpenses / days : 0;

  res.status(200).json({
    success: true,
    data: {
      totalExpenses: parseFloat(totalExpenses.toFixed(2)),
      averageDaily: parseFloat(averageDaily.toFixed(2)),
      expenseCount,
      topCategories,
      recentExpenses,
      budgetStatus,
      goalsProgress,
      period: {
        days,
        start: startDate,
        end: endDate,
      },
    },
  });
});

/**
 * Get spending trends for charts
 */
const getTrends = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { range = '30', granularity } = req.query;
  const days = parseInt(range);

  const endDate = moment().endOf('day').toDate();
  const startDate = moment().subtract(days, 'days').startOf('day').toDate();

  // Auto-determine granularity based on range
  let selectedGranularity = granularity;
  if (!granularity) {
    if (days <= 7) {
      selectedGranularity = 'day';
    } else if (days <= 30) {
      selectedGranularity = 'day';
    } else {
      selectedGranularity = 'week';
    }
  }

  const [dailyTrends, categoryTrends, paymentMethodBreakdown] = await Promise.all([
    getDailyTrends(userId, startDate, endDate, selectedGranularity),
    getCategoryTrends(userId, startDate, endDate),
    getPaymentMethodBreakdown(userId, startDate, endDate),
  ]);

  res.status(200).json({
    success: true,
    data: {
      dailyTrends,
      categoryTrends,
      paymentMethodBreakdown,
      period: {
        days,
        granularity: selectedGranularity,
        start: startDate,
        end: endDate,
      },
    },
  });
});

/**
 * Get budget vs actual spending comparison
 */
const getBudgetComparison = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { month, year } = req.query;

  const selectedMonth = month ? parseInt(month) : moment().month();
  const selectedYear = year ? parseInt(year) : moment().year();

  const startDate = moment([selectedYear, selectedMonth]).startOf('month').toDate();
  const endDate = moment([selectedYear, selectedMonth]).endOf('month').toDate();

  const categories = await Category.find({
    userId,
    isActive: true,
    monthlyBudget: { $gt: 0 },
  });

  const budgetComparison = [];

  for (const category of categories) {
    const spent = await getCategorySpending(userId, category._id, startDate, endDate);
    const budget = category.monthlyBudget;
    const percentage = budget > 0 ? (spent / budget) * 100 : 0;
    const remaining = Math.max(0, budget - spent);
    const isOverBudget = spent > budget;

    budgetComparison.push({
      id: category._id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      budget,
      spent: parseFloat(spent.toFixed(2)),
      remaining: parseFloat(remaining.toFixed(2)),
      percentage: Math.min(100, parseFloat(percentage.toFixed(1))),
      isOverBudget,
      status: isOverBudget ? 'over' : percentage >= 80 ? 'warning' : 'good',
    });
  }

  // Sort by percentage (highest first)
  budgetComparison.sort((a, b) => b.percentage - a.percentage);

  res.status(200).json({
    success: true,
    data: budgetComparison,
    period: {
      month: selectedMonth,
      year: selectedYear,
      monthName: moment([selectedYear, selectedMonth]).format('MMMM YYYY'),
    },
  });
});

/**
 * Get monthly spending comparison
 */
const getMonthlyComparison = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { months = 6 } = req.query;
  const monthsCount = parseInt(months);

  const monthlyData = [];
  const currentMonth = moment().month();
  const currentYear = moment().year();

  for (let i = monthsCount - 1; i >= 0; i--) {
    const targetDate = moment([currentYear, currentMonth]).subtract(i, 'months');
    const monthStart = targetDate.clone().startOf('month').toDate();
    const monthEnd = targetDate.clone().endOf('month').toDate();

    const total = await getTotalExpenses(userId, monthStart, monthEnd);
    const expenseCount = total.expenseCount || 0;

    monthlyData.push({
      month: targetDate.month(),
      year: targetDate.year(),
      monthName: targetDate.format('MMM YYYY'),
      amount: parseFloat(total.totalAmount.toFixed(2)),
      expenseCount,
      averageDay: parseFloat((total.totalAmount / targetDate.daysInMonth()).toFixed(2)),
    });
  }

  res.status(200).json({
    success: true,
    data: monthlyData,
  });
});

/**
 * Get expense breakdown by payment method
 */
const getPaymentMethodBreakdown = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { range = '30' } = req.query;
  const days = parseInt(range);

  const endDate = moment().endOf('day').toDate();
  const startDate = moment().subtract(days, 'days').startOf('day').toDate();

  const breakdown = await getPaymentMethodBreakdown(userId, startDate, endDate);

  res.status(200).json({
    success: true,
    data: breakdown,
    period: {
      days,
      start: startDate,
      end: endDate,
    },
  });
});

/**
 * Get spending heatmap data
 */
const getSpendingHeatmap = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { range = '90' } = req.query;
  const days = parseInt(range);

  const endDate = moment().endOf('day').toDate();
  const startDate = moment().subtract(days, 'days').startOf('day').toDate();

  const heatmapData = await Expense.aggregate([
    {
      $match: {
        userId: userId,
        isActive: true,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' },
        },
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        date: {
          $dateFromParts: {
            year: '$_id.year',
            month: { $add: ['$_id.month', -1] }, // MongoDB months are 0-indexed
            day: '$_id.day',
          },
        },
        amount: 1,
        count: 1,
        _id: 0,
      },
    },
    {
      $sort: { date: 1 },
    },
  ]);

  res.status(200).json({
    success: true,
    data: heatmapData,
    period: {
      days,
      start: startDate,
      end: endDate,
    },
  });
});

// Helper functions
async function getTotalExpenses(userId, startDate, endDate) {
  const result = await Expense.aggregate([
    {
      $match: {
        userId: userId,
        isActive: true,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        expenseCount: { $sum: 1 },
      },
    },
  ]);

  return result[0] || { totalAmount: 0, expenseCount: 0 };
}

async function getTopCategories(userId, startDate, endDate, limit = 5) {
  return await Expense.aggregate([
    {
      $match: {
        userId: userId,
        isActive: true,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $lookup: {
        from: 'categories',
        localField: 'categoryId',
        foreignField: '_id',
        as: 'category',
      },
    },
    {
      $unwind: '$category',
    },
    {
      $group: {
        _id: {
          categoryId: '$categoryId',
          name: '$category.name',
          color: '$category.color',
        },
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { amount: -1 },
    },
    {
      $limit: limit,
    },
    {
      $project: {
        categoryId: '$_id.categoryId',
        name: '$_id.name',
        color: '$_id.color',
        amount: 1,
        count: 1,
        _id: 0,
      },
    },
  ]);
}

async function getRecentExpenses(userId, limit = 5) {
  return await Expense.find({
    userId: userId,
    isActive: true,
  })
    .populate('categoryId', 'name color icon')
    .sort({ date: -1, createdAt: -1 })
    .limit(limit);
}

async function getBudgetStatus(userId) {
  const categories = await Category.find({
    userId,
    isActive: true,
    monthlyBudget: { $gt: 0 },
  });

  const budgetStatus = [];

  for (const category of categories) {
    const spent = await getCategorySpendingThisMonth(userId, category._id);
    const budget = category.monthlyBudget;
    const percentage = budget > 0 ? (spent / budget) * 100 : 0;
    const remaining = Math.max(0, budget - spent);
    const isOverBudget = spent > budget;

    if (isOverBudget || percentage >= 80) { // Only include concerning categories
      budgetStatus.push({
        categoryId: category._id,
        name: category.name,
        color: category.color,
        budget,
        spent: parseFloat(spent.toFixed(2)),
        remaining: parseFloat(remaining.toFixed(2)),
        percentage: Math.min(100, parseFloat(percentage.toFixed(1))),
        isOverBudget,
      });
    }
  }

  return budgetStatus.sort((a, b) => b.percentage - a.percentage);
}

async function getGoalsProgress(userId) {
  const goals = await Goal.find({
    userId,
    isActive: true,
  }).sort({ priority: -1, endDate: 1 });

  return goals.map(goal => ({
    goalId: goal._id,
    title: goal.title,
    targetAmount: goal.targetAmount,
    savedAmount: goal.savedAmount,
    percentage: goal.percentage,
    remaining: goal.remainingAmount,
    daysLeft: goal.daysLeft,
    category: goal.category,
  }));
}

async function getDailyTrends(userId, startDate, endDate, granularity = 'day') {
  const groupBy = granularity === 'week' ? {
    year: { $year: '$date' },
    week: { $week: '$date' },
  } : {
    year: { $year: '$date' },
    month: { $month: '$date' },
    day: { $dayOfMonth: '$date' },
  };

  return await Expense.aggregate([
    {
      $match: {
        userId: userId,
        isActive: true,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: groupBy,
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        date: granularity === 'week' ? {
          $dateFromParts: {
            isoWeek: '$_id.week',
            isoWeekYear: '$_id.year',
          },
        } : {
          $dateFromParts: {
            year: '$_id.year',
            month: { $add: ['$_id.month', -1] },
            day: '$_id.day',
          },
        },
        amount: 1,
        count: 1,
        _id: 0,
      },
    },
    {
      $sort: { date: 1 },
    },
  ]);
}

async function getCategoryTrends(userId, startDate, endDate) {
  return await Expense.aggregate([
    {
      $match: {
        userId: userId,
        isActive: true,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $lookup: {
        from: 'categories',
        localField: 'categoryId',
        foreignField: '_id',
        as: 'category',
      },
    },
    {
      $unwind: '$category',
    },
    {
      $group: {
        _id: {
          categoryId: '$categoryId',
          name: '$category.name',
          color: '$category.color',
        },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { total: -1 },
    },
    {
      $project: {
        categoryId: '$_id.categoryId',
        name: '$_id.name',
        color: '$_id.color',
        total: 1,
        count: 1,
        percentage: { $literal: 0 }, // Will be calculated after knowing total
        dailyAverage: { $literal: 0 }, // Will be calculated after knowing total
        _id: 0,
      },
    },
  ]);
}

async function getPaymentMethodBreakdown(userId, startDate, endDate) {
  const result = await Expense.aggregate([
    {
      $match: {
        userId: userId,
        isActive: true,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: '$paymentMethod',
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { amount: -1 },
    },
  ]);

  // Calculate total amount for percentage calculation
  const totalAmount = result.reduce((sum, item) => sum + item.amount, 0);

  return result.map(item => ({
    method: item._id,
    amount: parseFloat(item.amount.toFixed(2)),
    count: item.count,
    percentage: totalAmount > 0 ? parseFloat(((item.amount / totalAmount) * 100).toFixed(1)) : 0,
  }));
}

async function getCategorySpending(userId, categoryId, startDate, endDate) {
  const result = await Expense.aggregate([
    {
      $match: {
        userId: userId,
        categoryId: categoryId,
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

async function getCategorySpendingThisMonth(userId, categoryId) {
  const startOfMonth = moment().startOf('month').toDate();
  const endOfMonth = moment().endOf('month').toDate();
  return await getCategorySpending(userId, categoryId, startOfMonth, endOfMonth);
}

module.exports = {
  getSummary,
  getTrends,
  getBudgetComparison,
  getMonthlyComparison,
  getPaymentMethodBreakdown,
  getSpendingHeatmap,
};