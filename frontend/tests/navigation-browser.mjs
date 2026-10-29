// Standalone browser smoke test; no npm packages or live backend are needed.
// Start Vite and a separate headless Chrome with --remote-debugging-port=9333
// and --user-data-dir pointing to an OS temporary directory,
// then run: node --experimental-websocket tests/navigation-browser.mjs
// Optional arguments: application origin, Chrome debugging origin, scenario name filter.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getOrganisationEmailSettings } from '../../shared/organisationEmails.js';

const appOrigin = process.argv[2] || 'http://127.0.0.1:5173';
const debugOrigin = process.argv[3] || 'http://127.0.0.1:9333';
const scenarioFilter = process.argv[4];
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const results = [];

function installMocks({ role, authenticated, organisation, membershipStatus = 'active', returnPaid = false, emailSettings, eventAnalyticsFixture = false, tierSettingsFixture = false, membershipPortalFixture = false, freeMembershipFixture = false, downgradeFixture = false, adminCancellationFixture = false, eventLifecycleFixture = false }) {
  const organisations = [
    { _id: 'A', name: 'Alpha Community', adminId: 'qa-account', description: 'Alpha navigation fixture', category: 'Technology & AI', location: 'Malaysia', isPublic: true, visibility: 'public', memberCount: 1, tags: [] },
    { _id: 'B', name: 'Beta Community', adminId: 'qa-account', description: 'Beta navigation fixture', category: 'Technology & AI', location: 'Malaysia', isPublic: true, visibility: 'public', memberCount: 1, tags: [] },
  ];
  organisations.forEach(item => { item.badgeColor = sessionStorage.getItem(`badge-accent-${item._id}`) || (item._id === 'A' ? '#FFD700' : '#2563EB'); });
  const makeUser = id => ({
    _id: 'qa-account', name: 'Navigation Tester', firstName: 'Navigation', email: 'qa@example.test',
    emailVerified: true, onboardingCompleted: true, organisationRole: role, activeOrganisationId: id,
    activeOrganisation: organisations.find(item => item._id === id),
    ownedOrganisations: role === 'owner' ? organisations : [],
    memberships: role === 'owner' ? [] : organisations.map(item => ({ organisationId: item._id, status: membershipStatus })),
    membershipStatus, status: 'active', tierId: `${id}-${downgradeFixture ? 'premium' : 'tier'}`, tierName: `${id} ${downgradeFixture ? 'Premium' : 'Community'}`, country: 'Malaysia',
  });
  const now = Math.floor(Date.now() / 1000);
  const token = `qa.${btoa(JSON.stringify({ iat: now, exp: now + 86400, rememberMe: false }))}.fixture`;
  if (!sessionStorage.getItem('navigation-qa-started')) {
    localStorage.clear();
    localStorage.setItem('navigation-qa-user', JSON.stringify(makeUser(organisation)));
    if (authenticated) localStorage.setItem('remember_token', token);
    sessionStorage.setItem('navigation-qa-started', 'yes');
  }
  const currentUser = () => JSON.parse(localStorage.getItem('navigation-qa-user'));
  window.__navigationQa = { requests: [], unexpectedMutations: [], deferredTierSaves: [], deferTierSaves: false, savedEmailSettings: [], savedTiers: [], savedAccents: [], deferredAccentSaves: [], deferAccentSaves: false };
  const realFetch = window.fetch.bind(window);
  const reply = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
  const tier = id => ({ _id: `${id}-tier`, organisationId: id, name: `${id} Community`, price: freeMembershipFixture ? 0 : 10, interval: 'monthly', description: 'Navigation fixture', perks: [] });
  const tiersFor = id => JSON.parse(sessionStorage.getItem(`tiers-${id}`) || 'null') || [tier(id), ...((tierSettingsFixture || membershipPortalFixture || downgradeFixture) ? [{ ...tier(id), _id: `${id}-premium`, name: `${id} Premium`, price: 25 }] : []), ...(downgradeFixture ? [
    { ...tier(id), _id: `${id}-annual`, name: `${id} Annual Supporter`, price: 120, interval: 'yearly' },
    { ...tier(id), _id: `${id}-equal-annual`, name: `${id} Equivalent Annual`, price: 300, interval: 'yearly' },
    { ...tier(id), _id: `${id}-higher-annual`, name: `${id} Higher Annual`, price: 360, interval: 'yearly' },
    { ...tier(id), _id: `${id}-free`, name: `${id} Free`, price: 0 },
    { ...tier(id), _id: `${id}-inactive`, name: `${id} Inactive`, price: 5, isActive: false },
  ] : [])];
  const membershipFor = id => {
    const saved = JSON.parse(sessionStorage.getItem(`membership-${id}`) || '{}');
    const user = currentUser();
    const currentTierId = saved.tierId || (user.activeOrganisationId === id ? user.tierId : `${id}-${downgradeFixture ? 'premium' : 'tier'}`);
    const selectedTier = tiersFor(id).find(item => item._id === currentTierId) || tier(id);
    const periodStart = new Date(Date.now() - 15 * 86400000).toISOString();
    const periodEnd = new Date(Date.now() + 15 * 86400000).toISOString();
    return {
      _id: `${id}-membership`, organisationId: id, organisation: organisations.find(item => item._id === id),
      membershipNumber: `MEM-${id}`, status: user.activeOrganisationId === id ? user.membershipStatus : membershipStatus, tierId: selectedTier._id, tierName: selectedTier.name,
      tier: selectedTier, firstSubscribedAt: id === 'A' ? '2026-03-01T00:00:00.000Z' : '2026-05-15T00:00:00.000Z',
      joinedDate: id === 'A' ? '2026-03-01T00:00:00.000Z' : '2026-05-15T00:00:00.000Z',
      currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, periodStart,
      expirationDate: freeMembershipFixture ? null : periodEnd, cancelAtPeriodEnd: false, cancelledAt: null,
      ...saved,
      scheduledTier: saved.scheduledTierId ? tiersFor(id).find(item => item._id === saved.scheduledTierId) || null : null,
      scheduledTierUnavailable: !!saved.scheduledTierId && !tiersFor(id).some(item => item._id === saved.scheduledTierId && item.isActive !== false),
    };
  };
  const paymentQuote = (id, tierId, intent = 'join') => {
    const selectedTier = tiersFor(id).find(item => item._id === tierId) || tier(id);
    const membership = membershipFor(id);
    const subtotalCents = Math.round(selectedTier.price * 100);
    const creditCents = intent === 'upgrade' ? 500 : 0;
    const periodEnd = new Date();
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
    return {
      intent, tierId: selectedTier._id, tierName: selectedTier.name, amountCents: subtotalCents - creditCents,
      subtotalCents, creditCents, unusedCreditCents: creditCents, creditBalanceCents: 0, carryForwardCents: 0,
      currency: 'MYR', billingInterval: selectedTier.interval, interval: selectedTier.interval,
      periodStart: new Date().toISOString(), periodEnd: periodEnd.toISOString(), remainingDays: 15, totalDays: 30,
      sourceTierId: membership.tierId, sourceTierName: membership.tierName,
      previousPeriodStart: membership.currentPeriodStart, previousPeriodEnd: membership.currentPeriodEnd,
    };
  };
  const member = id => ({ _id: `${id}-member`, name: `${id} Directory Member`, email: `${id}@example.test`, membershipNumber: `MEM-${id}`, tierId: `${id}-tier`, tierName: `${id} Community`, status: 'active' });
  const eventFixtures = id => {
    const today = new Date();
    const dateOffset = offset => new Date(today.getTime() + offset * 86400000).toISOString().slice(0, 10);
    const priorMonth = day => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, day, 12)).toISOString();
    const currentRegistration = new Date(today.getTime() - 60000).toISOString();
    const guest = (index, rsvpDate) => ({ userId: `${id}-guest-${index}`, userName: `${id} Event Guest ${index}`, userEmail: `${id.toLowerCase()}-guest-${index}@example.test`, rsvpDate });
    const makeEvent = (key, title, startDate, endDate, rsvps) => ({
      _id: `${id}-${key}`, organisationId: id, title: `${id} ${title}`, description: 'Event analytics fixture',
      date: startDate, startDate, endDate, timeZone: 'Asia/Kuala_Lumpur',
      schedule: Array.from({ length: Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1 }, (_, index) => ({ date: new Date(Date.parse(startDate) + index * 86400000).toISOString().slice(0, 10), startTime: '10:00', endTime: '17:00' })),
      location: 'Community Hall', capacity: 20, tierAccess: 'all', allowedTiers: [], rsvps,
    });
    return [
      makeEvent('future-event', 'Future Gathering', dateOffset(7), dateOffset(7), [guest(1, priorMonth(2)), guest(2, priorMonth(10))]),
      makeEvent('ongoing-event', 'Ongoing Weekend', dateOffset(-1), dateOffset(1), [guest(3, currentRegistration)]),
      makeEvent('past-event', 'Past Gathering', dateOffset(-7), dateOffset(-7), [guest(4, currentRegistration)]),
      makeEvent('empty-event', 'Open Workshop', dateOffset(14), dateOffset(14), []),
    ];
  };
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
    const method = (options.method || 'GET').toUpperCase();
    if (!url.pathname.startsWith('/api/')) {
      if (method !== 'GET') {
        window.__navigationQa.unexpectedMutations.push({ method, path: url.pathname });
        return reply({ success: false, message: 'Navigation smoke blocks unmocked mutations.' }, 409);
      }
      return realFetch(input, options);
    }
    const path = url.pathname.slice(4);
    const user = currentUser();
    const id = user.activeOrganisationId;
    window.__navigationQa.requests.push({ path, method, organisation: id, url: location.pathname + location.search, requestUrl: url.pathname + url.search, ...(options.body ? { payload: JSON.parse(options.body) } : {}) });
    if (path === '/auth/google/config') return reply({ enabled: false });
    if (path === '/auth/me') return reply({ success: true, user });
    if (/^\/organisations\/[^/]+\/email-settings$/.test(path)) {
      const selectedId = path.split('/')[2];
      if (method === 'PUT') {
        const saved = JSON.parse(options.body);
        window.__navigationQa.savedEmailSettings.push({ organisationId: selectedId, settings: saved });
        sessionStorage.setItem(`email-settings-${selectedId}`, JSON.stringify(saved));
        return reply({ success: true, emailSettings: saved });
      }
      if (method === 'GET') return reply({ success: true, emailSettings: JSON.parse(sessionStorage.getItem(`email-settings-${selectedId}`) || 'null') || emailSettings });
    }
    if (/^\/organisations\/[^/]+$/.test(path)) {
      const selectedId = path.split('/')[2];
      const selectedOrganisation = organisations.find(item => item._id === selectedId);
      if (method === 'GET') return reply({ success: true, organisation: selectedOrganisation });
      if (method === 'PUT' && tierSettingsFixture) {
        const saved = JSON.parse(options.body);
        if (Object.keys(saved).length !== 1 || !/^#[0-9A-F]{6}$/i.test(saved.badgeColor || '')) return reply({ success: false, message: 'Invalid badge accent fixture payload.' }, 400);
        if (window.__navigationQa.rejectAccentSaves) return reply({ success: false, message: 'Badge accent save failed in fixture.' }, 503);
        const complete = () => {
          selectedOrganisation.badgeColor = saved.badgeColor;
          sessionStorage.setItem(`badge-accent-${selectedId}`, saved.badgeColor);
          window.__navigationQa.savedAccents.push({ organisationId: selectedId, ...saved });
          return reply({ success: true, organisation: selectedOrganisation });
        };
        if (window.__navigationQa.deferAccentSaves) return new Promise(resolve => { window.__navigationQa.deferredAccentSaves.push(() => resolve(complete())); });
        return complete();
      }
    }
    if (tierSettingsFixture && ((method === 'POST' && path === '/tiers') || (method === 'PUT' && /^\/tiers\/[^/]+$/.test(path)))) {
      const saved = JSON.parse(options.body);
      if ('accessLevel' in saved || 'badgeColor' in saved) return reply({ success: false, message: 'Tiers cannot contain access levels or individual badge colours.' }, 400);
      const currentTiers = tiersFor(id);
      const tierId = method === 'POST' ? `${id}-new-tier` : path.split('/')[2];
      const item = { ...saved, _id: tierId, organisationId: id };
      const index = currentTiers.findIndex(entry => entry._id === tierId);
      if (index === -1) currentTiers.push(item);
      else currentTiers[index] = item;
      sessionStorage.setItem(`tiers-${id}`, JSON.stringify(currentTiers));
      window.__navigationQa.savedTiers.push({ method, organisationId: id, tier: saved });
      return reply({ success: true, tier: item });
    }
    if (path === '/members/membership' && method === 'GET') {
      const saved = membershipFor(id);
      if (saved.scheduledTierId && saved.scheduledTier?.price === 0 && Date.parse(saved.scheduledTierEffectiveAt) <= Date.now()) {
        const nextTier = saved.scheduledTier;
        Object.assign(saved, { tierId: nextTier._id, tierName: nextTier.name, tier: nextTier, status: 'active', expirationDate: null, currentPeriodEnd: null, scheduledTierId: null, scheduledTier: null, scheduledTierEffectiveAt: null, scheduledTierRequestedAt: null });
        sessionStorage.setItem(`membership-${id}`, JSON.stringify(saved));
        localStorage.setItem('navigation-qa-user', JSON.stringify({ ...user, tierId: nextTier._id, tierName: nextTier.name, membershipStatus: 'active' }));
      }
      return reply({ success: true, membership: saved });
    }
    if (method === 'POST' && ['/members/membership/downgrade', '/members/membership/downgrade/cancel'].includes(path)) {
      const saved = membershipFor(id);
      const details = JSON.parse(options.body);
      const cancel = path.endsWith('/cancel');
      Object.assign(saved, { scheduledTierId: cancel ? null : details.tierId, scheduledTierEffectiveAt: cancel ? null : saved.expirationDate, scheduledTierRequestedAt: cancel ? null : new Date().toISOString() });
      sessionStorage.setItem(`membership-${id}`, JSON.stringify(saved));
      return reply({ success: true, membership: membershipFor(id) });
    }
    if (method === 'POST' && ['/members/membership/cancel', '/members/membership/resume'].includes(path)) {
      const saved = membershipFor(id);
      const cancel = path.endsWith('/cancel');
      saved.cancelAtPeriodEnd = cancel && !freeMembershipFixture;
      saved.cancelledAt = cancel ? new Date().toISOString() : null;
      if (cancel) Object.assign(saved, { scheduledTierId: null, scheduledTier: null, scheduledTierEffectiveAt: null, scheduledTierRequestedAt: null });
      if (freeMembershipFixture && cancel) {
        saved.status = 'cancelled';
        localStorage.setItem('navigation-qa-user', JSON.stringify({ ...user, membershipStatus: 'cancelled' }));
      }
      sessionStorage.setItem(`membership-${id}`, JSON.stringify(saved));
      return reply({ success: true, membership: saved, message: saved.cancelAtPeriodEnd ? 'Your membership will end at the current period end.' : 'Your membership will continue.' });
    }
    if (method === 'POST' && path === '/payments/quote') {
      const details = JSON.parse(options.body);
      return reply({ success: true, quote: paymentQuote(id, details.tierId, details.intent) });
    }
    if (method === 'POST' && path === '/payments/checkout') {
      const count = Number(sessionStorage.getItem('payment-count') || '0') + 1;
      sessionStorage.setItem('payment-count', String(count));
      const details = JSON.parse(options.body);
      const checkout = { ...paymentQuote(id, details.tierId, details.intent), id: `demo-${count}`, reference: `PAY-DEMO-${count}`, state: 'pending' };
      sessionStorage.setItem(checkout.id, JSON.stringify(checkout));
      return reply({ success: true, paymentStatus: 'pending', checkout });
    }
    if (path.startsWith('/payments/checkout/')) {
      const checkoutId = path.split('/')[3];
      const checkout = JSON.parse(sessionStorage.getItem(checkoutId) || 'null') || { id: checkoutId, tierId: `${id}-tier`, tierName: 'Community', amountCents: 1000, currency: 'MYR', interval: 'monthly', state: returnPaid ? 'paid' : 'pending' };
      if (method === 'POST' && path.endsWith('/confirm')) {
        const details = JSON.parse(options.body);
        checkout.state = details.scenario === 'declined' ? 'failed' : 'paid';
        checkout.paymentMethod = details.paymentMethod;
      }
      if (method === 'POST' && path.endsWith('/cancel')) checkout.state = 'cancelled';
      if (checkout.state === 'paid') {
        localStorage.setItem('navigation-qa-user', JSON.stringify({ ...user, membershipStatus: 'active', tierId: checkout.tierId, tierName: checkout.tierName }));
        if (['upgrade', 'renew'].includes(checkout.intent)) sessionStorage.setItem(`membership-${id}`, JSON.stringify({
          ...membershipFor(id), tierId: checkout.tierId, tierName: checkout.tierName,
          tier: tiersFor(id).find(item => item._id === checkout.tierId),
          currentPeriodStart: checkout.periodStart, currentPeriodEnd: checkout.periodEnd,
          periodStart: checkout.periodStart, expirationDate: checkout.periodEnd,
          status: 'active', cancelAtPeriodEnd: false, cancelledAt: null,
          scheduledTierId: null, scheduledTier: null, scheduledTierEffectiveAt: null, scheduledTierRequestedAt: null,
        }));
      }
      sessionStorage.setItem(checkoutId, JSON.stringify(checkout));
      return reply({ success: true, paymentStatus: checkout.state, checkout, ...(checkout.state === 'paid' ? { invoice: { invoiceNumber: 'DEMO-RECEIPT-001', periodEnd: '2026-11-27T00:00:00Z' } } : {}) });
    }
    if (path === '/auth/login') {
      localStorage.setItem('remember_token', token);
      return reply({ success: true, token, user });
    }
    if (path === '/organisations/select') {
      const selected = JSON.parse(options.body).organisationId;
      await new Promise(resolve => setTimeout(resolve, 200));
      const selectedUser = makeUser(selected);
      localStorage.setItem('navigation-qa-user', JSON.stringify(selectedUser));
      return reply({ success: true, user: selectedUser });
    }
    if (method === 'PUT' && /^\/admin\/members\/[^/]+\/tier$/.test(path) && window.__navigationQa.deferTierSaves) {
      return new Promise(resolve => {
        window.__navigationQa.deferredTierSaves.push(() => resolve(reply({ success: true, member: member(id) })));
      });
    }
    if (method !== 'GET') {
      window.__navigationQa.unexpectedMutations.push({ method, path });
      return reply({ success: false, message: 'Navigation smoke blocks data mutations.' }, 409);
    }
    if (path === '/organisations') return reply({ success: true, organisations });
    if (path === '/organisations/categories') return reply({ success: true, categories: ['Technology & AI'] });
    if (path === '/tiers') return reply({ success: true, tiers: tiersFor(id) });
    if (path === '/admin/members') {
      const cancelledRows = [
        { ...member(id), _id: `${id}-paid-cancelled`, name: `${id} Paid Cancellation`, status: 'cancelled', accessStatus: 'active', cancellationScheduled: true, cancelAtPeriodEnd: true, cancelledAt: '2026-10-20T00:00:00Z', expirationDate: '2099-01-01T00:00:00Z' },
        { ...member(id), _id: `${id}-free-cancelled`, name: `${id} Free Cancellation`, status: 'cancelled', accessStatus: 'cancelled', cancellationScheduled: false, cancelledAt: '2026-10-20T00:00:00Z' },
        { ...member(id), _id: `${id}-ended-cancelled`, name: `${id} Ended Cancellation`, status: 'cancelled', accessStatus: 'cancelled', cancellationScheduled: false, cancelAtPeriodEnd: true, expirationDate: '2020-01-01T00:00:00Z' },
        member(id),
      ];
      let rows = adminCancellationFixture ? JSON.parse(sessionStorage.getItem(`admin-cancellations-${id}`) || 'null') || cancelledRows : [member(id)];
      const status = url.searchParams.get('status');
      if (adminCancellationFixture && status && status !== 'all') rows = rows.filter(item => item.status === status);
      return reply({ success: true, members: rows, pagination: { page: 1, limit: 8, totalMembers: rows.length, totalPages: 1, hasPrevPage: false, hasNextPage: false } });
    }
    if (path.startsWith('/admin/members/')) return reply({ success: true, member: member(id) });
    if (path === '/admin/financial-summary') return reply({ success: true, metrics: {} });
    if (path === '/members/dashboard') return reply({ success: true, membership: { ...user, status: user.membershipStatus, tier: tier(id) }, upcomingRsvps: [], recentInvoices: [] });
    if (path === '/members/wallet-pass') return reply({ success: true, saveUrl: 'https://pay.google.com/gp/v/save/mock-qa-pass' });
    if (path === '/admin/dashboard-analytics') {
      const startMonth = url.searchParams.get('startMonth') || '2026-08';
      const endMonth = url.searchParams.get('endMonth') || '2026-09';
      const month = new Date(`${startMonth}-01T00:00:00Z`);
      const paymentTrend = [];
      while (month.toISOString().slice(0, 7) <= endMonth && paymentTrend.length < 120) {
        const index = paymentTrend.length;
        paymentTrend.push({ month: month.toISOString().slice(0, 7), revenue: (index + 1) * (id === 'A' ? 50 : 500), paidPayments: index + 2, failedPayments: index });
        month.setUTCMonth(month.getUTCMonth() + 1);
      }
      return reply({
        success: true,
        summary: { revenue: paymentTrend.reduce((sum, point) => sum + point.revenue, 0), paidPayments: paymentTrend.reduce((sum, point) => sum + point.paidPayments, 0), newMembers: paymentTrend.length },
        demographics: { countries: [{ name: 'Malaysia', value: 3 }], tiers: [{ name: 'Community', value: 3 }], statuses: [{ name: 'active', value: 3 }] },
        membershipTrend: paymentTrend.map((point, index) => ({ month: point.month, newMembers: 1, totalMembers: index + 1 })),
        paymentTrend,
      });
    }
    if (path === '/members/invoices') return reply({ success: true, invoices: [{ _id: 'receipt-1', invoiceNumber: 'QA-RECEIPT-001', userName: user.name, userEmail: user.email, tierName: 'Community', paymentStatus: 'paid', paymentMethod: 'Fixture', amount: 10, createdAt: '2026-10-01T00:00:00Z', paidAt: '2026-10-01T00:00:00Z' }] });
    if (path === '/events') {
      const events = eventAnalyticsFixture || eventLifecycleFixture ? eventFixtures(id) : [];
      if (eventLifecycleFixture) {
        const start = Math.ceil(Date.now() / 60000) * 60000 + 120000;
        const end = start + 60000;
        const date = new Date(start).toISOString().slice(0, 10);
        window.__navigationQa.eventBoundary = { start, end };
        events.push({ _id: `${id}-boundary`, organisationId: id, title: `${id} Boundary Briefing`, description: 'Clock boundary fixture',
          date, startDate: date, endDate: date, timeZone: 'UTC', schedule: [{ date, startTime: new Date(start).toISOString().slice(11, 16), endTime: new Date(end).toISOString().slice(11, 16) }], capacity: 20, rsvps: [], tierAccess: 'all', location: 'Community Hall' });
      }
      return reply({ success: true, events: events.map(event => ({ ...event, rsvpCount: event.rsvps.length, spotsLeft: event.capacity - event.rsvps.length,
        isAllowedTier: true, isRsvped: false, ...(role === 'member' ? { rsvps: [] } : {}) })) });
    }
    return reply({ success: false, message: `Unmocked navigation fixture: ${path}` }, 404);
  };
}

