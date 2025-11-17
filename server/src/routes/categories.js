const express = require('express');
const { authenticate } = require('../middleware/auth');
const { handleValidationErrors, validationChains } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Import controllers
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryStats,
  getBudgetStatus,
  createDefaultCategories,
} = require('../controllers/categoryController');

/**
 * @route   GET /api/categories
 * @desc    Get all categories for user
 * @access  Private
 */
router.get('/',
  authenticate,
  asyncHandler(getCategories)
);

/**
 * @route   GET /api/categories/budget-status
 * @desc    Get categories with budget status
 * @access  Private
 */
router.get('/budget-status',
  authenticate,
  asyncHandler(getBudgetStatus)
);

/**
 * @route   POST /api/categories/defaults
 * @desc    Create default categories for user
 * @access  Private
 */
router.post('/defaults',
  authenticate,
  asyncHandler(createDefaultCategories)
);

/**
 * @route   GET /api/categories/:id
 * @desc    Get single category
 * @access  Private
 */
router.get('/:id',
  authenticate,
  validationChains.mongoId,
  handleValidationErrors,
  asyncHandler(getCategory)
);

/**
 * @route   GET /api/categories/:id/stats
 * @desc    Get category statistics
 * @access  Private
 */
router.get('/:id/stats',
  authenticate,
  validationChains.mongoId,
  handleValidationErrors,
  asyncHandler(getCategoryStats)
);

/**
 * @route   POST /api/categories
 * @desc    Create a new category
 * @access  Private
 */
router.post('/',
  authenticate,
  validationChains.createCategory,
  handleValidationErrors,
  asyncHandler(createCategory)
);

/**
 * @route   PUT /api/categories/:id
 * @desc    Update a category
 * @access  Private
 */
router.put('/:id',
  authenticate,
  validationChains.mongoId,
  validationChains.updateCategory,
  handleValidationErrors,
  asyncHandler(updateCategory)
);

/**
 * @route   DELETE /api/categories/:id
 * @desc    Delete a category
 * @access  Private
 */
router.delete('/:id',
  authenticate,
  validationChains.mongoId,
  handleValidationErrors,
  asyncHandler(deleteCategory)
);

module.exports = router;