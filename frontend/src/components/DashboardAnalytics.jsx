import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, BarChart3, RefreshCw } from 'lucide-react';
import { api } from '../api.js';
import { TrendChart, DonutChart } from './AnalyticsCharts.jsx';
import { defaultAnalyticsRange, validateAnalyticsRange } from '../analyticsRange.js';
import { useUrlQuery, useUrlState } from '../routing.jsx';

const number = (value) => Number(value || 0).toLocaleString('en-US');
const money = (value) => Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'MYR', currencyDisplay: 'code' });
const compactMoney = (value) => Number(value || 0).toLocaleString('en-US', {
  style: 'currency', currency: 'MYR', currencyDisplay: 'code', notation: Math.abs(value) < 1 ? 'standard' : 'compact',
  maximumFractionDigits: Math.abs(value) < 1 ? 3 : 1,
});
const chartCard = "analytics-card";
const membershipSeries = {
  newMembers: [{ key: 'newMembers', label: 'New members', color: '#a16207' }],
  totalMembers: [{ key: 'totalMembers', label: 'Total joined', color: '#334155' }],
};
const paymentSeries = [
  { key: 'paidPayments', label: 'Successful', color: '#0f766e' },
  { key: 'failedPayments', label: 'Failed', color: '#be123c' },
];
const revenueSeries = [{ key: 'revenue', label: 'Revenue (MYR)', color: '#a16207' }];

function ChartLoading({ financialOnly = false }) {
  return (
    <div className="analytics-grid" role="status" aria-label={financialOnly ? 'Loading financial analytics' : 'Loading dashboard analytics'}>
      {(financialOnly ? [0, 1] : [0, 1, 2, 3]).map((item) => (
        <div key={item} className={chartCard} aria-hidden="true">
          <div className="analytics-skeleton-title" />
          <div className="analytics-skeleton-value" />
          <div className="analytics-skeleton-chart" />
        </div>
      ))}
      <span className="sr-only">Loading {financialOnly ? 'financial' : 'dashboard'} analytics.</span>
    </div>
  );
}

