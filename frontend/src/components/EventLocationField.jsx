import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ExternalLink, MapPin, RefreshCw, Search } from 'lucide-react';
import { api } from '../api.js';
import { getEventMapsUrl } from '../../../shared/events.js';

function validCoordinates(latitude, longitude) {
  return typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

export default function EventLocationField({
  value, onChange, placeId = '', onPlaceIdChange, disabled = false, organisationId,
  latitude = null, longitude = null, onCoordinatesChange, onBusyChange,
}) {
  const [locations, setLocations] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const revision = useRef(0);
  const context = useRef({ value, organisationId });
  context.current = { value, organisationId };
  const query = String(value || '').trim();
  const searching = status === 'searching';
  const canSearch = query.length >= 3 && query.length <= 200 && !disabled && !searching;
  const selected = validCoordinates(latitude, longitude);
  const mapsUrl = getEventMapsUrl({
    location: value, locationPlaceId: placeId,
    locationLatitude: latitude, locationLongitude: longitude,
  });

  useEffect(() => {
    revision.current += 1;
    setLocations([]);
    setStatus('idle');
    setError('');
    onBusyChange?.(false);
  }, [value, organisationId, onBusyChange]);

  useEffect(() => () => {
    revision.current += 1;
    onBusyChange?.(false);
  }, [onBusyChange]);

  const handleChange = event => {
    revision.current += 1;
    setLocations([]);
    setStatus('idle');
    setError('');
    onBusyChange?.(false);
    onChange(event.target.value);
    onPlaceIdChange?.('');
    onCoordinatesChange?.({ latitude: null, longitude: null });
  };

  const search = async () => {
    if (!canSearch) return;
    const currentRevision = ++revision.current;
    const originalValue = value;
    const originalOrganisation = organisationId;
    const isCurrent = () => currentRevision === revision.current
      && context.current.value === originalValue && context.current.organisationId === originalOrganisation;
    setLocations([]);
    setError('');
    setStatus('searching');
    onBusyChange?.(true);
    try {
      const response = await api.searchEventLocations(query, organisationId);
      if (!isCurrent()) return;
      if (!response.success) throw new Error(response.message || 'Could not search for locations. Please try again.');
      const results = (Array.isArray(response.locations) ? response.locations : [])
        .filter(item => typeof item?.label === 'string' && item.label.trim() && validCoordinates(item.latitude, item.longitude));
      setLocations(results);
      setStatus('complete');
    } catch (err) {
      if (!isCurrent()) return;
      setError(err.message || 'Location search is unavailable. Try again, or enter the full address directly.');
      setStatus('error');
    } finally {
      if (isCurrent()) onBusyChange?.(false);
    }
  };

  const selectLocation = location => {
    revision.current += 1;
    setLocations([]);
    setStatus('idle');
    setError('');
    onBusyChange?.(false);
    onChange(location.label);
    onPlaceIdChange?.('');
    onCoordinatesChange?.({ latitude: location.latitude, longitude: location.longitude });
  };

  return (
    <div className="space-y-3">
      <label htmlFor="event-location" className="block text-xs font-semibold text-slate-700">Location / venue <span aria-hidden="true">*</span></label>
      <div className="relative">
        <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
        <input id="event-location" type="text" value={value} onChange={handleChange} onKeyDown={event => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); search(); }
        }} maxLength={500} required disabled={disabled} aria-describedby="event-location-help" placeholder="Search a venue name or enter its full address" className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-slate-50" />
      </div>
      <p id="event-location-help" className="text-[11px] leading-relaxed text-slate-500">Search for a venue or address and choose a result. You can also enter a complete address directly.</p>
      <div className="flex flex-wrap items-center gap-2">
        <button id="event-location-search" type="button" onClick={search} disabled={!canSearch} aria-controls="event-location-results" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
          {searching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Search className="h-3.5 w-3.5" aria-hidden="true" />}
          {searching ? 'Searching...' : 'Search OpenStreetMap'}
        </button>
        {selected && <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />Location selected</span>}
      </div>
      {query.length > 200 && <p className="text-xs text-slate-600">Use up to 200 characters to search. You can keep this longer address as the event location.</p>}
      {query.length > 0 && query.length < 3 && <p className="text-[11px] text-slate-500">Enter at least 3 characters to search.</p>}
      <div role="status" aria-live="polite" aria-atomic="true" className="text-xs text-slate-600">
        {searching && 'Searching OpenStreetMap for matching venues...'}
        {status === 'complete' && (locations.length ? `${locations.length} matching ${locations.length === 1 ? 'location' : 'locations'}. Choose the venue below.` : 'No matching locations found. Try a more specific venue or enter the full address directly.')}
      </div>
      {error && <p role="alert" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">{error}</p>}
      <div id="event-location-results">
        {locations.length > 0 && <ul aria-label="Matching event locations" className="max-h-56 divide-y divide-slate-200 overflow-y-auto rounded-lg border border-slate-200 bg-white">
          {locations.map((location, index) => <li key={`${location.id}-${index}`}><button type="button" disabled={disabled} onClick={() => selectLocation(location)} className="flex w-full items-start gap-2.5 p-3 text-left text-xs leading-relaxed text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-primary disabled:opacity-50"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" aria-hidden="true" /><span className="min-w-0 break-words">{location.label}</span></button></li>)}
        </ul>}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 underline underline-offset-4">Preview in Google Maps<ExternalLink className="h-3 w-3" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>}
        {selected && <a href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 underline underline-offset-4">View in OpenStreetMap<ExternalLink className="h-3 w-3" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>}
      </div>
      <p className="text-[10px] text-slate-500">Search data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">OpenStreetMap contributors</a>.</p>
    </div>
  );
}
