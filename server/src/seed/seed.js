require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Category = require('../models/Category');
const Expense = require('../models/Expense');
const Goal = require('../models/Goal');
const Badge = require('../models/Badge');
const { DEFAULT_CATEGORIES, PAYMENT_METHODS } = require('../config/constants');
const moment = require('moment');

// Connect to database
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/spendsmart';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB for seeding');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Clear existing data
const clearDatabase = async () => {
  try {
    await User.deleteMany({});
    await Category.deleteMany({});
    await Expense.deleteMany({});
    await Goal.deleteMany({});
    await Badge.deleteMany({});
    console.log('🗑️  Database cleared');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
  }
};

// Seed users
const seedUsers = async () => {
  try {
    const users = [
      {
        name: 'Demo User',
        email: 'demo@spendsmart.com',
        password: 'password123',
        settings: {
          currency: 'INR',
          timezone: 'Asia/Kolkata',
          theme: 'light',
        },
        streak: {
          current: 15,
          longest: 30,
          lastActiveDate: new Date(),
        },
      },
      {
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: 'password123',
        settings: {
          currency: 'INR',
          timezone: 'Asia/Kolkata',
          theme: 'light',
        },
        streak: {
          current: 7,
          longest: 14,
          lastActiveDate: new Date(),
        },
      },
    ];

    const createdUsers = [];
    for (const userData of users) {
      const user = new User(userData);
      await user.save();
      createdUsers.push(user);
    }

    console.log(`👤 Created ${createdUsers.length} users`);
    return createdUsers;
  } catch (error) {
    console.error('❌ Error seeding users:', error);
    return [];
  }
};

// Seed categories
const seedCategories = async (users) => {
  try {
    const categories = [];

    for (const user of users) {
      // Add default categories for each user
      for (const categoryData of DEFAULT_CATEGORIES) {
        const category = new Category({
          ...categoryData,
          userId: user._id,
          isDefault: true,
        });
        await category.save();
        categories.push({ category, user });
      }

      // Add some custom categories for demo user
      if (user.email === 'demo@spendsmart.com') {
        const customCategories = [
          { name: 'Subscriptions', color: '#E74C3C', monthlyBudget: 1500, icon: 'subscription' },
          { name: 'Health & Fitness', color: '#9B59B6', monthlyBudget: 2500, icon: 'fitness' },
          { name: 'Travel', color: '#3498DB', monthlyBudget: 3000, icon: 'travel' },
        ];

        for (const categoryData of customCategories) {
          const category = new Category({
            ...categoryData,
            userId: user._id,
            isDefault: false,
          });
          await category.save();
          categories.push({ category, user });
        }
      }
    }

    console.log(`🏷️  Created ${categories.length} categories`);
    return categories;
  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    return [];
  }
};

