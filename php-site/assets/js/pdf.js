/* Client-side PDF tools. Libraries load on demand from jsDelivr (never uploaded). */
(function (global) {
  'use strict';
  var esc = (global.SEO && global.SEO.esc) || function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var CDN = {
    pdfLib: 'https://cdn.jsdelivr.net/npm/@cantoo/pdf-lib@2.11.1/+esm',
    pdfJs: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs',
    pdfJsWorker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs',
    docx: 'https://cdn.jsdelivr.net/npm/docx@9.5.1/+esm'
  };
  var pdfLibP = null, pdfJsP = null, docxP = null;
  function dyn(url) { return import(url); }
  function loadPdfLib() { return (pdfLibP = pdfLibP || dyn(CDN.pdfLib).catch(function (e) { pdfLibP = null; throw new Error('Could not load the PDF library (network blocked?). ' + e); })); }
  function loadDocx() { return (docxP = docxP || dyn(CDN.docx).catch(function (e) { docxP = null; throw new Error('Could not load the DOCX library. ' + e); })); }
  function loadPdfJs() {
    if (!pdfJsP) {
      pdfJsP = dyn(CDN.pdfJs).then(function (pdfjs) { pdfjs.GlobalWorkerOptions.workerSrc = CDN.pdfJsWorker; return pdfjs; }).catch(function (e) { pdfJsP = null; throw new Error('Could not load the PDF renderer. ' + e); });
    }
    return pdfJsP;
  }
  function fmtBytes(b) { return b >= 1048576 ? (b / 1048576).toFixed(2) + ' MB' : b >= 1024 ? (b / 1024).toFixed(1) + ' KB' : b + ' B'; }
  function readFile(f) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsArrayBuffer(f); }); }
  function download(data, name, type) {
    type = type || 'application/pdf';
    var blob = data instanceof Blob ? data : new Blob([data], { type: type });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function paperName(w, h) {
    var a = Math.min(w, h), b = Math.max(w, h), near = function (x, y) { return Math.abs(x - y) < 6; };
    if (near(a, 595) && near(b, 842)) return 'A4';
    if (near(a, 612) && near(b, 792)) return 'US Letter';
    if (near(a, 612) && near(b, 1008)) return 'US Legal';
    if (near(a, 420) && near(b, 595)) return 'A5';
    if (near(a, 842) && near(b, 1191)) return 'A3';
    return Math.round(a / 72 * 25.4) + '×' + Math.round(b / 72 * 25.4) + ' mm';
  }
  function parseRanges(spec, max) {
    var out = {};
    spec.split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (part) {
      var m = part.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) { var a = Math.max(1, +m[1]), b = Math.min(max, +m[2]); for (var i = a; i <= b; i++) out[i - 1] = 1; }
      else if (/^\d+$/.test(part)) { var n = +part; if (n >= 1 && n <= max) out[n - 1] = 1; }
    });
    return Object.keys(out).map(Number).sort(function (a, b) { return a - b; });
  }
  function inspectPdf(buf) {
    return loadPdfLib().then(function (lib) {
      var encrypted = false, doc;
      return lib.PDFDocument.load(buf, { updateMetadata: false }).catch(function (e) {
        if (/encrypted/i.test(String(e))) { encrypted = true; return lib.PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false }); }
        throw e;
      }).then(function (d) {
        doc = d;
        var header = new TextDecoder().decode(new Uint8Array(buf.slice(0, 16)));
        var fmt = function (dt) { return dt ? dt.toLocaleString('en-GB') : ''; };
        return {
          pages: doc.getPageCount(), size: buf.byteLength,
          title: doc.getTitle() || '', author: doc.getAuthor() || '', subject: doc.getSubject() || '', creator: doc.getCreator() || '', producer: doc.getProducer() || '',
          created: fmt(doc.getCreationDate()), modified: fmt(doc.getModificationDate()),
          encrypted: encrypted || doc.isEncrypted,
          pageSizes: doc.getPages().slice(0, 50).map(function (p) { var s = p.getSize(); return { w: Math.round(s.width), h: Math.round(s.height) }; }),
          version: (header.match(/%PDF-(\d\.\d)/) || [])[1] || ''
        };
      });
    });
  }
  function renderPages(buf, opts) {
    opts = opts || {};
    return loadPdfJs().then(function (pdfjs) {
      return pdfjs.getDocument({ data: new Uint8Array(buf), password: opts.password }).promise.then(function (doc) {
        var pages = opts.pages || Array.from({ length: doc.numPages }, function (_, i) { return i; });
        var out = [];
        function next(i) {
          if (i >= pages.length) return out;
          return doc.getPage(pages[i] + 1).then(function (page) {
            var viewport = page.getViewport({ scale: opts.scale || 2 });
            var canvas = document.createElement('canvas');
            canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
            var ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            return page.render({ canvasContext: ctx, viewport: viewport, canvas: canvas }).promise.then(function () {
              return new Promise(function (res) { canvas.toBlob(function (b) { res(b); }, opts.type || 'image/jpeg', opts.quality || 0.9); });
            }).then(function (blob) {
              out.push({ blob: blob, width: canvas.width, height: canvas.height, page: pages[i] + 1 });
              if (opts.onProgress) opts.onProgress(i + 1, pages.length);
              page.cleanup();
              return next(i + 1);
            });
          });
        }
        return next(0);
      });
    });
  }
  function extractText(buf, onProgress) {
    return loadPdfJs().then(function (pdfjs) {
      return pdfjs.getDocument({ data: new Uint8Array(buf) }).promise.then(function (doc) {
        var pages = [];
        function next(i) {
          if (i > doc.numPages) return pages;
          return doc.getPage(i).then(function (page) {
            return page.getTextContent().then(function (content) {
              var last = null, text = '';
              content.items.forEach(function (item) {
                var y = Math.round(item.transform[5]);
                if (last !== null && Math.abs(y - last) > 4) text += '\n';
                else if (text && !text.endsWith('\n') && !text.endsWith(' ')) text += ' ';
                text += item.str; last = y;
                if (item.hasEOL) text += '\n';
              });
              pages.push(text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim());
              if (onProgress) onProgress(i, doc.numPages);
              return next(i + 1);
            });
          });
        }
        return next(1);
      });
    });
  }
  function imagesToPdf(images, pageSizePt) {
    return loadPdfLib().then(function (lib) {
      var doc = lib.PDFDocument.create();
      return Promise.resolve(doc).then(function (doc) {
        function next(i) {
          if (i >= images.length) return doc.save();
          return images[i].blob.arrayBuffer().then(function (ab) {
            var bytes = new Uint8Array(ab);
            return (images[i].blob.type === 'image/png' ? doc.embedPng(bytes) : doc.embedJpg(bytes)).then(function (img) {
              var size = (pageSizePt && pageSizePt[i]) || { w: images[i].width * 0.75, h: images[i].height * 0.75 };
              var page = doc.addPage([size.w, size.h]);
              page.drawImage(img, { x: 0, y: 0, width: size.w, height: size.h });
              return next(i + 1);
            });
          });
        }
        return next(0);
      });
    });
  }
  function compressToTarget(buf, targetBytes, onStatus) {
    return loadPdfLib().then(function (lib) {
      var attempts = [];
      if (onStatus) onStatus('Optimising document structure…');
      return lib.PDFDocument.load(buf, { ignoreEncryption: true }).then(function (src) {
        return src.save({ useObjectStreams: true }).then(function (lossless) {
          attempts.push({ scale: 0, quality: 1, size: lossless.byteLength });
          if (!targetBytes || lossless.byteLength <= targetBytes) return { bytes: lossless, attempts: attempts, lossless: true };
          var sizes = src.getPages().map(function (p) { var s = p.getSize(); return { w: s.width, h: s.height }; });
          var ladder = [[1.5, 0.8], [1.3, 0.7], [1.1, 0.6], [1.0, 0.5], [0.9, 0.45], [0.8, 0.4], [0.7, 0.35], [0.6, 0.3], [0.5, 0.25]];
          var best = lossless;
          function step(i) {
            if (i >= ladder.length) return { bytes: best, attempts: attempts, lossless: false };
            var scale = ladder[i][0], quality = ladder[i][1];
            if (onStatus) onStatus('Re-rendering pages at ' + Math.round(scale * 72) + ' dpi, quality ' + Math.round(quality * 100) + '%…');
            return renderPages(buf, { scale: scale, quality: quality }).then(function (imgs) {
              return imagesToPdf(imgs, sizes).then(function (bytes) {
                attempts.push({ scale: scale, quality: quality, size: bytes.byteLength });
                if (bytes.byteLength < best.byteLength) best = bytes;
                if (bytes.byteLength <= targetBytes) return { bytes: bytes, attempts: attempts, lossless: false };
                return step(i + 1);
              });
            });
          }
          return step(0);
        });
      });
    });
  }
  function wrapText(text, font, size, maxWidth) {
    var lines = [];
    text.split(/\r?\n/).forEach(function (para) {
      if (!para.trim()) { lines.push(''); return; }
      var line = '';
      para.split(/\s+/).forEach(function (word) {
        var test = line ? line + ' ' + word : word;
        if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test;
        else {
          if (line) lines.push(line);
          var w = word;
          while (font.widthOfTextAtSize(w, size) > maxWidth && w.length > 1) {
            var cut = w.length - 1;
            while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxWidth) cut--;
            lines.push(w.slice(0, cut)); w = w.slice(cut);
          }
          line = w;
        }
      });
      if (line) lines.push(line);
    });
    return lines;
  }
  function toWinAnsi(s) { return s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\u2013/g, '-').replace(/\u2014/g, '--').replace(/\u2026/g, '...').replace(/[^\x00-\xFF]/g, '?'); }
  function base(name) { return name.replace(/\.[^.]+$/, ''); }
  var PAGE_SIZES = { A4: [595.28, 841.89], Letter: [612, 792], Legal: [612, 1008], A5: [419.53, 595.28], A3: [841.89, 1190.55] };

  function zipFind(buf, pred) {
    var bytes = new Uint8Array(buf), view = new DataView(buf), dec = new TextDecoder();
    var eocd = -1;
    for (var i = bytes.length - 22; i >= Math.max(0, bytes.length - 70000); i--) { if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error('Not a valid zip file');
    var n = view.getUint16(eocd + 10, true), ptr = view.getUint32(eocd + 16, true), entries = [];
    for (var j = 0; j < n; j++) {
      if (view.getUint32(ptr, true) !== 0x02014b50) break;
      var comp = view.getUint16(ptr + 10, true), csize = view.getUint32(ptr + 20, true), nlen = view.getUint16(ptr + 28, true), elen = view.getUint16(ptr + 30, true), clen = view.getUint16(ptr + 32, true), off = view.getUint32(ptr + 42, true);
      var name = dec.decode(bytes.slice(ptr + 46, ptr + 46 + nlen));
      entries.push({ name: name, off: off, comp: comp, csize: csize });
      ptr += 46 + nlen + elen + clen;
    }
    return Promise.all(entries.filter(pred).map(function (e) {
      var lnlen = view.getUint16(e.off + 26, true), lelen = view.getUint16(e.off + 28, true);
      var raw = bytes.slice(e.off + 30 + lnlen + lelen, e.off + 30 + lnlen + lelen + e.csize);
      var p = e.comp === 0 ? Promise.resolve(dec.decode(raw)) : (typeof DecompressionStream === 'undefined' ? Promise.reject(new Error('Cannot decompress')) : new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text());
      return p.then(function (xml) { return { name: e.name, xml: xml }; });
    }));
  }
  function docxToText(buf) {
    return zipFind(buf, function (e) { return e.name === 'word/document.xml'; }).then(function (found) {
      if (!found.length) throw new Error('word/document.xml not found — is this a .docx file?');
      var xml = found[0].xml;
      var paras = Array.from(xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)).map(function (m) {
        var p = m[0];
        var isHeading = /<w:pStyle w:val="(Heading\d|Title)"/i.test(p);
        var isList = /<w:numPr>/.test(p);
        var t = Array.from(p.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g)).map(function (x) { return x[0].indexOf('<w:tab') === 0 ? '\t' : x[0].indexOf('<w:br') === 0 ? '\n' : x[1]; }).join('');
        var clean = t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
        return (isHeading ? '# ' : isList ? '- ' : '') + clean;
      });
      var title = (paras.find(function (p) { return p.indexOf('# ') === 0; }) || '').slice(2);
      return { text: paras.join('\n'), title: title };
    });
  }

  function privacy() { return '<div class="privacy-note"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><p><strong>100% private.</strong> Your files are processed inside your browser and are never uploaded to any server. Close the tab and nothing remains.</p></div>'; }
  function dropzone(label, hint, multiple, accept) {
    return '<div class="dropzone dz"><input type="file" class="dz-in" accept="' + (accept || 'application/pdf,.pdf') + '"' + (multiple ? ' multiple' : '') + ' hidden><div style="width:4rem;height:4rem;border-radius:1rem;background:var(--grad-br);color:#fff;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div><p style="font-weight:800">' + esc(label) + '</p><p class="small muted">' + esc(hint || 'or drag & drop here') + '</p></div>';
  }
  function bindDrop(root, onFiles) {
    var dz = root.querySelector('.dz'), inp = root.querySelector('.dz-in');
    if (!dz) return;
    dz.addEventListener('click', function () { inp.click(); });
    dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', function () { dz.classList.remove('over'); });
    dz.addEventListener('drop', function (e) { e.preventDefault(); dz.classList.remove('over'); onFiles(Array.from(e.dataTransfer.files)); });
    inp.addEventListener('change', function () { onFiles(Array.from(inp.files || [])); inp.value = ''; });
  }
  function progress(v, label) { return '<div class="card"><div class="flex-between small muted mb-2"><span>' + esc(label) + '</span><span>' + Math.round(v) + '%</span></div><div class="progress-track" style="max-width:none;margin:0"><div class="progress-fill" style="width:' + v + '%"></div></div></div>'; }
  function errBox(m) { return '<div class="error-box">' + esc(m) + '</div>'; }
  function stat(label, value, tone) { return '<div class="te-stat' + (tone ? ' ' + tone : '') + '"><p>' + esc(label) + '</p><b>' + value + '</b></div>'; }
  function resultPanel(title, bytes, before, fileName, extra) {
    var saved = before ? Math.round((1 - bytes / before) * 100) : 0;
    return '<div class="result-ok"><div class="flex-between mb-4"><div class="flex"><span style="width:2.5rem;height:2.5rem;border-radius:999px;background:var(--emerald-500);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.1rem">✓</span><div><h3 class="h3" style="margin:0">' + esc(title) + '</h3>' + (fileName ? '<p class="small muted">' + esc(fileName) + '</p>' : '') + '</div></div><div class="te-row"><button type="button" class="btn btn-primary pdf-dl">⬇ Download</button><button type="button" class="btn btn-ghost pdf-reset">Start over</button></div></div>' +
      '<div class="grid grid-4">' + (before != null ? stat('Original size', fmtBytes(before)) : '') + stat(before != null ? 'New size' : 'File size', fmtBytes(bytes), 'good') + (before != null ? stat('Saved', Math.max(0, saved) + '%', saved > 0 ? 'good' : 'warn') + stat('Reduction', fmtBytes(Math.max(0, before - bytes))) : '') + '</div>' + (extra || '') + '</div>';
  }
  function fileInfo(file, info) {
    var rows = info ? [['Pages', String(info.pages)], ['Size', fmtBytes(info.size)], ['PDF version', info.version || '—'], ['Encrypted', info.encrypted ? 'Yes 🔒' : 'No'],
      ['Page size', info.pageSizes[0] ? paperName(info.pageSizes[0].w, info.pageSizes[0].h) + ' (' + info.pageSizes[0].w + '×' + info.pageSizes[0].h + ' pt)' : '—'],
      ['Orientation', info.pageSizes[0] ? (info.pageSizes[0].w > info.pageSizes[0].h ? 'Landscape' : 'Portrait') : '—'],
      ['Title', info.title || '—'], ['Author', info.author || '—'], ['Creator', info.creator || '—'], ['Producer', info.producer || '—'], ['Created', info.created || '—'], ['Modified', info.modified || '—']] : [];
    return '<div class="card"><div class="flex-between mb-4"><div class="flex"><span style="width:2.75rem;height:2.75rem;border-radius:.75rem;background:var(--red-50);color:var(--red-600);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.7rem">PDF</span><div><p style="font-weight:700">' + esc(file.name) + '</p><p class="small muted">' + fmtBytes(file.size) + (info ? ' · ' + info.pages + ' page' + (info.pages === 1 ? '' : 's') : '') + '</p></div></div><button type="button" class="link-btn pdf-rm">Remove</button></div>' +
      (info ? '<div class="grid grid-4">' + rows.map(function (r) { return '<div class="te-stat"><p>' + esc(r[0]) + '</p><b class="small" title="' + esc(r[1]) + '">' + esc(r[1]) + '</b></div>'; }).join('') + '</div>' : '') + '</div>';
  }
  function guideHtml(engine) {
    var COMPRESS_FAQ = [['Why did my text become non-selectable?', 'To hit a strict size target the tool re-renders pages as images. Choose “Lossless” (or a larger target) to keep real text.'], ['What decides the final size?', 'Page count, image content and resolution. Text-only PDFs compress a lot losslessly; scanned pages need image downsampling.'], ['Is quality lost forever?', 'Only in the downloaded copy. Your original file on disk is untouched.']];
    var COMPRESS_STEPS = ['Select or drop your PDF.', 'The tool first removes redundant objects and enables object streams (lossless).', 'If still over target, pages are re-rendered at progressively lower DPI/JPEG quality.', 'Download the smallest version that stays legible.'];
    var GUIDES = {
      'pdf-merge': { steps: ['Add two or more PDFs (drag & drop or click).', 'Reorder with the arrows — the list order is the page order.', 'Click Merge and download a single combined file.'], faqs: [['Is there a file or page limit?', 'No fixed limit; very large files are bounded only by your device memory.'], ['Are bookmarks and forms kept?', 'Pages, text, images and links are preserved. Bookmarks (outlines) are not merged.'], ['Can I merge password-protected PDFs?', 'Unlock them first with the Unlock PDF tool, then merge.']], tips: ['Name files 01-, 02-, 03- before uploading to keep a natural order.'] },
      'pdf-split': { steps: ['Upload a PDF; page thumbnails appear.', 'Choose a page range (e.g. 1-3,7), every page, or fixed chunks.', 'Download each file individually or all at once.'], faqs: [['Can I extract non-consecutive pages?', 'Yes: 1,4,9-12 creates one PDF containing exactly those pages.'], ['Does splitting reduce quality?', 'No. Pages are copied byte-for-byte; nothing is re-rendered.']] },
      'pdf-rotate': { steps: ['Upload a PDF and review thumbnails.', 'Rotate all pages, or click pages to select and rotate only those.', 'Apply and download — the rotation is saved permanently in the file.'], faqs: [['Will the rotation stick in every viewer?', 'Yes. The page /Rotate attribute is updated, which all PDF readers honour.'], ['Is quality affected?', 'No, rotation is metadata only.']] },
      'pdf-lock': { steps: ['Upload a PDF.', 'Set an open password (required) and optional owner password.', 'Choose what readers may do: print, copy, edit, annotate.', 'Download the AES-128 encrypted file.'], faqs: [['How strong is the encryption?', 'AES-128 (PDF 1.6 standard) — supported by Acrobat, Preview, Chrome, Edge and mobile readers.'], ['Can I recover a lost password?', 'No. There is no back door; keep the password in a password manager.'], ['What is the owner password for?', 'It lets you change permissions later without sharing the open password.']] },
      'pdf-unlock': { steps: ['Upload the protected PDF.', 'If it opens without a password, restrictions are stripped directly.', 'If it needs a password, enter it; the file is decrypted in your browser.', 'Download the unrestricted copy.'], faqs: [['Can this crack an unknown password?', 'No. It only removes protection when you either know the password or the file has owner-only restrictions.'], ['Is it legal?', 'Unlock only documents you own or have permission to modify.']] },
      'pdf-compress': { steps: COMPRESS_STEPS, faqs: COMPRESS_FAQ },
      'text-to-pdf': { steps: ['Type or paste text, or upload a .txt file.', 'Pick page size, font, margins and spacing.', 'Create and download the PDF with real, selectable text.'], faqs: [['Can I make headings and bullets?', 'Yes: start a line with # for a heading and - for a bullet.'], ['Which characters are supported?', 'Latin-1 (Western European). Other scripts are replaced with ? because standard PDF fonts do not include them.']] },
      'word-to-pdf': { steps: ['Upload a .docx (or .txt/.md).', 'The document XML is unzipped and parsed locally; headings and lists are detected.', 'Review the extracted content, choose layout options, convert.'], faqs: [['Why does layout differ from Word?', 'Browser-side conversion carries text structure, not fonts, images or tables. For pixel-perfect output use Word’s own “Save as PDF”.'], ['Is .doc supported?', 'Legacy binary .doc is not; save it as .docx first.']] },
      'pdf-to-word': { steps: ['Upload a text-based PDF.', 'Text is extracted page by page with paragraph detection.', 'Download an editable .docx (or .txt).'], faqs: [['Nothing was extracted — why?', 'The PDF is probably a scan (images of text). OCR is needed; use PDF To JPG and an OCR tool.'], ['Are images and tables converted?', 'No. Text flow, headings and page breaks are reconstructed; images and complex layouts are not.']] },
      'pdf-to-jpg': { steps: ['Upload a PDF.', 'Choose 72–300 DPI and JPG or PNG.', 'Pages are rendered by a full PDF renderer in your browser.', 'Save individual pages or download all.'], faqs: [['Which DPI should I use?', '72 for web thumbnails, 150 for screens/e-mail, 300 for print quality.'], ['JPG or PNG?', 'JPG for photos and scans (smaller). PNG for diagrams, text and transparency (lossless).']] },
      'jpg-to-pdf': { steps: ['Add images (JPG, PNG, WebP); each becomes a page.', 'Reorder, then pick page size, orientation, fit and margins.', 'Create and download the PDF.'], faqs: [['Is image quality reduced?', 'JPG and PNG files are embedded as-is with no re-compression. WebP/GIF are converted to JPG at 92% quality.'], ['Can I keep the original pixel size?', 'Yes — choose “Page = image size”.']] },
      'ppt-to-pdf': { steps: ['Upload a .pptx (slide text is extracted) or type slides using # Title and - bullets.', 'Choose 16:9 or 4:3 and a theme.', 'Create a clean PDF deck, one slide per page.'], faqs: [['Are images and animations from PowerPoint kept?', 'No — text content only. For full fidelity use PowerPoint’s Export → PDF.'], ['Can I use this for handouts?', 'Yes, the output is a compact, printable summary deck.']] },
      'excel-to-pdf': { steps: ['Upload .xlsx/.csv or paste cells copied from Excel or Google Sheets.', 'Set the title, header row and orientation.', 'Columns auto-fit; long tables paginate with repeated headers.'], faqs: [['Which sheet is used?', 'The first worksheet of an .xlsx. Save others as CSV to convert them.'], ['Are formulas evaluated?', 'The cached values stored in the file are used, so yes for saved workbooks.']] }
    };
    var key = engine.indexOf('pdf-compress') === 0 ? 'pdf-compress' : engine;
    var g = GUIDES[key]; if (!g) return '';
    var target = engine.indexOf('pdf-compress-') === 0 ? Number(engine.split('-').pop()) : 0;
    return '<div class="grid grid-2 mt-8"><div class="card"><h3 class="h3">How it works</h3><ol style="list-style:none">' + g.steps.map(function (s, i) { return '<li class="use-step mt-4"><span class="use-n" style="background:var(--indigo-600);color:#fff">' + (i + 1) + '</span>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      (g.tips ? '<div class="note mt-4">' + g.tips.map(function (t) { return '<p>💡 ' + esc(t) + '</p>'; }).join('') + '</div>' : '') +
      (target > 0 ? '<div class="te-stat mt-4"><p><strong>Where ' + target + ' KB matters:</strong> ' + (target <= 100 ? 'government e-services, exam and visa portals, and job application forms commonly cap uploads at 50–100 KB.' : target <= 300 ? 'university admissions, scholarship portals and many HR systems limit attachments to 200–300 KB.' : 'e-mail gateways and CMS uploads frequently reject attachments above 500 KB–1 MB.') + '</p></div>' : '') +
      '</div><div class="card"><h3 class="h3">Frequently asked questions</h3>' + g.faqs.concat([['Is my file uploaded anywhere?', 'No. The PDF engine runs in your browser. Your document never leaves your device, which also makes processing instant with no queue.']]).map(function (qa) {
        return '<details class="faq-item" style="border-top:1px solid var(--slate-100)"><summary class="faq-q">' + esc(qa[0]) + '<span class="chev">+</span></summary><p class="faq-a" style="display:block">' + esc(qa[1]) + '</p></details>';
      }).join('') + '</div></div>';
  }

  function buildTextPdf(opts) {
    return loadPdfLib().then(function (lib) {
      var doc = lib.PDFDocument.create();
      return Promise.all([doc.embedFont(lib.StandardFonts[opts.fontName]), doc.embedFont(opts.fontName === 'TimesRoman' ? lib.StandardFonts.TimesRomanBold : opts.fontName === 'Courier' ? lib.StandardFonts.CourierBold : lib.StandardFonts.HelveticaBold)]).then(function (fonts) {
        var font = fonts[0], bold = fonts[1];
        var wh = PAGE_SIZES[opts.size] || PAGE_SIZES.A4, w = opts.landscape ? wh[1] : wh[0], h = opts.landscape ? wh[0] : wh[1];
        var m = opts.margin, lh = opts.fontSize * opts.lineHeight, maxW = w - m * 2;
        var page = doc.addPage([w, h]), y = h - m, pageNo = 1;
        function footer() { if (opts.pageNumbers) page.drawText(String(pageNo), { x: w / 2 - 5, y: m / 2, size: 9, font: font, color: lib.rgb(0.5, 0.5, 0.5) }); }
        function newPage() { footer(); page = doc.addPage([w, h]); y = h - m; pageNo++; }
        if (opts.title) { page.drawText(toWinAnsi(opts.title), { x: m, y: y - 20, size: opts.fontSize + 8, font: bold, color: lib.rgb(0.1, 0.1, 0.2) }); y -= opts.fontSize + 8 + 24; }
        toWinAnsi(opts.text).split(/\n/).forEach(function (raw) {
          var isHeading = opts.headings && /^(#{1,3}\s|[A-Z][A-Z0-9 ,&'-]{6,}$)/.test(raw.trim());
          var isBullet = /^\s*[-*•]\s+/.test(raw);
          var line = raw.replace(/^#{1,3}\s/, '').replace(/^\s*[-*•]\s+/, '• ');
          var fnt = isHeading ? bold : font, fs = isHeading ? opts.fontSize + 3 : opts.fontSize;
          if (!line.trim()) { y -= lh * 0.6; return; }
          wrapText(line, fnt, fs, maxW - (isBullet ? 12 : 0)).forEach(function (l) {
            if (y - lh < m) newPage();
            page.drawText(l, { x: m + (isBullet ? 12 : 0), y: y - fs, size: fs, font: fnt, color: lib.rgb(0.12, 0.12, 0.15) });
            y -= lh;
          });
          if (isHeading) y -= lh * 0.3;
        });
        footer();
        doc.setProducer('SEO Audit Tool PDF Tools'); if (opts.title) doc.setTitle(opts.title);
        return doc.save().then(function (bytes) { return { bytes: bytes, pages: doc.getPageCount() }; });
      });
    });
  }

  /* ---- tools ---- */
  function mergePdf(cfg, mount) {
    var items = [], out = null, err = '';
    function draw() {
      var totalPages = items.reduce(function (a, i) { return a + ((i.info && i.info.pages) || 0); }, 0);
      var totalSize = items.reduce(function (a, i) { return a + i.file.size; }, 0);
      mount.innerHTML = '<div class="te">' + privacy() + dropzone(items.length ? 'Add more PDF files' : 'Select PDF files to merge', 'Drop 2 or more PDFs · any size', true) +
        (items.length && !out ? '<div class="grid grid-3">' + stat('Files', String(items.length)) + stat('Total pages', String(totalPages)) + stat('Total size', fmtBytes(totalSize)) + '</div>' +
          items.map(function (it, i) {
            return '<div class="card flex"><span style="width:2rem;height:2rem;border-radius:.5rem;background:var(--indigo-50);color:var(--indigo-700);font-weight:800;display:flex;align-items:center;justify-content:center">' + (i + 1) + '</span><div style="flex:1;min-width:0"><p style="font-weight:700;font-size:.9rem">' + esc(it.file.name) + '</p><p class="small muted">' + (it.info ? it.info.pages + ' pages · ' : '') + fmtBytes(it.file.size) + (it.info && it.info.encrypted ? ' · 🔒 encrypted' : '') + '</p></div><div class="te-row"><button type="button" class="btn btn-ghost mv-up" data-i="' + i + '" ' + (i === 0 ? 'disabled' : '') + '>↑</button><button type="button" class="btn btn-ghost mv-dn" data-i="' + i + '" ' + (i === items.length - 1 ? 'disabled' : '') + '>↓</button><button type="button" class="btn btn-ghost rm" data-i="' + i + '" style="color:var(--red-600)">×</button></div></div>';
          }).join('') + '<div class="mg-busy"></div><button type="button" class="btn btn-primary mg-go" ' + (items.length < 2 ? 'disabled' : '') + '>Merge ' + items.length + ' PDF' + (items.length === 1 ? '' : 's') + ' →</button>' + (items.length < 2 ? '<p class="small muted text-center">Add at least two files to merge.</p>' : '') : '') +
        (err ? errBox(err) : '') + (out ? resultPanel('PDFs merged successfully', out.byteLength, null, 'merged.pdf', '<p class="small muted mt-4">' + items.length + ' files · ' + totalPages + ' pages combined in order shown.</p>') : '') +
        guideHtml('pdf-merge') + '</div>';
      bindDrop(mount, add);
      mount.querySelectorAll('.mv-up').forEach(function (b) { b.addEventListener('click', function () { move(+b.getAttribute('data-i'), -1); }); });
      mount.querySelectorAll('.mv-dn').forEach(function (b) { b.addEventListener('click', function () { move(+b.getAttribute('data-i'), 1); }); });
      mount.querySelectorAll('.rm').forEach(function (b) { b.addEventListener('click', function () { items = items.filter(function (_, j) { return j !== +b.getAttribute('data-i'); }); draw(); }); });
      var go = mount.querySelector('.mg-go'); if (go) go.addEventListener('click', merge);
      var dl = mount.querySelector('.pdf-dl'); if (dl) dl.addEventListener('click', function () { download(out, 'merged.pdf'); });
      var rs = mount.querySelector('.pdf-reset'); if (rs) rs.addEventListener('click', function () { items = []; out = null; err = ''; draw(); });
    }
    function add(files) {
      err = ''; out = null;
      Promise.all(files.map(function (file) { return readFile(file).then(function (buf) { return inspectPdf(buf).then(function (info) { return { file: file, buf: buf, info: info }; }).catch(function () { return { file: file, buf: buf, info: null }; }); }); })).then(function (loaded) { items = items.concat(loaded); draw(); });
    }
    function move(i, d) { var j = i + d; if (j < 0 || j >= items.length) return; var t = items[i]; items[i] = items[j]; items[j] = t; draw(); }
    function merge() {
      var busy = mount.querySelector('.mg-busy'); if (busy) busy.innerHTML = progress(0, 'Merging documents…');
      loadPdfLib().then(function (lib) {
        var doc = lib.PDFDocument.create();
        function next(i) {
          if (i >= items.length) { doc.setProducer('SEO Audit Tool PDF Tools'); doc.setCreator('SEO Audit Tool'); return doc.save(); }
          return lib.PDFDocument.load(items[i].buf, { ignoreEncryption: true }).then(function (src) {
            return doc.copyPages(src, src.getPageIndices()).then(function (pages) { pages.forEach(function (p) { doc.addPage(p); }); if (busy) busy.innerHTML = progress(((i + 1) / items.length) * 100, 'Merging documents…'); return next(i + 1); });
          });
        }
        return next(0);
      }).then(function (bytes) { out = bytes; draw(); }).catch(function (e) { err = 'Merge failed: ' + String(e.message || e).slice(0, 160) + '. Encrypted files must be unlocked first.'; draw(); });
    }
    draw();
  }

  function loadOnePdf(onReady) {
    return function inner(cfg, mount) {
      var state = { file: null, buf: null, info: null, error: '' };
      function reset() { state = { file: null, buf: null, info: null, error: '' }; draw(); }
      function draw() { onReady(cfg, mount, state, { reset: reset, draw: draw, load: load }); }
      function load(file) {
        state.error = ''; state.file = file; state.info = null;
        readFile(file).then(function (b) { state.buf = b; return inspectPdf(b); }).then(function (info) { state.info = info; draw(); }).catch(function (e) { state.error = 'Could not read this PDF: ' + String(e.message || e).slice(0, 160); state.buf = null; draw(); });
      }
      draw();
    };
  }

  var splitPdf = loadOnePdf(function (cfg, mount, st, api) {
    var mode = 'range', ranges = '1-3', chunk = 2, outs = [], busy = false;
    function paint() {
      mount.innerHTML = '<div class="te">' + privacy() + (!st.file ? dropzone('Select a PDF to split') : fileInfo(st.file, st.info) +
        (!outs.length ? '<div class="card"><p class="eyebrow">Split mode</p><div class="te-row mb-4"><button type="button" class="pill' + (mode === 'range' ? ' on' : '') + '" data-m="range">Page range</button><button type="button" class="pill' + (mode === 'every' ? ' on' : '') + '" data-m="every">Every page</button><button type="button" class="pill' + (mode === 'chunk' ? ' on' : '') + '" data-m="chunk">Fixed chunks</button></div>' +
          (mode === 'range' ? '<label class="field-label">Pages (e.g. 1-3,5,8-10)</label><input class="input sp-range" value="' + esc(ranges) + '">' : '') +
          (mode === 'chunk' ? '<label class="field-label">Pages per file</label><input type="number" min="1" class="input sp-chunk" value="' + chunk + '">' : '') +
          (busy ? progress(60, 'Splitting…') : '<button type="button" class="btn btn-primary sp-go mt-4">Split PDF →</button>') + '</div>' : '') +
        (outs.length ? '<div class="te">' + outs.map(function (o, i) { return '<div class="card flex-between"><div><p style="font-weight:700">' + esc(o.name) + '</p><p class="small muted">' + o.pages + ' · ' + fmtBytes(o.bytes.byteLength) + '</p></div><button type="button" class="btn btn-primary odl" data-i="' + i + '">Download</button></div>'; }).join('') + '<button type="button" class="btn btn-ghost pdf-reset">Start over</button></div>' : '')) +
        (st.error ? errBox(st.error) : '') + guideHtml('pdf-split') + '</div>';
      bindDrop(mount, function (fs) { if (fs[0]) api.load(fs[0]); });
      var rm = mount.querySelector('.pdf-rm'); if (rm) rm.addEventListener('click', api.reset);
      mount.querySelectorAll('[data-m]').forEach(function (b) { b.addEventListener('click', function () { mode = b.getAttribute('data-m'); paint(); }); });
      var r = mount.querySelector('.sp-range'); if (r) r.addEventListener('input', function () { ranges = r.value; });
      var c = mount.querySelector('.sp-chunk'); if (c) c.addEventListener('input', function () { chunk = Number(c.value); });
      var go = mount.querySelector('.sp-go'); if (go) go.addEventListener('click', run);
      mount.querySelectorAll('.odl').forEach(function (b) { b.addEventListener('click', function () { var o = outs[+b.getAttribute('data-i')]; download(o.bytes, o.name); }); });
      var rs = mount.querySelector('.pdf-reset'); if (rs) rs.addEventListener('click', function () { outs = []; api.reset(); });
    }
    function run() {
      if (!st.buf || !st.info) return; busy = true; outs = []; st.error = ''; paint();
      loadPdfLib().then(function (lib) {
        return lib.PDFDocument.load(st.buf, { ignoreEncryption: true }).then(function (src) {
          var total = src.getPageCount();
          var groups = mode === 'range' ? [parseRanges(ranges, total)] : mode === 'every' ? Array.from({ length: total }, function (_, i) { return [i]; }) : Array.from({ length: Math.ceil(total / chunk) }, function (_, g) { return Array.from({ length: Math.min(chunk, total - g * chunk) }, function (_, i) { return g * chunk + i; }); });
          if (!groups[0] || !groups[0].length) throw new Error('No valid pages selected. Use a format like 1-3,5,8-10.');
          var res = [];
          function next(g) {
            if (g >= groups.length) return res;
            var doc = lib.PDFDocument.create();
            return doc.copyPages(src, groups[g]).then(function (pages) {
              pages.forEach(function (p) { doc.addPage(p); });
              var label = groups[g].length === 1 ? 'page-' + (groups[g][0] + 1) : 'pages-' + (groups[g][0] + 1) + '-' + (groups[g][groups[g].length - 1] + 1);
              return doc.save().then(function (bytes) { res.push({ name: base(st.file.name) + '-' + label + '.pdf', bytes: bytes, pages: groups[g].map(function (i) { return i + 1; }).join(', ') }); return next(g + 1); });
            });
          }
          return next(0);
        });
      }).then(function (res) { outs = res; busy = false; paint(); }).catch(function (e) { st.error = String(e.message || e); busy = false; paint(); });
    }
    paint();
  });

  var rotatePdf = loadOnePdf(function (cfg, mount, st, api) {
    var rot = {}, out = null, busy = false;
    function paint() {
      mount.innerHTML = '<div class="te">' + privacy() + (!st.file ? dropzone('Select a PDF to rotate') : fileInfo(st.file, st.info) +
        (!out ? '<div class="card"><div class="te-row"><span class="field-label" style="margin:0">All pages:</span><button type="button" class="btn btn-ghost rot-all" data-d="90">Rotate 90°</button><button type="button" class="btn btn-ghost rot-all" data-d="180">180°</button><button type="button" class="btn btn-ghost rot-all" data-d="270">270°</button></div>' + (busy ? progress(50, 'Applying rotation…') : '<button type="button" class="btn btn-primary rot-go mt-4">Apply rotation →</button>') + '</div>' : resultPanel('PDF rotated', out.byteLength, st.file.size, base(st.file.name) + '-rotated.pdf'))) +
        (st.error ? errBox(st.error) : '') + guideHtml('pdf-rotate') + '</div>';
      bindDrop(mount, function (fs) { if (fs[0]) api.load(fs[0]); });
      var rm = mount.querySelector('.pdf-rm'); if (rm) rm.addEventListener('click', function () { rot = {}; out = null; api.reset(); });
      mount.querySelectorAll('.rot-all').forEach(function (b) { b.addEventListener('click', function () { var d = +b.getAttribute('data-d'); if (!st.info) return; for (var i = 0; i < st.info.pages; i++) rot[i] = ((rot[i] || 0) + d) % 360; }); });
      var go = mount.querySelector('.rot-go'); if (go) go.addEventListener('click', run);
      var dl = mount.querySelector('.pdf-dl'); if (dl) dl.addEventListener('click', function () { download(out, base(st.file.name) + '-rotated.pdf'); });
      var rs = mount.querySelector('.pdf-reset'); if (rs) rs.addEventListener('click', function () { rot = {}; out = null; api.reset(); });
    }
    function run() {
      if (!st.buf) return; busy = true; paint();
      loadPdfLib().then(function (lib) {
        return lib.PDFDocument.load(st.buf, { ignoreEncryption: true }).then(function (doc) {
          doc.getPages().forEach(function (p, i) { var r = rot[i] || 0; if (r) p.setRotation(lib.degrees((p.getRotation().angle + r) % 360)); });
          return doc.save();
        });
      }).then(function (bytes) { out = bytes; busy = false; paint(); }).catch(function (e) { st.error = String(e.message || e); busy = false; paint(); });
    }
    paint();
  });

  var lockPdf = loadOnePdf(function (cfg, mount, st, api) {
    var userPw = '', ownerPw = '', out = null, busy = false, perm = { printing: true, copying: true, modifying: false, annotating: true };
    function paint() {
      var p = userPw, s = 0; if (p.length >= 8) s++; if (/[A-Z]/.test(p)) s++; if (/[0-9]/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++; if (p.length >= 12) s++;
      mount.innerHTML = '<div class="te">' + privacy() + (!st.file ? dropzone('Select a PDF to protect') : fileInfo(st.file, st.info) +
        (!out ? '<div class="card te"><label class="field-label">Open password</label><input type="password" class="input lk-pw" value="' + esc(userPw) + '"><p class="small muted">Strength: ' + s + '/5</p><label class="field-label">Owner password (optional)</label><input type="password" class="input lk-ow" value="' + esc(ownerPw) + '">' +
          '<div class="grid grid-2">' + [['printing', 'Allow printing'], ['copying', 'Allow copying'], ['modifying', 'Allow modifying'], ['annotating', 'Allow annotating']].map(function (x) { return '<label class="flex"><input type="checkbox" class="lk-p" data-k="' + x[0] + '"' + (perm[x[0]] ? ' checked' : '') + '> ' + x[1] + '</label>'; }).join('') + '</div>' +
          (busy ? progress(50, 'Encrypting…') : '<button type="button" class="btn btn-primary lk-go"' + (userPw ? '' : ' disabled') + '>Lock PDF →</button>') + '</div>' : resultPanel('PDF locked and encrypted', out.byteLength, st.file.size, base(st.file.name) + '-locked.pdf', '<p class="warn-box mt-4">Store your password safely — there is no way to recover an encrypted PDF without it.</p>'))) +
        (st.error ? errBox(st.error) : '') + guideHtml('pdf-lock') + '</div>';
      bindDrop(mount, function (fs) { if (fs[0]) api.load(fs[0]); });
      var rm = mount.querySelector('.pdf-rm'); if (rm) rm.addEventListener('click', function () { out = null; api.reset(); });
      var pw = mount.querySelector('.lk-pw'); if (pw) pw.addEventListener('input', function () { userPw = pw.value; paint(); });
      var ow = mount.querySelector('.lk-ow'); if (ow) ow.addEventListener('input', function () { ownerPw = ow.value; });
      mount.querySelectorAll('.lk-p').forEach(function (c) { c.addEventListener('change', function () { perm[c.getAttribute('data-k')] = c.checked; }); });
      var go = mount.querySelector('.lk-go'); if (go) go.addEventListener('click', run);
      var dl = mount.querySelector('.pdf-dl'); if (dl) dl.addEventListener('click', function () { download(out, base(st.file.name) + '-locked.pdf'); });
      var rs = mount.querySelector('.pdf-reset'); if (rs) rs.addEventListener('click', function () { out = null; userPw = ''; ownerPw = ''; api.reset(); });
    }
    function run() {
      if (!st.buf || !userPw) return; busy = true; paint();
      loadPdfLib().then(function (lib) {
        return lib.PDFDocument.load(st.buf, { ignoreEncryption: true }).then(function (doc) {
          if (typeof doc.encrypt !== 'function') throw new Error('Encryption is not supported by the bundled PDF library version.');
          return Promise.resolve(doc.encrypt({ userPassword: userPw, ownerPassword: ownerPw || userPw + '-owner', permissions: { printing: perm.printing ? 'highResolution' : undefined, copying: perm.copying, modifying: perm.modifying, annotating: perm.annotating, fillingForms: true, contentAccessibility: true, documentAssembly: perm.modifying } })).then(function () { return doc.save(); });
        });
      }).then(function (bytes) { out = bytes; busy = false; paint(); }).catch(function (e) { st.error = 'Could not encrypt: ' + String(e.message || e).slice(0, 200); busy = false; paint(); });
    }
    paint();
  });

  var unlockPdf = loadOnePdf(function (cfg, mount, st, api) {
    var pw = '', out = null, note = '', busy = false;
    function paint() {
      mount.innerHTML = '<div class="te">' + privacy() + (!st.file ? dropzone('Select a protected PDF') : fileInfo(st.file, st.info) +
        (!out ? '<div class="card te"><label class="field-label">Open password (if required)</label><input type="password" class="input un-pw" value="' + esc(pw) + '">' + (busy ? progress(50, 'Unlocking…') : '<button type="button" class="btn btn-primary un-go">Unlock PDF →</button>') + '</div>' : resultPanel('PDF unlocked', out.byteLength, st.file.size, base(st.file.name) + '-unlocked.pdf', note ? '<p class="small muted mt-4">' + esc(note) + '</p>' : ''))) +
        (st.error ? errBox(st.error) : '') + guideHtml('pdf-unlock') + '</div>';
      bindDrop(mount, function (fs) { if (fs[0]) api.load(fs[0]); });
      var rm = mount.querySelector('.pdf-rm'); if (rm) rm.addEventListener('click', function () { out = null; api.reset(); });
      var p = mount.querySelector('.un-pw'); if (p) p.addEventListener('input', function () { pw = p.value; });
      var go = mount.querySelector('.un-go'); if (go) go.addEventListener('click', run);
      var dl = mount.querySelector('.pdf-dl'); if (dl) dl.addEventListener('click', function () { download(out, base(st.file.name) + '-unlocked.pdf'); });
      var rs = mount.querySelector('.pdf-reset'); if (rs) rs.addEventListener('click', function () { out = null; pw = ''; note = ''; api.reset(); });
    }
    function run() {
      if (!st.buf) return; busy = true; st.error = ''; note = ''; paint();
      loadPdfLib().then(function (lib) {
        return lib.PDFDocument.load(st.buf, { ignoreEncryption: true }).then(function (doc) {
          var clean = lib.PDFDocument.create();
          return clean.copyPages(doc, doc.getPageIndices()).then(function (pages) {
            pages.forEach(function (p) { clean.addPage(p); });
            return clean.save().then(function (bytes) {
              return lib.PDFDocument.load(bytes).then(function () { out = bytes; note = 'Restrictions removed from ' + doc.getPageCount() + ' pages. Printing, copying and editing are now allowed.'; });
            });
          });
        }).catch(function () { return null; }).then(function () {
          if (out) return;
          if (!pw) throw new Error('This PDF requires its open password. Enter the password and try again.');
          return renderPages(st.buf, { scale: 2, quality: 0.92, password: pw }).then(function (imgs) {
            return imagesToPdf(imgs).then(function (bytes) { out = bytes; note = 'Password verified. This file used strong encryption, so pages were rebuilt as high-resolution images; text is no longer selectable.'; });
          });
        });
      }).then(function () { busy = false; paint(); }).catch(function (e) { st.error = String(e.message || e); busy = false; paint(); });
    }
    paint();
  });

  function compressPdf(targetKb) {
    return loadOnePdf(function (cfg, mount, st, api) {
      var out = null, busy = false, status = '', attempts = [], lossless = false;
      function paint() {
        mount.innerHTML = '<div class="te">' + privacy() + (!st.file ? dropzone('Select a PDF to compress') : fileInfo(st.file, st.info) +
          (!out ? (busy ? progress(55, status || 'Compressing…') : '<button type="button" class="btn btn-primary cp-go">Compress' + (targetKb ? ' to ' + targetKb + ' KB' : '') + ' →</button>') : resultPanel(lossless ? 'Compressed (lossless)' : 'Compressed', out.byteLength, st.file.size, base(st.file.name) + '-compressed.pdf', attempts.length ? '<p class="small muted mt-4">Attempts: ' + attempts.map(function (a) { return (a.scale ? Math.round(a.scale * 72) + ' dpi @ ' + Math.round(a.quality * 100) + '%' : 'lossless') + ' → ' + fmtBytes(a.size); }).join(' · ') + '</p>' : ''))) +
          (st.error ? errBox(st.error) : '') + guideHtml(targetKb ? 'pdf-compress-' + targetKb : 'pdf-compress') + '</div>';
        bindDrop(mount, function (fs) { if (fs[0]) api.load(fs[0]); });
        var rm = mount.querySelector('.pdf-rm'); if (rm) rm.addEventListener('click', function () { out = null; api.reset(); });
        var go = mount.querySelector('.cp-go'); if (go) go.addEventListener('click', run);
        var dl = mount.querySelector('.pdf-dl'); if (dl) dl.addEventListener('click', function () { download(out, base(st.file.name) + '-compressed.pdf'); });
        var rs = mount.querySelector('.pdf-reset'); if (rs) rs.addEventListener('click', function () { out = null; api.reset(); });
      }
      function run() {
        if (!st.buf) return; busy = true; st.error = ''; paint();
        compressToTarget(st.buf, targetKb ? targetKb * 1024 : null, function (s) { status = s; }).then(function (r) { out = r.bytes; attempts = r.attempts; lossless = r.lossless; busy = false; paint(); }).catch(function (e) { st.error = String(e.message || e); busy = false; paint(); });
      }
      paint();
    });
  }

  function textOpts(o) {
    return '<div class="grid grid-4">' +
      '<div><label class="field-label">Page size</label><select class="select to-size">' + Object.keys(PAGE_SIZES).map(function (s) { return '<option' + (o.size === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
      '<div><label class="field-label">Font</label><select class="select to-font"><option value="Helvetica">Helvetica (sans)</option><option value="TimesRoman">Times (serif)</option><option value="Courier">Courier (mono)</option></select></div>' +
      '<div><label class="field-label">Font size ' + o.fontSize + 'pt</label><input type="range" min="8" max="18" class="to-fs" value="' + o.fontSize + '"></div>' +
      '<div><label class="field-label">Margins ' + Math.round(o.margin / 72 * 25.4) + 'mm</label><input type="range" min="36" max="90" class="to-mg" value="' + o.margin + '"></div>' +
      '<div><label class="field-label">Line spacing ' + o.lineHeight.toFixed(1) + '</label><input type="range" min="1.1" max="2" step="0.1" class="to-lh" value="' + o.lineHeight + '"></div>' +
      '<label class="flex" style="margin-top:1.4rem"><input type="checkbox" class="to-ls"' + (o.landscape ? ' checked' : '') + '> Landscape</label>' +
      '<label class="flex" style="margin-top:1.4rem"><input type="checkbox" class="to-pn"' + (o.pageNumbers ? ' checked' : '') + '> Page numbers</label></div>';
  }
  function bindOpts(root, o, redraw) {
    root.querySelector('.to-size').value = o.size; root.querySelector('.to-font').value = o.fontName;
    root.querySelector('.to-size').addEventListener('change', function (e) { o.size = e.target.value; });
    root.querySelector('.to-font').addEventListener('change', function (e) { o.fontName = e.target.value; });
    root.querySelector('.to-fs').addEventListener('input', function (e) { o.fontSize = Number(e.target.value); if (redraw) redraw(); });
    root.querySelector('.to-mg').addEventListener('input', function (e) { o.margin = Number(e.target.value); if (redraw) redraw(); });
    root.querySelector('.to-lh').addEventListener('input', function (e) { o.lineHeight = Number(e.target.value); if (redraw) redraw(); });
    root.querySelector('.to-ls').addEventListener('change', function (e) { o.landscape = e.target.checked; });
    root.querySelector('.to-pn').addEventListener('change', function (e) { o.pageNumbers = e.target.checked; });
  }

  function textToPdf(cfg, mount) {
    var text = '', title = '', o = { size: 'A4', landscape: false, fontName: 'Helvetica', fontSize: 11, margin: 56, lineHeight: 1.4, pageNumbers: true }, out = null, err = '';
    function draw() {
      mount.innerHTML = '<div class="te">' + privacy() + '<div class="card te"><input class="input tt-title" placeholder="Document title (optional)" value="' + esc(title) + '"><textarea class="textarea tt-text" rows="12" placeholder="Type or paste text…">' + esc(text) + '</textarea>' + textOpts(o) + '<button type="button" class="btn btn-primary tt-go">Create PDF →</button></div>' + (err ? errBox(err) : '') + (out ? resultPanel('PDF ready · ' + out.pages + ' page' + (out.pages === 1 ? '' : 's'), out.bytes.byteLength, null, (title || 'document') + '.pdf') : '') + guideHtml('text-to-pdf') + '</div>';
      bindOpts(mount, o, draw);
      mount.querySelector('.tt-title').addEventListener('input', function (e) { title = e.target.value; });
      mount.querySelector('.tt-text').addEventListener('input', function (e) { text = e.target.value; });
      mount.querySelector('.tt-go').addEventListener('click', function () {
        err = ''; buildTextPdf({ text: text, title: title, headings: true, size: o.size, landscape: o.landscape, fontName: o.fontName, fontSize: o.fontSize, margin: o.margin, lineHeight: o.lineHeight, pageNumbers: o.pageNumbers }).then(function (r) { out = r; draw(); }).catch(function (e) { err = String(e.message || e); draw(); });
      });
      var dl = mount.querySelector('.pdf-dl'); if (dl) dl.addEventListener('click', function () { download(out.bytes, (title || 'document') + '.pdf'); });
      var rs = mount.querySelector('.pdf-reset'); if (rs) rs.addEventListener('click', function () { out = null; draw(); });
    }
    draw();
  }

  function wordToPdf(cfg, mount) {
    var text = '', title = '', fileName = '', o = { size: 'A4', landscape: false, fontName: 'Helvetica', fontSize: 11, margin: 56, lineHeight: 1.4, pageNumbers: true }, out = null, err = '', busy = false;
    function draw() {
      var paras = text.split('\n').filter(function (l) { return l.trim(); }).length;
      mount.innerHTML = '<div class="te">' + privacy() + (!text ? dropzone('Select a Word document (.docx)', 'Also accepts .txt / .md · parsed locally, nothing uploaded', false, '.docx,.txt,.md,.rtf,application/vnd.openxmlformats-officedocument.wordprocessingml.document') + '<p class="text-center small muted">or <button type="button" class="link-btn wd-paste">paste text manually</button></p>' :
        '<div class="card flex-between"><div class="flex"><span style="width:2.75rem;height:2.75rem;border-radius:.75rem;background:#eff6ff;color:#1d4ed8;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.7rem">DOCX</span><div><p style="font-weight:700">' + esc(fileName || 'Pasted text') + '</p><p class="small muted">' + paras + ' paragraphs · ' + text.trim().split(/\s+/).length.toLocaleString() + ' words</p></div></div><button type="button" class="link-btn wd-rm">Remove</button></div>' +
        '<details class="card"><summary style="cursor:pointer;font-weight:600">Preview / edit extracted content</summary><textarea class="textarea wd-text" rows="12">' + esc(text) + '</textarea></details>' +
        '<div class="card te"><input class="input wd-title" placeholder="Document title" value="' + esc(title) + '">' + textOpts(o) + '<button type="button" class="btn btn-primary wd-go">Convert to PDF →</button></div>') +
        (busy ? progress(60, 'Reading document…') : '') + (err ? errBox(err) : '') + (out ? resultPanel('Converted · ' + out.pages + ' page' + (out.pages === 1 ? '' : 's'), out.bytes.byteLength, null, (title || base(fileName) || 'document') + '.pdf', '<p class="small muted mt-4">Text, headings and lists are preserved. Images, tables and complex layouts from Word are not carried over by browser-side conversion.</p>') : '') + guideHtml('word-to-pdf') + '</div>';
      bindDrop(mount, onFile);
      var paste = mount.querySelector('.wd-paste'); if (paste) paste.addEventListener('click', function () { text = ' '; draw(); });
      var rm = mount.querySelector('.wd-rm'); if (rm) rm.addEventListener('click', function () { text = ''; out = null; fileName = ''; draw(); });
      var ta = mount.querySelector('.wd-text'); if (ta) ta.addEventListener('input', function () { text = ta.value; });
      var ti = mount.querySelector('.wd-title'); if (ti) { bindOpts(mount, o); ti.addEventListener('input', function () { title = ti.value; }); }
      var go = mount.querySelector('.wd-go'); if (go) go.addEventListener('click', function () { buildTextPdf({ text: text, title: title, headings: true, size: o.size, landscape: o.landscape, fontName: o.fontName, fontSize: o.fontSize, margin: o.margin, lineHeight: o.lineHeight, pageNumbers: o.pageNumbers }).then(function (r) { out = r; err = ''; draw(); }).catch(function (e) { err = String(e.message || e); draw(); }); });
      var dl = mount.querySelector('.pdf-dl'); if (dl) dl.addEventListener('click', function () { download(out.bytes, (title || base(fileName) || 'document') + '.pdf'); });
      var rs = mount.querySelector('.pdf-reset'); if (rs) rs.addEventListener('click', function () { out = null; draw(); });
    }
    function onFile(fs) {
      var f = fs[0]; err = ''; out = null; busy = true; fileName = f.name; draw();
      var done = function () { busy = false; draw(); };
      if (/\.docx$/i.test(f.name)) readFile(f).then(docxToText).then(function (r) { text = r.text; title = r.title || base(f.name); done(); }).catch(function (e) { err = String(e.message || e); done(); });
      else if (/\.(txt|md|rtf)$/i.test(f.name)) f.text().then(function (t) { text = t.replace(/\\par[d]?/g, '\n').replace(/\{\\[^}]*\}|\\[a-z]+-?\d* ?/g, ''); title = base(f.name); done(); });
      else if (/\.doc$/i.test(f.name)) { err = 'Legacy .doc (Word 97-2003) is a binary format that cannot be parsed in the browser. Save it as .docx in Word and try again, or paste the text.'; done(); }
      else { err = 'Unsupported file. Upload .docx, .txt or .md.'; done(); }
    }
    draw();
  }

  var pdfToWord = loadOnePdf(function (cfg, mount, st, api) {
    var pages = null, pct = 0, busy = false, docxBlob = null;
    function paint() {
      var words = pages ? pages.join(' ').trim().split(/\s+/).filter(Boolean).length : 0;
      mount.innerHTML = '<div class="te">' + privacy() + (!st.file ? dropzone('Select a PDF to convert to Word') : fileInfo(st.file, st.info) +
        (!docxBlob && !busy ? '<button type="button" class="btn btn-primary pw-go">Convert to Word (.docx) →</button>' : '') + (busy ? progress(pct, 'Extracting text and building document…') : '')) +
        (st.error ? errBox(st.error) : '') +
        (docxBlob && pages && st.file ? resultPanel('Word document ready', docxBlob.size, null, base(st.file.name) + '.docx', '<div class="grid grid-3 mt-4">' + stat('Pages', String(pages.length)) + stat('Words extracted', words.toLocaleString()) + stat('Characters', pages.join('').length.toLocaleString()) + '</div><div class="te-row mt-4"><button type="button" class="btn btn-ghost pw-txt">Download as .txt</button><button type="button" class="btn btn-ghost pw-copy">Copy text</button></div><details class="mt-4"><summary class="small muted" style="cursor:pointer">Preview extracted text</summary><pre class="output-pre" style="max-height:18rem;background:var(--slate-50);color:var(--slate-700);padding:1rem;border-radius:.75rem">' + esc(pages.slice(0, 3).join('\n\n— — —\n\n').slice(0, 6000)) + (pages.length > 3 ? '\n\n… (more pages in the download)' : '') + '</pre></details><p class="small muted mt-4">Text flow, headings and page breaks are reconstructed. Fonts, images and exact layout cannot be recovered from a PDF in the browser.</p>') : '') +
        guideHtml('pdf-to-word') + '</div>';
      bindDrop(mount, function (fs) { if (fs[0]) api.load(fs[0]); });
      var rm = mount.querySelector('.pdf-rm'); if (rm) rm.addEventListener('click', function () { pages = null; docxBlob = null; api.reset(); });
      var go = mount.querySelector('.pw-go'); if (go) go.addEventListener('click', run);
      var dl = mount.querySelector('.pdf-dl'); if (dl) dl.addEventListener('click', function () { download(docxBlob, base(st.file.name) + '.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); });
      var rs = mount.querySelector('.pdf-reset'); if (rs) rs.addEventListener('click', function () { pages = null; docxBlob = null; api.reset(); });
      var txt = mount.querySelector('.pw-txt'); if (txt) txt.addEventListener('click', function () { download(new Blob([pages.join('\n\n---- Page break ----\n\n')], { type: 'text/plain' }), base(st.file.name) + '.txt', 'text/plain'); });
      var cp = mount.querySelector('.pw-copy'); if (cp) cp.addEventListener('click', function () { navigator.clipboard && navigator.clipboard.writeText(pages.join('\n\n')); });
    }
    function run() {
      if (!st.buf) return; busy = true; pages = null; docxBlob = null; st.error = ''; paint();
      extractText(st.buf, function (d, t) { pct = (d / t) * 90; }).then(function (txt) {
        pages = txt;
        var totalChars = txt.join('').length;
        if (totalChars < 20) { st.error = 'No selectable text found — this PDF is probably a scan. Use PDF To JPG to get images of the pages.'; busy = false; paint(); return; }
        return loadDocx().then(function (docx) {
          var children = [];
          txt.forEach(function (p, i) {
            p.split(/\n{2,}/).forEach(function (block) {
              var lines = block.split('\n');
              var isHeading = lines.length === 1 && lines[0].length < 80 && /^[A-Z0-9]/.test(lines[0]) && !/[.!?]$/.test(lines[0]);
              children.push(new docx.Paragraph({ children: [new docx.TextRun({ text: lines.join(' '), bold: isHeading, size: isHeading ? 28 : 22 })], heading: isHeading ? docx.HeadingLevel.HEADING_2 : undefined, spacing: { after: 160 } }));
            });
            if (i < txt.length - 1) children.push(new docx.Paragraph({ children: [new docx.PageBreak()] }));
          });
          var document = new docx.Document({ creator: 'SEO Audit Tool', title: (st.info && st.info.title) || base(st.file.name), sections: [{ children: children }] });
          return docx.Packer.toBlob(document).then(function (blob) { docxBlob = blob; pct = 100; busy = false; paint(); });
        });
      }).catch(function (e) { st.error = 'Conversion failed: ' + String(e.message || e).slice(0, 160); busy = false; paint(); });
    }
    paint();
  });

  var pdfToJpg = loadOnePdf(function (cfg, mount, st, api) {
    var dpi = 150, quality = 0.85, fmt = 'image/jpeg', imgs = [], busy = false, pct = 0;
    function paint() {
      var ext = fmt === 'image/png' ? 'png' : 'jpg';
      var total = imgs.reduce(function (a, i) { return a + i.blob.size; }, 0);
      mount.innerHTML = '<div class="te">' + privacy() + (!st.file ? dropzone('Select a PDF to convert to images') : fileInfo(st.file, st.info) +
        (!imgs.length ? '<div class="card te"><div class="grid grid-3"><div><label class="field-label">DPI ' + dpi + '</label><input type="range" min="72" max="300" class="pj-dpi" value="' + dpi + '"></div><div><label class="field-label">Quality</label><input type="range" min="0.4" max="1" step="0.05" class="pj-q" value="' + quality + '"></div><div><label class="field-label">Format</label><select class="select pj-fmt"><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select></div></div>' + (busy ? progress(pct, 'Rendering pages…') : '<button type="button" class="btn btn-primary pj-go">Convert to images →</button>') + '</div>' : '<div class="result-ok"><div class="flex-between mb-4"><h3 class="h3" style="margin:0">Images ready</h3><div class="te-row"><button type="button" class="btn btn-primary pj-all">Download all</button><button type="button" class="btn btn-ghost pdf-reset">Start over</button></div></div><div class="grid grid-3">' + stat('Pages', String(imgs.length)) + stat('Total size', fmtBytes(total), 'good') + stat('Format', ext.toUpperCase()) + '</div><div class="grid grid-3 mt-4">' + imgs.map(function (im, i) { return '<div class="card card-p0"><img src="' + im.url + '" alt="Page ' + im.page + '" style="width:100%"><div class="flex-between" style="padding:.5rem"><span class="small muted">Page ' + im.page + '</span><button type="button" class="btn btn-ghost pjd" data-i="' + i + '">Save</button></div></div>'; }).join('') + '</div></div>')) +
        (st.error ? errBox(st.error) : '') + guideHtml('pdf-to-jpg') + '</div>';
      bindDrop(mount, function (fs) { if (fs[0]) api.load(fs[0]); });
      var rm = mount.querySelector('.pdf-rm'); if (rm) rm.addEventListener('click', function () { imgs = []; api.reset(); });
      var d = mount.querySelector('.pj-dpi'); if (d) { d.addEventListener('input', function () { dpi = Number(d.value); paint(); }); }
      var q = mount.querySelector('.pj-q'); if (q) q.addEventListener('input', function () { quality = Number(q.value); });
      var f = mount.querySelector('.pj-fmt'); if (f) { f.value = fmt; f.addEventListener('change', function () { fmt = f.value; }); }
      var go = mount.querySelector('.pj-go'); if (go) go.addEventListener('click', run);
      var all = mount.querySelector('.pj-all'); if (all) all.addEventListener('click', function () { imgs.forEach(function (im, n) { setTimeout(function () { download(im.blob, base(st.file.name) + '-page-' + im.page + '.' + ext, fmt); }, n * 200); }); });
      mount.querySelectorAll('.pjd').forEach(function (b) { b.addEventListener('click', function () { var im = imgs[+b.getAttribute('data-i')]; download(im.blob, base(st.file.name) + '-page-' + im.page + '.' + ext, fmt); }); });
      var rs = mount.querySelector('.pdf-reset'); if (rs) rs.addEventListener('click', function () { imgs = []; api.reset(); });
    }
    function run() {
      if (!st.buf) return; busy = true; imgs = []; st.error = ''; paint();
      renderPages(st.buf, { scale: dpi / 72, quality: quality, type: fmt, onProgress: function (d, t) { pct = (d / t) * 100; } }).then(function (r) {
        imgs = r.map(function (i) { return { blob: i.blob, url: URL.createObjectURL(i.blob), page: i.page }; }); busy = false; paint();
      }).catch(function (e) { st.error = 'Rendering failed: ' + String(e.message || e).slice(0, 160); busy = false; paint(); });
    }
    paint();
  });

  function jpgToPdf(cfg, mount) {
    var files = [], orient = 'auto', fit = 'contain', size = 'A4', margin = 36, out = null, err = '', busy = false, pct = 0;
    function toJpegBytes(file, w, h) {
      return new Promise(function (res, rej) {
        if (file.type === 'image/jpeg' || file.type === 'image/png') { file.arrayBuffer().then(function (b) { res({ bytes: new Uint8Array(b), png: file.type === 'image/png' }); }); return; }
        var im = new Image(); im.onload = function () { var c = document.createElement('canvas'); c.width = w || im.naturalWidth; c.height = h || im.naturalHeight; var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(im, 0, 0); c.toBlob(function (b) { if (!b) return rej(new Error('convert')); b.arrayBuffer().then(function (ab) { res({ bytes: new Uint8Array(ab), png: false }); }); }, 'image/jpeg', 0.92); }; im.onerror = rej; im.src = URL.createObjectURL(file);
      });
    }
    function draw() {
      mount.innerHTML = '<div class="te">' + privacy() + dropzone(files.length ? 'Add more images' : 'Select images to convert', 'JPG, PNG, WebP', true, 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp') +
        (files.length ? files.map(function (it, i) { return '<div class="card flex"><img src="' + it.url + '" alt="" style="width:3rem;height:3rem;object-fit:cover;border-radius:.4rem"><div style="flex:1"><p style="font-weight:700;font-size:.9rem">' + esc(it.file.name) + '</p></div><button type="button" class="btn btn-ghost jrm" data-i="' + i + '">×</button></div>'; }).join('') +
          '<div class="card te"><div class="grid grid-3"><div><label class="field-label">Page size</label><select class="select jp-size">' + Object.keys(PAGE_SIZES).concat(['original']).map(function (s) { return '<option value="' + s + '"' + ((s === 'original' ? fit === 'original' : size === s) ? ' selected' : '') + '>' + (s === 'original' ? 'Page = image size' : s) + '</option>'; }).join('') + '</select></div><div><label class="field-label">Orientation</label><select class="select jp-or"><option value="auto">Auto</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></div><div><label class="field-label">Fit</label><select class="select jp-fit"><option value="contain">Contain</option><option value="fill">Fill</option><option value="original">Original</option></select></div></div>' + (busy ? progress(pct, 'Building PDF…') : '<button type="button" class="btn btn-primary jp-go">Create PDF →</button>') + '</div>' : '') +
        (err ? errBox(err) : '') + (out ? resultPanel('PDF created', out.byteLength, null, 'images.pdf') : '') + guideHtml('jpg-to-pdf') + '</div>';
      bindDrop(mount, function (fs) { fs.forEach(function (f) { files.push({ file: f, url: URL.createObjectURL(f) }); }); draw(); });
      mount.querySelectorAll('.jrm').forEach(function (b) { b.addEventListener('click', function () { files.splice(+b.getAttribute('data-i'), 1); draw(); }); });
      var sz = mount.querySelector('.jp-size'); if (sz) { sz.addEventListener('change', function () { if (sz.value === 'original') fit = 'original'; else size = sz.value; }); }
      var or = mount.querySelector('.jp-or'); if (or) { or.value = orient; or.addEventListener('change', function () { orient = or.value; }); }
      var ft = mount.querySelector('.jp-fit'); if (ft) { ft.value = fit; ft.addEventListener('change', function () { fit = ft.value; }); }
      var go = mount.querySelector('.jp-go'); if (go) go.addEventListener('click', run);
      var dl = mount.querySelector('.pdf-dl'); if (dl) dl.addEventListener('click', function () { download(out, 'images.pdf'); });
      var rs = mount.querySelector('.pdf-reset'); if (rs) rs.addEventListener('click', function () { files = []; out = null; draw(); });
    }
    function run() {
      busy = true; err = ''; pct = 0; draw();
      loadPdfLib().then(function (lib) {
        var doc = lib.PDFDocument.create();
        function next(i) {
          if (i >= files.length) return doc.save();
          var it = files[i];
          return toJpegBytes(it.file).then(function (r) {
            return (r.png ? doc.embedPng(r.bytes) : doc.embedJpg(r.bytes)).then(function (img) {
              var landscape = orient === 'landscape' || (orient === 'auto' && img.width > img.height);
              var pw, ph;
              if (fit === 'original') { pw = img.width * 0.75 + margin * 2; ph = img.height * 0.75 + margin * 2; }
              else { var ps = PAGE_SIZES[size] || PAGE_SIZES.A4; pw = ps[0]; ph = ps[1]; if (landscape) { var t = pw; pw = ph; ph = t; } }
              var page = doc.addPage([pw, ph]);
              var availW = pw - margin * 2, availH = ph - margin * 2, dw, dh;
              if (fit === 'fill') { var s1 = Math.max(availW / img.width, availH / img.height); dw = img.width * s1; dh = img.height * s1; }
              else if (fit === 'original') { dw = img.width * 0.75; dh = img.height * 0.75; }
              else { var s2 = Math.min(availW / img.width, availH / img.height); dw = img.width * s2; dh = img.height * s2; }
              page.drawImage(img, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh });
              pct = ((i + 1) / files.length) * 100;
              return next(i + 1);
            });
          });
        }
        return next(0);
      }).then(function (bytes) { out = bytes; busy = false; draw(); }).catch(function (e) { err = String(e.message || e); busy = false; draw(); });
    }
    draw();
  }

  function pptToPdf(cfg, mount) {
    var text = '# Welcome\n- First point\n- Second point\n\n# Agenda\n- Introduction\n- Key findings\n- Next steps', ratio = '16:9', theme = 'indigo', out = null, err = '', fileNote = '';
    function slides() { return text.split(/\n(?=# )|\n{2,}(?=\S)/).map(function (s) { return s.trim(); }).filter(Boolean); }
    function draw() {
      var sl = slides();
      mount.innerHTML = '<div class="te">' + privacy() + '<div class="grid grid-2"><textarea class="textarea ppt-text" rows="14">' + esc(text) + '</textarea><div class="te">' + dropzone('Upload .pptx or .txt', 'Slide text is extracted locally', false, '.pptx,.txt,.md') + (fileNote ? '<p class="ok-box">' + esc(fileNote) + '</p>' : '') + '<div class="te-stat small">Format: start each slide with <code># Title</code>, add bullets with <code>- item</code>, separate slides with a blank line.</div></div></div>' +
        '<div class="card te"><div class="flex-between"><div><p class="field-label">Aspect ratio</p><div class="te-row"><button type="button" class="pill' + (ratio === '16:9' ? ' on' : '') + '" data-r="16:9">16:9</button><button type="button" class="pill' + (ratio === '4:3' ? ' on' : '') + '" data-r="4:3">4:3</button></div></div><div><p class="field-label">Theme</p><div class="te-row">' + ['light', 'dark', 'indigo'].map(function (t) { return '<button type="button" class="pill' + (theme === t ? ' on' : '') + '" data-th="' + t + '">' + t + '</button>'; }).join('') + '</div></div>' + stat('Slides', String(sl.length)) + '</div>' +
        '<div class="grid grid-4">' + sl.slice(0, 8).map(function (s) { return '<div class="card" style="aspect-ratio:' + (ratio === '16:9' ? '16/9' : '4/3') + ';font-size:10px;overflow:hidden' + (theme === 'dark' ? ';background:#0f172a;color:#e2e8f0' : '') + '"><div style="height:3px;background:var(--indigo-500);margin-bottom:.35rem;border-radius:2px"></div><p style="font-weight:800">' + esc(s.split('\n')[0].replace(/^#\s*/, '')) + '</p>' + s.split('\n').slice(1, 4).map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '</div>'; }).join('') + '</div>' +
        '<button type="button" class="btn btn-primary ppt-go"' + (sl.length ? '' : ' disabled') + '>Create ' + sl.length + '-slide PDF →</button></div>' + (err ? errBox(err) : '') + (out ? resultPanel('Presentation PDF · ' + out.pages + ' slides', out.bytes.byteLength, null, 'presentation.pdf') : '') + guideHtml('ppt-to-pdf') + '</div>';
      bindDrop(mount, onFile);
      mount.querySelector('.ppt-text').addEventListener('input', function (e) { text = e.target.value; out = null; draw(); });
      mount.querySelectorAll('[data-r]').forEach(function (b) { b.addEventListener('click', function () { ratio = b.getAttribute('data-r'); draw(); }); });
      mount.querySelectorAll('[data-th]').forEach(function (b) { b.addEventListener('click', function () { theme = b.getAttribute('data-th'); draw(); }); });
      mount.querySelector('.ppt-go').addEventListener('click', run);
      var dl = mount.querySelector('.pdf-dl'); if (dl) dl.addEventListener('click', function () { download(out.bytes, 'presentation.pdf'); });
      var rs = mount.querySelector('.pdf-reset'); if (rs) rs.addEventListener('click', function () { out = null; draw(); });
    }
    function onFile(fs) {
      var f = fs[0];
      if (/\.pptx$/i.test(f.name)) {
        readFile(f).then(function (buf) {
          return zipFind(buf, function (e) { return /^ppt\/slides\/slide\d+\.xml$/.test(e.name); }).then(function (ents) {
            ents.sort(function (a, b) { return Number(a.name.match(/\d+/)[0]) - Number(b.name.match(/\d+/)[0]); });
            var outSlides = ents.map(function (e) {
              var paras = Array.from(e.xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)).map(function (m) { return Array.from(m[1].matchAll(/<a:t>([^<]*)<\/a:t>/g)).map(function (x) { return x[1]; }).join(''); }).filter(Boolean);
              return paras.length ? '# ' + paras[0] + '\n' + paras.slice(1).map(function (p) { return '- ' + p; }).join('\n') : '';
            }).filter(Boolean);
            text = outSlides.join('\n\n'); fileNote = ents.length + ' slides extracted from ' + f.name; draw();
          });
        }).catch(function () { err = 'Could not read this .pptx. Paste your slide text instead.'; draw(); });
      } else f.text().then(function (t) { text = t; fileNote = f.name; draw(); });
    }
    function run() {
      err = '';
      loadPdfLib().then(function (lib) {
        var doc = lib.PDFDocument.create();
        return Promise.all([doc.embedFont(lib.StandardFonts.Helvetica), doc.embedFont(lib.StandardFonts.HelveticaBold)]).then(function (fonts) {
          var font = fonts[0], bold = fonts[1], sl = slides();
          var w = ratio === '16:9' ? 960 : 720, h = 540;
          var colors = { light: { bg: lib.rgb(1, 1, 1), title: lib.rgb(0.1, 0.1, 0.2), text: lib.rgb(0.2, 0.2, 0.25), accent: lib.rgb(0.39, 0.4, 0.95) }, dark: { bg: lib.rgb(0.08, 0.09, 0.15), title: lib.rgb(1, 1, 1), text: lib.rgb(0.85, 0.87, 0.92), accent: lib.rgb(0.51, 0.55, 0.97) }, indigo: { bg: lib.rgb(0.97, 0.97, 1), title: lib.rgb(0.19, 0.18, 0.5), text: lib.rgb(0.2, 0.2, 0.3), accent: lib.rgb(0.39, 0.4, 0.95) } }[theme];
          sl.forEach(function (s, idx) {
            var page = doc.addPage([w, h]); page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: colors.bg }); page.drawRectangle({ x: 0, y: h - 8, width: w, height: 8, color: colors.accent });
            var lines = s.split('\n'), titleT = toWinAnsi(lines[0].replace(/^#\s*/, '')), body = lines.slice(1);
            page.drawText(titleT, { x: 56, y: h - 96, size: 34, font: bold, color: colors.title });
            var y = h - 160;
            body.forEach(function (b) {
              var isBullet = /^\s*[-*•]/.test(b), t = toWinAnsi(b.replace(/^\s*[-*•]\s*/, ''));
              wrapText(t, font, 20, w - 140).forEach(function (l) {
                if (y < 60) return;
                if (isBullet) page.drawCircle({ x: 66, y: y + 7, size: 4, color: colors.accent });
                page.drawText(l, { x: isBullet ? 84 : 56, y: y, size: 20, font: font, color: colors.text }); y -= 34;
              });
            });
            page.drawText((idx + 1) + ' / ' + sl.length, { x: w - 80, y: 24, size: 11, font: font, color: colors.text });
          });
          doc.setProducer('SEO Audit Tool PDF Tools');
          return doc.save().then(function (bytes) { out = { bytes: bytes, pages: sl.length }; draw(); });
        });
      }).catch(function (e) { err = String(e.message || e); draw(); });
    }
    draw();
  }

  function excelToPdf(cfg, mount) {
    var raw = 'Product,Units,Price,Total\nWidget A,120,4.50,540.00\nWidget B,75,9.99,749.25\nWidget C,200,2.25,450.00', title = 'Sheet 1', landscape = true, header = true, fileNote = '', out = null, err = '';
    function rowsOf() {
      var delim = raw.indexOf('\t') >= 0 ? '\t' : (raw.indexOf(';') >= 0 && raw.indexOf(',') < 0 ? ';' : ',');
      return raw.split(/\r?\n/).filter(function (l) { return l.trim(); }).map(function (l) {
        var cells = [], cur = '', q = false;
        for (var i = 0; i < l.length; i++) { var ch = l[i]; if (ch === '"') q = !q; else if (ch === delim && !q) { cells.push(cur); cur = ''; } else cur += ch; }
        cells.push(cur); return cells.map(function (c) { return c.trim(); });
      });
    }
    function draw() {
      var rows = rowsOf(), cols = rows.reduce(function (a, r) { return Math.max(a, r.length); }, 0);
      mount.innerHTML = '<div class="te">' + privacy() + '<div class="grid grid-2"><div class="te"><input class="input ex-title" placeholder="Table title" value="' + esc(title) + '"><textarea class="textarea ex-raw" rows="10" placeholder="Paste cells from Excel/Sheets (tab-separated) or CSV…">' + esc(raw) + '</textarea></div><div class="te">' + dropzone('Upload .xlsx or .csv', 'First sheet is read locally', false, '.xlsx,.csv,.tsv,.txt') + (fileNote ? '<p class="ok-box">' + esc(fileNote) + '</p>' : '') + '</div></div>' +
        '<div class="grid grid-3">' + stat('Rows', String(rows.length)) + stat('Columns', String(cols)) + stat('Cells', String(rows.reduce(function (a, r) { return a + r.length; }, 0))) + '</div>' +
        '<div class="card te"><div class="te-row"><label class="flex"><input type="checkbox" class="ex-ls"' + (landscape ? ' checked' : '') + '> Landscape</label><label class="flex"><input type="checkbox" class="ex-hd"' + (header ? ' checked' : '') + '> Header row</label></div><button type="button" class="btn btn-primary ex-go">Create PDF →</button></div>' +
        (err ? errBox(err) : '') + (out ? resultPanel('Table PDF · ' + out.pages + ' page' + (out.pages === 1 ? '' : 's'), out.bytes.byteLength, null, (title || 'sheet') + '.pdf') : '') + guideHtml('excel-to-pdf') + '</div>';
      bindDrop(mount, onFile);
      mount.querySelector('.ex-title').addEventListener('input', function (e) { title = e.target.value; });
      mount.querySelector('.ex-raw').addEventListener('input', function (e) { raw = e.target.value; out = null; draw(); });
      mount.querySelector('.ex-ls').addEventListener('change', function (e) { landscape = e.target.checked; });
      mount.querySelector('.ex-hd').addEventListener('change', function (e) { header = e.target.checked; });
      mount.querySelector('.ex-go').addEventListener('click', run);
      var dl = mount.querySelector('.pdf-dl'); if (dl) dl.addEventListener('click', function () { download(out.bytes, (title || 'sheet') + '.pdf'); });
      var rs = mount.querySelector('.pdf-reset'); if (rs) rs.addEventListener('click', function () { out = null; draw(); });
    }
    function onFile(fs) {
      var f = fs[0];
      if (/\.xlsx$/i.test(f.name)) {
        readFile(f).then(function (buf) {
          return zipFind(buf, function (e) { return e.name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet1\.xml$/.test(e.name); }).then(function (ents) {
            var ss = {}, sheet = '';
            ents.forEach(function (e) { if (e.name.indexOf('sharedStrings') >= 0) { Array.from(e.xml.matchAll(/<si[\s\S]*?<\/si>/g)).forEach(function (m, i) { ss[i] = Array.from(m[0].matchAll(/<t[^>]*>([^<]*)<\/t>/g)).map(function (x) { return x[1]; }).join(''); }); } else sheet = e.xml; });
            var parsed = [];
            Array.from(sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)).forEach(function (row) {
              var cells = [];
              Array.from(row[1].matchAll(/<c[^>]*?(?: t="([^"]+)")?[^>]*>([\s\S]*?)<\/c>/g)).forEach(function (c) {
                var t = c[1], inner = c[2], v = ((inner.match(/<v>([^<]*)<\/v>/) || [])[1]) || '';
                cells.push(t === 's' ? (ss[v] || '') : v);
              });
              if (cells.length) parsed.push(cells);
            });
            if (parsed.length) raw = parsed.map(function (r) { return r.join(','); }).join('\n');
            title = base(f.name); fileNote = f.name; draw();
          });
        }).catch(function () { err = 'Could not parse this .xlsx. Save as CSV or paste the cells.'; draw(); });
      } else f.text().then(function (t) { raw = t; title = base(f.name); fileNote = f.name; draw(); });
    }
    function run() {
      err = '';
      loadPdfLib().then(function (lib) {
        var doc = lib.PDFDocument.create();
        return Promise.all([doc.embedFont(lib.StandardFonts.Helvetica), doc.embedFont(lib.StandardFonts.HelveticaBold)]).then(function (fonts) {
          var font = fonts[0], bold = fonts[1], rows = rowsOf(), cols = rows.reduce(function (a, r) { return Math.max(a, r.length); }, 0);
          var w = landscape ? PAGE_SIZES.A4[1] : PAGE_SIZES.A4[0], h = landscape ? PAGE_SIZES.A4[0] : PAGE_SIZES.A4[1];
          var m = 40, fs = cols > 8 ? 7 : cols > 5 ? 8 : 9, rowH = fs * 2.2, availW = w - m * 2;
          var widths = Array.from({ length: cols }, function (_, c) { return Math.max(30, Math.max.apply(null, rows.map(function (r) { return bold.widthOfTextAtSize(toWinAnsi(r[c] || ''), fs) + 10; }))); });
          var scale = Math.min(1, availW / widths.reduce(function (a, b) { return a + b; }, 0)); var cw = widths.map(function (x) { return x * scale; });
          var page = doc.addPage([w, h]), y = h - m, pageNo = 1;
          function drawHeader() { page.drawText(toWinAnsi(title), { x: m, y: y - 14, size: 14, font: bold, color: lib.rgb(0.1, 0.1, 0.2) }); y -= 30; }
          function drawRow(r, i, isHead) {
            var x = m;
            if (isHead) page.drawRectangle({ x: m, y: y - rowH, width: cw.reduce(function (a, b) { return a + b; }, 0), height: rowH, color: lib.rgb(0.39, 0.4, 0.95) });
            else if (i % 2 === 0) page.drawRectangle({ x: m, y: y - rowH, width: cw.reduce(function (a, b) { return a + b; }, 0), height: rowH, color: lib.rgb(0.96, 0.96, 0.99) });
            r.forEach(function (cell, c) {
              var t = toWinAnsi(cell || ''), fnt = isHead ? bold : font;
              while (fnt.widthOfTextAtSize(t, fs) > cw[c] - 8 && t.length > 1) t = t.slice(0, -2) + '…';
              var num = /^-?[\d,.]+%?$/.test(cell);
              page.drawText(t, { x: num ? x + cw[c] - 4 - font.widthOfTextAtSize(t, fs) : x + 4, y: y - rowH + fs * 0.7, size: fs, font: fnt, color: isHead ? lib.rgb(1, 1, 1) : lib.rgb(0.15, 0.15, 0.2) });
              x += cw[c];
            });
            page.drawLine({ start: { x: m, y: y - rowH }, end: { x: m + cw.reduce(function (a, b) { return a + b; }, 0), y: y - rowH }, thickness: 0.5, color: lib.rgb(0.85, 0.85, 0.9) });
            y -= rowH;
          }
          drawHeader(); if (header && rows[0]) drawRow(rows[0], 0, true);
          rows.slice(header ? 1 : 0).forEach(function (r, i) {
            if (y - rowH < m + 20) { page.drawText('Page ' + pageNo, { x: w / 2 - 15, y: m / 2, size: 8, font: font, color: lib.rgb(0.5, 0.5, 0.5) }); page = doc.addPage([w, h]); y = h - m; pageNo++; drawHeader(); if (header && rows[0]) drawRow(rows[0], 0, true); }
            drawRow(r, i, false);
          });
          page.drawText('Page ' + pageNo, { x: w / 2 - 15, y: m / 2, size: 8, font: font, color: lib.rgb(0.5, 0.5, 0.5) });
          doc.setProducer('SEO Audit Tool PDF Tools'); doc.setTitle(title);
          return doc.save().then(function (bytes) { out = { bytes: bytes, pages: doc.getPageCount() }; draw(); });
        });
      }).catch(function (e) { err = String(e.message || e); draw(); });
    }
    draw();
  }

  var MAP = {
    'pdf-merge': mergePdf, 'pdf-split': splitPdf, 'pdf-rotate': rotatePdf, 'pdf-lock': lockPdf, 'pdf-unlock': unlockPdf,
    'pdf-compress': compressPdf(), 'text-to-pdf': textToPdf, 'word-to-pdf': wordToPdf, 'pdf-to-word': pdfToWord,
    'pdf-to-jpg': pdfToJpg, 'jpg-to-pdf': jpgToPdf, 'ppt-to-pdf': pptToPdf, 'excel-to-pdf': excelToPdf
  };

  global.PdfTools = {
    mountTool: function (cfg, mount) {
      var engine = cfg.engine || '';
      if (engine.indexOf('pdf-compress-') === 0) { compressPdf(Number(engine.split('-').pop()))(cfg, mount); return true; }
      var fn = MAP[engine];
      if (!fn) return false;
      fn(cfg, mount);
      return true;
    }
  };
})(window);