async function connect(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  const exceptions = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (!message.id) return;
    const promise = pending.get(message.id);
    if (!promise) return;
    pending.delete(message.id);
    clearTimeout(promise.timeout);
    if (message.error) promise.reject(new Error(message.error.message));
    else promise.resolve(message.result);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression, label) => {
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline) {
      if (await evaluate(`Boolean(${expression})`)) return;
      await pause(80);
    }
    const state = await evaluate('({ url: location.href, text: document.body.innerText.slice(0, 2400), requests: window.__navigationQa?.requests })');
    throw new Error(`Timed out: ${label}\n${JSON.stringify(state, null, 2)}\n${exceptions.join('\n')}`);
  };
  const clickText = async text => {
    await waitFor(`Boolean([...document.querySelectorAll('a,button')].find(item => item.textContent.trim() === ${JSON.stringify(text)} && !item.disabled))`, `enabled link/button: ${text}`);
    await evaluate(`(() => { const element = [...document.querySelectorAll('a,button')].find(item => item.textContent.trim() === ${JSON.stringify(text)}); if (!element) throw new Error('Missing link/button: ' + ${JSON.stringify(text)}); element.click(); })()`);
  };
  const fill = async (selector, value) => {
    await evaluate(`(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      if (!input) throw new Error('Missing form field: ' + ${JSON.stringify(selector)});
      const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
  };
  const selectText = async (selector, start, end = start) => {
    await evaluate(`(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      if (!input) throw new Error('Missing form field: ' + ${JSON.stringify(selector)});
      input.focus();
      input.setSelectionRange(${start}, ${end});
      input.dispatchEvent(new Event('select', { bubbles: true }));
    })()`);
  };
  const choose = async (selector, value) => {
    await evaluate(`(() => {
      const select = document.querySelector(${JSON.stringify(selector)});
      if (!select) throw new Error('Missing select field: ' + ${JSON.stringify(selector)});
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, ${JSON.stringify(value)});
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
  };
  const clickSelector = async selector => {
    const point = await evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) throw new Error('Missing click target: ' + ${JSON.stringify(selector)});
      element.scrollIntoView({ block: 'center' });
      const rect = element.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    })()`);
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
  };
  const bodyHas = text => `Boolean(document.body?.textContent.includes(${JSON.stringify(text)}))`;
  const screenshot = async (name, fullPage = true) => {
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const screenshotPath = join(tmpdir(), `remember-${name}.png`);
    const result = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: fullPage });
    await writeFile(screenshotPath, Buffer.from(result.data, 'base64'));
    console.log(`SCREENSHOT ${screenshotPath}`);
  };
  return { call, evaluate, waitFor, clickText, fill, selectText, choose, clickSelector, bodyHas, exceptions, socket, screenshot };
}

async function scenario(name, config, path, run) {
  if (scenarioFilter && !name.includes(scenarioFilter)) return;
  const target = await (await fetch(`${debugOrigin}/json/new?about:blank`, { method: 'PUT' })).json();
  const browser = await connect(target);
  try {
    await browser.call('Runtime.enable');
    await browser.call('Page.enable');
    await browser.call('Page.addScriptToEvaluateOnNewDocument', { source: `(${installMocks})(${JSON.stringify({ emailSettings: getOrganisationEmailSettings(), ...config })})` });
    await browser.call('Page.navigate', { url: appOrigin + path });
    await run(browser);
    assert.deepEqual(await browser.evaluate('window.__navigationQa.unexpectedMutations'), [], 'navigation must not mutate fixture data');
    assert.deepEqual(browser.exceptions, [], 'uncaught browser errors');
    results.push({ name, status: 'passed' });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: 'failed', message: error.message });
    console.error(`FAIL ${name}\n${error.message}`);
  } finally {
    browser.socket.close();
    await fetch(`${debugOrigin}/json/close/${target.id}`);
  }
}

await scenario('public sign-in and registration Back/Forward', { role: 'member', authenticated: false, organisation: 'A' }, '/login', async browser => {
  await browser.waitFor(browser.bodyHas('Sign In to Your Portal'), 'sign-in page');
  await browser.clickText('Register Here');
  await browser.waitFor(`location.pathname === '/register' && ${browser.bodyHas('Create your ReMember account')}`, 'registration URL');
  await browser.evaluate('history.back()');
  await browser.waitFor(`location.pathname === '/login' && ${browser.bodyHas('Sign In to Your Portal')}`, 'Back to sign-in');
  await browser.evaluate('history.forward()');
  await browser.waitFor(`location.pathname === '/register' && ${browser.bodyHas('Create your ReMember account')}`, 'Forward to registration');
});

await scenario('create tier Back/Forward and refresh', { role: 'owner', authenticated: true, organisation: 'A' }, '/admin/tiers?organisation=A', async browser => {
  await browser.waitFor(browser.bodyHas('Add Membership Tier'), 'tier list');
  await browser.clickText('Add Membership Tier');
  await browser.waitFor(`new URLSearchParams(location.search).get('tier') === 'new' && ${browser.bodyHas('Create Custom Membership Tier')}`, 'tier editor URL');
  await browser.evaluate('history.back()');
  await browser.waitFor(`!new URLSearchParams(location.search).has('tier') && !${browser.bodyHas('Create Custom Membership Tier')}`, 'Back closes tier editor');
  await browser.evaluate('history.forward()');
  await browser.waitFor(browser.bodyHas('Create Custom Membership Tier'), 'Forward reopens tier editor');
  await browser.call('Page.reload');
  await browser.waitFor(browser.bodyHas('Create Custom Membership Tier'), 'refresh keeps tier editor');
});

await scenario('direct invoice receipt and refresh', { role: 'member', authenticated: true, organisation: 'A' }, '/member/invoices?organisation=A&invoice=receipt-1', async browser => {
  await browser.waitFor(browser.bodyHas('Invoice Document'), 'direct invoice receipt');
  assert.equal(await browser.evaluate(browser.bodyHas('QA-RECEIPT-001')), true);
  await browser.call('Page.reload');
  await browser.waitFor(browser.bodyHas('Invoice Document'), 'receipt survives refresh');
});

await scenario('direct member tier editor', { role: 'owner', authenticated: true, organisation: 'A' }, '/admin/members?organisation=A&memberTier=A-member', async browser => {
  await browser.waitFor(`${browser.bodyHas('Adjust Membership Tier')} && ${browser.bodyHas('A Directory Member')}`, 'direct member tier editor with loaded member');
  assert.equal(await browser.evaluate(browser.bodyHas('A Directory Member')), true);
});

await scenario('sign in returns to protected deep destination', { role: 'owner', authenticated: false, organisation: 'A' }, '/admin/tiers?organisation=A&tier=new', async browser => {
  await browser.waitFor(`location.pathname === '/login' && new URLSearchParams(location.search).has('next')`, 'sign-in redirect with return URL');
  await browser.fill('input[type=email]', 'qa@example.test');
  await browser.fill('input[type=password]', 'Navigation1!');
  await browser.clickText('Sign In Securely');
  await browser.waitFor(`location.pathname === '/admin/tiers' && new URLSearchParams(location.search).get('tier') === 'new' && ${browser.bodyHas('Create Custom Membership Tier')}`, 'deep destination restored after sign-in');
});

await scenario('Back across organisations restores context before mounting portal data', { role: 'owner', authenticated: true, organisation: 'A' }, '/admin/members?organisation=A', async browser => {
  await browser.waitFor(browser.bodyHas('A Directory Member'), 'Alpha member directory');
  await browser.clickText('My Organisations');
  await browser.waitFor(`location.pathname === '/account/organisations' && !!document.querySelector('[aria-label="Open admin portal for Beta Community"]')`, 'owned organisation directory');
  await browser.evaluate(`document.querySelector('[aria-label="Open admin portal for Beta Community"]').click()`);
  await browser.waitFor(`location.pathname === '/admin/dashboard' && ${browser.bodyHas('Beta Community Dashboard')}`, 'Beta portal');
  await browser.clickText('Member Directory');
  await browser.waitFor(browser.bodyHas('B Directory Member'), 'Beta member directory');
  await browser.evaluate('history.back()');
  await browser.waitFor(`location.pathname === '/admin/dashboard'`, 'Back to Beta dashboard');
  await browser.evaluate('history.back()');
  await browser.waitFor(`location.pathname === '/account/organisations'`, 'Back to organisation list');
  await browser.evaluate('window.__navigationQa.requests = []; history.back()');
  await browser.waitFor(`location.pathname === '/admin/members' && new URLSearchParams(location.search).get('organisation') === 'A' && ${browser.bodyHas('A Directory Member')}`, 'Back restores Alpha directory');
  const requests = await browser.evaluate('window.__navigationQa.requests');
  const selection = requests.findIndex(request => request.path === '/organisations/select');
  const directory = requests.findIndex(request => request.path === '/admin/members');
  assert.ok(selection >= 0 && directory > selection, 'organisation selection must happen before the restored directory loads');
  assert.ok(requests.filter(request => request.path === '/admin/members').every(request => request.organisation === 'A'), 'restored Alpha directory must never fetch Beta members');
  assert.equal(await browser.evaluate(browser.bodyHas('B Directory Member')), false);
});

await scenario('legacy password reset URL migrates with a valid reset form', { role: 'member', authenticated: false, organisation: 'A' }, '/#reset-password?token=fixture%2Btoken', async browser => {
  await browser.waitFor(`location.pathname === '/reset-password' && location.hash === '' && !!document.querySelector('#new-password')`, 'legacy reset URL migration');
  assert.equal(await browser.evaluate(`new URLSearchParams(location.search).get('token')`), 'fixture+token');
  assert.equal(await browser.evaluate(`!!document.querySelector('#confirm-password')`), true);
  assert.equal(await browser.evaluate(browser.bodyHas('This link is incomplete')), false);
});

await scenario('organisation setup Back/Forward retains entered form values', { role: 'owner', authenticated: true, organisation: 'A' }, '/account/organisations/new', async browser => {
  await browser.waitFor(browser.bodyHas('Start with your membership tiers'), 'setup tier step');
  await browser.fill('input[id^="tier-name-"]', 'Draft Community');
  await browser.fill('input[id^="tier-price-"]', '15');
  await browser.clickText('Continue');
  await browser.waitFor(`new URLSearchParams(location.search).get('step') === '2' && !!document.querySelector('#organisation-name')`, 'setup details step URL');
  await browser.fill('#organisation-name', 'Draft Organisation');
  await browser.fill('#organisation-description', 'Preserved draft description');
  await browser.evaluate('history.back()');
  await browser.waitFor(`!new URLSearchParams(location.search).has('step') && !!document.querySelector('input[id^="tier-name-"]')`, 'Back to tier step');
  assert.equal(await browser.evaluate(`document.querySelector('input[id^="tier-name-"]').value`), 'Draft Community');
  assert.equal(await browser.evaluate(`document.querySelector('input[id^="tier-price-"]').value`), '15');
  await browser.evaluate('history.forward()');
  await browser.waitFor(`!!document.querySelector('#organisation-name')`, 'Forward to details step');
  assert.equal(await browser.evaluate(`document.querySelector('#organisation-name').value`), 'Draft Organisation');
  assert.equal(await browser.evaluate(`document.querySelector('#organisation-description').value`), 'Preserved draft description');
  assert.equal(await browser.evaluate(`location.search.includes('Draft')`), false, 'form contents stay out of the URL');
});

await scenario('membership overview follows browser Back/Forward without opening checkout', { role: 'member', authenticated: true, organisation: 'A' }, '/member/invoices?organisation=A', async browser => {
  await browser.waitFor(browser.bodyHas('Payment Invoices & Receipts'), 'member invoice page');
  await browser.clickText('Manage Membership');
  await browser.waitFor(`location.pathname === '/member/membership' && ${browser.bodyHas('Membership overview')}`, 'membership overview URL');
  assert.equal(await browser.evaluate(`window.__navigationQa.requests.some(request => request.path.startsWith('/payments/'))`), false);
  await browser.evaluate('history.back()');
  await browser.waitFor(`location.pathname === '/member/invoices' && !${browser.bodyHas('Membership overview')}`, 'Back returns to invoices');
  await browser.evaluate('history.forward()');
  await browser.waitFor(browser.bodyHas('Membership overview'), 'Forward reopens membership overview');
});

await scenario('unknown address offers a working home link', { role: 'member', authenticated: false, organisation: 'A' }, '/missing-navigation-page', async browser => {
  await browser.waitFor(browser.bodyHas('Page not found'), 'unknown page fallback');
  await browser.clickText('Go to home');
  await browser.waitFor(`location.pathname === '/'`, 'home link');
});

await scenario('removed tier direct URL can return to the tier list', { role: 'owner', authenticated: true, organisation: 'A' }, '/admin/tiers?organisation=A&tier=removed-tier', async browser => {
  await browser.waitFor(browser.bodyHas('This membership tier could not be found'), 'missing tier message');
  await browser.clickText('Return to tiers');
  await browser.waitFor(`location.pathname === '/admin/tiers' && !new URLSearchParams(location.search).has('tier')`, 'return from missing tier');
  assert.equal(await browser.evaluate(`new URLSearchParams(location.search).get('organisation')`), 'A');
});

await scenario('late tier save cannot close a reopened member editor', { role: 'owner', authenticated: true, organisation: 'A' }, '/admin/members?organisation=A', async browser => {
  await browser.waitFor(browser.bodyHas('A Directory Member'), 'member directory for delayed save');
  await browser.evaluate('window.__navigationQa.deferTierSaves = true');
  await browser.clickText('Change');
  await browser.waitFor(browser.bodyHas('Adjust Membership Tier'), 'initial member tier editor');
  await browser.clickText('Update & Sync Pass');
  await browser.waitFor('window.__navigationQa.deferredTierSaves.length === 1', 'mock tier save awaiting release');
  await browser.evaluate('history.back()');
  await browser.waitFor(`!new URLSearchParams(location.search).has('memberTier') && !${browser.bodyHas('Adjust Membership Tier')}`, 'Back closes editor during pending save');
  await browser.clickText('Change');
  await browser.waitFor(`new URLSearchParams(location.search).get('memberTier') === 'A-member' && ${browser.bodyHas('Adjust Membership Tier')}`, 'same member editor reopens before save completes');
  await browser.evaluate('window.__navigationQa.deferredTierSaves.shift()()');
  await browser.waitFor(browser.bodyHas('Tier updated to'), 'delayed save completion');
  await browser.waitFor(browser.bodyHas('Update & Sync Pass'), 'delayed save releases submit state');
  assert.equal(await browser.evaluate(`new URLSearchParams(location.search).get('memberTier')`), 'A-member', 'an old response must not change the current editor URL');
  assert.equal(await browser.evaluate(browser.bodyHas('Adjust Membership Tier')), true, 'the reopened editor stays visible after the old response');
});

await scenario('unpaid deep dashboard links show checkout without fetching or mounting member data', { role: 'member', authenticated: true, organisation: 'A', membershipStatus: 'pending' }, '/member/dashboard?organisation=A', async browser => {
  await browser.waitFor(`location.pathname === '/member/checkout' && ${browser.bodyHas('Activate your membership')}`, 'unpaid member checkout gate');
  assert.equal(await browser.evaluate(`!!document.querySelector('nav[aria-label="Member portal navigation"]')`), false);
  assert.equal(await browser.evaluate(`window.__navigationQa.requests.some(request => request.path === '/members/dashboard')`), false);
  assert.equal(await browser.evaluate(`!!document.querySelector('input[placeholder="4242 4242 4242 4242"]')`), false);
  await browser.clickText('Back to My Memberships');
  await browser.waitFor(`location.pathname === '/account/memberships' && ${browser.bodyHas('Complete Payment')}`, 'pending membership action');
  await browser.clickText('Complete Payment');
  await browser.waitFor(`location.pathname === '/member/checkout' && ${browser.bodyHas('Continue to payment')}`, 'resume pending checkout');
  await browser.call('Page.reload');
  await browser.waitFor(browser.bodyHas('Activate your membership'), 'pending checkout survives reload');
});

await scenario('canceling demo checkout leaves the member locked', { role: 'member', authenticated: true, organisation: 'A', membershipStatus: 'pending' }, '/member/checkout?organisation=A', async browser => {
  await browser.waitFor(browser.bodyHas('Continue to payment'), 'checkout details');
  await browser.clickText('Continue to payment');
  await browser.waitFor(browser.bodyHas('Card authorization'), 'demo authorization');
  await browser.clickText('Cancel checkout');
  await browser.waitFor(browser.bodyHas('Checkout was canceled'), 'canceled checkout notice');
  assert.equal(await browser.evaluate(`JSON.parse(localStorage.getItem('navigation-qa-user')).membershipStatus`), 'pending');
  assert.equal(await browser.evaluate(`window.__navigationQa.requests.some(request => request.path === '/members/dashboard')`), false);
});

await scenario('a verified paid receipt refreshes membership before opening the dashboard', { role: 'member', authenticated: true, organisation: 'A', membershipStatus: 'pending', returnPaid: true }, '/member/checkout?organisation=A&session_id=demo-paid-fixture', async browser => {
  await browser.waitFor(browser.bodyHas('Payment successful'), 'verified paid receipt');
  await browser.clickText('Open member dashboard');
  await browser.waitFor(`location.pathname === '/member/dashboard' && ${browser.bodyHas('Welcome back')}`, 'paid dashboard after verified return');
  const paths = await browser.evaluate('window.__navigationQa.requests.map(request => request.path)');
  assert.ok(paths.indexOf('/payments/checkout/demo-paid-fixture') >= 0);
  assert.ok(paths.indexOf('/members/dashboard') > paths.indexOf('/payments/checkout/demo-paid-fixture'));
});

await scenario('organisation owners can open the ready demo gateway', { role: 'owner', authenticated: true, organisation: 'A' }, '/admin/payments?organisation=A', async browser => {
  await browser.waitFor(browser.bodyHas('Demo payments are enabled'), 'demo payment settings');
  assert.equal(await browser.evaluate(browser.bodyHas('Renewals are manual')), true);
  assert.equal(await browser.evaluate(`window.__navigationQa.requests.some(request => request.path.startsWith('/payments/'))`), false);
});

await scenario('demo card checkout verifies authorization and persists a successful receipt', { role: 'member', authenticated: true, organisation: 'A', membershipStatus: 'pending' }, '/member/checkout?organisation=A', async browser => {
  await browser.waitFor(browser.bodyHas('Continue to payment'), 'demo payment details');
  assert.equal(await browser.evaluate(browser.bodyHas('No money is charged')), true);
  await browser.clickText('Continue to payment');
  await browser.waitFor(browser.bodyHas('Card authorization'), 'demo card authorization');
  assert.equal(await browser.evaluate(`new URLSearchParams(location.search).get('session_id')`), 'demo-1');
  await browser.evaluate('history.back()');
  await browser.waitFor(browser.bodyHas('Continue to payment'), 'Back restores payment details');
  await browser.evaluate('history.forward()');
  await browser.waitFor(browser.bodyHas('Card authorization'), 'Forward restores authorization');
  await browser.waitFor(`!!document.querySelector('#payment-verification')`, 'verification input ready');
  await browser.screenshot('demo-authorization-desktop');
  await browser.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await browser.screenshot('demo-authorization-mobile');
  assert.equal(await browser.evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'mobile checkout must not overflow horizontally');
  await browser.fill('#payment-verification', '123456');
  await browser.clickText('Authorize MYR 10.00');
  await browser.waitFor(browser.bodyHas('Payment successful'), 'approved payment receipt');
  await browser.screenshot('demo-receipt-mobile');
  await browser.call('Emulation.clearDeviceMetricsOverride');
  await browser.screenshot('demo-receipt-desktop');
  await browser.waitFor(`JSON.parse(localStorage.getItem('navigation-qa-user')).membershipStatus === 'active'`, 'membership refreshed');
  await browser.call('Page.reload');
  await browser.waitFor(browser.bodyHas('DEMO-RECEIPT-001'), 'receipt survives reload');
  await browser.clickText('Open member dashboard');
  await browser.waitFor(browser.bodyHas('Welcome back'), 'approved membership opens dashboard');
});

await scenario('a declined online banking payment remains locked and can start a new checkout', { role: 'member', authenticated: true, organisation: 'A', membershipStatus: 'pending' }, '/member/checkout?organisation=A', async browser => {
  await browser.waitFor(browser.bodyHas('Continue to payment'), 'bank payment details');
  await browser.evaluate(`document.querySelector('input[value="online_banking"]').click()`);
  await browser.clickText('Continue to payment');
  await browser.waitFor(browser.bodyHas('Online banking authorization'), 'bank authorization');
  await browser.waitFor(`!!document.querySelector('#payment-verification')`, 'bank verification input ready');
  await browser.fill('#payment-verification', '123456');
  await browser.evaluate(`(() => { const input = [...document.querySelectorAll('select')].find(item => [...item.options].some(option => option.value === 'declined')); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(input, 'declined'); input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await browser.clickText('Authorize MYR 10.00');
  await browser.waitFor(browser.bodyHas('Payment was declined'), 'declined payment');
  assert.equal(await browser.evaluate(`JSON.parse(localStorage.getItem('navigation-qa-user')).membershipStatus`), 'pending');
  assert.equal(await browser.evaluate(`window.__navigationQa.requests.some(request => request.path === '/members/dashboard')`), false);
  await browser.clickText('Start a new checkout');
  await browser.waitFor(browser.bodyHas('Continue to payment'), 'retry checkout details');
  assert.equal(await browser.evaluate(`new URLSearchParams(location.search).has('session_id')`), false);
});

