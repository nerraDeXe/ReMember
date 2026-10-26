const statuses = {
  sent: { label: 'Sent', description: 'Accepted by the email provider. Inbox delivery is not confirmed.', isSent: true },
  pending: { label: 'Sending', description: 'Email delivery is in progress. Refresh to check its status.', isSent: false },
  failed: { label: 'Not sent', description: 'The email provider did not accept this message. Your confirmation remains available here.', isSent: false },
  unavailable: { label: 'Email unavailable', description: 'Email delivery was not configured. Your confirmation remains available here.', isSent: false },
  recorded: { label: 'Recorded only', description: 'This older confirmation was saved in the app without sending an email.', isSent: false },
};

export function emailDeliveryStatus(email) {
  const status = ['smtp', 'gmail-api'].includes(email.deliveryMethod) || email.status === 'unavailable' ? email.status : 'recorded';
  return statuses[status] || statuses.recorded;
}
