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

  if (error) return <div role="alert" className="financial-analytics-load-error">
    <p>{error}</p>
    <button type="button" onClick={() => setRevision(value => value + 1)} className="financial-analytics-retry-button">Try again</button>
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
          <BarChart3 className="financial-analytics-bar-chart3-icon" />
          Payment Activity & Revenue Summary
        </h1>
        <p className="page-description">
          Demo membership payments and payment attempts. Monthly equivalents describe membership value, with manual renewals.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="financial-analytics-metrics">
        <div className="panel-card">
          <div className="financial-analytics-metric-heading">
            <span className="financial-analytics-metric-label">Recorded Revenue</span>
            <div className="financial-analytics-metric-icon">
              <DollarSign className="icon-default" />
            </div>
          </div>
          <div className="financial-analytics-metric-value">
            MYR {(metrics.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="financial-analytics-revenue-description">
            Across {metrics.totalTransactions || 0} total billing attempts
          </div>
        </div>

        <div className="panel-card">
          <div className="financial-analytics-metric-heading">
            <span className="financial-analytics-metric-label">Membership Revenue</span>
            <div className="financial-analytics-metric-icon">
              <Layers className="icon-default" />
            </div>
          </div>
          <div className="financial-analytics-metric-value">
            MYR {subRev.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="financial-analytics-revenue-share">
            {subPercent}% of total revenue
          </div>
        </div>

        <div className="panel-card">
          <div className="financial-analytics-metric-heading">
            <span className="financial-analytics-metric-label">Event Ticketing Revenue</span>
            <div className="financial-analytics-metric-icon">
              <Calendar className="icon-default" />
            </div>
          </div>
          <div className="financial-analytics-metric-value">
            MYR {eventRev.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="financial-analytics-revenue-share">
            {eventPercent}% of total revenue
          </div>
        </div>

        <div className="panel-card">
          <div className="financial-analytics-metric-heading">
            <span className="financial-analytics-metric-label">Monthly Membership Equivalent</span>
            <div className="financial-analytics-metric-icon">
              <TrendingUp className="icon-default" />
            </div>
          </div>
          <div className="financial-analytics-metric-value">
            MYR {(metrics.monthlyRecurringRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="financial-analytics-monthly-description">
            Annual equivalent: MYR {(metrics.annualRunRate || 0).toLocaleString()}
          </div>
        </div>
      </div>

      <DashboardAnalytics organisationId={organisationId} financialOnly />

      {/* Revenue Source Visual Breakdown */}
      <div className="financial-analytics-breakdowns">
        {/* Subscriptions vs Ticketing Comparison */}
        <div className="financial-analytics-breakdown-card">
          <h2 className="card-title">Revenue Sources Distribution</h2>

          <div className="form-stack">
            <div>
              <div className="financial-analytics-source-heading">
                <span className="financial-analytics-source-label">
                  <span className="financial-analytics-membership-dot" />
                  Membership Payments
                </span>
                <span className="financial-analytics-source-value">
                  MYR {subRev.toFixed(2)} ({subPercent}%)
                </span>
              </div>
              <div className="financial-analytics-source-track">
                <div
                  className="financial-analytics-membership-bar"
                  style={{ width: `${subPercent}%` }}
                />
              </div>
            </div>

            <div>
              <div className="financial-analytics-source-heading">
                <span className="financial-analytics-source-label">
                  <span className="financial-analytics-event-dot" />
                  Event Ticketing
                </span>
                <span className="financial-analytics-source-value">
                  MYR {eventRev.toFixed(2)} ({eventPercent}%)
                </span>
              </div>
              <div className="financial-analytics-source-track">
                <div
                  className="financial-analytics-event-bar"
                  style={{ width: `${eventPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="financial-analytics-invoice-summary">
            <div className="financial-analytics-invoice-summary-row">
              <span>Successful Payments:</span>
              <strong className="financial-analytics-paid-count">{metrics.paidInvoicesCount || 0} invoices</strong>
            </div>
            <div className="financial-analytics-invoice-summary-row">
              <span>Payment Gateway Failures Tracked:</span>
              <strong className="financial-analytics-declined-count">{metrics.failedInvoicesCount || 0} declined</strong>
            </div>
          </div>
        </div>

        {/* Revenue By Membership Tier */}
        <div className="financial-analytics-breakdown-card">
          <h2 className="card-title">Revenue by Membership Tier</h2>

          <div className="content-stack">
            {Object.entries(revenueByTier).map(([tierName, amount], idx) => {
              const tierShare = Math.round((Number(amount) / totalRev) * 100);
              const colors = ['bg-brand-primary', 'bg-brand-muted', 'bg-brand-silver', 'bg-brand-accent'];
              const barColor = colors[idx % colors.length];

              return (
                <div key={tierName} className="financial-analytics-tier-card">
                  <div className="financial-analytics-tier-heading">
                    <span className="financial-analytics-tier-name">{tierName}</span>
                    <span className="financial-analytics-tier-revenue">
                      MYR {Number(amount).toFixed(2)} ({tierShare}%)
                    </span>
                  </div>
                  <div className="financial-analytics-tier-track">
                    <div
                      className={`financial-analytics-tier-bar ${barColor}`}
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
        <div className="financial-analytics-ledger-header">
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
                <th className="financial-analytics-date-heading">Date</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {recentTransactions.map((tx) => {
                const isPaid = tx.paymentStatus === 'paid';
                return (
                  <tr key={tx._id} className="data-table-row">
                    <td className="financial-analytics-invoice-number-cell">{tx.invoiceNumber}</td>
                    <td className="financial-analytics-member-cell">{tx.userName}</td>
                    <td className="financial-analytics-tier-cell">{tx.tierName}</td>
                    <td className="financial-analytics-method-cell">{tx.paymentMethod}</td>
                    <td className="financial-analytics-amount-cell">MYR {Number(tx.amount).toFixed(2)}</td>
                    <td className="data-table-cell">
                      <span
                        className={`financial-analytics-status-badge ${
                          isPaid
                            ? "financial-analytics-status-paid"
                            : "financial-analytics-status-declined"
                        }`}
                      >
                        {isPaid ? <CheckCircle2 className="icon-tiny" /> : <AlertCircle className="icon-tiny" />}
                        {tx.paymentStatus}
                      </span>
                    </td>
                    <td className="financial-analytics-date-cell">
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
