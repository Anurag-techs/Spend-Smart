const Category = require('../models/Category');
const Expense = require('../models/Expense');
const { asyncHandler, createNotFoundError, createConflictError } = require('../middleware/errorHandler');
const { RESPONSE_MESSAGES } = require('../config/constants');

/**
 * Get all categories for a user
 */
const getCategories = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { includeStats = false, includeSpent = false } = req.query;

  let categories;

  if (includeStats === 'true') {
    categories = await Category.findWithExpenses(userId);
  } else if (includeSpent === 'true') {
    categories = await Category.findWithMonthlySpending(userId);
  } else {
    categories = await Category.findByUser(userId);
  }

  res.status(200).json({
    success: true,
    data: categories,
  });
});

/**
 * Get single category by ID
 */
const getCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const category = await Category.findOne({ _id: id, userId: req.user._id });

  if (!category) {
    throw createNotFoundError('Category not found');
  }

  // Get additional stats if requested
  if (req.query.includeStats === 'true') {
    const stats = await category.getMonthlyStats(
      new Date().getFullYear(),
      new Date().getMonth()
    );
    const categoryObj = category.toJSON();
    categoryObj.monthlyStats = stats;
    res.status(200).json({
      success: true,
      data: categoryObj,
    });
  } else {
    res.status(200).json({
      success: true,
      data: category,
    });
  }
});

/**
 * Create a new category
 */
const createCategory = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const categoryData = {
    ...req.body,
    userId,
  };

  // Check if category with same name already exists for this user
  const existingCategory = await Category.findOne({
    userId,
    name: categoryData.name.trim(),
    isActive: true,
  });

  if (existingCategory) {
    throw createConflictError('Category with this name already exists');
  }

  const category = new Category(categoryData);
  await category.save();

  res.status(201).json({
    success: true,
    message: RESPONSE_MESSAGES.CATEGORY_CREATED,
    data: category,
  });
});

/**
 * Update a category
 */
const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const updateData = req.body;

  const category = await Category.findOne({ _id: id, userId });

  if (!category) {
    throw createNotFoundError('Category not found');
  }

  // Check if new name conflicts with existing categories
  if (updateData.name && updateData.name.trim() !== category.name) {
    const existingCategory = await Category.findOne({
      userId,
      name: updateData.name.trim(),
      _id: { $ne: id },
      isActive: true,
    });

    if (existingCategory) {
      throw createConflictError('Category with this name already exists');
    }
  }

  Object.assign(category, updateData);
  await category.save();

  res.status(200).json({
    success: true,
    message: RESPONSE_MESSAGES.CATEGORY_UPDATED,
    data: category,
  });
});

/**
 * Delete a category (soft delete)
 */
const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const category = await Category.findOne({ _id: id, userId });

  if (!category) {
    throw createNotFoundError('Category not found');
  }

  // Check if category has expenses
  const expenseCount = await Expense.countDocuments({
    categoryId: id,
    isActive: true,
  });

  if (expenseCount > 0) {
    const error = new Error('Cannot delete category with existing expenses');
    error.statusCode = 400;
    throw error;
  }

  // Soft delete
  category.isActive = false;
  await category.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: RESPONSE_MESSAGES.CATEGORY_DELETED,
  });
});

/**
 * Get category statistics
 */
const getCategoryStats = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const { months = 6 } = req.query;

  const category = await Category.findOne({ _id: id, userId });

  if (!category) {
    throw createNotFoundError('Category not found');
  }

  const stats = await category.getMonthlyStats(
    new Date().getFullYear(),
    new Date().getMonth()
  );

  const trend = await category.getSpendingTrend(parseInt(months));

  res.status(200).json({
    success: true,
    data: {
      category: category.toJSON(),
      monthlyStats: stats,
      spendingTrend: trend,
    },
  });
});

/**
 * Get categories with budget status
 */
const getBudgetStatus = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const categories = await Category.find({
    userId,
    isActive: true,
    monthlyBudget: { $gt: 0 },
  }).populate('spentThisMonth');

  const budgetStatus = categories.map(category => {
    const spent = category.spentThisMonth || 0;
    const budget = category.monthlyBudget;
    const percentage = budget > 0 ? (spent / budget) * 100 : 0;
    const remaining = Math.max(0, budget - spent);
    const isOverBudget = spent > budget;

    return {
      id: category._id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      budget,
      spent,
      remaining,
      percentage: Math.min(100, percentage),
      isOverBudget,
      status: isOverBudget ? 'over' : percentage >= 80 ? 'warning' : 'good',
    };
  });

  res.status(200).json({
    success: true,
    data: budgetStatus,
  });
});

/**
 * Create default categories for new user
 */
const createDefaultCategories = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const { DEFAULT_CATEGORIES } = require('../config/constants');

  const createdCategories = [];
  for (const categoryData of DEFAULT_CATEGORIES) {
    const existingCategory = await Category.findOne({
      userId,
      name: categoryData.name,
      isActive: true,
    });

    if (!existingCategory) {
      const category = new Category({
        ...categoryData,
        userId,
        isDefault: true,
      });
      await category.save();
      createdCategories.push(category);
    }
  }

  res.status(201).json({
    success: true,
    message: 'Default categories created successfully',
    data: createdCategories,
  });
});

module.exports = {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryStats,
  getBudgetStatus,
  createDefaultCategories,
};