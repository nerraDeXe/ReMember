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
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      {showDate && <time dateTime={day.date} className="font-medium text-slate-700">{dateLabel(day.date)}</time>}
      <span className="flex items-center gap-1.5 text-slate-600"><Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{formatEventTimeRange(day) || 'Time to be confirmed'}</span>
    </li>
  );
}

export default function EventSchedule({ event, compact = false }) {
  const schedule = getEventSchedule(event);
  const visibleDays = compact ? schedule.slice(0, 3) : schedule;
  const remainingDays = compact ? schedule.slice(3) : [];
  const timezone = event.timeZone || (Array.isArray(event.schedule) && event.schedule.length > 0 ? DEFAULT_EVENT_TIME_ZONE : '');

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-start gap-2 text-slate-800">
        <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-ink" />
        <div className="min-w-0"><p className="font-semibold">{formatEventDateRange(event) || 'Date to be confirmed'}</p>{timezone && <p className="mt-0.5 text-[10px] font-normal text-slate-500">Times in {timezone.replaceAll('_', ' ')}</p>}</div>
      </div>
      {visibleDays.length > 0 && <ul className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">{visibleDays.map((day, index) => <ScheduleDay key={`${day.date}-${index}`} day={day} showDate={schedule.length > 1} />)}</ul>}
      {remainingDays.length > 0 && <details className="rounded-lg border border-slate-200 px-3 py-2"><summary className="cursor-pointer font-semibold text-brand-ink">View {remainingDays.length} more {remainingDays.length === 1 ? 'day' : 'days'}</summary><ul className="mt-3 space-y-2">{remainingDays.map((day, index) => <ScheduleDay key={`${day.date}-${index}`} day={day} showDate />)}</ul></details>}
      {schedule.length === 0 && event.time && <p className="flex items-center gap-1.5 text-slate-600"><Clock aria-hidden="true" className="h-3.5 w-3.5" />{event.time}</p>}
    </div>
  );
}

export function EventLocation({ event, className = '' }) {
  const mapsUrl = getEventMapsUrl(event);
  if (!event.location) return <p className={`flex items-center gap-2 text-xs text-slate-500 ${className}`}><MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />Location to be confirmed</p>;
  const content = <><MapPin aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-ink" /><span className="min-w-0 break-words">{event.location}</span></>;
  return mapsUrl
    ? <div className="space-y-1"><a href={mapsUrl} target="_blank" rel="noopener noreferrer" title={`Open ${event.location} in Google Maps (new tab)`} className={`flex items-start gap-2 text-xs text-brand-ink underline decoration-slate-300 underline-offset-2 hover:decoration-brand-ink ${className}`}>{content}<ExternalLink aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" /><span className="sr-only"> (opens Google Maps in a new tab)</span></a>{hasEventCoordinates(event) && <p className="pl-6 text-[10px] text-slate-500">Location data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">OpenStreetMap contributors</a></p>}</div>
    : <p className={`flex items-start gap-2 text-xs text-slate-700 ${className}`}>{content}</p>;
}
