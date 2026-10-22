import { randomUUID } from 'node:crypto';
import { OrganisationMembership } from '../models/index.js';
import { emailService } from './emailService.js';

/** New memberships alone carry eligibility; an atomic claim prevents repeat joins sending twice. */
export async function sendWelcomeForMembership(user, membership, organisation) {
  if (membership.role !== 'member' || membership.status !== 'active' || !membership.welcomeEmailEligible) return { status: 'skipped' };
  const token = randomUUID();
  const claimed = await OrganisationMembership.findOneAndUpdate({
    _id: membership._id, role: 'member', status: 'active', welcomeEmailEligible: true
  }, { $set: { welcomeEmailEligible: false, welcomeEmailClaimedAt: new Date().toISOString(), welcomeEmailClaimToken: token } }, { new: true });
  if (!claimed) return { status: 'skipped' };
  let result;
  try {
    result = await emailService.sendOrganisationWelcome(user, claimed, organisation);
    if (result?.status === 'sent') {
      await OrganisationMembership.findOneAndUpdate({ _id: claimed._id, welcomeEmailClaimToken: token }, {
        $set: { welcomeEmailSentAt: result.sentAt || new Date().toISOString() },
        $unset: { welcomeEmailClaimedAt: '', welcomeEmailClaimToken: '' }
      });
    }
    return result;
  } finally {
    if (result?.status !== 'sent') await OrganisationMembership.findOneAndUpdate({ _id: claimed._id, welcomeEmailClaimToken: token }, { $unset: { welcomeEmailClaimedAt: '', welcomeEmailClaimToken: '' } });
  }
}
