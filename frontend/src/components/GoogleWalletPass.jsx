import React, { useState } from 'react';
import { ExternalLink, Check, Copy, RefreshCw, QrCode, ShieldCheck, Sparkles, User } from 'lucide-react';
import { useToast } from '../context/ToastContext.jsx';
import StatusBadge from './StatusBadge.jsx';
import { getOrganisationBadgeColor, getBadgeTextColor } from '../theme.js';

export default function GoogleWalletPass({ user, walletData, onSync }) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const badgeColor = getOrganisationBadgeColor(user?.organisation || user?.activeOrganisation);
  const textColor = getBadgeTextColor(badgeColor);
  const panelColor = textColor === '#ffffff' ? 'bg-black/20' : 'bg-white/50';
  const saveUrl = walletData?.saveUrl || user?.googleWallet?.saveUrl || `https://pay.google.com/gp/v/save/mock-pass-${user?._id}`;
  const lastSync = walletData?.lastSyncedAt || user?.googleWallet?.lastSyncedAt;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(saveUrl);
    setCopied(true);
    showToast('Google Wallet Pass link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSync = async () => {
    if (!onSync) return;
    setSyncing(true);
    try {
      await onSync();
      showToast('Google Wallet object synchronized successfully!', 'success');
    } catch (err) {
      showToast('Wallet sync failed: ' + err.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="wallet-pass-layout">
      {/* Flat Pass Card */}
      <div className="wallet-pass-preview" style={{ minHeight: '330px' }}>
        <div
          aria-label="Membership badge"
          style={{ backgroundColor: badgeColor, color: textColor }}
          className="wallet-pass-badge"
        >
          {/* Card Header */}
          <div className="wallet-pass-header">
            <div className="wallet-pass-action-group">
              <div className={`wallet-pass-brand-icon ${panelColor} wallet-pass-icon-center`}>
                <Sparkles className="icon-default" />
              </div>
              <div>
                <span className="wallet-pass-organisation-name">
                  {user?.organisation?.name || user?.activeOrganisation?.name || 'ReMember Club'}
                </span>
                <span className="wallet-pass-title">
                  Official Digital Pass
                </span>
              </div>
            </div>
            <StatusBadge status={user?.status} />
          </div>

          {/* Member Details */}
          <div className="wallet-pass-member">
            <div className={`wallet-pass-avatar ${panelColor} wallet-pass-icon-center`} role="img" aria-label={user?.avatarUrl ? `${user?.name || 'User'} profile photo` : `${user?.name || 'User'} profile icon`}>
              {user?.avatarUrl ? <img src={user.avatarUrl} alt={`${user?.name || 'User'} profile`} className="wallet-pass-avatar-image" /> : <User className="wallet-pass-avatar-icon" aria-hidden="true" />}
            </div>
            <div className="wallet-pass-member-details">
              <h3 className="wallet-pass-member-name">
                {user?.name}
              </h3>
              <p className="wallet-pass-membership-number">
                {user?.membershipNumber || 'MEM-2026-0000'}
              </p>
              <div className="wallet-pass-tier-position">
                <span className={`wallet-pass-tier-badge ${panelColor}`}>
                  {user?.tierName || 'Standard'}
                </span>
              </div>
            </div>
          </div>

          {/* Meta Information Bar */}
          <div className={`wallet-pass-metadata ${panelColor} wallet-pass-metadata-spacing`}>
            <div>
              <span className="wallet-pass-metadata-label">Valid Through</span>
              <span className="wallet-pass-metadata-value">
                {user?.expirationDate
                  ? new Date(user.expirationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                  : 'Perpetual Access'}
              </span>
            </div>
            <div>
              <span className="wallet-pass-metadata-label">Pass Security</span>
              <span className="wallet-pass-verified">
                <ShieldCheck className="icon-small" /> Google Verified
              </span>
            </div>
          </div>

          {/* Barcode & QR Code Section */}
          <div className="wallet-pass-codes">
            <div className="wallet-pass-barcode-group">
              {/* Flat barcode lines */}
              <div className="wallet-pass-barcode">
                {[4, 2, 6, 3, 5, 2, 4, 6, 2, 5, 3, 4, 6, 2, 4, 3, 5, 2, 6, 4, 3, 5, 2].map((h, i) => (
                  <div
                    key={i}
                    style={{ height: `${h * 4}px` }}
                    className={`wallet-pass-barcode-bar ${i % 2 === 0 ? "wallet-pass-barcode-ink" : "wallet-pass-barcode-gap"}`}
                  />
                ))}
              </div>
              <span className="wallet-pass-barcode-number">
                {user?.membershipNumber}
              </span>
            </div>

            {/* QR Code thumbnail */}
            <div className="wallet-pass-qr-frame">
              <QrCode className="wallet-pass-qr-icon" />
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Action Buttons */}
      <div className="wallet-pass-actions">
        {/* Official "Add to Google Wallet" Button */}
        <a
          href={saveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="wallet-pass-save-link"
        >
          <div className="wallet-pass-google-brand">
            <svg className="icon-medium" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
            </svg>
          </div>
          <span className="wallet-pass-save-label">
            Add to Google Wallet
          </span>
          <ExternalLink className="wallet-pass-external-icon" />
        </a>

        {/* Secondary controls */}
        <div className="wallet-pass-action-group">
          <button
            onClick={handleCopyLink}
            className="wallet-pass-copy-link"
          >
            {copied ? (
              <>
                <Check className="wallet-pass-copied-icon" />
                <span className="wallet-pass-copied-label">Pass URL Copied</span>
              </>
            ) : (
              <>
                <Copy className="icon-small" />
                <span>Copy Pass Link</span>
              </>
            )}
          </button>

          {onSync && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="wallet-pass-sync-button"
              title="Sync pass with Google Wallet API"
            >
              <RefreshCw className={`icon-small ${syncing ? "wallet-pass-syncing" : ''}`} />
              <span>Sync</span>
            </button>
          )}
        </div>

        {/* Sync Status Banner */}
        <div className="wallet-pass-sync-footer">
          <span className="wallet-pass-sync-status">
            <span className="wallet-pass-sync-indicator" />
            Google Wallet API Object synced
            {lastSync && ` • ${new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          </span>
        </div>
      </div>
    </div>
  );
}
