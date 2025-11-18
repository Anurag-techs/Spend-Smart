const express = require('express');
const { authenticate } = require('../middleware/auth');
const { handleValidationErrors, validationChains } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Import controllers
const {
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
} = require('../controllers/goalsController');

/**
 * @route   GET /api/goals
 * @desc    Get all goals for user
 * @access  Private
 */
router.get('/',
  authenticate,
  handleValidationErrors,
  asyncHandler(getGoals)
);

/**
 * @route   GET /api/goals/stats
 * @desc    Get goal statistics
 * @access  Private
 */
router.get('/stats',
  authenticate,
  asyncHandler(getGoalStats)
);

/**
 * @route   GET /api/goals/active
 * @desc    Get active goals with progress
 * @access  Private
 */
router.get('/active',
  authenticate,
  asyncHandler(getActiveGoals)
);

/**
 * @route   GET /api/goals/completed
 * @desc    Get completed goals
 * @access  Private
 */
router.get('/completed',
  authenticate,
  asyncHandler(getCompletedGoals)
);

/**
 * @route   GET /api/goals/overdue
 * @desc    Get overdue goals
 * @access  Private
 */
router.get('/overdue',
  authenticate,
  asyncHandler(getOverdueGoals)
);

/**
 * @route   GET /api/goals/:id
 * @desc    Get single goal
 * @access  Private
 */
router.get('/:id',
  authenticate,
  validationChains.mongoId,
  handleValidationErrors,
  asyncHandler(getGoal)
);

/**
 * @route   POST /api/goals
 * @desc    Create a new goal
 * @access  Private
 */
router.post('/',
  authenticate,
  validationChains.createGoal,
  handleValidationErrors,
  asyncHandler(createGoal)
);

/**
 * @route   PUT /api/goals/:id
 * @desc    Update a goal
 * @access  Private
 */
router.put('/:id',
  authenticate,
  validationChains.mongoId,
  validationChains.updateGoal,
  handleValidationErrors,
  asyncHandler(updateGoal)
);

/**
 * @route   DELETE /api/goals/:id
 * @desc    Delete a goal
 * @access  Private
 */
router.delete('/:id',
  authenticate,
  validationChains.mongoId,
  handleValidationErrors,
  asyncHandler(deleteGoal)
);

/**
 * @route   POST /api/goals/:id/add-savings
 * @desc    Add savings to a goal
 * @access  Private
 */
router.post('/:id/add-savings',
  authenticate,
  validationChains.mongoId,
  handleValidationErrors,
  asyncHandler(addSavings)
);

/**
 * @route   POST /api/goals/:id/withdraw-savings
 * @desc    Withdraw savings from a goal
 * @access  Private
 */
router.post('/:id/withdraw-savings',
  authenticate,
  validationChains.mongoId,
  handleValidationErrors,
  asyncHandler(withdrawSavings)
);

/**
 * @route   POST /api/goals/:id/complete
 * @desc    Mark goal as completed
 * @access  Private
 */
router.post('/:id/complete',
  authenticate,
  validationChains.mongoId,
  handleValidationErrors,
  asyncHandler(completeGoal)
);

/**
 * @route   POST /api/goals/:id/extend-deadline
 * @desc    Extend goal deadline
 * @access  Private
 */
router.post('/:id/extend-deadline',
  authenticate,
  validationChains.mongoId,
  handleValidationErrors,
  asyncHandler(extendDeadline)
);

/**
 * @route   POST /api/goals/:id/milestones
 * @desc    Add milestone to goal
 * @access  Private
 */
router.post('/:id/milestones',
  authenticate,
  validationChains.mongoId,
  handleValidationErrors,
  asyncHandler(addMilestone)
);

module.exports = router;