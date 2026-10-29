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
      <div className="admin-dashboard-welcome">
        <div className="admin-dashboard-welcome-content">
          <div>
            <div className="admin-dashboard-greeting">
              <span className="admin-dashboard-greeting-label">
                Administration Portal
              </span>
            </div>
            <h1 className="admin-dashboard-title">
              {user?.activeOrganisation?.name} Dashboard
            </h1>
            <p className="admin-dashboard-welcome-description">
              Manage this organisation's members, membership tiers, events, and finances.
            </p>
          </div>

          <div className="admin-dashboard-actions">
            <button
              onClick={() => onNavigate('admin-members')}
              className="admin-dashboard-manage-button"
            >
              <Users className="icon-default" />
              <span>Manage Members</span>
            </button>
            <button
              onClick={() => onNavigate('admin-tiers')}
              className="admin-dashboard-manage-button"
            >
              <Layers className="icon-default" />
              <span>Tiers & Pricing</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Metric KPI Cards */}
      <div className="admin-dashboard-metrics">
        <div className="panel-card">
          <div className="admin-dashboard-metric-heading">
            <span className="admin-dashboard-metric-label">Organisation Revenue</span>
            <div className="admin-dashboard-metric-icon">
              <DollarSign className="icon-default" />
            </div>
          </div>
          <div className="admin-dashboard-metric-value">
            MYR {(metrics.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="admin-dashboard-revenue-breakdown">
            <span className="admin-dashboard-subscription-revenue">Sub: MYR {metrics.totalSubscriptionRevenue || 0}</span>
            <span>•</span>
            <span>Events: MYR {metrics.totalEventTicketingRevenue || 0}</span>
          </div>
        </div>

        <div className="panel-card">
          <div className="admin-dashboard-metric-heading">
            <span className="admin-dashboard-metric-label">Active Members</span>
            <div className="admin-dashboard-metric-icon">
              <Users className="icon-default" />
            </div>
          </div>
          <div className="admin-dashboard-metric-value">
            {metrics.activeMembersCount || 0}{' '}
            <span className="admin-dashboard-registered-count">/ {metrics.membersCount || 0} registered</span>
          </div>
          <div className="admin-dashboard-metric-highlight">
            Across this organisation's membership tiers
          </div>
        </div>

        <div className="panel-card">
          <div className="admin-dashboard-metric-heading">
            <span className="admin-dashboard-metric-label">Monthly Run Rate (MRR)</span>
            <div className="admin-dashboard-metric-icon">
              <TrendingUp className="icon-default" />
            </div>
          </div>
          <div className="admin-dashboard-metric-value">
            MYR {(metrics.monthlyRecurringRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="admin-dashboard-mrr-description">
            ARR Run-Rate: MYR {(metrics.annualRunRate || 0).toLocaleString()}
          </div>
        </div>

        <div className="panel-card">
          <div className="admin-dashboard-metric-heading">
            <span className="admin-dashboard-metric-label">Paid Invoices</span>
            <div className="admin-dashboard-metric-icon">
              <CreditCard className="icon-default" />
            </div>
          </div>
          <div className="admin-dashboard-metric-value">
            {metrics.paidInvoicesCount || 0}
          </div>
          <div className="admin-dashboard-metric-highlight">
            {metrics.failedInvoicesCount || 0} payment failures tracked in audit
          </div>
        </div>
      </div>

      <DashboardAnalytics organisationId={user?.activeOrganisationId} onNavigate={onNavigate} />

    </div>
  );
}
