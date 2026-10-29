import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { X, Calendar, Plus, RefreshCw, Clock3, Users } from 'lucide-react';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import ImageUploadField from './ImageUploadField.jsx';
import EventLocationField from './EventLocationField.jsx';
import { earliestEventDate, eventLocalDate } from '../../../shared/eventTiming.js';
import { useEventNow } from '../useEventNow.js';
import {
  DEFAULT_EVENT_TIME_ZONE, EVENT_MAX_DAYS, getEventDates, getEligibleEventTiers, sortEventTiers,
} from '../../../shared/events.js';

const inputClass = "event-modal-input";
const labelClass = "field-label";
const timeZones = [...new Set([
  DEFAULT_EVENT_TIME_ZONE, 'UTC',
  ...(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [
    'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Tokyo', 'Asia/Kolkata',
    'Australia/Sydney', 'Europe/London', 'America/New_York', 'America/Los_Angeles',
  ]),
])];

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
  const [startDate, setStartDate] = useState(() => earliestEventDate());
  const [endDate, setEndDate] = useState(() => earliestEventDate());
  const [dayTimes, setDayTimes] = useState({});
  const [timeZone, setTimeZone] = useState(DEFAULT_EVENT_TIME_ZONE);
  const now = useEventNow();
  const minimumDate = earliestEventDate(timeZone, now);
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
  try {
    dates = getEventDates(startDate, endDate);
    if (startDate < minimumDate) dateError = 'Choose tomorrow or a later date in the event time zone.';
  }
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
    if (startDate <= eventLocalDate(new Date(), timeZone)) { setError('Events must start tomorrow or later. Today and past dates are not allowed.'); return; }
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
    <div style={{ margin: 0 }} className="event-modal-overlay">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={headingId} onKeyDown={handleDialogKeyDown} className="event-modal-dialog">
        <div className="event-modal-header">
          <div className="event-modal-heading">
            <div className="event-modal-icon"><Calendar className="icon-medium" /></div>
            <div>
              <h2 id={headingId} className="card-title">Create Community Event</h2>
              <p className="event-modal-intro">Share a venue, a daily schedule and membership access.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close create event" className="event-modal-close"><X className="icon-medium" /></button>
        </div>

        <form onSubmit={handleSubmit} className="event-modal-form">
          <fieldset disabled={busy} className="event-modal-fields">
            <div className="form-stack">
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

            <section aria-labelledby="event-schedule-heading" className="event-modal-form-section">
              <h3 id="event-schedule-heading" className="event-modal-schedule-heading"><Clock3 className="icon-default" />Dates and daily times</h3>
              <p className="event-modal-schedule-help">Use the same start and end date for a single-day event. For multiple days, choose times for each day. Up to {EVENT_MAX_DAYS} days.</p>
              <div className="event-modal-date-fields">
                <div>
                  <label htmlFor="event-start-date" className={labelClass}>Start date</label>
                  <input id="event-start-date" type="date" value={startDate} min={minimumDate} onChange={event => {
                    const next = event.target.value;
                    if (endDate === startDate || (next && endDate < next)) setEndDate(next);
                    setStartDate(next); setError('');
                  }} required className={inputClass} />
                </div>
                <div>
                  <label htmlFor="event-end-date" className={labelClass}>End date</label>
                  <input id="event-end-date" type="date" value={endDate} min={startDate && startDate > minimumDate ? startDate : minimumDate} onChange={event => { setEndDate(event.target.value); setError(''); }} required className={inputClass} />
                </div>
              </div>
              {dateError && <p role="alert" className="event-modal-schedule-error">{dateError}</p>}
              <p className="event-modal-date-policy">New events must start tomorrow or later in the selected event time zone. RSVPs close when the event starts.</p>
              <div className="event-modal-field-offset">
                <label htmlFor="event-time-zone" className={labelClass}>Event time zone</label>
                <select id="event-time-zone" value={timeZone} onChange={event => setTimeZone(event.target.value)} className={inputClass}>
                  {timeZones.map(zone => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}
                </select>
                <p className="event-modal-timezone-help">All daily times below use this time zone.</p>
              </div>
              <div className="event-modal-daily-schedule">
                {schedule.map((day, index) => {
                  const invalidTime = day.startTime && day.endTime && day.endTime <= day.startTime;
                  return (
                    <fieldset key={day.date} className="event-modal-schedule-day">
                      <legend className="event-modal-day-label">{schedule.length > 1 ? `Day ${index + 1} · ` : ''}{dateLabel(day.date)}</legend>
                      <div className="event-modal-time-fields">
                        <div>
                          <label htmlFor={`event-${day.date}-start-time`} className={labelClass}>Start time</label>
                          <input id={`event-${day.date}-start-time`} aria-label={`Start time for ${day.date}`} type="time" value={day.startTime} onChange={event => updateTime(day.date, 'startTime', event.target.value)} required className={inputClass} />
                        </div>
                        <div>
                          <label htmlFor={`event-${day.date}-end-time`} className={labelClass}>End time</label>
                          <input id={`event-${day.date}-end-time`} aria-label={`End time for ${day.date}`} type="time" value={day.endTime} onChange={event => updateTime(day.date, 'endTime', event.target.value)} required aria-invalid={Boolean(invalidTime)} className={inputClass} />
                        </div>
                      </div>
                      {invalidTime && <p className="event-modal-schedule-error">End time must be after the start time on this day.</p>}
                    </fieldset>
                  );
                })}
              </div>
              <p className="event-modal-overnight-help">For an overnight event, split the schedule across its calendar days.</p>
            </section>

            <div className="form-stack">
              <EventLocationField
                value={location} onChange={setLocation} placeId={locationPlaceId} onPlaceIdChange={setLocationPlaceId}
                latitude={locationCoordinates.latitude} longitude={locationCoordinates.longitude} onCoordinatesChange={setLocationCoordinates}
                organisationId={organisationId} onBusyChange={setSearchingLocation} disabled={busy}
              />
              <div className="event-modal-capacity-field">
                <label htmlFor="event-capacity" className={labelClass}>Capacity limit</label>
                <input id="event-capacity" type="number" value={capacity} onChange={event => setCapacity(event.target.value)} min="1" max="100000" step="1" required className={inputClass} />
              </div>
            </div>

            <section aria-labelledby="event-access-heading" className="event-modal-form-section">
              <h3 id="event-access-heading" className="event-modal-access-heading"><Users className="icon-default" />Membership access</h3>
              <div className="content-stack">
                <label className="event-modal-all-tiers-option">
                  <input type="radio" name="event-access" value="all" checked={tierAccess === 'all'} onChange={() => setTierAccess('all')} className="event-modal-access-radio" />
                  <span><span className="event-modal-option-title">All membership tiers</span><span className="text-caption">Every active member in this organisation can RSVP.</span></span>
                </label>
                <label className={`event-modal-minimum-tier-option ${rankedTiers.length ? "event-modal-option-enabled" : "event-modal-option-disabled"}`}>
                  <input type="radio" name="event-access" value="minimum" checked={tierAccess === 'minimum'} onChange={() => setTierAccess('minimum')} disabled={!rankedTiers.length} className="event-modal-access-radio" />
                  <span><span className="event-modal-option-title">Selected tier and higher tiers</span><span className="text-caption">Choose the lowest tier that can attend.</span></span>
                </label>
              </div>
              {tierAccess === 'minimum' && <div className="event-modal-field-offset">
                <label htmlFor="event-minimum-tier" className={labelClass}>Minimum membership tier</label>
                <select id="event-minimum-tier" value={effectiveMinimumTierId} onChange={event => setMinimumTierId(event.target.value)} required className={inputClass}>
                  {rankedTiers.map(tier => <option key={tier._id} value={tier._id}>{tier.name} · MYR {tier.price || 0}/{tier.interval || 'monthly'}</option>)}
                </select>
                <p className="event-modal-tier-order-help">Tiers are ordered by their equivalent monthly price. Tiers with the same monthly price share access.</p>
              </div>}
              <div className="event-modal-eligible-summary">
                <p className="event-modal-eligible-label">{tierAccess === 'all' ? 'Available to all tiers' : 'Eligible tiers'}</p>
                <div className="event-modal-eligible-tiers">
                  {eligibleTiers.map(tier => <span key={tier._id} className="event-modal-eligible-tier">{tier.name}</span>)}
                  {!rankedTiers.length && <p className="text-caption">All active members. Add membership tiers to set tier restrictions.</p>}
                </div>
              </div>
            </section>
          </fieldset>

          {error && <p role="alert" className="event-modal-submit-error">{error}</p>}
          <div className="event-modal-footer">
            <button type="button" onClick={onClose} disabled={busy} className="event-modal-cancel">Cancel</button>
            <button type="submit" disabled={busy || searchingLocation || Boolean(dateError)} className="event-modal-create">
              {busy || searchingLocation ? <RefreshCw className="icon-spinner" /> : <Plus className="icon-default" />}
              {saving ? 'Publishing event...' : readingImage ? 'Reading header image...' : searchingLocation ? 'Searching location...' : 'Publish Community Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
