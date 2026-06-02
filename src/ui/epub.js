// src/ui/epub.js — zero-dep EPUB builder.
//
// buildEpub({ title, subtitle, lang, chapters, coverDataUri })
//   → Promise<Blob>  (application/epub+zip)
//
// Each chapter: { heading, text, imageDataUri? }
// Images are extracted from data-URIs and embedded as PNG/JPEG files.
// Cover is rendered on an offscreen canvas.

// ─── Helpers ─────────────────────────────────────────────────────────────────

const _enc = new TextEncoder();
const _str = s => _enc.encode(s);

function _dataUriToBytes(uri) {
  const m = uri.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!m) return null;
  const binary = atob(m[2]);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const ext = m[1] === 'image/jpeg' ? 'jpg' : 'png';
  return { mime: m[1], ext, bytes };
}

function _escXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Minimal ZIP (store-only, no compression) ────────────────────────────────
// EPUB spec requires mimetype as first entry, stored, no extra fields.

function _buildZip(entries) {
  const parts   = [];
  const central = [];
  let offset    = 0;

  for (const { path, data } of entries) {
    const nameBytes = _str(path);
    const crc       = _crc32(data);

    // Local file header (30 bytes + name + data)
    const local = new ArrayBuffer(30 + nameBytes.length + data.length);
    const lv    = new DataView(local);
    const lu    = new Uint8Array(local);

    lv.setUint32(0,  0x04034b50, true);  // signature
    lv.setUint16(4,  20, true);          // version needed
    lv.setUint16(6,  0, true);           // flags
    lv.setUint16(8,  0, true);           // compression: store
    lv.setUint16(10, 0, true);           // mod time
    lv.setUint16(12, 0, true);           // mod date
    lv.setUint32(14, crc, true);         // crc32
    lv.setUint32(18, data.length, true); // compressed size
    lv.setUint32(22, data.length, true); // uncompressed size
    lv.setUint16(26, nameBytes.length, true); // name length
    lv.setUint16(28, 0, true);           // extra length
    lu.set(nameBytes, 30);
    lu.set(data, 30 + nameBytes.length);

    parts.push(lu);

    // Central directory entry (46 bytes + name)
    const cen = new ArrayBuffer(46 + nameBytes.length);
    const cv  = new DataView(cen);
    const cu  = new Uint8Array(cen);

    cv.setUint32(0,  0x02014b50, true);  // signature
    cv.setUint16(4,  20, true);          // version made by
    cv.setUint16(6,  20, true);          // version needed
    cv.setUint16(8,  0, true);           // flags
    cv.setUint16(10, 0, true);           // compression: store
    cv.setUint16(12, 0, true);           // mod time
    cv.setUint16(14, 0, true);           // mod date
    cv.setUint32(16, crc, true);         // crc32
    cv.setUint32(20, data.length, true); // compressed size
    cv.setUint32(24, data.length, true); // uncompressed size
    cv.setUint16(28, nameBytes.length, true); // name length
    cv.setUint16(30, 0, true);           // extra length
    cv.setUint16(32, 0, true);           // comment length
    cv.setUint16(34, 0, true);           // disk number
    cv.setUint16(36, 0, true);           // internal attrs
    cv.setUint32(38, 0, true);           // external attrs
    cv.setUint32(42, offset, true);      // local header offset
    cu.set(nameBytes, 46);

    central.push(cu);
    offset += lu.length;
  }

  // End of central directory
  const centralOffset = offset;
  let centralSize = 0;
  for (const c of central) centralSize += c.length;

  const end = new ArrayBuffer(22);
  const ev  = new DataView(end);
  ev.setUint32(0,  0x06054b50, true);         // signature
  ev.setUint16(4,  0, true);                  // disk number
  ev.setUint16(6,  0, true);                  // disk with central dir
  ev.setUint16(8,  entries.length, true);      // entries on disk
  ev.setUint16(10, entries.length, true);      // total entries
  ev.setUint32(12, centralSize, true);         // central dir size
  ev.setUint32(16, centralOffset, true);       // central dir offset
  ev.setUint16(20, 0, true);                  // comment length

  return new Blob([...parts, ...central, new Uint8Array(end)], { type: 'application/epub+zip' });
}

