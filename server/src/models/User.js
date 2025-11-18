const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { CURRENCIES, TIMEZONES } = require('../config/constants');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please provide a valid email address',
    ],
  },
  passwordHash: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false, // Don't include password in queries by default
  },
  settings: {
    currency: {
      type: String,
      default: CURRENCIES.INR,
      enum: Object.values(CURRENCIES),
    },
    timezone: {
      type: String,
      default: TIMEZONES.ASIA_KOLKATA,
      enum: Object.values(TIMEZONES),
    },
    theme: {
      type: String,
      default: 'light',
      enum: ['light', 'dark'],
    },
    notifications: {
      email: {
        type: Boolean,
        default: true,
      },
      push: {
        type: Boolean,
        default: true,
      },
      budgetAlerts: {
        type: Boolean,
        default: true,
      },
      weeklyReports: {
        type: Boolean,
        default: false,
      },
    },
  },
  streak: {
    current: {
      type: Number,
      default: 0,
      min: 0,
    },
    longest: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastActiveDate: {
      type: Date,
      default: null,
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  emailVerificationToken: {
    type: String,
    select: false,
  },
  passwordResetToken: {
    type: String,
    select: false,
  },
  passwordResetExpires: {
    type: Date,
    select: false,
  },
  lastLogin: {
    type: Date,
    default: null,
  },
  loginCount: {
    type: Number,
    default: 0,
    min: 0,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for performance
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ createdAt: -1 });
userSchema.index({ isActive: 1 });

// Virtual for total expenses
userSchema.virtual('totalExpenses', {
  ref: 'Expense',
  localField: '_id',
  foreignField: 'userId',
  count: true,
});

// Virtual for total savings in goals
userSchema.virtual('totalSavings', {
  ref: 'Goal',
  localField: '_id',
  foreignField: 'userId',
  match: { isActive: true },
  aggregate: [
    { $group: { _id: null, total: { $sum: '$savedAmount' } } },
    { $project: { _id: 0, value: '$total' } },
  ],
});

// Pre-save middleware to hash password
userSchema.pre('save', async function (next) {
  // Only run this function if password was modified
  if (!this.isModified('passwordHash')) return next();

  // Hash password with cost of 12
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

// Pre-save middleware to update last active date for streak
userSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('lastLogin')) {
    const today = new Date();
    const lastActiveDate = this.streak.lastActiveDate;

    if (lastActiveDate) {
      const daysDiff = Math.floor((today - lastActiveDate) / (1000 * 60 * 60 * 24));

      if (daysDiff === 1) {
        // Consecutive day
        this.streak.current += 1;
        if (this.streak.current > this.streak.longest) {
          this.streak.longest = this.streak.current;
        }
      } else if (daysDiff > 1) {
        // Streak broken
        this.streak.current = 1;
      }
      // If daysDiff === 0, same day, don't update streak
    } else {
      // First time user
      this.streak.current = 1;
      this.streak.longest = 1;
    }

    this.streak.lastActiveDate = today;
  }
  next();
});

// Instance methods
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.passwordHash;
  delete userObject.emailVerificationToken;
  delete userObject.passwordResetToken;
  delete userObject.passwordResetExpires;
  delete userObject.__v;
  return userObject;
};

// Static methods
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findActiveUsers = function () {
  return this.find({ isActive: true });
};

// Method to update login information
userSchema.methods.updateLoginInfo = function () {
  this.lastLogin = new Date();
  this.loginCount += 1;
  return this.save({ validateBeforeSave: false });
};

// Method to get user statistics
userSchema.methods.getStats = async function () {
  const stats = await this.aggregate([
    {
      $match: { _id: this._id },
    },
    {
      $lookup: {
        from: 'expenses',
        localField: '_id',
        foreignField: 'userId',
        as: 'expenses',
      },
    },
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: 'userId',
        as: 'categories',
      },
    },
    {
      $lookup: {
        from: 'goals',
        localField: '_id',
        foreignField: 'userId',
        as: 'goals',
      },
    },
    {
      $lookup: {
        from: 'badges',
        localField: '_id',
        foreignField: 'userId',
        as: 'badges',
      },
    },
    {
      $project: {
        name: 1,
        email: 1,
        settings: 1,
        streak: 1,
        createdAt: 1,
        totalExpenses: { $size: '$expenses' },
        totalCategories: { $size: '$categories' },
        activeGoals: {
          $size: {
            $filter: {
              input: '$goals',
              cond: { $eq: ['$$this.isActive', true] },
            },
          },
        },
        totalBadges: { $size: '$badges' },
      },
    },
  ]);

  return stats[0] || null;
};

module.exports = mongoose.model('User', userSchema);