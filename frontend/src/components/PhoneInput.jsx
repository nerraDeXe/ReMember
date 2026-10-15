import React from 'react';
import { callingCode } from '../phone.js';

export default function PhoneInput({ country, value, onChange, id, disabled = false }) {
  const prefix = callingCode(country);
  const digits = value.replace(/\D/g, '');
  const national = prefix && digits.startsWith(prefix) ? digits.slice(prefix.length) : digits;
  const limit = 15 - prefix.length;
  return (
    <div>
      <div className="flex rounded-lg border border-slate-300 bg-white overflow-hidden focus-within:border-brand-primary">
        <span className="px-3 py-2.5 border-r border-slate-200 bg-slate-50 text-sm text-slate-700" aria-label="Country calling code">+{prefix}</span>
        <input id={id} type="tel" inputMode="numeric" autoComplete="tel-national" value={national} maxLength={limit} disabled={disabled || !country} aria-describedby={`${id}-hint`} onChange={event => {
          let input = event.target.value;
          let next = input.replace(/\D/g, '');
          if ((input.startsWith('+') || input.startsWith('00')) && prefix) {
            if (input.startsWith('00')) next = next.slice(2);
            if (next.startsWith(prefix)) next = next.slice(prefix.length);
          }
          next = next.slice(0, limit);
          onChange(next ? `+${prefix}${next}` : '');
        }} className="w-full min-w-0 px-3 py-2.5 text-sm text-slate-900 bg-white disabled:bg-slate-50 focus:outline-none" />
      </div>
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">{country ? 'Digits only. Maximum 15 digits including the country code.' : 'Choose your country first.'}</p>
    </div>
  );
}
