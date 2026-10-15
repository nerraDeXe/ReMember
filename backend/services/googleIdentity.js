import { OAuth2Client } from 'google-auth-library';
const client = new OAuth2Client();

export const googleIdentity = {
  clientId() { return process.env.GOOGLE_CLIENT_ID || ''; },
  async verify(credential) {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: this.clientId() });
    return ticket.getPayload();
  }
};
