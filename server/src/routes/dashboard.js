const express = require('express');
const { authenticate } = require('../middleware/auth');
const { handleValidationErrors, validationChains } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Import controllers
const {
  getSummary,
  getTrends,
  getBudgetComparison,
  getMonthlyComparison,
  getPaymentMethodBreakdown,
  getSpendingHeatmap,
} = require('../controllers/dashboardController');

/**
 * @route   GET /api/dashboard/summary
 * @desc    Get dashboard summary statistics
 * @access  Private
 */
router.get('/summary',
  authenticate,
  validationChains.dashboardSummary,
  handleValidationErrors,
  asyncHandler(getSummary)
);

/**
 * @route   GET /api/dashboard/trends
 * @desc    Get spending trends for charts
 * @access  Private
 */
router.get('/trends',
  authenticate,
  handleValidationErrors,
  asyncHandler(getTrends)
);

/**
 * @route   GET /api/dashboard/budget-comparison
 * @desc    Get budget vs actual spending comparison
 * @access  Private
 */
router.get('/budget-comparison',
  authenticate,
  handleValidationErrors,
  asyncHandler(getBudgetComparison)
);

/**
 * @route   GET /api/dashboard/monthly-comparison
 * @desc    Get monthly spending comparison
 * @access  Private
 */
router.get('/monthly-comparison',
  authenticate,
  handleValidationErrors,
  asyncHandler(getMonthlyComparison)
);

/**
 * @route   GET /api/dashboard/payment-breakdown
 * @desc    Get expense breakdown by payment method
 * @access  Private
 */
router.get('/payment-breakdown',
  authenticate,
  handleValidationErrors,
  asyncHandler(getPaymentMethodBreakdown)
);

/**
 * @route   GET /api/dashboard/spending-heatmap
 * @desc    Get spending heatmap data
 * @access  Private
 */
router.get('/spending-heatmap',
  authenticate,
  handleValidationErrors,
  asyncHandler(getSpendingHeatmap)
);

module.exports = router;