# Lumen Quest Backend API Documentation

## Overview

The Lumen Quest Backend API provides comprehensive subscription management, billing, and analytics functionality. Built with Express.js and Supabase, it offers secure, scalable endpoints for managing plans, subscriptions, payments, and user data.

## Base URL

```
http://localhost:3000/api
```

## Authentication

All protected endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Authentication Flow

1. **Register**: `POST /auth/register`
2. **Login**: `POST /auth/login`
3. **Use Token**: Include in subsequent requests
4. **Refresh**: `POST /auth/refresh`

## Response Format

All API responses follow this standard format:

```json
{
  "success": true,
  "data": {...},
  "message": "Operation completed successfully",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {...}
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Endpoints

### Authentication Routes

#### POST /auth/register

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe",
  "role": "user"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user",
      "created_at": "2024-01-15T10:30:00Z"
    },
    "session": {
      "access_token": "jwt-token",
      "refresh_token": "refresh-token",
      "expires_at": "2024-01-15T11:30:00Z"
    }
  }
}
```

#### POST /auth/login

Authenticate user and receive tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user"
    },
    "session": {
      "access_token": "jwt-token",
      "refresh_token": "refresh-token",
      "expires_at": "2024-01-15T11:30:00Z"
    }
  }
}
```

#### POST /auth/logout

Logout user and invalidate tokens.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### POST /auth/refresh

Refresh access token using refresh token.

**Request Body:**
```json
{
  "refresh_token": "refresh-token"
}
```

#### POST /auth/forgot-password

Send password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

#### POST /auth/reset-password

Reset password using reset token.

**Request Body:**
```json
{
  "token": "reset-token",
  "password": "newSecurePassword123"
}
```

### User Routes

#### GET /users/profile

Get current user profile.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "subscription": {
      "id": "sub-uuid",
      "plan_name": "Pro Plan",
      "status": "active",
      "billing_cycle": "monthly"
    },
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

#### PUT /users/profile

Update user profile.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "John Smith",
  "email": "johnsmith@example.com"
}
```

#### DELETE /users/profile

Delete user account.

**Headers:** `Authorization: Bearer <token>`

### Plan Routes

#### GET /plans

Get all available plans.

**Query Parameters:**
- `active`: Filter by active status (true/false)
- `billing_cycle`: Filter by billing cycle (monthly/yearly)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "plan-uuid",
      "name": "Basic Plan",
      "description": "Perfect for getting started",
      "price": 9.99,
      "billing_cycle": "monthly",
      "features": [
        "Up to 5 projects",
        "Basic analytics",
        "Email support"
      ],
      "limits": {
        "projects": 5,
        "storage": "1GB",
        "api_calls": 1000
      },
      "active": true
    }
  ]
}
```

#### GET /plans/:id

Get specific plan details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "plan-uuid",
    "name": "Pro Plan",
    "description": "For growing businesses",
    "price": 29.99,
    "billing_cycle": "monthly",
    "features": [
      "Unlimited projects",
      "Advanced analytics",
      "Priority support"
    ],
    "limits": {
      "projects": -1,
      "storage": "10GB",
      "api_calls": 10000
    },
    "active": true
  }
}
```

### Subscription Routes

#### GET /subscriptions

Get user's subscriptions.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "sub-uuid",
      "plan_id": "plan-uuid",
      "plan_name": "Pro Plan",
      "status": "active",
      "billing_cycle": "monthly",
      "price": 29.99,
      "current_period_start": "2024-01-01T00:00:00Z",
      "current_period_end": "2024-02-01T00:00:00Z",
      "cancel_at_period_end": false,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /subscriptions

Create new subscription.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "plan_id": "plan-uuid",
  "billing_cycle": "monthly",
  "payment_method_id": "pm_xxx"
}
```

#### PUT /subscriptions/:id

Update subscription.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "plan_id": "new-plan-uuid",
  "billing_cycle": "yearly"
}
```

#### DELETE /subscriptions/:id

Cancel subscription.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `at_period_end`: Cancel at period end (true/false)

### Billing Routes

#### GET /billing/invoices

