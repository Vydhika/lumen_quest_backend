/**
 * Jest test setup
 * Configures testing environment and global utilities
 */

const { supabase } = require('../config/supabase');

// Global test timeout
jest.setTimeout(30000);

// Mock external services
jest.mock('../config/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
      refreshSession: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      resend: jest.fn()
    },
    rpc: jest.fn()
  }
}));

// Global test utilities
global.testUtils = {
  // Mock user data
  mockUser: {
    id: '12345678-1234-1234-1234-123456789012',
    email: 'test@example.com',
    role: 'user',
    full_name: 'Test User'
  },

  mockAdmin: {
    id: '87654321-4321-4321-4321-210987654321',
    email: 'admin@example.com',
    role: 'admin',
    full_name: 'Admin User'
  },

  // Mock plan data
  mockPlan: {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Test Plan',
    description: 'A test subscription plan',
    price: 29.99,
    billing_cycle: 'monthly',
    features: ['Feature 1', 'Feature 2'],
    limits: { projects: 10 },
    is_active: true,
    trial_days: 14
  },

  // Mock subscription data
  mockSubscription: {
    id: '22222222-2222-2222-2222-222222222222',
    user_id: '12345678-1234-1234-1234-123456789012',
    plan_id: '11111111-1111-1111-1111-111111111111',
    status: 'active',
    billing_cycle: 'monthly',
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    auto_renewal: true
  },

  // Mock invoice data
  mockInvoice: {
    id: '33333333-3333-3333-3333-333333333333',
    user_id: '12345678-1234-1234-1234-123456789012',
    subscription_id: '22222222-2222-2222-2222-222222222222',
    invoice_number: 'INV-202509-0001',
    status: 'pending',
    subtotal: 29.99,
    tax_amount: 2.40,
    total_amount: 32.39,
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  },

  // Mock payment data
  mockPayment: {
    id: '44444444-4444-4444-4444-444444444444',
    user_id: '12345678-1234-1234-1234-123456789012',
    invoice_id: '33333333-3333-3333-3333-333333333333',
    amount: 32.39,
    currency: 'USD',
    status: 'succeeded',
    provider: 'stripe',
    provider_payment_id: 'pi_test_123'
  },

  // Helper to create mock request
  mockRequest: (overrides = {}) => ({
    user: global.testUtils.mockUser,
    body: {},
    params: {},
    query: {},
    headers: {},
    ...overrides
  }),

  // Helper to create mock response
  mockResponse: () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);
    return res;
  },

  // Helper to create mock next function
  mockNext: () => jest.fn(),

  // Helper to reset all mocks
  resetMocks: () => {
    jest.clearAllMocks();
    
    // Reset Supabase mocks to default successful responses
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null })
        }),
        order: jest.fn().mockReturnValue({
          range: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 })
        }),
        range: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 })
      }),
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null })
        })
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      }),
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null })
      }),
      upsert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null })
        })
      })
    });

    supabase.auth.signUp.mockResolvedValue({
      data: { user: global.testUtils.mockUser, session: null },
      error: null
    });

    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: global.testUtils.mockUser, session: { access_token: 'test_token' } },
      error: null
    });

    supabase.auth.getUser.mockResolvedValue({
      data: { user: global.testUtils.mockUser },
      error: null
    });
  },

  // Helper to simulate database errors
  simulateDbError: (message = 'Database error') => {
    const error = { message, code: 'DB_ERROR' };
    
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error })
        })
      }),
      insert: jest.fn().mockResolvedValue({ data: null, error }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error })
      }),
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error })
      })
    });
  },

  // Helper to simulate authentication errors
  simulateAuthError: (message = 'Authentication failed') => {
    const error = { message, code: 'AUTH_ERROR' };
    
    supabase.auth.signUp.mockResolvedValue({ data: null, error });
    supabase.auth.signInWithPassword.mockResolvedValue({ data: null, error });
    supabase.auth.getUser.mockResolvedValue({ data: null, error });
  }
};

// Setup before each test
beforeEach(() => {
  global.testUtils.resetMocks();
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('Test environment setup complete');