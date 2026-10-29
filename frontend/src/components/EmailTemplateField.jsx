import React, { useLayoutEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { EMAIL_TEMPLATE_TOKENS } from '../../../shared/organisationEmails.js';

const tagNames = {
  memberName: 'Member name',
  organisationName: 'Organisation name',
  tierName: 'Membership tier',
  expiryDate: 'Expiry date',
  renewalDays: 'Reminder days',
};
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-slate-50';

export default function EmailTemplateField({ id, label, templateTitle, value, onChange, maxLength, multiline = false }) {
  const fieldRef = useRef(null);
  const pendingCaret = useRef(null);
  const [message, setMessage] = useState('');
  const target = multiline ? 'message' : 'subject';

  useLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    fieldRef.current?.focus();
    fieldRef.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [value]);

  function insertTag(token) {
    const field = fieldRef.current;
    if (!field) return;
    const start = field.selectionStart ?? value.length;
    const end = field.selectionEnd ?? start;
    const tag = `{${token}}`;
    const nextValue = value.slice(0, start) + tag + value.slice(end);
    if (nextValue.length > maxLength) {
      setMessage(`This tag would exceed the ${maxLength.toLocaleString()}-character limit. Shorten the text or select text to replace.`);
      return;
    }
    setMessage('');
    const caret = start + tag.length;
    if (nextValue === value) {
      field.focus();
      field.setSelectionRange(caret, caret);
    } else {
      pendingCaret.current = caret;
      onChange(nextValue);
    }
  }

  const fieldProps = {
    id, ref: fieldRef, required: true, maxLength, value,
    'aria-describedby': `${id}-tags-help${message ? ` ${id}-tag-status` : ''}`,
    onChange: event => { setMessage(''); onChange(event.target.value); },
    className: `${inputClass}${multiline ? ' resize-y' : ''}`,
  };

  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700">{label}</label>
      <span className="text-[11px] text-slate-500 tabular-nums">{value.length.toLocaleString()} / {maxLength.toLocaleString()}</span>
    </div>
    {multiline ? <textarea {...fieldProps} rows={7} /> : <input {...fieldProps} type="text" />}
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`${templateTitle} ${target} tags`}>
      <span id={`${id}-tags-help`} className="text-[11px] text-slate-500 mr-1">Add a tag:</span>
      {EMAIL_TEMPLATE_TOKENS.map(token => <button key={token} type="button"
        aria-label={`Insert ${tagNames[token].toLowerCase()} into ${templateTitle.toLowerCase()} ${target}`}
        title={`Insert {${token}}`}
        onMouseDown={event => event.preventDefault()}
        onClick={() => insertTag(token)}
        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-brand-primary hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-50">
        <Plus className="w-3 h-3" aria-hidden="true" />{tagNames[token]}
      </button>)}
    </div>
    {message && <p id={`${id}-tag-status`} role="status" className="text-xs text-amber-800">{message}</p>}
  </div>;
}
