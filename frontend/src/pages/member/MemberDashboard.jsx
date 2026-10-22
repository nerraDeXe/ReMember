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
import PaymentModal from '../../components/PaymentModal.jsx';

export default function MemberDashboard({ onNavigate }) {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [dashboardData, setDashboardData] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);

  const loadData = async () => {
    try {
      const [dashRes, tiersRes] = await Promise.all([
        api.getMemberDashboard(),
        api.getTiers(),
      ]);

      if (dashRes.success) {
        setDashboardData(dashRes);
      }
      if (tiersRes.success) {
        setTiers(tiersRes.tiers || []);
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-brand-ink animate-spin" />
          <p className="text-xs text-slate-400">Loading member credentials & digital pass...</p>
        </div>
      </div>
    );
  }

  const membership = dashboardData?.membership || user;
  const formattedExpiry = membership?.expirationDate
    ? new Date(membership.expirationDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'Perpetual';

  return (
    <div className="space-y-6">
      {/* Welcome & Status Ribbon */}
      <div className="rounded-xl bg-white border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-ink">
                Welcome back
              </span>
              <StatusBadge status={membership?.status} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {membership?.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
              <span>
                <strong>Member ID:</strong>{' '}
                <span className="font-mono text-brand-ink font-semibold">{membership?.membershipNumber}</span>
              </span>
              <span>•</span>
              <span>
                <strong>Current Tier:</strong>{' '}
                <span className="text-slate-900 font-semibold">{membership?.tierName}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <strong>Valid Through:</strong> {formattedExpiry}
              </span>
            </div>
          </div>

          {/* Quick Action Renewal Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsRenewModalOpen(true)}
              className="py-2.5 px-5 rounded-lg bg-brand-primary hover:bg-brand-secondary text-brand-ink font-bold text-xs flex items-center gap-2 transition-colors shadow-sm"
            >
              <CreditCard className="w-4 h-4" />
              <span>{membership?.status === 'pending' ? 'Complete Membership Payment' : 'Renew Membership'}</span>
            </button>
            <button
              onClick={() => onNavigate('member-events')}
              className="py-2.5 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              <span>Events</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Google Wallet Pass & Member Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Digital Pass Showcase (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-brand-ink" />
              Digital Membership Pass
            </h2>
            <span className="text-xs text-slate-500">Google Wallet Compatible</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            {membership?.googleWallet ? <GoogleWalletPass
              user={membership}
              walletData={membership?.googleWallet}
              onSync={handleWalletSync}
            /> : <div className="space-y-3 text-sm text-slate-600"><p>Your membership pass will be available when your membership is active.</p><button onClick={() => setIsRenewModalOpen(true)} className="px-4 py-2 rounded-lg bg-brand-primary text-brand-ink font-semibold">Complete Membership</button></div>}
          </div>
        </div>

        {/* Right Column: Perks, Upcoming RSVPs & Quick Links (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Tier Privileges Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Your Tier Privileges</h3>
                <p className="text-xs text-slate-500">
                  Included with your {membership?.tierName} subscription
                </p>
              </div>
              <button
                onClick={() => setIsRenewModalOpen(true)}
                className="text-xs font-semibold text-brand-ink hover:underline"
              >
                Upgrade Tier &rarr;
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {(membership?.tier?.perks || []).map((perk, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700"
                >
                  <CheckCircle2 className="w-4 h-4 text-brand-muted shrink-0 mt-0.5" />
                  <span>{perk}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Event RSVPs */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Confirmed Event RSVPs</h3>
                <p className="text-xs text-slate-500">
                  Events you have reserved a spot for
                </p>
              </div>
              <button
                onClick={() => onNavigate('member-events')}
                className="text-xs font-semibold text-brand-ink hover:underline"
              >
                Browse All Events &rarr;
              </button>
            </div>

            {dashboardData?.upcomingRsvps?.length === 0 ? (
              <div className="text-center py-8 p-4 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500">
                <Calendar className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                You haven't RSVP'd to any upcoming events yet.
                <button
                  onClick={() => onNavigate('member-events')}
                  className="block mx-auto mt-2 text-brand-ink font-semibold hover:underline"
                >
                  View Event Calendar
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {dashboardData?.upcomingRsvps?.map((evt) => (
                  <div
                    key={evt._id}
                    className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{evt.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>📅 {evt.date}</span>
                        <span>•</span>
                        <span>📍 {evt.location}</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-50 text-brand-ink border border-brand-primary shrink-0">
                      RSVP Confirmed
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Hub Navigation Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              onClick={() => onNavigate('member-invoices')}
              className="p-4 rounded-lg bg-white border border-slate-200 hover:border-brand-primary cursor-pointer transition-colors shadow-sm flex items-center justify-between group"
            >
              <div>
                <h4 className="text-xs font-bold text-slate-900">Payment Invoices</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  View and download historical receipts
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-ink transition-colors" />
            </div>

            <div
              onClick={() => onNavigate('member-profile')}
              className="p-4 rounded-lg bg-white border border-slate-200 hover:border-brand-primary cursor-pointer transition-colors shadow-sm flex items-center justify-between group"
            >
              <div>
                <h4 className="text-xs font-bold text-slate-900">Profile Information</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Update personal data stored in MongoDB
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-ink transition-colors" />
            </div>
          </div>
        </div>
      </div>

      {/* Payment Renewal Modal */}
      <PaymentModal
        isOpen={isRenewModalOpen}
        onClose={() => setIsRenewModalOpen(false)}
        user={membership}
        tiers={tiers}
        onSuccess={() => {
          loadData();
          refreshUser();
        }}
      />
    </div>
  );
}