const emailTag = (type, field, label) => {
  const title = type === 'welcome' ? 'Welcome email' : 'Renewal reminder';
  const fieldTitle = field === 'body' ? 'message' : 'subject';
  return `[role="group"][aria-label="${title} ${fieldTitle} tags"] button[aria-label="Insert ${label.toLowerCase()} into ${title.toLowerCase()} ${fieldTitle}"]`;
};

await scenario('welcome email tags replace selection and restore the caret in their own field', { role: 'owner', authenticated: true, organisation: 'A' }, '/admin/email-settings?organisation=A', async browser => {
  await browser.waitFor(`!!document.querySelector('#welcome-subject') && !!document.querySelector(${JSON.stringify(emailTag('welcome', 'subject', 'Member name'))})`, 'welcome email tag editor');
  await browser.fill('#welcome-subject', 'Hello friend!');
  await browser.selectText('#welcome-subject', 6, 12);
  await browser.clickSelector(emailTag('welcome', 'subject', 'Member name'));
  assert.deepEqual(await browser.evaluate(`({ value: document.querySelector('#welcome-subject').value, start: document.querySelector('#welcome-subject').selectionStart, end: document.querySelector('#welcome-subject').selectionEnd, focused: document.activeElement.id })`), { value: 'Hello {memberName}!', start: 18, end: 18, focused: 'welcome-subject' });
  await browser.clickSelector(emailTag('welcome', 'subject', 'Organisation name'));
  assert.equal(await browser.evaluate(`document.querySelector('#welcome-subject').value`), 'Hello {memberName}{organisationName}!');
  await browser.fill('#welcome-body', 'First line\nDear team,\nThanks');
  await browser.selectText('#welcome-body', 16, 20);
  await browser.clickSelector(emailTag('welcome', 'body', 'Membership tier'));
  assert.equal(await browser.evaluate(`document.querySelector('#welcome-body').value`), 'First line\nDear {tierName},\nThanks');
  assert.equal(await browser.evaluate(`document.activeElement.id`), 'welcome-body');
  assert.equal(await browser.evaluate(`document.querySelector('#welcome-subject').value`), 'Hello {memberName}{organisationName}!');
  assert.equal(await browser.evaluate(`document.querySelector('aside[aria-label="Email preview"]').textContent.includes('Hello Alex MemberAlpha Community!')`), true);
  assert.equal(await browser.evaluate(`document.querySelector('aside[aria-label="Email preview"]').textContent.includes('Dear Community,')`), true);
  await browser.selectText('#welcome-body', 34);
  await browser.call('Page.bringToFront');
  await browser.call('Emulation.setFocusEmulationEnabled', { enabled: true });
  await browser.evaluate(`document.querySelector(${JSON.stringify(emailTag('welcome', 'body', 'Member name'))}).focus()`);
  await browser.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await browser.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await browser.waitFor(`document.querySelector('#welcome-body').value === ${JSON.stringify('First line\nDear {tierName},\nThanks{memberName}')}`, 'keyboard Enter inserts the selected tag');
  assert.equal(await browser.evaluate('document.activeElement.id'), 'welcome-body');
  await browser.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await browser.evaluate(`document.querySelector('section[aria-labelledby="welcome-title"]').scrollIntoView({ block: 'start' })`);
  assert.equal(await browser.evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'mobile email tag controls must not overflow horizontally');
  await browser.screenshot('email-template-tags-mobile', false);
});

