// Standalone browser smoke test; no npm packages or live backend are needed.
// Start Vite and a separate headless Chrome with --remote-debugging-port=9333
// and --user-data-dir pointing to an OS temporary directory,
// then run: node --experimental-websocket tests/navigation-browser.mjs
// Optional arguments: application origin, Chrome debugging origin.
import assert from 'node:assert/strict';

const appOrigin = process.argv[2] || 'http://127.0.0.1:5173';
const debugOrigin = process.argv[3] || 'http://127.0.0.1:9333';
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const results = [];

function installMocks({ role, authenticated, organisation }) {
  const organisations = [
    { _id: 'A', name: 'Alpha Community', adminId: 'qa-account', description: 'Alpha navigation fixture', category: 'Technology & AI', location: 'Malaysia', isPublic: true, visibility: 'public', memberCount: 1, tags: [] },
    { _id: 'B', name: 'Beta Community', adminId: 'qa-account', description: 'Beta navigation fixture', category: 'Technology & AI', location: 'Malaysia', isPublic: true, visibility: 'public', memberCount: 1, tags: [] },
  ];
  const makeUser = id => ({
    _id: 'qa-account', name: 'Navigation Tester', firstName: 'Navigation', email: 'qa@example.test',
    emailVerified: true, onboardingCompleted: true, organisationRole: role, activeOrganisationId: id,
    activeOrganisation: organisations.find(item => item._id === id),
    ownedOrganisations: role === 'owner' ? organisations : [],
    memberships: role === 'owner' ? [] : organisations.map(item => ({ organisationId: item._id, status: 'active' })),
    membershipStatus: 'active', status: 'active', tierId: `${id}-tier`, tierName: `${id} Community`, country: 'Malaysia',
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
  window.__navigationQa = { requests: [], unexpectedMutations: [], deferredTierSaves: [], deferTierSaves: false };
  const realFetch = window.fetch.bind(window);
  const reply = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
  const tier = id => ({ _id: `${id}-tier`, organisationId: id, name: `${id} Community`, price: 10, interval: 'monthly', description: 'Navigation fixture', perks: [], accessLevel: 1 });
  const member = id => ({ _id: `${id}-member`, name: `${id} Directory Member`, email: `${id}@example.test`, membershipNumber: `MEM-${id}`, tierId: `${id}-tier`, tierName: `${id} Community`, status: 'active' });
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
    window.__navigationQa.requests.push({ path, method, organisation: id, url: location.pathname + location.search });
    if (path === '/auth/google/config') return reply({ enabled: false });
    if (path === '/auth/me') return reply({ success: true, user });
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
    if (path === '/tiers') return reply({ success: true, tiers: [tier(id)] });
    if (path === '/admin/members') return reply({ success: true, members: [member(id)], pagination: { page: 1, limit: 8, totalMembers: 1, totalPages: 1, hasPrevPage: false, hasNextPage: false } });
    if (path.startsWith('/admin/members/')) return reply({ success: true, member: member(id) });
    if (path === '/admin/financial-summary') return reply({ success: true, metrics: {} });
    if (path === '/admin/dashboard-analytics') return reply({ success: true, summary: {}, demographics: {}, membershipTrend: [], paymentTrend: [], revenueTrend: [] });
    if (path === '/members/invoices') return reply({ success: true, invoices: [{ _id: 'receipt-1', invoiceNumber: 'QA-RECEIPT-001', userName: user.name, userEmail: user.email, tierName: 'Community', paymentStatus: 'paid', paymentMethod: 'Fixture', amount: 10, createdAt: '2026-10-01T00:00:00Z', paidAt: '2026-10-01T00:00:00Z' }] });
    if (path === '/events') return reply({ success: true, events: [] });
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
      if (await evaluate(expression)) return;
      await pause(80);
    }
    const state = await evaluate('({ url: location.href, text: document.body.innerText.slice(0, 2400), requests: window.__navigationQa?.requests })');
    throw new Error(`Timed out: ${label}\n${JSON.stringify(state, null, 2)}\n${exceptions.join('\n')}`);
  };
  const clickText = async text => {
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
  const bodyHas = text => `Boolean(document.body?.textContent.includes(${JSON.stringify(text)}))`;
  return { call, evaluate, waitFor, clickText, fill, bodyHas, exceptions, socket };
}

async function scenario(name, config, path, run) {
  const target = await (await fetch(`${debugOrigin}/json/new?about:blank`, { method: 'PUT' })).json();
  const browser = await connect(target);
  try {
    await browser.call('Runtime.enable');
    await browser.call('Page.enable');
    await browser.call('Page.addScriptToEvaluateOnNewDocument', { source: `(${installMocks})(${JSON.stringify(config)})` });
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
  await browser.waitFor(browser.bodyHas('Create Custom Tier'), 'tier list');
  await browser.clickText('Create Custom Tier');
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
  await browser.waitFor(browser.bodyHas('Adjust Membership Tier'), 'direct member tier editor');
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

await scenario('renewal checkout URL follows browser Back/Forward', { role: 'member', authenticated: true, organisation: 'A' }, '/member/invoices?organisation=A', async browser => {
  await browser.waitFor(browser.bodyHas('Payment Invoices & Receipts'), 'member invoice page');
  await browser.clickText('Renew Membership');
  await browser.waitFor(`new URLSearchParams(location.search).get('renew') === '1' && ${browser.bodyHas('Membership Checkout')}`, 'renewal checkout URL');
  await browser.evaluate('history.back()');
  await browser.waitFor(`!new URLSearchParams(location.search).has('renew') && !${browser.bodyHas('Membership Checkout')}`, 'Back closes renewal checkout');
  await browser.evaluate('history.forward()');
  await browser.waitFor(browser.bodyHas('Membership Checkout'), 'Forward reopens renewal checkout');
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

console.log(JSON.stringify({ passed: results.filter(result => result.status === 'passed').length, total: results.length, results }, null, 2));
if (results.some(result => result.status === 'failed')) process.exitCode = 1;
