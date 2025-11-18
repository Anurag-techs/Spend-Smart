const mongoose = require('mongoose');

// Database configuration
const databaseConfig = {
  // Connection options
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10, // Maintain up to 10 socket connections
    serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    family: 4, // Use IPv4, skip trying IPv6
  },

  // Connection events
  setupConnectionEvents: () => {
    const db = mongoose.connection;

    db.on('connecting', () => {
      console.log('🔄 Connecting to MongoDB...');
    });

    db.on('connected', () => {
      console.log('✅ MongoDB connected successfully');
    });

    db.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    db.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    // Handle app termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('📴 MongoDB connection closed through app termination');
      process.exit(0);
    });
  },

  // Create indexes for better performance
  createIndexes: async () => {
    try {
      const db = mongoose.connection.db;

      // User indexes
      await db.collection('users').createIndex({ email: 1 }, { unique: true });

      // Category indexes
      await db.collection('categories').createIndex({ userId: 1, name: 1 }, { unique: true });
      await db.collection('categories').createIndex({ userId: 1 });

      // Expense indexes
      await db.collection('expenses').createIndex({ userId: 1, date: -1 });
      await db.collection('expenses').createIndex({ userId: 1, categoryId: 1 });
      await db.collection('expenses').createIndex({ userId: 1, amount: -1 });
      await db.collection('expenses').createIndex({ userId: 1, createdAt: -1 });

      // Goal indexes
      await db.collection('goals').createIndex({ userId: 1, isActive: 1 });
      await db.collection('goals').createIndex({ userId: 1, endDate: 1 });

      // Badge indexes
      await db.collection('badges').createIndex({ userId: 1, type: 1 });
      await db.collection('badges').createIndex({ userId: 1, earnedAt: -1 });

      console.log('📊 Database indexes created successfully');
    } catch (error) {
      console.error('❌ Error creating database indexes:', error);
    }
  },
};

module.exports = databaseConfig;