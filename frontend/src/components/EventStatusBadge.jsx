import React from 'react';

const labels = { upcoming: 'Upcoming', in_progress: 'In progress', ended: 'Ended', unknown: 'Schedule unavailable' };

export default function EventStatusBadge({ status }) {
  return <span className={`inline-flex rounded border px-2 py-1 text-[10px] font-semibold ${status === 'in_progress' ? 'border-amber-200 bg-amber-50 text-amber-900' : status === 'upcoming' ? 'border-brand-primary bg-brand-50 text-brand-ink' : 'border-slate-300 bg-slate-100 text-slate-600'}`}>{labels[status] || labels.unknown}</span>;
}
