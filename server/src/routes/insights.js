const express = require('express');
const { authenticate } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Import controllers
const {
  getNudges,
  dismissNudge,
  getSpendingAnalysis,
  getFinancialTips,
  getBudgetHealthScore,
} = require('../controllers/insightController');

/**
 * @route   GET /api/insights/nudges
 * @desc    Get AI-powered spending insights and nudges
 * @access  Private
 */
router.get('/nudges',
  authenticate,
  handleValidationErrors,
  asyncHandler(getNudges)
);

/**
 * @route   POST /api/insights/dismiss-nudge
 * @desc    Dismiss a nudge
 * @access  Private
 */
router.post('/dismiss-nudge',
  authenticate,
  handleValidationErrors,
  asyncHandler(dismissNudge)
);

/**
 * @route   GET /api/insights/spending-analysis
 * @desc    Get spending analysis and recommendations
 * @access  Private
 */
router.get('/spending-analysis',
  authenticate,
  handleValidationErrors,
  asyncHandler(getSpendingAnalysis)
);

/**
 * @route   GET /api/insights/financial-tips
 * @desc    Get personalized financial tips
 * @access  Private
 */
router.get('/financial-tips',
  authenticate,
  handleValidationErrors,
  asyncHandler(getFinancialTips)
);

/**
 * @route   GET /api/insights/budget-health
 * @desc    Get budget health score
 * @access  Private
 */
router.get('/budget-health',
  authenticate,
  handleValidationErrors,
  asyncHandler(getBudgetHealthScore)
);

module.exports = router;