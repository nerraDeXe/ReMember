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
    <div className="dialog-overlay overflow-y-auto">
      <div role="dialog" aria-modal="true" aria-label="Invoice receipt" className="surface-card invoice-dialog">
        {/* Header */}
        <div className="row-between invoice-toolbar">
          <div className="row-inline">
            <span className="text-caption invoice-document-label">
              Invoice Document
            </span>
            <span className="invoice-document-number">
              {invoice.invoiceNumber}
            </span>
          </div>
          <div className="row-inline">
            <button
              onClick={handlePrint}
              className="row-icon invoice-tool-button"
              title="Print Invoice"
            >
              <Printer className="icon-default" />
              <span>Print</span>
            </button>
            <button
              onClick={handleDownload}
              className="row-icon invoice-tool-button"
              title="Download JSON record"
            >
              <Download className="icon-default" />
              <span>Export</span>
            </button>
            <button
              onClick={onClose}
              className="dialog-close-button"
            >
              <X className="icon-medium" />
            </button>
          </div>
        </div>

        {/* Invoice Printable View */}
        <div className="invoice-paper">
          {/* Logo & Status */}
          <div className="invoice-heading">
            <div>
              <h1 className="invoice-brand">
                Re<span className="text-brand-ink print:text-black">Member</span> Club
              </h1>
              <p className="text-caption print:text-neutral-600 mt-0.5">
                {invoice.organisationName || 'Membership payment receipt'}
              </p>
              <p className="invoice-subheading">
                {isDemo ? 'DEMO PAYMENT · NO MONEY CHARGED' : 'Membership billing record'}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`row-icon-inline invoice-status ${
                  isPaid
                    ? "choice-selected text-brand-ink"
                    : "invoice-unpaid"
                }`}
              >
                {isPaid ? <CheckCircle2 className="icon-small" /> : <AlertCircle className="icon-small" />}
                {invoice.paymentStatus}
              </span>
              <p className="text-caption invoice-date">
                {invoice.invoiceNumber}
              </p>
            </div>
          </div>

          {/* Member & Billing Dates */}
          <div className="grid-pair invoice-addresses">
            <div>
              <span className="invoice-label">
                Billed To
              </span>
              <p className="panel-title print:text-black">{invoice.userName}</p>
              <p className="text-slate-500 print:text-neutral-600">{invoice.userEmail}</p>
              <p className="invoice-member-id">
                Payment Method: {invoice.paymentMethod}
              </p>
            </div>
            <div className="text-right">
              <span className="invoice-label">
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
              <p className="invoice-reference">
                Txn: {invoice.transactionId || 'N/A'}
              </p>
            </div>
          </div>

          {/* Line Items */}
          <div className="invoice-table-frame">
            <table className="table-base">
              <thead className="invoice-table-heading">
                <tr>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-center">Interval</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="invoice-table-body">
                <tr>
                  <td className="p-3">
                    <p className="invoice-line-title">
                      {invoice.tierName} Membership
                    </p>
                    <p className="text-note print:text-neutral-600">
                      Digital membership card & exclusive community events
                    </p>
                  </td>
                  <td className="invoice-method">
                    {invoice.billingInterval || 'Yearly'}
                  </td>
                  <td className="invoice-line-amount">
                    MYR {subtotal.toFixed(2)}
                  </td>
                </tr>
                {credit > 0 && <tr>
                  <td className="p-3"><p className="invoice-line-title">Membership credit applied</p><p className="text-note print:text-neutral-600">Unused paid time and available membership credit</p></td>
                  <td className="invoice-credit-method">—</td>
                  <td className="invoice-line-amount">−MYR {credit.toFixed(2)}</td>
                </tr>}
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="form-actions">
            <div className="invoice-totals">
              <div className="row-apart invoice-subtotal">
                <span>Subtotal:</span>
                <span>MYR {subtotal.toFixed(2)}</span>
              </div>
              {credit > 0 && <div className="row-apart invoice-subtotal"><span>Membership credit:</span><span>−MYR {credit.toFixed(2)}</span></div>}
              <div className="row-apart invoice-subtotal">
                <span>Tax (0%):</span>
                <span>MYR 0.00</span>
              </div>
              <div className="invoice-total">
                <span>Total Paid:</span>
                <span className="invoice-total-amount">
                  MYR {Number(invoice.amount).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {invoice.carryForwardCents > 0 && <p className="text-caption print:text-neutral-600">MYR {(invoice.carryForwardCents / 100).toFixed(2)} membership credit remains available for a future membership payment.</p>}

          <div className="text-note invoice-footer">
            {isDemo ? 'This is a simulated payment receipt. No money was charged or transferred.' : 'Thank you for being a valued member. Keep this receipt for your records.'}
          </div>
        </div>
      </div>
    </div>
  );
}
