import React from 'react';

export default function StatusBadge({ status, className = '' }) {
  const norm = (status || 'active').toLowerCase();

  const configs = {
    active: {
      bg: 'bg-brand-50 text-brand-ink border-brand-primary',
      dot: 'bg-brand-primary',
      label: 'Active'
    },
    pending: {
      bg: 'bg-white text-brand-ink border-brand-accent',
      dot: 'bg-brand-accent',
      label: 'Pending'
    },
    suspended: {
      bg: 'bg-slate-100 text-brand-ink border-brand-muted',
      dot: 'bg-brand-muted',
      label: 'Suspended'
    },
    revoked: {
      bg: 'bg-slate-200 text-brand-ink border-brand-muted',
      dot: 'bg-brand-ink',
      label: 'Revoked'
    },
    cancelled: {
      bg: 'bg-slate-100 text-slate-600 border-slate-200',
      dot: 'bg-slate-400',
      label: 'Cancelled'
    },
    expired: {
      bg: 'bg-slate-100 text-slate-600 border-slate-200',
      dot: 'bg-slate-400',
      label: 'Expired'
    }
  };

  const current = configs[norm] || configs.active;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium border ${current.bg} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
      {current.label}
    </span>
  );
}
