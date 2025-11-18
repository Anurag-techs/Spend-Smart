# SpendSmart - Personal Finance Management

A comprehensive MERN stack personal finance application that helps users track expenses, manage budgets, set savings goals, and receive AI-powered financial insights.

## 🚀 Features

### Core Functionality
- **Expense Tracking**: Add, edit, and categorize expenses with receipts and tags
- **Budget Management**: Set monthly budgets per category with overspending alerts
- **Savings Goals**: Create and track progress towards financial goals
- **AI Insights**: Smart spending analysis and personalized recommendations
- **Achievement System**: Earn badges for financial milestones and consistency

### Advanced Features
- **CSV Import/Export**: Bulk import expenses from CSV files
- **PDF Reports**: Generate detailed financial reports with charts
- **Spending Analytics**: Visualize spending patterns and trends
- **Dashboard**: Real-time overview of financial health
- **Multi-currency Support**: Track expenses in INR, USD, EUR, GBP

## 🛠 Tech Stack

### Backend
- **Node.js** with Express.js framework
- **MongoDB** with Mongoose ODM
- **JWT Authentication** with bcrypt password hashing
- **Multer** for file uploads
- **Puppeteer** for PDF generation
- **CSV parsing** for bulk imports

### Security & Performance
- Rate limiting and security headers
- Input validation and sanitization
- Database indexing for optimal performance
- Error handling and logging

## 📋 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password

### Categories
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category
- `GET /api/categories/budget-status` - Budget overview

### Expenses
- `GET /api/expenses` - Get expenses with pagination
- `POST /api/expenses` - Create expense
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense
- `POST /api/expenses/upload-csv` - Bulk import CSV

### Goals
- `GET /api/goals` - Get all goals
- `POST /api/goals` - Create goal
- `PUT /api/goals/:id` - Update goal
- `DELETE /api/goals/:id` - Delete goal
- `POST /api/goals/:id/add-savings` - Add savings to goal

### Dashboard
- `GET /api/dashboard/summary` - Dashboard overview
- `GET /api/dashboard/trends` - Spending trends
- `GET /api/dashboard/budget-comparison` - Budget vs actual
- `GET /api/dashboard/monthly-comparison` - Monthly comparison

### Insights
- `GET /api/insights/nudges` - AI-powered insights
- `GET /api/insights/spending-analysis` - Spending analysis
- `GET /api/insights/financial-tips` - Personalized tips
- `GET /api/insights/budget-health` - Budget health score

### Reports
- `GET /api/reports/export` - Export data (CSV, JSON, PDF)
- `GET /api/reports/generate` - Generate comprehensive report
- `GET /api/reports/download/:filename` - Download exported file

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Anurag-techs/Spend-Smart.git
   cd Spend-Smart
   ```

2. **Install dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your configuration:
   ```env
   PORT=5000
   MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/spendsmart
   JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long
   CLIENT_URL=http://localhost:3000
   ```

4. **Seed the database**
   ```bash
   npm run seed
   ```

5. **Start the server**
   ```bash
   npm run dev
   ```

6. **Access the API**
   - Server runs on `http://localhost:5000`
   - API documentation at `http://localhost:5000/api`

## 👤 Demo Credentials

After running the seed script, you can use these credentials:

- **Email**: `demo@spendsmart.com`
- **Password**: `password123`

Alternative user:
- **Email**: `jane@example.com`
- **Password**: `password123`

## 📊 Database Schema

### User
- Personal information and settings
- Streak tracking for engagement
- Authentication credentials

### Category
- Custom expense categories
- Monthly budget limits
- Color coding and icons

### Expense
- Detailed expense records
- Category and payment method
- Tags and receipt URLs
- Date and amount tracking

### Goal
- Savings goals with target amounts
- Progress tracking and milestones
- Priority and category classification

### Badge
- Achievement system
- Progress tracking
- User engagement metrics

## 🧠 AI Insights

The application provides intelligent financial insights:

- **Weekend Spending Detection**: Identifies increased weekend spending patterns
- **Budget Alerts**: Warns when approaching or exceeding budget limits
- **Spending Trends**: Analyzes monthly spending patterns
- **Category Analysis**: Identifies unusual spending in specific categories
- **Motivational Nudges**: Encourages good financial habits

## 📈 Features in Detail

### Budget Management
- Set monthly budgets per category
- Real-time budget tracking
- Overspending alerts and warnings
- Visual progress indicators

### Savings Goals
- Create multiple savings goals
- Track progress with visual indicators
- Set milestones and deadlines
- Automatic badge achievements

### Analytics Dashboard
- Comprehensive financial overview
- Spending trends and patterns
- Category breakdown charts
- Budget vs actual comparisons

### Data Export
- Export expenses in CSV format
- Generate PDF reports with charts
- JSON export for data analysis
- Custom date range selection

## 🔧 Scripts

```bash
# Development
npm run dev          # Start development server with nodemon

# Production
npm start             # Start production server

# Database
npm run seed          # Seed database with demo data
npm run db:reset      # Clear and reseed database

# Testing
npm test              # Run tests
npm run test:watch    # Run tests in watch mode

# Code Quality
npm run lint          # Run ESLint
npm run lint:check    # Check linting without fixing
npm run format        # Format code with Prettier
```

## 🐳 Docker Support

Docker configuration is included for easy deployment:

```bash
# Build Docker image
docker build -t spendsmart-backend .

# Run with Docker Compose
docker-compose up
```

## 🚀 Deployment

### Backend (Render/Heroku)
1. Connect your repository to deployment platform
2. Set environment variables:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `CLIENT_URL`
   - `NODE_ENV=production`
3. Deploy and set up MongoDB Atlas database

### Database Setup
- Use MongoDB Atlas for production
- Create indexes for optimal performance
- Configure connection string in environment variables

## 🔐 Security Features

- JWT token-based authentication
- Password hashing with bcrypt
- Rate limiting on API endpoints
- Input validation and sanitization
- CORS configuration
- Security headers with Helmet

## 📱 API Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support or questions:
- Create an issue in the GitHub repository
- Check the API documentation
- Review the demo data for examples

## 🎯 Future Enhancements

- Real-time notifications
- Advanced reporting features
- Machine learning predictions
- Mobile app development
- Multi-user family accounts
- Investment tracking integration

---

**Built with ❤️ using the MERN stack**

🤖 Generated with [Claude Code](https://claude.com/claude-code)