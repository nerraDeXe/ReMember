import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Users,
  CreditCard,
  DollarSign,
  TrendingUp,
  Layers,
  Calendar,
  ScrollText,
  ArrowRight
} from 'lucide-react';
import { api } from '../../api.js';

export default function AdminDashboard({ onNavigate }) {
  const { user } = useAuth();
  const [financials, setFinancials] = useState(null);

  const loadMetrics = async () => {
    try {
      const data = await api.getFinancialSummary();
      if (data.success) {
        setFinancials(data);
      }
    } catch (err) {
      console.error('Failed to load financial summary:', err);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const metrics = financials?.metrics || {};

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl bg-white border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-ink">
                Administration Portal
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              {user?.activeOrganisation?.name} Dashboard
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Manage this organisation's members, membership tiers, events, and finances.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('admin-members')}
              className="py-2.5 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-2 transition-colors"
            >
              <Users className="w-4 h-4" />
              <span>Manage Members</span>
            </button>
            <button
              onClick={() => onNavigate('admin-tiers')}
              className="py-2.5 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-2 transition-colors"
            >
              <Layers className="w-4 h-4" />
              <span>Tiers & Pricing</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Organisation Revenue</span>
            <div className="p-2 rounded-lg bg-brand-50 text-brand-ink">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            ${(metrics.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="text-brand-ink font-semibold">Sub: ${metrics.totalSubscriptionRevenue || 0}</span>
            <span>•</span>
            <span>Events: ${metrics.totalEventTicketingRevenue || 0}</span>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Members</span>
            <div className="p-2 rounded-lg bg-brand-50 text-brand-ink">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {metrics.activeMembersCount || 0}{' '}
            <span className="text-xs font-normal text-slate-500">/ {metrics.membersCount || 0} registered</span>
          </div>
          <div className="text-[11px] text-brand-ink font-medium mt-1">
            Across this organisation's membership tiers
          </div>
        </div>

        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Monthly Run Rate (MRR)</span>
            <div className="p-2 rounded-lg bg-brand-50 text-brand-ink">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            ${(metrics.monthlyRecurringRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-600 mt-1">
            ARR Run-Rate: ${(metrics.annualRunRate || 0).toLocaleString()}
          </div>
        </div>

        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Paid Invoices</span>
            <div className="p-2 rounded-lg bg-brand-50 text-brand-ink">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {metrics.paidInvoicesCount || 0}
          </div>
          <div className="text-[11px] text-brand-ink mt-1 font-medium">
            {metrics.failedInvoicesCount || 0} payment failures tracked in audit
          </div>
        </div>
      </div>

      {/* Quick Navigation Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div
          onClick={() => onNavigate('admin-events')}
          className="p-6 rounded-xl bg-white border border-slate-200 hover:border-brand-primary shadow-sm cursor-pointer transition-colors group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-brand-50 text-brand-ink group-hover:bg-brand-primary group-hover:text-brand-ink transition-colors">
              <Calendar className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-ink transition-colors" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Community Events</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Create events for this organisation and manage attendance and member access.
          </p>
        </div>

        <div
          onClick={() => onNavigate('admin-members')}
          className="p-6 rounded-xl bg-white border border-slate-200 hover:border-brand-primary shadow-sm cursor-pointer transition-colors group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-slate-100 text-brand-ink group-hover:bg-brand-primary group-hover:text-brand-ink transition-colors">
              <Users className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-ink transition-colors" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Members Directory</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Paginated search, manual status approval/suspension, tier adjustments with automatic Google Wallet sync, and CSV export.
          </p>
        </div>

        <div
          onClick={() => onNavigate('admin-finances')}
          className="p-6 rounded-xl bg-white border border-slate-200 hover:border-brand-primary shadow-sm cursor-pointer transition-colors group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-slate-100 text-brand-ink group-hover:bg-brand-secondary group-hover:text-brand-ink transition-colors">
              <DollarSign className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-ink transition-colors" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Financial Dashboards</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Detailed breakdown of revenue from subscriptions vs. event ticketing, tier distributions, and transaction records.
          </p>
        </div>

        <div
          onClick={() => onNavigate('admin-logs')}
          className="p-6 rounded-xl bg-white border border-slate-200 hover:border-brand-primary shadow-sm cursor-pointer transition-colors group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-lg bg-slate-100 text-brand-ink group-hover:bg-brand-primary group-hover:text-brand-ink transition-colors">
              <ScrollText className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-ink transition-colors" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Audit Activity Log</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Immutable tracking for user registrations, profile edits, payment failures, tier changes, and wallet sync operations.
          </p>
        </div>
      </div>
    </div>
  );
}
