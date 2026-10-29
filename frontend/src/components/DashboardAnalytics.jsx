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
const chartCard = 'min-w-0 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm';
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" role="status" aria-label={financialOnly ? 'Loading financial analytics' : 'Loading dashboard analytics'}>
      {(financialOnly ? [0, 1] : [0, 1, 2, 3]).map((item) => (
        <div key={item} className={chartCard} aria-hidden="true">
          <div className="h-4 w-36 rounded bg-slate-100 motion-safe:animate-pulse" />
          <div className="mt-3 h-7 w-24 rounded bg-slate-100 motion-safe:animate-pulse" />
          <div className="mt-6 h-60 rounded-lg bg-slate-50 motion-safe:animate-pulse" />
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
    <section className="space-y-5" aria-labelledby={financialOnly ? 'financial-analytics-title' : 'dashboard-analytics-title'} aria-busy={loading}>
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-3">
        <div>
          <h2 id={financialOnly ? 'financial-analytics-title' : 'dashboard-analytics-title'} className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-brand-ink" aria-hidden="true" />
            {financialOnly ? 'Revenue & payment trends' : 'Analytics overview'}
          </h2>
          <p className="mt-1 text-xs text-slate-500">{periodLabel} · Monthly totals in UTC{endMonth === currentMonth ? ' · Current month to date' : ''}</p>
        </div>
        <div>
          <form onSubmit={applyRange} noValidate className="flex flex-wrap items-end gap-2" aria-label="Analytics month range">
            <label htmlFor="dashboard-analytics-start" className="min-w-[140px] flex-1 sm:flex-none text-[11px] font-semibold text-slate-600">
              From
              <input id="dashboard-analytics-start" type="month" required min="0001-01" max={currentMonth} value={draftRange.startMonth}
                onChange={(event) => setDraftRange((value) => ({ ...value, startMonth: event.target.value }))}
                aria-invalid={Boolean(rangeError)} aria-describedby={rangeError ? 'dashboard-analytics-range-error' : undefined}
                className="mt-1 block w-full min-w-0 sm:w-40 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700" />
            </label>
            <label htmlFor="dashboard-analytics-end" className="min-w-[140px] flex-1 sm:flex-none text-[11px] font-semibold text-slate-600">
              To
              <input id="dashboard-analytics-end" type="month" required min="0001-01" max={currentMonth} value={draftRange.endMonth}
                onChange={(event) => setDraftRange((value) => ({ ...value, endMonth: event.target.value }))}
                aria-invalid={Boolean(rangeError)} aria-describedby={rangeError ? 'dashboard-analytics-range-error' : undefined}
                className="mt-1 block w-full min-w-0 sm:w-40 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700" />
            </label>
            <button type="submit" disabled={Boolean(rangeError) || (loading && draftRange.startMonth === startMonth && draftRange.endMonth === endMonth)}
              className="flex items-center gap-2 rounded-lg border border-brand-primary bg-brand-primary px-3 py-2 text-xs font-semibold text-brand-ink hover:bg-brand-secondary disabled:opacity-50">
              {loading && <RefreshCw className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden="true" />}
              Apply range
            </button>
          </form>
          {rangeError && <p id="dashboard-analytics-range-error" role="status" className="mt-2 text-xs text-rose-700">{rangeError}</p>}
        </div>
      </div>

      {loading ? <ChartLoading financialOnly={financialOnly} /> : error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
          <p className="flex items-center gap-2 font-semibold"><AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />Analytics could not be loaded</p>
          <p className="mt-1 text-xs">{error}</p>
          <button type="button" onClick={() => setRevision((value) => value + 1)} className="mt-3 rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold hover:bg-rose-100">Try again</button>
        </div>
      ) : data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {!financialOnly && <>
          <article className={chartCard}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Membership growth</h3>
                <p className="mt-2 text-2xl font-extrabold text-slate-900 tabular-nums">{number(membershipMetric === 'newMembers' ? summary.newMembers : totalJoined)}</p>
                <p className="mt-0.5 text-xs text-slate-500">{membershipMetric === 'newMembers' ? 'new members in this period' : 'joined by the end of this period'}</p>
              </div>
              <div className="flex rounded-lg bg-slate-100 p-1" role="group" aria-label="Membership chart measure">
                {Object.entries({ newMembers: 'New joins', totalMembers: 'Total joined' }).map(([key, label]) => (
                  <button key={key} type="button" aria-pressed={membershipMetric === key} onClick={() => setMembershipMetric(key)}
                    className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${membershipMetric === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>{label}</button>
                ))}
              </div>
            </div>
            <div className="mt-5"><TrendChart title="Membership growth" data={data.membershipTrend} series={membershipSeries[membershipMetric]} valueFormatter={number} emptyMessage="No members joined in this period." /></div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Uses organisation join dates for members on the current roster, across all statuses. Total joined includes earlier joins; it does not track historical active membership.</p>
          </article>

          <article className={chartCard}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Member composition</h3>
                <p className="mt-1 text-xs text-slate-500">{number(memberTotal)} members · Current snapshot</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <span className="sr-only">Break down members by</span>
                <select value={demographic} onChange={(event) => setDemographic(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700">
                  <option value="countries">Country</option><option value="tiers">Membership tier</option><option value="statuses">Membership status</option>
                </select>
              </label>
            </div>
            <div className="mt-5"><DonutChart title="Member composition" data={members} emptyMessage="Member demographics will appear when members join." /></div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Includes all current members, regardless of the selected time range. Missing profile information appears as “Not provided”.</p>
          </article>

          </>}

          <article className={chartCard}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Revenue received</h3>
                <p className="mt-2 text-2xl font-extrabold text-slate-900 tabular-nums">{money(summary.revenue)}</p>
                <p className="mt-0.5 text-xs text-slate-500">MYR collected in this period</p>
              </div>
              {!financialOnly && <button type="button" onClick={() => onNavigate('admin-finances')} className="flex items-center gap-1 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900">Details<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></button>}
            </div>
            <div className="mt-5"><TrendChart title="Revenue received in MYR" data={data.paymentTrend} series={revenueSeries} valueFormatter={money} axisFormatter={compactMoney} allowDecimals emptyMessage="No MYR revenue received in this period." /></div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Paid MYR invoices only, grouped by payment date (invoice date when unavailable). Pending and failed invoices are excluded.{data.excludedCurrencyPayments > 0 && ` ${number(data.excludedCurrencyPayments)} payments in other currencies appear in payment counts only.`}</p>
          </article>

          <article className={chartCard}>
            <h3 className="text-sm font-bold text-slate-900">Payment activity</h3>
            <p className="mt-2 text-2xl font-extrabold text-slate-900 tabular-nums">{number(summary.paidPayments)}</p>
            <p className="mt-0.5 text-xs text-slate-500">successful payments in this period</p>
            <div className="mt-5"><TrendChart title="Successful and failed payments" data={data.paymentTrend} series={paymentSeries} valueFormatter={number} emptyMessage="No payment activity in this period." /></div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Counts invoices across all currencies. Successful payments use the payment date, falling back to the invoice date; failures use the invoice date.</p>
          </article>
        </div>
      )}
    </section>
  );
}
