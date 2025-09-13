# Lumen Quest Backend Architecture

## System Overview

The Lumen Quest Backend is a robust, scalable subscription management system built with modern Node.js technologies. It provides comprehensive APIs for user management, subscription handling, billing operations, and analytics reporting.

### Architecture Principles

- **Separation of Concerns**: Clear separation between routes, services, and data layers
- **Security First**: Row-level security, JWT authentication, and role-based access control
- **Scalability**: Stateless design with horizontal scaling capabilities
- **Maintainability**: Modular structure with comprehensive testing
- **Performance**: Optimized queries, caching strategies, and efficient data handling

## Technology Stack

### Core Technologies

- **Runtime**: Node.js 18+ with Express.js 5.1.0
- **Database**: PostgreSQL via Supabase with Row Level Security (RLS)
- **Authentication**: Supabase Auth with JWT tokens
- **Testing**: Jest with comprehensive mocking and coverage reporting
- **Development**: ESLint for code quality and consistency

### External Services

- **Database**: Supabase (PostgreSQL with real-time capabilities)
- **Payment Processing**: Stripe (configurable)
- **Email**: SendGrid (configurable)
- **Caching**: Redis (optional for session management)

## System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Apps   │    │   Web Frontend  │    │   Admin Panel   │
│  (Mobile/API)   │    │    (React)      │    │    (React)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Load Balancer  │
                    │    (nginx)      │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Express.js    │
                    │   Application   │
                    └─────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                       │                        │
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Supabase   │     │   Stripe    │     │  SendGrid   │
│ (Database)  │     │ (Payments)  │     │   (Email)   │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Application Structure

### Directory Layout

```
src/
├── app.js                      # Express application setup
├── index.js                    # Application entry point
├── config/
│   └── supabase.js            # Database configuration
├── middleware/
│   ├── authMiddleware.js      # JWT authentication
│   ├── roleMiddleware.js      # Role-based access control
│   └── errorHandler.js        # Global error handling
├── models/
│   ├── planModel.js           # Plan data model
│   ├── subscriptionModel.js   # Subscription data model
│   └── billingModel.js        # Billing data model
├── services/
│   ├── planService.js         # Plan business logic
│   ├── subscriptionService.js # Subscription management
│   ├── billingService.js      # Payment processing
│   ├── analyticsService.js    # Analytics and reporting
│   └── notificationService.js # Email notifications
├── routes/
│   ├── index.js               # Route aggregation
│   ├── authRoutes.js          # Authentication endpoints
│   ├── userRoutes.js          # User management
│   ├── adminRoutes.js         # Admin operations
│   ├── billingRoutes.js       # Billing and payments
│   ├── analyticsRoutes.js     # Analytics endpoints
│   └── publicRoutes.js        # Public endpoints
├── utils/
│   ├── constants.js           # Application constants
│   ├── helpers.js             # Utility functions
│   └── validators.js          # Input validation
├── db/
│   ├── migrations/            # Database migrations
│   ├── migration-runner.js    # Migration execution
│   └── db-utils.js           # Database utilities
└── tests/                     # Comprehensive test suites
```

## Database Design

### Schema Overview

The database follows a normalized design with clear relationships and constraints:

```sql
-- Core Tables
users               # User accounts and profiles
plans               # Subscription plans and pricing
subscriptions       # User subscriptions
invoices            # Billing invoices
payments            # Payment transactions
analytics_events    # Event tracking for analytics

-- Audit Tables
audit_logs          # System audit trail
subscription_changes # Subscription modification history
```

### Entity Relationships

```
Users (1) ──→ (M) Subscriptions
Plans (1) ──→ (M) Subscriptions
Subscriptions (1) ──→ (M) Invoices
Invoices (1) ──→ (M) Payments
Users (1) ──→ (M) Analytics_Events
```

### Key Database Features

#### Row Level Security (RLS)

All tables implement RLS policies for data isolation:

