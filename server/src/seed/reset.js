require('dotenv').config();
const mongoose = require('mongoose');
const { seedDatabase } = require('./seed');

// Reset database and reseed
const resetDatabase = async () => {
  console.log('🔄 Resetting database...\n');
  await seedDatabase();
};

// Run reset
if (require.main === module) {
  resetDatabase();
}

module.exports = { resetDatabase };