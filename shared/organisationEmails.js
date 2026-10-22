export const EMAIL_TEMPLATE_TOKENS = Object.freeze(['memberName', 'organisationName', 'tierName', 'expiryDate', 'renewalDays']);

const defaults = {
  welcome: {
    enabled: true,
    subject: 'Welcome to {organisationName}, {memberName}!',
    body: 'Hello {memberName},\n\nWelcome to {organisationName}! Your {tierName} membership is now active.\n\nWe look forward to seeing you in our community.\n\n{organisationName}'
  },
  renewal: {
    enabled: false,
    subject: 'Your {organisationName} membership is due for renewal',
    body: 'Hello {memberName},\n\nYour {tierName} membership with {organisationName} expires on {expiryDate}. Please sign in to renew your membership and keep enjoying your benefits.\n\nThank you,\n{organisationName}',
    daysBefore: 30
  }
};

/** Fill missing settings for organisations created before email customisation. */
export function getOrganisationEmailSettings(input) {
  return Object.fromEntries(Object.entries(defaults).map(([type, fallback]) => [type, {
    ...fallback,
    ...Object.fromEntries(Object.keys(fallback).filter(key => input?.[type]?.[key] !== undefined).map(key => [key, input[type][key]]))
  }]));
}

/** Validate plain-text templates before they are saved by an organisation owner. */
export function normaliseOrganisationEmailSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Provide valid organisation email settings.');
  const output = getOrganisationEmailSettings(input);
  for (const type of ['welcome', 'renewal']) {
    if (input[type] !== undefined && (!input[type] || typeof input[type] !== 'object' || Array.isArray(input[type]))) throw new Error(`Provide valid ${type} email settings.`);
    const settings = output[type];
    if (typeof settings.enabled !== 'boolean') throw new Error(`Choose whether the ${type} email is enabled.`);
    for (const [field, limit] of [['subject', 160], ['body', 5000]]) {
      if (typeof settings[field] !== 'string' || !settings[field].trim() || settings[field].length > limit) throw new Error(`The ${type} email ${field} must contain 1 to ${limit} characters.`);
      settings[field] = settings[field].replace(/\r\n?/g, '\n').trim();
      if (field === 'subject' && /[\r\n]/.test(settings[field])) throw new Error('Email subjects must be a single line.');
      const tokens = settings[field].matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g);
      for (const [, token] of tokens) {
        if (!EMAIL_TEMPLATE_TOKENS.includes(token)) throw new Error(`Unsupported email placeholder: {${token}}.`);
      }
    }
  }
  if (!Number.isInteger(output.renewal.daysBefore) || output.renewal.daysBefore < 1 || output.renewal.daysBefore > 365) throw new Error('Renewal reminders must be sent 1 to 365 days before expiry.');
  return output;
}

/** Values are inserted once so member-supplied braces cannot expand placeholders. */
export function interpolateOrganisationEmail(template, context) {
  return String(template).replace(/\{(memberName|organisationName|tierName|expiryDate|renewalDays)\}/g, (_, token) => String(context[token] ?? ''));
}
