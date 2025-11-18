const mongoose = require('mongoose');
const { GOAL_CATEGORIES } = require('../config/constants');

const goalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  title: {
    type: String,
    required: [true, 'Goal title is required'],
    trim: true,
    minlength: [2, 'Goal title must be at least 2 characters long'],
    maxlength: [100, 'Goal title cannot exceed 100 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [300, 'Description cannot exceed 300 characters'],
    default: '',
  },
  targetAmount: {
    type: Number,
    required: [true, 'Target amount is required'],
    min: [1, 'Target amount must be greater than 0'],
    validate: {
      validator: Number.isFinite,
      message: 'Target amount must be a valid number',
    },
  },
  savedAmount: {
    type: Number,
    default: 0,
    min: [0, 'Saved amount cannot be negative'],
    validate: {
      validator: function (value) {
        return value <= this.targetAmount;
      },
      message: 'Saved amount cannot exceed target amount',
    },
  },
  startDate: {
    type: Date,
    default: Date.now,
    validate: {
      validator: function (value) {
        return !value || value <= new Date();
      },
      message: 'Start date cannot be in the future',
    },
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    validate: {
      validator: function (value) {
        return !this.startDate || value > this.startDate;
      },
      message: 'End date must be after start date',
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  category: {
    type: String,
    enum: Object.values(GOAL_CATEGORIES),
    default: GOAL_CATEGORIES.OTHER,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  autoSave: {
    enabled: {
      type: Boolean,
      default: false,
    },
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'monthly',
    },
  },
  reminders: {
    enabled: {
      type: Boolean,
      default: true,
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'weekly',
    },
    lastReminderDate: {
      type: Date,
      default: null,
    },
  },
  milestones: [{
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    achieved: {
      type: Boolean,
      default: false,
    },
    achievedDate: {
      type: Date,
      default: null,
    },
    reward: {
      type: String,
      trim: true,
      maxlength: [100, 'Reward description cannot exceed 100 characters'],
    },
  }],
  metadata: {
    isPrivate: {
      type: Boolean,
      default: true,
    },
    sharedWith: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      permission: {
        type: String,
        enum: ['view', 'edit'],
        default: 'view',
      },
    }],
    tags: [{
      type: String,
      trim: true,
      maxlength: [30, 'Tag cannot exceed 30 characters'],
    }],
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for performance
goalSchema.index({ userId: 1, isActive: 1 });
goalSchema.index({ userId: 1, endDate: 1 });
goalSchema.index({ userId: 1, category: 1 });
goalSchema.index({ isActive: 1, endDate: 1 });

// Virtuals
goalSchema.virtual('remainingAmount').get(function () {
  return Math.max(0, this.targetAmount - this.savedAmount);
});

goalSchema.virtual('percentage').get(function () {
  if (this.targetAmount === 0) return 0;
  return Math.min(100, (this.savedAmount / this.targetAmount) * 100);
});

goalSchema.virtual('daysLeft').get(function () {
  const now = new Date();
  const endDate = new Date(this.endDate);
  const diffTime = endDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

goalSchema.virtual('isCompleted').get(function () {
  return this.savedAmount >= this.targetAmount;
});

goalSchema.virtual('isOverdue').get(function () {
  return !this.isCompleted && new Date() > new Date(this.endDate);
});

goalSchema.virtual('monthlyRequired').get(function () {
  const now = new Date();
  const endDate = new Date(this.endDate);
  const remainingMonths = Math.max(1, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24 * 30)));
  return this.remainingAmount / remainingMonths;
});

goalSchema.virtual('weeklyRequired').get(function () {
  const now = new Date();
  const endDate = new Date(this.endDate);
  const remainingWeeks = Math.max(1, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24 * 7)));
  return this.remainingAmount / remainingWeeks;
});

goalSchema.virtual('dailyRequired').get(function () {
  const daysLeft = this.daysLeft;
  return daysLeft > 0 ? this.remainingAmount / daysLeft : 0;
});

// Virtual for formatted amounts
goalSchema.virtual('formattedTargetAmount').get(function () {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(this.targetAmount);
});

goalSchema.virtual('formattedSavedAmount').get(function () {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(this.savedAmount);
});

goalSchema.virtual('formattedRemainingAmount').get(function () {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(this.remainingAmount);
});

