// Capture the generated evidence pages in a dedicated headless Chrome session.
// Run from the repository root after generate-report.mjs:
// node --experimental-websocket docs/testing/integration/capture-screenshots.mjs
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const profile = await mkdtemp(join(tmpdir(), 'remember-integration-evidence-'));
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--disable-extensions',
  '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
  '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
  `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let browserError;
browser.once('error', error => { browserError = error; });
let diagnostics = '';
browser.stderr.on('data', data => { diagnostics += data; });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket, call;

try {
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (browserError) throw browserError;
    endpoint = diagnostics.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];
    if (endpoint) break;
    if (browser.exitCode !== null) throw new Error(`Chrome exited: ${browser.exitCode}\n${diagnostics}`);
    await pause(100);
  }
  if (!endpoint) throw new Error(`Chrome did not expose DevTools. ${diagnostics.slice(-2000)}`);
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let serial = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timeout);
    message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
  });
  call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++serial;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 10000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  const pageCall = (method, params = {}) => call(method, params, sessionId);
  await pageCall('Page.enable');
  await pageCall('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false });
  for (const id of ['IT-01', 'IT-02', 'IT-03']) {
    await pageCall('Page.navigate', { url: pathToFileURL(join(directory, `${id}.html`)).href });
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = await pageCall('Runtime.evaluate', {
        expression: `document.readyState === 'complete' && location.pathname.endsWith('/${id}.html')`,
        returnByValue: true,
      });
      if (result.result.value) { ready = true; break; }
      await pause(50);
    }
    if (!ready) throw new Error(`Evidence page did not load: ${id}`);
    await pageCall('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });
    const { cssContentSize } = await pageCall('Page.getLayoutMetrics');
    const result = await pageCall('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: 1440, height: Math.ceil(cssContentSize.height), scale: 1 },
    });
    await writeFile(join(directory, `${id}.png`), Buffer.from(result.data, 'base64'));
    console.log(`${id}.png: 1440 x ${Math.ceil(cssContentSize.height)}`);
  }
} finally {
  if (socket?.readyState === WebSocket.OPEN && call) {
    await call('Browser.close').catch(() => {});
    socket.close();
  }
  if (browser.exitCode === null) browser.kill();
}
