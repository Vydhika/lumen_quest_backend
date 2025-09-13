const supabase = require("../config/supabase");

// Get all plans (dashboard / view all plans)
async function getAllPlans() {
  const { data, error } = await supabase
    .from("Subscription_Plans")
    .select("*");
  if (error) throw error;
  return data;
}

// Get all subscriptions for a specific user
async function getSubscriptions(userId) {
  const { data, error } = await supabase
    .from("Subscriptions")
    .select("*, Subscription_Plans(*)") // join with plans table
    .eq("User Id", userId);
  if (error) throw error;
  return data;
}

// Get single subscription by ID (only if it belongs to user)
async function getSubscriptionById(subscriptionId, userId) {
  const { data, error } = await supabase
    .from("Subscriptions")
    .select("*, Subscription_Plans(*)")
    .eq("Subscription Id", subscriptionId)
    .eq("User Id", userId)
    .single();
  if (error) throw error;
  return data;
}

// Purchase a new plan
async function purchasePlan(userId, planId, newEndDate = null) {
  const insertObj = {
    "User Id": userId,
    "Product Id": planId,
    "Start Date": new Date(),
    "Last Renewed Date": new Date(),
    "Grace Time": 0,
  };
  if (newEndDate) insertObj["End Date"] = newEndDate;

  const { data, error } = await supabase
    .from("Subscriptions")
    .insert([insertObj])
    .select();
  if (error) throw error;
  return data[0];
}

// Upgrade subscription (only higher-priced plans)
async function upgradeSubscription(subscriptionId, targetPlanId, userId) {
  const { data: currentSub, error: subErr } = await supabase
    .from("Subscriptions")
    .select("*, Subscription_Plans(*)")
    .eq("Subscription Id", subscriptionId)
    .eq("User Id", userId)
    .single();
  if (subErr) throw subErr;

  const { data: targetPlan, error: planErr } = await supabase
    .from("Subscription_Plans")
    .select("*")
    .eq("plan_id", targetPlanId)
    .single();
  if (planErr) throw planErr;

  if (targetPlan.price_per_month <= currentSub.Subscription_Plans.price_per_month) {
    throw new Error("Target plan must be higher priced for upgrade");
  }

  const { data, error } = await supabase
    .from("Subscriptions")
    .update({ "Product Id": targetPlanId })
    .eq("Subscription Id", subscriptionId)
    .eq("User Id", userId)
    .select();

  if (error) throw error;
  return data[0];
}

// Downgrade subscription (only lower-priced plans)
async function downgradeSubscription(subscriptionId, targetPlanId, userId) {
  const { data: currentSub, error: subErr } = await supabase
    .from("Subscriptions")
    .select("*, Subscription_Plans(*)")
    .eq("Subscription Id", subscriptionId)
    .eq("User Id", userId)
    .single();
  if (subErr) throw subErr;

  const { data: targetPlan, error: planErr } = await supabase
    .from("Subscription_Plans")
    .select("*")
    .eq("plan_id", targetPlanId)
    .single();
  if (planErr) throw planErr;

  if (targetPlan.price_per_month >= currentSub.Subscription_Plans.price_per_month) {
    throw new Error("Target plan must be cheaper for downgrade");
  }

  const { data, error } = await supabase
    .from("Subscriptions")
    .update({ "Product Id": targetPlanId })
    .eq("Subscription Id", subscriptionId)
    .eq("User Id", userId)
    .select();

  if (error) throw error;
  return data[0];
}

// Get all plans higher than current plan
async function getUpgradePlans(currentPlanId) {
  const { data: currentPlan, error } = await supabase
    .from("Subscription_Plans")
    .select("*")
    .eq("plan_id", currentPlanId)
    .single();
  if (error) throw error;

  const { data: upgradePlans, error: upErr } = await supabase
    .from("Subscription_Plans")
    .select("*")
    .gt("price_per_month", currentPlan.price_per_month)
    .order("price_per_month", { ascending: true });
  if (upErr) throw upErr;

  return upgradePlans;
}

// Get all plans lower than current plan
async function getDowngradePlans(currentPlanId) {
  const { data: currentPlan, error } = await supabase
    .from("Subscription_Plans")
    .select("*")
    .eq("plan_id", currentPlanId)
    .single();
  if (error) throw error;

  const { data: downgradePlans, error: downErr } = await supabase
    .from("Subscription_Plans")
    .select("*")
    .lt("price_per_month", currentPlan.price_per_month)
    .order("price_per_month", { descending: true });
  if (downErr) throw downErr;

  return downgradePlans;
}

// Renew subscription
async function renewSubscription(userId, subscriptionId, newEndDate) {
  if (!userId || !subscriptionId || !newEndDate) {
    throw new Error("userId, subscriptionId, and newEndDate are required");
  }

  const { data, error } = await supabase
    .from("Subscriptions")
    .update({ "End Date": newEndDate, "Last Renewed Date": new Date() })
    .eq("Subscription Id", subscriptionId)
    .eq("User Id", userId)
    .select();

  if (error) throw error;
  return data[0];
}

// Cancel subscription
async function cancelSubscription(userId, subscriptionId) {
  if (!userId || !subscriptionId) {
    throw new Error("userId and subscriptionId are required");
  }

  const { data, error } = await supabase
    .from("Subscriptions")
    .update({ Status: "cancelled" })
    .eq("Subscription Id", subscriptionId)
    .eq("User Id", userId)
    .select();

  if (error) throw error;
  return data[0];
}

module.exports = {
  getAllPlans,
  getSubscriptions,
  getSubscriptionById,
  purchasePlan,
  upgradeSubscription,
  downgradeSubscription,
  getUpgradePlans,
  getDowngradePlans,
  renewSubscription,
  cancelSubscription,
};
