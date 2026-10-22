import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, RefreshCw, Eye, X } from 'lucide-react';
import { api } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import EventModal from '../../components/EventModal.jsx';
import EventSchedule, { EventLocation } from '../../components/EventSchedule.jsx';
import { getEventAccessLabel, getEligibleEventTiers } from '../../../../shared/events.js';

export default function EventManagementPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const organisationId = user?.activeOrganisationId;
  const [events, setEvents] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tiersError, setTiersError] = useState('');
  const [reload, setReload] = useState(0);
  const [deletingId, setDeletingId] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [inspectEvent, setInspectEvent] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    setTiersError('');
    Promise.allSettled([api.getEvents(organisationId), api.getTiers(organisationId)]).then(([eventResult, tierResult]) => {
      if (cancelled) return;
      if (eventResult.status === 'fulfilled' && eventResult.value.success) setEvents(eventResult.value.events || []);
      else setLoadError(eventResult.reason?.message || eventResult.value?.message || 'Could not load events.');
      if (tierResult.status === 'fulfilled' && tierResult.value.success) setTiers(tierResult.value.tiers || []);
      else setTiersError(tierResult.reason?.message || tierResult.value?.message || 'Could not load membership tiers.');
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-brand-ink" />
            Community Event Operations
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Publish events for {user?.activeOrganisation?.name || 'your organisation'} with daily schedules, venues and membership access.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          disabled={loading || Boolean(tiersError)}
          className="py-2.5 px-4 rounded-lg bg-brand-primary hover:bg-brand-secondary text-brand-ink font-bold text-xs flex items-center gap-2 transition-colors self-start sm:self-auto shadow-sm disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Event</span>
        </button>
      </div>

      {tiersError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-700">
        <p>Membership access options could not be loaded. {tiersError}</p>
        <button onClick={loadEvents} className="font-semibold underline">Retry</button>
      </div>}

      {/* Events List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 flex justify-center">
            <RefreshCw className="w-8 h-8 text-brand-ink animate-spin" />
          </div>
        ) : loadError ? (
          <div role="alert" className="p-8 text-center text-sm text-slate-600">
            <p>{loadError}</p><button onClick={loadEvents} className="mt-3 font-semibold underline">Retry</button>
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            No events published yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4">Event Details</th>
                  <th className="p-4">Date & Time</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">RSVPs / Capacity</th>
                  <th className="p-4">Allowed Tiers</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((evt) => {
                  const rsvpsCount = evt.rsvps?.length || 0;
                  const accessLabel = getEventAccessLabel(evt, tiers);
                  const eligibleTiers = evt.tierAccess === 'minimum' ? getEligibleEventTiers(tiers, evt.minimumTierId) : [];
                  return (
                    <tr key={evt._id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900 text-sm">{evt.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                          {evt.description}
                        </div>
                      </td>

                      <td className="p-4 min-w-[215px] text-slate-600">
                        <EventSchedule event={evt} compact />
                      </td>

                      <td className="p-4 min-w-[170px] max-w-[230px] text-slate-600">
                        <EventLocation event={evt} />
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            {rsvpsCount} / {evt.capacity}
                          </span>
                          <button
                            onClick={() => setInspectEvent(evt)}
                            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-brand-ink text-[10px] font-semibold flex items-center gap-1 transition-colors"
                            title="Inspect attendee list"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Attendees</span>
                          </button>
                        </div>
                      </td>

                      <td className="p-4">
                        <p className="mb-1.5 text-xs font-semibold text-slate-700">{accessLabel}</p>
                        <div className="flex flex-wrap gap-1">
                          {(evt.tierAccess === 'minimum' ? eligibleTiers.map(tier => tier.name) : evt.allowedTiers || []).map((name, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-brand-50 text-brand-ink border border-brand-primary/30 font-medium"
                              >
                                {name}
                              </span>
                            ))}
                        </div>
                      </td>

                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeleteEvent(evt)}
                          disabled={Boolean(deletingId)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-brand-silver text-brand-ink transition-colors disabled:opacity-40"
                          title="Delete Event"
                          aria-label={`Delete ${evt.title}`}
                        >
                          {deletingId === evt._id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={loadEvents}
        tiers={tiers}
        organisationId={organisationId}
      />

      {/* Attendee Roster Modal */}
      {inspectEvent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-brand-muted/35 flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">{inspectEvent.title}</h3>
                <p className="text-xs text-slate-500">Attendee Guest List ({inspectEvent.rsvps?.length || 0} confirmed)</p>
              </div>
              <button
                onClick={() => setInspectEvent(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {(inspectEvent.rsvps || []).length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No attendees have RSVP'd yet.
                </div>
              ) : (
                inspectEvent.rsvps.map((guest, i) => (
                  <div key={i} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{guest.userName}</div>
                      <div className="text-[11px] text-slate-500">{guest.userEmail}</div>
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
                onClick={() => setInspectEvent(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors"
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
