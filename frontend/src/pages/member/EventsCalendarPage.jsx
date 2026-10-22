import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Calendar, MapPin, Clock, Users, CheckCircle, XCircle, RefreshCw, Filter } from 'lucide-react';
import { api } from '../../api.js';

export default function EventsCalendarPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [actionPendingId, setActionPendingId] = useState(null);

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

  const handleRsvp = async (event) => {
    setActionPendingId(event._id);
    try {
      const response = await api.rsvpEvent(event._id);
      if (response.success) {
        showToast(response.message || `RSVP confirmed for "${event.title}"!`, response.emailDelivery && response.emailDelivery !== 'sent' ? 'info' : 'success');
        await loadEvents();
      }
    } catch (err) {
      showToast(err.message || 'RSVP failed.', 'error');
    } finally {
      setActionPendingId(null);
    }
  };

  const handleCancelRsvp = async (event) => {
    setActionPendingId(event._id);
    try {
      const response = await api.cancelRsvpEvent(event._id);
      if (response.success) {
        showToast('RSVP cancelled.', 'info');
        await loadEvents();
      }
    } catch (err) {
      showToast(err.message || 'Failed to cancel RSVP.', 'error');
    } finally {
      setActionPendingId(null);
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
          No upcoming events found for this filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredEvents.map((event) => {
            const isRsvped = event.isRsvped;
            const isEligible = event.isAllowedTier;
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
                    <img
                      src={event.imageUrl || 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=600&q=80'}
                      alt={event.title}
                      className="w-full h-full object-cover opacity-90"
                    />

                    <div className="absolute top-3 left-3 flex gap-2">
                      <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-white text-brand-ink border border-brand-silver">
                        {event.category}
                      </span>
                    </div>

                    {isRsvped && (
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1 rounded bg-brand-accent text-brand-ink font-bold text-xs shadow-sm">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>You're Attending</span>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-6 space-y-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 leading-snug">
                        {event.title}
                      </h3>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                        {event.description}
                      </p>
                    </div>

                    <div className="space-y-2 text-xs text-slate-700">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-brand-ink shrink-0" />
                        <span>
                          <strong>{event.date}</strong> &bull; {event.time}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-brand-ink shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </div>
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
                      {(!event.allowedTiers || event.allowedTiers.length === 0) ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          All Membership Levels
                        </span>
                      ) : (
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
                  {isRsvped ? (
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
                  ) : !isEligible ? (
                    <button
                      disabled
                      className="w-full py-2.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-400 font-medium text-xs cursor-not-allowed"
                    >
                      Requires Tier Upgrade ({event.allowedTiers?.join(', ')})
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
