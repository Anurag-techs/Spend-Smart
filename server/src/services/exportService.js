const Expense = require('../models/Expense');
const Category = require('../models/Category');
const csvService = require('./csvService');
const { EXPORT_FORMATS } = require('../config/constants');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');

class ExportService {
  /**
   * Export expense data in specified format
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} format - Export format (csv, pdf, json)
   * @param {string} categoryId - Optional category filter
   * @returns {object} Export result
   */
  async exportExpenses(userId, startDate, endDate, format, categoryId = null) {
    try {
      // Validate format
      if (!Object.values(EXPORT_FORMATS).includes(format)) {
        throw new Error(`Unsupported export format: ${format}`);
      }

      // Fetch expenses with filters
      const expenses = await this.getExpensesForExport(userId, startDate, endDate, categoryId);

      if (expenses.length === 0) {
        throw new Error('No expenses found in the specified date range');
      }

      switch (format) {
        case EXPORT_FORMATS.CSV:
          return await this.exportToCSV(expenses, startDate, endDate);
        case EXPORT_FORMATS.JSON:
          return await this.exportToJSON(expenses, startDate, endDate);
        case EXPORT_FORMATS.PDF:
          return await this.exportToPDF(expenses, startDate, endDate);
        default:
          throw new Error(`Export format ${format} not implemented`);
      }
    } catch (error) {
      console.error('Export error:', error);
      throw error;
    }
  }

  /**
   * Get expenses for export with filters
   */
  async getExpensesForExport(userId, startDate, endDate, categoryId) {
    const query = {
      userId,
      isActive: true,
      date: { $gte: startDate, $lte: endDate },
    };

    if (categoryId) {
      query.categoryId = categoryId;
    }

    const expenses = await Expense.find(query)
      .populate('categoryId', 'name color icon')
      .sort({ date: -1, createdAt: -1 });

    return expenses.map(expense => ({
      date: expense.date.toISOString().split('T')[0],
      amount: expense.amount,
      currency: expense.currency,
      category: expense.category ? expense.category.name : 'Unknown',
      categoryColor: expense.category ? expense.category.color : '#999999',
      note: expense.note || '',
      paymentMethod: expense.paymentMethod,
      tags: expense.tags ? expense.tags.join('; ') : '',
      receiptUrl: expense.receiptUrl || '',
      createdAt: expense.createdAt.toISOString().split('T')[0],
    }));
  }

  /**
   * Export to CSV format
   */
  async exportToCSV(expenses, startDate, endDate) {
    const filename = `expenses_${moment(startDate).format('YYYY-MM-DD')}_to_${moment(endDate).format('YYYY-MM-DD')}.csv`;
    const filepath = path.join(__dirname, '../../uploads', filename);

    const csvWriter = createCsvWriter({
      path: filepath,
      header: [
        { id: 'date', title: 'Date' },
        { id: 'amount', title: 'Amount' },
        { id: 'currency', title: 'Currency' },
        { id: 'category', title: 'Category' },
        { id: 'note', title: 'Note' },
        { id: 'paymentMethod', title: 'Payment Method' },
        { id: 'tags', title: 'Tags' },
        { id: 'receiptUrl', title: 'Receipt URL' },
        { id: 'createdAt', title: 'Created At' },
      ],
    });

    await csvWriter.writeRecords(expenses);

    return {
      filename,
      filepath,
      format: EXPORT_FORMATS.CSV,
      size: fs.statSync(filepath).size,
      recordCount: expenses.length,
    };
  }

