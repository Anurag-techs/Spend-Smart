const Expense = require('../models/Expense');
const Category = require('../models/Category');
const User = require('../models/User');
const Badge = require('../models/Badge');
const { BADGE_TYPES } = require('../config/constants');
const { asyncHandler, createNotFoundError } = require('../middleware/errorHandler');
const { RESPONSE_MESSAGES } = require('../config/constants');

/**
 * Get all expenses for a user with filtering and pagination
 */
const getExpenses = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const {
    start,
    end,
    categoryId,
    page = 1,
    limit = 20,
    sortBy = 'date',
    sortOrder = 'desc',
    tags,
    paymentMethods,
  } = req.query;

  const options = {
    startDate: start ? new Date(start) : undefined,
    endDate: end ? new Date(end) : undefined,
    categoryId,
    page: parseInt(page),
    limit: Math.min(parseInt(limit), 100),
    sortBy,
    sortOrder,
    tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
    paymentMethods: paymentMethods ? (Array.isArray(paymentMethods) ? paymentMethods : [paymentMethods]) : undefined,
  };

  // Get expenses and total count for pagination
  const expenses = await Expense.findByUser(userId, options);

  // Get total count for pagination
  const countQuery = { userId, isActive: true };
  if (options.startDate && options.endDate) {
    countQuery.date = { $gte: options.startDate, $lte: options.endDate };
  }
  if (options.categoryId) {
    countQuery.categoryId = options.categoryId;
  }

  const totalExpenses = await Expense.countDocuments(countQuery);

  // Calculate summary
  const summaryQuery = {
    userId,
    isActive: true,
  };
  if (options.startDate && options.endDate) {
    summaryQuery.date = { $gte: options.startDate, $lte: options.endDate };
  }

  const summaryResult = await Expense.aggregate([
    { $match: summaryQuery },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        averageAmount: { $avg: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  const summary = summaryResult[0] || { totalAmount: 0, averageAmount: 0, count: 0 };

  const totalPages = Math.ceil(totalExpenses / options.limit);
  const pagination = {
    currentPage: options.page,
    totalPages,
    totalExpenses,
    hasNext: options.page < totalPages,
    hasPrev: options.page > 1,
  };

  res.status(200).json({
    success: true,
    data: {
      expenses,
      pagination,
      summary: {
        totalAmount: summary.totalAmount,
        averageDaily: summary.totalAmount / Math.max(1, options.endDate ?
          Math.ceil((options.endDate - options.startDate) / (1000 * 60 * 60 * 24)) : 1),
      },
    },
  });
});

/**
 * Get single expense by ID
 */
const getExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const expense = await Expense.findOne({ _id: id, userId, isActive: true });

  if (!expense) {
    throw createNotFoundError('Expense not found');
  }

  res.status(200).json({
    success: true,
    data: expense,
  });
});

/**
 * Create a new expense
 */
const createExpense = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const expenseData = {
    ...req.body,
    userId,
    metadata: {
      source: 'manual',
    },
  };

  // Validate category exists and belongs to user
  const category = await Category.findOne({ _id: expenseData.categoryId, userId });
  if (!category) {
    const error = new Error('Invalid category');
    error.statusCode = 400;
    throw error;
  }

  const expense = new Expense(expenseData);
  await expense.save();

  // Award first expense badge if this is the user's first expense
  const expenseCount = await Expense.countDocuments({ userId, isActive: true });
  if (expenseCount === 1) {
    try {
      await Badge.checkAndAwardBadges(userId, { firstExpense: true });
    } catch (badgeError) {
      console.error('Badge awarding failed:', badgeError);
    }
  }

  res.status(201).json({
    success: true,
    message: RESPONSE_MESSAGES.EXPENSE_CREATED,
    data: expense,
  });
});

/**
 * Update an expense
 */
const updateExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const updateData = req.body;

  const expense = await Expense.findOne({ _id: id, userId, isActive: true });

  if (!expense) {
    throw createNotFoundError('Expense not found');
  }

  // If changing category, validate new category
  if (updateData.categoryId && updateData.categoryId !== expense.categoryId.toString()) {
    const category = await Category.findOne({ _id: updateData.categoryId, userId });
    if (!category) {
      const error = new Error('Invalid category');
      error.statusCode = 400;
      throw error;
    }
  }

  Object.assign(expense, updateData);
  await expense.save();

  res.status(200).json({
    success: true,
    message: RESPONSE_MESSAGES.EXPENSE_UPDATED,
    data: expense,
  });
});

/**
 * Delete an expense (soft delete)
 */
const deleteExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const expense = await Expense.findOne({ _id: id, userId, isActive: true });

  if (!expense) {
    throw createNotFoundError('Expense not found');
  }

  await expense.softDelete();

  res.status(200).json({
    success: true,
    message: RESPONSE_MESSAGES.EXPENSE_DELETED,
  });
});

/**
 * Bulk upload expenses from CSV
 */
const uploadCSV = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  if (!req.file) {
    const error = new Error('No file uploaded');
    error.statusCode = 400;
    throw error;
  }

  const csvService = require('../services/csvService');
  const result = await csvService.processCSVUpload(userId, req.file);

  res.status(200).json({
    success: true,
    message: RESPONSE_MESSAGES.CSV_IMPORTED,
    data: result,
  });
});

/**
 * Get expense statistics
 */
const getExpenseStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { start, end, period = '30' } = req.query;

  const startDate = start ? new Date(start) : new Date(Date.now() - period * 24 * 60 * 60 * 1000);
  const endDate = end ? new Date(end) : new Date();

  const stats = await Expense.getUserStats(userId, startDate, endDate);

  res.status(200).json({
    success: true,
    data: stats,
  });
});

/**
 * Get daily spending trends
 */
const getTrends = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { days = '30' } = req.query;

  const trends = await Expense.getDailyTrends(userId, parseInt(days));

  res.status(200).json({
    success: true,
    data: trends,
  });
});

/**
 * Get category breakdown
 */
const getCategoryBreakdown = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { start, end } = req.query;

  const startDate = start ? new Date(start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = end ? new Date(end) : new Date();

  const breakdown = await Expense.getCategoryBreakdown(userId, startDate, endDate);

  res.status(200).json({
    success: true,
    data: breakdown,
  });
});

module.exports = {
  getExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  uploadCSV,
  getExpenseStats,
  getTrends,
  getCategoryBreakdown,
};