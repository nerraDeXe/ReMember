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
const inputClass = "email-template-input";

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
    className: `${inputClass} ${multiline ? 'email-template-multiline' : ''}`,
  };

  return <div className="detail-stack">
    <div className="email-template-heading">
      <label htmlFor={id} className="email-template-field-label">{label}</label>
      <span className="email-template-character-count">{value.length.toLocaleString()} / {maxLength.toLocaleString()}</span>
    </div>
    {multiline ? <textarea {...fieldProps} rows={7} /> : <input {...fieldProps} type="text" />}
    <div className="email-template-tags" role="group" aria-label={`${templateTitle} ${target} tags`}>
      <span id={`${id}-tags-help`} className="email-template-tags-label">Add a tag:</span>
      {EMAIL_TEMPLATE_TOKENS.map(token => <button key={token} type="button"
        aria-label={`Insert ${tagNames[token].toLowerCase()} into ${templateTitle.toLowerCase()} ${target}`}
        title={`Insert {${token}}`}
        onMouseDown={event => event.preventDefault()}
        onClick={() => insertTag(token)}
        className="email-template-insert-tag">
        <Plus className="icon-tiny" aria-hidden="true" />{tagNames[token]}
      </button>)}
    </div>
    {message && <p id={`${id}-tag-status`} role="status" className="email-template-tag-status">{message}</p>}
  </div>;
}
