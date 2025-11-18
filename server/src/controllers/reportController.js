const exportService = require('../services/exportService');
const { EXPORT_FORMATS } = require('../config/constants');
const { asyncHandler, createValidationError } = require('../middleware/errorHandler');
const moment = require('moment');

/**
 * Export expense data
 */
const exportData = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { start, end, format, categoryId } = req.query;

  // Validate required parameters
  if (!start || !end || !format) {
    throw createValidationError('Start date, end date, and format are required');
  }

  // Validate format
  if (!Object.values(EXPORT_FORMATS).includes(format)) {
    throw createValidationError(`Invalid format. Supported formats: ${Object.values(EXPORT_FORMATS).join(', ')}`);
  }

  // Parse dates
  const startDate = moment(start).startOf('day').toDate();
  const endDate = moment(end).endOf('day').toDate();

  // Validate date range
  if (startDate >= endDate) {
    throw createValidationError('Start date must be before end date');
  }

  // Limit date range to prevent excessive exports
  const maxDays = 365;
  const daysDiff = moment(endDate).diff(moment(startDate), 'days');
  if (daysDiff > maxDays) {
    throw createValidationError(`Date range cannot exceed ${maxDays} days`);
  }

  try {
    const result = await exportService.exportExpenses(
      userId,
      startDate,
      endDate,
      format,
      categoryId
    );

    // For JSON format, return data directly
    if (format === EXPORT_FORMATS.JSON) {
      res.status(200).json({
        success: true,
        message: 'Data exported successfully',
        data: result.data,
        metadata: {
          filename: result.filename,
          format: result.format,
          recordCount: result.recordCount,
          dateRange: {
            start: startDate,
            end: endDate,
          },
        },
      });
    } else {
      // For CSV and PDF, return metadata
      res.status(200).json({
        success: true,
        message: 'Export ready for download',
        data: {
          filename: result.filename,
          format: result.format,
          size: result.size,
          recordCount: result.recordCount,
          downloadUrl: `/api/reports/download/${result.filename}`,
        },
        metadata: {
          dateRange: {
            start: startDate,
            end: endDate,
          },
        },
      });
    }
  } catch (error) {
    throw error;
  }
});

/**
 * Download exported file
 */
const downloadFile = asyncHandler(async (req, res) => {
  const { filename } = req.params;
  const userId = req.user._id;

  // Validate filename to prevent directory traversal
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    const error = new Error('Invalid filename');
    error.statusCode = 400;
    throw error;
  }

  // Verify file belongs to user (optional security check)
  // This could be enhanced by tracking file ownership in database

  try {
    await exportService.downloadFile(filename, res);
  } catch (error) {
    if (error.message === 'File not found') {
      const notFoundError = new Error('Export file not found or has expired');
      notFoundError.statusCode = 404;
      throw notFoundError;
    }
    throw error;
  }
});

/**
 * Get export history
 */
const getExportHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { limit = 10 } = req.query;

  // In a real implementation, you would store export history in the database
  // For now, return an empty array as placeholder
  const exportHistory = [];

  res.status(200).json({
    success: true,
    data: exportHistory,
  });
});

/**
 * Get available export formats
 */
const getExportFormats = asyncHandler(async (req, res) => {
  const formats = [
    {
      format: EXPORT_FORMATS.CSV,
      name: 'CSV',
      description: 'Comma-separated values file compatible with Excel',
      mimeType: 'text/csv',
    },
    {
      format: EXPORT_FORMATS.JSON,
      name: 'JSON',
      description: 'Structured data format for developers',
      mimeType: 'application/json',
    },
    {
      format: EXPORT_FORMATS.PDF,
      name: 'PDF',
      description: 'Printable report with charts and summary',
      mimeType: 'application/pdf',
    },
  ];

  res.status(200).json({
    success: true,
    data: formats,
  });
});

/**
 * Generate expense report (comprehensive PDF report)
 */
const generateReport = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { type = 'monthly', month, year } = req.query;

  let startDate, endDate, filename;

  if (type === 'monthly') {
    const selectedMonth = month ? parseInt(month) - 1 : moment().month(); // JS months are 0-indexed
    const selectedYear = year ? parseInt(year) : moment().year();

    startDate = moment([selectedYear, selectedMonth]).startOf('month').toDate();
    endDate = moment([selectedYear, selectedMonth]).endOf('month').toDate();
    filename = `expense_report_${moment([selectedYear, selectedMonth]).format('YYYY_MM')}.pdf`;
  } else if (type === 'yearly') {
    const selectedYear = year ? parseInt(year) : moment().year();

    startDate = moment([selectedYear, 0]).startOf('year').toDate();
    endDate = moment([selectedYear, 11]).endOf('month').toDate();
    filename = `expense_report_${selectedYear}.pdf`;
  } else {
    throw createValidationError('Invalid report type. Use "monthly" or "yearly".');
  }

  try {
    const result = await exportService.exportExpenses(
      userId,
      startDate,
      endDate,
      EXPORT_FORMATS.PDF
    );

    res.status(200).json({
      success: true,
      message: 'Report generated successfully',
      data: {
        filename: result.filename,
        format: result.format,
        size: result.size,
        recordCount: result.recordCount,
        downloadUrl: `/api/reports/download/${result.filename}`,
      },
      metadata: {
        reportType: type,
        dateRange: {
          start: startDate,
          end: endDate,
        },
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    throw error;
  }
});

/**
 * Delete export file
 */
const deleteExport = asyncHandler(async (req, res) => {
  const { filename } = req.params;
  const userId = req.user._id;

  // Validate filename
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    const error = new Error('Invalid filename');
    error.statusCode = 400;
    throw error;
  }

  const fs = require('fs');
  const path = require('path');
  const filepath = path.join(__dirname, '../../uploads', filename);

  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      res.status(200).json({
        success: true,
        message: 'Export file deleted successfully',
      });
    } else {
      const notFoundError = new Error('Export file not found');
      notFoundError.statusCode = 404;
      throw notFoundError;
    }
  } catch (error) {
    throw error;
  }
});

module.exports = {
  exportData,
  downloadFile,
  getExportHistory,
  getExportFormats,
  generateReport,
  deleteExport,
};