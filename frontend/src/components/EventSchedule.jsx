import React from 'react';
import { CalendarDays, Clock, ExternalLink, MapPin } from 'lucide-react';
import {
  DEFAULT_EVENT_TIME_ZONE,
  formatEventDateRange,
  formatEventTimeRange,
  getEventMapsUrl,
  getEventSchedule,
  hasEventCoordinates,
} from '../../../shared/events.js';

const dateLabel = (date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return date || 'Date to be confirmed';
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(parsed.valueOf()) ? date : parsed.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
};

function ScheduleDay({ day, showDate }) {
  return (
    <li className="event-schedule-day">
      {showDate && <time dateTime={day.date} className="event-schedule-date">{dateLabel(day.date)}</time>}
      <span className="event-schedule-time"><Clock aria-hidden="true" className="event-schedule-time-icon" />{formatEventTimeRange(day) || 'Time to be confirmed'}</span>
    </li>
  );
}

export default function EventSchedule({ event, compact = false }) {
  const schedule = getEventSchedule(event);
  const visibleDays = compact ? schedule.slice(0, 3) : schedule;
  const remainingDays = compact ? schedule.slice(3) : [];
  const timezone = event.timeZone || (Array.isArray(event.schedule) && event.schedule.length > 0 ? DEFAULT_EVENT_TIME_ZONE : '');

  return (
    <div className="event-schedule">
      <div className="event-schedule-heading">
        <CalendarDays aria-hidden="true" className="event-schedule-calendar-icon" />
        <div className="event-schedule-heading-content"><p className="event-schedule-range">{formatEventDateRange(event) || 'Date to be confirmed'}</p>{timezone && <p className="event-schedule-timezone">Times in {timezone.replaceAll('_', ' ')}</p>}</div>
      </div>
      {visibleDays.length > 0 && <ul className="event-schedule-days">{visibleDays.map((day, index) => <ScheduleDay key={`${day.date}-${index}`} day={day} showDate={schedule.length > 1} />)}</ul>}
      {remainingDays.length > 0 && <details className="event-schedule-more"><summary className="event-schedule-more-toggle">View {remainingDays.length} more {remainingDays.length === 1 ? 'day' : 'days'}</summary><ul className="event-schedule-additional-days">{remainingDays.map((day, index) => <ScheduleDay key={`${day.date}-${index}`} day={day} showDate />)}</ul></details>}
      {schedule.length === 0 && event.time && <p className="event-schedule-time"><Clock aria-hidden="true" className="event-schedule-fallback-time-icon" />{event.time}</p>}
    </div>
  );
}

export function EventLocation({ event, className = '' }) {
  const mapsUrl = getEventMapsUrl(event);
  if (!event.location) return <p className={`event-location-pending ${className}`}><MapPin aria-hidden="true" className="event-location-pending-icon" />Location to be confirmed</p>;
  const content = <><MapPin aria-hidden="true" className="event-location-icon" /><span className="event-location-name">{event.location}</span></>;
  return mapsUrl
    ? <div className="event-location"><a href={mapsUrl} target="_blank" rel="noopener noreferrer" title={`Open ${event.location} in Google Maps (new tab)`} className={`event-location-link ${className}`}>{content}<ExternalLink aria-hidden="true" className="event-location-external-icon" /><span className="event-location-link-hint"> (opens Google Maps in a new tab)</span></a>{hasEventCoordinates(event) && <p className="event-location-attribution">Location data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="event-location-attribution-link">OpenStreetMap contributors</a></p>}</div>
    : <p className={`event-location-text ${className}`}>{content}</p>;
}

const labels = { upcoming: 'Upcoming', in_progress: 'In progress', ended: 'Ended', unknown: 'Schedule unavailable' };

export function EventStatusBadge({ status }) {
  return <span className={`event-status-badge ${status === 'in_progress' ? 'event-status-badge--in-progress' : status === 'upcoming' ? 'event-status-badge--upcoming' : 'event-status-badge--ended'}`}>{labels[status] || labels.unknown}</span>;
}
