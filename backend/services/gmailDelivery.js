import { OAuth2Client } from 'google-auth-library';
import nodemailer from 'nodemailer';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SEND_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const REQUEST_TIMEOUT_MS = 15_000;

const FAILURE_MESSAGES = Object.freeze({
  GMAIL_AUTH: 'Gmail authorization failed. Check the OAuth client and refresh token.',
  GMAIL_FORBIDDEN: 'Gmail denied email delivery. Check Gmail API access, the send scope, and the sender account.',
  GMAIL_RATE_LIMIT: 'Gmail temporarily limited email delivery. Try again later.',
  GMAIL_UNAVAILABLE: 'Gmail email delivery is unavailable. Check the configuration and try again later.',
  ETIMEDOUT: 'Gmail email delivery timed out. Try again later.',
});

function deliveryError(code, httpStatus) {
  const error = new Error(FAILURE_MESSAGES[code]);
  error.code = code;
  if (Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599) {
    error.httpStatus = httpStatus;
    error.responseCode = httpStatus;
  }
  return error;
}

// Never expose OAuth/Gmail response bodies, tokens, request options, or raw errors.
function sanitizeError(error, phase) {
  const httpStatus = error?.response?.status ?? error?.httpStatus ?? error?.status;
  if (error?.code === 'ETIMEDOUT' || error?.name === 'AbortError' || error?.name === 'TimeoutError'
    || error?.cause?.code === 'ETIMEDOUT') return deliveryError('ETIMEDOUT', httpStatus);
  if (httpStatus === 401 || (phase === 'auth' && httpStatus === 400)) return deliveryError('GMAIL_AUTH', httpStatus);
  if (httpStatus === 403) return deliveryError('GMAIL_FORBIDDEN', httpStatus);
  if (httpStatus === 429) return deliveryError('GMAIL_RATE_LIMIT', httpStatus);
  if (error?.code === 'GMAIL_AUTH') return deliveryError('GMAIL_AUTH', httpStatus);
  return deliveryError('GMAIL_UNAVAILABLE', httpStatus);
}

function configuration(env) {
  const read = name => typeof env[name] === 'string' ? env[name].trim() : '';
  return {
    clientId: read('GMAIL_CLIENT_ID'),
    clientSecret: read('GMAIL_CLIENT_SECRET'),
    refreshToken: read('GMAIL_REFRESH_TOKEN'),
    from: read('EMAIL_FROM'),
  };
}

function isComplete(config) {
  return Boolean(config.clientId && config.clientSecret && config.refreshToken && config.from);
}

async function withDeadline(operation, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(deliveryError('ETIMEDOUT'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

// A factory keeps HTTP mocking and credentials isolated in tests. The default
// instance below keeps the OAuth token cache private to this module.
export function createGmailDelivery({
  env = process.env,
  fetchImplementation = (...args) => globalThis.fetch(...args),
  timeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
  const requestTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : REQUEST_TIMEOUT_MS;
  let cachedOAuth;

  function oauthClient(config) {
    const credentials = JSON.stringify([config.clientId, config.clientSecret, config.refreshToken]);
    if (!cachedOAuth || cachedOAuth.credentials !== credentials) {
      const client = new OAuth2Client({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        endpoints: { oauth2TokenUrl: TOKEN_ENDPOINT },
        useAuthRequestParameters: false,
        transporterOptions: {
          fetchImplementation,
          timeout: requestTimeout,
          retry: false,
          retryConfig: { retry: 0 },
          redirect: 'error',
        },
      });
      // OAuth2Client sets its own retry defaults during refresh. Override them
      // after request preparation so the complete operation has a firm limit.
      client.transporter.interceptors.request.add({
        resolved: options => ({
          ...options, timeout: requestTimeout, retry: false, retryConfig: { retry: 0 }, redirect: 'error',
        }),
      });
      client.setCredentials({ refresh_token: config.refreshToken });
      cachedOAuth = { client, credentials, pendingToken: null };
    }
    return cachedOAuth;
  }

  return {
    isConfigured() {
      return isComplete(configuration(env));
    },

    async send({ to, subject, text, html }) {
      const config = configuration(env);
      if (!isComplete(config)) throw deliveryError('GMAIL_AUTH');

      let raw;
      try {
        const composer = nodemailer.createTransport({
          streamTransport: true,
          buffer: true,
          newline: 'windows',
          disableFileAccess: true,
          disableUrlAccess: true,
          logger: false,
          debug: false,
        });
        const result = await composer.sendMail({
          from: config.from, to, subject, text, html,
          disableFileAccess: true,
          disableUrlAccess: true,
        });
        if (!result.envelope?.to?.length || !Buffer.isBuffer(result.message)) throw deliveryError('GMAIL_UNAVAILABLE');
        raw = result.message.toString('base64url');
      } catch (error) {
        throw sanitizeError(error, 'compose');
      }

      let accessToken;
      let authenticatedClient;
      try {
        const state = oauthClient(config);
        authenticatedClient = state.client;
        // Share the complete refresh operation so concurrent sends cannot
        // replace its cancellation signal or start multiple refresh requests.
        const pending = state.pendingToken ??= withDeadline(signal => {
          state.client.transporter.defaults.signal = signal;
          return state.client.getAccessToken();
        }, requestTimeout);
        let result;
        try {
          result = await pending;
        } finally {
          if (state.pendingToken === pending) state.pendingToken = null;
        }
        if (typeof result?.token !== 'string' || !result.token.trim() || /[\r\n]/u.test(result.token)) {
          throw deliveryError('GMAIL_AUTH');
        }
        accessToken = result.token;
      } catch (error) {
        throw sanitizeError(error, 'auth');
      }

      try {
        await withDeadline(async signal => {
          // A failed/ambiguous send is never retried: Gmail may already have
          // accepted the email even when its response could not be received.
          const response = await fetchImplementation(SEND_ENDPOINT, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw }),
            signal,
            redirect: 'error',
          });
          if (!response.ok) throw deliveryError('GMAIL_UNAVAILABLE', response.status);
          const result = await response.json();
          if (typeof result?.id !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/u.test(result.id)) {
            throw deliveryError('GMAIL_UNAVAILABLE', response.status);
          }
        }, requestTimeout);
      } catch (error) {
        // Allow the next explicit send to refresh a rejected token, without
        // replaying this message or discarding a newer concurrent refresh.
        if (error?.httpStatus === 401 && authenticatedClient.credentials.access_token === accessToken) {
          authenticatedClient.setCredentials({ refresh_token: config.refreshToken });
        }
        throw sanitizeError(error, 'send');
      }
      return { accepted: true, deliveryMethod: 'gmail-api' };
    },
  };
}

export const gmailDelivery = createGmailDelivery();
