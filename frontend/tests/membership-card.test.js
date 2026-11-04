import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const result = await build({
  entryPoints: [fileURLToPath(new URL('../src/components/MembershipCard.jsx', import.meta.url))],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  mainFields: ['module', 'main'],
  plugins: [{
    name: 'external-react',
    setup(builder) {
      builder.onResolve({ filter: /^react$/ }, args => ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }));
    },
  }],
});
const { default: MembershipCard } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const member = {
  name: 'Aisha Tan', membershipNumber: 'MEM-2026-1234', tierName: 'Supporter', status: 'active',
  joinedDate: '2026-01-15T12:00:00Z', expirationDate: '2027-01-15T12:00:00Z',
  organisation: { name: 'Community A', badgeColor: '#123456' },
};
const render = changes => renderToStaticMarkup(React.createElement(MembershipCard, { user: { ...member, ...changes } }));

test('Membership card displays membership details without external links or controls', () => {
  const html = render();
  for (const text of ['Membership Card', 'Community A', 'Aisha Tan', 'MEM-2026-1234', 'Supporter', 'Active', 'Jan 15, 2026', 'Jan 15, 2027']) {
    assert.ok(html.includes(text), `Card includes ${text}`);
  }
  assert.match(html, /background-color:#123456;color:#ffffff/);
  assert.doesNotMatch(html, /<a\b|<button\b|Google|Wallet|Synced|Verified|QR|barcode/i);
});

test('Card uses the selected membership organisation and handles perpetual memberships without placeholder credentials', () => {
  const html = render({
    organisation: { name: 'Community B', badgeColor: '#ffffff' },
    activeOrganisation: member.organisation,
    tierName: 'Community', expirationDate: null, joinedDate: null, membershipNumber: null,
  });
  for (const text of ['Community B', 'Community', 'Perpetual Access', 'Not recorded', 'Member ID unavailable']) assert.ok(html.includes(text));
  assert.match(html, /background-color:#ffffff;color:#000000/);
  assert.doesNotMatch(html, /Community A|Supporter|MEM-2026-0000|Invalid Date/);
});
