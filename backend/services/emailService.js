import { EmailNotification, ActivityLog } from '../models/index.js';
import { config } from '../config/config.js';
import { mailDelivery } from './mailDelivery.js';

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

export const emailService = {
  async sendEmailVerification(user, code) {
    return mailDelivery.send({
      to: user.email,
      subject: 'Confirm your ReMember email address',
      text: `Hello ${user.firstName || user.name},\n\nYour ReMember email verification code is ${code}.\nThis code expires in 30 minutes. Enter it in ReMember to confirm your email address.\n\nIf you did not create a ReMember account, you can ignore this email.`,
      html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #FFFFFF; color: #333333; border: 1px solid #BEBEBE; border-top: 4px solid #FFD700;"><h1>Confirm your email address</h1><p>Hello ${escapeHtml(user.firstName || user.name)},</p><p>Enter this code in ReMember to confirm your email address:</p><p style="font-size: 32px; letter-spacing: 8px; font-weight: bold;">${code}</p><p>This code expires in 30 minutes.</p><p>If you did not create a ReMember account, you can ignore this email.</p></div>`
    });
  },

  /**
   * Send automated email upon registration
   */
  async sendRegistrationConfirmation(user) {
    const subject = `Welcome to ReMember Club, ${user.name}! 🌟`;
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #FFFFFF; color: #333333; padding: 32px; border-radius: 12px; border: 1px solid #BEBEBE; border-top: 4px solid #FFD700;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #333333; margin: 0; font-size: 28px; letter-spacing: -0.5px;">ReMember Club</h1>
          <p style="color: #555555; font-size: 14px; margin-top: 4px;">Exclusive Community & Membership Portal</p>
        </div>
        <div style="background: #FFFBE6; padding: 24px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #FFD700;">
          <h2 style="margin-top: 0; color: #333333; font-size: 20px;">Welcome aboard, ${user.name}!</h2>
          <p style="color: #555555; line-height: 1.6;">Your membership registration has been completed successfully. We are thrilled to welcome you to our growing community.</p>
          <div style="margin-top: 16px; padding: 12px; background: #FFFFFF; border-radius: 6px;">
            <p style="margin: 4px 0; font-size: 14px;"><strong>Membership Number:</strong> <span style="color: #333333;">${user.membershipNumber}</span></p>
            <p style="margin: 4px 0; font-size: 14px;"><strong>Membership Tier:</strong> <span style="color: #333333;">${user.tierName}</span></p>
            <p style="margin: 4px 0; font-size: 14px;"><strong>Status:</strong> <span style="color: #333333;">${user.status.toUpperCase()}</span></p>
          </div>
        </div>
        <p style="color: #555555; font-size: 13px; line-height: 1.5;">You can now log in to access upcoming community events, view your digital membership pass, and explore your perks.</p>
        <div style="text-align: center; margin-top: 32px; border-top: 1px solid #BEBEBE; padding-top: 20px;">
          <p style="color: #555555; font-size: 12px; margin: 0;">Sent by ${config.EMAIL_SENDER.NAME} &bull; ${config.EMAIL_SENDER.ADDRESS}</p>
        </div>
      </div>
    `;

    return this._dispatchAndRecord({
      recipientEmail: user.email,
      recipientName: user.name,
      type: 'REGISTRATION_WELCOME',
      subject,
      htmlContent,
      userId: user._id
    });
  },

  /**
   * Send automated email upon payment completion / renewal
   */
  async sendPaymentConfirmation(user, invoice) {
    const subject = `Payment Confirmed: Invoice #${invoice.invoiceNumber} 🧾`;
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #FFFFFF; color: #333333; padding: 32px; border-radius: 12px; border: 1px solid #BEBEBE; border-top: 4px solid #FFD700;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #333333; margin: 0; font-size: 28px;">Payment Successful</h1>
          <p style="color: #555555; font-size: 14px; margin-top: 4px;">Thank you for renewing your membership</p>
        </div>
        <div style="background: #FFFBE6; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; color: #555555;">Invoice Number</td>
              <td style="padding: 8px 0; text-align: right; color: #333333; font-weight: 600;">${invoice.invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #555555;">Tier Plan</td>
              <td style="padding: 8px 0; text-align: right; color: #333333; font-weight: 600;">${invoice.tierName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #555555;">Amount Paid</td>
              <td style="padding: 8px 0; text-align: right; color: #333333; font-size: 18px; font-weight: 700;">$${invoice.amount.toFixed(2)} USD</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #555555;">Payment Method</td>
              <td style="padding: 8px 0; text-align: right; color: #333333;">${invoice.paymentMethod}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #555555;">New Expiration Date</td>
              <td style="padding: 8px 0; text-align: right; color: #333333;">${invoice.periodEnd ? invoice.periodEnd.split('T')[0] : 'N/A'}</td>
            </tr>
          </table>
        </div>
        <p style="color: #555555; font-size: 13px;">Your digital membership pass has been updated with your new renewal validity.</p>
      </div>
    `;

    return this._dispatchAndRecord({
      recipientEmail: user.email,
      recipientName: user.name,
      type: 'PAYMENT_CONFIRMATION',
      subject,
      htmlContent,
      userId: user._id
    });
  },

  /**
   * Send automated email upon event RSVP
   */
  async sendEventRsvpConfirmation(user, event) {
    const subject = `RSVP Confirmed: ${event.title} 🎟️`;
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #FFFFFF; color: #333333; padding: 32px; border-radius: 12px; border: 1px solid #BEBEBE; border-top: 4px solid #FFD700;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #333333; margin: 0; font-size: 26px;">You are Confirmed!</h1>
          <p style="color: #555555; font-size: 14px; margin-top: 4px;">Community Event Reservation</p>
        </div>
        <div style="background: #FFFBE6; padding: 24px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #F4D03F;">
          <h2 style="margin-top: 0; color: #333333; font-size: 20px;">${event.title}</h2>
          <p style="color: #555555; font-size: 14px; margin: 6px 0;"><strong>📅 Date & Time:</strong> ${event.date} (${event.time})</p>
          <p style="color: #555555; font-size: 14px; margin: 6px 0;"><strong>📍 Location:</strong> ${event.location}</p>
          <p style="color: #555555; font-size: 14px; margin: 6px 0;"><strong>👤 Guest:</strong> ${user.name} (${user.membershipNumber})</p>
          <div style="margin-top: 16px; padding: 12px; background: #FFFFFF; border-radius: 6px; font-size: 13px; color: #555555;">
            Please present your digital membership pass at the check-in desk upon arrival.
          </div>
        </div>
      </div>
    `;

    return this._dispatchAndRecord({
      recipientEmail: user.email,
      recipientName: user.name,
      type: 'EVENT_RSVP',
      subject,
      htmlContent,
      userId: user._id
    });
  },

  /**
   * Internal helper to record email and print confirmation log
   */
  async _dispatchAndRecord({ recipientEmail, recipientName, type, subject, htmlContent, userId }) {
    console.log(`✉️ [Automated Email Dispatch] Sending [${type}] to ${recipientEmail} (${subject})`);

    const emailRecord = await EmailNotification.create({
      recipientEmail,
      recipientName,
      type,
      subject,
      htmlContent,
      status: 'sent',
      sentAt: new Date().toISOString()
    });

    // Record in activity log
    await ActivityLog.create({
      action: 'EMAIL_SENT',
      userId: userId || null,
      userName: recipientName,
      userEmail: recipientEmail,
      actorRole: 'system',
      details: {
        type,
        subject,
        emailId: emailRecord._id
      },
      timestamp: new Date().toISOString()
    }).catch(console.error);

    return emailRecord;
  }
};