// Seed expenses
const seedExpenses = async (users, categories) => {
  try {
    const expenses = [];

    // Get user categories map
    const userCategories = {};
    for (const { category, user } of categories) {
      if (!userCategories[user.email]) {
        userCategories[user.email] = [];
      }
      userCategories[user.email].push(category);
    }

    // Sample expense data
    const expenseTemplates = [
      { note: 'Morning coffee', amounts: [80, 120, 150], category: 'Food', paymentMethods: ['cash', 'card'] },
      { note: 'Lunch at office canteen', amounts: [150, 200, 250], category: 'Food', paymentMethods: ['upi', 'card'] },
      { note: 'Dinner at restaurant', amounts: [500, 800, 1200], category: 'Food', paymentMethods: ['card', 'upi'] },
      { note: 'Groceries for the week', amounts: [1500, 2500, 3500], category: 'Food', paymentMethods: ['card', 'wallet'] },
      { note: 'Uber to office', amounts: [150, 250, 350], category: 'Transport', paymentMethods: ['upi', 'wallet'] },
      { note: 'Monthly metro pass', amounts: [1500, 2000], category: 'Transport', paymentMethods: ['card', 'upi'] },
      { note: 'Petrol for car', amounts: [2000, 3000], category: 'Transport', paymentMethods: ['card', 'cash'] },
      { note: 'New clothes', amounts: [1500, 3000, 5000], category: 'Shopping', paymentMethods: ['card', 'upi'] },
      { note: 'Amazon order', amounts: [800, 1200, 2500], category: 'Shopping', paymentMethods: ['card', 'netbanking'] },
      { note: 'Movie tickets', amounts: [300, 500, 800], category: 'Entertainment', paymentMethods: ['upi', 'wallet'] },
      { note: 'Netflix subscription', amounts: [199, 299], category: 'Entertainment', paymentMethods: ['card'] },
      { note: 'Concert tickets', amounts: [1500, 3000], category: 'Entertainment', paymentMethods: ['card', 'upi'] },
      { note: 'Electricity bill', amounts: [1500, 2500], category: 'Bills', paymentMethods: ['upi', 'netbanking'] },
      { note: 'Mobile recharge', amounts: [299, 499, 599], category: 'Bills', paymentMethods: ['upi', 'wallet'] },
      { note: 'Internet bill', amounts: [999, 1499], category: 'Bills', paymentMethods: ['card', 'upi'] },
      { note: 'Doctor consultation', amounts: [500, 1000], category: 'Healthcare', paymentMethods: ['cash', 'upi'] },
      { note: 'Medicines', amounts: [200, 500, 800], category: 'Healthcare', paymentMethods: ['cash', 'card'] },
    ];

    // Generate expenses for the last 60 days
    for (const user of users) {
      const userExpenseCount = user.email === 'demo@spendsmart.com' ? 100 : 30;

      for (let i = 0; i < userExpenseCount; i++) {
        const daysAgo = Math.floor(Math.random() * 60);
        const expenseDate = moment().subtract(daysAgo, 'days').toDate();

        // Adjust for weekend patterns (more spending on weekends)
        const dayOfWeek = moment(expenseDate).day();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const weekendMultiplier = isWeekend ? 1.3 : 1;

        // Select random expense template
        const template = expenseTemplates[Math.floor(Math.random() * expenseTemplates.length)];

        // Find matching category for user
        const userCategoryList = userCategories[user.email];
        const category = userCategoryList.find(cat => cat.name === template.category);

        if (!category) continue;

        // Random amount with weekend adjustment
        const baseAmount = template.amounts[Math.floor(Math.random() * template.amounts.length)];
        const amount = Math.round(baseAmount * weekendMultiplier * (0.8 + Math.random() * 0.4));

        // Random payment method
        const paymentMethod = template.paymentMethods[Math.floor(Math.random() * template.paymentMethods.length)];

        // Generate tags
        const possibleTags = ['daily', 'weekly', 'essential', 'urgent', 'planned', 'impulse'];
        const tagCount = Math.random() > 0.7 ? Math.floor(Math.random() * 2) + 1 : 0;
        const tags = [];
        for (let j = 0; j < tagCount; j++) {
          const tag = possibleTags[Math.floor(Math.random() * possibleTags.length)];
          if (!tags.includes(tag)) {
            tags.push(tag);
          }
        }

        const expense = new Expense({
          userId: user._id,
          amount,
          categoryId: category._id,
          date: expenseDate,
          note: template.note,
          paymentMethod,
          tags,
          metadata: {
            source: 'seed_data',
          },
        });

        await expense.save();
        expenses.push(expense);
      }
    }

    console.log(`💰 Created ${expenses.length} expenses`);
    return expenses;
  } catch (error) {
    console.error('❌ Error seeding expenses:', error);
    return [];
  }
};

// Seed goals
const seedGoals = async (users) => {
  try {
    const goals = [];

    const goalTemplates = [
      {
        title: 'Emergency Fund',
        description: 'Build a 6-month emergency fund',
        targetAmount: 100000,
        category: 'emergency',
        priority: 'high',
        duration: 12, // months
      },
      {
        title: 'Vacation to Europe',
        description: 'Save for a 2-week Europe trip',
        targetAmount: 200000,
        category: 'vacation',
        priority: 'medium',
        duration: 18,
      },
      {
        title: 'New Laptop',
        description: 'Buy a new MacBook Pro',
        targetAmount: 150000,
        category: 'gadget',
        priority: 'low',
        duration: 6,
      },
      {
        title: 'Home Down Payment',
        description: 'Save for house down payment',
        targetAmount: 500000,
        category: 'emergency',
        priority: 'high',
        duration: 24,
      },
      {
        title: 'Wedding Fund',
        description: 'Save for wedding expenses',
        targetAmount: 300000,
        category: 'other',
        priority: 'high',
        duration: 15,
      },
    ];

    for (const user of users) {
      const userGoalCount = user.email === 'demo@spendsmart.com' ? 4 : 2;
      const shuffledTemplates = [...goalTemplates].sort(() => Math.random() - 0.5);

      for (let i = 0; i < userGoalCount; i++) {
        const template = shuffledTemplates[i];
        const endDate = moment().add(template.duration, 'months').toDate();

        // Calculate random saved amount (some progress on goals)
        const savedPercentage = Math.random() * 0.7; // 0-70% progress
        const savedAmount = Math.round(template.targetAmount * savedPercentage);

        const goal = new Goal({
          userId: user._id,
          title: template.title,
          description: template.description,
          targetAmount: template.targetAmount,
          savedAmount,
          endDate,
          category: template.category,
          priority: template.priority,
        });

        await goal.save();
        goals.push(goal);
      }
    }

    console.log(`🎯 Created ${goals.length} goals`);
    return goals;
  } catch (error) {
    console.error('❌ Error seeding goals:', error);
    return [];
  }
};

