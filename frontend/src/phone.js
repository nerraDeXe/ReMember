import * as phoneLibrary from 'libphonenumber-js/max';
import { COUNTRIES } from '../../shared/countries.js';
import { normalisePhoneInput } from '../../shared/accountRules.js';

export const phoneCountry = country => COUNTRIES.find(item => item.name === country || item.code === country)?.code;
export function callingCode(country) {
  const code = phoneCountry(country);
  return phoneLibrary.isSupportedCountry(code) ? phoneLibrary.getCountryCallingCode(code) : '';
}
export function normalisePhone(phone, country) {
  return normalisePhoneInput(phone, phoneCountry(country), phoneLibrary);
}
export function rebasePhone(phone, oldCountry, newCountry) {
  if (!phone) return '';
  const previous = callingCode(oldCountry);
  const next = callingCode(newCountry);
  const digits = phone.replace(/\D/g, '');
  const national = previous && digits.startsWith(previous) ? digits.slice(previous.length) : digits;
  return national ? `+${next}${national}` : '';
}
