# Lumen Quest Backend

A comprehensive subscription management API built with Express.js and Supabase.

## Features

- 🔐 **Authentication & Authorization** - JWT-based auth with role-based access control
- 📊 **Subscription Management** - Complete CRUD operations for subscriptions
- 💳 **Billing System** - Billing history and invoice management
- 📈 **Analytics** - Churn analysis and plan recommendations
- 🛡️ **Security** - Rate limiting, input validation, and secure headers
- 📚 **API Documentation** - Comprehensive API documentation

## Quick Start

### Prerequisites

- Node.js 16+ 
- Supabase account and project
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Dipeshdahiya/lumen_quest_backend.git
   cd lumen_quest_backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000`

## Environment Variables

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
JWT_SECRET=your_super_secret_jwt_key_here
PORT=3000
NODE_ENV=development
```

## API Endpoints

### Public Endpoints
- `GET /api/plans` - List all subscription plans
- `GET /api/plans/:planId` - Get plan details

### User Endpoints (Authentication Required)
- `GET /api/users/me` - Get current user profile
- `POST /api/subscriptions` - Create new subscription
- `PUT /api/subscriptions/:id/upgrade` - Upgrade subscription
- `PUT /api/subscriptions/:id/downgrade` - Downgrade subscription
- `DELETE /api/subscriptions/:id` - Cancel subscription
- `GET /api/recommendations` - Get plan recommendations
- `GET /api/billing` - Get billing history

### Admin Endpoints (Admin Role Required)
- `POST /api/admin/plans` - Create new plan
- `PUT /api/admin/plans/:id` - Update plan
- `DELETE /api/admin/plans/:id` - Delete plan
- `GET /api/admin/dashboard/top-plans` - Top performing plans
- `GET /api/admin/dashboard/churn` - Churn analytics
- `GET /api/admin/subscriptions` - List all subscriptions
- `GET /api/admin/logs` - Subscription audit logs

## Scripts

```bash
npm start        # Start production server
npm run dev      # Start development server with hot reload
npm test         # Run tests
npm run test:watch # Run tests in watch mode
npm run lint     # Run ESLint
npm run lint:fix # Fix ESLint issues
```

## Project Structure

```
src/
├── index.js                 # App entry point
├── app.js                   # Express app configuration
├── config/
│   └── supabase.js          # Supabase client setup
├── middleware/
│   ├── authMiddleware.js    # JWT authentication
│   ├── roleMiddleware.js    # Role-based access control
│   └── errorHandler.js      # Global error handling
├── routes/
│   ├── index.js             # Route aggregator
│   ├── publicRoutes.js      # Public endpoints
│   ├── userRoutes.js        # User endpoints
│   ├── adminRoutes.js       # Admin endpoints
│   ├── authRoutes.js        # Authentication endpoints
│   ├── billingRoutes.js     # Billing endpoints
│   └── analyticsRoutes.js   # Analytics endpoints
├── services/
│   ├── planService.js       # Plan business logic
│   ├── subscriptionService.js # Subscription logic
│   ├── billingService.js    # Billing logic
│   ├── analyticsService.js  # Analytics logic
│   └── notificationService.js # Notification logic
├── models/
│   ├── planModel.js         # Plan data access
│   ├── subscriptionModel.js # Subscription data access
│   └── billingModel.js      # Billing data access
├── utils/
│   ├── validators.js        # Input validation
│   ├── constants.js         # App constants
│   └── helpers.js           # Utility functions
└── tests/
    ├── routes.test.js       # Route tests
    └── services.test.js     # Service tests
```

## Team Contributors

- **Vydhika** - API routes lead, subscription management
- **Akshay** - Supabase integration, data layer
- **Anubhav** - Authentication, middleware  
- **Gayatri** - Admin routes, validation, testing

## License

ISC