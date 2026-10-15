export function sessionExpiry(token) {
  try {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(encoded));
    if (typeof payload.exp !== 'number') return 0;
    const limit = typeof payload.iat === 'number' ? payload.iat + (payload.rememberMe === true ? 30 : 1) * 86400 : payload.exp;
    return Math.min(payload.exp, limit) * 1000;
  } catch { return 0; }
}
