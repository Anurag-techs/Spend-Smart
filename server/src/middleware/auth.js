const authService = require('../services/authService');
const { RESPONSE_MESSAGES } = require('../config/constants');

/**
 * Authentication middleware to verify JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    const user = await authService.authenticateToken(req);
    req.user = user;
    next();
  } catch (error) {
    return res.status(error.statusCode || 401).json({
      success: false,
      error: error.message || RESPONSE_MESSAGES.UNAUTHORIZED,
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return next();
    }

    const user = await authService.authenticateToken(req);
    req.user = user;
    next();
  } catch (error) {
    // Don't fail, just continue without user
    next();
  }
};

/**
 * Check if user owns the resource or is admin
 */
const checkResourceOwnership = (resourceField = 'userId') => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: RESPONSE_MESSAGES.UNAUTHORIZED,
        });
      }

      // For admin users, skip ownership check
      if (req.user.role === 'admin') {
        return next();
      }

      // Check if user owns the resource
      const resourceUserId = req.params[resourceField] ||
                           req.body[resourceField] ||
                           req.query[resourceField];

      if (resourceUserId && resourceUserId !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          error: RESPONSE_MESSAGES.FORBIDDEN,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: RESPONSE_MESSAGES.SERVER_ERROR,
      });
    }
  };
};

module.exports = {
  authenticate,
  optionalAuth,
  checkResourceOwnership,
};