// Pre-save middleware
goalSchema.pre('save', function (next) {
  // Clean up data
  if (this.metadata.tags) {
    this.metadata.tags = this.metadata.tags.filter(tag => tag && tag.trim());
  }

  // Check for milestone achievements
  if (this.isModified('savedAmount') && this.milestones.length > 0) {
    this.milestones.forEach(milestone => {
      if (!milestone.achieved && this.savedAmount >= milestone.amount) {
        milestone.achieved = true;
        milestone.achievedDate = new Date();
      }
    });
  }

  // Auto-deactivate if completed
  if (this.isCompleted && this.isActive) {
    this.isActive = false;
  }

  next();
});

// Static methods
goalSchema.statics.findByUser = function (userId, options = {}) {
  const query = { userId };

  if (options.activeOnly) {
    query.isActive = true;
  }

  if (options.category) {
    query.category = options.category;
  }

  if (options.priority) {
    query.priority = options.priority;
  }

  return this.find(query)
    .sort({ priority: -1, endDate: 1, createdAt: -1 });
};

goalSchema.statics.getActiveGoals = function (userId) {
  return this.find({
    userId,
    isActive: true,
    endDate: { $gt: new Date() },
  }).sort({ priority: -1, endDate: 1 });
};

goalSchema.statics.getCompletedGoals = function (userId) {
  return this.find({
    userId,
    $or: [
      { isActive: false, savedAmount: { $gte: { $expr: { $eq: ['$targetAmount', '$savedAmount'] } } } },
      { savedAmount: { $gte: { $expr: ['$targetAmount', '$savedAmount'] } } },
    ],
  }).sort({ updatedAt: -1 });
};

goalSchema.statics.getOverdueGoals = function (userId) {
  return this.find({
    userId,
    isActive: true,
    endDate: { $lt: new Date() },
    savedAmount: { $lt: { $expr: ['$targetAmount'] } },
  }).sort({ endDate: 1 });
};

goalSchema.statics.getUserGoalStats = function (userId) {
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $group: {
        _id: null,
        totalGoals: { $sum: 1 },
        activeGoals: {
          $sum: { $cond: ['$isActive', 1, 0] },
        },
        completedGoals: {
          $sum: {
            $cond: [
              { $gte: ['$savedAmount', '$targetAmount'] },
              1,
              0,
            ],
          },
        },
        totalTargetAmount: { $sum: '$targetAmount' },
        totalSavedAmount: { $sum: '$savedAmount' },
        totalRemainingAmount: {
          $sum: { $subtract: ['$targetAmount', '$savedAmount'] },
        },
      },
    },
  ]);
};

// Instance methods
goalSchema.methods.addSavings = function (amount) {
  const newAmount = this.savedAmount + amount;
  if (newAmount > this.targetAmount) {
    throw new Error('Savings amount would exceed target amount');
  }

  this.savedAmount = newAmount;
  return this.save();
};

goalSchema.methods.withdrawSavings = function (amount) {
  const newAmount = this.savedAmount - amount;
  if (newAmount < 0) {
    throw new Error('Withdrawal amount exceeds saved amount');
  }

  this.savedAmount = newAmount;
  return this.save();
};

goalSchema.methods.markCompleted = function () {
  this.savedAmount = this.targetAmount;
  this.isActive = false;
  return this.save();
};

goalSchema.methods.extendDeadline = function (days) {
  const newEndDate = new Date(this.endDate);
  newEndDate.setDate(newEndDate.getDate() + days);
  this.endDate = newEndDate;
  return this.save();
};

goalSchema.methods.addMilestone = function (amount, reward) {
  this.milestones.push({
    amount,
    reward,
    achieved: false,
    achievedDate: null,
  });
  return this.save();
};

goalSchema.methods.getProgressHistory = async function () {
  // This would ideally connect to a savings/deposit history
  // For now, returning current status
  return {
    currentAmount: this.savedAmount,
    percentage: this.percentage,
    milestones: this.milestones,
    isCompleted: this.isCompleted,
  };
};

goalSchema.methods.updateReminders = function () {
  this.reminders.lastReminderDate = new Date();
  return this.save({ validateBeforeSave: false });
};

goalSchema.methods.toJSON = function () {
  const goalObject = this.toObject();
  delete goalObject.__v;
  return goalObject;
};

module.exports = mongoose.model('Goal', goalSchema);