// CRC-32 (IEEE)
const _crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function _crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = _crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ─── Cover image (canvas-rendered) ───────────────────────────────────────────

async function _renderCover(title, subtitle) {
  const W = 600, H = 800;
  const canvas = new OffscreenCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // Parchment background
  ctx.fillStyle = '#f5e6c8';
  ctx.fillRect(0, 0, W, H);

  // Decorative border
  ctx.strokeStyle = '#8c6a3a';
  ctx.lineWidth   = 2;
  ctx.strokeRect(30, 30, W - 60, H - 60);
  ctx.strokeRect(36, 36, W - 72, H - 72);

  // Brand
  ctx.fillStyle    = '#8c6a3a';
  ctx.font         = '18px Georgia, serif';
  ctx.textAlign    = 'center';
  ctx.fillText("DAN'S DUNGEONS", W / 2, 100);

  // Decorative rule
  ctx.strokeStyle = '#c8a878';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(100, 120);
  ctx.lineTo(W - 100, 120);
  ctx.stroke();

  // Title — word-wrap
  ctx.fillStyle = '#3a2a1a';
  ctx.font      = 'bold 36px Georgia, serif';
  const words   = title.split(' ');
  const lines   = [];
  let line      = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > W - 120) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);

  const lineH = 46;
  const titleY = 300 - (lines.length * lineH) / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], W / 2, titleY + i * lineH);
  }

  // Decorative rule below title
  const ruleY = titleY + lines.length * lineH + 20;
  ctx.strokeStyle = '#c8a878';
  ctx.beginPath();
  ctx.moveTo(100, ruleY);
  ctx.lineTo(W - 100, ruleY);
  ctx.stroke();

  // Subtitle
  ctx.fillStyle = '#5c3d1a';
  ctx.font      = 'italic 20px Georgia, serif';
  ctx.fillText(subtitle, W / 2, ruleY + 50);

  // Ornament
  ctx.fillStyle = '#c8a878';
  ctx.font      = '28px serif';
  ctx.fillText('⁂', W / 2, H - 80);

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Uint8Array(await blob.arrayBuffer());
}

// ─── EPUB assembly ───────────────────────────────────────────────────────────

const STYLE_CSS = `
body { font-family: Georgia, 'Times New Roman', serif; line-height: 1.8; color: #3a2a1a; margin: 1em; }
h1 { text-align: center; font-size: 1.8em; color: #5c3d1a; margin-bottom: 0.3em; }
h2 { font-size: 1.2em; color: #5c3d1a; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #c8a878; padding-bottom: 0.4em; margin: 1.5em 0 0.8em; }
p { margin: 0.6em 0; text-align: justify; }
.subtitle { text-align: center; color: #8c6a3a; font-style: italic; margin-bottom: 2em; }
.cover-img { text-align: center; }
.cover-img img { max-width: 100%; max-height: 100%; }
.scene-img { margin: 1em 0; text-align: center; }
.scene-img img { max-width: 100%; border: 1px solid #c8a878; }
.ornament { text-align: center; color: #c8a878; font-size: 1.5em; margin: 1.5em 0; }
`;

