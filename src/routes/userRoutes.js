const express = require("express");
const router = express.Router();
const subscriptionService = require("../services/subscriptionService");

/**
 * Helper to obtain userId from multiple possible locations.
 * Clients can send userId as:
 *  - path param: /fetchSubscription/:userId
 *  - query param: /fetchSubscription?userId=...
 *  - request body (for POST/PUT): { userId: "..." }
 */
function getUserIdFromReq(req) {
  return req.params.userId || req.query.userId || (req.body && req.body.userId);
}

// ✅ View all available plans (public)
router.get("/plans", async (req, res) => {
  try {
    const plans = await subscriptionService.getAllPlans();
    res.status(200).json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ View all subscriptions of a user
// Accepts userId as path param or query param: /fetchSubscription/:userId or /fetchSubscription?userId=...
router.get("/fetchSubscription/:userId?", async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(400).json({ error: "userId is required (path param or query param or body)" });

    const subs = await subscriptionService.getSubscriptions(userId);
    res.status(200).json(subs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ View one subscription by ID (and verify it belongs to user)
// Call: GET /fetchSubscriptionByID/:id?userId=<userId>
router.get("/fetchSubscriptionByID/:id", async (req, res) => {
  try {
    const subscriptionId = req.params.id;
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(400).json({ error: "userId is required (query param or body)" });

    const sub = await subscriptionService.getSubscriptionById(subscriptionId, userId);
    res.status(200).json(sub);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Purchase a plan
// POST /purchase
// body: { userId: ".....", planId: <int>, newEndDate?: "2025-12-31" }
router.post("/purchase", async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const { planId, newEndDate } = req.body;

    if (!userId || !planId) return res.status(400).json({ error: "userId and planId are required in request" });

    const newSub = await subscriptionService.purchasePlan(userId, planId, newEndDate);
    res.status(201).json(newSub);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Upgrade subscription (only higher-priced plans)
// PUT /upgrade/:id
// body: { userId: "....", targetPlanId: <int> }
router.put("/upgrade/:id", async (req, res) => {
  try {
    const subscriptionId = req.params.id;
    const userId = getUserIdFromReq(req);
    const { targetPlanId } = req.body;

    if (!userId || !targetPlanId) return res.status(400).json({ error: "userId and targetPlanId are required" });

    const updated = await subscriptionService.upgradeSubscription(subscriptionId, targetPlanId, userId);
    res.status(200).json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Downgrade subscription (only lower-priced plans)
// PUT /downgrade/:id
// body: { userId: "....", targetPlanId: <int> }
router.put("/downgrade/:id", async (req, res) => {
  try {
    const subscriptionId = req.params.id;
    const userId = getUserIdFromReq(req);
    const { targetPlanId } = req.body;

    if (!userId || !targetPlanId) return res.status(400).json({ error: "userId and targetPlanId are required" });

    const updated = await subscriptionService.downgradeSubscription(subscriptionId, targetPlanId, userId);
    res.status(200).json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Renew subscription
// PUT /renew/:id
// body: { userId: "....", newEndDate: "2025-12-31" }
router.put("/renew/:id", async (req, res) => {
  try {
    const subscriptionId = req.params.id;
    const userId = getUserIdFromReq(req);
    const { newEndDate } = req.body;

    if (!userId || !newEndDate) return res.status(400).json({ error: "userId and newEndDate are required" });

    const newEndDateObj = new Date(newEndDate);
    if (isNaN(newEndDateObj)) return res.status(400).json({ error: "Invalid date format for newEndDate" });

    const updated = await subscriptionService.renewSubscription(userId, subscriptionId, newEndDateObj);
    res.status(200).json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ✅ Cancel subscription
// PUT /cancel/:id
// body: { userId: "...." }
router.put("/cancel/:id", async (req, res) => {
  try {
    const subscriptionId = req.params.id;
    const userId = getUserIdFromReq(req);

    if (!userId) return res.status(400).json({ error: "userId is required" });

    const cancelled = await subscriptionService.cancelSubscription(userId, subscriptionId);
    res.status(200).json(cancelled);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
