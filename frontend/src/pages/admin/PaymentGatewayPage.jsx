import React from 'react';
import { CreditCard, Building2, Smartphone, CheckCircle2, Receipt, ShieldCheck, Clock3 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function PaymentGatewayPage() {
  const { user } = useAuth();
  return <div className="max-w-3xl space-y-6">
    <div><h1 className="heading-large">Payment Gateway</h1><p className="text-intro">Membership payments for {user.activeOrganisation?.name}.</p></div>
    <div className="row-start gateway-notice"><ShieldCheck className="icon-large text-amber-800 shrink-0" aria-hidden="true" /><div><h2 className="font-bold text-amber-950">Demo payments are enabled</h2><p className="gateway-description">No money is charged or transferred. Members use sample payment details to experience checkout, authorization, and a payment receipt.</p></div></div>
    <div className="surface-card p-6 space-y-6">
      <p className="row-inline font-semibold text-emerald-800"><CheckCircle2 className="icon-medium" aria-hidden="true" />Ready to use.</p>
      <div className="gateway-methods">{[{ label: 'Demo card', icon: CreditCard }, { label: 'Online banking', icon: Building2 }, { label: 'eWallet', icon: Smartphone }].map(({ label, icon: Icon }) => <div key={label} className="detail-card"><Icon className="icon-medium text-slate-600 mb-3" aria-hidden="true" /><p className="text-sm font-semibold">{label}</p><p className="page-description">Simulated authorization</p></div>)}</div>
      <div className="text-description space-y-4"><p className="row-start"><ShieldCheck className="icon-medium shrink-0 text-slate-500" aria-hidden="true" /><span>Paid memberships remain locked until the server confirms an approved demo payment. Free memberships activate immediately.</span></p><p className="row-start"><Receipt className="icon-medium shrink-0 text-slate-500" aria-hidden="true" /><span>Successful payments create a receipt and extend membership for the selected month or year. Declined and canceled checkouts do not grant access.</span></p><p className="row-start"><Clock3 className="icon-medium shrink-0 text-slate-500" aria-hidden="true" /><span>Renewals are manual. Members return to Manage Membership to pay for the next period; there are no automatic deductions.</span></p></div>
    </div>
    <p className="text-caption">Demo transactions appear in financial reports for testing. They represent simulated revenue.</p>
  </div>;
}