await scenario('renewal tags update the selected template preview and survive save and reload', { role: 'owner', authenticated: true, organisation: 'A' }, '/admin/email-settings?organisation=A', async browser => {
  await browser.waitFor(`!!document.querySelector(${JSON.stringify(emailTag('welcome', 'body', 'Member name'))})`, 'email template editors');
  await browser.fill('#welcome-body', 'Hello ');
  await browser.selectText('#welcome-body', 6);
  await browser.clickSelector(emailTag('welcome', 'body', 'Member name'));
  await browser.fill('#renewal-subject', 'Renews on ');
  await browser.selectText('#renewal-subject', 10);
  await browser.clickSelector(emailTag('renewal', 'subject', 'Expiry date'));
  await browser.fill('#renewal-body', 'Renew in  days.');
  await browser.selectText('#renewal-body', 9);
  await browser.clickSelector(emailTag('renewal', 'body', 'Reminder days'));
  assert.equal(await browser.evaluate(`document.querySelector('#welcome-body').value`), 'Hello {memberName}');
  assert.equal(await browser.evaluate(`document.querySelector('#renewal-subject').value`), 'Renews on {expiryDate}');
  assert.equal(await browser.evaluate(`document.querySelector('#renewal-body').value`), 'Renew in {renewalDays} days.');
  await browser.clickText('Preview renewal reminder');
  await browser.waitFor(`new URLSearchParams(location.search).get('preview') === 'renewal' && document.querySelector('aside[aria-label="Email preview"]').textContent.includes('Renews on 2026-11-30')`, 'renewal preview substitutes tags');
  assert.equal(await browser.evaluate(`document.querySelector('aside[aria-label="Email preview"]').textContent.includes('Renew in 30 days.')`), true);
  await browser.clickText('Save email settings');
  await browser.waitFor(browser.bodyHas('All changes saved.'), 'saved email templates');
  const saved = await browser.evaluate('window.__navigationQa.savedEmailSettings');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].organisationId, 'A');
  assert.equal(saved[0].settings.welcome.body, 'Hello {memberName}');
  assert.equal(saved[0].settings.renewal.subject, 'Renews on {expiryDate}');
  assert.equal(saved[0].settings.renewal.body, 'Renew in {renewalDays} days.');
  await browser.call('Page.reload');
  await browser.waitFor(`document.querySelector('#renewal-body')?.value === 'Renew in {renewalDays} days.'`, 'saved tags survive reload');
});

