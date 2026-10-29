import React, { useMemo } from 'react';
import { BarChart3, Calendar, Users, Eye } from 'lucide-react';
import { TrendChart } from './AnalyticsCharts.jsx';
import { buildEventAnalytics } from '../eventAnalytics.js';
import { formatEventDateRange } from '../../../shared/events.js';
import { useUrlState } from '../routing.jsx';

const card = 'min-w-0 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm';
const registrationSeries = [{ key: 'registrations', label: 'Registrations', color: '#a16207' }];
const scopes = { all: 'All events', upcoming: 'Upcoming & in progress', past: 'Past events' };
const count = value => Number(value || 0).toLocaleString('en-US');

export default function EventAnalytics({ events, onInspectEvent, now }) {
  const [requestedScope, setScope] = useUrlState('eventScope', 'all');
  const [requestedMonths, setMonths] = useUrlState('registrationMonths', '6');
  const scope = Object.hasOwn(scopes, requestedScope) ? requestedScope : 'all';
  const months = [3, 6, 12].includes(Number(requestedMonths)) ? Number(requestedMonths) : 6;
  const analytics = useMemo(() => buildEventAnalytics(events, { months, scope, now }), [events, months, scope, now]);
  const registrations = analytics.registrationTrend.reduce((total, point) => total + point.registrations, 0);
  const largestTotal = Math.max(1, ...analytics.eventTotals.map(event => event.rsvpCount));

  return <section className="space-y-5" aria-labelledby="event-analytics-title">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 id="event-analytics-title" className="flex items-center gap-2 text-lg font-bold text-slate-900"><BarChart3 className="h-5 w-5" aria-hidden="true" />Event analytics</h2><p className="mt-1 text-xs text-slate-500">Registrations for your organisation’s published events.</p></div>
      <label className="text-xs font-semibold text-slate-600">Events to analyse<select aria-label="Events to analyse" value={scope} onChange={event => setScope(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700">{Object.entries(scopes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <article className={card} aria-label="Upcoming events summary">
        <div className="flex items-center justify-between gap-3"><h3 className="text-xs font-semibold text-slate-500">Upcoming events</h3><Calendar className="h-5 w-5 text-brand-ink" aria-hidden="true" /></div>
        <p className="mt-3 text-3xl font-extrabold text-slate-900 tabular-nums">{count(analytics.upcomingEvents)}</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">Across this organisation, including events in progress until their final scheduled day ends.</p>
        <button type="button" onClick={() => setScope('upcoming')} className="mt-3 text-xs font-semibold text-slate-700 underline underline-offset-4">View upcoming events</button>
      </article>
      <article className={card} aria-label="Total RSVPs summary">
        <div className="flex items-center justify-between gap-3"><h3 className="text-xs font-semibold text-slate-500">Total RSVPs</h3><Users className="h-5 w-5 text-brand-ink" aria-hidden="true" /></div>
        <p className="mt-3 text-3xl font-extrabold text-slate-900 tabular-nums">{count(analytics.totalRsvps)}</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">Current registrations across {count(analytics.eventTotals.length)} {scope === 'all' ? 'published' : scope === 'upcoming' ? 'upcoming or ongoing' : 'past'} events. One member can register for multiple events.</p>
      </article>
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
      <article className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="text-sm font-bold text-slate-900">Registration trends</h3><p className="mt-2 text-2xl font-extrabold text-slate-900 tabular-nums">{count(registrations)}</p><p className="mt-1 text-xs text-slate-500">RSVPs registered in the last {months} months · Monthly totals in UTC</p></div>
          <select aria-label="Registration trend period" value={String(months)} onChange={event => setMonths(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700">{[3, 6, 12].map(value => <option key={value} value={value}>Last {value} months</option>)}</select>
        </div>
        <div className="mt-5"><TrendChart title="Event registration trends" data={analytics.registrationTrend} series={registrationSeries} emptyMessage="No dated registrations in this period." /></div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Based on registration dates in current RSVP lists, including the current month to date. Cancelled RSVPs and deleted events are excluded.{analytics.undatedRegistrations > 0 && ` ${count(analytics.undatedRegistrations)} RSVPs have no usable registration date and are excluded from this graph.`}</p>
      </article>

      <article className={card}>
        <h3 className="text-sm font-bold text-slate-900">Total RSVPs by event</h3>
        <p className="mt-1 text-xs text-slate-500">Current RSVP totals for {scopes[scope].toLowerCase()}.</p>
        {!analytics.eventTotals.length ? <p className="mt-5 rounded-lg bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">No events match this filter.</p> : <ul aria-label="RSVP totals by event" className="mt-5 max-h-[32rem] overflow-y-auto divide-y divide-slate-100">
          {analytics.eventTotals.map(event => <li key={event.id} aria-label={`${event.title} RSVP total`} className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-semibold text-slate-900">{event.title}</p><p className="mt-1 text-[11px] text-slate-500">{event.startDate ? formatEventDateRange(event) : 'Date unavailable'}{event.capacity !== null ? ` · ${count(event.capacity)} places` : ''}</p></div><span className="shrink-0 text-sm font-bold text-slate-900 tabular-nums">{count(event.rsvpCount)} RSVPs</span></div>
            <div className="mt-3 h-2 rounded-full bg-slate-100" aria-hidden="true"><div className="h-2 rounded-full bg-brand-primary" style={{ width: `${event.rsvpCount / largestTotal * 100}%` }} /></div>
            <button type="button" aria-label={`View RSVPs for ${event.title}`} onClick={() => onInspectEvent(event.id)} className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 underline underline-offset-4"><Eye className="h-3.5 w-3.5" aria-hidden="true" />View RSVP list</button>
          </li>)}
        </ul>}
      </article>
    </div>
  </section>;
}
