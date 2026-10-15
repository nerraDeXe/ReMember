import React, { useEffect, useId, useRef, useState } from 'react';
import { Upload, Trash2, RefreshCw } from 'lucide-react';
import { IMAGE_MIME_TYPES, MAX_IMAGE_SIZE } from '../../../shared/imageUploads.js';
import OrganisationImage from './OrganisationImage.jsx';

export default function ImageUploadField({ label, kind, value, onChange, onBusyChange, disabled = false }) {
  const inputId = useId();
  const readRevision = useRef(0);
  const readerRef = useRef(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => () => {
    readRevision.current += 1;
    readerRef.current?.abort();
  }, []);

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    if (!IMAGE_MIME_TYPES.includes(file.type)) {
      setError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (!file.size || file.size > MAX_IMAGE_SIZE) {
      setError('Choose an image up to 2 MB.');
      return;
    }
    const revision = ++readRevision.current;
    setReading(true);
    onBusyChange?.(true);
    const reader = new FileReader();
    readerRef.current = reader;
    const finish = (message, source) => {
      if (revision !== readRevision.current) return;
      if (message) setError(message);
      else onChange(source);
      setReading(false);
      onBusyChange?.(false);
    };
    reader.onerror = () => finish('Could not read this image. Please try again.');
    reader.onload = () => {
      // Check the browser can decode the file before replacing the saved image.
      const source = String(reader.result);
      const preview = new Image();
      preview.onload = () => finish('', source);
      preview.onerror = () => finish('This file could not be opened as an image.');
      preview.src = source;
    };
    reader.readAsDataURL(file);
  };

  const busy = disabled || reading;
  return (
    <div className="rounded-xl border border-slate-200 p-4 space-y-3">
      <p className="text-xs font-bold text-slate-700">{label}</p>
      <OrganisationImage src={value} kind={kind} alt={`${label} preview`} className={`rounded-lg border border-slate-200 ${kind === 'banner' ? 'h-24 w-full' : 'h-24 w-24'}`} />
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-primary text-brand-ink text-xs font-semibold focus-within:ring-2 focus-within:ring-brand-muted ${busy ? 'opacity-60' : 'cursor-pointer hover:bg-brand-secondary'}`}>
          {reading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {reading ? 'Reading…' : value ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
          <input id={inputId} type="file" accept={IMAGE_MIME_TYPES.join(',')} onChange={handleUpload} disabled={busy} className="sr-only" />
        </label>
        {value && <button type="button" disabled={busy} onClick={() => { onChange(''); setError(''); }} aria-label={`Remove ${label.toLowerCase()}`} className="inline-flex items-center gap-1 px-2 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-60"><Trash2 className="w-3.5 h-3.5" />Remove</button>}
      </div>
      <p className="text-[11px] text-slate-500">JPEG, PNG, or WebP. Up to 2 MB.</p>
      {error && <p role="alert" className="text-xs text-slate-700">{error}</p>}
    </div>
  );
}
