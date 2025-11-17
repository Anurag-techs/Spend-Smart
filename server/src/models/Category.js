const mongoose = require('mongoose');
const { CURRENCIES } = require('../config/constants');

const categorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    minlength: [2, 'Category name must be at least 2 characters long'],
    maxlength: [50, 'Category name cannot exceed 50 characters'],
  },
  color: {
    type: String,
    required: [true, 'Color is required'],
    match: [/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color code'],
  },
  monthlyBudget: {
    type: Number,
    default: 0,
    min: [0, 'Budget cannot be negative'],
    validate: {
      validator: Number.isFinite,
      message: 'Budget must be a valid number',
    },
  },
  icon: {
    type: String,
    default: 'default',
    trim: true,
    maxlength: [30, 'Icon name cannot exceed 30 characters'],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
  description: {
    type: String,
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters'],
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters'],
  }],
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Compound index for unique category names per user
categorySchema.index({ userId: 1, name: 1 }, { unique: true });
categorySchema.index({ userId: 1, isActive: 1 });
categorySchema.index({ userId: 1, createdAt: -1 });

// Virtual for expense count
categorySchema.virtual('expenseCount', {
  ref: 'Expense',
  localField: '_id',
  foreignField: 'categoryId',
  count: true,
  match: { isActive: true },
});

// Virtual for total spent
categorySchema.virtual('totalSpent', {
  ref: 'Expense',
  localField: '_id',
  foreignField: 'categoryId',
  match: { isActive: true },
  aggregate: [
    { $group: { _id: null, total: { $sum: '$amount' } } },
    { $project: { _id: 0, value: '$total' } },
  ],
});

// Virtual for spent this month
categorySchema.virtual('spentThisMonth', {
  ref: 'Expense',
  localField: '_id',
  foreignField: 'categoryId',
  match: {
    isActive: true,
    date: {
      $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    }
  },
  aggregate: [
    { $group: { _id: null, total: { $sum: '$amount' } } },
    { $project: { _id: 0, value: '$total' } },
  ],
});

// Virtual for budget remaining
categorySchema.virtual('budgetRemaining').get(function () {
  const spent = this.spentThisMonth || 0;
  return Math.max(0, this.monthlyBudget - spent);
});

// Virtual for budget percentage used
categorySchema.virtual('budgetPercentage').get(function () {
  if (this.monthlyBudget === 0) return 0;
  const spent = this.spentThisMonth || 0;
  return Math.min(100, (spent / this.monthlyBudget) * 100);
});

// Virtual for is over budget
categorySchema.virtual('isOverBudget').get(function () {
  return (this.spentThisMonth || 0) > this.monthlyBudget;
});

// Pre-save middleware
categorySchema.pre('save', function (next) {
  // Ensure category name is properly formatted
  this.name = this.name.trim();

  // Ensure color is uppercase
  if (this.color) {
    this.color = this.color.toUpperCase();
  }

  next();
});

// Pre-remove middleware to prevent deletion of categories with expenses
categorySchema.pre('deleteOne', { document: true, query: false }, async function (next) {
  try {
    const Expense = mongoose.model('Expense');
    const expenseCount = await Expense.countDocuments({ categoryId: this._id });

    if (expenseCount > 0) {
      const error = new Error('Cannot delete category with existing expenses');
      error.name = 'ValidationError';
      return next(error);
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Static methods
categorySchema.statics.findByUser = function (userId) {
  return this.find({ userId, isActive: true }).sort({ createdAt: 1 });
};

categorySchema.statics.findWithExpenses = function (userId) {
  return this.find({ userId, isActive: true })
    .populate('expenseCount')
    .populate('totalSpent')
    .sort({ createdAt: 1 });
};

categorySchema.statics.findWithMonthlySpending = function (userId) {
  return this.find({ userId, isActive: true })
    .populate('spentThisMonth')
    .sort({ createdAt: 1 });
};

// Instance methods
categorySchema.methods.getMonthlyStats = async function (year, month) {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);

  const Expense = mongoose.model('Expense');

  const stats = await Expense.aggregate([
    {
      $match: {
        categoryId: this._id,
        userId: this.userId,
        isActive: true,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        expenseCount: { $sum: 1 },
        averageAmount: { $avg: '$amount' },
        minAmount: { $min: '$amount' },
        maxAmount: { $max: '$amount' },
      },
    },
    {
      $project: {
        _id: 0,
        totalAmount: 1,
        expenseCount: 1,
        averageAmount: 1,
        minAmount: 1,
        maxAmount: 1,
        budgetStatus: {
          $let: {
            vars: { spent: '$totalAmount' },
            in: {
              overBudget: { $gt: ['$$spent', this.monthlyBudget] },
              percentage: {
                $cond: [
                  { $eq: [this.monthlyBudget, 0] },
                  0,
                  { $multiply: [{ $divide: ['$$spent', this.monthlyBudget] }, 100] },
                ],
              },
            },
          },
        },
      },
    },
  ]);

  return stats[0] || {
    totalAmount: 0,
    expenseCount: 0,
    averageAmount: 0,
    minAmount: 0,
    maxAmount: 0,
    budgetStatus: { overBudget: false, percentage: 0 },
  };
};

categorySchema.methods.getSpendingTrend = async function (months = 6) {
  const Expense = mongoose.model('Expense');
  const currentDate = new Date();
  const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - months + 1, 1);

  const trend = await Expense.aggregate([
    {
      $match: {
        categoryId: this._id,
        userId: this.userId,
        isActive: true,
        date: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' },
        },
        totalAmount: { $sum: '$amount' },
        expenseCount: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 },
    },
    {
      $project: {
        month: {
          $dateFromParts: {
            year: '$_id.year',
            month: { $add: ['$_id.month', 1] },
            day: 1,
          },
        },
        totalAmount: 1,
        expenseCount: 1,
        _id: 0,
      },
    },
  ]);

  return trend;
};

categorySchema.methods.toJSON = function () {
  const categoryObject = this.toObject();
  delete categoryObject.__v;
  return categoryObject;
};

module.exports = mongoose.model('Category', categorySchema);