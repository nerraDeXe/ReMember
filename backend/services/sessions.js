import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';

export const SESSION_SECONDS = 24 * 60 * 60;
export const REMEMBER_SESSION_SECONDS = 30 * SESSION_SECONDS;

export function issueSession(user, rememberMe = false, expiresAt) {
  const exp = expiresAt || Math.floor(Date.now() / 1000) + (rememberMe === true ? REMEMBER_SESSION_SECONDS : SESSION_SECONDS);
  const token = jwt.sign({ id: user._id, email: user.email, role: user.role, name: user.name, purpose: 'session', ver: user.sessionVersion || 0, rememberMe: rememberMe === true, exp }, config.JWT_SECRET);
  return { token, session: { expiresAt: new Date(exp * 1000).toISOString(), rememberMe: rememberMe === true } };
}
