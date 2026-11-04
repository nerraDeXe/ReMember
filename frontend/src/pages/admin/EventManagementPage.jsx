import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, RefreshCw, Eye, X } from 'lucide-react';
import { api } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import EventModal from '../../components/EventModal.jsx';
import EventSchedule, { EventLocation, EventStatusBadge } from '../../components/EventSchedule.jsx';
import EventAnalytics from '../../components/EventAnalytics.jsx';
import { getEventTiming } from '../../../../shared/eventTiming.js';
import { useEventNow } from '../../useEventNow.js';
import { getEventAccessLabel, getEligibleEventTiers } from '../../../../shared/events.js';
import { useNavigation } from '../../routing.jsx';

export default function EventManagementPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const organisationId = user?.activeOrganisationId;
  const now = useEventNow();
  const [events, setEvents] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [requestLoading, setLoading] = useState(true);
  const [loadedOrganisationId, setLoadedOrganisationId] = useState(null);
  const loading = requestLoading || loadedOrganisationId !== organisationId;
  const [loadError, setLoadError] = useState('');
  const [tiersError, setTiersError] = useState('');
  const [reload, setReload] = useState(0);
  const [deletingId, setDeletingId] = useState('');
  const { route, getSnapshot, updateQuery, closeQuery } = useNavigation();
  const query = route.query;
  const eventRoute = query.get('event');
  const rosterId = query.get('roster');
  const inspectEvent = !loading ? events.find(event => event._id === rosterId) || null : null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    setTiersError('');
    setEvents([]);
    setTiers([]);
    Promise.allSettled([api.getEvents(organisationId), api.getTiers(organisationId)]).then(([eventResult, tierResult]) => {
      if (cancelled) return;
      if (eventResult.status === 'fulfilled' && eventResult.value.success) setEvents(eventResult.value.events || []);
      else setLoadError(eventResult.reason?.message || eventResult.value?.message || 'Could not load events.');
      if (tierResult.status === 'fulfilled' && tierResult.value.success) setTiers(tierResult.value.tiers || []);
      else setTiersError(tierResult.reason?.message || tierResult.value?.message || 'Could not load membership tiers.');
      setLoadedOrganisationId(organisationId);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [organisationId, reload]);

  const loadEvents = () => setReload(value => value + 1);

  const handleDeleteEvent = async (event) => {
    if (deletingId) return;
    if (!window.confirm(`Delete event "${event.title}"?`)) return;
    setDeletingId(event._id);
    try {
      const response = await api.deleteEvent(event._id, organisationId);
      if (response.success) {
        showToast(response.message, 'success');
        loadEvents();
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete event.', 'error');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="page-stack">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Calendar className="icon-brand-large" />
            Community Event Operations
          </h1>
          <p className="page-description">
            Publish events for {user?.activeOrganisation?.name || 'your organisation'} with daily schedules, venues and membership access.
          </p>
        </div>

        <div className="row-wrap-wide self-start sm:self-auto">
        <button type="button" onClick={loadEvents} disabled={loading} className="button-outline button-inline events-refresh"><RefreshCw className={`icon-default ${loading ? "animate-spin" : ''}`} aria-hidden="true" />Refresh events</button>
        <button
          onClick={() => updateQuery({ event: 'new', roster: null })}
          disabled={loading || Boolean(tiersError)}
          className="button-primary row-inline events-add-button"
        >
          <Plus className="icon-default" />
          <span>Create New Event</span>
        </button>
        </div>
      </div>

      {tiersError && <div role="alert" className="row-wrap-wide events-notice">
        <p>Membership access options could not be loaded. {tiersError}</p>
        <button onClick={loadEvents} className="link-underlined">Retry</button>
      </div>}

      {!loading && !loadError && <EventAnalytics key={organisationId} events={events} now={now} onInspectEvent={id => updateQuery({ roster: id, event: null })} />}

      {/* Events List */}
      <div className="table-frame">
        {loading ? (
          <div className="loading-container">
            <RefreshCw className="loading-spinner" />
          </div>
        ) : loadError ? (
          <div role="alert" className="text-description p-8 text-center">
            <p>{loadError}</p><button onClick={loadEvents} className="link-underlined mt-3">Retry</button>
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <Calendar className="empty-state-icon" />
            No events published yet.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table-base">
              <thead className="table-heading">
                <tr>
                  <th className="data-table-cell">Event Details</th>
                  <th className="data-table-cell">Date & Time</th>
                  <th className="data-table-cell">Location</th>
                  <th className="data-table-cell">RSVPs / Capacity</th>
                  <th className="data-table-cell">Allowed Tiers</th>
                  <th className="data-table-cell text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {events.map((evt) => {
                  const rsvpsCount = evt.rsvps?.length || 0;
                  const accessLabel = getEventAccessLabel(evt, tiers);
                  const eligibleTiers = evt.tierAccess === 'minimum' ? getEligibleEventTiers(tiers, evt.minimumTierId) : [];
                  return (
                    <tr key={evt._id} className="data-table-row">
                      <td className="data-table-cell">
                        <div className="panel-title">{evt.title}</div>
                        <div className="text-note mt-0.5 line-clamp-1">
                          {evt.description}
                        </div>
                        <div className="mt-2"><EventStatusBadge status={getEventTiming(evt, now).status} /></div>
                      </td>

                      <td className="data-table-cell event-date-cell">
                        <EventSchedule event={evt} compact />
                      </td>

                      <td className="data-table-cell event-location-cell">
                        <EventLocation event={evt} />
                      </td>

                      <td className="data-table-cell">
                        <div className="row-inline">
                          <span className="text-bold">
                            {rsvpsCount} / {evt.capacity}
                          </span>
                          <button
                            onClick={() => updateQuery({ roster: evt._id, event: null })}
                            className="row-icon badge-small event-category-action"
                            title="Inspect attendee list"
                          >
                            <Eye className="icon-tiny" />
                            <span>Attendees</span>
                          </button>
                        </div>
                      </td>

                      <td className="data-table-cell">
                        <p className="events-access-label">{accessLabel}</p>
                        <div className="event-access-tiers">
                          {(evt.tierAccess === 'minimum' ? eligibleTiers.map(tier => tier.name) : evt.allowedTiers || []).map((name, idx) => (
                              <span
                                key={idx}
                                className="badge-brand event-access-tier"
                              >
                                {name}
                              </span>
                            ))}
                        </div>
                      </td>

                      <td className="data-table-cell text-right">
                        <button
                          onClick={() => handleDeleteEvent(evt)}
                          disabled={Boolean(deletingId)}
                          className="button-icon-brand p-1.5 disabled:opacity-40"
                          title="Delete Event"
                          aria-label={`Delete ${evt.title}`}
                        >
                          {deletingId === evt._id ? <RefreshCw className="icon-spinner" /> : <Trash2 className="icon-default" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Event Modal */}
      <EventModal
        isOpen={eventRoute === 'new' && !loading && !tiersError}
        onClose={() => { if (getSnapshot() === route) closeQuery(['event']); }}
        onCreated={() => { if (getSnapshot() === route) loadEvents(); }}
        tiers={tiers}
        organisationId={organisationId}
      />

      {eventRoute === 'new' && !loading && tiersError && (
        <div role="alert" className="surface-card text-description p-5">
          <p>Membership access options are needed before creating an event. Retry loading the membership tiers above.</p>
          <button onClick={() => closeQuery(['event'])} className="link-underlined mt-3">Return to events</button>
        </div>
      )}

      {/* Attendee Roster Modal */}
      {eventRoute && eventRoute !== 'new' && (
        <div role="alert" className="surface-card text-description p-5">
          <p>This event page could not be found.</p>
          <button onClick={() => closeQuery(['event'])} className="link-underlined mt-3">Return to events</button>
        </div>
      )}
      {rosterId && (
        <div className="dialog-overlay overflow-y-auto">
          <div className="dialog-panel form-stack event-attendees-dialog">
            <div className="row-between admin-dialog-header">
              <div>
                <h3 className="card-title">{inspectEvent?.title || 'Event attendees'}</h3>
                {inspectEvent && <p className="text-caption">Attendee Guest List ({inspectEvent.rsvps?.length || 0} confirmed)</p>}
              </div>
              <button
                onClick={() => closeQuery(['roster'])}
                className="admin-dialog-close"
              >
                <X className="icon-medium" />
              </button>
            </div>

            <div className="table-body max-h-72 overflow-y-auto">
              {loading ? (
                <p role="status" className="text-caption py-8 text-center">Loading event attendees...</p>
              ) : !inspectEvent ? (
                <p role="alert" className="event-attendees-error">{loadError || 'This event could not be found. It may have been removed.'}</p>
              ) : (inspectEvent.rsvps || []).length === 0 ? (
                <div className="event-attendees-empty">
                  No attendees have RSVP'd yet.
                </div>
              ) : (
                inspectEvent.rsvps.map((guest, i) => (
                  <div key={i} className="row-between py-2.5 text-xs">
                    <div>
                      <div className="text-bold">{guest.userName}</div>
                      <div className="text-note">{guest.userEmail}</div>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {new Date(guest.rsvpDate).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => closeQuery(['roster'])}
                className="button-muted-bordered button-small transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
