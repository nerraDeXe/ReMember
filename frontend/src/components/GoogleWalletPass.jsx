import React, { useState } from 'react';
import { ExternalLink, Check, Copy, RefreshCw, QrCode, ShieldCheck, Sparkles } from 'lucide-react';
import { useToast } from '../context/ToastContext.jsx';
import StatusBadge from './StatusBadge.jsx';

export default function GoogleWalletPass({ user, walletData, onSync }) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const tierStyles = {
    'Bronze Explorer': {
      bg: 'bg-brand-accent',
      textColor: 'text-brand-ink',
      badgeBg: 'bg-white/70 text-brand-ink border-brand-muted/30',
      subtext: 'text-brand-ink'
    },
    'Silver Patron': {
      bg: 'bg-brand-silver',
      textColor: 'text-brand-ink',
      badgeBg: 'bg-white/70 text-brand-ink border-brand-muted/30',
      subtext: 'text-brand-ink'
    },
    'Gold VIP': {
      bg: 'bg-brand-primary',
      textColor: 'text-brand-ink',
      badgeBg: 'bg-white/70 text-brand-ink border-brand-muted/30',
      subtext: 'text-brand-ink'
    },
    'Platinum Elite': {
      bg: 'bg-brand-secondary',
      textColor: 'text-brand-ink',
      badgeBg: 'bg-white/70 text-brand-ink border-brand-muted/30',
      subtext: 'text-brand-ink'
    }
  };

  const currentTheme = tierStyles[user?.tierName] || tierStyles['Gold VIP'];
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
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      {/* Flat Pass Card */}
      <div className="w-full relative" style={{ minHeight: '330px' }}>
        <div
          className={`w-full h-full rounded-xl p-6 ${currentTheme.bg} ${currentTheme.textColor} border border-brand-muted/30`}
        >
          {/* Card Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-white/50 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] tracking-widest uppercase font-bold opacity-80 block">
                  ReMember Club
                </span>
                <span className="text-sm font-extrabold tracking-tight">
                  Official Digital Pass
                </span>
              </div>
            </div>
            <StatusBadge status={user?.status} />
          </div>

          {/* Member Details */}
          <div className="flex items-center gap-4 my-4">
            <div className="w-14 h-14 rounded-full border-2 border-white/50 bg-white/40" aria-label={user?.avatarUrl ? `${user?.name} profile photo` : 'No profile photo'}>
              {user?.avatarUrl && <img src={user.avatarUrl} alt={`${user?.name || 'User'} profile`} className="w-full h-full rounded-full object-cover" />}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold leading-tight">
                {user?.name}
              </h3>
              <p className={`text-xs ${currentTheme.subtext} font-mono tracking-wider mt-0.5`}>
                {user?.membershipNumber || 'MEM-2026-0000'}
              </p>
              <div className="inline-block mt-1">
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${currentTheme.badgeBg}`}>
                  {user?.tierName || 'Standard'}
                </span>
              </div>
            </div>
          </div>

          {/* Meta Information Bar */}
          <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-white/50 text-xs my-4">
            <div>
              <span className="text-[10px] uppercase opacity-75 block">Valid Through</span>
              <span className="font-semibold">
                {user?.expirationDate
                  ? new Date(user.expirationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                  : 'Perpetual Access'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase opacity-75 block">Pass Security</span>
              <span className="font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Google Verified
              </span>
            </div>
          </div>

          {/* Barcode & QR Code Section */}
          <div className="flex items-center justify-between pt-2 border-t border-brand-muted/30">
            <div className="flex flex-col">
              {/* Flat barcode lines */}
              <div className="flex items-end gap-[2px] h-7 px-1.5 bg-white rounded p-1">
                {[4, 2, 6, 3, 5, 2, 4, 6, 2, 5, 3, 4, 6, 2, 4, 3, 5, 2, 6, 4, 3, 5, 2].map((h, i) => (
                  <div
                    key={i}
                    style={{ height: `${h * 4}px` }}
                    className={`w-[2px] ${i % 2 === 0 ? 'bg-black' : 'bg-transparent'}`}
                  />
                ))}
              </div>
              <span className="text-[9px] font-mono opacity-75 mt-0.5 text-center">
                {user?.membershipNumber}
              </span>
            </div>

            {/* QR Code thumbnail */}
            <div className="p-1.5 bg-white rounded">
              <QrCode className="w-8 h-8 text-black" />
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Action Buttons */}
      <div className="w-full mt-4 space-y-2.5">
        {/* Official "Add to Google Wallet" Button */}
        <a
          href={saveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-brand-50 text-brand-ink font-medium py-3 px-5 rounded-lg border border-brand-silver transition-colors shadow-sm"
        >
          <div className="flex items-center gap-1">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-wide">
            Add to Google Wallet
          </span>
          <ExternalLink className="w-4 h-4 text-slate-400" />
        </a>

        {/* Secondary controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs border border-slate-300 transition-colors shadow-sm"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-brand-ink" />
                <span className="text-brand-ink font-semibold">Pass URL Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Pass Link</span>
              </>
            )}
          </button>

          {onSync && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs border border-slate-300 transition-colors shadow-sm"
              title="Sync pass with Google Wallet API"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>
          )}
        </div>

        {/* Sync Status Banner */}
        <div className="text-center">
          <span className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-primary inline-block" />
            Google Wallet API Object synced
            {lastSync && ` • ${new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          </span>
        </div>
      </div>
    </div>
  );
}
