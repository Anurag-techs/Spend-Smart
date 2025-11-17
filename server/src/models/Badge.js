const mongoose = require('mongoose');
const { BADGE_TYPES } = require('../config/constants');

// Badge definitions
const BADGE_DEFINITIONS = {
  [BADGE_TYPES.FIRST_EXPENSE]: {
    title: 'First Step',
    description: 'Added your first expense',
    icon: '🎯',
    category: 'milestone',
    points: 10,
  },
  [BADGE_TYPES.WEEK_STREAK]: {
    title: 'Week Warrior',
    description: 'Maintained a 7-day tracking streak',
    icon: '🔥',
    category: 'consistency',
    points: 50,
  },
  [BADGE_TYPES.MONTH_STREAK]: {
    title: 'Monthly Master',
    description: 'Maintained a 30-day tracking streak',
    icon: '💎',
    category: 'consistency',
    points: 200,
  },
  [BADGE_TYPES.BUDGET_HERO]: {
    title: 'Budget Hero',
    description: 'Stayed within budget for all categories',
    icon: '🦸‍♂️',
    category: 'discipline',
    points: 100,
  },
  [BADGE_TYPES.SAVER_LEVEL1]: {
    title: 'Saver Level 1',
    description: 'Saved your first ₹1000',
    icon: '💰',
    category: 'savings',
    points: 25,
  },
  [BADGE_TYPES.SAVER_LEVEL2]: {
    title: 'Saver Level 2',
    description: 'Saved your first ₹10,000',
    icon: '💎',
    category: 'savings',
    points: 100,
  },
  [BADGE_TYPES.SAVER_LEVEL3]: {
    title: 'Saver Level 3',
    description: 'Saved your first ₹50,000',
    icon: '🏆',
    category: 'savings',
    points: 500,
  },
  [BADGE_TYPES.DATA_EXPORTER]: {
    title: 'Data Exporter',
    description: 'Exported your expense data',
    icon: '📊',
    category: 'utility',
    points: 15,
  },
  [BADGE_TYPES.CATEGORY_MASTER]: {
    title: 'Category Master',
    description: 'Created 5 or more categories',
    icon: '🏷️',
    category: 'organization',
    points: 30,
  },
  [BADGE_TYPES.GOAL_SETTER]: {
    title: 'Goal Setter',
    description: 'Created your first savings goal',
    icon: '🎯',
    category: 'planning',
    points: 40,
  },
  [BADGE_TYPES.GOAL_ACHIEVER]: {
    title: 'Goal Achiever',
    description: 'Completed your first savings goal',
    icon: '🎉',
    category: 'achievement',
    points: 150,
  },
};

const badgeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  type: {
    type: String,
    required: [true, 'Badge type is required'],
    enum: Object.values(BADGE_TYPES),
    index: true,
  },
  title: {
    type: String,
    required: [true, 'Badge title is required'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Badge description is required'],
    trim: true,
  },
  icon: {
    type: String,
    required: [true, 'Badge icon is required'],
    trim: true,
  },
  category: {
    type: String,
    required: true,
    enum: ['milestone', 'consistency', 'discipline', 'savings', 'utility', 'organization', 'planning', 'achievement'],
  },
  points: {
    type: Number,
    required: true,
    min: 0,
  },
  earnedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  meta: {
    type: Object,
    default: {},
  },
  isDisplayed: {
    type: Boolean,
    default: true,
  },
  rarity: {
    type: String,
    enum: ['common', 'rare', 'epic', 'legendary'],
    default: 'common',
  },
  level: {
    type: Number,
    default: 1,
    min: 1,
  },
  progress: {
    current: {
      type: Number,
      default: 0,
      min: 0,
    },
    target: {
      type: Number,
      default: 1,
      min: 1,
    },
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes
badgeSchema.index({ userId: 1, type: 1 }, { unique: true });
badgeSchema.index({ userId: 1, earnedAt: -1 });
badgeSchema.index({ userId: 1, category: 1 });
badgeSchema.index({ earnedAt: -1 });

// Virtual for formatted earned date
badgeSchema.virtual('formattedEarnedDate').get(function () {
  return this.earnedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
});

// Virtual for days since earned
badgeSchema.virtual('daysSinceEarned').get(function () {
  const now = new Date();
  const diffTime = now - this.earnedAt;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware
badgeSchema.pre('save', function (next) {
  // Update progress percentage
  if (this.progress && this.progress.target > 0) {
    this.progress.percentage = Math.min(100, (this.progress.current / this.progress.target) * 100);
  }

  // Set rarity based on points
  if (this.points >= 500) {
    this.rarity = 'legendary';
  } else if (this.points >= 200) {
    this.rarity = 'epic';
  } else if (this.points >= 100) {
    this.rarity = 'rare';
  } else {
    this.rarity = 'common';
  }

  // Set level based on progress for progressive badges
  if (this.type === BADGE_TYPES.SAVER_LEVEL1 || this.type === BADGE_TYPES.SAVER_LEVEL2 || this.type === BADGE_TYPES.SAVER_LEVEL3) {
    this.level = Math.floor(this.progress.current / this.progress.target) + 1;
  }

  next();
});

// Static methods
badgeSchema.statics.awardBadge = async function (userId, type, meta = {}) {
  try {
    // Check if user already has this badge
    const existingBadge = await this.findOne({ userId, type });
    if (existingBadge) {
      // Update existing badge if it's progressive
      if (meta.progress !== undefined) {
        existingBadge.meta = { ...existingBadge.meta, ...meta };
        if (meta.progress) {
          existingBadge.progress.current = Math.max(existingBadge.progress.current, meta.progress.current);
        }
        return existingBadge.save();
      }
      return existingBadge; // Already awarded
    }

    // Get badge definition
    const definition = BADGE_DEFINITIONS[type];
    if (!definition) {
      throw new Error(`Unknown badge type: ${type}`);
    }

    // Create new badge
    const badge = new this({
      userId,
      type,
      title: definition.title,
      description: definition.description,
      icon: definition.icon,
      category: definition.category,
      points: definition.points,
      meta,
    });

    // Set progress if provided
    if (meta.progress) {
      badge.progress = {
        current: meta.current || 0,
        target: meta.target || 1,
        percentage: 0, // Will be calculated in pre-save
      };
    }

    return badge.save();
  } catch (error) {
    console.error('Error awarding badge:', error);
    throw error;
  }
};

badgeSchema.statics.checkAndAwardBadges = async function (userId, triggers) {
  const awardedBadges = [];

  try {
    // Check first expense badge
    if (triggers.firstExpense) {
      const badge = await this.awardBadge(userId, BADGE_TYPES.FIRST_EXPENSE);
      awardedBadges.push(badge);
    }

    // Check streak badges
    if (triggers.streakDays) {
      if (triggers.streakDays >= 7) {
        const badge = await this.awardBadge(userId, BADGE_TYPES.WEEK_STREAK);
        awardedBadges.push(badge);
      }
      if (triggers.streakDays >= 30) {
        const badge = await this.awardBadge(userId, BADGE_TYPES.MONTH_STREAK);
        awardedBadges.push(badge);
      }
    }

    // Check budget hero badge
    if (triggers.budgetHero) {
      const badge = await this.awardBadge(userId, BADGE_TYPES.BUDGET_HERO);
      awardedBadges.push(badge);
    }

    // Check savings badges
    if (triggers.totalSavings) {
      if (triggers.totalSavings >= 1000) {
        const badge = await this.awardBadge(userId, BADGE_TYPES.SAVER_LEVEL1, {
          progress: { current: triggers.totalSavings, target: 1000 },
        });
        awardedBadges.push(badge);
      }
      if (triggers.totalSavings >= 10000) {
        const badge = await this.awardBadge(userId, BADGE_TYPES.SAVER_LEVEL2, {
          progress: { current: triggers.totalSavings, target: 10000 },
        });
        awardedBadges.push(badge);
      }
      if (triggers.totalSavings >= 50000) {
        const badge = await this.awardBadge(userId, BADGE_TYPES.SAVER_LEVEL3, {
          progress: { current: triggers.totalSavings, target: 50000 },
        });
        awardedBadges.push(badge);
      }
    }

    // Check data exporter badge
    if (triggers.dataExported) {
      const badge = await this.awardBadge(userId, BADGE_TYPES.DATA_EXPORTER);
      awardedBadges.push(badge);
    }

    // Check category master badge
    if (triggers.categoriesCount && triggers.categoriesCount >= 5) {
      const badge = await this.awardBadge(userId, BADGE_TYPES.CATEGORY_MASTER, {
        progress: { current: triggers.categoriesCount, target: 5 },
      });
      awardedBadges.push(badge);
    }

    // Check goal setter badge
    if (triggers.firstGoal) {
      const badge = await this.awardBadge(userId, BADGE_TYPES.GOAL_SETTER);
      awardedBadges.push(badge);
    }

    // Check goal achiever badge
    if (triggers.goalAchieved) {
      const badge = await this.awardBadge(userId, BADGE_TYPES.GOAL_ACHIEVER, {
        goalId: triggers.goalId,
        goalTitle: triggers.goalTitle,
      });
      awardedBadges.push(badge);
    }

    return awardedBadges;
  } catch (error) {
    console.error('Error checking and awarding badges:', error);
    throw error;
  }
};

badgeSchema.statics.findByUser = function (userId, options = {}) {
  const query = { userId, isDisplayed: true };

  if (options.category) {
    query.category = options.category;
  }

  if (options.rarity) {
    query.rarity = options.rarity;
  }

  const sort = {};
  if (options.sortBy) {
    sort[options.sortBy] = options.sortOrder === 'asc' ? 1 : -1;
  } else {
    sort.earnedAt = -1; // Most recent first
  }

  return this.find(query).sort(sort);
};

badgeSchema.statics.getUserBadgeStats = function (userId) {
  return this.aggregate([
    {
      $match: { userId: new mongoose.Types.ObjectId(userId) },
    },
    {
      $group: {
        _id: null,
        totalBadges: { $sum: 1 },
        totalPoints: { $sum: '$points' },
        badgesByCategory: {
          $push: {
            category: '$category',
            count: 1,
          },
        },
        badgesByRarity: {
          $push: {
            rarity: '$rarity',
            count: 1,
          },
        },
        lastEarned: { $max: '$earnedAt' },
      },
    },
    {
      $project: {
        _id: 0,
        totalBadges: 1,
        totalPoints: 1,
        badgesByCategory: {
          $reduce: {
            input: '$badgesByCategory',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [
                    [
                      {
                        k: '$$this.category',
                        v: {
                          $add: [
                            { $ifNull: [{ $getField: { field: '$$this.category', input: '$$value' } }, 0] },
                            1,
                          ],
                        },
                      },
                    ],
                  ],
                },
              ],
            },
          },
        },
        badgesByRarity: {
          $reduce: {
            input: '$badgesByRarity',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [
                    [
                      {
                        k: '$$this.rarity',
                        v: {
                          $add: [
                            { $ifNull: [{ $getField: { field: '$$this.rarity', input: '$$value' } }, 0] },
                            1,
                          ],
                        },
                      },
                    ],
                  ],
                },
              ],
            },
          },
        },
        lastEarned: 1,
      },
    },
  ]);
};

// Instance methods
badgeSchema.methods.updateProgress = function (current, target) {
  this.progress = {
    current: Math.max(this.progress.current, current),
    target,
    percentage: 0, // Will be calculated in pre-save
  };
  return this.save();
};

badgeSchema.methods.hide = function () {
  this.isDisplayed = false;
  return this.save({ validateBeforeSave: false });
};

badgeSchema.methods.show = function () {
  this.isDisplayed = true;
  return this.save({ validateBeforeSave: false });
};

badgeSchema.methods.toJSON = function () {
  const badgeObject = this.toObject();
  delete badgeObject.__v;
  return badgeObject;
};

module.exports = mongoose.model('Badge', badgeSchema);