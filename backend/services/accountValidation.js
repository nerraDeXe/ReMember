import * as phoneLibrary from 'libphonenumber-js/max';
import { COUNTRIES } from '../../shared/countries.js';
import { normalisePhoneInput } from '../../shared/accountRules.js';

export function countryChoice(value) {
  return typeof value === 'string' && COUNTRIES.find(country => country.name === value.trim() || country.code === value.trim().toUpperCase());
}

export function normaliseAccountPhone(phone, country) {
  return normalisePhoneInput(phone, countryChoice(country)?.code, phoneLibrary);
}

export function validateAccountDetails(body) {
  const { firstName, lastName, country, phone = '', bio = '' } = body;
  if (![firstName, lastName].every(value => typeof value === 'string' && value.trim() && value.trim().length <= 100)) throw new Error('Enter your first and last name, up to 100 characters each.');
  const selectedCountry = countryChoice(country);
  if (!selectedCountry) throw new Error('Choose a country from the country list.');
  if (typeof bio !== 'string' || bio.length > 500) throw new Error('Member bio must be 500 characters or fewer.');
  return { firstName: firstName.trim(), lastName: lastName.trim(), name: `${firstName.trim()} ${lastName.trim()}`, country: selectedCountry.name, address: { country: selectedCountry.name }, phone: normaliseAccountPhone(phone, selectedCountry.name), bio: bio.trim() };
}
