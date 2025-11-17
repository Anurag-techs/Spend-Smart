const express = require('express');
const { authenticate } = require('../middleware/auth');
const { handleValidationErrors, validationChains } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Import controllers
const {
  exportData,
  downloadFile,
  getExportHistory,
  getExportFormats,
  generateReport,
  deleteExport,
} = require('../controllers/reportController');

/**
 * @route   GET /api/reports/export
 * @desc    Export expense data in various formats
 * @access  Private
 */
router.get('/export',
  authenticate,
  validationChains.exportData,
  handleValidationErrors,
  asyncHandler(exportData)
);

/**
 * @route   GET /api/reports/generate
 * @desc    Generate comprehensive expense report
 * @access  Private
 */
router.get('/generate',
  authenticate,
  handleValidationErrors,
  asyncHandler(generateReport)
);

/**
 * @route   GET /api/reports/formats
 * @desc    Get available export formats
 * @access  Private
 */
router.get('/formats',
  authenticate,
  asyncHandler(getExportFormats)
);

/**
 * @route   GET /api/reports/history
 * @desc    Get export history
 * @access  Private
 */
router.get('/history',
  authenticate,
  handleValidationErrors,
  asyncHandler(getExportHistory)
);

/**
 * @route   GET /api/reports/download/:filename
 * @desc    Download exported file
 * @access  Private
 */
router.get('/download/:filename',
  authenticate,
  handleValidationErrors,
  asyncHandler(downloadFile)
);

/**
 * @route   DELETE /api/reports/:filename
 * @desc    Delete export file
 * @access  Private
 */
router.delete('/:filename',
  authenticate,
  handleValidationErrors,
  asyncHandler(deleteExport)
);

module.exports = router;