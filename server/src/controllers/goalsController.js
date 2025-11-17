const Goal = require('../models/Goal');
const Badge = require('../models/Badge');
const { BADGE_TYPES } = require('../config/constants');
const { asyncHandler, createNotFoundError } = require('../middleware/errorHandler');
const { RESPONSE_MESSAGES } = require('../config/constants');

/**
 * Get all goals for a user
 */
const getGoals = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { activeOnly = false, category, priority } = req.query;

  const options = {};
  if (activeOnly === 'true') {
    options.activeOnly = true;
  }
  if (category) {
    options.category = category;
  }
  if (priority) {
    options.priority = priority;
  }

  const goals = await Goal.findByUser(userId, options);

  res.status(200).json({
    success: true,
    data: goals,
  });
});

/**
 * Get single goal by ID
 */
const getGoal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const goal = await Goal.findOne({ _id: id, userId });

  if (!goal) {
    throw createNotFoundError('Goal not found');
  }

  // Get progress history
  const progressHistory = await goal.getProgressHistory();

  const goalData = goal.toJSON();
  goalData.progressHistory = progressHistory;

  res.status(200).json({
    success: true,
    data: goalData,
  });
});

/**
 * Create a new goal
 */
const createGoal = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const goalData = {
    ...req.body,
    userId,
  };

  const goal = new Goal(goalData);
  await goal.save();

  // Award goal setter badge if this is the user's first goal
  const goalCount = await Goal.countDocuments({ userId });
  if (goalCount === 1) {
    try {
      await Badge.checkAndAwardBadges(userId, { firstGoal: true });
    } catch (badgeError) {
      console.error('Badge awarding failed:', badgeError);
    }
  }

  res.status(201).json({
    success: true,
    message: RESPONSE_MESSAGES.GOAL_CREATED,
    data: goal,
  });
});

/**
 * Update a goal
 */
const updateGoal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const updateData = req.body;

  const goal = await Goal.findOne({ _id: id, userId });

  if (!goal) {
    throw createNotFoundError('Goal not found');
  }

  Object.assign(goal, updateData);
  await goal.save();

  res.status(200).json({
    success: true,
    message: RESPONSE_MESSAGES.GOAL_UPDATED,
    data: goal,
  });
});

/**
 * Delete a goal
 */
const deleteGoal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const goal = await Goal.findOne({ _id: id, userId });

  if (!goal) {
    throw createNotFoundError('Goal not found');
  }

  await Goal.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: RESPONSE_MESSAGES.GOAL_DELETED,
  });
});

/**
 * Add savings to a goal
 */
const addSavings = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    const error = new Error('Amount must be greater than 0');
    error.statusCode = 400;
    throw error;
  }

  const goal = await Goal.findOne({ _id: id, userId });

  if (!goal) {
    throw createNotFoundError('Goal not found');
  }

  const wasCompleted = goal.isCompleted;

  await goal.addSavings(amount);

  // Check if goal was just completed and award badge
  if (!wasCompleted && goal.isCompleted) {
    try {
      await Badge.checkAndAwardBadges(userId, {
        goalAchieved: true,
        goalId: goal._id,
        goalTitle: goal.title,
      });
    } catch (badgeError) {
      console.error('Badge awarding failed:', badgeError);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Savings added successfully',
    data: goal,
  });
});

/**
 * Withdraw savings from a goal
 */
const withdrawSavings = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    const error = new Error('Amount must be greater than 0');
    error.statusCode = 400;
    throw error;
  }

  const goal = await Goal.findOne({ _id: id, userId });

  if (!goal) {
    throw createNotFoundError('Goal not found');
  }

  await goal.withdrawSavings(amount);

  res.status(200).json({
    success: true,
    message: 'Savings withdrawn successfully',
    data: goal,
  });
});

/**
 * Mark goal as completed
 */
const completeGoal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const goal = await Goal.findOne({ _id: id, userId });

  if (!goal) {
    throw createNotFoundError('Goal not found');
  }

  const wasCompleted = goal.isCompleted;

  await goal.markCompleted();

  // Award completion badge if goal was just completed
  if (!wasCompleted) {
    try {
      await Badge.checkAndAwardBadges(userId, {
        goalAchieved: true,
        goalId: goal._id,
        goalTitle: goal.title,
      });
    } catch (badgeError) {
      console.error('Badge awarding failed:', badgeError);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Goal marked as completed',
    data: goal,
  });
});

/**
 * Extend goal deadline
 */
const extendDeadline = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const { days } = req.body;

  if (!days || days <= 0) {
    const error = new Error('Days must be a positive number');
    error.statusCode = 400;
    throw error;
  }

  const goal = await Goal.findOne({ _id: id, userId });

  if (!goal) {
    throw createNotFoundError('Goal not found');
  }

  await goal.extendDeadline(parseInt(days));

  res.status(200).json({
    success: true,
    message: 'Deadline extended successfully',
    data: goal,
  });
});

/**
 * Get goal statistics
 */
const getGoalStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const stats = await Goal.getUserGoalStats(userId);

  // Get additional stats
  const activeGoals = await Goal.getActiveGoals(userId);
  const completedGoals = await Goal.getCompletedGoals(userId);
  const overdueGoals = await Goal.getOverdueGoals(userId);

  const detailedStats = {
    ...stats[0] || {},
    activeGoalsCount: activeGoals.length,
    completedGoalsCount: completedGoals.length,
    overdueGoalsCount: overdueGoals.length,
    totalSavedAmount: activeGoals.reduce((sum, goal) => sum + goal.savedAmount, 0),
    totalTargetAmount: activeGoals.reduce((sum, goal) => sum + goal.targetAmount, 0),
  };

  res.status(200).json({
    success: true,
    data: detailedStats,
  });
});

/**
 * Get active goals with progress
 */
const getActiveGoals = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const goals = await Goal.getActiveGoals(userId);

  res.status(200).json({
    success: true,
    data: goals,
  });
});

/**
 * Get completed goals
 */
const getCompletedGoals = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const goals = await Goal.getCompletedGoals(userId);

  res.status(200).json({
    success: true,
    data: goals,
  });
});

/**
 * Get overdue goals
 */
const getOverdueGoals = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const goals = await Goal.getOverdueGoals(userId);

  res.status(200).json({
    success: true,
    data: goals,
  });
});

/**
 * Add milestone to goal
 */
const addMilestone = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const { amount, reward } = req.body;

  if (!amount || amount <= 0) {
    const error = new Error('Milestone amount must be greater than 0');
    error.statusCode = 400;
    throw error;
  }

  const goal = await Goal.findOne({ _id: id, userId });

  if (!goal) {
    throw createNotFoundError('Goal not found');
  }

  if (amount > goal.targetAmount) {
    const error = new Error('Milestone amount cannot exceed target amount');
    error.statusCode = 400;
    throw error;
  }

  await goal.addMilestone(amount, reward);

  res.status(200).json({
    success: true,
    message: 'Milestone added successfully',
    data: goal,
  });
});

module.exports = {
  getGoals,
  getGoal,
  createGoal,
  updateGoal,
  deleteGoal,
  addSavings,
  withdrawSavings,
  completeGoal,
  extendDeadline,
  getGoalStats,
  getActiveGoals,
  getCompletedGoals,
  getOverdueGoals,
  addMilestone,
};