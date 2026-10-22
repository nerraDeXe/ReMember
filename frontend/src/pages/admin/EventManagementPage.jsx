import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, RefreshCw, Eye, X } from 'lucide-react';
import { api } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import EventModal from '../../components/EventModal.jsx';

export default function EventManagementPage() {
  const { showToast } = useToast();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [inspectEvent, setInspectEvent] = useState(null);

  const loadEvents = async () => {
    try {
      const data = await api.getEvents();
      if (data.success) {
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error('Failed to load events:', err);
      showToast('Could not load events: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleDeleteEvent = async (event) => {
    if (!window.confirm(`Delete event "${event.title}"?`)) return;
    try {
      const response = await api.deleteEvent(event._id);
      if (response.success) {
        showToast(response.message, 'success');
        await loadEvents();
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete event.', 'error');
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
            Create new event listings with date, capacity limits, and tier access policies.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="py-2.5 px-4 rounded-lg bg-brand-primary hover:bg-brand-secondary text-brand-ink font-bold text-xs flex items-center gap-2 transition-colors self-start sm:self-auto shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Event</span>
        </button>
      </div>

      {/* Events List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 flex justify-center">
            <RefreshCw className="w-8 h-8 text-brand-ink animate-spin" />
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
                  return (
                    <tr key={evt._id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900 text-sm">{evt.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                          {evt.description}
                        </div>
                      </td>

                      <td className="p-4 text-slate-600">
                        <div className="font-semibold text-slate-900">{evt.date}</div>
                        <div className="text-[11px] text-slate-500">{evt.time}</div>
                      </td>

                      <td className="p-4 text-slate-600 truncate max-w-[180px]">
                        {evt.location}
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
                        <div className="flex flex-wrap gap-1">
                          {(!evt.allowedTiers || evt.allowedTiers.length === 0) ? (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              All
                            </span>
                          ) : (
                            evt.allowedTiers.map((t, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-brand-50 text-brand-ink border border-brand-primary/30 font-medium"
                              >
                                {t}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeleteEvent(evt)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-brand-silver text-brand-ink transition-colors"
                          title="Delete Event"
                        >
                          <Trash2 className="w-4 h-4" />
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
