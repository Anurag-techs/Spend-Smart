const aiService = require('../services/aiService');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Get AI-powered spending insights and nudges
 */
const getNudges = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { start, end } = req.query;

  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;

  const insights = await aiService.generateInsights(userId, startDate, endDate);

  res.status(200).json({
    success: true,
    data: insights,
  });
});

/**
 * Dismiss a nudge
 */
const dismissNudge = asyncHandler(async (req, res) => {
  const { nudgeId } = req.body;
  const userId = req.user._id;

  // In a real implementation, you might store dismissed nudges in the database
  // For now, just return success since nudge dismissal is often handled client-side

  res.status(200).json({
    success: true,
    message: 'Nudge dismissed successfully',
  });
});

/**
 * Get spending analysis and recommendations
 */
const getSpendingAnalysis = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { period = '30' } = req.query;

  const startDate = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000);
  const endDate = new Date();

  const insights = await aiService.generateInsights(userId, startDate, endDate);

  // Extract and format analysis data
  const analysis = {
    spendingPatterns: insights.insights.spendingPatterns,
    categoryBreakdown: insights.insights.categoryAlerts,
    recommendations: insights.nudges.map(nudge => ({
      type: nudge.type,
      title: nudge.title,
      message: nudge.message,
      priority: nudge.priority,
      actionable: nudge.actionable,
    })),
    streakInfo: insights.insights.streakInfo,
    period: insights.period,
  };

  res.status(200).json({
    success: true,
    data: analysis,
  });
});

/**
 * Get personalized financial tips
 */
const getFinancialTips = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { category } = req.query;

  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = new Date();

  const insights = await aiService.generateInsights(userId, startDate, endDate);

  // Filter nudges for actionable tips and optionally by category
  let tips = insights.nudges.filter(nudge => nudge.actionable);

  if (category) {
    tips = tips.filter(nudge =>
      nudge.metadata.categoryName?.toLowerCase().includes(category.toLowerCase())
    );
  }

  // Format tips for better presentation
  const formattedTips = tips.map(tip => ({
    id: tip.id,
    type: tip.type,
    title: tip.title,
    description: tip.message,
    priority: tip.priority,
    category: tip.metadata.categoryName || 'General',
    actionable: true,
    metadata: tip.metadata,
  }));

  res.status(200).json({
    success: true,
    data: {
      tips: formattedTips,
      totalTips: formattedTips.length,
      highPriorityCount: formattedTips.filter(tip => tip.priority === 'high').length,
    },
  });
});

/**
 * Get budget health score
 */
const getBudgetHealthScore = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const Expense = require('../models/Expense');
  const Category = require('../models/Category');
  const moment = require('moment');

  const startDate = moment().startOf('month').toDate();
  const endDate = moment().endOf('month').toDate();

  // Get categories with budgets
  const categories = await Category.find({
    userId,
    isActive: true,
    monthlyBudget: { $gt: 0 },
  });

  if (categories.length === 0) {
    return res.status(200).json({
      success: true,
      data: {
        score: 0,
        grade: 'N/A',
        message: 'No budgets set to evaluate health',
        details: {
          totalCategories: 0,
          onTrackCategories: 0,
          warningCategories: 0,
          overBudgetCategories: 0,
        },
      },
    });
  }

  let totalScore = 0;
  let onTrackCount = 0;
  let warningCount = 0;
  let overBudgetCount = 0;

  // Evaluate each category
  for (const category of categories) {
    const spent = await Expense.aggregate([
      {
        $match: {
          userId: userId,
          categoryId: category._id,
          isActive: true,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    const spentAmount = spent[0]?.total || 0;
    const budget = category.monthlyBudget;
    const percentage = (spentAmount / budget) * 100;

    let categoryScore;
    if (percentage <= 80) {
      categoryScore = 100;
      onTrackCount++;
    } else if (percentage <= 100) {
      categoryScore = 60;
      warningCount++;
    } else {
      categoryScore = 20;
      overBudgetCount++;
    }

    totalScore += categoryScore;
  }

  const averageScore = Math.round(totalScore / categories.length);
  let grade;
  let message;

  if (averageScore >= 90) {
    grade = 'A+';
    message = 'Excellent budget management! You\'re on track with your spending goals.';
  } else if (averageScore >= 80) {
    grade = 'A';
    message = 'Great job! Most of your spending is within budget limits.';
  } else if (averageScore >= 70) {
    grade = 'B';
    message = 'Good progress, but watch out for categories approaching limits.';
  } else if (averageScore >= 60) {
    grade = 'C';
    message = 'Some categories need attention. Consider adjusting budgets or reducing spending.';
  } else {
    grade = 'D';
    message = 'Budget management needs improvement. Review your spending patterns.';
  }

  res.status(200).json({
    success: true,
    data: {
      score: averageScore,
      grade,
      message,
      details: {
        totalCategories: categories.length,
        onTrackCategories: onTrackCount,
        warningCategories: warningCount,
        overBudgetCategories: overBudgetCount,
      },
      period: {
        start: startDate,
        end: endDate,
        month: moment().format('MMMM YYYY'),
      },
    },
  });
});

module.exports = {
  getNudges,
  dismissNudge,
  getSpendingAnalysis,
  getFinancialTips,
  getBudgetHealthScore,
};