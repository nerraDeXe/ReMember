import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const outputDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(outputDirectory, '../../..');
const reportPath = resolve(root, 'docs/INTEGRATION_TEST_CASES.md');
const cases = [
  {
    id: 'IT-01', title: 'Email Verification', file: 'backend/tests/auth.test.js',
    name: 'a delivered code confirms email, removes its hash, and permits verified actions',
    expected: 'A valid email code verifies the account and permits protected actions.',
    scope: 'Real HTTP, authentication router, JWT middleware, validation and verification logic; database and email delivery mocked.'
  },
  {
    id: 'IT-02', title: 'Secure Payment Checkout', file: 'backend/tests/payment-gateway.test.js',
    name: 'Gateway routes derive identity and price on the server and discard card credentials',
    expected: 'Demo payment records RM49 at the server price and discards credentials.',
    scope: 'Real HTTP, payment router, JWT middleware, organisation context and payment service; database, transaction session and email delivery mocked.'
  },
  {
    id: 'IT-03', title: 'Organisation Permissions', file: 'backend/tests/auth.test.js',
    name: 'admin permissions require verified ownership in the selected organisation',
    expected: 'Only a verified owner of the selected organisation can access owner actions.',
    scope: 'Real HTTP, authentication router, JWT middleware, organisation context and ownership checks; database and email delivery mocked.'
  }
];

mkdirSync(outputDirectory, { recursive: true });
for (const destination of [reportPath, ...cases.flatMap(item => ['txt', 'json', 'html'].map(extension => resolve(outputDirectory, `${item.id}.${extension}`)))]) {
  if (existsSync(destination)) throw new Error(`Refusing to overwrite existing artifact: ${destination}`);
}

const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const writeNew = (path, content) => writeFileSync(path, content, { encoding: 'utf8', flag: 'wx' });

