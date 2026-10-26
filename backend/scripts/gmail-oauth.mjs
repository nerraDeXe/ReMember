import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { OAuth2Client } from 'google-auth-library';

export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
export const CALLBACK_URL = 'http://127.0.0.1:53682/oauth2/callback';
export const DESKTOP_CALLBACK_URL = 'http://127.0.0.1:53682/';
const ENV_PATH = fileURLToPath(new URL('../.env', import.meta.url));

class SetupError extends Error {}

/** Preserve unrelated settings, including multiline values; remove duplicate target keys. */
export function updateEnvironment(source, updates) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const seen = new Set();
  const assignments = /^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*(?:"(?:\\.|[^"\\])*"|'[^']*'|`[^`]*`|[^\r\n]*)(?:[ \t]*#[^\r\n]*)?\r?$/gm;
  const encode = (key, value) => {
    if (/[\r\n"'`]/.test(value)) throw new SetupError('Google returned an unexpected token format. No settings were changed.');
    return `${key}="${value}"`;
  };
  let result = source.replace(assignments, (assignment, key) => {
    if (!Object.hasOwn(updates, key)) return assignment;
    if (seen.has(key)) return assignment.endsWith('\r') ? '\r' : '';
    seen.add(key);
    return encode(key, updates[key]) + (assignment.endsWith('\r') ? '\r' : '');
  });
  for (const [key, value] of Object.entries(updates)) {
    if (seen.has(key)) continue;
    if (result && !result.endsWith('\n')) result += newline;
    result += `${encode(key, value)}${newline}`;
  }
  return result;
}

function equalState(actual, expected) {
  const value = Buffer.from(actual || '');
  const reference = Buffer.from(expected);
  return value.length === reference.length && timingSafeEqual(value, reference);
}

function reply(response, status, message) {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(message);
}

async function saveRefreshToken(refreshToken, envPath = ENV_PATH) {
  // Read again so unrelated settings edited during consent are preserved.
  let source = '';
  try { source = await readFile(envPath, 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw new SetupError('Could not read backend/.env. No settings were changed.'); }
  const result = updateEnvironment(source, { MAIL_TRANSPORT: 'gmail-api', GMAIL_REFRESH_TOKEN: refreshToken });
  const temporaryPath = `${envPath}.gmail-oauth-${randomBytes(8).toString('hex')}`;
  try {
    await writeFile(temporaryPath, result, { flag: 'wx', mode: 0o600 });
    await rename(temporaryPath, envPath);
  } catch {
    throw new SetupError('Could not save backend/.env. Check local file permissions, then run setup again. A temporary .env.gmail-oauth-* file may remain; keep it private.');
  }
}

export async function authorizeGmail({ environment = process.env, timeoutMs = 10 * 60_000, desktop = false, port = 53682, envPath = ENV_PATH } = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new SetupError('The local callback port is invalid.');
  const callbackUrl = new URL(desktop ? DESKTOP_CALLBACK_URL : CALLBACK_URL);
  callbackUrl.port = String(port);
  let fileEnvironment = {};
  try { fileEnvironment = dotenv.parse(await readFile(envPath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new SetupError('Could not read backend/.env. Check local file permissions.'); }
  const config = { ...fileEnvironment, ...environment };
  if (!config.GMAIL_CLIENT_ID?.trim() || !config.GMAIL_CLIENT_SECRET?.trim() || !config.EMAIL_FROM?.trim()) {
    throw new SetupError('First set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and EMAIL_FROM in backend/.env. See docs/GMAIL_API_SETUP.md.');
  }

  const client = new OAuth2Client({
    clientId: config.GMAIL_CLIENT_ID.trim(),
    clientSecret: config.GMAIL_CLIENT_SECRET.trim(),
    redirectUri: callbackUrl.href,
    transporterOptions: { timeout: 30_000 },
  });
  const state = randomBytes(32).toString('hex');
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  const consentUrl = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [GMAIL_SEND_SCOPE],
    include_granted_scopes: false,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  await new Promise((resolve, reject) => {
    let consumed = false;
    let settled = false;
    let timer;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      process.removeListener('SIGINT', interrupted);
      server.close();
      if (error) reject(error);
      else resolve();
    };
    const interrupted = () => finish(new SetupError('Gmail authorization cancelled. Run setup again if needed.'));
    const server = createServer(async (request, response) => {
      let url;
      try { url = new URL(request.url, callbackUrl); }
      catch { return reply(response, 400, 'Invalid request.'); }
      if (request.method !== 'GET' || url.pathname !== callbackUrl.pathname) {
        reply(response, 404, 'Not found.');
        return;
      }
      if (!equalState(url.searchParams.get('state'), state)) {
        reply(response, 400, 'Invalid authorization state. Return to the original consent link.');
        return;
      }
      if (consumed || settled) {
        reply(response, 409, 'This authorization request has already been used.');
        return;
      }
      consumed = true;
      if (url.searchParams.has('error') || !url.searchParams.get('code')) {
        reply(response, 400, 'Gmail authorization was not granted. You can close this tab.');
        finish(new SetupError('Gmail authorization was not granted. No settings were changed.'));
        return;
      }
      try {
        const { tokens } = await client.getToken({
          code: url.searchParams.get('code'),
          codeVerifier,
        });
        if (settled) return reply(response, 408, 'This setup session has ended. Run setup again.');
        if (tokens.scope && !tokens.scope.split(/\s+/).includes(GMAIL_SEND_SCOPE)) {
          throw new SetupError('Gmail sending permission was not granted. Run setup again and grant the requested permission.');
        }
        if (!tokens.refresh_token) {
          throw new SetupError('Google did not return a refresh token. Revoke this mail client in your Google account permissions, then run setup again.');
        }
        clearTimeout(timer);
        await saveRefreshToken(tokens.refresh_token, envPath);
        reply(response, 200, 'Gmail authorization saved to backend/.env. You can close this tab and return to the terminal.');
        finish();
      } catch (error) {
        reply(response, 500, 'Gmail setup failed. Return to the terminal for next steps.');
        finish(error instanceof SetupError ? error : new SetupError('Could not exchange the Google authorization code. Check the OAuth client, redirect URI and internet connection, then run setup again.'));
      }
    });
    server.on('error', () => finish(new SetupError(`Could not start the local callback on 127.0.0.1:${port}. Close any app using that port and run setup again.`)));
    server.listen(port, '127.0.0.1', () => {
      console.log(`OAuth client ID: ${config.GMAIL_CLIENT_ID.trim()}`);
      console.log(`Callback URL: ${callbackUrl.href}`);
      console.log(desktop ? 'Desktop mode: use credentials from a Desktop app OAuth client.' : 'Web mode: register the callback URL in this Web application client.');
      console.log('This setup writes MAIL_TRANSPORT and GMAIL_REFRESH_TOKEN to the ignored backend/.env file after you grant consent.');
      console.log('Open this link on this computer. Sign in as the Gmail mailbox used in EMAIL_FROM and grant sending permission:');
      console.log(consentUrl);
      console.log('Waiting up to 10 minutes. Press Ctrl+C to cancel. Tokens will not be printed.');
    });
    process.once('SIGINT', interrupted);
    timer = setTimeout(() => finish(new SetupError('Gmail authorization timed out. Run setup again to obtain a new consent link.')), timeoutMs);
  });
  console.log('Saved MAIL_TRANSPORT and GMAIL_REFRESH_TOKEN in backend/.env. No token values were printed.');
  console.log('Copy MAIL_TRANSPORT, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN and EMAIL_FROM from that private file into Render Environment, then redeploy.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: node backend/scripts/gmail-oauth.mjs [--desktop]');
    console.log('Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and EMAIL_FROM in backend/.env first.');
    console.log(`Web application authorized redirect URI: ${CALLBACK_URL}`);
    console.log(`Desktop mode uses ${DESKTOP_CALLBACK_URL} with a Desktop app OAuth client; no web redirect registration is needed.`);
    console.log('After Google consent, saves MAIL_TRANSPORT=gmail-api and GMAIL_REFRESH_TOKEN to ignored backend/.env.');
    console.log('Run locally on the computer where you will open the consent link. See docs/GMAIL_API_SETUP.md.');
  } else if (process.argv.slice(2).some(argument => argument !== '--desktop')) {
    console.error('Unknown option. Use --help for setup instructions.');
    process.exitCode = 1;
  } else {
    authorizeGmail({ desktop: process.argv.includes('--desktop') }).catch((error) => {
      // OAuth library errors can contain credentials and token response data.
      console.error(error instanceof SetupError ? error.message : 'Gmail setup failed. Check docs/GMAIL_API_SETUP.md and run setup again.');
      process.exitCode = 1;
    });
  }
}
