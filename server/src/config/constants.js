// Application constants

// Badge types
const BADGE_TYPES = {
  FIRST_EXPENSE: 'first_expense',
  WEEK_STREAK: 'week_streak',
  MONTH_STREAK: 'month_streak',
  BUDGET_HERO: 'budget_hero',
  SAVER_LEVEL1: 'saver_level1',
  SAVER_LEVEL2: 'saver_level2',
  SAVER_LEVEL3: 'saver_level3',
  DATA_EXPORTER: 'data_exporter',
  CATEGORY_MASTER: 'category_master',
  GOAL_SETTER: 'goal_setter',
  GOAL_ACHIEVER: 'goal_achiever',
};

// Payment methods
const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card',
  UPI: 'upi',
  NETBANKING: 'netbanking',
  WALLET: 'wallet',
  OTHER: 'other',
};

// Categories for goals
const GOAL_CATEGORIES = {
  EMERGENCY: 'emergency',
  VACATION: 'vacation',
  GADGET: 'gadget',
  EDUCATION: 'education',
  HEALTH: 'health',
  OTHER: 'other',
};

// Currency codes
const CURRENCIES = {
  INR: 'INR',
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
};

// Timezones (common ones)
const TIMEZONES = {
  ASIA_KOLKATA: 'Asia/Kolkata',
  AMERICA_NEW_YORK: 'America/New_York',
  EUROPE_LONDON: 'Europe/London',
  UTC: 'UTC',
};

// Export formats
const EXPORT_FORMATS = {
  CSV: 'csv',
  PDF: 'pdf',
  JSON: 'json',
};

// Dashboard ranges
const DASHBOARD_RANGES = {
  SEVEN_DAYS: 7,
  THIRTY_DAYS: 30,
  NINETY_DAYS: 90,
};

// Pagination defaults
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

// File upload limits
const UPLOAD = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ],
};

// Validation messages
const VALIDATION_MESSAGES = {
  REQUIRED: 'This field is required',
  EMAIL_INVALID: 'Please provide a valid email address',
  PASSWORD_MIN: 'Password must be at least 8 characters long',
  PASSWORD_STRENGTH: 'Password must contain at least one letter and one number',
  NAME_LENGTH: 'Name must be between 2 and 100 characters',
  CATEGORY_NAME_LENGTH: 'Category name must be between 2 and 50 characters',
  NOTE_MAX_LENGTH: 'Note cannot exceed 200 characters',
  AMOUNT_MIN: 'Amount must be greater than 0',
  DATE_INVALID: 'Please provide a valid date',
  DATE_FUTURE: 'Date cannot be in the future',
};

// API response messages
const RESPONSE_MESSAGES = {
  // Success messages
  REGISTER_SUCCESS: 'User registered successfully',
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  CATEGORY_CREATED: 'Category created successfully',
  CATEGORY_UPDATED: 'Category updated successfully',
  CATEGORY_DELETED: 'Category deleted successfully',
  EXPENSE_CREATED: 'Expense created successfully',
  EXPENSE_UPDATED: 'Expense updated successfully',
  EXPENSE_DELETED: 'Expense deleted successfully',
  GOAL_CREATED: 'Goal created successfully',
  GOAL_UPDATED: 'Goal updated successfully',
  GOAL_DELETED: 'Goal deleted successfully',
  FILE_UPLOADED: 'File uploaded successfully',
  CSV_IMPORTED: 'CSV data imported successfully',

  // Error messages
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  NOT_FOUND: 'Resource not found',
  VALIDATION_ERROR: 'Validation failed',
  DUPLICATE_EMAIL: 'Email already exists',
  INVALID_CREDENTIALS: 'Invalid email or password',
  CATEGORY_HAS_EXPENSES: 'Cannot delete category with existing expenses',
  INVALID_FILE_TYPE: 'Invalid file type',
  FILE_TOO_LARGE: 'File size exceeds maximum limit',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  SERVER_ERROR: 'Internal server error',
};

// Nudge types and priorities
const NUDGE_TYPES = {
  WEEKEND_SPENDING: 'weekend_spending',
  BUDGET_OVERAGE: 'budget_overage',
  SPENDING_TREND: 'spending_trend',
  STREAK_CELEBRATION: 'streak_celebration',
  CATEGORY_PATTERN: 'category_pattern',
  SAVINGS_MILESTONE: 'savings_milestone',
};

const NUDGE_PRIORITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

// Default categories for new users
const DEFAULT_CATEGORIES = [
  { name: 'Food', color: '#FF6B6B', icon: 'food', monthlyBudget: 5000 },
  { name: 'Transport', color: '#4ECDC4', icon: 'transport', monthlyBudget: 3000 },
  { name: 'Shopping', color: '#45B7D1', icon: 'shopping', monthlyBudget: 4000 },
  { name: 'Entertainment', color: '#96CEB4', icon: 'entertainment', monthlyBudget: 2000 },
  { name: 'Bills', color: '#FECA57', icon: 'bills', monthlyBudget: 8000 },
  { name: 'Healthcare', color: '#DDA0DD', icon: 'health', monthlyBudget: 3000 },
];

module.exports = {
  BADGE_TYPES,
  PAYMENT_METHODS,
  GOAL_CATEGORIES,
  CURRENCIES,
  TIMEZONES,
  EXPORT_FORMATS,
  DASHBOARD_RANGES,
  PAGINATION,
  UPLOAD,
  VALIDATION_MESSAGES,
  RESPONSE_MESSAGES,
  NUDGE_TYPES,
  NUDGE_PRIORITY,
  DEFAULT_CATEGORIES,
};