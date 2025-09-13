/**
 * Billing routes
 * Handles billing operations, payments, and financial management
 */

const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/authMiddleware');
const { successResponse, errorResponse, logger } = require('../utils/helpers');
const { validateBody, validateParams, validateQuery, schemas } = require('../utils/validators');
const billingService = require('../services/billingService');
const Joi = require('joi');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Validation schemas
const paymentMethodSchema = Joi.object({
  type: Joi.string().valid('card', 'bank_account').required(),
  card_token: Joi.string().when('type', { is: 'card', then: Joi.required() }),
  bank_token: Joi.string().when('type', { is: 'bank_account', then: Joi.required() }),
  billing_address: Joi.object({
    line1: Joi.string().required(),
    line2: Joi.string().allow('', null),
    city: Joi.string().required(),
    state: Joi.string().required(),
    postal_code: Joi.string().required(),
    country: Joi.string().required()
  }).required(),
  is_default: Joi.boolean().default(false)
});

const paymentIntentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  currency: Joi.string().length(3).default('USD'),
  payment_method_id: Joi.string().uuid().optional(),
  invoice_id: Joi.string().uuid().optional(),
  description: Joi.string().max(500).optional()
});

const webhookEventSchema = Joi.object({
  type: Joi.string().required(),
  data: Joi.object().required(),
  created: Joi.number().required()
});

// =============================================================================
// PAYMENT METHODS
// =============================================================================

/**
 * @route GET /api/billing/payment-methods
 * @desc Get user's payment methods
 * @access Private
 */
router.get('/payment-methods', asyncHandler(async (req, res) => {
  const paymentMethods = await billingService.getUserPaymentMethods(req.user.id);

  res.json(successResponse(paymentMethods, 'Payment methods retrieved successfully'));
}));

/**
 * @route POST /api/billing/payment-methods
 * @desc Add new payment method
 * @access Private
 */
router.post('/payment-methods',
  validateBody(paymentMethodSchema),
  asyncHandler(async (req, res) => {
    const paymentMethodData = {
      ...req.body,
      user_id: req.user.id
    };

    const paymentMethod = await billingService.addPaymentMethod(paymentMethodData);

    logger.info(`Payment method added for user: ${req.user.id}`);
    
    res.status(201).json(
      successResponse(paymentMethod, 'Payment method added successfully')
    );
  })
);

/**
 * @route PUT /api/billing/payment-methods/:id
 * @desc Update payment method
 * @access Private
 */
router.put('/payment-methods/:id',
  validateParams(Joi.object({ id: Joi.string().uuid().required() })),
  validateBody(Joi.object({
    billing_address: Joi.object({
      line1: Joi.string().required(),
      line2: Joi.string().allow('', null),
      city: Joi.string().required(),
      state: Joi.string().required(),
      postal_code: Joi.string().required(),
      country: Joi.string().required()
    }).optional(),
    is_default: Joi.boolean().optional()
  })),
  asyncHandler(async (req, res) => {
    const paymentMethod = await billingService.updatePaymentMethod(
      req.params.id,
      req.body,
      req.user.id
    );

    logger.info(`Payment method updated: ${req.params.id} by user: ${req.user.id}`);
    
    res.json(successResponse(paymentMethod, 'Payment method updated successfully'));
  })
);

/**
 * @route DELETE /api/billing/payment-methods/:id
 * @desc Remove payment method
 * @access Private
 */
router.delete('/payment-methods/:id',
  validateParams(Joi.object({ id: Joi.string().uuid().required() })),
  asyncHandler(async (req, res) => {
    await billingService.removePaymentMethod(
      req.params.id,
      req.user.id
    );

    logger.info(`Payment method removed: ${req.params.id} by user: ${req.user.id}`);
    
    res.json(successResponse(null, 'Payment method removed successfully'));
  })
);

/**
 * @route PUT /api/billing/payment-methods/:id/default
 * @desc Set default payment method
 * @access Private
 */
router.put('/payment-methods/:id/default',
  validateParams(Joi.object({ id: Joi.string().uuid().required() })),
  asyncHandler(async (req, res) => {
    const paymentMethod = await billingService.setDefaultPaymentMethod(
      req.params.id,
      req.user.id
    );

    logger.info(`Default payment method set: ${req.params.id} by user: ${req.user.id}`);
    
    res.json(successResponse(paymentMethod, 'Default payment method updated'));
  })
);

// =============================================================================
// INVOICES
// =============================================================================

/**
 * @route GET /api/billing/invoices
 * @desc Get user's invoices
 * @access Private
 */