await scenario('email tag insertion respects subject and body limits without truncating tags', { role: 'owner', authenticated: true, organisation: 'A' }, '/admin/email-settings?organisation=A', async browser => {
  await browser.waitFor(`!!document.querySelector(${JSON.stringify(emailTag('welcome', 'subject', 'Member name'))})`, 'tag editor for length limits');
  await browser.fill('#welcome-subject', 'S'.repeat(160));
  await browser.selectText('#welcome-subject', 160);
  await browser.clickSelector(emailTag('welcome', 'subject', 'Member name'));
  assert.equal(await browser.evaluate(`document.querySelector('#welcome-subject').value`), 'S'.repeat(160));
  await browser.waitFor(browser.bodyHas('160-character limit'), 'subject limit feedback');
  await browser.selectText('#welcome-subject', 148, 160);
  await browser.clickSelector(emailTag('welcome', 'subject', 'Member name'));
  assert.equal(await browser.evaluate(`document.querySelector('#welcome-subject').value`), 'S'.repeat(148) + '{memberName}');
  await browser.fill('#renewal-body', 'B'.repeat(5000));
  await browser.selectText('#renewal-body', 5000);
  await browser.clickSelector(emailTag('renewal', 'body', 'Expiry date'));
  assert.equal(await browser.evaluate(`document.querySelector('#renewal-body').value.length`), 5000);
  await browser.waitFor(browser.bodyHas('5,000-character limit'), 'message limit feedback');
  await browser.selectText('#renewal-body', 4988, 5000);
  await browser.clickSelector(emailTag('renewal', 'body', 'Expiry date'));
  assert.equal(await browser.evaluate(`document.querySelector('#renewal-body').value`), 'B'.repeat(4988) + '{expiryDate}');
});

await scenario('financial analytics graphs show payment data and preserve the applied month range', { role: 'owner', authenticated: true, organisation: 'A' }, '/admin/finances?organisation=A&startMonth=2026-08&endMonth=2026-09', async browser => {
  await browser.waitFor(`document.querySelector('section[aria-busy="false"] svg[role="group"]') && ${browser.bodyHas('Revenue received')} && ${browser.bodyHas('Payment activity')}`, 'financial trend graphs with data');
  assert.deepEqual(await browser.evaluate(`[...document.querySelectorAll('section[aria-busy] h3')].map(item => item.textContent)`), ['Revenue received', 'Payment activity']);
  assert.equal(await browser.evaluate(`document.querySelectorAll('section[aria-busy] svg[role="group"]').length`), 2);
  assert.equal(await browser.evaluate(browser.bodyHas('Membership growth')), false);
  assert.equal(await browser.evaluate(browser.bodyHas('Member composition')), false);
  assert.equal(await browser.evaluate(`[...document.querySelectorAll('section[aria-busy] button')].some(button => button.textContent.trim() === 'Details')`), false);
  const monthlyPoints = await browser.evaluate(`[...document.querySelectorAll('section[aria-busy] svg[role="group"] rect[role="button"]')].map(item => item.getAttribute('aria-label').replace(/\\s/g, ' '))`);
  assert.ok(monthlyPoints.some(label => label.includes('August 2026') && label.includes('MYR 50.00')));
  assert.ok(monthlyPoints.some(label => label.includes('September 2026') && label.includes('Successful 3') && label.includes('Failed 1')));
  await browser.fill('#dashboard-analytics-start', '2026-07');
  await browser.fill('#dashboard-analytics-end', '2026-09');
  await browser.clickText('Apply range');
  await browser.waitFor(`new URLSearchParams(location.search).get('startMonth') === '2026-07' && document.querySelector('section[aria-busy="false"]') && document.querySelectorAll('section[aria-busy] svg[role="group"] rect[role="button"]').length === 6`, 'range applies to both financial graphs');
  const rangedRequest = await browser.evaluate(`window.__navigationQa.requests.filter(request => request.path === '/admin/dashboard-analytics').at(-1)`);
  const apiRange = new URL(rangedRequest.requestUrl, appOrigin).searchParams;
  assert.equal(apiRange.get('startMonth'), '2026-07');
  assert.equal(apiRange.get('endMonth'), '2026-09');
  assert.equal(rangedRequest.organisation, 'A');
  await browser.evaluate('history.back()');
  await browser.waitFor(`new URLSearchParams(location.search).get('startMonth') === '2026-08' && document.querySelector('#dashboard-analytics-start').value === '2026-08' && document.querySelector('section[aria-busy="false"]') && document.querySelectorAll('section[aria-busy] svg[role="group"] rect[role="button"]').length === 4`, 'Back restores previous financial range');
  await browser.call('Page.reload');
  await browser.waitFor(`document.querySelector('#dashboard-analytics-start')?.value === '2026-08' && document.querySelector('section[aria-busy="false"] svg[role="group"]')`, 'financial graphs reload from their URL range');
  await browser.call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await browser.evaluate(`scrollTo(0, document.querySelector('#financial-analytics-title').getBoundingClientRect().top + scrollY - 80)`);
  await browser.screenshot('financial-trends-desktop', false);
  await browser.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await browser.evaluate(`scrollTo(0, document.querySelector('#financial-analytics-title').getBoundingClientRect().top + scrollY - 80)`);
  assert.equal(await browser.evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'mobile financial charts must not overflow horizontally');
  await browser.screenshot('financial-trends-mobile', false);
});

await scenario('financial analytics restores organisation context and the dashboard keeps all charts', { role: 'owner', authenticated: true, organisation: 'A' }, '/admin/finances?organisation=B&startMonth=2026-08&endMonth=2026-09', async browser => {
  await browser.waitFor(`document.querySelector('section[aria-busy="false"] svg[role="group"]') && ${browser.bodyHas('Revenue received')}`, 'Beta financial charts');
  const requests = await browser.evaluate('window.__navigationQa.requests');
  const selection = requests.findIndex(request => request.path === '/organisations/select');
  const analytics = requests.findIndex(request => request.path === '/admin/dashboard-analytics');
  assert.ok(selection >= 0 && analytics > selection, 'organisation selection happens before financial chart data is loaded');
  assert.ok(requests.filter(request => request.path === '/admin/dashboard-analytics').every(request => request.organisation === 'B'));
  assert.equal(await browser.evaluate(`document.querySelector('section[aria-busy]').textContent.replace(/\\s/g, ' ').includes('MYR 1,500.00')`), true);
  await browser.clickText('Dashboard');
  await browser.waitFor(`${browser.bodyHas('Beta Community Dashboard')} && document.querySelector('section[aria-busy="false"] svg[role="img"]')`, 'full Beta dashboard analytics');
  assert.deepEqual(await browser.evaluate(`[...document.querySelectorAll('section[aria-busy] h3')].map(item => item.textContent)`), ['Membership growth', 'Member composition', 'Revenue received', 'Payment activity']);
  assert.equal(await browser.evaluate(`document.querySelectorAll('section[aria-busy] svg[role="group"]').length`), 3);
  assert.equal(await browser.evaluate(`document.querySelectorAll('section[aria-busy] svg[role="img"]').length`), 1);
  assert.equal(await browser.evaluate(`[...document.querySelectorAll('section[aria-busy] button')].some(button => button.textContent.trim() === 'Details')`), true);
});

await scenario('event analytics counts ongoing events and plots current RSVP registrations including zero totals', { role: 'owner', authenticated: true, organisation: 'A', eventAnalyticsFixture: true }, '/admin/events?organisation=A', async browser => {
  await browser.waitFor(`document.querySelectorAll('[aria-label="RSVP totals by event"] li').length === 4`, 'event analytics with fixture data');
  assert.equal(await browser.evaluate(`document.querySelector('[aria-label="Upcoming events summary"] p').textContent`), '3');
  assert.equal(await browser.evaluate(`document.querySelector('[aria-label="Total RSVPs summary"] p').textContent`), '4');
  const totals = await browser.evaluate(`[...document.querySelectorAll('[aria-label="RSVP totals by event"] li')].map(item => ({ label: item.getAttribute('aria-label'), text: item.textContent }))`);
  for (const [title, count] of [['Future Gathering', 2], ['Ongoing Weekend', 1], ['Past Gathering', 1], ['Open Workshop', 0]]) {
    assert.ok(totals.some(item => item.label === `A ${title} RSVP total` && item.text.includes(`${count} RSVPs`)), `RSVP total for ${title}`);
  }
  const registrations = await browser.evaluate(`[...document.querySelector('section[aria-labelledby="event-analytics-title"]').querySelectorAll('svg[role="group"] rect[role="button"]')].map(item => item.getAttribute('aria-label'))`);
  assert.equal(registrations.length, 6);
  assert.equal(registrations.filter(label => label.endsWith('Registrations 2')).length, 2, 'two current registrations are recorded in each of the latest two UTC months');
  assert.equal(await browser.evaluate(`document.querySelector('section[aria-labelledby="event-analytics-title"] svg title').textContent`), 'Event registration trends');
  await browser.call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await browser.evaluate(`scrollTo(0, document.querySelector('#event-analytics-title').getBoundingClientRect().top + scrollY - 80)`);
  await browser.screenshot('event-analytics-desktop', false);
  await browser.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await browser.evaluate(`scrollTo(0, document.querySelector('section[aria-labelledby="event-analytics-title"] svg[role="group"]').closest('article').getBoundingClientRect().top + scrollY - 80)`);
  assert.equal(await browser.evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'mobile event analytics must not overflow horizontally');
  await browser.screenshot('event-analytics-mobile', false);
});

await scenario('event analytics filters preserve RSVP inspection and browser history', { role: 'owner', authenticated: true, organisation: 'A', eventAnalyticsFixture: true }, '/admin/events?organisation=A', async browser => {
  await browser.waitFor(`document.querySelectorAll('[aria-label="RSVP totals by event"] li').length === 4`, 'event list before filtering');
  await browser.choose('select[aria-label="Events to analyse"]', 'past');
  await browser.waitFor(`new URLSearchParams(location.search).get('eventScope') === 'past' && document.querySelectorAll('[aria-label="RSVP totals by event"] li').length === 1`, 'past event analytics filter');
  assert.equal(await browser.evaluate(`document.querySelector('[aria-label="RSVP totals by event"] li').getAttribute('aria-label')`), 'A Past Gathering RSVP total');
  assert.equal(await browser.evaluate(`document.querySelector('[aria-label="Total RSVPs summary"] p').textContent`), '1');
  await browser.choose('select[aria-label="Events to analyse"]', 'upcoming');
  await browser.waitFor(`new URLSearchParams(location.search).get('eventScope') === 'upcoming' && document.querySelectorAll('[aria-label="RSVP totals by event"] li').length === 3`, 'upcoming event analytics includes ongoing events');
  assert.equal(await browser.evaluate(`!!document.querySelector('[aria-label="A Ongoing Weekend RSVP total"]')`), true);
  assert.equal(await browser.evaluate(`!!document.querySelector('[aria-label="A Past Gathering RSVP total"]')`), false);
  assert.equal(await browser.evaluate(`[...document.querySelectorAll('main table')].find(table => table.querySelector('thead th')?.textContent.trim() === 'Event Details').querySelectorAll('tbody tr').length`), 4, 'analytics filters retain the management table');
  await browser.clickSelector('button[aria-label="View RSVPs for A Future Gathering"]');
  await browser.waitFor(`new URLSearchParams(location.search).get('roster') === 'A-future-event' && ${browser.bodyHas('Attendee Guest List (2 confirmed)')}`, 'inspect event registrations from analytics');
  assert.equal(await browser.evaluate(browser.bodyHas('A Event Guest 1')), true);
  assert.equal(await browser.evaluate(`new URLSearchParams(location.search).get('eventScope')`), 'upcoming');
  await browser.evaluate('history.back()');
  await browser.waitFor(`!new URLSearchParams(location.search).has('roster') && !${browser.bodyHas('Attendee Guest List')}`, 'Back closes attendee inspection');
  assert.equal(await browser.evaluate(`document.querySelector('select[aria-label="Events to analyse"]').value`), 'upcoming');
  await browser.choose('select[aria-label="Registration trend period"]', '3');
  await browser.waitFor(`new URLSearchParams(location.search).get('registrationMonths') === '3' && document.querySelectorAll('section[aria-labelledby="event-analytics-title"] svg[role="group"] rect[role="button"]').length === 3`, 'registration trend month filter');
  await browser.call('Page.reload');
  await browser.waitFor(`document.querySelector('select[aria-label="Registration trend period"]')?.value === '3' && document.querySelector('select[aria-label="Events to analyse"]')?.value === 'upcoming' && document.querySelectorAll('[aria-label="RSVP totals by event"] li').length === 3`, 'event analytics filters survive reload');
});

await scenario('event analytics restores organisation scope before reading registrations', { role: 'owner', authenticated: true, organisation: 'A', eventAnalyticsFixture: true }, '/admin/events?organisation=B&eventScope=past', async browser => {
  await browser.waitFor(`document.querySelector('[aria-label="B Past Gathering RSVP total"]')`, 'Beta past-event analytics');
  assert.equal(await browser.evaluate(`!!document.querySelector('[aria-label="A Past Gathering RSVP total"]')`), false);
  const requests = await browser.evaluate('window.__navigationQa.requests');
  const selection = requests.findIndex(request => request.path === '/organisations/select');
  const eventFetch = requests.findIndex(request => request.path === '/events');
  assert.ok(selection >= 0 && eventFetch > selection, 'organisation context is restored before event analytics loads');
  assert.ok(requests.filter(request => request.path === '/events').every(request => request.organisation === 'B' && new URL(request.requestUrl, appOrigin).searchParams.get('organisationId') === 'B'));
  await browser.call('Page.reload');
  await browser.waitFor(`document.querySelector('[aria-label="B Past Gathering RSVP total"]') && document.querySelector('select[aria-label="Events to analyse"]').value === 'past'`, 'Beta analytics context and filter survive reload');
});

