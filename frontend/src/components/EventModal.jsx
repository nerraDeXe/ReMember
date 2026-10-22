import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { X, Calendar, Plus, RefreshCw, Clock3, Users } from 'lucide-react';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import ImageUploadField from './ImageUploadField.jsx';
import EventLocationField from './EventLocationField.jsx';
import {
  DEFAULT_EVENT_TIME_ZONE, EVENT_MAX_DAYS, getEventDates, getEligibleEventTiers, sortEventTiers,
} from '../../../shared/events.js';

const inputClass = 'w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-slate-50 disabled:text-slate-500';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-700';
const timeZones = [...new Set([
  DEFAULT_EVENT_TIME_ZONE, 'UTC',
  ...(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [
    'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Tokyo', 'Asia/Kolkata',
    'Australia/Sydney', 'Europe/London', 'America/New_York', 'America/Los_Angeles',
  ]),
])];

function today() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DEFAULT_EVENT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = type => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function dateLabel(date) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

// Each opening mounts a fresh form, including its upload and validation state.
export default function EventModal({ isOpen, ...props }) {
  return isOpen ? <EventForm {...props} /> : null;
}

function EventForm({ onClose, onCreated, tiers = [], organisationId }) {
  const { showToast } = useToast();
  const headingId = useId();
  const dialogRef = useRef(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [dayTimes, setDayTimes] = useState({});
  const [timeZone, setTimeZone] = useState(DEFAULT_EVENT_TIME_ZONE);
  const [location, setLocation] = useState('');
  const [locationPlaceId, setLocationPlaceId] = useState('');
  const [locationCoordinates, setLocationCoordinates] = useState({ latitude: null, longitude: null });
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [capacity, setCapacity] = useState(100);
  const [tierAccess, setTierAccess] = useState('all');
  const [minimumTierId, setMinimumTierId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [readingImage, setReadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = saving || readingImage;
  const rankedTiers = useMemo(() => sortEventTiers(tiers), [tiers]);
  const effectiveMinimumTierId = minimumTierId || rankedTiers[0]?._id || '';
  const eligibleTiers = tierAccess === 'all' ? rankedTiers : getEligibleEventTiers(rankedTiers, effectiveMinimumTierId);
  let dates = [];
  let dateError = '';
  try { dates = getEventDates(startDate, endDate); }
  catch (err) { dateError = err.message; }
  const schedule = dates.map(date => ({ date, ...(dayTimes[date] || { startTime: '09:00', endTime: '17:00' }) }));

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector('input')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, []);

  const handleDialogKeyDown = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!busy) onClose();
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')]
      .filter(element => element.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };

  const updateTime = (date, field, value) => {
    setDayTimes(previous => ({ ...previous, [date]: { startTime: '09:00', endTime: '17:00', ...previous[date], [field]: value } }));
    setError('');
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (busy || searchingLocation) return;
    setError('');
    if (!title.trim() || !description.trim() || !location.trim()) {
      setError('Add an event title, description and location before publishing.');
      return;
    }
    if (dateError || !schedule.length) { setError(dateError || 'Choose the event start and end dates.'); return; }
    const invalidDay = schedule.find(day => !day.startTime || !day.endTime || day.endTime <= day.startTime);
    if (invalidDay) { setError(`Choose an end time after the start time for ${dateLabel(invalidDay.date)}.`); return; }
    if (!Number.isInteger(Number(capacity)) || Number(capacity) < 1 || Number(capacity) > 100000) { setError('Capacity must be a whole number between 1 and 100,000.'); return; }
    if (tierAccess === 'minimum' && !rankedTiers.some(tier => tier._id === effectiveMinimumTierId)) {
      setError('Choose an available membership tier.'); return;
    }
    setSaving(true);
    try {
      const response = await api.createEvent({
        title: title.trim(), description: description.trim(), startDate, endDate, schedule,
        timeZone, location: location.trim(), locationPlaceId, category: 'Networking',
        locationLatitude: locationCoordinates.latitude, locationLongitude: locationCoordinates.longitude,
        capacity: Number(capacity), tierAccess, minimumTierId: tierAccess === 'minimum' ? effectiveMinimumTierId : null,
        imageUrl, organisationId,
      });
      if (!response.success) throw new Error(response.message || 'Failed to create event.');
      showToast(`Event "${title.trim()}" published!`, 'success');
      onCreated?.();
      onClose();
    } catch (err) { setError(err.message || 'Failed to create event. Please try again.'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ margin: 0 }} className="fixed inset-0 z-50 flex items-start justify-center overflow-clip bg-brand-muted/40 p-3 sm:p-5">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={headingId} onKeyDown={handleDialogKeyDown} className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2.5rem)]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:px-6 sm:py-5">
          <div className="flex items-center gap-3">
            <div className="hidden rounded-lg bg-brand-primary p-2 text-brand-ink sm:block"><Calendar className="h-5 w-5" /></div>
            <div>
              <h2 id={headingId} className="text-base font-bold text-slate-900">Create Community Event</h2>
              <p className="mt-0.5 text-xs text-slate-500">Share a venue, a daily schedule and membership access.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close create event" className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 disabled:opacity-40"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 overflow-y-auto p-4 sm:p-6">
          <fieldset disabled={busy} className="min-w-0 space-y-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="event-title" className={labelClass}>Event title</label>
                <input id="event-title" type="text" value={title} onChange={event => setTitle(event.target.value)} maxLength={160} placeholder="e.g. Community leadership meetup" required className={inputClass} />
              </div>
              <div>
                <label htmlFor="event-description" className={labelClass}>Description</label>
                <textarea id="event-description" rows={3} value={description} onChange={event => setDescription(event.target.value)} maxLength={5000} placeholder="Tell members about the agenda, speakers and what to bring." required className={inputClass} />
              </div>
              <ImageUploadField label="Header image" kind="banner" value={imageUrl} onChange={setImageUrl} onBusyChange={setReadingImage} disabled={busy} />
            </div>

            <section aria-labelledby="event-schedule-heading" className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <h3 id="event-schedule-heading" className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-900"><Clock3 className="h-4 w-4" />Dates and daily times</h3>
              <p className="mb-4 text-xs leading-relaxed text-slate-500">Use the same start and end date for a single-day event. For multiple days, choose times for each day. Up to {EVENT_MAX_DAYS} days.</p>
              <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2">
                <div>
                  <label htmlFor="event-start-date" className={labelClass}>Start date</label>
                  <input id="event-start-date" type="date" value={startDate} onChange={event => {
                    const next = event.target.value;
                    if (endDate === startDate || (next && endDate < next)) setEndDate(next);
                    setStartDate(next); setError('');
                  }} required className={inputClass} />
                </div>
                <div>
                  <label htmlFor="event-end-date" className={labelClass}>End date</label>
                  <input id="event-end-date" type="date" value={endDate} min={startDate || undefined} onChange={event => { setEndDate(event.target.value); setError(''); }} required className={inputClass} />
                </div>
              </div>
              {dateError && <p role="alert" className="mt-2 text-xs text-red-700">{dateError}</p>}
              <div className="mt-4">
                <label htmlFor="event-time-zone" className={labelClass}>Event time zone</label>
                <select id="event-time-zone" value={timeZone} onChange={event => setTimeZone(event.target.value)} className={inputClass}>
                  {timeZones.map(zone => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}
                </select>
                <p className="mt-1.5 text-[11px] text-slate-500">All daily times below use this time zone.</p>
              </div>
              <div className="mt-4 space-y-3">
                {schedule.map((day, index) => {
                  const invalidTime = day.startTime && day.endTime && day.endTime <= day.startTime;
                  return (
                    <fieldset key={day.date} className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 pb-3">
                      <legend className="px-1 pt-2 text-xs font-semibold text-slate-800">{schedule.length > 1 ? `Day ${index + 1} · ` : ''}{dateLabel(day.date)}</legend>
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor={`event-${day.date}-start-time`} className={labelClass}>Start time</label>
                          <input id={`event-${day.date}-start-time`} aria-label={`Start time for ${day.date}`} type="time" value={day.startTime} onChange={event => updateTime(day.date, 'startTime', event.target.value)} required className={inputClass} />
                        </div>
                        <div>
                          <label htmlFor={`event-${day.date}-end-time`} className={labelClass}>End time</label>
                          <input id={`event-${day.date}-end-time`} aria-label={`End time for ${day.date}`} type="time" value={day.endTime} onChange={event => updateTime(day.date, 'endTime', event.target.value)} required aria-invalid={Boolean(invalidTime)} className={inputClass} />
                        </div>
                      </div>
                      {invalidTime && <p className="mt-2 text-xs text-red-700">End time must be after the start time on this day.</p>}
                    </fieldset>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">For an overnight event, split the schedule across its calendar days.</p>
            </section>

            <div className="space-y-4">
              <EventLocationField
                value={location} onChange={setLocation} placeId={locationPlaceId} onPlaceIdChange={setLocationPlaceId}
                latitude={locationCoordinates.latitude} longitude={locationCoordinates.longitude} onCoordinatesChange={setLocationCoordinates}
                organisationId={organisationId} onBusyChange={setSearchingLocation} disabled={busy}
              />
              <div className="max-w-xs">
                <label htmlFor="event-capacity" className={labelClass}>Capacity limit</label>
                <input id="event-capacity" type="number" value={capacity} onChange={event => setCapacity(event.target.value)} min="1" max="100000" step="1" required className={inputClass} />
              </div>
            </div>

            <section aria-labelledby="event-access-heading" className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <h3 id="event-access-heading" className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900"><Users className="h-4 w-4" />Membership access</h3>
              <div className="space-y-3">
                <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
                  <input type="radio" name="event-access" value="all" checked={tierAccess === 'all'} onChange={() => setTierAccess('all')} className="mt-1 accent-brand-ink" />
                  <span><span className="block font-semibold">All membership tiers</span><span className="text-xs text-slate-500">Every active member in this organisation can RSVP.</span></span>
                </label>
                <label className={`flex items-start gap-2.5 text-sm ${rankedTiers.length ? 'cursor-pointer text-slate-700' : 'text-slate-400'}`}>
                  <input type="radio" name="event-access" value="minimum" checked={tierAccess === 'minimum'} onChange={() => setTierAccess('minimum')} disabled={!rankedTiers.length} className="mt-1 accent-brand-ink" />
                  <span><span className="block font-semibold">Selected tier and higher tiers</span><span className="text-xs text-slate-500">Choose the lowest tier that can attend.</span></span>
                </label>
              </div>
              {tierAccess === 'minimum' && <div className="mt-4">
                <label htmlFor="event-minimum-tier" className={labelClass}>Minimum membership tier</label>
                <select id="event-minimum-tier" value={effectiveMinimumTierId} onChange={event => setMinimumTierId(event.target.value)} required className={inputClass}>
                  {rankedTiers.map(tier => <option key={tier._id} value={tier._id}>{tier.name} · Level {tier.accessLevel || 1} · ${tier.price || 0}/{tier.interval || 'monthly'}</option>)}
                </select>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Tiers are ordered by access level, then their equivalent monthly price. Tiers with the same level and price share access.</p>
              </div>}
              <div className="mt-4 border-t border-slate-200 pt-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{tierAccess === 'all' ? 'Available to all tiers' : 'Eligible tiers'}</p>
                <div className="flex flex-wrap gap-1.5">
                  {eligibleTiers.map(tier => <span key={tier._id} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">{tier.name}</span>)}
                  {!rankedTiers.length && <p className="text-xs text-slate-500">All active members. Add membership tiers to set tier restrictions.</p>}
                </div>
              </div>
            </section>
          </fieldset>

          {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={busy || searchingLocation || Boolean(dateError)} className="flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-bold text-brand-ink shadow-sm transition-colors hover:bg-brand-secondary disabled:cursor-wait disabled:opacity-60">
              {busy || searchingLocation ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {saving ? 'Publishing event...' : readingImage ? 'Reading header image...' : searchingLocation ? 'Searching location...' : 'Publish Community Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
