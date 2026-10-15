import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';
import { User, ActivityLog } from '../models/index.js';
import { getAccountContext } from '../services/organisationAccess.js';

/**
 * JWT Authentication Middleware
 * Validates the Authorization Bearer token and attaches authenticated user
 */
export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access Denied: No authentication token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session: User account no longer exists.'
      });
    }

    if (user.status === 'revoked' || user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: `Account is currently ${user.status}. Please contact administration.`
      });
    }

    // Attach user object to request
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired session token.',
      error: error.message
    });
  }
};

export const requireVerifiedEmail = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required.' });
  if (!req.user.emailVerified) {
    return res.status(403).json({ success: false, code: 'EMAIL_VERIFICATION_REQUIRED', message: 'Confirm your email address before creating or joining an organisation.' });
  }
  return next();
};

/**
 * Role-Based Access Control (RBAC) Middleware
 * Restricts endpoint access strictly to designated roles (e.g. 'admin')
 */
export const requireRole = (...roles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    let effectiveRole;
    try {
      const context = await getAccountContext(req.user);
      effectiveRole = req.user.emailVerified && context.organisationRole === 'owner' ? 'admin' : 'member';
      req.accountContext = context;
    } catch {
      return res.status(503).json({ success: false, message: 'Could not confirm your organisation permissions. Please try again.' });
    }

    if (!roles.includes(effectiveRole)) {
      // Log unauthorized attempt to audit log
      ActivityLog.create({
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        userId: req.user._id,
        userName: req.user.name,
        userEmail: req.user.email,
        actorRole: effectiveRole,
        details: {
          path: req.originalUrl,
          method: req.method,
          requiredRoles: roles
        },
        ipAddress: req.ip || req.connection.remoteAddress || '127.0.0.1',
        timestamp: new Date().toISOString()
      }).catch(console.error);

      return res.status(403).json({
        success: false,
        message: 'You do not have permission to use this feature in the selected organisation.'
      });
    }

    next();
  };
};
