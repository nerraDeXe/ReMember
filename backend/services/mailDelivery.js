import nodemailer from 'nodemailer';

// Verification and recovery messages are delivered by SMTP. They are never written to the
// member notification inbox, database, or development logs.
export const mailDelivery = {
  isConfigured() {
    return Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM)
      && Boolean(process.env.SMTP_USER) === Boolean(process.env.SMTP_PASSWORD);
  },

  async send({ to, subject, text, html }) {
    if (!this.isConfigured()) throw new Error('SMTP email delivery has not been configured.');
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
    if (!result.accepted?.length) throw new Error('The email provider did not accept the verification message.');
    return { accepted: true };
  }
};
