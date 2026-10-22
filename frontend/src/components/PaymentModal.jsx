import React, { useState, useEffect } from 'react';
import { X, CreditCard, Shield, CheckCircle, RefreshCw } from 'lucide-react';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function PaymentModal({ isOpen, onClose, user, tiers = [], onSuccess }) {
  const { showToast } = useToast();
  const [selectedTierId, setSelectedTierId] = useState(user?.tierId || '');
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('888');
  const [cardHolder, setCardHolder] = useState(user?.name || '');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedTierId(user?.tierId || tiers[0]?._id || '');
      setCompletedInvoice(null);
    }
  }, [isOpen, user?.activeOrganisationId, user?.tierId]);

  if (!isOpen) return null;

  const currentTier = tiers.find(t => t._id === selectedTierId) || { name: 'Choose a tier', price: 0 };

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    setProcessing(true);

    try {
      const response = await api.processRenewal({
        tierId: selectedTierId,
        billingInterval: currentTier.interval,
        paymentMethod: `Credit Card (•••• ${cardNumber.slice(-4)})`,
        simulateFailure
      });

      if (response.success) {
        setCompletedInvoice(response.invoice);
        showToast(response.message, response.emailDelivery && response.emailDelivery !== 'sent' ? 'info' : 'success');
        if (onSuccess) onSuccess(response);
      }
    } catch (err) {
      showToast(err.message || 'Payment processing failed.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setCompletedInvoice(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-brand-muted/35 flex items-center justify-center p-4 animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-primary text-brand-ink">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Membership Checkout</h2>
              <p className="text-xs text-slate-500">Test checkout · no real payment will be taken</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        {completedInvoice ? (
          <div className="p-8 text-center space-y-5">
            <div className="w-14 h-14 rounded-full bg-brand-50 border border-brand-primary text-brand-ink flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">Renewal Payment Complete!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Your membership and Google Wallet pass validity have been successfully extended.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice Number:</span>
                <span className="font-mono font-semibold text-brand-ink">{completedInvoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tier Renewed:</span>
                <span className="font-semibold text-slate-900">{completedInvoice.tierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Charged:</span>
                <span className="font-bold text-brand-ink">${Number(completedInvoice.amount).toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">New Validity Period:</span>
                <span className="text-slate-700">
                  {completedInvoice.periodEnd ? completedInvoice.periodEnd.split('T')[0] : 'N/A'}
                </span>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="w-full py-3 bg-brand-primary hover:bg-brand-secondary text-brand-ink font-semibold rounded-lg transition-colors"
            >
              Done & Return to Dashboard
            </button>
          </div>
        ) : (
          <form onSubmit={handleProcessPayment} className="p-6 space-y-5">
            {/* Tier Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                Select Renewal Tier
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {tiers.map((t) => {
                  const isSelected = selectedTierId === t._id;
                  return (
                    <button
                      key={t._id}
                      type="button"
                      onClick={() => setSelectedTierId(t._id)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        isSelected
                          ? 'bg-brand-50 border-brand-primary text-slate-900'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-900 truncate">{t.name}</div>
                      <div className="text-sm font-extrabold text-brand-ink mt-0.5">
                        ${t.price} <span className="text-[10px] text-slate-500 font-normal">/{t.interval}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Card Information */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Name on Card</label>
                <input
                  type="text"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-brand-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Card Number</label>
                <div className="relative">
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    required
                    placeholder="4242 4242 4242 4242"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-brand-primary pr-10 font-mono"
                  />
                  <CreditCard className="w-5 h-5 text-slate-400 absolute right-3 top-3" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expiration (MM/YY)</label>
                  <input
                    type="text"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    required
                    placeholder="MM/YY"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-brand-primary text-center font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">CVC / Security Code</label>
                  <input
                    type="text"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)}
                    required
                    placeholder="CVC"
                    maxLength={4}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-brand-primary text-center font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Test Simulation Mode */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-800">Test Mode: Simulate Decline</div>
                <div className="text-[11px] text-slate-500">
                  Tests audit log recording for PAYMENT_FAILED events
                </div>
              </div>
              <input
                type="checkbox"
                checked={simulateFailure}
                onChange={(e) => setSimulateFailure(e.target.checked)}
                className="w-4 h-4 rounded text-brand-ink accent-brand-primary cursor-pointer"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={processing}
              className={`w-full py-3 px-4 rounded-lg font-bold text-sm text-brand-ink flex items-center justify-center gap-2 transition-colors disabled:bg-slate-200 disabled:text-slate-600 disabled:cursor-wait ${
                simulateFailure
                  ? 'bg-brand-silver hover:bg-slate-300'
                  : 'bg-brand-primary hover:bg-brand-secondary'
              }`}
            >
              {processing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Payment via Gateway...</span>
                </>
              ) : simulateFailure ? (
                <span>Trigger Simulated Payment Failure ($ {currentTier.price})</span>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Complete Test Payment (${Number(currentTier.price).toFixed(2)} USD)</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
