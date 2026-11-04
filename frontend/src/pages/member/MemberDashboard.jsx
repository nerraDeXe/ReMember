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
  IdCard
} from 'lucide-react';
import { api } from '../../api.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import MembershipCard from '../../components/MembershipCard.jsx';
import EventSchedule, { EventLocation } from '../../components/EventSchedule.jsx';
import { getEventTiming } from '../../../../shared/eventTiming.js';
import { useEventNow } from '../../useEventNow.js';

export default function MemberDashboard({ onNavigate }) {
  const { user } = useAuth();
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

  if (loading) {
    return (
      <div className="icon-center min-h-[60vh]">
        <div className="row-inline-wide flex-col">
          <RefreshCw className="loading-spinner" />
          <p className="text-xs text-slate-400">Loading membership details...</p>
        </div>
      </div>
    );
  }

  const membership = dashboardData?.membership || user;
  const cardAvailable = membership?.status === 'active' && (!membership.expirationDate || new Date(membership.expirationDate).getTime() > now);
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
      <div className="panel-card sm:p-8">
        <div className="member-dashboard-header">
          <div className="detail-stack">
            <div className="row-inline">
              <span className="text-eyebrow">
                Welcome back
              </span>
              <StatusBadge status={membership?.status} />
            </div>
            <h1 className="member-welcome-title">
              {membership?.name}
            </h1>
            <div className="member-dashboard-details">
              <span>
                <strong>Member ID:</strong>{' '}
                <span className="member-reference">{membership?.membershipNumber}</span>
              </span>
              <span>•</span>
              <span>
                <strong>Current Tier:</strong>{' '}
                <span className="text-strong">{membership?.tierName}</span>
              </span>
              <span>•</span>
              <span className="row-icon">
                <Clock className="icon-small text-slate-400" />
                <strong>Valid Through:</strong> {formattedExpiry}
              </span>
            </div>
          </div>

          {/* Quick Action Renewal Button */}
          <div className="row-inline-wide">
            <button
              onClick={() => onNavigate('member-membership')}
              className="button-primary row-inline member-manage-button"
            >
              <CreditCard className="icon-default" />
              <span>Manage Membership</span>
            </button>
            <button
              onClick={() => onNavigate('member-events')}
              className="button-muted-bordered row-inline-tight member-dashboard-action"
            >
              <Calendar className="icon-default" />
              <span>Events</span>
            </button>
          </div>
        </div>
      </div>

      {/* Membership Card & Member Quick Stats */}
      <div className="member-dashboard-grid">
        {/* Membership Card (5 cols) */}
        <div className="form-stack lg:col-span-5">
          <div className="row-between">
            <h2 className="row-inline card-title">
              <IdCard className="icon-brand" />
              Membership Card
            </h2>
          </div>

          <div className="panel-card">
            {cardAvailable ? <MembershipCard user={membership} /> : <div className="text-description content-stack"><p>Your membership card will be available when your membership is active.</p><button onClick={() => onNavigate('member-membership')} className="member-credit-button">Manage Membership</button></div>}
          </div>
        </div>

        {/* Right Column: Perks, Upcoming RSVPs & Quick Links (7 cols) */}
        <div className="page-stack lg:col-span-7">
          {/* Tier Privileges Card */}
          <div className="panel-card">
            <div className="analytics-header">
              <div>
                <h3 className="panel-title">Your Tier Privileges</h3>
                <p className="text-caption">
                  Included with your {membership?.tierName} subscription
                </p>
              </div>
              <button
                onClick={() => onNavigate('member-membership')}
                className="link-brand text-xs"
              >
                Manage Membership &rarr;
              </button>
            </div>

            <div className="member-perks-grid">
              {(membership?.tier?.perks || []).map((perk, idx) => (
                <div
                  key={idx}
                  className="surface-muted member-upgrade-notice"
                >
                  <CheckCircle2 className="icon-default member-perk-icon" />
                  <span>{perk}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Event RSVPs */}
          <div className="panel-card">
            <div className="analytics-header">
              <div>
                <h3 className="panel-title">Confirmed Event RSVPs</h3>
                <p className="text-caption">
                  Events you have reserved a spot for
                </p>
              </div>
              <button
                onClick={() => onNavigate('member-events')}
                className="link-brand text-xs"
              >
                Browse All Events &rarr;
              </button>
            </div>

            {upcomingRsvps.length === 0 ? (
              <div className="detail-card text-caption member-rsvp-empty">
                <Calendar className="icon-large member-rsvp-empty-icon" />
                You haven't RSVP'd to any upcoming events yet.
                <button
                  onClick={() => onNavigate('member-events')}
                  className="link-brand member-rsvp-browse"
                >
                  View Event Calendar
                </button>
              </div>
            ) : (
              <div className="content-stack">
                {upcomingRsvps.map((evt) => (
                  <div
                    key={evt._id}
                    className="row-header surface-muted p-3.5"
                  >
                    <div className="content-stack member-rsvp-details">
                      <div className="heading-small">{evt.title}</div>
                      <EventSchedule event={evt} compact />
                      <EventLocation event={evt} />
                    </div>
                    <span className="choice-selected member-rsvp-badge">
                      RSVP Confirmed
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Hub Navigation Cards */}
          <div className="form-grid">
            <div
              onClick={() => onNavigate('member-invoices')}
              className="detail-card row-between member-hub-card group"
            >
              <div>
                <h4 className="heading-small">Payment Invoices</h4>
                <p className="text-note mt-0.5">
                  View and download historical receipts
                </p>
              </div>
              <ArrowRight className="icon-default member-hub-arrow" />
            </div>

            <div
              onClick={() => onNavigate('member-profile')}
              className="detail-card row-between member-hub-card group"
            >
              <div>
                <h4 className="heading-small">Profile Information</h4>
                <p className="text-note mt-0.5">
                  Update personal data stored in MongoDB
                </p>
              </div>
              <ArrowRight className="icon-default member-hub-arrow" />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
