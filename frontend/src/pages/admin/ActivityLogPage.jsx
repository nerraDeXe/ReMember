import React, { useState, useEffect } from 'react';
import {
  ScrollText,
  Filter,
  UserPlus,
  UserCheck,
  AlertOctagon,
  CheckCircle,
  Layers,
  Wallet,
  Calendar,
  RefreshCw,
  Clock,
  Shield
} from 'lucide-react';
import { api } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function ActivityLogPage() {
  const { showToast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, totalLogs: 0, totalPages: 1 });

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
        setPagination(data.pagination || { page: 1, limit: 20, totalLogs: 0, totalPages: 1 });
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

  const getActionBadge = (action) => {
    switch (action) {
      case 'USER_REGISTERED':
        return {
          icon: UserPlus,
          bg: 'bg-brand-50 text-brand-ink border-brand-primary/30',
          label: 'User Registered'
        };
      case 'PROFILE_UPDATED':
        return {
          icon: UserCheck,
          bg: 'bg-brand-50 text-brand-ink border-brand-primary/30',
          label: 'Profile Updated'
        };
      case 'PAYMENT_FAILED':
        return {
          icon: AlertOctagon,
          bg: 'bg-slate-100 text-brand-ink border-brand-silver font-bold',
          label: 'Payment Failed'
        };
      case 'PAYMENT_SUCCESS':
        return {
          icon: CheckCircle,
          bg: 'bg-brand-50 text-brand-ink border-brand-primary/30',
          label: 'Payment Success'
        };
      case 'TIER_CHANGED':
        return {
          icon: Layers,
          bg: 'bg-brand-50 text-brand-ink border-brand-accent/50',
          label: 'Tier Changed'
        };
      case 'STATUS_UPDATED':
        return {
          icon: Shield,
          bg: 'bg-brand-50 text-brand-ink border-brand-accent/50',
          label: 'Status Updated'
        };
      case 'GOOGLE_WALLET_SYNCED':
        return {
          icon: Wallet,
          bg: 'bg-brand-50 text-brand-ink border-brand-primary/30',
          label: 'Wallet Synced'
        };
      case 'EVENT_RSVP':
        return {
          icon: Calendar,
          bg: 'bg-brand-50 text-brand-ink border-brand-primary/30',
          label: 'Event RSVP'
        };
      default:
        return {
          icon: ScrollText,
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          label: action.replace('_', ' ')
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-brand-ink" />
            Administrative Activity & Audit Log
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Tracking recent user registrations, profile updates, payment failures, tier modifications, and wallet syncs.
          </p>
        </div>

        {/* Action Filter */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
          >
            <option value="all">All Activities</option>
            <option value="USER_REGISTERED">User Registrations</option>
            <option value="PROFILE_UPDATED">Profile Updates</option>
            <option value="PAYMENT_FAILED">Payment Failures</option>
            <option value="PAYMENT_SUCCESS">Payment Successes</option>
            <option value="TIER_CHANGED">Tier Changes</option>
            <option value="STATUS_UPDATED">Status Updates</option>
            <option value="GOOGLE_WALLET_SYNCED">Google Wallet Syncs</option>
            <option value="EVENT_RSVP">Event RSVPs</option>
          </select>
        </div>
      </div>

      {/* Log Feed Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 flex justify-center">
            <RefreshCw className="w-8 h-8 text-brand-ink animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <ScrollText className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            No activity logs match the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Action Event</th>
                  <th className="p-4">Member / Target</th>
                  <th className="p-4">Role / Actor</th>
                  <th className="p-4">Event Details & Metadata</th>
                  <th className="p-4 text-right">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                  const badge = getActionBadge(log.action);
                  const Icon = badge.icon;
                  return (
                    <tr key={log._id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="p-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                      </td>

                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold border ${badge.bg}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="font-semibold text-slate-900">
                          {log.userName || log.userEmail || 'System'}
                        </div>
                        {log.userEmail && (
                          <div className="text-[11px] text-slate-500">{log.userEmail}</div>
                        )}
                      </td>

                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono uppercase text-slate-700">
                          {log.actorRole || 'system'}
                        </span>
                      </td>

                      <td className="p-4 max-w-xs">
                        <div className="text-[11px] text-slate-700 font-mono bg-slate-50 p-2 rounded-lg border border-slate-200 truncate">
                          {log.details ? JSON.stringify(log.details) : 'N/A'}
                        </div>
                      </td>

                      <td className="p-4 text-right font-mono text-slate-500 text-[11px]">
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
