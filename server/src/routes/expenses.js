const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const { handleValidationErrors, validationChains } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Configure multer for CSV uploads
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1,
  },
});

// Import controllers
const {
  getExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  uploadCSV,
  getExpenseStats,
  getTrends,
  getCategoryBreakdown,
} = require('../controllers/expenseController');

/**
 * @route   GET /api/expenses
 * @desc    Get all expenses for user with filtering and pagination
 * @access  Private
 */
router.get('/',
  authenticate,
  validationChains.getExpenses,
  handleValidationErrors,
  asyncHandler(getExpenses)
);

/**
 * @route   GET /api/expenses/stats
 * @desc    Get expense statistics
 * @access  Private
 */
router.get('/stats',
  authenticate,
  handleValidationErrors,
  asyncHandler(getExpenseStats)
);

/**
 * @route   GET /api/expenses/trends
 * @desc    Get daily spending trends
 * @access  Private
 */
router.get('/trends',
  authenticate,
  handleValidationErrors,
  asyncHandler(getTrends)
);

/**
 * @route   GET /api/expenses/category-breakdown
 * @desc    Get category breakdown
 * @access  Private
 */
router.get('/category-breakdown',
  authenticate,
  handleValidationErrors,
  asyncHandler(getCategoryBreakdown)
);

/**
 * @route   POST /api/expenses/upload-csv
 * @desc    Bulk upload expenses from CSV
 * @access  Private
 */
router.post('/upload-csv',
  authenticate,
  upload.single('file'),
  asyncHandler(uploadCSV)
);

/**
 * @route   GET /api/expenses/:id
 * @desc    Get single expense
 * @access  Private
 */
router.get('/:id',
  authenticate,
  validationChains.mongoId,
  handleValidationErrors,
  asyncHandler(getExpense)
);

/**
 * @route   POST /api/expenses
 * @desc    Create a new expense
 * @access  Private
 */
router.post('/',
  authenticate,
  validationChains.createExpense,
  handleValidationErrors,
  asyncHandler(createExpense)
);

/**
 * @route   PUT /api/expenses/:id
 * @desc    Update an expense
 * @access  Private
 */
router.put('/:id',
  authenticate,
  validationChains.mongoId,
  validationChains.updateExpense,
  handleValidationErrors,
  asyncHandler(updateExpense)
);

/**
 * @route   DELETE /api/expenses/:id
 * @desc    Delete an expense
 * @access  Private
 */
router.delete('/:id',
  authenticate,
  validationChains.mongoId,
  handleValidationErrors,
  asyncHandler(deleteExpense)
);

module.exports = router;