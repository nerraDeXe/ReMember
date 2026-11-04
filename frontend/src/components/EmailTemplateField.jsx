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
const inputClass = "control control-ring-strong control-editor disabled:bg-slate-50";

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
    className: `${inputClass} ${multiline ? 'resize-y' : ''}`,
  };

  return <div className="detail-stack">
    <div className="row-inline-wide justify-between">
      <label htmlFor={id} className="field-heading">{label}</label>
      <span className="text-note tabular-nums">{value.length.toLocaleString()} / {maxLength.toLocaleString()}</span>
    </div>
    {multiline ? <textarea {...fieldProps} rows={7} /> : <input {...fieldProps} type="text" />}
    <div className="row-inline-tight flex-wrap" role="group" aria-label={`${templateTitle} ${target} tags`}>
      <span id={`${id}-tags-help`} className="text-note mr-1">Add a tag:</span>
      {EMAIL_TEMPLATE_TOKENS.map(token => <button key={token} type="button"
        aria-label={`Insert ${tagNames[token].toLowerCase()} into ${templateTitle.toLowerCase()} ${target}`}
        title={`Insert {${token}}`}
        onMouseDown={event => event.preventDefault()}
        onClick={() => insertTag(token)}
        className="row-icon-tight email-template-token">
        <Plus className="icon-tiny" aria-hidden="true" />{tagNames[token]}
      </button>)}
    </div>
    {message && <p id={`${id}-tag-status`} role="status" className="text-xs text-amber-800">{message}</p>}
  </div>;
}