// Seed badges
const seedBadges = async (users) => {
  try {
    const badges = [];

    for (const user of users) {
      // Demo user gets more badges
      if (user.email === 'demo@spendsmart.com') {
        const demoBadges = [
          { type: 'first_expense', title: 'First Step', description: 'Added your first expense', icon: '🎯' },
          { type: 'week_streak', title: 'Week Warrior', description: 'Maintained a 7-day tracking streak', icon: '🔥' },
          { type: 'month_streak', title: 'Monthly Master', description: 'Maintained a 30-day tracking streak', icon: '💎' },
          { type: 'budget_hero', title: 'Budget Hero', description: 'Stayed within budget for all categories', icon: '🦸‍♂️' },
          { type: 'saver_level1', title: 'Saver Level 1', description: 'Saved your first ₹1000', icon: '💰' },
          { type: 'category_master', title: 'Category Master', description: 'Created 5 or more categories', icon: '🏷️' },
          { type: 'goal_setter', title: 'Goal Setter', description: 'Created your first savings goal', icon: '🎯' },
        ];

        for (const badgeData of demoBadges) {
          const badge = new Badge({
            userId: user._id,
            ...badgeData,
            earnedAt: moment().subtract(Math.floor(Math.random() * 30), 'days').toDate(),
          });
          await badge.save();
          badges.push(badge);
        }
      } else {
        // Jane gets fewer badges
        const janeBadges = [
          { type: 'first_expense', title: 'First Step', description: 'Added your first expense', icon: '🎯' },
          { type: 'week_streak', title: 'Week Warrior', description: 'Maintained a 7-day tracking streak', icon: '🔥' },
          { type: 'goal_setter', title: 'Goal Setter', description: 'Created your first savings goal', icon: '🎯' },
        ];

        for (const badgeData of janeBadges) {
          const badge = new Badge({
            userId: user._id,
            ...badgeData,
            earnedAt: moment().subtract(Math.floor(Math.random() * 15), 'days').toDate(),
          });
          await badge.save();
          badges.push(badge);
        }
      }
    }

    console.log(`🏆 Created ${badges.length} badges`);
    return badges;
  } catch (error) {
    console.error('❌ Error seeding badges:', error);
    return [];
  }
};

// Main seeding function
const seedDatabase = async () => {
  console.log('🌱 Starting database seeding...\n');

  try {
    // Clear existing data
    await clearDatabase();

    // Seed data
    const users = await seedUsers();
    const categories = await seedCategories(users);
    const expenses = await seedExpenses(users, categories);
    const goals = await seedGoals(users);
    const badges = await seedBadges(users);

    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n📊 Seeding Summary:');
    console.log(`   Users: ${users.length}`);
    console.log(`   Categories: ${categories.length}`);
    console.log(`   Expenses: ${expenses.length}`);
    console.log(`   Goals: ${goals.length}`);
    console.log(`   Badges: ${badges.length}`);

    console.log('\n🔑 Demo Credentials:');
    console.log(`   Email: demo@spendsmart.com`);
    console.log(`   Password: password123`);

    console.log('\n👥 Additional User:');
    console.log(`   Email: jane@example.com`);
    console.log(`   Password: password123`);

  } catch (error) {
    console.error('\n❌ Error during seeding:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

// Run seeding
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };