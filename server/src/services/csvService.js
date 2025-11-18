const csv = require('csv-parser');
const { Readable } = require('stream');
const Expense = require('../models/Expense');
const Category = require('../models/Category');
const { PAYMENT_METHODS } = require('../config/constants');

class CSVService {
  /**
   * Process CSV file upload
   * @param {string} userId - User ID
   * @param {object} file - Uploaded file object
   * @returns {object} Import result
   */
  async processCSVUpload(userId, file) {
    try {
      const buffer = file.buffer;
      const results = [];
      const errors = [];

      // Parse CSV
      const stream = Readable.from(buffer.toString());

      await new Promise((resolve, reject) => {
        stream
          .pipe(csv())
          .on('data', (data) => {
            results.push(data);
          })
          .on('end', resolve)
          .on('error', reject);
      });

      // Process each row
      const processedExpenses = [];
      const userCategories = await Category.find({ userId, isActive: true });

      for (let i = 0; i < results.length; i++) {
        const row = results[i];
        const rowNum = i + 2; // Account for header row

        try {
          const expense = await this.processCSVRow(row, rowNum, userId, userCategories);
          if (expense) {
            processedExpenses.push(expense);
          }
        } catch (error) {
          errors.push({
            row: rowNum,
            error: error.message,
            data: row,
          });
        }
      }

      // Bulk insert valid expenses
      let imported = 0;
      if (processedExpenses.length > 0) {
        const insertedExpenses = await Expense.insertMany(processedExpenses);
        imported = insertedExpenses.length;
      }

      return {
        imported,
        failed: errors.length,
        total: results.length,
        errors,
      };
    } catch (error) {
      throw new Error(`CSV processing failed: ${error.message}`);
    }
  }

  /**
   * Process a single CSV row
   * @param {object} row - CSV row data
   * @param {number} rowNum - Row number for error reporting
   * @param {string} userId - User ID
   * @param {array} userCategories - User's categories
   * @returns {object|null} Processed expense or null if invalid
   */
  async processCSVRow(row, rowNum, userId, userCategories) {
    // Expected CSV format: Date,Amount,Category,Note,Payment Method
    const {
      Date: dateStr,
      Amount: amountStr,
      Category: categoryName,
      Note: note,
      'Payment Method': paymentMethodStr,
    } = row;

    // Validate required fields
    if (!dateStr || !amountStr || !categoryName) {
      throw new Error('Missing required fields: Date, Amount, and Category are required');
    }

    // Parse and validate date
    let date;
    try {
      date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date format');
      }
      if (date > new Date()) {
        throw new Error('Date cannot be in the future');
      }
    } catch (error) {
      throw new Error(`Invalid date: ${error.message}`);
    }

    // Parse and validate amount
    let amount;
    try {
      amount = parseFloat(amountStr.replace(/[^\d.-]/g, ''));
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Amount must be a positive number');
      }
    } catch (error) {
      throw new Error(`Invalid amount: ${error.message}`);
    }

    // Find or create category
    let category = userCategories.find(cat =>
      cat.name.toLowerCase() === categoryName.trim().toLowerCase()
    );

    if (!category) {
      // Create new category with default settings
      category = new Category({
        userId,
        name: categoryName.trim(),
        color: this.generateRandomColor(),
        icon: 'default',
      });
      await category.save();
    }

    // Validate payment method
    let paymentMethod = PAYMENT_METHODS.CARD; // Default
    if (paymentMethodStr) {
      const normalizedMethod = paymentMethodStr.toLowerCase().trim();
      const validMethods = Object.values(PAYMENT_METHODS);
      const foundMethod = validMethods.find(method =>
        method.toLowerCase().includes(normalizedMethod) ||
        normalizedMethod.includes(method.toLowerCase())
      );

      if (foundMethod) {
        paymentMethod = foundMethod;
      }
    }

    // Create expense object
    const expense = new Expense({
      userId,
      amount: Math.round(amount * 100) / 100, // Round to 2 decimal places
      categoryId: category._id,
      date,
      note: (note || '').trim().substring(0, 200),
      paymentMethod,
      tags: [],
      metadata: {
        source: 'csv_import',
        importId: `import_${Date.now()}_${rowNum}`,
      },
    });

    return expense;
  }

  /**
   * Generate a random color for new categories
   * @returns {string} Hex color code
   */
  generateRandomColor() {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
      '#DDA0DD', '#FF8B94', '#C9B6E4', '#88D8B0', '#FFCC5C',
      '#FF6F61', '#6B5B95', '#88B0D3', '#FFCC5C', '#7DCEA0',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Export expenses to CSV format
   * @param {array} expenses - Array of expense objects
   * @returns {string} CSV string
   */
  exportToCSV(expenses) {
    if (!expenses || expenses.length === 0) {
      return 'Date,Amount,Category,Note,Payment Method,Tags\n';
    }

    const headers = 'Date,Amount,Category,Note,Payment Method,Tags,Created At\n';
    const rows = expenses.map(expense => {
      const date = expense.date.toISOString().split('T')[0];
      const amount = expense.amount.toFixed(2);
      const category = expense.category ? expense.category.name : 'Unknown';
      const note = this.escapeCSVField(expense.note || '');
      const paymentMethod = expense.paymentMethod;
      const tags = this.escapeCSVField(expense.tags ? expense.tags.join('; ') : '');
      const createdAt = expense.createdAt.toISOString().split('T')[0];

      return `${date},${amount},${category},${note},${paymentMethod},${tags},${createdAt}`;
    });

    return headers + rows.join('\n');
  }

  /**
   * Escape CSV field to handle commas and quotes
   * @param {string} field - Field value to escape
   * @returns {string} Escaped field value
   */
  escapeCSVField(field) {
    if (typeof field !== 'string') {
      return '';
    }

    // If field contains comma, newline, or quotes, wrap in quotes and escape existing quotes
    if (field.includes(',') || field.includes('\n') || field.includes('"')) {
      return '"' + field.replace(/"/g, '""') + '"';
    }

    return field;
  }

  /**
   * Generate CSV template for users to download
   * @returns {string} CSV template
   */
  generateTemplate() {
    const template = `Date,Amount,Category,Note,Payment Method
2024-01-15,250.50,Food,Lunch at restaurant,card
2024-01-14,100,Transport,Uber to office,upi
2024-01-13,5000,Shopping,Monthly groceries,wallet
2024-01-12,200,Entertainment,Movie tickets,cash`;

    return template;
  }

  /**
   * Validate CSV file format
   * @param {object} file - Uploaded file object
   * @returns {boolean} True if valid
   */
  validateCSVFile(file) {
    if (!file) {
      return false;
    }

    // Check file extension
    const allowedExtensions = ['.csv'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      return false;
    }

    // Check MIME type
    const allowedMimeTypes = ['text/csv', 'application/csv'];
    if (!allowedMimeTypes.includes(file.mimetype) && !file.originalname.endsWith('.csv')) {
      return false;
    }

    return true;
  }
}

module.exports = new CSVService();