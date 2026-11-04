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
      <div className="loading-container">
        <RefreshCw className="loading-spinner" />
      </div>
    );
  }

  if (error) return <div role="alert" className="financial-error">
    <p>{error}</p>
    <button type="button" onClick={() => setRevision(value => value + 1)} className="link-underlined mt-3 text-xs">Try again</button>
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
    <div className="page-stack">
      {/* Page Header */}
      <div>
        <h1 className="page-title">
          <BarChart3 className="icon-brand-large" />
          Payment Activity & Revenue Summary
        </h1>
        <p className="page-description">
          Demo membership payments and payment attempts. Monthly equivalents describe membership value, with manual renewals.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="form-grid lg:grid-cols-4">
        <div className="panel-card">
          <div className="row-between">
            <span className="text-label-muted">Recorded Revenue</span>
            <div className="surface-brand-icon">
              <DollarSign className="icon-default" />
            </div>
          </div>
          <div className="metric-total">
            MYR {(metrics.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-note mt-1">
            Across {metrics.totalTransactions || 0} total billing attempts
          </div>
        </div>

        <div className="panel-card">
          <div className="row-between">
            <span className="text-label-muted">Membership Revenue</span>
            <div className="surface-brand-icon">
              <Layers className="icon-default" />
            </div>
          </div>
          <div className="metric-total">
            MYR {subRev.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="financial-share-note">
            {subPercent}% of total revenue
          </div>
        </div>

        <div className="panel-card">
          <div className="row-between">
            <span className="text-label-muted">Event Ticketing Revenue</span>
            <div className="surface-brand-icon">
              <Calendar className="icon-default" />
            </div>
          </div>
          <div className="metric-total">
            MYR {eventRev.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="financial-share-note">
            {eventPercent}% of total revenue
          </div>
        </div>

        <div className="panel-card">
          <div className="row-between">
            <span className="text-label-muted">Monthly Membership Equivalent</span>
            <div className="surface-brand-icon">
              <TrendingUp className="icon-default" />
            </div>
          </div>
          <div className="metric-total">
            MYR {(metrics.monthlyRecurringRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="dashboard-equivalent-note">
            Annual equivalent: MYR {(metrics.annualRunRate || 0).toLocaleString()}
          </div>
        </div>
      </div>

      <DashboardAnalytics organisationId={organisationId} financialOnly />

      {/* Revenue Source Visual Breakdown */}
      <div className="financial-source-grid">
        {/* Subscriptions vs Ticketing Comparison */}
        <div className="panel-card space-y-6">
          <h2 className="card-title">Revenue Sources Distribution</h2>

          <div className="form-stack">
            <div>
              <div className="financial-source-summary">
                <span className="row-inline-tight font-semibold text-slate-700">
                  <span className="financial-source-dot-primary" />
                  Membership Payments
                </span>
                <span className="text-bold">
                  MYR {subRev.toFixed(2)} ({subPercent}%)
                </span>
              </div>
              <div className="financial-progress">
                <div
                  className="financial-source-bar-primary"
                  style={{ width: `${subPercent}%` }}
                />
              </div>
            </div>

            <div>
              <div className="financial-source-summary">
                <span className="row-inline-tight font-semibold text-slate-700">
                  <span className="financial-source-dot-muted" />
                  Event Ticketing
                </span>
                <span className="text-bold">
                  MYR {eventRev.toFixed(2)} ({eventPercent}%)
                </span>
              </div>
              <div className="financial-progress">
                <div
                  className="financial-source-bar-muted"
                  style={{ width: `${eventPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="detail-card detail-stack financial-payment-summary">
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
        <div className="panel-card space-y-6">
          <h2 className="card-title">Revenue by Membership Tier</h2>

          <div className="content-stack">
            {Object.entries(revenueByTier).map(([tierName, amount], idx) => {
              const tierShare = Math.round((Number(amount) / totalRev) * 100);
              const colors = ['bg-brand-primary', 'bg-brand-muted', 'bg-brand-silver', 'bg-brand-accent'];
              const barColor = colors[idx % colors.length];

              return (
                <div key={tierName} className="surface-muted p-3">
                  <div className="financial-tier-summary">
                    <span className="text-strong">{tierName}</span>
                    <span className="font-bold text-brand-ink">
                      MYR {Number(amount).toFixed(2)} ({tierShare}%)
                    </span>
                  </div>
                  <div className="progress-track">
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
      <div className="table-frame">
        <div className="row-between financial-ledger-header">
          <h3 className="panel-title">Recent Transactions Ledger</h3>
          <span className="text-caption">Latest 10 Invoices Processed</span>
        </div>

        <div className="table-scroll">
          <table className="table-base">
            <thead className="table-heading">
              <tr>
                <th className="data-table-cell">Invoice #</th>
                <th className="data-table-cell">Member Name</th>
                <th className="data-table-cell">Tier Plan</th>
                <th className="data-table-cell">Payment Method</th>
                <th className="data-table-cell">Amount</th>
                <th className="data-table-cell">Status</th>
                <th className="data-table-cell text-right">Date</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {recentTransactions.map((tx) => {
                const isPaid = tx.paymentStatus === 'paid';
                return (
                  <tr key={tx._id} className="data-table-row">
                    <td className="data-table-cell text-identifier">{tx.invoiceNumber}</td>
                    <td className="data-table-cell text-strong">{tx.userName}</td>
                    <td className="data-table-cell text-slate-700">{tx.tierName}</td>
                    <td className="text-note data-table-cell font-mono">{tx.paymentMethod}</td>
                    <td className="data-table-cell text-bold">MYR {Number(tx.amount).toFixed(2)}</td>
                    <td className="data-table-cell">
                      <span
                        className={`badge-uppercase ${
                          isPaid
                            ? "admin-state-brand"
                            : "state-muted-brand"
                        }`}
                      >
                        {isPaid ? <CheckCircle2 className="icon-tiny" /> : <AlertCircle className="icon-tiny" />}
                        {tx.paymentStatus}
                      </span>
                    </td>
                    <td className="data-table-cell financial-date-cell">
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
