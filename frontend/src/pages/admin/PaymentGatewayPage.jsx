import React from 'react';
import { CreditCard, Building2, Smartphone, CheckCircle2, Receipt, ShieldCheck, Clock3 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function PaymentGatewayPage() {
  const { user } = useAuth();
  return <div className="payment-gateway-page">
    <div><h1 className="payment-gateway-title">Payment Gateway</h1><p className="payment-gateway-introduction">Membership payments for {user.activeOrganisation?.name}.</p></div>
    <div className="payment-gateway-demo-notice"><ShieldCheck className="payment-gateway-demo-icon" aria-hidden="true" /><div><h2 className="payment-gateway-demo-title">Demo payments are enabled</h2><p className="payment-gateway-demo-description">No money is charged or transferred. Members use sample payment details to experience checkout, authorization, and a payment receipt.</p></div></div>
    <div className="payment-gateway-details-card">
      <p className="payment-gateway-ready-status"><CheckCircle2 className="icon-medium" aria-hidden="true" />Ready to use.</p>
      <div className="payment-gateway-methods">{[{ label: 'Demo card', icon: CreditCard }, { label: 'Online banking', icon: Building2 }, { label: 'eWallet', icon: Smartphone }].map(({ label, icon: Icon }) => <div key={label} className="payment-gateway-method-card"><Icon className="payment-gateway-method-icon" aria-hidden="true" /><p className="payment-gateway-method-name">{label}</p><p className="page-description">Simulated authorization</p></div>)}</div>
      <div className="payment-gateway-behaviour-notes"><p className="payment-gateway-behaviour-note"><ShieldCheck className="payment-gateway-note-icon" aria-hidden="true" /><span>Paid memberships remain locked until the server confirms an approved demo payment. Free memberships activate immediately.</span></p><p className="payment-gateway-behaviour-note"><Receipt className="payment-gateway-note-icon" aria-hidden="true" /><span>Successful payments create a receipt and extend membership for the selected month or year. Declined and canceled checkouts do not grant access.</span></p><p className="payment-gateway-behaviour-note"><Clock3 className="payment-gateway-note-icon" aria-hidden="true" /><span>Renewals are manual. Members return to Manage Membership to pay for the next period; there are no automatic deductions.</span></p></div>
    </div>
    <p className="text-caption">Demo transactions appear in financial reports for testing. They represent simulated revenue.</p>
  </div>;
}
