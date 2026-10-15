import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';
import { User, OrganisationMembership } from '../models/index.js';
import { isOrganisationOwner, resolveSelectedOrganisation } from '../services/organisationAccess.js';

export async function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user && !['revoked', 'suspended'].includes(user.status)) req.user = user;
    } catch {
      // Public discovery remains available when a session expires.
    }
  }
  next();
}

export async function requireOrganisationOwner(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Please sign in.' });
  if (req.user.emailVerified !== true) return res.status(403).json({ success: false, message: 'Confirm your email before managing an organisation.', requiresEmailVerification: true });
  try {
    const organisation = await resolveSelectedOrganisation(req.user);
    if (!isOrganisationOwner(organisation, req.user)) {
      return res.status(403).json({ success: false, message: 'Select an organisation you own to access its admin features.' });
    }
    req.organisation = organisation;
    req.organisationId = String(organisation._id);
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to check organisation access.' });
  }
}

export async function requireOrganisationMembership(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Please sign in.' });
  if (req.user.emailVerified !== true) return res.status(403).json({ success: false, message: 'Confirm your email to access organisation features.', requiresEmailVerification: true });
  try {
    const organisation = await resolveSelectedOrganisation(req.user);
    if (!organisation) return res.status(403).json({ success: false, message: 'Join or create an organisation first.' });
    const membership = await OrganisationMembership.findOne({ organisationId: String(organisation._id), userId: String(req.user._id) });
    if (!isOrganisationOwner(organisation, req.user) && membership?.status !== 'active') {
      return res.status(403).json({ success: false, message: 'An active membership in this organisation is required.' });
    }
    req.organisation = organisation;
    req.organisationId = String(organisation._id);
    req.organisationMembership = membership;
    req.membership = membership;
    next();
  } catch {
    res.status(500).json({ success: false, message: 'Unable to check organisation membership.' });
  }
}
