import React from 'react';
import { callingCode } from '../phone.js';

export default function PhoneInput({ country, value, onChange, id, disabled = false }) {
  const prefix = callingCode(country);
  const digits = value.replace(/\D/g, '');
  const national = prefix && digits.startsWith(prefix) ? digits.slice(prefix.length) : digits;
  const limit = 15 - prefix.length;
  return (
    <div>
      <div className="phone-control">
        <span className="control-editor phone-prefix" aria-label="Country calling code">+{prefix}</span>
        <input id={id} type="tel" inputMode="numeric" autoComplete="tel-national" value={national} maxLength={limit} disabled={disabled || !country} aria-describedby={`${id}-hint`} onChange={event => {
          let input = event.target.value;
          let next = input.replace(/\D/g, '');
          if ((input.startsWith('+') || input.startsWith('00')) && prefix) {
            if (input.startsWith('00')) next = next.slice(2);
            if (next.startsWith(prefix)) next = next.slice(prefix.length);
          }
          next = next.slice(0, limit);
          onChange(next ? `+${prefix}${next}` : '');
        }} className="control-editor phone-number" />
      </div>
      <p id={`${id}-hint`} className="text-caption mt-1.5">{country ? 'Digits only. Maximum 15 digits including the country code.' : 'Choose your country first.'}</p>
    </div>
  );
}
