import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Calendar, Users, CheckCircle, XCircle, RefreshCw, Filter } from 'lucide-react';
import { api } from '../../api.js';
import EventSchedule, { EventLocation } from '../../components/EventSchedule.jsx';
import { getEventAccessLabel } from '../../../../shared/events.js';
import { useUrlState } from '../../routing.jsx';
import { getEventTiming } from '../../../../shared/eventTiming.js';
import EventStatusBadge from '../../components/EventStatusBadge.jsx';
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-brand-ink" />
            Community Events Calendar & RSVP
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Reserve your seat at exclusive community gatherings, workshops, and symposiums.
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1 shrink-0" />
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                categoryFilter === cat
                  ? 'bg-brand-primary text-brand-ink shadow-sm'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              {cat === 'all' ? 'All Events' : cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-brand-ink animate-spin" />
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200 p-8 text-slate-500 text-xs shadow-sm">
          <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          No events found for this filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredEvents.map((event) => {
            const timing = getEventTiming(event, now);
            const isRsvped = event.isRsvped;
            const isEligible = event.isAllowedTier;
            const accessLabel = event.tierAccessLabel || getEventAccessLabel(event);
            const capacityRatio = Math.min(100, Math.round(((event.rsvpCount || 0) / (event.capacity || 100)) * 100));

            return (
              <div
                key={event._id}
                className={`rounded-xl border bg-white shadow-sm overflow-hidden flex flex-col justify-between transition-all ${
                  isRsvped
                    ? 'border-brand-primary ring-1 ring-brand-primary/50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Event Thumbnail */}
                  <div className="h-44 relative overflow-hidden bg-slate-100">
                    {event.imageUrl ? <img
                      src={event.imageUrl}
                      alt={event.title}
                      className="w-full h-full object-cover opacity-90"
                      loading="lazy"
                    /> : <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100"><Calendar aria-hidden="true" className="h-16 w-16 text-slate-300" /><span className="sr-only">Community event</span></div>}

                    <div className="absolute top-3 left-3 flex gap-2">
                      <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-white text-brand-ink border border-brand-silver">
                        {event.category}
                      </span>
                    </div>

                    {isRsvped && (
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1 rounded bg-brand-accent text-brand-ink font-bold text-xs shadow-sm">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>{timing.status === 'ended' ? 'RSVP recorded' : "You're Attending"}</span>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-6 space-y-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 leading-snug">
                        {event.title}
                      </h3>
                      <div className="mt-2"><EventStatusBadge status={timing.status} /></div>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                        {event.description}
                      </p>
                    </div>

                    <div className="space-y-2 text-xs text-slate-700">
                      <EventSchedule event={event} compact />
                      <EventLocation event={event} />
                    </div>

                    {/* Capacity Meter */}
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" /> RSVPs
                        </span>
                        <span className="font-semibold text-slate-900">
                          {event.rsvpCount || 0} / {event.capacity} seats reserved ({event.spotsLeft} left)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            capacityRatio > 85 ? 'bg-brand-secondary' : 'bg-brand-primary'
                          }`}
                          style={{ width: `${capacityRatio}%` }}
                        />
                      </div>
                    </div>

                    {/* Required Tiers */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] uppercase font-bold text-slate-500">
                        Eligible Tiers:
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">{accessLabel}</span>
                      {event.allowedTiers?.length > 0 && (
                        event.allowedTiers.map((tName, i) => (
                          <span
                            key={i}
                            className={`text-[10px] px-2 py-0.5 rounded border ${
                              tName === user?.tierName
                                ? 'bg-brand-50 text-brand-ink border-brand-primary font-bold'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
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
                <div className="p-6 pt-0">
                  {timing.status === 'ended' ? <p className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-center text-xs font-semibold text-slate-600">Event ended{isRsvped ? ' · Your RSVP is recorded' : ' · RSVPs closed'}</p> : isRsvped ? (
                    <button
                      onClick={() => handleCancelRsvp(event)}
                      disabled={actionPendingId === event._id}
                      className="w-full py-2.5 rounded-lg border border-brand-silver bg-slate-100 hover:bg-slate-200 text-brand-ink font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
                    >
                      {actionPendingId === event._id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      <span>Cancel My RSVP</span>
                    </button>
                  ) : !timing.rsvpOpen ? <button type="button" disabled className="w-full rounded-lg border border-slate-200 bg-slate-100 py-2.5 text-xs font-semibold text-slate-500">{timing.status === 'in_progress' ? 'Event started · RSVPs closed' : 'RSVP unavailable'}</button> : !isEligible ? (
                    <button
                      disabled
                      className="w-full py-2.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-400 font-medium text-xs cursor-not-allowed"
                    >
                      Requires Tier Upgrade · {accessLabel}
                    </button>
                  ) : event.spotsLeft === 0 ? (
                    <button
                      disabled
                      className="w-full py-2.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-400 font-medium text-xs cursor-not-allowed"
                    >
                      Event at Full Capacity
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRsvp(event)}
                      disabled={actionPendingId === event._id}
                      className="w-full py-2.5 rounded-lg bg-brand-primary hover:bg-brand-secondary text-brand-ink font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm active:scale-[0.99]"
                    >
                      {actionPendingId === event._id ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Dispatching RSVP & Confirmation Email...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
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
