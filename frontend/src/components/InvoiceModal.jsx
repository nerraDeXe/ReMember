import React from 'react';
import { X, Printer, Download, CheckCircle2, AlertCircle } from 'lucide-react';

export default function InvoiceModal({ invoice, isOpen, onClose }) {
  if (!isOpen || !invoice) return null;

  const isPaid = invoice.paymentStatus === 'paid';
  const isDemo = invoice.isSimulated === true || /demo/i.test(invoice.paymentMethod || '');
  const subtotal = Number.isFinite(invoice.subtotalCents) ? invoice.subtotalCents / 100 : Number(invoice.amount);
  const credit = Number.isFinite(invoice.creditCents) ? invoice.creditCents / 100 : 0;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(invoice, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${invoice.invoiceNumber}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-brand-muted/35 flex items-center justify-center p-4 animate-fadeIn">
      <div role="dialog" aria-modal="true" aria-label="Invoice receipt" className="relative w-full max-w-xl bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xl print:border-none print:shadow-none print:bg-white print:text-black">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-bold text-slate-500">
              Invoice Document
            </span>
            <span className="text-sm font-mono font-bold text-brand-ink">
              {invoice.invoiceNumber}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded text-xs flex items-center gap-1 transition-colors"
              title="Print Invoice"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
            <button
              onClick={handleDownload}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded text-xs flex items-center gap-1 transition-colors"
              title="Download JSON record"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Invoice Printable View */}
        <div className="p-8 space-y-6 bg-white text-slate-900 print:bg-white print:text-black">
          {/* Logo & Status */}
          <div className="flex items-start justify-between border-b border-slate-200 print:border-neutral-300 pb-6">
            <div>
              <h1 className="text-2xl font-black text-slate-900 print:text-black tracking-tight">
                Re<span className="text-brand-ink print:text-black">Member</span> Club
              </h1>
              <p className="text-xs text-slate-500 print:text-neutral-600 mt-0.5">
                {invoice.organisationName || 'Membership payment receipt'}
              </p>
              <p className="text-xs text-slate-400 print:text-neutral-500 mt-1">
                {isDemo ? 'DEMO PAYMENT · NO MONEY CHARGED' : 'Membership billing record'}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold border uppercase tracking-wide ${
                  isPaid
                    ? 'bg-brand-50 text-brand-ink border-brand-primary'
                    : 'bg-slate-100 text-brand-ink border-brand-muted'
                }`}
              >
                {isPaid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {invoice.paymentStatus}
              </span>
              <p className="text-xs text-slate-500 print:text-neutral-600 mt-2 font-mono">
                {invoice.invoiceNumber}
              </p>
            </div>
          </div>

          {/* Member & Billing Dates */}
          <div className="grid grid-cols-2 gap-6 text-xs">
            <div>
              <span className="text-slate-500 print:text-neutral-500 uppercase font-semibold block mb-1">
                Billed To
              </span>
              <p className="font-bold text-slate-900 print:text-black text-sm">{invoice.userName}</p>
              <p className="text-slate-500 print:text-neutral-600">{invoice.userEmail}</p>
              <p className="text-slate-400 print:text-neutral-500 mt-1 font-mono text-[11px]">
                Payment Method: {invoice.paymentMethod}
              </p>
            </div>
            <div className="text-right">
              <span className="text-slate-500 print:text-neutral-500 uppercase font-semibold block mb-1">
                Payment Details
              </span>
              <p className="text-slate-700 print:text-neutral-700">
                <strong className="text-slate-500">Date Paid:</strong>{' '}
                {invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : 'N/A'}
              </p>
              <p className="text-slate-700 print:text-neutral-700">
                <strong className="text-slate-500">Coverage End:</strong>{' '}
                {invoice.periodEnd ? invoice.periodEnd.split('T')[0] : 'N/A'}
              </p>
              <p className="text-slate-400 print:text-neutral-500 font-mono text-[11px] truncate max-w-[200px] ml-auto">
                Txn: {invoice.transactionId || 'N/A'}
              </p>
            </div>
          </div>

          {/* Line Items */}
          <div className="border border-slate-200 print:border-neutral-300 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 print:bg-neutral-100 text-slate-600 print:text-neutral-600 font-semibold border-b border-slate-200 print:border-neutral-300">
                <tr>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-center">Interval</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 print:divide-neutral-200">
                <tr>
                  <td className="p-3">
                    <p className="font-semibold text-slate-900 print:text-black">
                      {invoice.tierName} Membership
                    </p>
                    <p className="text-[11px] text-slate-500 print:text-neutral-600">
                      Full digital wallet privileges & exclusive community events
                    </p>
                  </td>
                  <td className="p-3 text-center text-slate-700 print:text-neutral-700 capitalize">
                    {invoice.billingInterval || 'Yearly'}
                  </td>
                  <td className="p-3 text-right font-bold text-slate-900 print:text-black">
                    MYR {subtotal.toFixed(2)}
                  </td>
                </tr>
                {credit > 0 && <tr>
                  <td className="p-3"><p className="font-semibold text-slate-900 print:text-black">Membership credit applied</p><p className="text-[11px] text-slate-500 print:text-neutral-600">Unused paid time and available membership credit</p></td>
                  <td className="p-3 text-center text-slate-500">—</td>
                  <td className="p-3 text-right font-bold text-slate-900 print:text-black">−MYR {credit.toFixed(2)}</td>
                </tr>}
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="flex justify-end pt-2">
            <div className="w-56 space-y-1.5 text-xs text-right">
              <div className="flex justify-between text-slate-500 print:text-neutral-600">
                <span>Subtotal:</span>
                <span>MYR {subtotal.toFixed(2)}</span>
              </div>
              {credit > 0 && <div className="flex justify-between text-slate-500 print:text-neutral-600"><span>Membership credit:</span><span>−MYR {credit.toFixed(2)}</span></div>}
              <div className="flex justify-between text-slate-500 print:text-neutral-600">
                <span>Tax (0%):</span>
                <span>MYR 0.00</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-slate-900 print:text-black pt-2 border-t border-slate-200 print:border-neutral-300">
                <span>Total Paid:</span>
                <span className="text-brand-ink font-black print:text-black">
                  MYR {Number(invoice.amount).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {invoice.carryForwardCents > 0 && <p className="text-xs text-slate-500 print:text-neutral-600">MYR {(invoice.carryForwardCents / 100).toFixed(2)} membership credit remains available for a future membership payment.</p>}

          <div className="pt-4 border-t border-slate-200 print:border-neutral-300 text-center text-[11px] text-slate-500 print:text-neutral-500">
            {isDemo ? 'This is a simulated payment receipt. No money was charged or transferred.' : 'Thank you for being a valued member. Keep this receipt for your records.'}
          </div>
        </div>
      </div>
    </div>
  );
}
