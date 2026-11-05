export const DUPLICATE_TIER_PRICING_MESSAGE = 'A tier with this price and billing interval already exists in your organisation.';

// Compare amounts as integer cents so 10, 10.0 and "10.00" share one price.
export function tierPricingKey(tier = {}) {
  const raw = tier.price;
  if (!['number', 'string'].includes(typeof raw)) return null;
  if (typeof raw === 'string' && !/^\d+(\.\d{1,2})?$/.test(raw.trim())) return null;
  const price = Number(raw);
  const cents = Math.round(price * 100);
  if (!Number.isFinite(price) || price < 0 || price > 1000000 || Math.abs(price * 100 - cents) > 0.00001) return null;
  const interval = tier.interval || 'monthly';
  if (!['monthly', 'yearly'].includes(interval)) return null;
  return `${interval}:${cents}`;
}

export function findTierPricingConflict(tiers, candidate, excludeId) {
  const key = tierPricingKey(candidate);
  if (key === null) return null;
  return tiers.find(tier =>
    (excludeId == null || String(tier._id) !== String(excludeId)) && tierPricingKey(tier) === key
  ) || null;
}

export function hasDuplicateTierPricing(tiers) {
  const keys = new Set();
  for (const tier of tiers) {
    const key = tierPricingKey(tier);
    if (key === null) continue;
    if (keys.has(key)) return true;
    keys.add(key);
  }
  return false;
}
