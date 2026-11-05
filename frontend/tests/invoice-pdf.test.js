import assert from 'node:assert/strict';
import test from 'node:test';
import { createInvoicePdf, invoicePdfFilename } from '../src/invoicePdf.js';

const invoice = {
  invoiceNumber: 'INV-2026-0042',
  organisationName: 'Community Club',
  userName: 'Aisha Tan',
  userEmail: 'aisha@example.com',
  tierName: 'Supporter',
  billingInterval: 'yearly',
  amount: 90,
  currency: 'MYR',
  subtotalCents: 12000,
  creditCents: 3000,
  carryForwardCents: 1500,
  paymentMethod: 'Card',
  paymentStatus: 'paid',
  transactionId: 'TXN-0042',
  createdAt: '2026-11-04T04:00:00Z',
  paidAt: '2026-11-04T04:05:00Z',
  periodStart: '2026-11-04T00:00:00Z',
  periodEnd: '2027-11-04T00:00:00Z',
};

// Inspect the uncompressed drawing commands even when the saved PDF is compressed.
const pageContent = doc => doc.internal.pages.slice(1).flat().join('\n');

test('Invoice export produces a real PDF with payment details and credited totals', async () => {
  const doc = await createInvoicePdf(invoice);
  assert.match(doc.output(), /^%PDF-1\./);
  assert.equal(doc.getNumberOfPages(), 1);

  const content = pageContent(doc);
  for (const value of [
    'ReMember Club', 'INV-2026-0042', 'Community Club', 'Aisha Tan',
    'aisha@example.com', 'Supporter', 'yearly', 'Card', 'TXN-0042',
    'MYR 120.00', 'MYR 30.00', 'MYR 90.00', 'MYR 15.00',
  ]) {
    assert.ok(content.includes(value), `PDF includes ${value}`);
  }
  assert.match(content, /subtotal/i);
  assert.match(content, /credit/i);
  assert.match(content, /total paid/i);
  for (const label of ['Issue date', 'Date paid', 'Coverage start', 'Coverage end']) {
    assert.ok(content.includes(label), `PDF includes ${label}`);
  }
  assert.match(content, /2027/);
  assert.doesNotMatch(content, /no money (?:was )?charged/i);
});

test('Pending and failed invoices do not label their amount as paid', async () => {
  for (const paymentStatus of ['pending', 'failed']) {
    const doc = await createInvoicePdf({ ...invoice, paymentStatus, paidAt: undefined });
    const content = pageContent(doc);
    assert.match(content.toLowerCase(), new RegExp(paymentStatus));
    assert.ok(content.includes('MYR 90.00'));
    assert.doesNotMatch(content, /total paid/i);
  }
});

test('Legacy invoices without credit fields retain their original amount', async () => {
  const content = pageContent(await createInvoicePdf({
    ...invoice, amount: 49.5, subtotalCents: undefined, creditCents: undefined, carryForwardCents: undefined,
  }));
  assert.ok(content.includes('MYR 49.50'));
  assert.doesNotMatch(content, /NaN|undefined|Invalid Date|MYR 120\.00|MYR 30\.00|MYR 15\.00/);
});

test('Every supported demo marker identifies that no money was charged', async () => {
  for (const marker of [{ simulated: true }, { isSimulated: true }, { paymentMethod: 'Payment gateway (demo)' }]) {
    const content = pageContent(await createInvoicePdf({ ...invoice, ...marker }));
    assert.match(content, /no money (?:was )?charged/i);
  }
});

test('Long invoice details flow onto additional PDF pages without dropping totals', async () => {
  const doc = await createInvoicePdf({ ...invoice, userName: 'Long member name '.repeat(500) });
  assert.ok(doc.getNumberOfPages() > 1);
  const content = pageContent(doc);
  assert.ok(content.includes('aisha@example.com'));
  assert.ok(content.includes('MYR 90.00'));
  assert.match(content, /total paid/i);
});

test('Invoice filenames use the invoice number and exclude unsafe path characters', () => {
  assert.equal(invoicePdfFilename(invoice), 'INV-2026-0042.pdf');
  assert.equal(invoicePdfFilename({}), 'invoice.pdf');
  const filename = invoicePdfFilename({ invoiceNumber: '../INV\\2026:\n0042?*<>|"' });
  assert.ok(filename.endsWith('.pdf'));
  assert.doesNotMatch(filename, /[<>:"/\\|?*]/);
  assert.ok([...filename].every(character => character.charCodeAt(0) >= 32));
});