Get user's invoices.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `status`: Filter by status (paid/pending/failed)
- `limit`: Number of results (default: 20)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "id": "inv-uuid",
        "subscription_id": "sub-uuid",
        "amount": 29.99,
        "currency": "USD",
        "status": "paid",
        "due_date": "2024-02-01T00:00:00Z",
        "paid_at": "2024-01-31T15:30:00Z",
        "invoice_url": "https://example.com/invoice.pdf",
        "created_at": "2024-01-31T00:00:00Z"
      }
    ],
    "total": 1,
    "limit": 20,
    "offset": 0
  }
}
```

#### GET /billing/invoices/:id

Get specific invoice.

**Headers:** `Authorization: Bearer <token>`

#### POST /billing/payment-methods

Add payment method.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "type": "card",
  "card": {
    "number": "4242424242424242",
    "exp_month": 12,
    "exp_year": 2025,
    "cvc": "123"
  },
  "billing_details": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

#### GET /billing/payment-methods

Get user's payment methods.

**Headers:** `Authorization: Bearer <token>`

#### DELETE /billing/payment-methods/:id

Remove payment method.

**Headers:** `Authorization: Bearer <token>`

### Analytics Routes

#### GET /analytics/subscription-stats

Get subscription analytics (Admin only).

**Headers:** `Authorization: Bearer <admin-token>`

**Query Parameters:**
- `period`: Time period (day/week/month/year)
- `start_date`: Start date (ISO format)
- `end_date`: End date (ISO format)

**Response:**
```json
{
  "success": true,
  "data": {
    "total_subscriptions": 1250,
    "active_subscriptions": 1100,
    "new_subscriptions": 45,
    "cancelled_subscriptions": 12,
    "churn_rate": 1.1,
    "monthly_recurring_revenue": 32500.00,
    "average_revenue_per_user": 29.55,
    "by_plan": {
      "Basic": 650,
      "Pro": 400,
      "Enterprise": 50
    }
  }
}
```

#### GET /analytics/revenue-stats

Get revenue analytics (Admin only).

**Headers:** `Authorization: Bearer <admin-token>`

#### GET /analytics/user-stats

Get user analytics (Admin only).

**Headers:** `Authorization: Bearer <admin-token>`

### Admin Routes

#### GET /admin/users

Get all users (Admin only).

**Headers:** `Authorization: Bearer <admin-token>`

**Query Parameters:**
- `role`: Filter by role (user/admin)
- `status`: Filter by status (active/inactive)
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user-uuid",
        "email": "user@example.com",
        "name": "John Doe",
        "role": "user",
        "status": "active",
        "subscription_status": "active",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
    "total": 1250,
    "limit": 50,
    "offset": 0
  }
}
```

#### PUT /admin/users/:id

Update user (Admin only).

**Headers:** `Authorization: Bearer <admin-token>`

#### DELETE /admin/users/:id

Delete user (Admin only).

**Headers:** `Authorization: Bearer <admin-token>`

#### POST /admin/plans

Create new plan (Admin only).

**Headers:** `Authorization: Bearer <admin-token>`

**Request Body:**
```json
{
  "name": "Enterprise Plan",
  "description": "For large organizations",
  "price": 99.99,
  "billing_cycle": "monthly",
  "features": [
    "Unlimited everything",
    "White-label solution",
    "24/7 phone support"
  ],
  "limits": {
    "projects": -1,
    "storage": "100GB",
    "api_calls": 100000
  }
}
```

#### PUT /admin/plans/:id

Update plan (Admin only).

**Headers:** `Authorization: Bearer <admin-token>`

#### DELETE /admin/plans/:id

Delete plan (Admin only).

**Headers:** `Authorization: Bearer <admin-token>`

### Public Routes

#### GET /health

