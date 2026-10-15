export const PASSWORD_HINT = 'Use at least 8 characters, including a capital letter, a number, and a symbol. Maximum 72 UTF-8 bytes.';

export function passwordError(password) {
  if (typeof password !== 'string' || password.length < 8 || new TextEncoder().encode(password).length > 72) return 'Password must be at least 8 characters and no more than 72 UTF-8 bytes.';
  if (!/\p{Lu}/u.test(password) || !/[0-9]/.test(password) || !/[\p{P}\p{S}]/u.test(password)) return 'Include a capital letter, a number, and a symbol in your password.';
  return '';
}

// Phone metadata is provided by each app's libphonenumber-js installation.
export function normalisePhoneInput(phone, countryCode, phoneLibrary) {
  if (typeof phone !== 'string') throw new Error('Enter a valid phone number.');
  const input = phone.trim();
  if (!input) return '';
  if (!/^\+?[0-9]+$/.test(input) || input.replace(/^\+/, '').length > 15) throw new Error('Use digits only, with at most 15 digits including the country code.');
  const country = phoneLibrary.isSupportedCountry(countryCode) ? countryCode : undefined;
  const parsed = phoneLibrary.parsePhoneNumberFromString(input, { defaultCountry: country, extract: false });
  if (!parsed || !parsed.isValid() || parsed.number.slice(1).length > 15) throw new Error('Enter a valid phone number for your selected country.');
  if (country && (parsed.countryCallingCode !== phoneLibrary.getCountryCallingCode(country) || (parsed.country && parsed.country !== country))) throw new Error('The phone number must match your selected country.');
  return parsed.number;
}
