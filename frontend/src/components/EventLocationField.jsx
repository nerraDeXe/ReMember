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
    <div className="content-stack">
      <label htmlFor="event-location" className="venue-label">Location / venue <span aria-hidden="true">*</span></label>
      <div className="venue-search-field">
        <MapPin className="venue-input-icon" aria-hidden="true" />
        <input id="event-location" type="text" value={value} onChange={handleChange} onKeyDown={event => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); search(); }
        }} maxLength={500} required disabled={disabled} aria-describedby="event-location-help" placeholder="Search a venue name or enter its full address" className="venue-input" />
      </div>
      <p id="event-location-help" className="venue-search-help">Search for a venue or address and choose a result. You can also enter a complete address directly.</p>
      <div className="venue-search-actions">
        <button id="event-location-search" type="button" onClick={search} disabled={!canSearch} aria-controls="event-location-results" className="venue-search-button">
          {searching ? <RefreshCw className="venue-search-spinner" aria-hidden="true" /> : <Search className="icon-small" aria-hidden="true" />}
          {searching ? 'Searching...' : 'Search OpenStreetMap'}
        </button>
        {selected && <span className="venue-selected"><CheckCircle2 className="icon-small" aria-hidden="true" />Location selected</span>}
      </div>
      {query.length > 200 && <p className="venue-search-status">Use up to 200 characters to search. You can keep this longer address as the event location.</p>}
      {query.length > 0 && query.length < 3 && <p className="venue-search-minimum">Enter at least 3 characters to search.</p>}
      <div role="status" aria-live="polite" aria-atomic="true" className="venue-search-status">
        {searching && 'Searching OpenStreetMap for matching venues...'}
        {status === 'complete' && (locations.length ? `${locations.length} matching ${locations.length === 1 ? 'location' : 'locations'}. Choose the venue below.` : 'No matching locations found. Try a more specific venue or enter the full address directly.')}
      </div>
      {error && <p role="alert" className="venue-search-error">{error}</p>}
      <div id="event-location-results">
        {locations.length > 0 && <ul aria-label="Matching event locations" className="venue-results">
          {locations.map((location, index) => <li key={`${location.id}-${index}`}><button type="button" disabled={disabled} onClick={() => selectLocation(location)} className="venue-result"><MapPin className="venue-result-icon" aria-hidden="true" /><span className="venue-result-address">{location.label}</span></button></li>)}
        </ul>}
      </div>
      <div className="venue-map-links">
        {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="venue-map-link">Preview in Google Maps<ExternalLink className="icon-tiny" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>}
        {selected && <a href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`} target="_blank" rel="noopener noreferrer" className="venue-map-link">View in OpenStreetMap<ExternalLink className="icon-tiny" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>}
      </div>
      <p className="venue-attribution">Search data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="venue-attribution-link">OpenStreetMap contributors</a>.</p>
    </div>
  );
}
