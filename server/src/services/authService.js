const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Badge = require('../models/Badge');
const { BADGE_TYPES, RESPONSE_MESSAGES } = require('../config/constants');

class AuthService {
  /**
   * Generate JWT token for user
   * @param {string} userId - User ID
   * @returns {string} JWT token
   */
  generateToken(userId) {
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {object} Decoded token payload
   */
  verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }

  /**
   * Register a new user
   * @param {object} userData - User registration data
   * @returns {object} User object with token
   */
  async register(userData) {
    const { name, email, password } = userData;

    try {
      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        const error = new Error(RESPONSE_MESSAGES.DUPLICATE_EMAIL);
        error.statusCode = 409;
        throw error;
      }

      // Create new user
      const user = new User({
        name,
        email: email.toLowerCase(),
        passwordHash: password, // Will be hashed by pre-save middleware
      });

      await user.save();

      // Generate token
      const token = this.generateToken(user._id);

      // Update login info
      await user.updateLoginInfo();

      // Award first registration badge if applicable
      try {
        await Badge.checkAndAwardBadges(user._id, {});
      } catch (badgeError) {
        console.error('Badge awarding failed during registration:', badgeError);
        // Don't fail registration if badge awarding fails
      }

      return {
        user: user.toJSON(),
        token,
      };
    } catch (error) {
      // Re-throw the error with its original status code if it has one
      if (error.statusCode) {
        throw error;
      }
      // Handle Mongoose validation errors
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        const validationError = new Error('Validation failed');
        validationError.statusCode = 400;
        validationError.errors = validationErrors;
        throw validationError;
      }
      throw error;
    }
  }

  /**
   * Authenticate user
   * @param {object} loginData - User login data
   * @returns {object} User object with token
   */
  async login(loginData) {
    const { email, password } = loginData;

    try {
      // Find user by email with password field
      const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');

      if (!user) {
        const error = new Error(RESPONSE_MESSAGES.INVALID_CREDENTIALS);
        error.statusCode = 401;
        throw error;
      }

      // Check if user is active
      if (!user.isActive) {
        const error = new Error('Account is deactivated');
        error.statusCode = 401;
        throw error;
      }

      // Compare password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        const error = new Error(RESPONSE_MESSAGES.INVALID_CREDENTIALS);
        error.statusCode = 401;
        throw error;
      }

      // Generate token
      const token = this.generateToken(user._id);

      // Update login info and streak
      await user.updateLoginInfo();

      return {
        user: user.toJSON(),
        token,
      };
    } catch (error) {
      if (error.statusCode) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Get user profile
   * @param {string} userId - User ID
   * @returns {object} User profile
   */
  async getProfile(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        const error = new Error(RESPONSE_MESSAGES.NOT_FOUND);
        error.statusCode = 404;
        throw error;
      }

      return user.toJSON();
    } catch (error) {
      if (error.statusCode) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {object} updateData - Data to update
   * @returns {object} Updated user
   */
  async updateProfile(userId, updateData) {
    try {
      const allowedUpdates = ['name', 'settings'];
      const actualUpdate = {};

      // Only allow specific fields
      Object.keys(updateData).forEach(key => {
        if (allowedUpdates.includes(key)) {
          actualUpdate[key] = updateData[key];
        }
      });

      // If updating email, check if it's already taken
      if (actualUpdate.email) {
        const existingUser = await User.findByEmail(actualUpdate.email);
        if (existingUser && existingUser._id.toString() !== userId) {
          const error = new Error(RESPONSE_MESSAGES.DUPLICATE_EMAIL);
          error.statusCode = 409;
          throw error;
        }
        actualUpdate.email = actualUpdate.email.toLowerCase();
      }

      const user = await User.findByIdAndUpdate(
        userId,
        actualUpdate,
        { new: true, runValidators: true }
      );

      if (!user) {
        const error = new Error(RESPONSE_MESSAGES.NOT_FOUND);
        error.statusCode = 404;
        throw error;
      }

      return user.toJSON();
    } catch (error) {
      if (error.statusCode) {
        throw error;
      }
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        const validationError = new Error('Validation failed');
        validationError.statusCode = 400;
        validationError.errors = validationErrors;
        throw validationError;
      }
      throw error;
    }
  }

  /**
   * Change user password
   * @param {string} userId - User ID
   * @param {object} passwordData - Password change data
   * @returns {boolean} Success status
   */
  async changePassword(userId, passwordData) {
    const { currentPassword, newPassword } = passwordData;

    try {
      // Find user with password
      const user = await User.findById(userId).select('+passwordHash');
      if (!user) {
        const error = new Error(RESPONSE_MESSAGES.NOT_FOUND);
        error.statusCode = 404;
        throw error;
      }

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        const error = new Error('Current password is incorrect');
        error.statusCode = 401;
        throw error;
      }

      // Update password
      user.passwordHash = newPassword; // Will be hashed by pre-save middleware
      await user.save();

      return true;
    } catch (error) {
      if (error.statusCode) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Request password reset
   * @param {string} email - User email
   * @returns {boolean} Success status (always returns true for security)
   */
  async requestPasswordReset(email) {
    try {
      const user = await User.findOne({ email: email.toLowerCase() });

      // Always return true to prevent email enumeration attacks
      if (!user) {
        return true;
      }

      // Generate reset token (simplified version)
      const resetToken = require('crypto').randomBytes(32).toString('hex');
      const resetTokenHash = require('crypto')
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

      user.passwordResetToken = resetTokenHash;
      user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
      await user.save({ validateBeforeSave: false });

      // In a real application, you would send an email here
      console.log('Password reset token for', email, ':', resetToken);

      return true;
    } catch (error) {
      // Always return true to prevent email enumeration
      return true;
    }
  }

  /**
   * Reset password with token
   * @param {string} resetToken - Reset token
   * @param {string} newPassword - New password
   * @returns {boolean} Success status
   */
  async resetPassword(resetToken, newPassword) {
    try {
      // Hash the reset token to compare with stored hash
      const resetTokenHash = require('crypto')
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

      const user = await User.findOne({
        passwordResetToken: resetTokenHash,
        passwordResetExpires: { $gt: Date.now() },
      }).select('+passwordResetToken +passwordResetExpires');

      if (!user) {
        const error = new Error('Reset token is invalid or has expired');
        error.statusCode = 400;
        throw error;
      }

      // Update password and clear reset fields
      user.passwordHash = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      return true;
    } catch (error) {
      if (error.statusCode) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Deactivate user account
   * @param {string} userId - User ID
   * @returns {boolean} Success status
   */
  async deactivateAccount(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        const error = new Error(RESPONSE_MESSAGES.NOT_FOUND);
        error.statusCode = 404;
        throw error;
      }

      user.isActive = false;
      await user.save({ validateBeforeSave: false });

      return true;
    } catch (error) {
      if (error.statusCode) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Get user statistics
   * @param {string} userId - User ID
   * @returns {object} User statistics
   */
  async getUserStats(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        const error = new Error(RESPONSE_MESSAGES.NOT_FOUND);
        error.statusCode = 404;
        throw error;
      }

      const stats = await user.getStats();
      return stats;
    } catch (error) {
      if (error.statusCode) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Validate JWT token from request headers
   * @param {object} req - Express request object
   * @returns {object} User object
   */
  async authenticateToken(req) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      const error = new Error(RESPONSE_MESSAGES.UNAUTHORIZED);
      error.statusCode = 401;
      throw error;
    }

    try {
      const decoded = this.verifyToken(token);
      const user = await User.findById(decoded.userId);

      if (!user) {
        const error = new Error(RESPONSE_MESSAGES.UNAUTHORIZED);
        error.statusCode = 401;
        throw error;
      }

      if (!user.isActive) {
        const error = new Error('Account is deactivated');
        error.statusCode = 401;
        throw error;
      }

      return user;
    } catch (jwtError) {
      const error = new Error('Invalid token');
      error.statusCode = 401;
      throw error;
    }
  }
}

module.exports = new AuthService();