```sql
-- Users can only access their own data
CREATE POLICY "users_own_data" ON subscriptions
FOR ALL USING (user_id = auth.uid());

-- Admins can access all data
CREATE POLICY "admin_all_access" ON subscriptions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

#### Database Triggers

Automated business logic through triggers:

```sql
-- Update subscription status on payment
CREATE TRIGGER update_subscription_on_payment
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_status();

-- Log subscription changes
CREATE TRIGGER log_subscription_changes
  AFTER UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION log_subscription_change();
```

#### Indexes for Performance

Strategic indexes for optimal query performance:

```sql
-- Subscription queries
CREATE INDEX idx_subscriptions_user_status 
ON subscriptions(user_id, status);

-- Invoice queries  
CREATE INDEX idx_invoices_subscription_status 
ON invoices(subscription_id, status);

-- Analytics queries
CREATE INDEX idx_analytics_events_date 
ON analytics_events(created_at);
```

## Authentication & Authorization

### Authentication Flow

1. **Registration**: User creates account with email/password
2. **Verification**: Email verification (optional)
3. **Login**: Supabase Auth generates JWT token
4. **Token Usage**: JWT included in API requests
5. **Token Refresh**: Automatic token refresh handling

### Authorization Levels

#### User Roles

- **user**: Standard customer access
  - Own profile management
  - Subscription management
  - Billing history
  - Usage analytics

- **admin**: Administrative access
  - All user operations
  - Plan management
  - System analytics
  - User management

#### Route Protection

```javascript
// Authentication required
router.use('/users', authMiddleware);

// Admin role required
router.use('/admin', authMiddleware, roleMiddleware('admin'));

// Optional authentication
router.get('/plans', optionalAuth, planController.getPlans);
```

### Security Measures

#### JWT Token Security

- **Short Expiration**: Access tokens expire in 1 hour
- **Refresh Tokens**: Secure refresh token rotation
- **Secure Storage**: HttpOnly cookies for web clients
- **Token Validation**: Comprehensive token validation

#### Data Protection

- **Input Validation**: All inputs validated and sanitized
- **SQL Injection**: Parameterized queries via Supabase
- **XSS Prevention**: Content Security Policy headers
- **CORS**: Configurable CORS policies

## Service Layer Architecture

### Service Responsibilities

Each service handles specific business domain logic:

#### Plan Service
- Plan CRUD operations
- Feature validation
- Pricing calculations
- Plan comparison logic

#### Subscription Service
- Subscription lifecycle management
- Plan upgrades/downgrades
- Cancellation handling
- Billing cycle management

#### Billing Service
- Payment processing integration
- Invoice generation
- Payment retry logic
- Refund processing

#### Analytics Service
- Event tracking
- Report generation
- Metrics calculation
- Dashboard data aggregation

#### Notification Service
- Email template management
- Notification scheduling
- Delivery tracking
- Multi-channel support

### Service Communication

Services communicate through:
- **Direct Calls**: Synchronous service-to-service calls
- **Event Emission**: Asynchronous event-driven updates
- **Database Triggers**: Automated data consistency

```javascript
// Service composition example
async function upgradeSubscription(userId, newPlanId) {
  // 1. Validate upgrade
  const validation = await subscriptionService.validateUpgrade(userId, newPlanId);
  
  // 2. Process payment
  const payment = await billingService.processUpgradePayment(validation);
  
  // 3. Update subscription
  const subscription = await subscriptionService.updatePlan(userId, newPlanId);
  
  // 4. Send notification
  await notificationService.sendUpgradeConfirmation(userId, subscription);
  
  // 5. Track analytics
  await analyticsService.trackEvent('subscription.upgraded', {
    userId,
    oldPlanId: validation.currentPlanId,
    newPlanId
  });
  
  return subscription;
}
```

## API Design Patterns

### RESTful Design

Following REST principles for intuitive API design:

```
GET    /users              # List users
GET    /users/:id          # Get specific user
POST   /users              # Create user
PUT    /users/:id          # Update user
DELETE /users/:id          # Delete user

