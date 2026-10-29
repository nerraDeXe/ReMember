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
  const filteredEvents = categoryFilter === 'all'
    ? events
    : events.filter(e => e.category === categoryFilter);

  return (
    <div className="page-stack">
      {/* Page Header */}
      <div className="events-calendar-header">
        <div>
          <h1 className="page-title">
            <Calendar className="events-calendar-calendar-icon" />
            Community Events Calendar & RSVP
          </h1>
          <p className="page-description">
            Reserve your seat at exclusive community gatherings, workshops, and symposiums.
          </p>
        </div>

        {/* Category Filters */}
        <div className="events-calendar-filters">
          <Filter className="events-calendar-filter-icon" />
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`events-calendar-filter-button ${
                categoryFilter === cat
                  ? "events-calendar-filter-selected"
                  : "events-calendar-filter-idle"
              }`}
            >
              {cat === 'all' ? 'All Events' : cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="events-calendar-loading">
          <RefreshCw className="loading-spinner" />
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="events-calendar-empty">
          <Calendar className="events-calendar-empty-icon" />
          No events found for this filter.
        </div>
      ) : (
        <div className="events-calendar-cards">
          {filteredEvents.map((event) => {
            const timing = getEventTiming(event, now);
            const isRsvped = event.isRsvped;
            const isEligible = event.isAllowedTier;
            const accessLabel = event.tierAccessLabel || getEventAccessLabel(event);
            const capacityRatio = Math.min(100, Math.round(((event.rsvpCount || 0) / (event.capacity || 100)) * 100));

            return (
              <div
                  key={event._id}
                  data-event-card
                className={`events-calendar-event-card ${
                  isRsvped
                    ? "events-calendar-event-attending"
                    : "events-calendar-event-available"
                }`}
              >
                <div>
                  {/* Event Thumbnail */}
                  <div className="events-calendar-thumbnail">
                    {event.imageUrl ? <img
                      src={event.imageUrl}
                      alt={event.title}
                      className="events-calendar-thumbnail-image"
                      loading="lazy"
                    /> : <div className="events-calendar-thumbnail-placeholder"><Calendar aria-hidden="true" className="events-calendar-thumbnail-icon" /><span className="sr-only">Community event</span></div>}

                    <div className="events-calendar-category-position">
                      <span className="events-calendar-category-badge">
                        {event.category}
                      </span>
                    </div>

                    {isRsvped && (
                      <div className="events-calendar-attending-badge">
                        <CheckCircle className="icon-small" />
                        <span>{timing.status === 'ended' ? 'RSVP recorded' : "You're Attending"}</span>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="events-calendar-event-content">
                    <div>
                      <h3 className="events-calendar-card-title">
                        {event.title}
                      </h3>
                      <div className="events-calendar-event-status"><EventStatusBadge status={timing.status} /></div>
                      <p className="events-calendar-event-description">
                        {event.description}
                      </p>
                    </div>

                    <div className="events-calendar-event-details">
                      <EventSchedule event={event} compact />
                      <EventLocation event={event} />
                    </div>

                    {/* Capacity Meter */}
                    <div className="events-calendar-capacity">
                      <div className="events-calendar-capacity-summary">
                        <span className="events-calendar-capacity-label">
                          <Users className="icon-small" /> RSVPs
                        </span>
                        <span className="events-calendar-capacity-count">
                          {event.rsvpCount || 0} / {event.capacity} seats reserved ({event.spotsLeft} left)
                        </span>
                      </div>
                      <div className="events-calendar-capacity-track">
                        <div
                          className={`events-calendar-capacity-bar ${
                            capacityRatio > 85 ? "events-calendar-capacity-nearly-full" : "events-calendar-capacity-available"
                          }`}
                          style={{ width: `${capacityRatio}%` }}
                        />
                      </div>
                    </div>

                    {/* Required Tiers */}
                    <div className="events-calendar-tier-access">
                      <span className="events-calendar-tier-label">
                        Eligible Tiers:
                      </span>
                      <span className="events-calendar-access-badge">{accessLabel}</span>
                      {event.allowedTiers?.length > 0 && (
                        event.allowedTiers.map((tName, i) => (
                          <span
                            key={i}
                            className={`events-calendar-tier-badge ${
                              tName === user?.tierName
                                ? "events-calendar-tier-current"
                                : "events-calendar-tier-other"
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
                <div className="events-calendar-event-footer">
                  {timing.status === 'ended' ? <p className="events-calendar-ended-notice">Event ended{isRsvped ? ' · Your RSVP is recorded' : ' · RSVPs closed'}</p> : isRsvped ? (
                    <button
                      onClick={() => handleCancelRsvp(event)}
                      disabled={actionPendingId === event._id}
                      className="events-calendar-cancel-rsvp-button"
                    >
                      {actionPendingId === event._id ? (
                        <RefreshCw className="events-calendar-spinner" />
                      ) : (
                        <XCircle className="icon-small" />
                      )}
                      <span>Cancel My RSVP</span>
                    </button>
                  ) : !timing.rsvpOpen ? <button type="button" disabled className="events-calendar-rsvp-closed-button">{timing.status === 'in_progress' ? 'Event started · RSVPs closed' : 'RSVP unavailable'}</button> : !isEligible ? (
                    <button
                      disabled
                      className="events-calendar-rsvp-unavailable-button"
                    >
                      Requires Tier Upgrade · {accessLabel}
                    </button>
                  ) : event.spotsLeft === 0 ? (
                    <button
                      disabled
                      className="events-calendar-rsvp-unavailable-button"
                    >
                      Event at Full Capacity
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRsvp(event)}
                      disabled={actionPendingId === event._id}
                      className="events-calendar-rsvp-button"
                    >
                      {actionPendingId === event._id ? (
                        <>
                          <RefreshCw className="events-calendar-spinner" />
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
