import type { Certificate } from './training.models';

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

const escapeHtml = (value: string): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const issueDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

interface CertificateAssets {
  logoUrl: string;
  markUrl: string;
}

const DEFAULT_ASSETS: CertificateAssets = {
  logoUrl: '/logo/marketspase-logo-dark.png',
  markUrl: '/logo/marketspase-mark-white.png',
};

let assetPromise: Promise<CertificateAssets> | null = null;

const toDataUri = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result ?? ''));
  reader.onerror = () => reject(reader.error ?? new Error('Could not read brand asset'));
  reader.readAsDataURL(blob);
});

const loadBrandAsset = async (url: string): Promise<string> => {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Brand asset ${url} could not be loaded`);
  return toDataUri(await response.blob());
};

const loadBrandAssets = (): Promise<CertificateAssets> => {
  assetPromise ??= Promise.all([
    loadBrandAsset('/logo/marketspase-logo-dark.png'),
    loadBrandAsset('/logo/marketspase-mark-white.png'),
  ])
    .then(([logoUrl, markUrl]) => ({ logoUrl, markUrl }))
    .catch(() => {
      assetPromise = null;
      return DEFAULT_ASSETS;
    });
  return assetPromise;
};

/** Build a self-contained, printable certificate HTML string. */
export const certHtml = (
  cert: Certificate,
  holderName: string,
  assets: CertificateAssets = DEFAULT_ASSETS,
): string => {
  const num = certNumber(cert);
  const certificateNumber = escapeHtml(num);
  const date = issueDate(cert.at);
  const holder = escapeHtml(holderName);
  const title = escapeHtml(cert.title);
  const logo = escapeHtml(assets.logoUrl);
  const mark = escapeHtml(assets.markUrl);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MarketSpase Certificate — ${title}</title>
  <style>
    @page { size: A4 landscape; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body {
      font-family: Inter, "Segoe UI", Arial, sans-serif;
      color: #101828;
      background:
        radial-gradient(circle at 15% 12%, rgba(102, 126, 234, .14), transparent 34%),
        radial-gradient(circle at 88% 90%, rgba(118, 75, 162, .12), transparent 32%),
        #f4f2fa;
      padding: 26px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page { width: min(1120px, 100%); margin: 0 auto; }
    .certificate {
      position: relative;
      overflow: hidden;
      background: #fffdf9;
      border: 1px solid #ded7ea;
      border-radius: 20px;
      padding: 44px 54px 38px;
      box-shadow: 0 28px 80px rgba(27, 20, 48, .18);
    }
    .certificate::before {
      content: "";
      position: absolute;
      inset: 14px;
      pointer-events: none;
      border: 1px solid rgba(102, 126, 234, .28);
      border-radius: 13px;
    }
    .certificate::after {
      content: "";
      position: absolute;
      width: 330px;
      height: 330px;
      right: -145px;
      top: -145px;
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(102, 126, 234, .15), rgba(118, 75, 162, .05));
      pointer-events: none;
    }
    .corner {
      position: absolute;
      width: 46px;
      height: 46px;
      border-color: #667eea;
      border-style: solid;
      opacity: .7;
      pointer-events: none;
    }
    .corner--tl { left: 26px; top: 26px; border-width: 2px 0 0 2px; border-radius: 8px 0 0 0; }
    .corner--tr { right: 26px; top: 26px; border-width: 2px 2px 0 0; border-radius: 0 8px 0 0; }
    .corner--bl { left: 26px; bottom: 26px; border-width: 0 0 2px 2px; border-radius: 0 0 0 8px; }
    .corner--br { right: 26px; bottom: 26px; border-width: 0 2px 2px 0; border-radius: 0 0 8px 0; }

    .brand-row {
      position: relative;
      z-index: 1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid #ece7f4;
    }
    .brand-logo { height: 44px; width: auto; display: block; }
    .brand-wordmark {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 3px;
      text-align: right;
    }
    .brand-wordmark strong {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .18em;
      text-transform: uppercase;
      color: #667eea;
    }
    .brand-wordmark span { font-size: 11px; color: #8a8497; }

    .content {
      position: relative;
      z-index: 1;
      max-width: 850px;
      margin: 0 auto;
      padding: 28px 0 22px;
      text-align: center;
    }
    .eyebrow {
      margin: 0 0 10px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .24em;
      text-transform: uppercase;
      color: #764ba2;
    }
    h1 {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(38px, 5vw, 56px);
      line-height: 1.03;
      letter-spacing: -.03em;
      color: #17132a;
    }
    .rule {
      width: 76px;
      height: 3px;
      border-radius: 999px;
      margin: 16px auto;
      background: linear-gradient(90deg, #667eea, #764ba2);
    }
    .awarded {
      margin: 0 0 8px;
      color: #6c6578;
      font-size: 14px;
    }
    .recipient {
      margin: 0 0 16px;
      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(28px, 4vw, 42px);
      line-height: 1.16;
      color: #3d2d72;
    }
    .completed { margin: 0 0 8px; color: #6c6578; font-size: 14px; }
    .course {
      margin: 0 auto;
      max-width: 760px;
      font-size: clamp(21px, 3vw, 30px);
      line-height: 1.25;
      letter-spacing: -.02em;
      color: #19152b;
    }
    .issue-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      max-width: 560px;
      margin: 24px auto 0;
    }
    .issue {
      border: 1px solid #e9e3f1;
      border-radius: 10px;
      background: #faf8fd;
      padding: 10px 14px;
      text-align: left;
    }
    .issue span {
      display: block;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: .12em;
      text-transform: uppercase;
      color: #8b8498;
      margin-bottom: 3px;
    }
    .issue strong { font-size: 13px; color: #322b43; }
    .cert-no { font-family: "Courier New", monospace; letter-spacing: .06em; }

    .footer {
      position: relative;
      z-index: 1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      padding-top: 21px;
      border-top: 1px solid #ece7f4;
    }
    .seal {
      width: 58px;
      height: 58px;
      flex: none;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, #667eea, #764ba2);
      box-shadow: 0 8px 20px rgba(102, 126, 234, .28);
    }
    .seal img { width: 58%; height: 58%; object-fit: contain; display: block; }
    .signature {
      flex: 1;
      text-align: center;
      color: #5f596c;
      font-size: 10px;
    }
    .signature .line {
      display: block;
      width: 220px;
      max-width: 100%;
      height: 1px;
      background: #bdb5cd;
      margin: 0 auto 7px;
    }
    .signature strong {
      display: block;
      font-size: 11px;
      color: #362e47;
      margin-bottom: 2px;
    }
    .brand-url {
      flex: none;
      text-align: right;
      color: #8b8498;
      font-size: 10px;
    }
    .brand-url strong { display: block; color: #667eea; font-size: 11px; }
    .print-button {
      display: block;
      margin: 18px auto 0;
      border: 0;
      border-radius: 999px;
      padding: 10px 18px;
      background: #17132a;
      color: #fff;
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .page { width: 100%; }
      .certificate {
        border-radius: 0;
        border: 0;
        box-shadow: none;
        min-height: 190mm;
        padding: 16mm 20mm 14mm;
      }
      .certificate::before { inset: 7mm; }
      .corner--tl { left: 12mm; top: 12mm; }
      .corner--tr { right: 12mm; top: 12mm; }
      .corner--bl { left: 12mm; bottom: 12mm; }
      .corner--br { right: 12mm; bottom: 12mm; }
      .print-button { display: none; }
      .content { padding: 9mm 0 7mm; }
    }
    @media (max-width: 640px) {
      body { padding: 0; }
      .certificate { border-radius: 0; padding: 26px 22px; }
      .brand-row { align-items: flex-start; }
      .brand-logo { height: 34px; }
      .footer { flex-direction: column; text-align: center; }
      .brand-url { text-align: center; }
      .issue-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="page">
    <article class="certificate" aria-label="Certificate of completion">
      <span class="corner corner--tl" aria-hidden="true"></span>
      <span class="corner corner--tr" aria-hidden="true"></span>
      <span class="corner corner--bl" aria-hidden="true"></span>
      <span class="corner corner--br" aria-hidden="true"></span>

      <header class="brand-row">
        <img class="brand-logo" src="${logo}" alt="MarketSpase">
        <div class="brand-wordmark">
          <strong>Leadership Academy</strong>
          <span>Learn. Apply. Lead.</span>
        </div>
      </header>

      <section class="content">
        <p class="eyebrow">MarketSpase leadership learning</p>
        <h1>Certificate of Completion</h1>
        <div class="rule" aria-hidden="true"></div>
        <p class="awarded">This certificate is proudly presented to</p>
        <p class="recipient">${holder}</p>
        <p class="completed">for successfully completing</p>
        <h2 class="course">${title}</h2>

        <div class="issue-grid">
          <div class="issue">
            <span>Issued</span>
            <strong>${date}</strong>
          </div>
          <div class="issue">
            <span>Certificate number</span>
            <strong class="cert-no">${certificateNumber}</strong>
          </div>
        </div>
      </section>

      <footer class="footer">
        <div class="seal" aria-hidden="true"><img src="${mark}" alt=""></div>
        <div class="signature">
          <span class="line"></span>
          <strong>MarketSpase Leadership Academy</strong>
          <span>Authorised learning certificate</span>
        </div>
        <div class="brand-url">
          <strong>marketspase.com</strong>
          <span>Verified partner learning</span>
        </div>
      </footer>
    </article>
    <button class="print-button" type="button" onclick="window.print()">Print or save as PDF</button>
  </main>
  <script>
    window.addEventListener('load', function () {
      window.setTimeout(function () { window.print(); }, 350);
    });
  </script>
</body>
</html>`;
};

