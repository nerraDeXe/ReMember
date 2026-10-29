import React from 'react';
import { CreditCard, Building2, Smartphone, CheckCircle2, Receipt, ShieldCheck, Clock3 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function PaymentGatewayPage() {
  const { user } = useAuth();
  return <div className="max-w-3xl space-y-6">
    <div><h1 className="text-2xl font-bold text-slate-900">Payment Gateway</h1><p className="mt-2 text-sm text-slate-600">Membership payments for {user.activeOrganisation?.name}.</p></div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 flex items-start gap-3"><ShieldCheck className="w-6 h-6 text-amber-800 shrink-0" aria-hidden="true" /><div><h2 className="font-bold text-amber-950">Demo payments are enabled</h2><p className="text-sm text-amber-900 mt-1">No money is charged or transferred. Members use sample payment details to experience checkout, authorization, and a payment receipt.</p></div></div>
    <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
      <p className="flex items-center gap-2 font-semibold text-emerald-800"><CheckCircle2 className="w-5 h-5" aria-hidden="true" />Ready to use.</p>
      <div className="grid sm:grid-cols-3 gap-3">{[{ label: 'Demo card', icon: CreditCard }, { label: 'Online banking', icon: Building2 }, { label: 'eWallet', icon: Smartphone }].map(({ label, icon: Icon }) => <div key={label} className="rounded-lg border border-slate-200 p-4"><Icon className="w-5 h-5 text-slate-600 mb-3" aria-hidden="true" /><p className="text-sm font-semibold">{label}</p><p className="text-xs text-slate-500 mt-1">Simulated authorization</p></div>)}</div>
      <div className="space-y-4 text-sm text-slate-600"><p className="flex items-start gap-3"><ShieldCheck className="w-5 h-5 shrink-0 text-slate-500" aria-hidden="true" /><span>Paid memberships remain locked until the server confirms an approved demo payment. Free memberships activate immediately.</span></p><p className="flex items-start gap-3"><Receipt className="w-5 h-5 shrink-0 text-slate-500" aria-hidden="true" /><span>Successful payments create a receipt and extend membership for the selected month or year. Declined and canceled checkouts do not grant access.</span></p><p className="flex items-start gap-3"><Clock3 className="w-5 h-5 shrink-0 text-slate-500" aria-hidden="true" /><span>Renewals are manual. Members return to Manage Membership to pay for the next period; there are no automatic deductions.</span></p></div>
    </div>
    <p className="text-xs text-slate-500">Demo transactions appear in financial reports for testing. They represent simulated revenue.</p>
  </div>;
}
