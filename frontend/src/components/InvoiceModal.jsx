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
    <div className="invoice-overlay">
      <div role="dialog" aria-modal="true" aria-label="Invoice receipt" className="invoice-dialog">
        {/* Header */}
        <div className="invoice-toolbar">
          <div className="invoice-toolbar-group">
            <span className="invoice-document-label">
              Invoice Document
            </span>
            <span className="invoice-document-number">
              {invoice.invoiceNumber}
            </span>
          </div>
          <div className="invoice-toolbar-group">
            <button
              onClick={handlePrint}
              className="invoice-document-action"
              title="Print Invoice"
            >
              <Printer className="icon-default" />
              <span>Print</span>
            </button>
            <button
              onClick={handleDownload}
              className="invoice-document-action"
              title="Download JSON record"
            >
              <Download className="icon-default" />
              <span>Export</span>
            </button>
            <button
              onClick={onClose}
              className="invoice-close"
            >
              <X className="icon-medium" />
            </button>
          </div>
        </div>

        {/* Invoice Printable View */}
        <div className="invoice-document">
          {/* Logo & Status */}
          <div className="invoice-letterhead">
            <div>
              <h1 className="invoice-brand">
                Re<span className="invoice-brand-accent">Member</span> Club
              </h1>
              <p className="invoice-organisation">
                {invoice.organisationName || 'Membership payment receipt'}
              </p>
              <p className="invoice-billing-note">
                {isDemo ? 'DEMO PAYMENT · NO MONEY CHARGED' : 'Membership billing record'}
              </p>
            </div>
            <div className="invoice-details-right">
              <span
                className={`invoice-status ${
                  isPaid
                    ? "invoice-status-paid"
                    : "invoice-status-unpaid"
                }`}
              >
                {isPaid ? <CheckCircle2 className="icon-small" /> : <AlertCircle className="icon-small" />}
                {invoice.paymentStatus}
              </span>
              <p className="invoice-number">
                {invoice.invoiceNumber}
              </p>
            </div>
          </div>

          {/* Member & Billing Dates */}
          <div className="invoice-billing-details">
            <div>
              <span className="invoice-section-label">
                Billed To
              </span>
              <p className="invoice-member-name">{invoice.userName}</p>
              <p className="invoice-member-email">{invoice.userEmail}</p>
              <p className="invoice-payment-method">
                Payment Method: {invoice.paymentMethod}
              </p>
            </div>
            <div className="invoice-details-right">
              <span className="invoice-section-label">
                Payment Details
              </span>
              <p className="invoice-payment-detail">
                <strong className="invoice-detail-label">Date Paid:</strong>{' '}
                {invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : 'N/A'}
              </p>
              <p className="invoice-payment-detail">
                <strong className="invoice-detail-label">Coverage End:</strong>{' '}
                {invoice.periodEnd ? invoice.periodEnd.split('T')[0] : 'N/A'}
              </p>
              <p className="invoice-transaction-id">
                Txn: {invoice.transactionId || 'N/A'}
              </p>
            </div>
          </div>

          {/* Line Items */}
          <div className="invoice-items-frame">
            <table className="table-base">
              <thead className="invoice-items-header">
                <tr>
                  <th className="invoice-item-cell">Description</th>
                  <th className="invoice-interval-heading">Interval</th>
                  <th className="invoice-amount-heading">Amount</th>
                </tr>
              </thead>
              <tbody className="invoice-items-body">
                <tr>
                  <td className="invoice-item-cell">
                    <p className="invoice-item-title">
                      {invoice.tierName} Membership
                    </p>
                    <p className="invoice-item-description">
                      Full digital wallet privileges & exclusive community events
                    </p>
                  </td>
                  <td className="invoice-item-interval">
                    {invoice.billingInterval || 'Yearly'}
                  </td>
                  <td className="invoice-item-amount">
                    MYR {subtotal.toFixed(2)}
                  </td>
                </tr>
                {credit > 0 && <tr>
                  <td className="invoice-item-cell"><p className="invoice-item-title">Membership credit applied</p><p className="invoice-item-description">Unused paid time and available membership credit</p></td>
                  <td className="invoice-item-placeholder">—</td>
                  <td className="invoice-item-amount">−MYR {credit.toFixed(2)}</td>
                </tr>}
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="invoice-totals-align">
            <div className="invoice-totals">
              <div className="invoice-subtotal-row">
                <span>Subtotal:</span>
                <span>MYR {subtotal.toFixed(2)}</span>
              </div>
              {credit > 0 && <div className="invoice-subtotal-row"><span>Membership credit:</span><span>−MYR {credit.toFixed(2)}</span></div>}
              <div className="invoice-subtotal-row">
                <span>Tax (0%):</span>
                <span>MYR 0.00</span>
              </div>
              <div className="invoice-total-row">
                <span>Total Paid:</span>
                <span className="invoice-total-amount">
                  MYR {Number(invoice.amount).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {invoice.carryForwardCents > 0 && <p className="invoice-credit-note">MYR {(invoice.carryForwardCents / 100).toFixed(2)} membership credit remains available for a future membership payment.</p>}

          <div className="invoice-footer">
            {isDemo ? 'This is a simulated payment receipt. No money was charged or transferred.' : 'Thank you for being a valued member. Keep this receipt for your records.'}
          </div>
        </div>
      </div>
    </div>
  );
}
