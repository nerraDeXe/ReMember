import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Calendar, Users, CheckCircle, XCircle, RefreshCw, Filter } from 'lucide-react';
import { api } from '../../api.js';
import EventSchedule, { EventLocation, EventStatusBadge } from '../../components/EventSchedule.jsx';
import { getEventAccessLabel } from '../../../../shared/events.js';
import { useUrlState } from '../../routing.jsx';
import { getEventTiming } from '../../../../shared/eventTiming.js';
import { useEventNow } from '../../useEventNow.js';

export default function EventsCalendarPage() {
  const { user, getCurrentUser } = useAuth();
  const { showToast } = useToast();
  const now = useEventNow();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useUrlState('category', 'all');
  const [selectedEventId, setSelectedEventId] = useUrlState('event');
  const selectedEventRef = useRef(null);
  const [actionPendingId, setActionPendingId] = useState(null);
  const organisationId = user?.activeOrganisationId;
  const requestVersion = useRef(0);
  const isCurrentOrganisation = (snapshot) => getCurrentUser()?.activeOrganisationId === snapshot;

  const loadEvents = async () => {
    const snapshot = organisationId;
    const version = ++requestVersion.current;
    try {
      const data = await api.getEvents(snapshot);
      if (version !== requestVersion.current || !isCurrentOrganisation(snapshot)) return;
      if (data.success) {
        setEvents(data.events || []);
      }
    } catch (err) {
      if (version !== requestVersion.current || !isCurrentOrganisation(snapshot)) return;
      console.error('Failed to load events:', err);
      showToast('Could not load events: ' + err.message, 'error');
    } finally {
      if (version === requestVersion.current && isCurrentOrganisation(snapshot)) setLoading(false);
    }
  };

  useEffect(() => {
    setEvents([]);
    setLoading(true);
    setActionPendingId(null);
    loadEvents();
    return () => { requestVersion.current += 1; };
  }, [organisationId]);

  useEffect(() => {
    if (!loading && selectedEventId) {
      selectedEventRef.current?.scrollIntoView({ block: 'start' });
      selectedEventRef.current?.focus({ preventScroll: true });
    }
  }, [loading, selectedEventId, events]);

  const handleRsvp = async (event) => {
    if (!getEventTiming(event).rsvpOpen) { showToast('This event has started or ended. RSVPs are closed.', 'info'); return; }
    const snapshot = organisationId;
    setActionPendingId(event._id);
    try {
      const response = await api.rsvpEvent(event._id, snapshot);
      if (!isCurrentOrganisation(snapshot)) return;
      if (response.success) {
        showToast(response.message || `RSVP confirmed for "${event.title}"!`, response.emailDelivery && response.emailDelivery !== 'sent' ? 'info' : 'success');
        await loadEvents();
      }
    } catch (err) {
      if (!isCurrentOrganisation(snapshot)) return;
      showToast(err.message || 'RSVP failed.', 'error');
    } finally {
      if (isCurrentOrganisation(snapshot)) setActionPendingId(null);
    }
  };

  const handleCancelRsvp = async (event) => {
    const snapshot = organisationId;
    setActionPendingId(event._id);
    try {
      const response = await api.cancelRsvpEvent(event._id, snapshot);
      if (!isCurrentOrganisation(snapshot)) return;
      if (response.success) {
        showToast('RSVP cancelled.', 'info');
        await loadEvents();
      }
    } catch (err) {
      if (!isCurrentOrganisation(snapshot)) return;
      showToast(err.message || 'Failed to cancel RSVP.', 'error');
    } finally {
      if (isCurrentOrganisation(snapshot)) setActionPendingId(null);
    }
  };

  const categories = ['all', 'Gala', 'Workshop', 'Networking', 'Executive Briefing'];
  const filteredEvents = selectedEventId ? events.filter(event => event._id === selectedEventId) : categoryFilter === 'all'
    ? events
    : events.filter(e => e.category === categoryFilter);

  return (
    <div className="page-stack">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Calendar className="icon-brand-large" />
            Community Events Calendar & RSVP
          </h1>
          <p className="page-description">
            Reserve your seat at exclusive community gatherings, workshops, and symposiums.
          </p>
        </div>

        {/* Category Filters */}
        <div className="row-inline-tight calendar-filters">
          <Filter className="icon-small calendar-filter-icon" />
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => { setSelectedEventId(''); setCategoryFilter(cat); }}
              className={`filter-tab ${
                categoryFilter === cat
                  ? "tab-selected"
                  : "calendar-filter-idle"
              }`}
            >
              {cat === 'all' ? 'All Events' : cat}
            </button>
          ))}
        </div>
      </div>

      {selectedEventId && <button type="button" onClick={() => { setSelectedEventId(''); setCategoryFilter('all'); }} className="button-muted button-inline button-small">View all events</button>}

      {loading ? (
        <div className="loading-container items-center">
          <RefreshCw className="loading-spinner" />
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="surface-card text-caption calendar-empty">
          <Calendar className="empty-state-icon" />
          {selectedEventId ? 'This event is no longer available.' : 'No events found for this filter.'}
        </div>
      ) : (
        <div className="calendar-grid">
          {filteredEvents.map((event) => {
            const timing = getEventTiming(event, now);
            const isRsvped = event.isRsvped;
            const isEligible = event.isAllowedTier;
            const accessLabel = event.tierAccessLabel || getEventAccessLabel(event);
            const capacityRatio = Math.min(100, Math.round(((event.rsvpCount || 0) / (event.capacity || 100)) * 100));

            return (
              <div
                  key={event._id}
                  ref={event._id === selectedEventId ? selectedEventRef : undefined}
                  tabIndex={event._id === selectedEventId ? -1 : undefined}
                  aria-label={event._id === selectedEventId ? `Selected event: ${event.title}` : undefined}
                  data-event-card
                className={`calendar-card ${
                  isRsvped
                    ? "calendar-card-reserved"
                    : "calendar-card-idle"
                }`}
              >
                <div>
                  {/* Event Thumbnail */}
                  <div className="calendar-thumbnail">
                    {event.imageUrl ? <img
                      src={event.imageUrl}
                      alt={event.title}
                      className="calendar-image opacity-90"
                      loading="lazy"
                    /> : <div className="icon-center calendar-placeholder"><Calendar aria-hidden="true" className="calendar-placeholder-icon" /><span className="sr-only">Community event</span></div>}

                    <div className="calendar-category-position">
                      <span className="badge-meta calendar-category">
                        {event.category}
                      </span>
                    </div>

                    {isRsvped && (
                      <div className="row-inline-tight calendar-reserved-badge">
                        <CheckCircle className="icon-small" />
                        <span>{timing.status === 'ended' ? 'RSVP recorded' : "You're Attending"}</span>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="form-stack p-6">
                    <div>
                      <h3 className="section-title leading-snug">
                        {event.title}
                      </h3>
                      <div className="mt-2"><EventStatusBadge status={timing.status} /></div>
                      <p className="text-help calendar-description">
                        {event.description}
                      </p>
                    </div>

                    <div className="detail-stack member-event-details">
                      <EventSchedule event={event} compact />
                      <EventLocation event={event} />
                    </div>

                    {/* Capacity Meter */}
                    <div className="surface-muted calendar-capacity">
                      <div className="row-between text-[11px]">
                        <span className="row-icon text-slate-500">
                          <Users className="icon-small" /> RSVPs
                        </span>
                        <span className="text-strong">
                          {event.rsvpCount || 0} / {event.capacity} seats reserved ({event.spotsLeft} left)
                        </span>
                      </div>
                      <div className="progress-track">
                        <div
                          className={`calendar-capacity-fill ${
                            capacityRatio > 85 ? "calendar-capacity-high" : "calendar-capacity-normal"
                          }`}
                          style={{ width: `${capacityRatio}%` }}
                        />
                      </div>
                    </div>

                    {/* Required Tiers */}
                    <div className="row-inline-tight flex-wrap">
                      <span className="calendar-tier-label">
                        Eligible Tiers:
                      </span>
                      <span className="badge-neutral badge-small">{accessLabel}</span>
                      {event.allowedTiers?.length > 0 && (
                        event.allowedTiers.map((tName, i) => (
                          <span
                            key={i}
                            className={`badge-small calendar-tier-badge ${
                              tName === user?.tierName
                                ? "choice-selected calendar-tier-current"
                                : "calendar-tier-other"
                            }`}
                          >
                            {tName}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* RSVP Action Footer */}
                <div className="calendar-footer">
                  {timing.status === 'ended' ? <p className="surface-subtle calendar-closed">Event ended{isRsvped ? ' · Your RSVP is recorded' : ' · RSVPs closed'}</p> : isRsvped ? (
                    <button
                      onClick={() => handleCancelRsvp(event)}
                      disabled={actionPendingId === event._id}
                      className="button-icon-brand button-content calendar-cancel"
                    >
                      {actionPendingId === event._id ? (
                        <RefreshCw className="icon-small-spinner" />
                      ) : (
                        <XCircle className="icon-small" />
                      )}
                      <span>Cancel My RSVP</span>
                    </button>
                  ) : !timing.rsvpOpen ? <button type="button" disabled className="surface-subtle text-label-muted calendar-action-size">{timing.status === 'in_progress' ? 'Event started · RSVPs closed' : 'RSVP unavailable'}</button> : !isEligible ? (
                    <button
                      disabled
                      className="surface-subtle calendar-unavailable"
                    >
                      Requires Tier Upgrade · {accessLabel}
                    </button>
                  ) : event.spotsLeft === 0 ? (
                    <button
                      disabled
                      className="surface-subtle calendar-unavailable"
                    >
                      Event at Full Capacity
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRsvp(event)}
                      disabled={actionPendingId === event._id}
                      className="button-primary button-content calendar-rsvp"
                    >
                      {actionPendingId === event._id ? (
                        <>
                          <RefreshCw className="icon-small-spinner" />
                          <span>Dispatching RSVP & Confirmation Email...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="icon-small" />
                          <span>RSVP Directly (Instant Confirmation)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