# Nested resources
GET    /users/:id/subscriptions     # User's subscriptions
POST   /users/:id/subscriptions     # Create subscription for user
```

### Response Standardization

Consistent response format across all endpoints:

```javascript
// Success response
{
  success: true,
  data: { ... },
  message: "Operation completed successfully",
  timestamp: "2024-01-15T10:30:00Z"
}

// Error response
{
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid input data",
    details: { field: "email", reason: "Invalid format" }
  },
  timestamp: "2024-01-15T10:30:00Z"
}
```

### Error Handling Strategy

#### Error Categories

1. **Validation Errors**: Input validation failures
2. **Authentication Errors**: Auth token issues
3. **Authorization Errors**: Permission violations
4. **Business Logic Errors**: Domain rule violations
5. **System Errors**: Database or external service failures

#### Error Response Codes

- `400`: Bad Request (validation errors)
- `401`: Unauthorized (authentication required)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found (resource doesn't exist)
- `409`: Conflict (business rule violation)
- `422`: Unprocessable Entity (invalid data)
- `500`: Internal Server Error (system failure)

## Performance Optimization

### Database Optimization

#### Query Optimization
- Strategic indexing for common queries
- Query analysis and optimization
- Connection pooling
- Read replicas for analytics

#### Caching Strategy
```javascript
// Service-level caching
const planCache = new Map();

async function getPlan(planId) {
  // Check cache first
  if (planCache.has(planId)) {
    return planCache.get(planId);
  }
  
  // Fetch from database
  const plan = await supabase
    .from('plans')
    .select('*')
    .eq('id', planId)
    .single();
  
  // Cache result
  planCache.set(planId, plan.data);
  return plan.data;
}
```

### API Performance

#### Request Optimization
- Request payload validation
- Response compression
- Efficient pagination
- Field selection (sparse fieldsets)

#### Rate Limiting
```javascript
// Rate limiting configuration
const rateLimits = {
  auth: { windowMs: 60000, max: 5 },      // 5 requests per minute
  api: { windowMs: 60000, max: 100 },     // 100 requests per minute
  admin: { windowMs: 60000, max: 200 }    // 200 requests per minute
};
```

## Monitoring & Observability

### Logging Strategy

#### Log Levels
- **ERROR**: System errors and exceptions
- **WARN**: Business logic warnings
- **INFO**: Important application events
- **DEBUG**: Detailed debugging information

#### Structured Logging
```javascript
// Example log entry
{
  level: "info",
  timestamp: "2024-01-15T10:30:00Z",
  message: "Subscription created",
  context: {
    userId: "user-123",
    subscriptionId: "sub-456",
    planId: "plan-789",
    operation: "subscription.create"
  }
}
```

### Health Monitoring

#### Health Check Endpoints
- `/health`: Basic application health
- `/status`: Detailed system status
- `/metrics`: Performance metrics

#### System Metrics
- Response time percentiles
- Error rates by endpoint
- Database connection health
- External service availability

### Analytics & Reporting

#### Business Metrics
- Monthly Recurring Revenue (MRR)
- Customer Acquisition Cost (CAC)
- Customer Lifetime Value (CLV)
- Churn rate and retention
- Plan conversion rates

#### Technical Metrics
- API response times
- Database query performance
- Error rates and patterns
- System resource utilization

## Deployment Architecture

### Environment Management

#### Development Environment
```javascript
// Development configuration
{
  NODE_ENV: 'development',
  LOG_LEVEL: 'debug',
  DATABASE_URL: 'postgresql://localhost:5432/lumenquest_dev',
  ENABLE_CORS: true,
  ENABLE_SWAGGER: true
}
```

#### Production Environment
```javascript
// Production configuration
{
  NODE_ENV: 'production',
  LOG_LEVEL: 'info',
  DATABASE_URL: 'postgresql://prod-server:5432/lumenquest',
  ENABLE_CORS: false,
  RATE_LIMIT_ENABLED: true
}
```

### Container Deployment

#### Docker Configuration
```dockerfile
# Multi-stage build for optimization
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

#### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lumenquest-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: lumenquest-backend
  template:
    metadata:
      labels:
        app: lumenquest-backend
    spec:
      containers:
      - name: backend
        image: lumenquest/backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Scaling Strategies

#### Horizontal Scaling
- Stateless application design
- Load balancer distribution
- Database read replicas
- Microservice decomposition

#### Vertical Scaling
- CPU and memory optimization
- Database query optimization
- Caching implementation
- Connection pooling

## Testing Strategy

### Test Pyramid

```
        ┌─────────────┐
        │ E2E Tests   │  ← Integration & User Workflows
        │    (Few)    │
        └─────────────┘
      ┌─────────────────┐
      │ Integration     │  ← Service & API Testing
      │ Tests (Some)    │
      └─────────────────┘
    ┌─────────────────────┐
    │   Unit Tests        │  ← Individual Functions & Components
    │    (Many)           │
    └─────────────────────┘
```

### Testing Categories

#### Unit Tests
- Individual function testing
- Service method validation
- Utility function verification
- Business logic validation

#### Integration Tests
- API endpoint testing
- Database interaction testing
- External service integration
- Authentication flow testing

#### End-to-End Tests
- Complete user workflows
- Payment processing flows
- Admin operation workflows
- Error handling scenarios

### Test Coverage Requirements

- **Branches**: 70% minimum
- **Functions**: 70% minimum
- **Lines**: 70% minimum
- **Statements**: 70% minimum

## Security Architecture

### Security Layers

#### Network Security
- HTTPS enforcement
- CORS policy configuration
- Rate limiting and DDoS protection
- IP whitelisting for admin endpoints

#### Application Security
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF protection

#### Data Security
- Encryption at rest
- Encryption in transit
- PII data protection
- Audit logging

### Compliance Considerations

#### GDPR Compliance
- Data privacy controls
- Right to deletion
- Data export capabilities
- Consent management

#### PCI DSS (if handling cards)
- Secure payment processing
- Card data tokenization
- Secure key management
- Regular security audits

## Future Considerations

### Scalability Roadmap

#### Phase 1: Current Architecture
- Single database instance
- Monolithic application
- Basic caching

#### Phase 2: Horizontal Scaling
- Database read replicas
- Redis caching layer
- Load balancer implementation

#### Phase 3: Microservices
- Service decomposition
- Event-driven architecture
- Independent deployments

### Technology Evolution

#### Potential Enhancements
- GraphQL API layer
- Real-time subscriptions
- Advanced analytics
- Machine learning insights

#### Performance Improvements
- Database sharding
- CDN implementation
- Advanced caching strategies
- Query optimization

## Development Workflow

### Git Workflow

```
main (production)
├── develop (integration)
│   ├── feature/user-management
│   ├── feature/billing-integration
│   └── hotfix/security-patch
```

### Code Quality

#### Pre-commit Hooks
- ESLint validation
- Prettier formatting
- Unit test execution
- Security scanning

#### Code Review Process
1. Feature branch creation
2. Development and testing
3. Pull request creation
4. Code review and approval
5. Merge to develop branch
6. Integration testing
7. Production deployment

### CI/CD Pipeline

```yaml
# Example GitHub Actions workflow
name: Backend CI/CD
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Run integration tests
        run: npm run test:integration

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to production
        run: |
          # Deployment script
          docker build -t lumenquest/backend .
          docker push lumenquest/backend
          kubectl apply -f k8s/
```

This comprehensive architecture document provides the foundation for understanding, maintaining, and evolving the Lumen Quest Backend system. It serves as a guide for developers, architects, and stakeholders involved in the project.