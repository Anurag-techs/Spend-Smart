const express = require('express');
const { authenticate } = require('../middleware/auth');
const { handleValidationErrors, validationChains } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Import controllers
const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  requestPasswordReset,
  resetPassword,
  deactivateAccount,
  getUserStats,
  logout,
  refreshToken,
} = require('../controllers/authController');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register',
  validationChains.register,
  handleValidationErrors,
  asyncHandler(register)
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login',
  validationChains.login,
  handleValidationErrors,
  asyncHandler(login)
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout',
  authenticate,
  asyncHandler(logout)
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh JWT token
 * @access  Private
 */
router.post('/refresh',
  authenticate,
  asyncHandler(refreshToken)
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile',
  authenticate,
  asyncHandler(getProfile)
);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile',
  authenticate,
  handleValidationErrors,
  asyncHandler(updateProfile)
);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put('/change-password',
  authenticate,
  validationChains.changePassword,
  handleValidationErrors,
  asyncHandler(changePassword)
);

/**
 * @route   POST /api/auth/request-password-reset
 * @desc    Request password reset
 * @access  Public
 */
router.post('/request-password-reset',
  handleValidationErrors,
  asyncHandler(requestPasswordReset)
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password',
  handleValidationErrors,
  asyncHandler(resetPassword)
);

/**
 * @route   DELETE /api/auth/deactivate
 * @desc    Deactivate user account
 * @access  Private
 */
router.delete('/deactivate',
  authenticate,
  handleValidationErrors,
  asyncHandler(deactivateAccount)
);

/**
 * @route   GET /api/auth/stats
 * @desc    Get user statistics
 * @access  Private
 */
router.get('/stats',
  authenticate,
  asyncHandler(getUserStats)
);

module.exports = router;