for (const item of cases) {
  const sourceLines = readFileSync(resolve(root, item.file), 'utf8').split(/\r?\n/);
  const start = sourceLines.findIndex(line => line.startsWith(`test('${item.name}'`));
  if (start < 0) throw new Error(`Source test not found: ${item.name}`);
  const endOffset = sourceLines.slice(start + 1).findIndex(line => line === '});');
  if (endOffset < 0) throw new Error(`Source test ending not found: ${item.name}`);
  const end = start + 1 + endOffset;
  item.sourceStart = start + 1;
  item.sourceEnd = end + 1;
  item.source = sourceLines.slice(start, end + 1).join('\n');
  const args = ['--test', '--test-reporter=tap', `--test-name-pattern=^${escapeRegex(item.name)}$`, item.file];
  item.command = `node --test --test-reporter=tap --test-name-pattern="^${escapeRegex(item.name)}$" ${item.file}`;
  const execution = spawnSync(process.execPath, args, {
    cwd: root, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    timeout: 30_000, encoding: 'utf8', windowsHide: true, maxBuffer: 2 * 1024 * 1024
  });
  const stdout = execution.stdout || '';
  const stderr = execution.stderr || '';
  const raw = `Command: ${item.command}\nExit code: ${execution.status}\n\nSTDOUT\n${stdout}\nSTDERR\n${stderr}${execution.error ? `\nRUNNER ERROR\n${execution.error.stack}\n` : ''}`;
  writeNew(resolve(outputDirectory, `${item.id}.txt`), raw);
  const pass = Number(stdout.match(/^# pass (\d+)\s*$/m)?.[1] ?? -1);
  const fail = Number(stdout.match(/^# fail (\d+)\s*$/m)?.[1] ?? -1);
  const skipped = Number(stdout.match(/^# skipped (\d+)\s*$/m)?.[1] ?? 0);
  const matchingOk = stdout.split(/\r?\n/).find(line => new RegExp(`^ok \\d+ - ${escapeRegex(item.name)}$`).test(line));
  item.status = execution.status === 0 && pass === 1 && fail === 0 && Boolean(matchingOk) && !execution.error ? 'PASS' : 'FAIL';
  const tapLines = stdout.split(/\r?\n/);
  const selectedStart = tapLines.findIndex(line => line === `# Subtest: ${item.name}`);
  let selectedEnd = selectedStart + 1;
  while (selectedEnd < tapLines.length && !/^# Subtest: |^1\.\./.test(tapLines[selectedEnd])) selectedEnd++;
  const selectedBlock = selectedStart >= 0 ? tapLines.slice(selectedStart, selectedEnd).join('\n').trimEnd() : 'Selected test output was not found. Inspect the raw log.';
  const summary = tapLines.filter(line => /^# (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms) /.test(line)).join('\n');
  item.execution = { executedAt: new Date().toISOString(), nodeVersion: process.version, exitCode: execution.status, signal: execution.signal, pass, fail, skipped, selectedTestMatched: Boolean(matchingOk), error: execution.error?.message ?? null };
  writeNew(resolve(outputDirectory, `${item.id}.json`), JSON.stringify(item, null, 2) + '\n');
  const numberedSource = sourceLines.slice(start, end + 1).map((line, index) => `<div class="source-line"><span class="line-number">${start + index + 1}</span><code>${escapeHtml(line) || ' '}</code></div>`).join('\n');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${item.id} - ${item.title}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#fff;color:#18212f;font:16px/1.45 Arial,sans-serif}.page{max-width:1400px;margin:auto;padding:30px 36px 28px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #d7dfe8;padding-bottom:15px;margin-bottom:14px}h1{font-size:27px;line-height:1.2;margin:3px 0 0}.eyebrow{font-size:13px;color:#536174;letter-spacing:1px}.status{font-weight:bold;font-size:22px;padding:9px 20px;border:2px solid ${item.status === 'PASS' ? '#167149' : '#b42318'};color:${item.status === 'PASS' ? '#167149' : '#b42318'};border-radius:5px}.scope{font-size:14px;color:#536174;margin:10px 0}.label{font-size:14px;font-weight:bold;margin:14px 0 6px}.command,pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:0;font:14px/1.45 Consolas,monospace}.command{padding:10px 12px;background:#f4f6f8;border:1px solid #dde3e9}.source{background:#f8fafc;border:1px solid #d9e0e8;padding:10px 0}.source-line{display:flex;font:15px/1.42 Consolas,monospace;min-height:21px}.line-number{flex:0 0 48px;padding-right:10px;text-align:right;color:#7b8795;user-select:none}.source-line code{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;min-width:0;flex:1;padding-right:10px}.result{border:1px solid #d9e0e8;background:#fcfdfd;padding:12px}.result-grid{display:grid;grid-template-columns:1fr 245px;gap:22px}.note{font-size:13px;color:#536174;margin:8px 0 0}a{color:#175caa}.outcome{margin-top:16px;font-size:16px}.timestamp{font-size:12px;color:#68778a;margin-top:12px}
</style></head><body><main class="page">
<header><div><div class="eyebrow">ReMember · Integration Test ${item.id}</div><h1>${escapeHtml(item.title)}</h1></div><div class="status">${item.status}</div></header>
<p class="scope">${escapeHtml(item.scope)}</p>
<div class="label">Executed command</div><div class="command">${escapeHtml(item.command)}</div>
<div class="label">Exact test code · ${escapeHtml(item.file)}:${item.sourceStart}–${item.sourceEnd}</div>
<div class="source">${numberedSource}</div>
<div class="label">Actual test output · Node ${escapeHtml(process.version)} · Exit ${execution.status}</div>
<div class="result"><div class="result-grid"><pre>${escapeHtml(selectedBlock)}</pre><pre>${escapeHtml(summary)}</pre></div><p class="note">Only the named test was selected; unrelated tests were skipped. <a href="${item.id}.txt">Full raw stdout and stderr</a></p></div>
<p class="outcome"><strong>Expected outcome:</strong> ${escapeHtml(item.expected)}</p>
<div class="timestamp">Executed ${escapeHtml(item.execution.executedAt)} · Mocked storage and email; no live database or external delivery was tested.</div>
</main></body></html>`;
  writeNew(resolve(outputDirectory, `${item.id}.html`), html);
  console.log(`${item.id}: ${item.status} (pass=${pass}, fail=${fail}, skipped=${skipped}, exit=${execution.status}) ${resolve(outputDirectory, `${item.id}.html`)}`);
}

const markdown = `These integration cases were executed with real HTTP requests. Database persistence and email delivery were mocked; the payment case also mocks database transactions. Screenshots show the exact existing test code and captured results.\n\n${cases.map(item => `1. **Test Case Title:** ${item.title}\n2. **Screenshot of Test + Code:**\n\n   ![${item.id}: ${item.title}, test code and results](testing/integration/${item.id}.png)\n\n   [Code](../${item.file}#L${item.sourceStart}) · [Evidence page](testing/integration/${item.id}.html) · [Raw output](testing/integration/${item.id}.txt)\n\n3. **Expected outcome:** ${item.expected}\n4. **Test Status:** ${item.status}`).join('\n\n---\n\n')}\n`;
writeNew(reportPath, markdown);
console.log(`Report: ${reportPath}`);
if (cases.some(item => item.status !== 'PASS')) process.exitCode = 1;
