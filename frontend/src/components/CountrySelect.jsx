import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { COUNTRIES } from '../../../shared/countries.js';

const searchText = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function CountrySelect({ id, value, onChange, required = false, disabled = false }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const listId = `${inputId}-options`;
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const filter = searchText(query.trim());
  const options = COUNTRIES.filter((country) => searchText(country.name).includes(filter) || country.code.toLowerCase() === filter);

  useEffect(() => {
    if (value) setQuery(value);
  }, [value]);

  useEffect(() => {
    inputRef.current?.setCustomValidity(required && !COUNTRIES.some((country) => country.name === value) ? 'Please choose your country from the list.' : '');
  }, [value, required]);

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const choose = (country) => {
    setQuery(country.name);
    onChange(country.name);
    setOpen(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => !open ? 0 : Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      if (options[activeIndex]) choose(options[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    } else if (open && (event.key === 'Home' || event.key === 'End')) {
      event.preventDefault();
      setActiveIndex(event.key === 'Home' ? 0 : Math.max(0, options.length - 1));
    }
  };

  return (
    <div className="relative" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        const match = COUNTRIES.find((country) => searchText(country.name) === searchText(query.trim()) || country.code.toLowerCase() === query.trim().toLowerCase());
        if (match) choose(match);
        setOpen(false);
      }
    }}>
      <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" aria-hidden="true" />
      <input
        ref={inputRef}
        id={inputId}
        name="country"
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[activeIndex] ? `${listId}-${options[activeIndex].code}` : undefined}
        aria-describedby={`${inputId}-hint`}
        autoComplete="off"
        value={query}
        required={required}
        disabled={disabled}
        placeholder="Search for your country"
        onFocus={() => { setOpen(true); setActiveIndex(0); }}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange('');
          setActiveIndex(0);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        onInvalid={() => setOpen(true)}
        className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:border-brand-primary"
      />
      <button type="button" tabIndex={-1} aria-label={open ? 'Close country choices' : 'Show country choices'} disabled={disabled}
        className="absolute right-1 top-1 p-2 text-slate-500" onMouseDown={(event) => event.preventDefault()}
        onClick={() => { inputRef.current?.focus(); setOpen(!open); }}>
        <ChevronDown className="w-4 h-4" aria-hidden="true" />
      </button>
      <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-slate-500">Type to search, then choose a country.</p>
      {open && (
        <ul id={listId} ref={listRef} role="listbox" aria-label="Countries" className="absolute z-30 top-11 inset-x-0 max-h-60 overflow-y-auto rounded-lg border border-slate-300 bg-white py-1 shadow-lg">
          {options.map((country, index) => (
            <li key={country.code} id={`${listId}-${country.code}`} role="option" aria-selected={value === country.name} data-index={index}
              className={`px-3.5 py-2.5 text-sm cursor-pointer flex items-center justify-between gap-2 ${index === activeIndex ? 'bg-brand-50 text-brand-ink' : 'text-slate-800 hover:bg-slate-50'}`}
              onMouseDown={(event) => event.preventDefault()} onMouseMove={() => setActiveIndex(index)} onClick={() => choose(country)}>
              <span>{country.name}</span>
              {value === country.name && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
            </li>
          ))}
          {!options.length && <li className="px-3.5 py-3 text-sm text-slate-500" role="presentation">No matching countries.</li>}
        </ul>
      )}
      <span className="sr-only" aria-live="polite">{open ? `${options.length} countries available.` : ''}</span>
    </div>
  );
}