const openCertificateWindow = (): Window | null => {
  const win = window.open('', '_blank');
  if (!win) return null;
  try {
    win.document.write('<!doctype html><title>Preparing certificate…</title><body style="font-family:Arial,sans-serif;padding:40px;color:#17132a"><p>Preparing your MarketSpase certificate…</p></body>');
    win.document.close();
  } catch { /* the fallback still opens the finished document */ }
  return win;
};

const openBlob = (html: string, cert: Certificate): void => {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${cert.title.replace(/\s+/g, '_')}_${certNumber(cert)}.html`;
    anchor.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
};

/**
 * Open a branded certificate window immediately (preserving the click gesture),
 * then fill it with the official brand assets as data URIs so the certificate
 * remains self-contained when printed or saved.
 */
export const downloadCert = (cert: Certificate, holderName: string): void => {
  const win = openCertificateWindow();
  if (!win) {
    openBlob(certHtml(cert, holderName), cert);
    return;
  }

  void loadBrandAssets()
    .then((assets) => {
      const html = certHtml(cert, holderName, assets);
      if (!win.closed) {
        win.document.open();
        win.document.write(html);
        win.document.close();
      }
    })
    .catch(() => {
      if (!win.closed) {
        win.document.open();
        win.document.write(certHtml(cert, holderName));
        win.document.close();
      }
    });
};
