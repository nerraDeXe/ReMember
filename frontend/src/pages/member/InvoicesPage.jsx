import React, { useState, useEffect } from 'react';
import { Receipt, Download, Eye, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import InvoiceModal from '../../components/InvoiceModal.jsx';
import { useUrlQuery, useUrlState } from '../../routing.jsx';

export default function InvoicesPage() {
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invoiceId, setInvoiceId] = useUrlState('invoice');
  const { closeQuery } = useUrlQuery();
  const [loadError, setLoadError] = useState('');
  const selectedInvoice = invoices.find(invoice => String(invoice._id) === invoiceId) || null;

  const loadInvoices = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.getMemberInvoices();
      if (data.success) {
        setInvoices(data.invoices || []);
      }
    } catch (err) {
      setLoadError(err.message || 'Could not load invoices.');
      console.error('Failed to load invoices:', err);
      showToast('Could not load invoices: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const handleDownload = (invoice) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(invoice, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${invoice.invoiceNumber}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast(`Invoice ${invoice.invoiceNumber} downloaded.`, 'success');
  };

  return (
    <div className="page-stack">
      <div>
        <h1 className="page-title">
          <Receipt className="invoices-receipt-icon" />
          Payment Invoices & Receipts
        </h1>
        <p className="page-description">
          Review your membership renewals and receipts. Demo payments do not involve real money.
        </p>
      </div>

      <div className="table-frame">
        {loading ? (
          <div className="loading-container">
            <RefreshCw className="loading-spinner" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="invoices-empty">
            <Receipt className="invoices-empty-icon" />
            No payment invoices on file yet.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table-base">
              <thead className="table-heading">
                <tr>
                  <th className="data-table-cell">Invoice #</th>
                  <th className="data-table-cell">Date</th>
                  <th className="data-table-cell">Tier Plan</th>
                  <th className="data-table-cell">Payment Method</th>
                  <th className="data-table-cell">Amount</th>
                  <th className="data-table-cell">Status</th>
                  <th className="invoices-actions-heading">Actions</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {invoices.map((inv) => {
                  const isPaid = inv.paymentStatus === 'paid';
                  return (
                    <tr key={inv._id} className="data-table-row">
                      <td className="invoices-number-cell">
                        {inv.invoiceNumber}
                      </td>
                      <td className="invoices-date-cell">
                        {inv.paidAt
                          ? new Date(inv.paidAt).toLocaleDateString()
                          : new Date(inv.createdAt).toLocaleDateString()}
                      </td>
                      <td className="invoices-tier-cell">
                        {inv.tierName}
                      </td>
                      <td className="invoices-method-cell">
                        {inv.paymentMethod}
                      </td>
                      <td className="invoices-amount-cell">
                        MYR {Number(inv.amount).toFixed(2)}
                      </td>
                      <td className="data-table-cell">
                        <span
                          className={`invoices-status-badge ${
                            isPaid
                              ? "invoices-status-paid"
                              : "invoices-status-declined"
                          }`}
                        >
                          {isPaid ? <CheckCircle2 className="icon-tiny" /> : <AlertCircle className="icon-tiny" />}
                          {inv.paymentStatus}
                        </span>
                      </td>
                      <td className="invoices-actions-cell">
                        <button
                          onClick={() => setInvoiceId(String(inv._id))}
                          className="invoices-receipt-action"
                          title="View Printable Receipt"
                        >
                          <Eye className="icon-default" />
                        </button>
                        <button
                          onClick={() => handleDownload(inv)}
                          className="invoices-receipt-action"
                          title="Download Invoice JSON"
                        >
                          <Download className="icon-default" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {invoiceId && !selectedInvoice && (
        <div className="invoices-receipt-overlay">
          <div role="dialog" aria-modal="true" aria-label="Invoice receipt" className="invoices-receipt-dialog">
            <p role={loading ? 'status' : 'alert'} className="invoices-receipt-status">{loading ? 'Loading invoice...' : loadError || 'This invoice could not be found in your current membership.'}</p>
            {loadError && <button onClick={loadInvoices} className="invoices-retry-button">Retry</button>}
            <button onClick={() => closeQuery(['invoice'])} className="invoices-return-button">Back to invoices</button>
          </div>
        </div>
      )}
      <InvoiceModal
        invoice={selectedInvoice}
        isOpen={!!selectedInvoice}
        onClose={() => closeQuery(['invoice'])}
      />
    </div>
  );
}
