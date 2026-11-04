import React, { useMemo } from 'react';
import { BarChart3, Calendar, Users, Eye } from 'lucide-react';
import { TrendChart } from './AnalyticsCharts.jsx';
import { buildEventAnalytics } from '../eventAnalytics.js';
import { formatEventDateRange } from '../../../shared/events.js';
import { useUrlState } from '../routing.jsx';

const card = "panel-responsive min-w-0";
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

  return <section className="section-stack" aria-labelledby="event-analytics-title">
    <div className="event-analytics-header">
      <div><h2 id="event-analytics-title" className="row-inline section-title"><BarChart3 className="icon-medium" aria-hidden="true" />Event analytics</h2><p className="page-description">Registrations for your organisation’s published events.</p></div>
      <label className="text-hint-strong">Events to analyse<select aria-label="Events to analyse" value={scope} onChange={event => setScope(event.target.value)} className="event-analytics-select">{Object.entries(scopes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>

    <div className="event-analytics-summary">
      <article className={card} aria-label="Upcoming events summary">
        <div className="row-inline-wide justify-between"><h3 className="text-label-muted">Upcoming events</h3><Calendar className="icon-brand-medium" aria-hidden="true" /></div>
        <p className="event-analytics-total">{count(analytics.upcomingEvents)}</p>
        <p className="text-caption mt-2 leading-relaxed">Across this organisation, including events in progress until their final scheduled day ends.</p>
        <button type="button" onClick={() => setScope('upcoming')} className="link-underlined event-analytics-details">View upcoming events</button>
      </article>
      <article className={card} aria-label="Total RSVPs summary">
        <div className="row-inline-wide justify-between"><h3 className="text-label-muted">Total RSVPs</h3><Users className="icon-brand-medium" aria-hidden="true" /></div>
        <p className="event-analytics-total">{count(analytics.totalRsvps)}</p>
        <p className="text-caption mt-2 leading-relaxed">Current registrations across {count(analytics.eventTotals.length)} {scope === 'all' ? 'published' : scope === 'upcoming' ? 'upcoming or ongoing' : 'past'} events. One member can register for multiple events.</p>
      </article>
    </div>

    <div className="event-analytics-grid">
      <article className={card}>
        <div className="row-summary">
          <div><h3 className="panel-title">Registration trends</h3><p className="event-analytics-period-total">{count(registrations)}</p><p className="page-description">RSVPs registered in the last {months} months · Monthly totals in UTC</p></div>
          <select aria-label="Registration trend period" value={String(months)} onChange={event => setMonths(event.target.value)} className="control-analytics">{[3, 6, 12].map(value => <option key={value} value={value}>Last {value} months</option>)}</select>
        </div>
        <div className="mt-5"><TrendChart title="Event registration trends" data={analytics.registrationTrend} series={registrationSeries} emptyMessage="No dated registrations in this period." /></div>
        <p className="text-fine-print">Based on registration dates in current RSVP lists, including the current month to date. Cancelled RSVPs and deleted events are excluded.{analytics.undatedRegistrations > 0 && ` ${count(analytics.undatedRegistrations)} RSVPs have no usable registration date and are excluded from this graph.`}</p>
      </article>

      <article className={card}>
        <h3 className="panel-title">Total RSVPs by event</h3>
        <p className="page-description">Current RSVP totals for {scopes[scope].toLowerCase()}.</p>
        {!analytics.eventTotals.length ? <p className="text-caption event-analytics-empty">No events match this filter.</p> : <ul aria-label="RSVP totals by event" className="table-body event-analytics-list">
          {analytics.eventTotals.map(event => <li key={event.id} aria-label={`${event.title} RSVP total`} className="event-analytics-row">
            <div className="row-between-start"><div className="min-w-0"><p className="event-analytics-event-title">{event.title}</p><p className="text-note mt-1">{event.startDate ? formatEventDateRange(event) : 'Date unavailable'}{event.capacity !== null ? ` · ${count(event.capacity)} places` : ''}</p></div><span className="panel-title shrink-0 tabular-nums">{count(event.rsvpCount)} RSVPs</span></div>
            <div className="event-analytics-track" aria-hidden="true"><div className="event-analytics-fill" style={{ width: `${event.rsvpCount / largestTotal * 100}%` }} /></div>
            <button type="button" aria-label={`View RSVPs for ${event.title}`} onClick={() => onInspectEvent(event.id)} className="row-icon-inline link-underlined event-analytics-link"><Eye className="icon-small" aria-hidden="true" />View RSVP list</button>
          </li>)}
        </ul>}
      </article>
    </div>
  </section>;
}
