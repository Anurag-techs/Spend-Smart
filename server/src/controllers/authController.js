const authService = require('../services/authService');
const { asyncHandler, createValidationError } = require('../middleware/errorHandler');
const { RESPONSE_MESSAGES } = require('../config/constants');

/**
 * Register a new user
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    throw createValidationError('Name, email, and password are required');
  }

  const result = await authService.register({ name, email, password });

  res.status(201).json({
    success: true,
    message: RESPONSE_MESSAGES.REGISTER_SUCCESS,
    data: result,
  });
});

/**
 * Login user
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw createValidationError('Email and password are required');
  }

  const result = await authService.login({ email, password });

  res.status(200).json({
    success: true,
    message: RESPONSE_MESSAGES.LOGIN_SUCCESS,
    data: result,
  });
});

/**
 * Get current user profile
 */
const getProfile = asyncHandler(async (req, res) => {
  const profile = await authService.getProfile(req.user._id);

  res.status(200).json({
    success: true,
    data: profile,
  });
});

/**
 * Update user profile
 */
const updateProfile = asyncHandler(async (req, res) => {
  const result = await authService.updateProfile(req.user._id, req.body);

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: result,
  });
});

/**
 * Change password
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw createValidationError('Current password and new password are required');
  }

  await authService.changePassword(req.user._id, { currentPassword, newPassword });

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
  });
});

/**
 * Request password reset
 */
const requestPasswordReset = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw createValidationError('Email is required');
  }

  await authService.requestPasswordReset(email);

  // Always return success for security
  res.status(200).json({
    success: true,
    message: 'If an account with that email exists, a password reset link has been sent.',
  });
});

/**
 * Reset password with token
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    throw createValidationError('Reset token and new password are required');
  }

  await authService.resetPassword(token, newPassword);

  res.status(200).json({
    success: true,
    message: 'Password reset successfully',
  });
});

/**
 * Deactivate account
 */
const deactivateAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;

  if (!password) {
    throw createValidationError('Password is required to deactivate account');
  }

  // Verify password before deactivation
  await authService.login({
    email: req.user.email,
    password,
  });

  await authService.deactivateAccount(req.user._id);

  res.status(200).json({
    success: true,
    message: 'Account deactivated successfully',
  });
});

/**
 * Get user statistics
 */
const getUserStats = asyncHandler(async (req, res) => {
  const stats = await authService.getUserStats(req.user._id);

  res.status(200).json({
    success: true,
    data: stats,
  });
});

/**
 * Logout user (client-side token invalidation)
 */
const logout = asyncHandler(async (req, res) => {
  // In a stateless JWT setup, logout is handled client-side
  // But we can add token blacklisting if needed in the future
  res.status(200).json({
    success: true,
    message: RESPONSE_MESSAGES.LOGOUT_SUCCESS,
  });
});

/**
 * Refresh token
 */
const refreshToken = asyncHandler(async (req, res) => {
  const user = req.user;
  const token = authService.generateToken(user._id);

  res.status(200).json({
    success: true,
    data: { token, user: user.toJSON() },
  });
});

module.exports = {
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
};