export async function buildEpub({ title, subtitle, lang, chapters }) {
  const uuid = 'urn:uuid:' + crypto.randomUUID();
  const entries = [];

  // mimetype MUST be first, stored, no extra fields
  entries.push({ path: 'mimetype', data: _str('application/epub+zip') });

  // META-INF/container.xml
  entries.push({ path: 'META-INF/container.xml', data: _str(
    `<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`
  )});

  // Stylesheet
  entries.push({ path: 'OEBPS/style.css', data: _str(STYLE_CSS) });

  // Cover image
  const coverPng = await _renderCover(title, subtitle);
  entries.push({ path: 'OEBPS/images/cover.png', data: coverPng });

  // Extract chapter images
  const imageFiles = []; // { filename, mime, bytes }
  for (let i = 0; i < chapters.length; i++) {
    if (!chapters[i].imageDataUri) continue;
    const img = _dataUriToBytes(chapters[i].imageDataUri);
    if (!img) continue;
    const filename = `scene-${String(i + 1).padStart(2, '0')}.${img.ext}`;
    imageFiles.push({ chapterIdx: i, filename, mime: img.mime, bytes: img.bytes });
    entries.push({ path: `OEBPS/images/${filename}`, data: img.bytes });
  }

  // Cover XHTML
  entries.push({ path: 'OEBPS/cover.xhtml', data: _str(
    `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${lang}"><head><title>Cover</title><link rel="stylesheet" href="style.css"/></head><body><div class="cover-img"><img src="images/cover.png" alt="Cover"/></div></body></html>`
  )});

  // Chapter XHTML files
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const imgFile = imageFiles.find(f => f.chapterIdx === i);
    const imgTag  = imgFile ? `<div class="scene-img"><img src="images/${imgFile.filename}" alt="Scene illustration"/></div>` : '';
    const paras   = _escXml(ch.text).split('\n').map(p => p.trim()).filter(Boolean).map(p => `<p>${p}</p>`).join('\n');
    const num     = String(i + 1).padStart(2, '0');

    entries.push({ path: `OEBPS/chapter-${num}.xhtml`, data: _str(
      `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${lang}"><head><title>${_escXml(ch.heading)}</title><link rel="stylesheet" href="style.css"/></head><body>${imgTag}<h2>${_escXml(ch.heading)}</h2>\n${paras}\n<div class="ornament">⁂</div></body></html>`
    )});
  }

  // content.opf — manifest + spine
  const manifestItems = [
    `<item id="style" href="style.css" media-type="text/css"/>`,
    `<item id="cover-image" href="images/cover.png" media-type="image/png" properties="cover-image"/>`,
    `<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>`,
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
  ];
  const spineItems = [`<itemref idref="cover"/>`];

  for (let i = 0; i < chapters.length; i++) {
    const num = String(i + 1).padStart(2, '0');
    manifestItems.push(`<item id="ch-${num}" href="chapter-${num}.xhtml" media-type="application/xhtml+xml"/>`);
    spineItems.push(`<itemref idref="ch-${num}"/>`);
  }
  for (const img of imageFiles) {
    manifestItems.push(`<item id="img-${img.filename}" href="images/${img.filename}" media-type="${img.mime}"/>`);
  }

  entries.push({ path: 'OEBPS/content.opf', data: _str(
    `<?xml version="1.0" encoding="UTF-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="uid" version="3.0">\n<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">${uuid}</dc:identifier><dc:title>Dan's Dungeons: ${_escXml(title)}</dc:title><dc:language>${lang}</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta></metadata>\n<manifest>\n${manifestItems.join('\n')}\n</manifest>\n<spine toc="ncx">\n${spineItems.join('\n')}\n</spine>\n</package>`
  )});

  // toc.ncx
  const navPoints = chapters.map((ch, i) => {
    const num = String(i + 1).padStart(2, '0');
    return `<navPoint id="np-${num}" playOrder="${i + 2}"><navLabel><text>${_escXml(ch.heading)}</text></navLabel><content src="chapter-${num}.xhtml"/></navPoint>`;
  });

  entries.push({ path: 'OEBPS/toc.ncx', data: _str(
    `<?xml version="1.0" encoding="UTF-8"?>\n<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${uuid}"/></head><docTitle><text>Dan's Dungeons: ${_escXml(title)}</text></docTitle><navMap><navPoint id="np-cover" playOrder="1"><navLabel><text>Cover</text></navLabel><content src="cover.xhtml"/></navPoint>\n${navPoints.join('\n')}\n</navMap></ncx>`
  )});

  return _buildZip(entries);
}
