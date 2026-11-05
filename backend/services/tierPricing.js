// Recognise this index specifically; other duplicate-key errors keep their normal handling.
export function isDuplicateTierPricingError(error) {
  return error?.code === 11000 && (
    Object.hasOwn(error.keyPattern || {}, 'pricingKey') ||
    Object.hasOwn(error.keyValue || {}, 'pricingKey') ||
    String(error.message || '').includes('unique_organisation_tier_pricing')
  );
}
