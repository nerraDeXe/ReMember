import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const result = await build({
  entryPoints: [fileURLToPath(new URL('../src/components/EventSchedule.jsx', import.meta.url))],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  plugins: [{
    name: 'external-react',
    setup(builder) {
      builder.onResolve({ filter: /^(react|lucide-react)$/ }, args => ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }));
    },
  }],
});
const { default: EventSchedule, EventLocation } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const renderSchedule = (event, compact = false) => renderToStaticMarkup(React.createElement(EventSchedule, { event, compact }));

test('A multi-day schedule keeps each day and its separate times accessible in compact cards', () => {
  const html = renderSchedule({
    startDate: '2027-02-01', endDate: '2027-02-04', timeZone: 'Asia/Kuala_Lumpur',
    schedule: [
      { date: '2027-02-01', startTime: '09:00', endTime: '12:00' },
      { date: '2027-02-02', startTime: '10:00', endTime: '13:00' },
      { date: '2027-02-03', startTime: '11:00', endTime: '14:00' },
      { date: '2027-02-04', startTime: '12:00', endTime: '15:00' },
    ],
  }, true);
  for (const value of ['1 Feb 2027', '4 Feb 2027', '09:00', '12:00', '10:00', '13:00', '11:00', '14:00', '15:00', 'Asia/Kuala Lumpur']) assert.ok(html.includes(value), value);
  assert.match(html, /<details[^>]*><summary[^>]*>View 1 more day<\/summary>/);
  assert.match(html, /<time dateTime="2027-02-04"/);
  assert.equal((html.match(/<li /g) || []).length, 4);
});

test('Single-day events display start and end times and legacy events retain their original zone', () => {
  const structured = renderSchedule({ startDate: '2027-02-01', endDate: '2027-02-01', schedule: [{ date: '2027-02-01', startTime: '09:30', endTime: '17:45' }] });
  assert.match(structured, /09:30/);
  assert.match(structured, /17:45/);
  assert.match(structured, /Times in Asia\/Kuala Lumpur/);
  assert.doesNotMatch(structured, /<details/);
  const legacy = renderSchedule({ date: '2027-02-01', time: '18:00 - 21:00 EST' });
  assert.match(legacy, /18:00 - 21:00 EST/);
  assert.doesNotMatch(legacy, /Times in|Kuala/);
});

test('Locations open Google Maps using encoded text and an optional place ID', () => {
  const location = 'Hall & Garden <North> "A"';
  const html = renderToStaticMarkup(React.createElement(EventLocation, { event: { location, locationPlaceId: 'ChIJhall_123' } }));
  const href = html.match(/href="([^"]+)"/)[1].replaceAll('&amp;', '&');
  const url = new URL(href);
  assert.equal(url.origin, 'https://www.google.com');
  assert.equal(url.searchParams.get('query'), location);
  assert.equal(url.searchParams.get('query_place_id'), 'ChIJhall_123');
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /Hall &amp; Garden &lt;North&gt; &quot;A&quot;/);
  assert.doesNotMatch(html, /<North>/);
});

test('Selected OpenStreetMap locations keep their exact coordinates and attribution', () => {
  const html = renderToStaticMarkup(React.createElement(EventLocation, { event: { location: 'Convention Centre', locationLatitude: 3.153, locationLongitude: 101.713 } }));
  const href = html.match(/href="([^"]+)"/)[1].replaceAll('&amp;', '&');
  assert.equal(new URL(href).searchParams.get('query'), '3.153,101.713');
  assert.match(html, /OpenStreetMap contributors/);
  assert.match(html, /https:\/\/www.openstreetmap.org\/copyright/);
});
