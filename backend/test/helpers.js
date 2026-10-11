import express from 'express';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';

export const tokenFor = (role, userId = `user-${role}`) => jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '5m' });

export async function startApp(mount) {
  const app = express();
  app.use(express.json());
  mount(app);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

/** Builds a small, valid text-based PDF with one page per entry. */
export function buildPdf(pageTexts) {
  const objects = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageTexts.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${pageTexts.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pageTexts.forEach((text, i) => {
    const escape = (line) => line.replace(/[\\()]/g, (m) => `\\${m}`);
    const ops = ['BT', '/F1 11 Tf', '14 TL', '50 780 Td', ...text.split('\n').map((line) => `(${escape(line)}) Tj T*`), 'ET'].join('\n');
    objects[4 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`;
    objects[5 + i * 2] = `<< /Length ${Buffer.byteLength(ops, 'latin1')} >>\nstream\n${ops}\nendstream`;
  });
  let out = '%PDF-1.4\n';
  const offsets = [];
  for (let i = 1; i < objects.length; i += 1) {
    offsets[i] = Buffer.byteLength(out, 'latin1');
    out += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  out += offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

export const sampleScheme = () => ({
  id: 'SCHEME-TEST-1',
  name: 'Village Water Supply',
  description: 'Piped water supply for 400 households',
  totalBudget: 5000000,
  budgetUtilized: 4000000,
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  status: 'on-track',
  overallProgress: 40,
  phases: [
    { id: 1, name: 'Survey and design', progress: 100, status: 'completed', startDate: '2025-01-01', endDate: '2025-02-28', budget: 500000, spent: 500000 },
    { id: 2, name: 'Pipeline laying', progress: 60, status: 'on-track', startDate: '2025-03-01', endDate: '2025-06-30', budget: 3000000, spent: 2800000 },
    { id: 3, name: 'Household connections', progress: 0, status: 'not-started', startDate: '2025-07-01', endDate: '2025-12-31', budget: 1500000, spent: 0 },
  ],
  vendorReports: [],
  discrepancies: [],
});
