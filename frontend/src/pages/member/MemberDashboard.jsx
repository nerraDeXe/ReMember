import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import {
  Calendar,
  CreditCard,
  Clock,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Wallet
} from 'lucide-react';
import { api } from '../../api.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import GoogleWalletPass from '../../components/GoogleWalletPass.jsx';
import EventSchedule, { EventLocation } from '../../components/EventSchedule.jsx';
import { getEventTiming } from '../../../../shared/eventTiming.js';
import { useEventNow } from '../../useEventNow.js';

export default function MemberDashboard({ onNavigate }) {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const now = useEventNow();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const dashRes = await api.getMemberDashboard();

      if (dashRes.success) {
        setDashboardData(dashRes);
      }
    } catch (err) {
      console.error('Failed to load member dashboard:', err);
      showToast('Could not load member data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleWalletSync = async () => {
    if (!user?._id) return;
    await api.syncWalletObject(user._id);
    await loadData();
    await refreshUser();
  };

  if (loading) {
    return (
      <div className="member-dashboard-loading">
        <div className="member-dashboard-loading-content">
          <RefreshCw className="loading-spinner" />
          <p className="member-dashboard-loading-message">Loading member credentials & digital pass...</p>
        </div>
      </div>
    );
  }

  const membership = dashboardData?.membership || user;
  const upcomingRsvps = (dashboardData?.upcomingRsvps || []).filter(event => getEventTiming(event, now).status !== 'ended');
  const formattedExpiry = membership?.expirationDate
    ? new Date(membership.expirationDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'Perpetual';

  return (
    <div className="page-stack">
      {/* Welcome & Status Ribbon */}
      <div className="member-dashboard-welcome">
        <div className="member-dashboard-welcome-content">
          <div className="detail-stack">
            <div className="member-dashboard-greeting">
              <span className="member-dashboard-greeting-label">
                Welcome back
              </span>
              <StatusBadge status={membership?.status} />
            </div>
            <h1 className="member-dashboard-member-name">
              {membership?.name}
            </h1>
            <div className="member-dashboard-membership-details">
              <span>
                <strong>Member ID:</strong>{' '}
                <span className="member-dashboard-member-number">{membership?.membershipNumber}</span>
              </span>
              <span>•</span>
              <span>
                <strong>Current Tier:</strong>{' '}
                <span className="member-dashboard-current-tier">{membership?.tierName}</span>
              </span>
              <span>•</span>
              <span className="member-dashboard-expiry">
                <Clock className="member-dashboard-clock-icon" />
                <strong>Valid Through:</strong> {formattedExpiry}
              </span>
            </div>
          </div>

          {/* Quick Action Renewal Button */}
          <div className="member-dashboard-quick-actions">
            <button
              onClick={() => onNavigate('member-membership')}
              className="member-dashboard-manage-button"
            >
              <CreditCard className="icon-default" />
              <span>Manage Membership</span>
            </button>
            <button
              onClick={() => onNavigate('member-events')}
              className="member-dashboard-events-button"
            >
              <Calendar className="icon-default" />
              <span>Events</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Google Wallet Pass & Member Quick Stats */}
      <div className="member-dashboard-columns">
        {/* Left Column: Digital Pass Showcase (5 cols) */}
        <div className="member-dashboard-pass-column">
          <div className="member-dashboard-pass-heading">
            <h2 className="member-dashboard-pass-title">
              <Wallet className="member-dashboard-wallet-icon" />
              Digital Membership Pass
            </h2>
            <span className="text-caption">Google Wallet Compatible</span>
          </div>

          <div className="panel-card">
            {membership?.googleWallet ? <GoogleWalletPass
              user={membership}
              walletData={membership?.googleWallet}
              onSync={handleWalletSync}
            /> : <div className="member-dashboard-pass-unavailable"><p>Your membership pass will be available when your membership is active.</p><button onClick={() => onNavigate('member-membership')} className="member-dashboard-pass-manage-button">Manage Membership</button></div>}
          </div>
        </div>

        {/* Right Column: Perks, Upcoming RSVPs & Quick Links (7 cols) */}
        <div className="member-dashboard-activity-column">
          {/* Tier Privileges Card */}
          <div className="panel-card">
            <div className="member-dashboard-card-heading">
              <div>
                <h3 className="panel-title">Your Tier Privileges</h3>
                <p className="text-caption">
                  Included with your {membership?.tierName} subscription
                </p>
              </div>
              <button
                onClick={() => onNavigate('member-membership')}
                className="member-dashboard-card-link"
              >
                Manage Membership &rarr;
              </button>
            </div>

            <div className="member-dashboard-perks">
              {(membership?.tier?.perks || []).map((perk, idx) => (
                <div
                  key={idx}
                  className="member-dashboard-perk"
                >
                  <CheckCircle2 className="member-dashboard-perk-icon" />
                  <span>{perk}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Event RSVPs */}
          <div className="panel-card">
            <div className="member-dashboard-card-heading">
              <div>
                <h3 className="panel-title">Confirmed Event RSVPs</h3>
                <p className="text-caption">
                  Events you have reserved a spot for
                </p>
              </div>
              <button
                onClick={() => onNavigate('member-events')}
                className="member-dashboard-card-link"
              >
                Browse All Events &rarr;
              </button>
            </div>

            {upcomingRsvps.length === 0 ? (
              <div className="member-dashboard-rsvps-empty">
                <Calendar className="member-dashboard-rsvps-empty-icon" />
                You haven't RSVP'd to any upcoming events yet.
                <button
                  onClick={() => onNavigate('member-events')}
                  className="member-dashboard-browse-events-link"
                >
                  View Event Calendar
                </button>
              </div>
            ) : (
              <div className="content-stack">
                {upcomingRsvps.map((evt) => (
                  <div
                    key={evt._id}
                    className="member-dashboard-upcoming-card"
                  >
                    <div className="member-dashboard-upcoming-details">
                      <div className="member-dashboard-item-title">{evt.title}</div>
                      <EventSchedule event={evt} compact />
                      <EventLocation event={evt} />
                    </div>
                    <span className="member-dashboard-rsvp-confirmed">
                      RSVP Confirmed
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Hub Navigation Cards */}
          <div className="member-dashboard-shortcuts">
            <div
              onClick={() => onNavigate('member-invoices')}
              className="group member-dashboard-shortcut-card"
            >
              <div>
                <h4 className="member-dashboard-item-title">Payment Invoices</h4>
                <p className="member-dashboard-shortcut-description">
                  View and download historical receipts
                </p>
              </div>
              <ArrowRight className="member-dashboard-shortcut-arrow" />
            </div>

            <div
              onClick={() => onNavigate('member-profile')}
              className="group member-dashboard-shortcut-card"
            >
              <div>
                <h4 className="member-dashboard-item-title">Profile Information</h4>
                <p className="member-dashboard-shortcut-description">
                  Update personal data stored in MongoDB
                </p>
              </div>
              <ArrowRight className="member-dashboard-shortcut-arrow" />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