router.get('/invoices',
  validateQuery(schemas.pagination.query.keys({
    status: Joi.string().valid('pending', 'paid', 'failed', 'cancelled').optional(),
    subscription_id: Joi.string().uuid().optional(),
    date_from: Joi.date().iso().optional(),
    date_to: Joi.date().iso().optional()
  })),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status, subscription_id, date_from, date_to } = req.query;

    const result = await billingService.getUserInvoices(
      req.user.id,
      {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        subscription_id,
        date_from,
        date_to
      }
    );

    res.json(successResponse(result, 'Invoices retrieved successfully'));
  })
);

/**
 * @route GET /api/billing/invoices/:id
 * @desc Get specific invoice
 * @access Private
 */
router.get('/invoices/:id',
  validateParams(Joi.object({ id: Joi.string().uuid().required() })),
  asyncHandler(async (req, res) => {
    const invoice = await billingService.getInvoiceById(
      req.params.id,
      req.user.id
    );

    if (!invoice) {
      return res.status(404).json(
        errorResponse('Invoice not found')
      );
    }

    res.json(successResponse(invoice, 'Invoice retrieved successfully'));
  })
);

/**
 * @route GET /api/billing/invoices/:id/download
 * @desc Download invoice PDF
 * @access Private
 */
router.get('/invoices/:id/download',
  validateParams(Joi.object({ id: Joi.string().uuid().required() })),
  asyncHandler(async (req, res) => {
    const pdfBuffer = await billingService.generateInvoicePDF(
      req.params.id,
      req.user.id
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${req.params.id}.pdf"`);
    res.send(pdfBuffer);
  })
);

/**
 * @route POST /api/billing/invoices/:id/pay
 * @desc Pay invoice
 * @access Private
 */
router.post('/invoices/:id/pay',
  validateParams(Joi.object({ id: Joi.string().uuid().required() })),
  validateBody(Joi.object({
    payment_method_id: Joi.string().uuid().optional(),
    save_payment_method: Joi.boolean().default(false)
  })),
  asyncHandler(async (req, res) => {
    const { payment_method_id, save_payment_method } = req.body;

    const payment = await billingService.processInvoicePayment(
      req.params.id,
      req.user.id,
      { payment_method_id, save_payment_method }
    );

    logger.info(`Invoice payment processed: ${req.params.id} by user: ${req.user.id}`);
    
    res.json(successResponse(payment, 'Payment processed successfully'));
  })
);

/**
 * @route POST /api/billing/invoices/:id/retry
 * @desc Retry failed invoice payment
 * @access Private
 */
router.post('/invoices/:id/retry',
  validateParams(Joi.object({ id: Joi.string().uuid().required() })),
  validateBody(Joi.object({
    payment_method_id: Joi.string().uuid().optional()
  })),
  asyncHandler(async (req, res) => {
    const { payment_method_id } = req.body;

    const payment = await billingService.retryInvoicePayment(
      req.params.id,
      req.user.id,
      payment_method_id
    );

    logger.info(`Invoice payment retry: ${req.params.id} by user: ${req.user.id}`);
    
    res.json(successResponse(payment, 'Payment retry initiated successfully'));
  })
);

// =============================================================================
// PAYMENTS
// =============================================================================

/**
 * @route GET /api/billing/payments
 * @desc Get user's payment history
 * @access Private
 */
router.get('/payments',
  validateQuery(schemas.pagination.query.keys({
    status: Joi.string().valid('pending', 'succeeded', 'failed', 'cancelled').optional(),
    date_from: Joi.date().iso().optional(),
    date_to: Joi.date().iso().optional()
  })),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status, date_from, date_to } = req.query;

    const result = await billingService.getUserPayments(
      req.user.id,
      {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        date_from,
        date_to
      }
    );

    res.json(successResponse(result, 'Payments retrieved successfully'));
  })
);

/**
 * @route GET /api/billing/payments/:id
 * @desc Get specific payment details
 * @access Private
 */
router.get('/payments/:id',
  validateParams(Joi.object({ id: Joi.string().uuid().required() })),
  asyncHandler(async (req, res) => {
    const payment = await billingService.getPaymentById(
      req.params.id,
      req.user.id
    );

    if (!payment) {
      return res.status(404).json(
        errorResponse('Payment not found')
      );
    }

    res.json(successResponse(payment, 'Payment retrieved successfully'));
  })
);

/**
 * @route POST /api/billing/payments/intent
 * @desc Create payment intent
 * @access Private
 */
