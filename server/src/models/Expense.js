const mongoose = require('mongoose');
const { CURRENCIES, PAYMENT_METHODS } = require('../config/constants');

const expenseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0'],
    validate: {
      validator: Number.isFinite,
      message: 'Amount must be a valid number',
    },
  },
  currency: {
    type: String,
    default: CURRENCIES.INR,
    enum: Object.values(CURRENCIES),
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required'],
    index: true,
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    validate: {
      validator: function (value) {
        return !value || value <= new Date();
      },
      message: 'Date cannot be in the future',
    },
  },
  note: {
    type: String,
    trim: true,
    maxlength: [200, 'Note cannot exceed 200 characters'],
    default: '',
  },
  paymentMethod: {
    type: String,
    required: [true, 'Payment method is required'],
    enum: Object.values(PAYMENT_METHODS),
  },
  receiptUrl: {
    type: String,
    default: null,
    validate: {
      validator: function (value) {
        return !value || /^https?:\/\/.+/.test(value);
      },
      message: 'Receipt URL must be a valid URL',
    },
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters'],
    lowercase: true,
  }],
  isRecurring: {
    type: Boolean,
    default: false,
  },
  recurringPattern: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    default: null,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      validate: {
        validator: function (value) {
          return !value || (value.length === 2 &&
            value[0] >= -180 && value[0] <= 180 &&
            value[1] >= -90 && value[1] <= 90);
        },
        message: 'Coordinates must be valid longitude, latitude',
      },
    },
    address: {
      type: String,
      trim: true,
      maxlength: [200, 'Address cannot exceed 200 characters'],
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isShared: {
    type: Boolean,
    default: false,
  },
  sharedWith: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  metadata: {
    source: {
      type: String,
      enum: ['manual', 'csv_import', 'api', 'shared'],
      default: 'manual',
    },
    importId: {
      type: String,
      default: null,
    },
    externalId: {
      type: String,
      default: null,
    },
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for performance
expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ userId: 1, categoryId: 1, date: -1 });
expenseSchema.index({ userId: 1, amount: -1 });
expenseSchema.index({ userId: 1, isActive: 1 });
expenseSchema.index({ userId: 1, tags: 1 });
expenseSchema.index({ createdAt: -1 });

// Geospatial index for location-based queries
expenseSchema.index({ location: '2dsphere' });

// Virtual for category info (populated by default)
expenseSchema.virtual('category', {
  ref: 'Category',
  localField: 'categoryId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for formatted amount
expenseSchema.virtual('formattedAmount').get(function () {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: this.currency,
  }).format(this.amount);
});

// Virtual for month/year grouping
expenseSchema.virtual('monthYear').get(function () {
  const date = this.date || this.createdAt;
  return {
    month: date.getMonth(),
    year: date.getFullYear(),
    monthName: date.toLocaleString('default', { month: 'long' }),
    yearMonth: date.toISOString().slice(0, 7), // YYYY-MM format
  };
});

// Virtual for week number
expenseSchema.virtual('weekNumber').get(function () {
  const date = this.date || this.createdAt;
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - startOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
});

// Pre-save middleware
expenseSchema.pre('save', function (next) {
  // Clean up data
  if (this.tags) {
    this.tags = this.tags.filter(tag => tag && tag.trim()).map(tag => tag.toLowerCase().trim());
  }

  // Ensure amount has at most 2 decimal places
  if (this.amount) {
    this.amount = Math.round(this.amount * 100) / 100;
  }

  // Set date to beginning of day if not specified
  if (!this.date) {
    this.date = new Date();
    this.date.setHours(0, 0, 0, 0);
  }

  next();
});

// Pre-find middleware to automatically populate category
expenseSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'category',
    select: 'name color icon',
  });
  next();
});

// Static methods
expenseSchema.statics.findByUser = function (userId, options = {}) {
  const query = { userId, isActive: true };

  if (options.startDate && options.endDate) {
    query.date = {
      $gte: new Date(options.startDate),
      $lte: new Date(options.endDate),
    };
  }

  if (options.categoryId) {
    query.categoryId = options.categoryId;
  }

  if (options.tags && options.tags.length > 0) {
    query.tags = { $in: options.tags };
  }

  if (options.paymentMethods && options.paymentMethods.length > 0) {
    query.paymentMethod = { $in: options.paymentMethods };
  }

  const sort = {};
  const sortBy = options.sortBy || 'date';
  const sortOrder = options.sortOrder || 'desc';
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  const limit = Math.min(options.limit || 20, 100);
  const skip = ((options.page || 1) - 1) * limit;

  return this.find(query)
    .sort(sort)
    .limit(limit)
    .skip(skip);
};

expenseSchema.statics.getUserStats = function (userId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        isActive: true,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        totalExpenses: { $sum: 1 },
        averageAmount: { $avg: '$amount' },
        minAmount: { $min: '$amount' },
        maxAmount: { $max: '$amount' },
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
          categoryName: '$category.name',
          categoryColor: '$category.color',
        },
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { amount: -1 },
    },
  ]);
};

expenseSchema.statics.getDailyTrends = function (userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        isActive: true,
        date: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        },
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.date': 1 },
    },
    {
      $project: {
        date: '$_id.date',
        amount: 1,
        count: 1,
        _id: 0,
      },
    },
  ]);
};

expenseSchema.statics.getCategoryBreakdown = function (userId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
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
          categoryName: '$category.name',
          categoryColor: '$category.color',
        },
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { amount: -1 },
    },
    {
      $project: {
        categoryId: '$_id.categoryId',
        name: '$_id.categoryName',
        color: '$_id.categoryColor',
        amount: 1,
        count: 1,
        _id: 0,
      },
    },
  ]);
};

// Instance methods
expenseSchema.methods.updateCategory = function (newCategoryId) {
  this.categoryId = newCategoryId;
  return this.save();
};

expenseSchema.methods.softDelete = function () {
  this.isActive = false;
  return this.save({ validateBeforeSave: false });
};

expenseSchema.methods.addTag = function (tag) {
  if (!this.tags) this.tags = [];
  const normalizedTag = tag.toLowerCase().trim();
  if (!this.tags.includes(normalizedTag)) {
    this.tags.push(normalizedTag);
  }
  return this.save();
};

expenseSchema.methods.removeTag = function (tag) {
  if (!this.tags) return this;
  const normalizedTag = tag.toLowerCase().trim();
  this.tags = this.tags.filter(t => t !== normalizedTag);
  return this.save();
};

expenseSchema.methods.toJSON = function () {
  const expenseObject = this.toObject();
  delete expenseObject.__v;
  delete expenseObject.isActive;
  return expenseObject;
};

module.exports = mongoose.model('Expense', expenseSchema);