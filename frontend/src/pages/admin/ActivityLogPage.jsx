import React, { useState, useEffect } from 'react';
import {
  ScrollText,
  Filter,
  UserPlus,
  UserCheck,
  AlertOctagon,
  CheckCircle,
  Layers,
  Calendar,
  RefreshCw,
  Clock,
  Shield
} from 'lucide-react';
import { api } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useUrlState } from '../../routing.jsx';

const actionClass = "admin-state-brand";
const tierClass = "activity-state-tier";
const actions = {
  USER_REGISTERED: { icon: UserPlus, label: 'User Registered', filterLabel: 'User Registrations' },
  PROFILE_UPDATED: { icon: UserCheck, label: 'Profile Updated', filterLabel: 'Profile Updates' },
  PAYMENT_FAILED: { icon: AlertOctagon, label: 'Payment Failed', filterLabel: 'Payment Failures', bg: "state-muted-brand font-bold" },
  PAYMENT_SUCCESS: { icon: CheckCircle, label: 'Payment Success', filterLabel: 'Payment Successes' },
  TIER_CHANGED: { icon: Layers, label: 'Tier Changed', filterLabel: 'Tier Changes', bg: tierClass },
  STATUS_UPDATED: { icon: Shield, label: 'Status Updated', filterLabel: 'Status Updates', bg: tierClass },
  EVENT_RSVP: { icon: Calendar, label: 'Event RSVP', filterLabel: 'Event RSVPs' },
};
const getActionBadge = action => actions[action] || {
  icon: ScrollText, bg: "activity-state-neutral", label: action.replace('_', ' '),
};

export default function ActivityLogPage() {
  const { showToast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useUrlState('action', 'all');

  const loadLogs = async (currentPage = 1) => {
    setLoading(true);
    try {
      const data = await api.getActivityLogs({
        page: currentPage,
        limit: 20,
        action: actionFilter,
      });

      if (data.success) {
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load activity logs:', err);
      showToast('Could not load activity log: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(1);
  }, [actionFilter]);

  return (
    <div className="page-stack">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <ScrollText className="icon-brand-large" />
            Administrative Activity & Audit Log
          </h1>
          <p className="page-description">
            Tracking recent user registrations, profile updates, payment failures, and tier modifications.
          </p>
        </div>

        {/* Action Filter */}
        <div className="row-inline self-start sm:self-auto">
          <Filter className="icon-default text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="control-filter control-ring"
          >
            <option value="all">All Activities</option>
            {Object.entries(actions).map(([value, action]) => <option key={value} value={value}>{action.filterLabel}</option>)}
          </select>
        </div>
      </div>

      {/* Log Feed Table */}
      <div className="table-frame">
        {loading ? (
          <div className="loading-container">
            <RefreshCw className="loading-spinner" />
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <ScrollText className="empty-state-icon" />
            No activity logs match the selected filter.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table-base">
              <thead className="table-heading">
                <tr>
                  <th className="data-table-cell">Timestamp</th>
                  <th className="data-table-cell">Action Event</th>
                  <th className="data-table-cell">Member / Target</th>
                  <th className="data-table-cell">Role / Actor</th>
                  <th className="data-table-cell">Event Details & Metadata</th>
                  <th className="data-table-cell text-right">IP Address</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {logs.map((log) => {
                  const badge = getActionBadge(log.action);
                  const Icon = badge.icon;
                  return (
                    <tr key={log._id} className="data-table-row">
                      <td className="text-note data-table-cell font-mono whitespace-nowrap">
                        <div className="row-inline-tight">
                          <Clock className="icon-small text-slate-400 shrink-0" />
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                      </td>

                      <td className="data-table-cell">
                        <span
                          className={`row-icon-inline activity-badge ${badge.bg || actionClass}`}
                        >
                          <Icon className="icon-small" />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      <td className="data-table-cell">
                        <div className="text-strong">
                          {log.userName || log.userEmail || 'System'}
                        </div>
                        {log.userEmail && (
                          <div className="text-note">{log.userEmail}</div>
                        )}
                      </td>

                      <td className="data-table-cell">
                        <span className="badge-neutral badge-small font-mono uppercase">
                          {log.actorRole || 'system'}
                        </span>
                      </td>

                      <td className="data-table-cell max-w-xs">
                        <div className="surface-muted activity-details">
                          {log.details ? JSON.stringify(log.details) : 'N/A'}
                        </div>
                      </td>

                      <td className="text-note data-table-cell activity-ip">
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
