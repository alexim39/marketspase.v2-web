import { Certificate } from './training.models';

/** Deterministic certificate number from course + date + random tail. */
export const certNumber = (cert: Certificate): string => {
  if (cert.number) return cert.number;
  const d = new Date(cert.at);
  const y = d.getFullYear();
  const tail = Math.abs(hashString(`${cert.courseId}:${cert.at}`)).toString(36).toUpperCase().slice(0, 6).padStart(6, '0');
  return `MS-${y}-${tail}`;
};

const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(0)) | 0;
  return h;
};

/** Build a printable certificate HTML string. */
export const certHtml = (cert: Certificate, holderName: string): string => {
  const num = certNumber(cert);
  const date = new Date(cert.at).toLocaleDateString();
  return `<!doctype html><html><head><title>Certificate — ${cert.title}</title><style>
  body{font-family:Inter, sans-serif; padding:40px; color:#111827; background:#f9fafb}
  .card{max-width:640px; margin:40px auto; background:#fff; border:1px solid #e5e7eb; border-radius:10px; padding:32px; text-align:center}
  h1{margin:0 0 8px; color:#667eea} .muted{color:#6b7280; font-size:0.9em}
  .num{font-family:monospace; letter-spacing:0.08em; background:#eef0fd; padding:4px 10px; border-radius:999px; display:inline-block; margin-top:12px}
  </style></head><body><div class="card">
  <p class="muted">MarketSpase — Leadership Academy</p>
  <h1>Certificate of Completion</h1>
  <p>This certifies that <strong>${holderName}</strong> has completed</p>
  <h2>${cert.title}</h2>
  <p class="muted">Issued ${date}</p>
  <div class="num">${num}</div>
  </div><script>window.print()<\/script></body></html>`;
};

export const downloadCert = (cert: Certificate, holderName: string): void => {
  const html = certHtml(cert, holderName);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (!w) {
    const a = document.createElement('a');
    a.href = url; a.download = `${cert.title.replace(/\s+/g, '_')}_${certNumber(cert)}.html`;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};
