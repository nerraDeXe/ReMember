import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  Layers,
  Calendar,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import DashboardAnalytics from '../../components/DashboardAnalytics.jsx';

export default function FinancialAnalyticsPage() {
  const { user } = useAuth();
  const organisationId = user?.activeOrganisationId;
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.getFinancialSummary().then(response => {
      if (!response.success) throw new Error(response.message || 'Could not load financial analytics.');
      if (!cancelled) setResult({ organisationId, response });
    }).catch(err => { if (!cancelled) setError(err.message || 'Could not load financial analytics.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [organisationId, revision]);

  const data = result?.organisationId === organisationId ? result.response : null;

  if (loading || (!data && !error)) {
    return (
      <div className="py-20 flex justify-center">
        <RefreshCw className="w-8 h-8 text-brand-ink animate-spin" />
      </div>
    );
  }

  if (error) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
    <p>{error}</p>
    <button type="button" onClick={() => setRevision(value => value + 1)} className="mt-3 text-xs font-semibold underline">Try again</button>
  </div>;

  const metrics = data?.metrics || {};
  const revenueByTier = data?.revenueByTier || {};
  const recentTransactions = data?.recentTransactions || [];

  const subRev = metrics.totalSubscriptionRevenue || 0;
  const eventRev = metrics.totalEventTicketingRevenue || 0;
  const totalRev = metrics.totalRevenue || 1;
  const subPercent = Math.round((subRev / totalRev) * 100);
  const eventPercent = Math.round((eventRev / totalRev) * 100);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-brand-ink" />
          Payment Activity & Revenue Summary
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Demo membership payments and payment attempts. Monthly equivalents describe membership value, with manual renewals.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Recorded Revenue</span>
            <div className="p-2 rounded-lg bg-brand-50 text-brand-ink">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            MYR {(metrics.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Across {metrics.totalTransactions || 0} total billing attempts
          </div>
        </div>

        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Membership Revenue</span>
            <div className="p-2 rounded-lg bg-brand-50 text-brand-ink">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            MYR {subRev.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-brand-ink mt-1 font-semibold">
            {subPercent}% of total revenue
          </div>
        </div>

        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Event Ticketing Revenue</span>
            <div className="p-2 rounded-lg bg-brand-50 text-brand-ink">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            MYR {eventRev.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-brand-ink mt-1 font-semibold">
            {eventPercent}% of total revenue
          </div>
        </div>

        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Monthly Membership Equivalent</span>
            <div className="p-2 rounded-lg bg-brand-50 text-brand-ink">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            MYR {(metrics.monthlyRecurringRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-600 mt-1">
            Annual equivalent: MYR {(metrics.annualRunRate || 0).toLocaleString()}
          </div>
        </div>
      </div>

      <DashboardAnalytics organisationId={organisationId} financialOnly />

      {/* Revenue Source Visual Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscriptions vs Ticketing Comparison */}
        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-6">
          <h2 className="text-base font-bold text-slate-900">Revenue Sources Distribution</h2>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-primary" />
                  Membership Payments
                </span>
                <span className="font-bold text-slate-900">
                  MYR {subRev.toFixed(2)} ({subPercent}%)
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                <div
                  className="h-full rounded-full bg-brand-primary transition-all duration-500"
                  style={{ width: `${subPercent}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-muted" />
                  Event Ticketing
                </span>
                <span className="font-bold text-slate-900">
                  MYR {eventRev.toFixed(2)} ({eventPercent}%)
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                <div
                  className="h-full rounded-full bg-brand-muted transition-all duration-500"
                  style={{ width: `${eventPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
            <div className="flex justify-between">
              <span>Successful Payments:</span>
              <strong className="text-slate-900">{metrics.paidInvoicesCount || 0} invoices</strong>
            </div>
            <div className="flex justify-between">
              <span>Payment Gateway Failures Tracked:</span>
              <strong className="text-brand-ink">{metrics.failedInvoicesCount || 0} declined</strong>
            </div>
          </div>
        </div>

        {/* Revenue By Membership Tier */}
        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-6">
          <h2 className="text-base font-bold text-slate-900">Revenue by Membership Tier</h2>

          <div className="space-y-3">
            {Object.entries(revenueByTier).map(([tierName, amount], idx) => {
              const tierShare = Math.round((Number(amount) / totalRev) * 100);
              const colors = ['bg-brand-primary', 'bg-brand-muted', 'bg-brand-silver', 'bg-brand-accent'];
              const barColor = colors[idx % colors.length];

              return (
                <div key={tierName} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-900">{tierName}</span>
                    <span className="font-bold text-brand-ink">
                      MYR {Number(amount).toFixed(2)} ({tierShare}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${tierShare}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Transactions Ledger */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Recent Transactions Ledger</h3>
          <span className="text-xs text-slate-500">Latest 10 Invoices Processed</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-4">Invoice #</th>
                <th className="p-4">Member Name</th>
                <th className="p-4">Tier Plan</th>
                <th className="p-4">Payment Method</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentTransactions.map((tx) => {
                const isPaid = tx.paymentStatus === 'paid';
                return (
                  <tr key={tx._id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="p-4 font-mono font-bold text-brand-ink">{tx.invoiceNumber}</td>
                    <td className="p-4 font-semibold text-slate-900">{tx.userName}</td>
                    <td className="p-4 text-slate-700">{tx.tierName}</td>
                    <td className="p-4 text-slate-500 font-mono text-[11px]">{tx.paymentMethod}</td>
                    <td className="p-4 font-bold text-slate-900">MYR {Number(tx.amount).toFixed(2)}</td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          isPaid
                            ? 'bg-brand-50 text-brand-ink border-brand-primary/30'
                            : 'bg-slate-100 text-brand-ink border-brand-silver'
                        }`}
                      >
                        {isPaid ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {tx.paymentStatus}
                      </span>
                    </td>
                    <td className="p-4 text-right text-slate-500">
                      {new Date(tx.createdAt || tx.paidAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