await scenario('membership tiers create and edit without access levels or individual accents', { role: 'owner', authenticated: true, organisation: 'A', tierSettingsFixture: true }, '/admin/tiers?organisation=A', async browser => {
  await browser.waitFor(`document.querySelector('[aria-label="A Community badge accent"]') && document.querySelector('[aria-label="A Premium badge accent"]')`, 'organisation membership tiers');
  assert.equal(await browser.evaluate(browser.bodyHas('Lvl ')), false);
  await browser.clickText('Add Membership Tier');
  await browser.waitFor(browser.bodyHas('Create Custom Membership Tier'), 'create membership tier');
  assert.equal(await browser.evaluate(`document.querySelector('#tier-name').closest('form').querySelectorAll('input[type="color"]').length`), 0);
  assert.equal(await browser.evaluate(browser.bodyHas('Access Level')), false);
  await browser.fill('#tier-name', 'New Supporter');
  await browser.fill('#tier-price', '12.50');
  await browser.fill('#tier-capacity', '35');
  await browser.clickText('Create Tier');
  await browser.waitFor(`document.querySelector('[aria-label="New Supporter badge accent"]') && !document.querySelector('#tier-name')`, 'saved new tier returns to list');
  await browser.evaluate(`(() => { const card = [...document.querySelectorAll('h3')].find(item => item.textContent === 'New Supporter').closest('.group'); [...card.querySelectorAll('button')].find(button => button.textContent.trim() === 'Edit').click(); })()`);
  await browser.waitFor(`document.querySelector('#tier-name')?.value === 'New Supporter'`, 'edit membership tier');
  await browser.fill('#tier-name', 'Updated Supporter');
  await browser.choose('#tier-interval', 'yearly');
  await browser.clickText('Save Changes');
  await browser.waitFor(`document.querySelector('[aria-label="Updated Supporter badge accent"]') && window.__navigationQa.savedTiers.length === 2`, 'saved edited tier');
  const saves = await browser.evaluate('window.__navigationQa.savedTiers');
  assert.equal(saves[0].method, 'POST');
  assert.equal(saves[0].tier.price, 12.5);
  assert.equal(saves[0].tier.maxMembers, 35);
  assert.equal(saves[1].method, 'PUT');
  assert.equal(saves[1].tier.interval, 'yearly');
  assert.ok(saves.every(item => !('accessLevel' in item.tier) && !('badgeColor' in item.tier)));
});

await scenario('organisation badge accent validates and applies to every tier after saving', { role: 'owner', authenticated: true, organisation: 'A', tierSettingsFixture: true }, '/admin/tiers?organisation=A', async browser => {
  await browser.waitFor(`document.querySelector('#membership-badge-accent')?.value === '#FFD700'`, 'organisation badge accent');
  const dotColours = () => browser.evaluate(`[...document.querySelectorAll('span[aria-label$=" badge accent"]')].map(item => getComputedStyle(item).backgroundColor)`);
  assert.deepEqual(await dotColours(), ['rgb(255, 215, 0)', 'rgb(255, 215, 0)']);
  await browser.fill('#membership-badge-accent', 'invalid');
  await browser.clickText('Save badge accent');
  await browser.waitFor(browser.bodyHas('Enter a six-digit hex colour'), 'invalid accent feedback');
  assert.equal(await browser.evaluate('window.__navigationQa.savedAccents.length'), 0);
  await browser.fill('#membership-badge-accent', '#0f766e');
  assert.deepEqual(await dotColours(), ['rgb(255, 215, 0)', 'rgb(255, 215, 0)'], 'draft accent does not change saved badges');
  await browser.evaluate('window.__navigationQa.rejectAccentSaves = true');
  await browser.clickText('Save badge accent');
  await browser.waitFor(browser.bodyHas('Badge accent save failed in fixture.'), 'failed save feedback');
  assert.deepEqual(await dotColours(), ['rgb(255, 215, 0)', 'rgb(255, 215, 0)'], 'failed save retains existing badges');
  await browser.evaluate('window.__navigationQa.rejectAccentSaves = false');
  await browser.clickText('Save badge accent');
  await browser.waitFor(browser.bodyHas('Badge accent saved for every membership'), 'saved organisation accent');
  assert.deepEqual(await dotColours(), ['rgb(15, 118, 110)', 'rgb(15, 118, 110)']);
  assert.deepEqual(await browser.evaluate('window.__navigationQa.savedAccents'), [{ organisationId: 'A', badgeColor: '#0F766E' }]);
  await browser.call('Page.reload');
  await browser.waitFor(`document.querySelector('#membership-badge-accent')?.value === '#0F766E'`, 'saved accent survives reload');
  assert.deepEqual(await dotColours(), ['rgb(15, 118, 110)', 'rgb(15, 118, 110)']);
  await browser.screenshot('membership-badge-accent-desktop');
  await browser.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await browser.waitFor('document.documentElement.scrollWidth <= innerWidth', 'membership tier mobile layout fits viewport');
  await browser.screenshot('membership-badge-accent-mobile');
});

await scenario('late organisation accent save cannot change another organisation tiers', { role: 'owner', authenticated: true, organisation: 'A', tierSettingsFixture: true }, '/admin/tiers?organisation=A', async browser => {
  await browser.waitFor(`document.querySelector('#membership-badge-accent')?.value === '#FFD700'`, 'Alpha badge settings');
  await browser.evaluate('window.__navigationQa.deferAccentSaves = true');
  await browser.fill('#membership-badge-accent', '#7C3AED');
  await browser.clickText('Save badge accent');
  await browser.waitFor('window.__navigationQa.deferredAccentSaves.length === 1', 'pending Alpha accent request');
  await browser.clickText('My Organisations');
  await browser.waitFor(`document.querySelector('[aria-label="Open admin portal for Beta Community"]')`, 'owned organisation directory');
  await browser.clickSelector('[aria-label="Open admin portal for Beta Community"]');
  await browser.waitFor(browser.bodyHas('Beta Community Dashboard'), 'Beta portal');
  await browser.clickText('Tiers & Pricing');
  await browser.waitFor(`document.querySelector('[aria-label="B Community badge accent"]') && document.querySelector('#membership-badge-accent')?.value === '#2563EB'`, 'Beta membership settings');
  await browser.evaluate('window.__navigationQa.deferredAccentSaves.shift()()');
  await pause(150);
  assert.equal(await browser.evaluate(`document.querySelector('#membership-badge-accent').value`), '#2563EB');
  assert.equal(await browser.evaluate(`getComputedStyle(document.querySelector('[aria-label="B Community badge accent"]')).backgroundColor`), 'rgb(37, 99, 235)');
  assert.equal(await browser.evaluate(browser.bodyHas('Badge accent saved for every membership')), false);
  assert.equal(await browser.evaluate(`sessionStorage.getItem('badge-accent-B')`), null);
  await browser.call('Page.reload');
  await browser.waitFor(`document.querySelector('#membership-badge-accent')?.value === '#2563EB'`, 'Beta settings retain their own accent');
});

await scenario('member badges keep the organisation accent across tier changes', { role: 'member', authenticated: true, organisation: 'A', tierSettingsFixture: true }, '/member/pass?organisation=A', async browser => {
  await browser.waitFor(`document.querySelector('[aria-label="Membership badge"]')`, 'member badge');
  assert.equal(await browser.evaluate(`getComputedStyle(document.querySelector('[aria-label="Membership badge"]')).backgroundColor`), 'rgb(255, 215, 0)');
  await browser.evaluate(`(() => { const user = JSON.parse(localStorage.getItem('navigation-qa-user')); user.tierId = 'A-premium'; user.tierName = 'A Premium'; localStorage.setItem('navigation-qa-user', JSON.stringify(user)); })()`);
  await browser.call('Page.reload');
  await browser.waitFor(`document.querySelector('[aria-label="Membership badge"]')?.textContent.includes('A Premium')`, 'different membership tier badge');
  assert.equal(await browser.evaluate(`getComputedStyle(document.querySelector('[aria-label="Membership badge"]')).backgroundColor`), 'rgb(255, 215, 0)');
  await browser.call('Page.navigate', { url: appOrigin + '/member/pass?organisation=B' });
  await browser.waitFor(`document.querySelector('[aria-label="Membership badge"]')?.textContent.includes('Beta Community')`, 'second organisation member badge');
  assert.equal(await browser.evaluate(`getComputedStyle(document.querySelector('[aria-label="Membership badge"]')).backgroundColor`), 'rgb(37, 99, 235)');
});

await scenario('combined membership overview shows statistics and a pass without creating a checkout', { role: 'member', authenticated: true, organisation: 'A', membershipPortalFixture: true }, '/member/membership?organisation=A', async browser => {
  await browser.call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await browser.waitFor(`${browser.bodyHas('Membership overview')} && document.querySelector('[aria-label="Membership badge"]')`, 'membership overview and digital pass');
  for (const text of ['First subscribed', 'Current period started', 'Renewal date', 'Days remaining', 'Upgrade your membership']) {
    assert.equal(await browser.evaluate(browser.bodyHas(text)), true, `overview includes ${text}`);
  }
  assert.equal(await browser.evaluate(`document.querySelector('nav[aria-label="Member portal navigation"]').textContent.split('Manage Membership').length - 1`), 1);
  assert.equal(await browser.evaluate(`document.querySelector('nav[aria-label="Member portal navigation"]').textContent.includes('Digital Membership Pass')`), false);
  assert.equal(await browser.evaluate(`window.__navigationQa.requests.some(request => request.path.startsWith('/payments/'))`), false);
  assert.equal(await browser.evaluate(browser.bodyHas('Membership Checkout')), false);
  await browser.screenshot('membership-overview-desktop');
  await browser.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await browser.evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'membership overview fits a mobile viewport');
  await browser.screenshot('membership-overview-mobile');
  await browser.call('Emulation.clearDeviceMetricsOverride');
  for (const legacyPath of ['/member/pass', '/member/renew', '/member/checkout']) {
    await browser.call('Page.navigate', { url: appOrigin + legacyPath + '?organisation=A&source=legacy' });
    await browser.waitFor(`location.pathname === '/member/membership' && ${browser.bodyHas('Membership overview')}`, `canonical overview from ${legacyPath}`);
    assert.equal(await browser.evaluate(`window.__navigationQa.requests.some(request => request.path.startsWith('/payments/'))`), false, 'opening an existing active membership does not start payment');
  }
});

await scenario('canceling a paid membership keeps the pass until period end and can be resumed', { role: 'member', authenticated: true, organisation: 'A', membershipPortalFixture: true }, '/member/membership?organisation=A', async browser => {
  await browser.waitFor(browser.bodyHas('Cancel subscription'), 'subscription actions');
  await browser.clickText('Cancel subscription');
  await browser.waitFor(`document.querySelector('[role="dialog"][aria-labelledby="cancel-membership-title"]') && new URLSearchParams(location.search).get('membershipAction') === 'cancel'`, 'cancellation confirmation');
  assert.equal(await browser.evaluate(`window.__navigationQa.requests.some(request => request.path === '/members/membership/cancel')`), false, 'opening the confirmation does not cancel membership');
  await browser.evaluate('history.back()');
  await browser.waitFor(`!document.querySelector('[role="dialog"][aria-labelledby="cancel-membership-title"]')`, 'Back dismisses cancellation');
  await browser.clickText('Cancel subscription');
  await browser.clickText('Confirm cancellation');
  await browser.waitFor(`${browser.bodyHas('Keep my membership')} && ${browser.bodyHas('Access ends')}`, 'cancellation scheduled for the period end');
  assert.equal(await browser.evaluate(`JSON.parse(localStorage.getItem('navigation-qa-user')).membershipStatus`), 'active');
  assert.equal(await browser.evaluate(`!!document.querySelector('[aria-label="Membership badge"]')`), true, 'the paid pass stays available');
  assert.equal(await browser.evaluate(`JSON.parse(sessionStorage.getItem('membership-A')).cancelAtPeriodEnd`), true);
  await browser.call('Page.reload');
  await browser.waitFor(browser.bodyHas('Keep my membership'), 'scheduled cancellation survives reload');
  await browser.clickText('Keep my membership');
  await browser.waitFor(`${browser.bodyHas('Cancel subscription')} && ${browser.bodyHas('Renewal date')}`, 'membership resumed');
  assert.equal(await browser.evaluate(`JSON.parse(sessionStorage.getItem('membership-A')).cancelAtPeriodEnd`), false);
  assert.equal(await browser.evaluate(`window.__navigationQa.requests.some(request => request.path.startsWith('/payments/'))`), false);
});

