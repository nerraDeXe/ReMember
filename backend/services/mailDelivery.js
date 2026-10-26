import nodemailer from 'nodemailer';
import { gmailDelivery } from './gmailDelivery.js';

const FAILURE_REASONS = Object.freeze({
  ETIMEDOUT: 'Email provider connection timed out. Check network access; for SMTP, check outbound SMTP access on your hosting plan.',
  ECONNECTION: 'Could not connect to the SMTP server. Check the host, port, and network access.',
  ECONNREFUSED: 'The SMTP connection was refused. Check the host, port, and network access.',
  EDNS: 'The SMTP hostname could not be resolved. Check the host and network access.',
  ENOTFOUND: 'The SMTP hostname could not be resolved. Check the host and network access.',
  EAI_AGAIN: 'The SMTP hostname lookup failed temporarily. Check DNS and network access.',
  EAUTH: 'SMTP authentication failed. Check the credentials and provider account settings.',
  ETLS: 'The SMTP TLS handshake failed. Check TLS settings and the SMTP provider.',
  ESOCKET: 'The SMTP connection failed. Check TLS settings and network access.',
  EENVELOPE: 'The SMTP provider rejected the sender or recipient. Check provider sender requirements.',
  EMESSAGE: 'The SMTP provider rejected the message. Check provider delivery requirements.',
  ESTREAM: 'The email message could not be prepared for delivery.',
  CERT_HAS_EXPIRED: 'The SMTP TLS certificate has expired. Check the SMTP host and provider.',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'The SMTP TLS certificate could not be verified. Check the SMTP host and provider.',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'The SMTP TLS certificate could not be verified. Check the SMTP host and provider.',
  EMAIL_CONFIG: 'Email delivery configuration is incomplete or the selected transport is unsupported.',
  GMAIL_AUTH: 'Gmail authorization failed. Reauthorize the sender account and update its OAuth credentials.',
  GMAIL_FORBIDDEN: 'Gmail API access was denied. Check that the API is enabled and the sender granted email sending access.',
  GMAIL_RATE_LIMIT: 'Gmail temporarily limited email sending. Check the account sending limits.',
  GMAIL_UNAVAILABLE: 'Gmail API delivery is temporarily unavailable. Check provider availability and network access.',
});

const FAILURE_CONTEXTS = Object.freeze({
  verification: 'Verification email delivery failed.',
  password_reset: 'Password reset email delivery failed.',
  confirmation: 'Confirmation email delivery failed.',
});

// Nodemailer errors can contain credentials, recipients, or message content.
// Log only fixed text and allowlisted diagnostic fields, never the raw error.
export function logMailDeliveryFailure(context, error) {
  const code = typeof error?.code === 'string' && Object.hasOwn(FAILURE_REASONS, error.code) ? error.code : 'UNKNOWN';
  const responseCode = error?.responseCode;
  const details = {
    code,
    reason: FAILURE_REASONS[code] || 'Check email configuration, provider availability, and the application URL for password resets.',
    ...(Number.isInteger(responseCode) && responseCode >= 100 && responseCode <= 599 ? { responseCode } : {}),
  };
  const message = typeof context === 'string' && Object.hasOwn(FAILURE_CONTEXTS, context)
    ? FAILURE_CONTEXTS[context] : 'Email delivery failed.';
  console.error(message, details);
}

// Shared email transport. Callers keep verification and recovery secrets out of
// the member notification inbox, database, and development logs.
export const mailDelivery = {
  deliveryMethod() {
    const selected = (process.env.MAIL_TRANSPORT || 'auto').trim().toLowerCase();
    if (selected === 'smtp' || selected === 'gmail-api') return selected;
    if (selected !== 'auto') return undefined;
    // Partial Gmail setup must not silently fall back to blocked SMTP ports.
    return ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'].some(key => process.env[key]?.trim()) ? 'gmail-api' : 'smtp';
  },

  isConfigured() {
    const method = this.deliveryMethod();
    if (method === 'gmail-api') return gmailDelivery.isConfigured();
    return method === 'smtp' && Boolean(process.env.SMTP_HOST?.trim() && process.env.EMAIL_FROM?.trim())
      && Boolean(process.env.SMTP_USER?.trim()) === Boolean(process.env.SMTP_PASSWORD?.trim());
  },

  async send({ to, subject, text, html }) {
    if (!this.isConfigured()) throw Object.assign(new Error('Email delivery has not been configured.'), { code: 'EMAIL_CONFIG' });
    if (this.deliveryMethod() === 'gmail-api') return gmailDelivery.send({ to, subject, text, html });
    const port = Number(process.env.SMTP_PORT || 587);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      requireTLS: process.env.SMTP_REQUIRE_TLS !== 'false',
      ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {}),
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      logger: false,
      debug: false
    });
    const result = await transport.sendMail({ from: process.env.EMAIL_FROM, to, subject, text, html });
    if (!result.accepted?.length) throw new Error('The email provider did not accept the message.');
    return { accepted: true, deliveryMethod: 'smtp' };
  }
};
