import { EmailNotification, ActivityLog } from '../models/index.js';
import { mailDelivery, logMailDeliveryFailure } from './mailDelivery.js';
import { getOrganisationEmailSettings, interpolateOrganisationEmail } from '../../shared/organisationEmails.js';
import { formatEventDateRange, formatEventTimeRange, getEventMapsUrl, getEventSchedule, hasEventCoordinates } from '../../shared/events.js';

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

export const emailService = {
  async sendOrganisationWelcome(user, membership, organisation) {
    return this._sendOrganisationTemplate('welcome', user, membership, organisation);
  },

  async sendOrganisationRenewal(user, membership, organisation) {
    return this._sendOrganisationTemplate('renewal', user, membership, organisation);
  },

  async _sendOrganisationTemplate(type, user, membership, organisation) {
    const settings = getOrganisationEmailSettings(organisation.emailSettings);
    if (!settings[type].enabled || user.notifications?.email === false || membership.role === 'owner') return { status: 'skipped' };
    const context = {
      memberName: user.name || user.firstName || 'Member',
      organisationName: organisation.name,
      tierName: membership.tierName || 'Community',
      expiryDate: membership.expirationDate && Number.isFinite(Date.parse(membership.expirationDate)) ? new Date(membership.expirationDate).toISOString().slice(0, 10) : 'No expiry date',
      renewalDays: settings.renewal.daysBefore
    };
    const subject = interpolateOrganisationEmail(settings[type].subject, context).replace(/[\r\n]+/g, ' ');
    const textContent = interpolateOrganisationEmail(settings[type].body, context);
    const htmlContent = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; border: 1px solid #BEBEBE; border-top: 4px solid #FFD700;"><h1>${escapeHtml(organisation.name)}</h1><p style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(textContent)}</p></div>`;
    return this._dispatchAndRecord({
      recipientEmail: user.email, recipientName: user.name || user.firstName || 'Member',
      type: type === 'welcome' ? 'REGISTRATION_WELCOME' : 'MEMBERSHIP_RENEWAL',
      subject, htmlContent, textContent, userId: user._id,
      organisationId: String(organisation._id)
    });
  },

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
  async sendRegistrationConfirmation(user, organisation = { _id: user.organisationId, name: 'ReMember' }) {
    return this.sendOrganisationWelcome(user, user, organisation);
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
              <td style="padding: 8px 0; text-align: right; color: #333333; font-size: 18px; font-weight: 700;">MYR ${invoice.amount.toFixed(2)}</td>
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
      userId: user._id,
      organisationId: invoice.organisationId
    });
  },

  /**
   * Send automated email upon event RSVP
   */
  async sendEventRsvpConfirmation(user, event) {
    const subject = `RSVP Confirmed: ${event.title} 🎟️`;
    const schedule = getEventSchedule(event);
    const scheduleHtml = schedule.map(day => `<li>${escapeHtml(day.date)}: ${escapeHtml(formatEventTimeRange(day))}</li>`).join('');
    const structuredSchedule = Array.isArray(event.schedule) && event.schedule.length > 0;
    const mapUrl = getEventMapsUrl(event);
    const osmAttribution = hasEventCoordinates(event);
    const timeZone = structuredSchedule && event.timeZone ? ` (${escapeHtml(event.timeZone)})` : '';
    const textContent = `RSVP confirmed: ${event.title}\n\n${formatEventDateRange(event)}${structuredSchedule && event.timeZone ? ` (${event.timeZone})` : ''}\n${schedule.map(day => `${day.date}: ${formatEventTimeRange(day)}`).join('\n')}\n\nLocation: ${event.location || ''}${mapUrl ? `\nOpen in Google Maps: ${mapUrl}` : ''}${osmAttribution ? '\nLocation data © OpenStreetMap contributors: https://www.openstreetmap.org/copyright' : ''}\n\nGuest: ${user.name} (${user.membershipNumber})\nPlease present your digital membership pass at check-in.`;
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #FFFFFF; color: #333333; padding: 32px; border-radius: 12px; border: 1px solid #BEBEBE; border-top: 4px solid #FFD700;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #333333; margin: 0; font-size: 26px;">You are Confirmed!</h1>
          <p style="color: #555555; font-size: 14px; margin-top: 4px;">Community Event Reservation</p>
        </div>
        <div style="background: #FFFBE6; padding: 24px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #F4D03F;">
          <h2 style="margin-top: 0; color: #333333; font-size: 20px;">${escapeHtml(event.title)}</h2>
          <p style="color: #555555; font-size: 14px; margin: 6px 0;"><strong>Date &amp; time:</strong> ${escapeHtml(formatEventDateRange(event))}${timeZone}</p>
          <ul style="color: #555555; font-size: 14px; line-height: 1.7;">${scheduleHtml}</ul>
          <p style="color: #555555; font-size: 14px; margin: 6px 0;"><strong>Location:</strong> ${escapeHtml(event.location || '')}${mapUrl ? ` &bull; <a href="${escapeHtml(mapUrl)}">Open in Google Maps</a>` : ''}</p>
          ${osmAttribution ? '<p style="color: #777777; font-size: 11px;">Location data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a></p>' : ''}
          <p style="color: #555555; font-size: 14px; margin: 6px 0;"><strong>Guest:</strong> ${escapeHtml(user.name)} (${escapeHtml(user.membershipNumber)})</p>
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
      textContent,
      userId: user._id,
      organisationId: event.organisationId
    });
  },

  /**
   * Keep an in-app copy and record the outcome of actual provider delivery.
   */
  async _dispatchAndRecord({ recipientEmail, recipientName, type, subject, htmlContent, textContent, userId, organisationId }) {
    const emailRecord = await EmailNotification.create({
      organisationId,
      recipientEmail,
      recipientName,
      type,
      subject,
      htmlContent,
      status: 'pending',
      deliveryMethod: mailDelivery.deliveryMethod()
    });

    if (!mailDelivery.isConfigured()) {
      emailRecord.status = 'unavailable';
    } else {
      try {
        const delivery = await mailDelivery.send({ to: recipientEmail, subject, text: textContent, html: htmlContent });
        if (delivery?.accepted !== true) throw new Error('The email provider did not accept the message.');
        if (delivery.deliveryMethod) emailRecord.deliveryMethod = delivery.deliveryMethod;
        emailRecord.status = 'sent';
        emailRecord.sentAt = new Date().toISOString();
      } catch (error) {
        emailRecord.status = 'failed';
        logMailDeliveryFailure('confirmation', error);
      }
    }
    await emailRecord.save();

    // Provider acceptance counts as sent; it does not confirm inbox placement.
    await ActivityLog.create({
      action: emailRecord.status === 'sent' ? 'EMAIL_SENT' : 'EMAIL_DELIVERY_FAILED',
      organisationId,
      userId: userId || null,
      userName: recipientName,
      userEmail: recipientEmail,
      actorRole: 'system',
      details: {
        type,
        subject,
        emailId: emailRecord._id,
        status: emailRecord.status
      },
      timestamp: new Date().toISOString()
    }).catch(console.error);

    return emailRecord;
  }
};