Health check endpoint.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0",
    "uptime": 3600,
    "database": "connected",
    "services": {
      "auth": "operational",
      "billing": "operational",
      "analytics": "operational"
    }
  }
}
```

#### GET /status

Detailed system status.

**Response:**
```json
{
  "success": true,
  "data": {
    "api_version": "1.0.0",
    "environment": "production",
    "database_status": "connected",
    "redis_status": "connected",
    "external_services": {
      "stripe": "operational",
      "sendgrid": "operational"
    },
    "uptime": 86400,
    "memory_usage": "45%",
    "cpu_usage": "12%"
  }
}
```

## Error Codes

### Authentication Errors

- `AUTH_REQUIRED`: Authentication token required
- `AUTH_INVALID`: Invalid authentication token
- `AUTH_EXPIRED`: Authentication token expired
- `AUTH_INSUFFICIENT`: Insufficient permissions

### Validation Errors

- `VALIDATION_ERROR`: Request validation failed
- `MISSING_REQUIRED_FIELD`: Required field missing
- `INVALID_FORMAT`: Invalid data format
- `INVALID_EMAIL`: Invalid email format
- `WEAK_PASSWORD`: Password doesn't meet requirements

### Business Logic Errors

- `USER_NOT_FOUND`: User not found
- `PLAN_NOT_FOUND`: Plan not found
- `SUBSCRIPTION_NOT_FOUND`: Subscription not found
- `DUPLICATE_EMAIL`: Email already registered
- `SUBSCRIPTION_LIMIT_REACHED`: User subscription limit reached
- `PLAN_INACTIVE`: Plan is not active
- `PAYMENT_FAILED`: Payment processing failed

### System Errors

- `DATABASE_ERROR`: Database operation failed
- `EXTERNAL_SERVICE_ERROR`: External service unavailable
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `SERVER_ERROR`: Internal server error

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Authentication endpoints**: 5 requests per minute
- **General endpoints**: 100 requests per minute
- **Admin endpoints**: 200 requests per minute

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642251600
```

## Webhooks

### Subscription Events

Configure webhook endpoints to receive real-time subscription events:

**POST** to your webhook URL with these event types:

- `subscription.created`
- `subscription.updated`
- `subscription.cancelled`
- `subscription.reactivated`
- `payment.succeeded`
- `payment.failed`
- `invoice.created`
- `invoice.paid`

**Webhook Payload:**
```json
{
  "event": "subscription.created",
  "data": {
    "subscription": {
      "id": "sub-uuid",
      "user_id": "user-uuid",
      "plan_id": "plan-uuid",
      "status": "active"
    }
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "webhook_id": "wh-uuid"
}
```

## SDK Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Get user profile
const profile = await api.get('/users/profile');

// Create subscription
const subscription = await api.post('/subscriptions', {
  plan_id: 'plan-uuid',
  billing_cycle: 'monthly'
});
```

### Python

```python
import requests

class LumenQuestAPI:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def get_profile(self):
        response = requests.get(
            f'{self.base_url}/users/profile',
            headers=self.headers
        )
        return response.json()

# Usage
api = LumenQuestAPI('http://localhost:3000/api', token)
profile = api.get_profile()
```

### cURL Examples

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Get plans
curl -X GET http://localhost:3000/api/plans \
  -H "Authorization: Bearer $TOKEN"

# Create subscription
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan_id":"plan-uuid","billing_cycle":"monthly"}'
```

## Testing

### Test Endpoints

Use these test endpoints for development:

```
POST /auth/test-token    # Generate test tokens
GET  /test/reset-db      # Reset test database
POST /test/seed-data     # Seed test data
```

### Test Data

Test user accounts:

- **User**: `test@example.com` / `password123`
- **Admin**: `admin@example.com` / `admin123`

Test payment methods:

- **Valid Card**: `4242424242424242`
- **Declined Card**: `4000000000000002`

## Deployment

### Environment Variables

```env
# Server
PORT=3000
NODE_ENV=production

# Database
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=24h

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email
SENDGRID_API_KEY=SG...
FROM_EMAIL=noreply@yourdomain.com

# Redis (optional)
REDIS_URL=redis://localhost:6379
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Health Checks

Monitor these endpoints for system health:

- `GET /health` - Basic health check
- `GET /status` - Detailed system status
- `GET /metrics` - Performance metrics (if enabled)

## Support

For API support and questions:

- **Email**: api-support@lumenquest.com
- **Documentation**: https://docs.lumenquest.com
- **Status Page**: https://status.lumenquest.com

### Breaking Changes

API versioning follows semantic versioning. Breaking changes will:

1. Be announced 30 days in advance
2. Include migration guides
3. Maintain backward compatibility for 6 months
4. Be documented in the changelog