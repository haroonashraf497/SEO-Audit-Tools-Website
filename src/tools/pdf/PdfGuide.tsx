import React from 'react';

interface Guide { steps: string[]; faqs: [string, string][]; tips?: string[] }

const COMPRESS_FAQ: [string, string][] = [
  ['Why did my text become non-selectable?', 'To hit a strict size target the tool re-renders pages as images. Choose “Lossless” (or a larger target) to keep real text.'],
  ['What decides the final size?', 'Page count, image content and resolution. Text-only PDFs compress a lot losslessly; scanned pages need image downsampling.'],
  ['Is quality lost forever?', 'Only in the downloaded copy. Your original file on disk is untouched.'],
];
const COMPRESS_STEPS = ['Select or drop your PDF.', 'The tool first removes redundant objects and enables object streams (lossless).', 'If still over target, pages are re-rendered at progressively lower DPI/JPEG quality.', 'Download the smallest version that stays legible.'];

const GUIDES: Record<string, Guide> = {
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
  'excel-to-pdf': { steps: ['Upload .xlsx/.csv or paste cells copied from Excel or Google Sheets.', 'Set the title, header row and orientation.', 'Columns auto-fit; long tables paginate with repeated headers.'], faqs: [['Which sheet is used?', 'The first worksheet of an .xlsx. Save others as CSV to convert them.'], ['Are formulas evaluated?', 'The cached values stored in the file are used, so yes for saved workbooks.']] },
};

export const PdfGuide: React.FC<{ engine: string }> = ({ engine }) => {
  const key = engine.startsWith('pdf-compress') ? 'pdf-compress' : engine;
  const g = GUIDES[key];
  if (!g) return null;
  const target = engine.startsWith('pdf-compress-') ? Number(engine.split('-').pop()) : 0;
  return (
    <div className="grid lg:grid-cols-2 gap-5 mt-8">
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="font-bold text-slate-900 mb-4">How it works</h2>
        <ol className="space-y-3">{g.steps.map((s, i) => <li key={i} className="flex gap-3 text-sm text-slate-700"><span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>{s}</li>)}</ol>
        {g.tips && <div className="mt-4 bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-900">{g.tips.map(t => <p key={t}>💡 {t}</p>)}</div>}
        {target > 0 && <div className="mt-4 bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs text-slate-600"><strong>Where {target} KB matters:</strong> {target <= 100 ? 'government e-services, exam and visa portals, and job application forms commonly cap uploads at 50–100 KB.' : target <= 300 ? 'university admissions, scholarship portals and many HR systems limit attachments to 200–300 KB.' : 'e-mail gateways and CMS uploads frequently reject attachments above 500 KB–1 MB.'}</div>}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="font-bold text-slate-900 mb-4">Frequently asked questions</h2>
        <div className="space-y-3">{g.faqs.map(([q, a]) => <details key={q} className="group"><summary className="text-sm font-semibold text-slate-800 cursor-pointer list-none flex justify-between items-center">{q}<span className="text-slate-400 group-open:rotate-45 transition-transform text-lg">+</span></summary><p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{a}</p></details>)}
          <details className="group"><summary className="text-sm font-semibold text-slate-800 cursor-pointer list-none flex justify-between items-center">Is my file uploaded anywhere?<span className="text-slate-400 group-open:rotate-45 transition-transform text-lg">+</span></summary><p className="text-sm text-slate-600 mt-1.5 leading-relaxed">No. The PDF engine runs in your browser using WebAssembly-free JavaScript. Your document never leaves your device, which also makes processing instant with no queue.</p></details>
        </div>
      </div>
    </div>
  );
};
