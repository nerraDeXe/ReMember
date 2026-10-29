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
    <div className="image-upload-field">
      <p className="image-upload-label">{label}</p>
      <OrganisationImage src={value} kind={kind} alt={`${label} preview`} className={`image-upload-preview ${kind === 'banner' ? "image-upload-banner-preview" : "image-upload-logo-preview"}`} />
      <div className="image-upload-actions">
        <label htmlFor={inputId} className={`image-upload-choose ${busy ? "image-upload-busy" : "image-upload-ready"}`}>
          {reading ? <RefreshCw className="image-upload-reading" /> : <Upload className="icon-small" />}
          {reading ? 'Reading…' : value ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
          <input id={inputId} type="file" accept={IMAGE_MIME_TYPES.join(',')} onChange={handleUpload} disabled={busy} className="sr-only" />
        </label>
        {value && <button type="button" disabled={busy} onClick={() => { onChange(''); setError(''); }} aria-label={`Remove ${label.toLowerCase()}`} className="image-upload-remove"><Trash2 className="icon-small" />Remove</button>}
      </div>
      <p className="image-upload-file-help">JPEG, PNG, or WebP. Up to 2 MB.</p>
      {error && <p role="alert" className="image-upload-error">{error}</p>}
    </div>
  );
}
