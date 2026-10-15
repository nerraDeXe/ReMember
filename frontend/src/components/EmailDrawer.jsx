import React, { useState, useEffect } from 'react';
import { Mail, X, CheckCircle2, Clock, Calendar, RefreshCw } from 'lucide-react';
import { api } from '../api.js';

export default function EmailDrawer({ isOpen, onClose }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);

  const loadEmails = async () => {
    setLoading(true);
    try {
      const data = await api.getEmails();
      if (data.success) {
        setEmails(data.emails || []);
        if (data.emails?.length > 0 && !selectedEmail) {
          setSelectedEmail(data.emails[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load email notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadEmails();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-brand-muted/35 flex justify-end animate-fadeIn">
      <div className="w-full max-w-2xl bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-primary text-brand-ink">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Automated Email Center
                <span className="text-[11px] bg-brand-primary/10 text-brand-ink px-2 py-0.5 rounded border border-brand-primary/30 font-semibold">
                  {emails.length} Dispatched
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                System emails dispatched upon Registration, Payment Completion & RSVP
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadEmails}
              disabled={loading}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
              title="Refresh Emails"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Email list */}
          <div className="w-full md:w-5/12 border-r border-slate-200 overflow-y-auto max-h-[40vh] md:max-h-full bg-slate-50">
            {emails.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                <Mail className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                No automated emails recorded yet.
              </div>
            ) : (
              emails.map((email) => {
                const isSelected = selectedEmail?._id === email._id;
                return (
                  <button
                    key={email._id}
                    onClick={() => setSelectedEmail(email)}
                    className={`w-full text-left p-3.5 border-b border-slate-200 transition-colors flex flex-col gap-1 ${
                      isSelected ? 'bg-white border-l-4 border-l-brand-primary shadow-sm' : 'hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-semibold text-slate-900 truncate max-w-[120px]">
                        {email.recipientName || email.recipientEmail}
                      </span>
                      <span className="flex items-center gap-1 text-[10px]">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(email.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-slate-800 line-clamp-1">
                      {email.subject}
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                      <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                        {email.type.replace('_', ' ')}
                      </span>
                      <span className="text-brand-ink flex items-center gap-0.5 text-[10px]">
                        <CheckCircle2 className="w-3 h-3" /> Sent
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Email Preview pane */}
          <div className="flex-1 bg-slate-100 overflow-y-auto p-5 flex flex-col">
            {selectedEmail ? (
              <div className="flex-1 flex flex-col">
                <div className="pb-3 mb-3 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-slate-900 mb-1">{selectedEmail.subject}</h3>
                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
                    <div>
                      <strong className="text-slate-700">To:</strong> {selectedEmail.recipientName} &lt;{selectedEmail.recipientEmail}&gt;
                    </div>
                    <div>
                      <strong className="text-slate-700">Date:</strong> {new Date(selectedEmail.sentAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Rendered HTML email */}
                <div className="flex-1 bg-white rounded-lg p-4 border border-slate-200 overflow-y-auto shadow-sm">
                  <div
                    className="email-render-preview email-preview"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.htmlContent }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
                Select an email from the left to view rendered preview.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
