const MARGIN = 48;

const textValue = (value, fallback = 'N/A') => String(value ?? '').trim() || fallback;
const numberValue = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const dateValue = value => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'N/A';
};

export function invoicePdfFilename(invoice) {
  const name = textValue(invoice.invoiceNumber, 'invoice')
    // eslint-disable-next-line no-control-regex -- filenames cannot contain control characters.
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/[. ]+$/g, '')
    .slice(0, 120);
  return `${name || 'invoice'}.pdf`;
}

export async function createInvoicePdf(invoice) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const contentWidth = width - MARGIN * 2;
  let y = MARGIN;

  // Browser fonts preserve names in scripts unavailable in PDF's built-in fonts.
  let canvas;
  const canvasContext = (size, bold) => {
    canvas ||= document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not render invoice text.');
    context.font = `${bold ? 'bold' : 'normal'} ${size}px Arial, sans-serif`;
    return context;
  };
  const wrapText = (text, maxWidth, size, bold) => {
    if (/^[\x20-\x7e]*$/.test(text)) return pdf.splitTextToSize(text, maxWidth);
    const context = canvasContext(size, bold);
    const lines = [];
    let line = '';
    for (const word of text.split(/(\s+)/)) {
      if (line && context.measureText(line + word).width > maxWidth) {
        lines.push(line.trimEnd());
        line = '';
      }
      for (const character of word) {
        if (context.measureText(line + character).width > maxWidth && line) {
          lines.push(line.trimEnd());
          line = '';
        }
        line += character;
      }
    }
    if (line.trim()) lines.push(line.trimEnd());
    return lines;
  };
  const ensureSpace = space => {
    if (y + space > height - MARGIN) {
      pdf.addPage();
      y = MARGIN;
    }
  };
  const write = (value, { size = 11, bold = false, gap = 5, right = false, maxWidth = contentWidth } = {}) => {
    const text = textValue(value);
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setFontSize(size);
    const lines = wrapText(text, maxWidth, size, bold);
    for (const line of lines) {
      const lineHeight = size * 1.45;
      ensureSpace(lineHeight);
      if (/^[\x20-\x7e]*$/.test(line)) {
        pdf.text(line, right ? width - MARGIN : MARGIN, y + size, { align: right ? 'right' : 'left' });
      } else {
        const context = canvasContext(size, bold);
        const textWidth = Math.ceil(context.measureText(line).width) + 2;
        canvas.width = textWidth * 2;
        canvas.height = Math.ceil(lineHeight) * 2;
        context.scale(2, 2);
        context.font = `${bold ? 'bold' : 'normal'} ${size}px Arial, sans-serif`;
        context.fillStyle = '#1e293b';
        context.textBaseline = 'top';
        context.fillText(line, 0, 0);
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', right ? width - MARGIN - textWidth : MARGIN, y, textWidth, Math.ceil(lineHeight));
      }
      y += lineHeight;
    }
    y += gap;
  };
  const rule = () => {
    ensureSpace(14);
    pdf.setDrawColor(210, 215, 220);
    pdf.line(MARGIN, y, width - MARGIN, y);
    y += 14;
  };
  const section = title => {
    ensureSpace(60);
    y += 8;
    write(title, { size: 12, bold: true, gap: 8 });
  };
  const field = (label, value) => write(`${label}: ${textValue(value)}`);
  const currency = /^[A-Z]{3}$/.test(String(invoice.currency || '').toUpperCase())
    ? invoice.currency.toUpperCase() : 'MYR';
  const money = value => `${currency} ${numberValue(value).toFixed(2)}`;
  const amount = numberValue(invoice.amount);
  const credit = Number.isFinite(invoice.creditCents) ? invoice.creditCents / 100 : 0;
  const subtotal = Number.isFinite(invoice.subtotalCents) ? invoice.subtotalCents / 100 : amount + credit;
  const isDemo = invoice.simulated === true || invoice.isSimulated === true || /demo/i.test(invoice.paymentMethod || '');

  pdf.setProperties({ title: `Invoice ${textValue(invoice.invoiceNumber)}`, author: 'ReMember Club', subject: 'Membership invoice' });
  pdf.setTextColor(30, 41, 59);
  write('ReMember Club', { size: 24, bold: true, gap: 8 });
  if (invoice.organisationName) write(invoice.organisationName);
  write('INVOICE', { size: 17, bold: true, gap: 12 });
  field('Invoice number', invoice.invoiceNumber);
  field('Status', textValue(invoice.paymentStatus, 'unknown').toUpperCase());
  field('Issue date', dateValue(invoice.createdAt));
  if (isDemo) write('DEMO PAYMENT - NO MONEY CHARGED', { size: 10, bold: true, gap: 10 });
  rule();

  section('Billed to');
  write(invoice.userName, { bold: true });
  write(invoice.userEmail);

  section('Payment details');
  field('Payment method', invoice.paymentMethod);
  field('Date paid', dateValue(invoice.paidAt));
  field('Coverage start', dateValue(invoice.periodStart));
  field('Coverage end', dateValue(invoice.periodEnd));
  field('Transaction reference', invoice.transactionId);

  section('Description');
  write(`${textValue(invoice.tierName, 'Membership')} Membership`, { bold: true });
  field('Billing interval', textValue(invoice.billingInterval, 'Yearly'));
  rule();
  write(`Subtotal: ${money(subtotal)}`, { right: true });
  if (credit > 0) write(`Membership credit: -${money(credit)}`, { right: true });
  write('Tax (0%): ' + money(0), { right: true });
  const totalLabel = invoice.paymentStatus === 'paid' ? 'Total paid' : invoice.paymentStatus === 'pending' ? 'Amount due' : 'Total amount';
  write(`${totalLabel}: ${money(amount)}`, { size: 14, bold: true, right: true, gap: 18 });
  if (invoice.carryForwardCents > 0) write(`${money(invoice.carryForwardCents / 100)} membership credit remains available for a future payment.`, { size: 10 });
  rule();
  write(isDemo
    ? 'This is a simulated payment receipt. No money was charged or transferred.'
    : 'Thank you for being a valued member. Keep this invoice for your records.', { size: 10 });

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100);
    pdf.text(`Page ${page} of ${pages}`, width - MARGIN, height - 24, { align: 'right' });
  }
  return pdf;
}

export async function downloadInvoicePdf(invoice) {
  const pdf = await createInvoicePdf(invoice);
  await pdf.save(invoicePdfFilename(invoice), { returnPromise: true });
}