export default function DashboardAnalytics({ organisationId, onNavigate, financialOnly = false }) {
  const { query, updateQuery } = useUrlQuery();
  const requestedStart = query.get('startMonth');
  const requestedEnd = query.get('endMonth');
  const range = requestedStart && requestedEnd && !validateAnalyticsRange(requestedStart, requestedEnd)
    ? { startMonth: requestedStart, endMonth: requestedEnd } : defaultAnalyticsRange();
  const [draftRange, setDraftRange] = useState(range);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [requestedMetric, setMembershipMetric] = useUrlState('metric', 'newMembers');
  const membershipMetric = requestedMetric === 'totalMembers' ? 'totalMembers' : 'newMembers';
  const [requestedDemographic, setDemographic] = useUrlState('demographic', 'countries');
  const demographic = ['tiers', 'statuses'].includes(requestedDemographic) ? requestedDemographic : 'countries';
  const { startMonth, endMonth } = range;
  const currentMonth = defaultAnalyticsRange().endMonth;
  const rangeError = validateAnalyticsRange(draftRange.startMonth, draftRange.endMonth);

  const applyRange = (event) => {
    event.preventDefault();
    if (rangeError) return;
    if (draftRange.startMonth === startMonth && draftRange.endMonth === endMonth) {
      setRevision((value) => value + 1);
    } else {
      updateQuery({ startMonth: draftRange.startMonth, endMonth: draftRange.endMonth });
    }
  };

  useEffect(() => { setDraftRange({ startMonth, endMonth }); }, [startMonth, endMonth]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setResult(null);
    api.getDashboardAnalytics({ startMonth, endMonth }).then((response) => {
      if (!response.success) throw new Error(response.message || 'Could not load dashboard analytics.');
      if (!cancelled) setResult({ organisationId, startMonth, endMonth, response });
    }).catch((err) => {
      if (!cancelled) setError(err.message || 'Could not load dashboard analytics.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [startMonth, endMonth, organisationId, revision]);

  // A context or range change must never display the previous organisation's charts.
  const data = result?.organisationId === organisationId && result?.startMonth === startMonth && result?.endMonth === endMonth ? result.response : null;
  const summary = data?.summary || {};
  const members = data?.demographics?.[demographic] || [];
  const memberTotal = members.reduce((total, item) => total + item.value, 0);
  const totalJoined = data?.membershipTrend?.at(-1)?.totalMembers || 0;
  const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const periodLabel = `${dateFormat.format(new Date(`${startMonth}-01T00:00:00Z`))} – ${dateFormat.format(new Date(`${endMonth}-01T00:00:00Z`))}`;

  return (
    <section className="section-stack" aria-labelledby={financialOnly ? 'financial-analytics-title' : 'dashboard-analytics-title'} aria-busy={loading}>
      <div className="analytics-header">
        <div>
          <h2 id={financialOnly ? 'financial-analytics-title' : 'dashboard-analytics-title'} className="analytics-title">
            <BarChart3 className="analytics-title-icon" aria-hidden="true" />
            {financialOnly ? 'Revenue & payment trends' : 'Analytics overview'}
          </h2>
          <p className="page-description">{periodLabel} · Monthly totals in UTC{endMonth === currentMonth ? ' · Current month to date' : ''}</p>
        </div>
        <div>
          <form onSubmit={applyRange} noValidate className="analytics-range-form" aria-label="Analytics month range">
            <label htmlFor="dashboard-analytics-start" className="analytics-range-label">
              From
              <input id="dashboard-analytics-start" type="month" required min="0001-01" max={currentMonth} value={draftRange.startMonth}
                onChange={(event) => setDraftRange((value) => ({ ...value, startMonth: event.target.value }))}
                aria-invalid={Boolean(rangeError)} aria-describedby={rangeError ? 'dashboard-analytics-range-error' : undefined}
                className="analytics-month-input" />
            </label>
            <label htmlFor="dashboard-analytics-end" className="analytics-range-label">
              To
              <input id="dashboard-analytics-end" type="month" required min="0001-01" max={currentMonth} value={draftRange.endMonth}
                onChange={(event) => setDraftRange((value) => ({ ...value, endMonth: event.target.value }))}
                aria-invalid={Boolean(rangeError)} aria-describedby={rangeError ? 'dashboard-analytics-range-error' : undefined}
                className="analytics-month-input" />
            </label>
            <button type="submit" disabled={Boolean(rangeError) || (loading && draftRange.startMonth === startMonth && draftRange.endMonth === endMonth)}
              className="analytics-apply-range">
              {loading && <RefreshCw className="analytics-range-spinner" aria-hidden="true" />}
              Apply range
            </button>
          </form>
          {rangeError && <p id="dashboard-analytics-range-error" role="status" className="analytics-range-error">{rangeError}</p>}
        </div>
      </div>

      {loading ? <ChartLoading financialOnly={financialOnly} /> : error ? (
        <div role="alert" className="analytics-load-error">
          <p className="analytics-error-heading"><AlertCircle className="analytics-error-icon" aria-hidden="true" />Analytics could not be loaded</p>
          <p className="analytics-error-message">{error}</p>
          <button type="button" onClick={() => setRevision((value) => value + 1)} className="analytics-retry">Try again</button>
        </div>
      ) : data && (
        <div className="analytics-grid">
          {!financialOnly && <>
          <article className={chartCard}>
            <div className="analytics-card-header">
              <div>
                <h3 className="panel-title">Membership growth</h3>
                <p className="analytics-metric">{number(membershipMetric === 'newMembers' ? summary.newMembers : totalJoined)}</p>
                <p className="analytics-metric-caption">{membershipMetric === 'newMembers' ? 'new members in this period' : 'joined by the end of this period'}</p>
              </div>
              <div className="analytics-metric-options" role="group" aria-label="Membership chart measure">
                {Object.entries({ newMembers: 'New joins', totalMembers: 'Total joined' }).map(([key, label]) => (
                  <button key={key} type="button" aria-pressed={membershipMetric === key} onClick={() => setMembershipMetric(key)}
                    className={`analytics-metric-option ${membershipMetric === key ? "analytics-metric-active" : "analytics-metric-idle"}`}>{label}</button>
                ))}
              </div>
            </div>
            <div className="analytics-chart"><TrendChart title="Membership growth" data={data.membershipTrend} series={membershipSeries[membershipMetric]} valueFormatter={number} emptyMessage="No members joined in this period." /></div>
            <p className="analytics-chart-note">Uses organisation join dates for members on the current roster, across all statuses. Total joined includes earlier joins; it does not track historical active membership.</p>
          </article>

          <article className={chartCard}>
            <div className="analytics-card-header">
              <div>
                <h3 className="panel-title">Member composition</h3>
                <p className="page-description">{number(memberTotal)} members · Current snapshot</p>
              </div>
              <label className="analytics-breakdown-label">
                <span className="sr-only">Break down members by</span>
                <select value={demographic} onChange={(event) => setDemographic(event.target.value)} className="analytics-breakdown-select">
                  <option value="countries">Country</option><option value="tiers">Membership tier</option><option value="statuses">Membership status</option>
                </select>
              </label>
            </div>
            <div className="analytics-chart"><DonutChart title="Member composition" data={members} emptyMessage="Member demographics will appear when members join." /></div>
            <p className="analytics-chart-note">Includes all current members, regardless of the selected time range. Missing profile information appears as “Not provided”.</p>
          </article>

          </>}

          <article className={chartCard}>
            <div className="analytics-revenue-header">
              <div>
                <h3 className="panel-title">Revenue received</h3>
                <p className="analytics-metric">{money(summary.revenue)}</p>
                <p className="analytics-metric-caption">MYR collected in this period</p>
              </div>
              {!financialOnly && <button type="button" onClick={() => onNavigate('admin-finances')} className="analytics-revenue-details">Details<ArrowRight className="icon-small" aria-hidden="true" /></button>}
            </div>
            <div className="analytics-chart"><TrendChart title="Revenue received in MYR" data={data.paymentTrend} series={revenueSeries} valueFormatter={money} axisFormatter={compactMoney} allowDecimals emptyMessage="No MYR revenue received in this period." /></div>
            <p className="analytics-chart-note">Paid MYR invoices only, grouped by payment date (invoice date when unavailable). Pending and failed invoices are excluded.{data.excludedCurrencyPayments > 0 && ` ${number(data.excludedCurrencyPayments)} payments in other currencies appear in payment counts only.`}</p>
          </article>

          <article className={chartCard}>
            <h3 className="panel-title">Payment activity</h3>
            <p className="analytics-metric">{number(summary.paidPayments)}</p>
            <p className="analytics-metric-caption">successful payments in this period</p>
            <div className="analytics-chart"><TrendChart title="Successful and failed payments" data={data.paymentTrend} series={paymentSeries} valueFormatter={number} emptyMessage="No payment activity in this period." /></div>
            <p className="analytics-chart-note">Counts invoices across all currencies. Successful payments use the payment date, falling back to the invoice date; failures use the invoice date.</p>
          </article>
        </div>
      )}
    </section>
  );
}
