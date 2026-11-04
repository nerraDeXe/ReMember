import React from 'react';
import { CreditCard, User } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';
import { getOrganisationBadgeColor, getBadgeTextColor } from '../theme.js';

const dateLabel = value => new Date(value).toLocaleDateString('en-US', {
  year: 'numeric', month: 'short', day: 'numeric',
});

export default function MembershipCard({ user }) {
  const organisation = user?.organisation || user?.activeOrganisation;
  const badgeColor = getOrganisationBadgeColor(organisation);
  const textColor = getBadgeTextColor(badgeColor);
  const panelColor = textColor === '#ffffff' ? 'membership-card-panel-dark' : 'membership-card-panel-light';

  return (
    <article
      aria-label="Membership card"
      style={{ backgroundColor: badgeColor, color: textColor }}
      className="membership-card"
    >
      <div className="row-between-start mb-6">
        <div className="row-inline min-w-0">
          <div className={`membership-card-icon ${panelColor} icon-center`}>
            <CreditCard className="icon-default" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="membership-card-organisation">
              {organisation?.name || 'ReMember Club'}
            </p>
            <p className="membership-card-title">Membership Card</p>
          </div>
        </div>
        <StatusBadge status={user?.status} />
      </div>

      <div className="membership-card-holder">
        <div className={`membership-card-avatar ${panelColor} icon-center`} role="img" aria-label={user?.avatarUrl ? `${user?.name || 'User'} profile photo` : `${user?.name || 'User'} profile icon`}>
          {user?.avatarUrl
            ? <img src={user.avatarUrl} alt={`${user?.name || 'User'} profile`} className="avatar-photo" />
            : <User className="w-7 h-7" aria-hidden="true" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="membership-card-name">{user?.name}</h3>
          <p className="membership-card-number">
            {user?.membershipNumber || 'Member ID unavailable'}
          </p>
          <span className={`membership-card-tier ${panelColor}`}>
            {user?.tierName || 'Standard'}
          </span>
        </div>
      </div>

      <dl className={`grid-pair membership-card-dates ${panelColor} text-xs`}>
        <div>
          <dt className="membership-card-date-label">Member Since</dt>
          <dd className="font-semibold mt-1">{user?.joinedDate ? dateLabel(user.joinedDate) : 'Not recorded'}</dd>
        </div>
        <div>
          <dt className="membership-card-date-label">Valid Through</dt>
          <dd className="font-semibold mt-1">{user?.expirationDate ? dateLabel(user.expirationDate) : 'Perpetual Access'}</dd>
        </div>
      </dl>
    </article>
  );
}