router.post('/payments/intent',
  validateBody(paymentIntentSchema),
  asyncHandler(async (req, res) => {
    const intentData = {
      ...req.body,
      user_id: req.user.id
    };

    const paymentIntent = await billingService.createPaymentIntent(intentData);

    logger.info(`Payment intent created for user: ${req.user.id}`);
    
    res.status(201).json(
      successResponse(paymentIntent, 'Payment intent created successfully')
    );
  })
);

/**
 * @route POST /api/billing/payments/:id/confirm
 * @desc Confirm payment
 * @access Private
 */
router.post('/payments/:id/confirm',
  validateParams(Joi.object({ id: Joi.string().uuid().required() })),
  validateBody(Joi.object({
    payment_method_id: Joi.string().uuid().required()
  })),
  asyncHandler(async (req, res) => {
    const { payment_method_id } = req.body;

    const payment = await billingService.confirmPayment(
      req.params.id,
      payment_method_id,
      req.user.id
    );

    logger.info(`Payment confirmed: ${req.params.id} by user: ${req.user.id}`);
    
    res.json(successResponse(payment, 'Payment confirmed successfully'));
  })
);

// =============================================================================
// BILLING PORTAL & CUSTOMER SERVICE
// =============================================================================

/**
 * @route GET /api/billing/portal-session
 * @desc Create billing portal session
 * @access Private
 */
router.get('/portal-session', asyncHandler(async (req, res) => {
  const { return_url } = req.query;

  const portalSession = await billingService.createBillingPortalSession(
    req.user.id,
    return_url
  );

  res.json(successResponse(portalSession, 'Billing portal session created'));
}));

/**
 * @route GET /api/billing/summary
 * @desc Get billing summary
 * @access Private
 */
router.get('/summary', asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;

  const summary = await billingService.getBillingSummary(
    req.user.id,
    period
  );

  res.json(successResponse(summary, 'Billing summary retrieved successfully'));
}));

/**
 * @route GET /api/billing/upcoming
 * @desc Get upcoming billing
 * @access Private
 */
router.get('/upcoming', asyncHandler(async (req, res) => {
  const upcoming = await billingService.getUpcomingBilling(req.user.id);

  res.json(successResponse(upcoming, 'Upcoming billing retrieved successfully'));
}));

/**
 * @route POST /api/billing/dispute
 * @desc Create billing dispute
 * @access Private
 */
router.post('/dispute',
  validateBody(Joi.object({
    invoice_id: Joi.string().uuid().optional(),
    payment_id: Joi.string().uuid().optional(),
    amount: Joi.number().positive().optional(),
    reason: Joi.string().valid(
      'duplicate_charge',
      'fraudulent',
      'subscription_cancelled',
      'product_unacceptable',
      'product_not_received',
      'credit_not_processed',
      'general'
    ).required(),
    description: Joi.string().max(1000).required(),
    evidence: Joi.array().items(Joi.string()).optional()
  })),
  asyncHandler(async (req, res) => {
    const disputeData = {
      ...req.body,
      user_id: req.user.id
    };

    const dispute = await billingService.createDispute(disputeData);

    logger.info(`Billing dispute created by user: ${req.user.id}`);
    
    res.status(201).json(
      successResponse(dispute, 'Dispute created successfully')
    );
  })
);

// =============================================================================
// WEBHOOKS & NOTIFICATIONS
// =============================================================================

/**
 * @route POST /api/billing/webhooks/stripe
 * @desc Handle Stripe webhooks
 * @access Public (with signature verification)
 */
router.post('/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req, res) => {
    const signature = req.headers['stripe-signature'];

    try {
      const event = await billingService.verifyStripeWebhook(req.body, signature);
      
      // Process webhook event
      await billingService.processWebhookEvent(event);

      logger.info(`Stripe webhook processed: ${event.type}`);
      
      res.json({ received: true });
    } catch (error) {
      logger.error('Stripe webhook error:', error);
      res.status(400).json({ error: 'Webhook verification failed' });
    }
  })
);

/**
 * @route POST /api/billing/webhooks/other
 * @desc Handle other payment provider webhooks
 * @access Public (with signature verification)
 */
router.post('/webhooks/:provider',
  validateParams(Joi.object({ provider: Joi.string().required() })),
  validateBody(webhookEventSchema),
  asyncHandler(async (req, res) => {
    const { provider } = req.params;
    const webhookData = req.body;

    await billingService.processProviderWebhook(provider, webhookData);

    logger.info(`${provider} webhook processed: ${webhookData.type}`);
    
    res.json({ received: true });
  })
);

module.exports = router;