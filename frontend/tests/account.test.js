import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordError } from '../../shared/accountRules.js';
import { normalisePhone, callingCode, rebasePhone } from '../src/phone.js';
import { sessionExpiry } from '../src/session.js';
import { getPageAfterContextChange } from '../src/navigation.js';

test('Password checks accept complete requirements and enforce the bcrypt byte limit for Unicode', () => {
  assert.equal(passwordError('ExamplePassword1!'), '');
  assert.equal(passwordError('Éxample123!'), '');
  for (const password of ['lowercase1!', 'NoDigits!!!', 'NoSymbols123', 'Short1!', 'A1!' + 'é'.repeat(35)]) assert.ok(passwordError(password));
});

test('Country calling codes and phone numbers use digits with a maximum of 15 digits', () => {
  assert.equal(callingCode('Malaysia'), '60');
  assert.equal(callingCode('United Kingdom'), '44');
  assert.equal(normalisePhone('0123456789', 'Malaysia'), '+60123456789');
  assert.equal(normalisePhone('+12025550123', 'United States'), '+12025550123');
  assert.equal(normalisePhone('', 'Malaysia'), '');
  for (const value of ['+6012345678901234', '012-3456789', '+12025550123']) assert.throws(() => normalisePhone(value, 'Malaysia'));
  assert.equal(rebasePhone('+60123456789', 'Malaysia', 'United Kingdom'), '+44123456789');
  assert.equal(rebasePhone('', 'Malaysia', 'United Kingdom'), '');
});

test('Expiry parsing handles 30-day sessions and rejects malformed or missing expiries', () => {
  const exp = Math.floor(Date.now() / 1000) + 30 * 86400;
  const token = `header.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.signature`;
  assert.equal(sessionExpiry(token), exp * 1000);
  assert.equal(sessionExpiry('invalid'), 0);
  assert.equal(sessionExpiry('header.e30.signature'), 0);
});

test('Password reset links remain usable when an existing account session loads', () => {
  const account = { organisationRole: 'owner', activeOrganisationId: 'owned' };
  assert.equal(getPageAfterContextChange('reset-password', account), 'reset-password');
  assert.equal(getPageAfterContextChange('forgot-password', account), 'forgot-password');
});
