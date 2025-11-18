const { body, param, query, validationResult } = require('express-validator');
const { VALIDATION_MESSAGES } = require('../config/constants');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value,
    }));

    return res.status(400).json({
      success: false,
      error: VALIDATION_MESSAGES.REQUIRED,
      details: errorMessages,
    });
  }
  next();
};

// Common validation chains
const validationChains = {
  // User validations
  register: [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage(VALIDATION_MESSAGES.EMAIL_INVALID),
    body('password')
      .isLength({ min: 8 })
      .withMessage(VALIDATION_MESSAGES.PASSWORD_MIN)
      .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
      .withMessage(VALIDATION_MESSAGES.PASSWORD_STRENGTH),
  ],

  login: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage(VALIDATION_MESSAGES.EMAIL_INVALID),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],

  changePassword: [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage(VALIDATION_MESSAGES.PASSWORD_MIN)
      .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
      .withMessage(VALIDATION_MESSAGES.PASSWORD_STRENGTH),
  ],

  // Category validations
  createCategory: [
    body('name')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Category name must be between 2 and 50 characters'),
    body('color')
      .matches(/^#[0-9A-F]{6}$/i)
      .withMessage('Color must be a valid hex color code'),
    body('monthlyBudget')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Budget must be a positive number'),
    body('icon')
      .optional()
      .trim()
      .isLength({ max: 30 })
      .withMessage('Icon name cannot exceed 30 characters'),
  ],

  updateCategory: [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Category name must be between 2 and 50 characters'),
    body('color')
      .optional()
      .matches(/^#[0-9A-F]{6}$/i)
      .withMessage('Color must be a valid hex color code'),
    body('monthlyBudget')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Budget must be a positive number'),
    body('icon')
      .optional()
      .trim()
      .isLength({ max: 30 })
      .withMessage('Icon name cannot exceed 30 characters'),
  ],

  // Expense validations
  createExpense: [
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be greater than 0'),
    body('categoryId')
      .isMongoId()
      .withMessage('Invalid category ID'),
    body('date')
      .isISO8601()
      .toDate()
      .withMessage('Invalid date format')
      .custom((value) => {
        if (value > new Date()) {
          throw new Error('Date cannot be in the future');
        }
        return true;
      }),
    body('note')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Note cannot exceed 200 characters'),
    body('paymentMethod')
      .isIn(['cash', 'card', 'upi', 'netbanking', 'wallet', 'other'])
      .withMessage('Invalid payment method'),
    body('receiptUrl')
      .optional()
      .isURL()
      .withMessage('Receipt URL must be a valid URL'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('tags.*')
      .optional()
      .trim()
      .isLength({ max: 30 })
      .withMessage('Each tag cannot exceed 30 characters'),
  ],

  updateExpense: [
    body('amount')
      .optional()
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be greater than 0'),
    body('categoryId')
      .optional()
      .isMongoId()
      .withMessage('Invalid category ID'),
    body('date')
      .optional()
      .isISO8601()
      .toDate()
      .withMessage('Invalid date format')
      .custom((value) => {
        if (value > new Date()) {
          throw new Error('Date cannot be in the future');
        }
        return true;
      }),
    body('note')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Note cannot exceed 200 characters'),
    body('paymentMethod')
      .optional()
      .isIn(['cash', 'card', 'upi', 'netbanking', 'wallet', 'other'])
      .withMessage('Invalid payment method'),
    body('receiptUrl')
      .optional()
      .isURL()
      .withMessage('Receipt URL must be a valid URL'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('tags.*')
      .optional()
      .trim()
      .isLength({ max: 30 })
      .withMessage('Each tag cannot exceed 30 characters'),
  ],

  // Goal validations
  createGoal: [
    body('title')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Goal title must be between 2 and 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 300 })
      .withMessage('Description cannot exceed 300 characters'),
    body('targetAmount')
      .isFloat({ min: 1 })
      .withMessage('Target amount must be greater than 0'),
    body('endDate')
      .isISO8601()
      .toDate()
      .withMessage('Invalid end date format')
      .custom((value, { req }) => {
        if (value <= new Date()) {
          throw new Error('End date must be in the future');
        }
        if (req.body.startDate && value <= new Date(req.body.startDate)) {
          throw new Error('End date must be after start date');
        }
        return true;
      }),
    body('category')
      .optional()
      .isIn(['emergency', 'vacation', 'gadget', 'education', 'health', 'other'])
      .withMessage('Invalid goal category'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high'])
      .withMessage('Invalid priority level'),
  ],

  updateGoal: [
    body('title')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Goal title must be between 2 and 100 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 300 })
      .withMessage('Description cannot exceed 300 characters'),
    body('targetAmount')
      .optional()
      .isFloat({ min: 1 })
      .withMessage('Target amount must be greater than 0'),
    body('savedAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Saved amount cannot be negative'),
    body('endDate')
      .optional()
      .isISO8601()
      .toDate()
      .withMessage('Invalid end date format'),
    body('category')
      .optional()
      .isIn(['emergency', 'vacation', 'gadget', 'education', 'health', 'other'])
      .withMessage('Invalid goal category'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high'])
      .withMessage('Invalid priority level'),
  ],

  // Query parameter validations
  getExpenses: [
    query('start')
      .optional()
      .isISO8601()
      .toDate()
      .withMessage('Invalid start date format'),
    query('end')
      .optional()
      .isISO8601()
      .toDate()
      .withMessage('Invalid end date format')
      .custom((value, { req }) => {
        if (req.query.start && value <= new Date(req.query.start)) {
          throw new Error('End date must be after start date');
        }
        return true;
      }),
    query('categoryId')
      .optional()
      .isMongoId()
      .withMessage('Invalid category ID'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('sortBy')
      .optional()
      .isIn(['date', 'amount', 'createdAt', 'note'])
      .withMessage('Invalid sort field'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc'),
  ],

  // Dashboard validations
  dashboardSummary: [
    query('range')
      .optional()
      .isIn(['7', '30', '90'])
      .withMessage('Range must be 7, 30, or 90 days'),
  ],

  // Export validations
  exportData: [
    query('start')
      .isISO8601()
      .toDate()
      .withMessage('Start date is required and must be valid'),
    query('end')
      .isISO8601()
      .toDate()
      .withMessage('End date is required and must be valid')
      .custom((value, { req }) => {
        if (value <= new Date(req.query.start)) {
          throw new Error('End date must be after start date');
        }
        return true;
      }),
    query('format')
      .isIn(['csv', 'pdf', 'json'])
      .withMessage('Format must be csv, pdf, or json'),
    query('categoryId')
      .optional()
      .isMongoId()
      .withMessage('Invalid category ID'),
  ],

  // MongoDB ID validation
  mongoId: [
    param('id')
      .isMongoId()
      .withMessage('Invalid ID format'),
  ],
};

module.exports = {
  handleValidationErrors,
  validationChains,
};