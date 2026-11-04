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
import DashboardAnalytics from '../../components/DashboardAnalytics.jsx';

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
    <div className="page-stack">
      {/* Header Banner */}
      <div className="panel-card sm:p-8">
        <div className="management-header">
          <div>
            <div className="row-inline">
              <span className="text-eyebrow">
                Administration Portal
              </span>
            </div>
            <h1 className="dashboard-heading">
              {user?.activeOrganisation?.name} Dashboard
            </h1>
            <p className="text-help">
              Manage this organisation's members, membership tiers, events, and finances.
            </p>
          </div>

          <div className="row-wrap-wide">
            <button
              onClick={() => onNavigate('admin-members')}
              className="button-muted-bordered row-inline dashboard-action"
            >
              <Users className="icon-default" />
              <span>Manage Members</span>
            </button>
            <button
              onClick={() => onNavigate('admin-tiers')}
              className="button-muted-bordered row-inline dashboard-action"
            >
              <Layers className="icon-default" />
              <span>Tiers & Pricing</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Metric KPI Cards */}
      <div className="form-grid lg:grid-cols-4">
        <div className="panel-card">
          <div className="row-between">
            <span className="text-label-muted">Organisation Revenue</span>
            <div className="surface-brand-icon">
              <DollarSign className="icon-default" />
            </div>
          </div>
          <div className="metric-total">
            MYR {(metrics.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="row-icon text-note mt-1">
            <span className="text-brand-ink font-semibold">Sub: MYR {metrics.totalSubscriptionRevenue || 0}</span>
            <span>•</span>
            <span>Events: MYR {metrics.totalEventTicketingRevenue || 0}</span>
          </div>
        </div>

        <div className="panel-card">
          <div className="row-between">
            <span className="text-label-muted">Active Members</span>
            <div className="surface-brand-icon">
              <Users className="icon-default" />
            </div>
          </div>
          <div className="metric-total">
            {metrics.activeMembersCount || 0}{' '}
            <span className="text-caption font-normal">/ {metrics.membersCount || 0} registered</span>
          </div>
          <div className="dashboard-metric-note">
            Across this organisation's membership tiers
          </div>
        </div>

        <div className="panel-card">
          <div className="row-between">
            <span className="text-label-muted">Monthly Run Rate (MRR)</span>
            <div className="surface-brand-icon">
              <TrendingUp className="icon-default" />
            </div>
          </div>
          <div className="metric-total">
            MYR {(metrics.monthlyRecurringRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="dashboard-equivalent-note">
            ARR Run-Rate: MYR {(metrics.annualRunRate || 0).toLocaleString()}
          </div>
        </div>

        <div className="panel-card">
          <div className="row-between">
            <span className="text-label-muted">Paid Invoices</span>
            <div className="surface-brand-icon">
              <CreditCard className="icon-default" />
            </div>
          </div>
          <div className="metric-total">
            {metrics.paidInvoicesCount || 0}
          </div>
          <div className="dashboard-metric-note">
            {metrics.failedInvoicesCount || 0} payment failures tracked in audit
          </div>
        </div>
      </div>

      <DashboardAnalytics organisationId={user?.activeOrganisationId} onNavigate={onNavigate} />

    </div>
  );
}