await scenario('canceling a free membership immediately removes its digital pass', { role: 'member', authenticated: true, organisation: 'A', membershipPortalFixture: true, freeMembershipFixture: true }, '/member/membership?organisation=A', async browser => {
  await browser.waitFor(`document.querySelector('[aria-label="Membership badge"]') && ${browser.bodyHas('Free membership')}`, 'active free membership');
  await browser.clickText('Cancel subscription');
  await browser.waitFor(browser.bodyHas('Your membership and digital pass access will end immediately.'), 'free cancellation warning');
  await browser.clickText('Confirm cancellation');
  await browser.waitFor(`${browser.bodyHas('There is no active subscription to cancel.')} && !document.querySelector('[aria-label="Membership badge"]')`, 'free pass removed after cancellation');
  assert.equal(await browser.evaluate(`JSON.parse(localStorage.getItem('navigation-qa-user')).membershipStatus`), 'cancelled');
  assert.equal(await browser.evaluate(`JSON.parse(sessionStorage.getItem('membership-A')).cancelAtPeriodEnd`), false);
  assert.equal(await browser.evaluate(`window.__navigationQa.requests.some(request => request.path.startsWith('/payments/'))`), false);
  await browser.call('Page.reload');
  await browser.waitFor(`${browser.bodyHas('Membership overview')} && !document.querySelector('[aria-label="Membership badge"]')`, 'cancelled membership remains manageable after reload');
});