  /**
   * Export to JSON format
   */
  async exportToJSON(expenses, startDate, endDate) {
    const filename = `expenses_${moment(startDate).format('YYYY-MM-DD')}_to_${moment(endDate).format('YYYY-MM-DD')}.json`;
    const filepath = path.join(__dirname, '../../uploads', filename);

    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        recordCount: expenses.length,
        currency: 'INR',
      },
      summary: this.calculateExportSummary(expenses),
      expenses: expenses,
    };

    fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));

    return {
      filename,
      filepath,
      format: EXPORT_FORMATS.JSON,
      size: fs.statSync(filepath).size,
      recordCount: expenses.length,
      data: exportData, // For immediate return in API response
    };
  }

  /**
   * Export to PDF format
   */
  async exportToPDF(expenses, startDate, endDate) {
    const puppeteer = require('puppeteer');
    const moment = require('moment');

    const filename = `expenses_${moment(startDate).format('YYYY-MM-DD')}_to_${moment(endDate).format('YYYY-MM-DD')}.pdf`;
    const filepath = path.join(__dirname, '../../uploads', filename);

    // Calculate summary statistics
    const summary = this.calculateExportSummary(expenses);

    // Create HTML content
    const html = this.generatePDFHTML(expenses, summary, startDate, endDate);

    // Generate PDF
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: filepath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm',
      },
    });

    await browser.close();

    return {
      filename,
      filepath,
      format: EXPORT_FORMATS.PDF,
      size: fs.statSync(filepath).size,
      recordCount: expenses.length,
    };
  }

  /**
   * Calculate summary statistics for export
   */
  calculateExportSummary(expenses) {
    const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const averageAmount = expenses.length > 0 ? totalAmount / expenses.length : 0;

    // Category breakdown
    const categoryTotals = {};
    expenses.forEach(expense => {
      const category = expense.category || 'Unknown';
      if (!categoryTotals[category]) {
        categoryTotals[category] = { amount: 0, count: 0 };
      }
      categoryTotals[category].amount += expense.amount;
      categoryTotals[category].count += 1;
    });

    // Payment method breakdown
    const paymentTotals = {};
    expenses.forEach(expense => {
      const method = expense.paymentMethod;
      if (!paymentTotals[method]) {
        paymentTotals[method] = { amount: 0, count: 0 };
      }
      paymentTotals[method].amount += expense.amount;
      paymentTotals[method].count += 1;
    });

    return {
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      averageAmount: parseFloat(averageAmount.toFixed(2)),
      totalExpenses: expenses.length,
      categoryBreakdown: Object.entries(categoryTotals).map(([category, data]) => ({
        category,
        amount: parseFloat(data.amount.toFixed(2)),
        count: data.count,
        percentage: parseFloat(((data.amount / totalAmount) * 100).toFixed(1)),
      })),
      paymentMethodBreakdown: Object.entries(paymentTotals).map(([method, data]) => ({
        method,
        amount: parseFloat(data.amount.toFixed(2)),
        count: data.count,
        percentage: parseFloat(((data.amount / totalAmount) * 100).toFixed(1)),
      })),
    };
  }

  /**
   * Generate HTML content for PDF export
   */
  generatePDFHTML(expenses, summary, startDate, endDate) {
    const moment = require('moment');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Expense Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #333;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            margin: 0;
            color: #2c3e50;
        }
        .header p {
            margin: 5px 0;
            color: #7f8c8d;
        }
        .summary {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            gap: 20px;
        }
        .summary-card {
            flex: 1;
            border: 1px solid #ddd;
            padding: 15px;
            border-radius: 5px;
            text-align: center;
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            color: #2c3e50;
            font-size: 14px;
        }
        .summary-card .value {
            font-size: 24px;
            font-weight: bold;
            color: #27ae60;
        }
        .breakdown {
            margin-bottom: 30px;
        }
        .breakdown h2 {
            color: #2c3e50;
            border-bottom: 1px solid #ddd;
            padding-bottom: 10px;
        }
        .breakdown-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        .breakdown-table th,
        .breakdown-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        .breakdown-table th {
            background-color: #f8f9fa;
            font-weight: bold;
        }
        .expenses-table {
            width: 100%;
            border-collapse: collapse;
        }
        .expenses-table th,
        .expenses-table td {
            border: 1px solid #ddd;
            padding: 6px;
            text-align: left;
        }
        .expenses-table th {
            background-color: #f8f9fa;
            font-weight: bold;
            position: sticky;
            top: 0;
        }
        .expenses-table tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        .amount {
            text-align: right;
            font-weight: bold;
        }
        .category-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            color: white;
        }
        @page {
            margin: 20mm;
            @bottom-center {
                content: "Page " counter(page) " of " counter(pages);
                font-size: 10px;
                color: #666;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Expense Report</h1>
        <p>Period: ${moment(startDate).format('MMMM D, YYYY')} - ${moment(endDate).format('MMMM D, YYYY')}</p>
        <p>Generated on: ${moment().format('MMMM D, YYYY [at] h:mm A')}</p>
    </div>

    <div class="summary">
        <div class="summary-card">
            <h3>Total Expenses</h3>
            <div class="value">₹${summary.totalAmount.toLocaleString('en-IN')}</div>
        </div>
        <div class="summary-card">
            <h3>Total Count</h3>
            <div class="value">${summary.totalExpenses}</div>
        </div>
        <div class="summary-card">
            <h3>Average Amount</h3>
            <div class="value">₹${summary.averageAmount.toLocaleString('en-IN')}</div>
        </div>
    </div>

    <div class="breakdown">
        <h2>Category Breakdown</h2>
        <table class="breakdown-table">
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Count</th>
                    <th>Percentage</th>
                </tr>
            </thead>
            <tbody>
                ${summary.categoryBreakdown.map(cat => `
                    <tr>
                        <td>${cat.category}</td>
                        <td class="amount">₹${cat.amount.toLocaleString('en-IN')}</td>
                        <td>${cat.count}</td>
                        <td>${cat.percentage}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <h2>Payment Method Breakdown</h2>
        <table class="breakdown-table">
            <thead>
                <tr>
                    <th>Payment Method</th>
                    <th>Amount</th>
                    <th>Count</th>
                    <th>Percentage</th>
                </tr>
            </thead>
            <tbody>
                ${summary.paymentMethodBreakdown.map(method => `
                    <tr>
                        <td>${method.method}</td>
                        <td class="amount">₹${method.amount.toLocaleString('en-IN')}</td>
                        <td>${method.count}</td>
                        <td>${method.percentage}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="breakdown">
        <h2>Expense Details</h2>
        <table class="expenses-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Note</th>
                    <th>Payment Method</th>
                    <th>Amount</th>
                </tr>
            </thead>
            <tbody>
                ${expenses.map(expense => `
                    <tr>
                        <td>${moment(expense.date).format('MMM D, YYYY')}</td>
                        <td>
                            <span class="category-badge" style="background-color: ${expense.categoryColor || '#999'}">
                                ${expense.category}
                            </span>
                        </td>
                        <td>${expense.note || '-'}</td>
                        <td>${expense.paymentMethod}</td>
                        <td class="amount">₹${expense.amount.toLocaleString('en-IN')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>`;
  }

  /**
   * Download exported file
   */
  async downloadFile(filename, res) {
    const filepath = path.join(__dirname, '../../uploads', filename);

    if (!fs.existsSync(filepath)) {
      throw new Error('File not found');
    }

    // Set appropriate headers
    const stat = fs.statSync(filepath);

    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', this.getContentType(filename));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream file to response
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);

    // Clean up file after download (optional)
    fileStream.on('end', () => {
      // Uncomment to delete file after download
      // setTimeout(() => fs.unlinkSync(filepath), 5000);
    });
  }

  /**
   * Get content type based on file extension
   */
  getContentType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const contentTypes = {
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.pdf': 'application/pdf',
    };
    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Clean up old export files
   */
  async cleanupOldExports(maxAgeHours = 24) {
    try {
      const uploadsDir = path.join(__dirname, '../../uploads');
      const files = fs.readdirSync(uploadsDir);

      for (const file of files) {
        const filepath = path.join(uploadsDir, file);
        const stats = fs.statSync(filepath);

        // Delete files older than maxAgeHours
        const ageInHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
        if (ageInHours > maxAgeHours) {
          fs.unlinkSync(filepath);
          console.log(`Deleted old export file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old exports:', error);
    }
  }
}

module.exports = new ExportService();