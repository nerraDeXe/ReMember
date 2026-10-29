export const DEFAULT_MEMBERSHIP_BADGE_COLOR = '#FFD700';

export function isBadgeColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

export function getOrganisationBadgeColor(organisation) {
  return isBadgeColor(organisation?.badgeColor) ? organisation.badgeColor : DEFAULT_MEMBERSHIP_BADGE_COLOR;
}

// Pick the higher-contrast foreground for both light and dark accents.
export function getBadgeTextColor(color) {
  const hex = isBadgeColor(color) ? color : DEFAULT_MEMBERSHIP_BADGE_COLOR;
  const channels = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#ffffff';
}
