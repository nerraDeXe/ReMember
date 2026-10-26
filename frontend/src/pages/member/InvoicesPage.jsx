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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Receipt className="w-6 h-6 text-brand-ink" />
          Payment Invoices & Receipts
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Review your subscription renewals, transaction receipts, and download records for your files.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 flex justify-center">
            <RefreshCw className="w-8 h-8 text-brand-ink animate-spin" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            No payment invoices on file yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4">Invoice #</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Tier Plan</th>
                  <th className="p-4">Payment Method</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => {
                  const isPaid = inv.paymentStatus === 'paid';
                  return (
                    <tr key={inv._id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="p-4 font-mono font-bold text-brand-ink">
                        {inv.invoiceNumber}
                      </td>
                      <td className="p-4 text-slate-600">
                        {inv.paidAt
                          ? new Date(inv.paidAt).toLocaleDateString()
                          : new Date(inv.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 font-semibold text-slate-900">
                        {inv.tierName}
                      </td>
                      <td className="p-4 text-slate-500 font-mono text-[11px]">
                        {inv.paymentMethod}
                      </td>
                      <td className="p-4 font-bold text-slate-900">
                        MYR {Number(inv.amount).toFixed(2)}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            isPaid
                              ? 'bg-brand-50 text-brand-ink border-brand-primary'
                              : 'bg-slate-100 text-brand-ink border-brand-silver'
                          }`}
                        >
                          {isPaid ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                          {inv.paymentStatus}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => setInvoiceId(String(inv._id))}
                          className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition-colors"
                          title="View Printable Receipt"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownload(inv)}
                          className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition-colors"
                          title="Download Invoice JSON"
                        >
                          <Download className="w-4 h-4" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-muted/35">
          <div role="dialog" aria-modal="true" aria-label="Invoice receipt" className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 space-y-4">
            <p role={loading ? 'status' : 'alert'} className="text-sm text-slate-700">{loading ? 'Loading invoice...' : loadError || 'This invoice could not be found in your current membership.'}</p>
            {loadError && <button onClick={loadInvoices} className="mr-4 text-sm font-semibold text-brand-ink hover:underline">Retry</button>}
            <button onClick={() => closeQuery(['invoice'])} className="text-sm font-semibold text-brand-ink hover:underline">Back to invoices</button>
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