await scenario('membership upgrade previews unused credit and only changes the tier after an approved payment', { role: 'member', authenticated: true, organisation: 'A', membershipPortalFixture: true }, '/member/membership?organisation=A', async browser => {
  await browser.waitFor(`document.querySelector('[aria-label="Upgrade to A Premium"]') && document.querySelector('[aria-label="Membership badge"]')`, 'upgrade choices and current pass');
  await browser.clickSelector('[aria-label="Upgrade to A Premium"]');
  await browser.waitFor(`location.pathname === '/member/checkout' && new URLSearchParams(location.search).get('intent') === 'upgrade' && ${browser.bodyHas('MYR 20.00')}`, 'server upgrade quote');
  for (const amount of ['MYR 25.00', 'MYR 5.00']) assert.equal(await browser.evaluate(browser.bodyHas(amount)), true, `upgrade displays ${amount}`);
  const quote = await browser.evaluate(`window.__navigationQa.requests.find(request => request.path === '/payments/quote')`);
  assert.deepEqual(quote.payload, { tierId: 'A-premium', organisationId: 'A', intent: 'upgrade' });
  assert.equal(await browser.evaluate(`window.__navigationQa.requests.some(request => request.path === '/payments/checkout')`), false, 'a quote does not create a payment');
  await browser.call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await browser.screenshot('membership-upgrade-quote-desktop');
  await browser.evaluate('history.back()');
  await browser.waitFor(browser.bodyHas('Membership overview'), 'Back returns to the current membership');
  assert.equal(await browser.evaluate(`JSON.parse(localStorage.getItem('navigation-qa-user')).tierId`), 'A-tier');
  await browser.evaluate('history.forward()');
  await browser.waitFor(browser.bodyHas('MYR 20.00'), 'Forward restores the upgrade quote');
  await browser.call('Page.reload');
  await browser.waitFor(browser.bodyHas('Continue to payment'), 'upgrade intent and tier survive reload');
  await browser.clickText('Continue to payment');
  await browser.waitFor(`document.querySelector('#payment-verification')`, 'upgrade authorization');
  await browser.fill('#payment-verification', '123456');
  await browser.evaluate(`(() => { const input = [...document.querySelectorAll('select')].find(item => [...item.options].some(option => option.value === 'declined')); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(input, 'declined'); input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await browser.clickText('Authorize MYR 20.00');
  await browser.waitFor(browser.bodyHas('Payment was declined'), 'declined upgrade');
  assert.equal(await browser.evaluate(`JSON.parse(localStorage.getItem('navigation-qa-user')).membershipStatus`), 'active');
  assert.equal(await browser.evaluate(`JSON.parse(localStorage.getItem('navigation-qa-user')).tierId`), 'A-tier', 'a declined upgrade preserves the original tier');
  await browser.clickText('Start a new checkout');
  await browser.waitFor(browser.bodyHas('Continue to payment'), 'retry the same upgrade');
  await browser.clickText('Continue to payment');
  await browser.waitFor(`document.querySelector('#payment-verification')`, 'new upgrade authorization');
  await browser.fill('#payment-verification', '123456');
  await browser.evaluate(`(() => { const input = [...document.querySelectorAll('select')].find(item => [...item.options].some(option => option.value === 'approved')); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(input, 'approved'); input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await browser.clickText('Authorize MYR 20.00');
  await browser.waitFor(browser.bodyHas('Payment successful'), 'approved upgrade receipt');
  assert.equal(await browser.evaluate(`JSON.parse(localStorage.getItem('navigation-qa-user')).tierId`), 'A-premium');
  assert.equal(await browser.evaluate(`JSON.parse(sessionStorage.getItem('membership-A')).firstSubscribedAt`), '2026-03-01T00:00:00.000Z');
  await browser.clickText('Back to membership');
  await browser.waitFor(`location.pathname === '/member/membership' && document.querySelector('[aria-label="Membership badge"]')?.textContent.includes('A Premium')`, 'approved upgrade returns to membership overview');
  assert.equal(await browser.evaluate(`!!document.querySelector('[aria-label="Upgrade to A Premium"]')`), false, 'the current tier cannot be purchased again as an upgrade');
});

await scenario('membership overview and upgrade quotes restore organisation context before fetching data', { role: 'member', authenticated: true, organisation: 'A', membershipPortalFixture: true }, '/member/membership?organisation=B', async browser => {
  await browser.waitFor(`document.querySelector('[aria-label="Membership badge"]')?.textContent.includes('Beta Community') && document.querySelector('[aria-label="Upgrade to B Premium"]')`, 'Beta membership overview');
  let reads = await browser.evaluate(`window.__navigationQa.requests.filter(request => request.path === '/members/membership')`);
  assert.ok(reads.length > 0);
  assert.equal(reads.every(request => request.organisation === 'B' && new URL(request.requestUrl, appOrigin).searchParams.get('organisationId') === 'B'), true);
  assert.equal(await browser.evaluate(`!!document.querySelector('[aria-label="Upgrade to A Premium"]')`), false);
  await browser.clickSelector('[aria-label="Upgrade to B Premium"]');
  await browser.waitFor(browser.bodyHas('MYR 20.00'), 'Beta upgrade quote');
  const quote = await browser.evaluate(`window.__navigationQa.requests.find(request => request.path === '/payments/quote')`);
  assert.equal(quote.organisation, 'B');
  assert.equal(quote.payload.organisationId, 'B');
  assert.equal(quote.payload.tierId, 'B-premium');
  await browser.evaluate('history.back()');
  await browser.waitFor(browser.bodyHas('Membership overview'), 'Beta overview after backing out of checkout');
  await browser.call('Page.reload');
  await browser.waitFor(`document.querySelector('[aria-label="Membership badge"]')?.textContent.includes('Beta Community')`, 'Beta membership remains selected after reload');
  reads = await browser.evaluate(`window.__navigationQa.requests.filter(request => request.path === '/members/membership')`);
  assert.equal(reads.every(request => request.organisation === 'B'), true);
});

await scenario('scheduled downgrade preserves the current pass, handles history and cancels without checkout', { role: 'member', authenticated: true, organisation: 'A', downgradeFixture: true }, '/member/membership?organisation=A', async browser => {
  await browser.waitFor(`document.querySelector('[aria-label="Downgrade to A Community"]') && document.querySelector('[aria-label="Membership badge"]')?.textContent.includes('A Premium')`, 'cheaper membership choices');
  assert.equal(await browser.evaluate(`!!document.querySelector('[aria-label="Downgrade to A Annual Supporter"]')`), true, 'a cheaper equivalent monthly annual tier is offered');
  for (const tierName of ['A Equivalent Annual', 'A Higher Annual', 'A Inactive']) assert.equal(await browser.evaluate(`!!document.querySelector('[aria-label="Downgrade to ${tierName}"]')`), false, `${tierName} is not a cheaper active tier`);
  await browser.clickSelector('[aria-label="Downgrade to A Community"]');
  await browser.waitFor(`document.querySelector('[role="dialog"][aria-labelledby="downgrade-membership-title"]') && new URLSearchParams(location.search).get('downgradeTier') === 'A-tier'`, 'scheduled change confirmation');
  assert.equal(await browser.evaluate(browser.bodyHas('No charge is made now.')), true);
  await browser.evaluate('history.back()');
  await browser.waitFor(`!document.querySelector('[role="dialog"]')`, 'Back closes downgrade confirmation');
  await browser.evaluate('history.forward()');
  await browser.waitFor(browser.bodyHas('Confirm downgrade'), 'Forward restores downgrade confirmation');
  await browser.call('Page.reload');
  await browser.waitFor(browser.bodyHas('Confirm downgrade'), 'reload keeps the downgrade confirmation');
  await browser.clickText('Confirm downgrade');
  await browser.waitFor(`document.querySelector('[aria-label="Scheduled membership downgrade"]') && !document.querySelector('[role="dialog"]')`, 'downgrade saved');
  assert.equal(await browser.evaluate(`JSON.parse(sessionStorage.getItem('membership-A')).tierId`), 'A-premium');
  assert.equal(await browser.evaluate(`JSON.parse(sessionStorage.getItem('membership-A')).scheduledTierId`), 'A-tier');
  assert.equal(await browser.evaluate(`document.querySelector('[aria-label="Membership badge"]').textContent.includes('A Premium')`), true, 'the expensive pass remains active');
  assert.equal(await browser.evaluate(`window.__navigationQa.requests.some(request => request.path.startsWith('/payments/'))`), false, 'scheduling does not create a payment or quote');
  await browser.screenshot('membership-downgrade-desktop');
  await browser.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await browser.evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'downgrade choices fit a mobile viewport');
  await browser.screenshot('membership-downgrade-mobile');
  await browser.call('Page.reload');
  await browser.waitFor(browser.bodyHas('Cancel scheduled downgrade'), 'scheduled downgrade survives reload');
  await browser.clickText('Cancel scheduled downgrade');
  await browser.waitFor(`!document.querySelector('[aria-label="Scheduled membership downgrade"]')`, 'scheduled downgrade removed');
  assert.equal(await browser.evaluate(`JSON.parse(sessionStorage.getItem('membership-A')).scheduledTierId`), null);
  assert.equal(await browser.evaluate(`JSON.parse(sessionStorage.getItem('membership-A')).tierId`), 'A-premium');
});

await scenario('scheduled downgrade renewal uses the cheaper tier only after the current period ends', { role: 'member', authenticated: true, organisation: 'A', downgradeFixture: true }, '/member/membership?organisation=A', async browser => {
  await browser.waitFor(`document.querySelector('[aria-label="Downgrade to A Annual Supporter"]')`, 'annual downgrade choice');
  await browser.clickSelector('[aria-label="Downgrade to A Annual Supporter"]');
  await browser.clickText('Confirm downgrade');
  await browser.waitFor(browser.bodyHas('Cancel scheduled downgrade'), 'annual downgrade scheduled');
  await browser.evaluate(`(() => { const saved = JSON.parse(sessionStorage.getItem('membership-A')); saved.expirationDate = new Date(Date.now() - 60000).toISOString(); saved.currentPeriodEnd = saved.expirationDate; saved.scheduledTierEffectiveAt = saved.expirationDate; saved.status = 'expired'; sessionStorage.setItem('membership-A', JSON.stringify(saved)); const user = JSON.parse(localStorage.getItem('navigation-qa-user')); user.membershipStatus = 'expired'; localStorage.setItem('navigation-qa-user', JSON.stringify(user)); })()`);
  await browser.call('Page.reload');
  await browser.waitFor(browser.bodyHas('Renew with A Annual Supporter'), 'expired expensive tier can renew with its scheduled cheaper tier');
  assert.equal(await browser.evaluate(`window.__navigationQa.requests.some(request => request.path.startsWith('/payments/'))`), false, 'passing the period end does not charge automatically');
  await browser.clickText('Renew with A Annual Supporter');
  await browser.waitFor(`location.pathname === '/member/checkout' && new URLSearchParams(location.search).get('tier') === 'A-annual' && ${browser.bodyHas('MYR 120.00')}`, 'scheduled tier renewal quote');
  const quote = await browser.evaluate(`window.__navigationQa.requests.find(request => request.path === '/payments/quote')`);
  assert.deepEqual(quote.payload, { tierId: 'A-annual', organisationId: 'A', intent: 'renew' });
  await browser.clickText('Continue to payment');
  await browser.waitFor(`document.querySelector('#payment-verification')`, 'cheaper membership payment authorization');
  await browser.fill('#payment-verification', '123456');
  await browser.clickText('Authorize MYR 120.00');
  await browser.waitFor(browser.bodyHas('Payment successful'), 'cheaper renewal receipt');
  assert.equal(await browser.evaluate(`JSON.parse(localStorage.getItem('navigation-qa-user')).tierId`), 'A-annual');
  assert.equal(await browser.evaluate(`JSON.parse(sessionStorage.getItem('membership-A')).scheduledTierId`), null, 'successful renewal consumes the scheduled change');
});

await scenario('scheduled downgrade to a free tier takes effect at expiry without checkout', { role: 'member', authenticated: true, organisation: 'A', downgradeFixture: true }, '/member/membership?organisation=A', async browser => {
  await browser.waitFor(`document.querySelector('[aria-label="Downgrade to A Free"]')`, 'free downgrade choice');
  await browser.clickSelector('[aria-label="Downgrade to A Free"]');
  await browser.clickText('Confirm downgrade');
  await browser.waitFor(browser.bodyHas('Your free membership will begin'), 'free downgrade scheduled');
  assert.equal(await browser.evaluate(`document.querySelector('[aria-label="Membership badge"]').textContent.includes('A Premium')`), true, 'paid pass stays available before expiry');
  await browser.evaluate(`(() => { const saved = JSON.parse(sessionStorage.getItem('membership-A')); saved.expirationDate = new Date(Date.now() - 60000).toISOString(); saved.scheduledTierEffectiveAt = saved.expirationDate; sessionStorage.setItem('membership-A', JSON.stringify(saved)); })()`);
  await browser.call('Page.reload');
  await browser.waitFor(`document.querySelector('[aria-label="Membership badge"]')?.textContent.includes('A Free') && ${browser.bodyHas('No renewal required')}`, 'free tier applied after the paid period');
  assert.equal(await browser.evaluate(`window.__navigationQa.requests.some(request => request.path.startsWith('/payments/'))`), false, 'free downgrade never starts payment');
  assert.equal(await browser.evaluate(`JSON.parse(sessionStorage.getItem('membership-A')).scheduledTierId`), null);
});

await scenario('subscription cancellation removes a scheduled downgrade and prevents a new one until resumed', { role: 'member', authenticated: true, organisation: 'A', downgradeFixture: true }, '/member/membership?organisation=A', async browser => {
  await browser.waitFor(`document.querySelector('[aria-label="Downgrade to A Community"]')`, 'downgrade choice');
  await browser.clickSelector('[aria-label="Downgrade to A Community"]');
  await browser.clickText('Confirm downgrade');
  await browser.waitFor(browser.bodyHas('Cancel scheduled downgrade'), 'pending downgrade');
  assert.equal(await browser.evaluate(browser.bodyHas('Completing an upgrade will replace your scheduled downgrade.')), true);
  await browser.clickText('Cancel subscription');
  await browser.waitFor(browser.bodyHas('Cancelling your subscription also removes the scheduled downgrade.'), 'cancellation explains its effect on downgrade');
  await browser.clickText('Confirm cancellation');
  await browser.waitFor(`${browser.bodyHas('Keep my membership')} && !document.querySelector('[aria-label="Scheduled membership downgrade"]')`, 'cancellation clears the downgrade');
  assert.equal(await browser.evaluate(`!!document.querySelector('[aria-label="Downgrade to A Community"]')`), false, 'a cancelled renewal cannot be scheduled to downgrade');
  await browser.clickText('Keep my membership');
  await browser.waitFor(`document.querySelector('[aria-label="Downgrade to A Community"]')`, 'resuming enables downgrade choices');
});

await scenario('scheduled downgrades are organisation scoped and unavailable targets do not silently renew the old tier', { role: 'member', authenticated: true, organisation: 'A', downgradeFixture: true }, '/member/membership?organisation=B', async browser => {
  await browser.waitFor(`document.querySelector('[aria-label="Downgrade to B Community"]')`, 'Beta downgrade options');
  assert.equal(await browser.evaluate(`!!document.querySelector('[aria-label="Downgrade to A Community"]')`), false);
  await browser.clickSelector('[aria-label="Downgrade to B Community"]');
  await browser.clickText('Confirm downgrade');
  await browser.waitFor(browser.bodyHas('Cancel scheduled downgrade'), 'Beta downgrade scheduled');
  const request = await browser.evaluate(`window.__navigationQa.requests.find(item => item.path === '/members/membership/downgrade')`);
  assert.deepEqual(request.payload, { organisationId: 'B', tierId: 'B-tier' });
  assert.equal(await browser.evaluate(`sessionStorage.getItem('membership-A')`), null, 'Alpha membership remains unchanged');
  await browser.evaluate(`(() => { const saved = JSON.parse(sessionStorage.getItem('membership-B')); saved.scheduledTierId = 'B-missing'; saved.expirationDate = new Date(Date.now() - 60000).toISOString(); saved.scheduledTierEffectiveAt = saved.expirationDate; saved.status = 'expired'; sessionStorage.setItem('membership-B', JSON.stringify(saved)); const user = JSON.parse(localStorage.getItem('navigation-qa-user')); user.membershipStatus = 'expired'; localStorage.setItem('navigation-qa-user', JSON.stringify(user)); })()`);
  await browser.call('Page.reload');
  await browser.waitFor(browser.bodyHas('Scheduled tier unavailable'), 'missing scheduled target warning');
  assert.equal(await browser.evaluate(`!![...document.querySelectorAll('button')].find(button => button.textContent === 'Renew membership')`), false, 'old expensive membership is not silently offered for renewal');
  assert.equal(await browser.evaluate(`window.__navigationQa.requests.some(request => request.path.startsWith('/payments/'))`), false);
  await browser.clickText('Cancel scheduled downgrade');
  await browser.waitFor(browser.bodyHas('Renew membership'), 'member can explicitly cancel an unavailable change and renew the old tier');
});

await scenario('event lifecycle admin creation requires a later date and shows ended events', { role: 'owner', authenticated: true, organisation: 'A', eventLifecycleFixture: true }, '/admin/events?organisation=A', async browser => {
  await browser.waitFor(browser.bodyHas('A Boundary Briefing'), 'event statuses loaded');
  assert.equal(await browser.evaluate(`(() => { const rows = [...document.querySelectorAll('tr')]; return rows.some(row => row.textContent.includes('A Past Gathering') && row.textContent.includes('Ended')) && rows.some(row => row.textContent.includes('A Ongoing Weekend') && row.textContent.includes('In progress')); })()`), true);
  await browser.clickText('Create New Event');
  await browser.waitFor(`document.querySelector('#event-start-date')`, 'event form');
  const dates = await browser.evaluate(`(() => { const today = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(part=>[part.type,part.value])); const date = today.year+'-'+today.month+'-'+today.day; return {today:date,tomorrow:new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10)}; })()`);
  assert.equal(await browser.evaluate(`document.querySelector('#event-start-date').min`), dates.tomorrow);
  assert.equal(await browser.evaluate(`document.querySelector('#event-start-date').value`), dates.tomorrow);
  await browser.fill('#event-start-date', dates.today);
  await browser.waitFor(browser.bodyHas('Choose tomorrow or a later date'), 'today rejected in form');
  assert.equal(await browser.evaluate(`document.querySelector('form button[type="submit"]').disabled`), true);
  assert.equal(await browser.evaluate(`window.__navigationQa.requests.some(request=>request.path==='/events'&&request.method==='POST')`), false);
  await browser.fill('#event-start-date', dates.tomorrow);
  await browser.waitFor(`!document.querySelector('form button[type="submit"]').disabled`, 'future date accepted');
  await browser.clickText('Cancel');
  await browser.waitFor(`!document.querySelector('#event-start-date')`, 'close event form');
  await browser.evaluate(`(() => { const NativeDate = Date; window.__eventClock = window.__navigationQa.eventBoundary.end - NativeDate.now(); window.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [NativeDate.now()+window.__eventClock])); } static now() {return NativeDate.now()+window.__eventClock;} }; window.dispatchEvent(new Event('focus')); })()`);
  await browser.waitFor(`(() => { const row = [...document.querySelectorAll('tr')].find(row=>row.textContent.includes('A Boundary Briefing')); return row?.textContent.includes('Ended'); })()`, 'admin status changes without reload');
});

await scenario('event lifecycle member RSVP closes at start and ended status updates live', { role: 'member', authenticated: true, organisation: 'A', eventLifecycleFixture: true }, '/member/events?organisation=A', async browser => {
  await browser.waitFor(browser.bodyHas('A Boundary Briefing'), 'member events loaded');
  const selector = `(() => { const title = [...document.querySelectorAll('h3')].find(node=>node.textContent.trim()==='A Boundary Briefing'); return title.closest('div.rounded-xl'); })()`;
  assert.equal(await browser.evaluate(`(() => { const card = ${selector}; return [...card.querySelectorAll('button')].some(button=>button.textContent.includes('RSVP Directly')&&!button.disabled); })()`), true);
  assert.equal(await browser.evaluate(browser.bodyHas('Event ended · RSVPs closed')), true);
  assert.equal(await browser.evaluate(browser.bodyHas('Event started · RSVPs closed')), true);
  await browser.evaluate(`(() => { const NativeDate = Date; window.__eventNativeDate = NativeDate; window.__eventClock = window.__navigationQa.eventBoundary.start - NativeDate.now(); window.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [NativeDate.now()+window.__eventClock])); } static now() {return NativeDate.now()+window.__eventClock;} }; window.dispatchEvent(new Event('focus')); })()`);
  await browser.waitFor(`(() => { const card=${selector}; return card.textContent.includes('Event started · RSVPs closed') && ![...card.querySelectorAll('button')].some(button=>button.textContent.includes('RSVP Directly')); })()`, 'RSVP closes at start');
  await browser.evaluate(`window.__eventClock = window.__navigationQa.eventBoundary.end - window.__eventNativeDate.now(); window.dispatchEvent(new Event('focus'));`);
  await browser.waitFor(`(() => {const card=${selector};return card.textContent.includes('Event ended · RSVPs closed');})()`, 'event ends while member portal remains open');
  assert.equal(await browser.evaluate(`window.__navigationQa.requests.some(request=>request.path.includes('/rsvp')&&request.method==='POST')`), false);
  await browser.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  await browser.screenshot('event-lifecycle-member-mobile');
});

await scenario('admin cancelled status follows member cancellation and refresh', { role: 'owner', authenticated: true, organisation: 'A', adminCancellationFixture: true }, '/admin/members?organisation=A', async browser => {
  await browser.waitFor(browser.bodyHas('A Paid Cancellation'), 'cancellation rows loaded');
  const rows = await browser.evaluate(`(() => [...document.querySelectorAll('tbody tr')].map(row => ({ text: row.textContent, approve: [...row.querySelectorAll('button')].some(button => button.textContent.trim() === 'Approve') })))()`);
  for (const name of ['A Paid Cancellation', 'A Free Cancellation', 'A Ended Cancellation']) {
    const row = rows.find(item => item.text.includes(name));
    assert.ok(row.text.includes('Cancelled'));
    assert.equal(row.approve, false, 'Admin cannot silently undo the member cancellation');
  }
  assert.ok(rows.find(item => item.text.includes('A Paid Cancellation')).text.includes('Access until 2099-01-01'));
  assert.ok(rows.find(item => item.text.includes('A Free Cancellation')).text.includes('Membership access ended'));
  await browser.evaluate(`(() => { const select = document.querySelector('[aria-label="Filter members by status"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'cancelled'); select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await browser.waitFor(`new URLSearchParams(location.search).get('status') === 'cancelled' && document.querySelectorAll('tbody tr').length === 3`, 'cancelled filter');
  await browser.call('Page.reload');
  await browser.waitFor(`document.querySelectorAll('tbody tr').length === 3`, 'cancelled filter persists');
  await browser.call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await browser.screenshot('admin-cancelled-members');
  await browser.evaluate(`(() => { const rows = [
    { _id:'A-paid-cancelled',name:'A Paid Cancellation',status:'active',tierName:'Community',membershipNumber:'MEM-A',cancelAtPeriodEnd:false },
    { _id:'A-free-cancelled',name:'A Free Cancellation',status:'cancelled',cancellationScheduled:false },
    { _id:'A-ended-cancelled',name:'A Ended Cancellation',status:'cancelled',cancellationScheduled:false }
  ]; sessionStorage.setItem('admin-cancellations-A', JSON.stringify(rows)); window.dispatchEvent(new Event('focus')); })()`);
  await browser.waitFor(`document.querySelectorAll('tbody tr').length === 2 && !${browser.bodyHas('A Paid Cancellation')}`, 'undo cancellation updates the filtered directory');
  await browser.evaluate(`history.back()`);
  await browser.waitFor(`!new URLSearchParams(location.search).get('status') && ${browser.bodyHas('A Paid Cancellation')}`, 'Back restores all statuses');
  assert.equal(await browser.evaluate(`(() => { const row = [...document.querySelectorAll('tbody tr')].find(item => item.textContent.includes('A Paid Cancellation')); return row.textContent.includes('Active') && !row.textContent.includes('Cancelled'); })()`), true);
  await browser.clickText('Refresh members');
  await browser.waitFor(browser.bodyHas('A Paid Cancellation'), 'manual refresh');
});

console.log(JSON.stringify({ passed: results.filter(result => result.status === 'passed').length, total: results.length, results }, null, 2));
if (results.some(result => result.status === 'failed')) process.exitCode = 1;
