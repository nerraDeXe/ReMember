import React from 'react';

const configs = {
  active: { bg: 'status-badge--active', dot: 'status-badge-dot--active', label: 'Active' },
  pending: { bg: 'status-badge--pending', dot: 'status-badge-dot--pending', label: 'Pending' },
  suspended: { bg: 'status-badge--suspended', dot: 'status-badge-dot--suspended', label: 'Suspended' },
  revoked: { bg: 'status-badge--revoked', dot: 'status-badge-dot--revoked', label: 'Revoked' },
  cancelled: { bg: 'status-badge--cancelled', dot: 'status-badge-dot--cancelled', label: 'Cancelled' },
  expired: { bg: 'status-badge--expired', dot: 'status-badge-dot--expired', label: 'Expired' },
};

export default function StatusBadge({ status, className = '' }) {
  const norm = (status || 'active').toLowerCase();
  const current = configs[norm] || configs.active;

  return (
    <span
      className={`status-badge ${current.bg} ${className}`}
    >
      <span className={`status-badge-dot ${current.dot}`} />
      {current.label}
    </span>
  );
}
