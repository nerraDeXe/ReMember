// Translate the previous built-in defaults while preserving custom badge colours.
const defaultTierBadges = {
  'tier-bronze': { color: '#F4D03F', previous: ['#b45309', '#ff8c00'] },
  'tier-silver': { color: '#BEBEBE', previous: ['#64748b', '#ffc300'] },
  'tier-gold': { color: '#FFD700', previous: ['#d97706', '#ff5f00'] },
  'tier-platinum': { color: '#FFDA44', previous: ['#4338ca', '#ffd400'] },
};

export function getTierBadgeColor(tier) {
  const preset = defaultTierBadges[tier?._id];
  const storedColor = tier?.badgeColor;
  if (preset && (!storedColor || preset.previous.includes(storedColor.toLowerCase()))) {
    return preset.color;
  }
  return storedColor || '#FFD700';
}
