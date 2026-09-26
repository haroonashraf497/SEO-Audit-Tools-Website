/**
 * Source-level audit of the user's feature checklist. Each entry names the
 * feature, where it lives, and what must be true in the current tree.
 */
import { readFileSync, existsSync } from 'node:fs';

const read = p => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const admin = read('src/cms/Admin.tsx');
const store = read('src/cms/store.tsx');
const app = read('src/App.tsx');
const css = read('src/index.css');
const seo = read('src/utils/seo.ts');
const router = read('src/router.ts');
const htaccess = read('public/.htaccess');
const sitemap = read('public/sitemap.xml');
const tools = read('src/tools/data.tsx');
const dist = read('dist/index.html');

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  → ${detail}`}`);
};

console.log('\n=== 🔴 Header Verification & Ads ===');
check('textarea for verification/ads code', /Header Verification &amp; Ads[\s\S]{0,900}headerVerificationAds/.test(admin));
check('purple Save Changes button on that card', /SaveButton label="Save Changes" onSave=\{\(\) => \{[\s\S]{0,220}injectHeadCode\(code\)/.test(admin));
check('SaveButton renders "Saved ✓" for 2.5 s', /setTimeout\(\(\) => setSaved\(false\), 2500\)/.test(admin) && /saved \? 'Saved ✓' : label/.test(admin));
check('button uses the purple style', /bg-purple-600 hover:bg-purple-700/.test(admin));
check('save persists to localStorage', /localStorage\.setItem\(KEY, JSON\.stringify\(state\)\)/.test(store) && /KEY = 'seoaudittool:cms:v1'/.test(store));
check('code injected into <head>', /document\.head\.appendChild\(out\)/.test(store) && /HEAD_CODE_ATTR = 'data-cms-header-code'/.test(store));
check('scripts execute (createElement rebuild)', /document\.createElement\('script'\)/.test(store) && /script\.text = original\.textContent/.test(store));
check('injection runs on every load', /useEffect\(\(\) => \{\s*injectHeadCode\(state\.settings\.headerVerificationAds\)/.test(store));

console.log('\n=== 🔵 Navigation Menu ===');
check('editor with label + URL inputs', /aria-label="Link label"/.test(admin) && /aria-label="Link URL"/.test(admin)
  && /Navigation menu[\s\S]{0,900}<MenuRowEditor/.test(admin));
check('+ Add button', /\+ Add<\/Btn>/.test(admin) && /label: 'New link', href: '\/', visible: true/.test(admin));
check('Remove button', /<Btn tone="ghost" onClick=\{onRemove\}>Remove<\/Btn>/.test(admin));
check('Visible/Hidden toggle', /\{visible \? 'Visible' : 'Hidden'\}/.test(admin));
check('Save with "Saved ✓"', /<SaveButton onSave=\{\(\) => setNav\(state\.nav\.map\(n => \(\{ \.\.\.n \}\)\)\)\} \/>/.test(admin));
check('header renders saved nav live (desktop + mobile)', (app.match(/cms\.state\.nav\.filter\(n => n\.visible/g) || []).length === 2);
check('nav persisted in the CMS store', /nav: NavItem\[\]/.test(store) && /setNav: \(nav\) => setState\(s => \(\{ \.\.\.s, nav \}\)\)/.test(store));

console.log('\n=== 🟢 Brand & Footer ===');
check('Site name field + save', /Field label="Site name"[\s\S]{0,200}setSettings\(\{ name: e\.target\.value \}\)/.test(admin));
check('Domain field + save', /Field label="Domain"[\s\S]{0,200}setSettings\(\{ domain: e\.target\.value \}\)/.test(admin));
check('Footer note field + save', /Field label="Footer note"[\s\S]{0,260}setSettings\(\{ footerNote: e\.target\.value \}\)/.test(admin));
check('footer note renders on the public site', /\{footerNote && \(/.test(app) && /footerNote = \(cms\.state\.settings\.footerNote \|\| ''\)\.trim\(\)/.test(app));
check('Footer copyright text field', /Field label="Copyright line"[\s\S]{0,200}footerCopyright/.test(admin));
check('{year} {name} {domain} placeholder chips', /\['\{year\}', '\{name\}', '\{domain\}'\]\.map/.test(admin));
check('live preview of the copyright line', /Live preview:[\s\S]{0,160}renderCopyright\(settings\.footerCopyright/.test(admin));
check('placeholders substituted at render', /replace\(\/\\\{year\\\}\/gi, String\(new Date\(\)\.getFullYear\(\)\)\)/.test(store));
check('footer logo URL field', /Field label="Logo URL"[\s\S]{0,200}footerLogoUrl: e\.target\.value/.test(admin));
check('footer logo upload button + file input', /⬆ Upload logo'}<\/Btn>/.test(admin) && /type="file"/.test(admin) && /aria-label="Upload footer logo"/.test(admin));
check('upload validates + optimises the image', /validateUpload\(file\)/.test(admin) && /optimizeImageFile\(file\)/.test(admin));
check('uploaded/external logo replaces the default icon', /\{footerLogo \? \([\s\S]{0,420}img\s+src=\{footerLogo\}/.test(app));
check('four separate footer-column editors', (admin.match(/<FooterColumnEditor/g) || []).length === 1
  && /footerColumns\.map\(\(column, i\) => \([\s\S]{0,200}<FooterColumnEditor/.test(admin)
  && /all four footer columns are editable/i.test(admin));
check('each editor has title + rows + Add + Save', /const FooterColumnEditor[\s\S]{0,3000}<Field label="Section title"><input[^>]*value=\{title\}/.test(admin)
  && /const FooterColumnEditor[\s\S]{0,3500}MenuRowEditor[\s\S]{0,2000}label: 'New link', href: '\/', visible: true[\s\S]{0,700}<SaveButton onSave=\{\(\) => onSave\(/.test(admin));
check('each column saves independently', /onSave=\{saved => setFooterColumns\(footerColumns\.map\(\(c, j\) => \(j === i \? saved : c\)\)\)\}/.test(admin));
check('columns are labelled Column 1-4', /Column \{index \+ 1\} — \{column\.title/.test(admin) && /aria-label=\{`Footer column \$\{index \+ 1\}`\}/.test(admin));
check('live footer renders every stored column', /const footerColumns = cms\.state\.footerColumns\?\.length \? cms\.state\.footerColumns : defaultFooterColumns/.test(app)
  && /\{footerColumns\.map\(col => \{[\s\S]{0,500}<nav key=\{col\.id\} aria-label=\{col\.title\}>/.test(app));
check('hidden rows stay saved but are not rendered', /const links = col\.links\.filter\(link => link\.visible && link\.label\.trim\(\)\)/.test(app));
check('footer column headings use the requested CSS', /<h3 className="text-\[18px\] font-bold capitalize tracking-\[0px\] text-slate-400 mb-4">\{col\.title\}<\/h3>/.test(app)
  && !/<h3 className="text-xs font-bold uppercase/.test(app));
check('footer column titles editable per column', /<Field label="Section title"><input className=\{inputCls \+ ' max-w-xs'\} value=\{title\} onChange=\{e => setTitle\(e\.target\.value\)\}/.test(admin));
check('store owns the four columns + a dedicated setter', /export interface FooterColumn \{ id: string; title: string; links: FooterLink\[\] \}/.test(store)
  && /export const defaultFooterColumns: FooterColumn\[\] = \[/.test(store)
  && /setFooterColumns: \(columns\) => setState\(s => \(\{ \.\.\.s, footerColumns:/.test(store));
check('older saved state migrates column 1 into footerColumns', /const migrateFooterColumns = \(stored: unknown, settings: SiteSettings\): FooterColumn\[\] => \{/.test(store)
  && /title: \(settings\.footerMenuTitle \|\| ''\)\.trim\(\) \|\| col\.title/.test(store));
check('social URLs: FB, X, LinkedIn, IG, YouTube', /\['facebook', 'Facebook URL'\], \['x', 'X \(Twitter\) URL'\], \['linkedin', 'LinkedIn URL'\], \['instagram', 'Instagram URL'\], \['youtube', 'YouTube URL'\]/.test(admin));
check('social icons render only when filled', /\.filter\(entry => entry\.href\)/.test(app));
check('all five icons defined', ['facebook', 'x', 'linkedin', 'instagram', 'youtube'].every(k => new RegExp(`key: '${k}'`).test(app)));
check('"Saved ✓" on every brand/footer card', (admin.match(/<SaveButton /g) || []).length >= 5, String((admin.match(/<SaveButton /g) || []).length));

console.log('\n=== 🦶 Footer redesign ===');
check('four equal footer columns defined (Quick Links, SEO Tools, Resources, Company)',
  /export const defaultFooterColumns: FooterColumn\[\] = \[[\s\S]{0,1400}title: 'Quick links'[\s\S]{0,700}title: 'SEO Tools'[\s\S]{0,700}title: 'Resources'[\s\S]{0,700}title: 'Company'/.test(store));
check('Quick Links column = audit, tools, blog, about, contact',
  /title: 'Quick links', links: \[[\s\S]{0,420}footerLink\('Free SEO Audit', '\/'\)[\s\S]{0,200}footerLink\('Free SEO Tools', '\/free-seo-tools'\)[\s\S]{0,200}footerLink\('Blog', '\/blog'\)[\s\S]{0,200}footerLink\('About', '\/about'\)[\s\S]{0,200}footerLink\('Contact', '\/contact'\)/.test(store));
check('SEO Tools column = audit, tools, competitor analysis',
  /title: 'SEO Tools', links: \[[\s\S]{0,320}footerLink\('Free SEO Audit', '\/'\)[\s\S]{0,200}footerLink\('Free SEO Tools', '\/free-seo-tools'\)[\s\S]{0,200}footerLink\('Competitor Analysis', '\/competitor-analysis'\)/.test(store));
check('Resources column = blog, FAQ, who it\'s for',
  /title: 'Resources', links: \[[\s\S]{0,320}footerLink\('Blog', '\/blog'\)[\s\S]{0,200}footerLink\('FAQ', '\/faq'\)[\s\S]{0,200}footerLink\("Who It's For", '\/#audiences'\)/.test(store));
check('Company column = about, contact',
  /title: 'Company', links: \[[\s\S]{0,220}footerLink\('About', '\/about'\)[\s\S]{0,200}footerLink\('Contact', '\/contact'\)/.test(store));
check('columns render in a four-up equal-width grid', /grid grid-cols-2 gap-8 py-10 md:grid-cols-4/.test(app)
  && !/lg:grid-cols-5/.test(app));
check('no separate Legal column any more', !/aria-label="Legal"/.test(app) && !/FOOTER_LEGAL_LINKS\.map\(l => \(\s*<li/.test(app));
check('legal links live in the bottom bar on short URLs', /const FOOTER_LEGAL_LINKS[\s\S]{0,400}href: '\/privacy'[\s\S]{0,200}href: '\/cookies'[\s\S]{0,200}href: '\/terms'/.test(app)
  && /aria-label="Legal documents"[\s\S]{0,900}href=\{l\.href\}/.test(app));
check('Terms link labelled "Terms & Conditions"', /label: 'Terms & Conditions', short: 'Terms', href: '\/terms'/.test(app));
check('bottom bar: copyright left, legal links right', /sm:flex-row sm:items-center sm:justify-between[\s\S]{0,600}aria-label="Legal documents"[\s\S]{0,200}sm:justify-end/.test(app));
check('bottom bar reuses renderCopyright (still editable)', /sm:justify-between[\s\S]{0,400}renderCopyright\(cms\.state\.settings\.footerCopyright/.test(app));
check('cookie preferences button kept', /onClick=\{\(\) => setCookiePrefsOpen\(true\)\}[^>]*>Cookie preferences/.test(app));
check('bottom bar uses the short labels', /short: 'Privacy', href: '\/privacy'/.test(app)
  && /short: 'Cookie', href: '\/cookies'/.test(app)
  && /short: 'Terms', href: '\/terms'/.test(app)
  && /className="hover:text-white transition-colors">\{l\.short\}<\/a>/.test(app));
check('short links keep the full name for a11y/tooltip', /title=\{l\.label\} aria-label=\{l\.label\}/.test(app));
check('bottom bar offers Cookie preferences', /sm:justify-end"[\s\S]{0,700}onClick=\{\(\) => setCookiePrefsOpen\(true\)\}[^>]*>Cookie preferences<\/button>/.test(app));
check('exactly one Cookie preferences control in the footer',
  (app.match(/setCookiePrefsOpen\(true\)/g) || []).length === 1,
  String((app.match(/setCookiePrefsOpen\(true\)/g) || []).length));
check('no long legal URL left in the app shell', !/href="\/privacy-policy"|href="\/cookie-policy"|href="\/terms-of-service"/.test(app));
check('router maps short legal routes to stored slugs', /privacy: 'privacy-policy'/.test(router) && /cookies: 'cookie-policy'/.test(router) && /terms: 'terms-of-service'/.test(router));
check('router upgrades long legal paths to short ones', /canonicalLegalPath\(cleanPath\(u\.pathname\)\)/.test(router) && /next = canonicalLegalPath\(next\)/.test(router));
check('CMS view resolves the short slug', /findPage\(state, storedSlugForRoute\(slug\)\)/.test(app));
check('canonical/json-ld emit the short path', /routeSlugForStored\(page\.slug\)/.test(seo));
check('.htaccess 301 /privacy-policy → /privacy', /RewriteRule \^privacy-policy\/\?\$ \/privacy \[R=301,L\]/.test(htaccess));
check('.htaccess 301 /cookie-policy → /cookies', /RewriteRule \^cookie-policy\/\?\$ \/cookies \[R=301,L\]/.test(htaccess));
check('.htaccess 301 /terms-of-service → /terms', /RewriteRule \^terms-of-service\/\?\$ \/terms \[R=301,L\]/.test(htaccess));
check('sitemap lists the short legal URLs only', sitemap.includes('<loc>https://seoaudittools.pk/privacy</loc>')
  && sitemap.includes('<loc>https://seoaudittools.pk/cookies</loc>')
  && sitemap.includes('<loc>https://seoaudittools.pk/terms</loc>')
  && !/seoaudittools\.pk\/(privacy-policy|cookie-policy|terms-of-service)</.test(sitemap));

console.log('\n=== 🧯 pdf.js buffer detachment (compression ladder) ===');
const pdfEngine = read('src/tools/pdf/engine.ts');
const pdfUiSrc = read('src/tools/pdf/ui.tsx');
const pdfToolSources = pdfEngine + read('src/tools/pdf/PdfTools.tsx') + read('src/tools/pdf/ConvertTools.tsx') + read('src/tools/pdf/ui.tsx');
check('every buffer handed to pdf.js is copied first',
  /export const copyBuffer = \(buf: ArrayBuffer\): Uint8Array => \{/.test(pdfEngine)
  && (pdfEngine.match(/data: copyBuffer\(buf\)/g) || []).length === 2
  && /data: copyBuffer\(f\.buf\), password: pw/.test(pdfToolSources)
  && !/getDocument\(\{ data: new Uint8Array\(/.test(pdfToolSources));
check('the copy helper explains why it exists',
  /pdf\.js TRANSFERS the buffer it is given to its worker thread, which detaches/.test(pdfEngine));
check('the compression ladder survives one failing pass',
  /dpi failed — trying a lighter one/.test(pdfEngine)
  && /attempts\.push\(\{ scale, quality, size: best\.byteLength \}\)/.test(pdfEngine));
check('an unreadable (empty/detached) input is reported, not thrown raw',
  /if \(buf\.byteLength === 0\) throw new Error\('The file could not be read \(empty buffer\)\.'\)/.test(pdfEngine));
check('Compress more works on a private copy of the download buffer',
  /const buf = new Uint8Array\(bytes\)\.buffer as ArrayBuffer;/.test(pdfUiSrc)
  && /never touch \(or detach\)/.test(pdfUiSrc));
check('a failed compression tells the user what to try next',
  /Try again, or pick a lighter level \(Lossless is the most reliable\)/.test(pdfUiSrc));

console.log('\n=== 📄 Merge PDF — optional “Compress more” step ===');
const pdfUi = read('src/tools/pdf/ui.tsx');
const pdfTools = read('src/tools/pdf/PdfTools.tsx');
const pdfGuide = read('src/tools/pdf/PdfGuide.tsx');
check('CompressMore offers the four levels plus a target size',
  /COMPRESS_LEVELS = \[[\s\S]{0,240}'lossless'[\s\S]{0,200}'balanced'[\s\S]{0,200}'strong'[\s\S]{0,200}'extreme'/.test(pdfUi)
  && /Or target size/.test(pdfUi)
  && /\[50, 100, 200, 300, 500\]\.map/.test(pdfUi));
check('CompressMore reuses the shared compression engine',
  /import \{ compressToTarget, fmtBytes/.test(pdfUi)
  && /const out = await compressToTarget\(buf, target, setStatus\)/.test(pdfUi)
  && /level === 'lossless' \? null : Math\.round\(bytes\.byteLength \* LEVEL_TARGET\[level\]\)/.test(pdfUi));
check('compression reports the saving and can be applied to the download',
  /down from \{fmtBytes\(bytes\.byteLength\)\}/.test(pdfUi)
  && /✓ Use compressed file/.test(pdfUi)
  && /onApply\(res\.bytes, res\.label\)/.test(pdfUi));
check('no-smaller result is explained instead of shipped',
  /Already optimal/.test(pdfUi) && /no smaller legible version could be produced/.test(pdfUi));
check('Merge PDF renders the compressor inside its result card',
  /<CompressMore[\s\S]{0,220}bytes=\{out\}[\s\S]{0,220}onApply=\{\(bytes, label\) => \{ setOut\(bytes\); setCompressedLabel\(label\); \}\}/.test(pdfTools));
check('Merge PDF keeps the plain merge so the original can be restored',
  /setMerged\(bytes\); setOut\(bytes\); setCompressedLabel\(null\);/.test(pdfTools)
  && /onKeepOriginal=\{merged \? \(\) => \{ setOut\(merged\); setCompressedLabel\(null\); \} : undefined\}/.test(pdfTools));
check('compressed downloads get their own file name and title',
  /download\(out, compressedLabel \? 'merged-compressed\.pdf' : 'merged\.pdf'\)/.test(pdfTools)
  && /title=\{compressedLabel \? 'PDFs merged & compressed' : 'PDFs merged successfully'\}/.test(pdfTools));
check('the merge guide documents the new option',
  /Compress more/.test(pdfGuide) && /Can I make the merged file smaller\?/.test(pdfGuide));

console.log('\n=== 🔗 Tools index URL (/free-seo-tools) ===');
const seoUtil = read('src/utils/seo.ts');
const appSrcTools = read('src/App.tsx');
const menuSrcTools = read('src/components/ToolCategoriesMenu.tsx');
const sitemapXml = read('public/sitemap.xml');
const dataSrc = read('src/tools/data.tsx');
check('canonical tools index path is /free-seo-tools in code',
  /export const TOOLS_PATH = '\/free-seo-tools';/.test(read('src/router.ts'))
  && /path: '\/free-seo-tools',/.test(seoUtil));
check('no link in the app points at the old /free-tools URL',
  !/href=(["'`])\/free-tools[?"'`]/.test(appSrcTools + menuSrcTools + read('src/tools/Sidebar.tsx') + read('src/tools/Tools.tsx') + store));
check('home page category cards link to the category pages',
  /href=\{categoryHref\(cat\)\}/.test(appSrcTools) && /href="\/free-seo-tools"/.test(appSrcTools));
check('mega menu links every category to its own page', /href=\{categoryHref\(cat\)\}/.test(menuSrcTools));
check('sitemap lists the /free-seo-tools index', sitemapXml.includes('<loc>https://seoaudittools.pk/free-seo-tools</loc>'));
check('SEO canonical collapses the old index spellings',
  /clean === '\/tools' \|\| clean === '\/tool' \|\| clean === '\/free-tools' \|\| clean === '\/free-seo-tool'\) clean = TOOLS_PATH;/.test(seoUtil));

console.log('\n=== 🔗 Tool page URL hierarchy (/<slug>) ===');
const routerSrcT = read('src/router.ts');
const htaccessT = read('public/.htaccess');
const sitemapT = read('public/sitemap.xml');
const linkSources = appSrcTools + menuSrcTools + read('src/tools/Sidebar.tsx') + read('src/tools/Tools.tsx') + read('src/tools/toolContent.tsx') + store + seoUtil;
check('tool pages are top level in the router + seo',
  /export const TOOL_PATH_BASE = '';/.test(routerSrcT)
  && /const LEGACY_TOOL_PATHS = \[TOOLS_PATH, '\/free-seo-tool', '\/free-tools', '\/tool'\];/.test(routerSrcT)
  && /path: `\/\$\{tool\.slug\}`,/.test(seoUtil)
  && /const url = `\$\{origin\}\/\$\{tool\.slug\}`;/.test(seoUtil));
// Any mention of the retired nesting must live in redirect/normalisation code
// (a startsWith check), never in a link the user can click.
const staleLinkLines = linkSources.split('\n')
  .filter(line => /free-seo-tools\/|free-seo-tool\/|\/tool\//.test(line))
  .filter(line => !/startsWith|LEGACY_TOOL_PATHS|TOOLS_PATH|canonicalToolsPath/.test(line))
  .filter(line => /href/.test(line))              // a link, not a text cleanup regex
  .filter(line => !/^\s*\*/.test(line))       // doc comments may name the old paths
  .filter(line => !/^\s*\/\//.test(line));
check('no link in the app still points at a nested tool URL',
  !/href=\{[`"']\/free-seo-tools\//.test(linkSources) && staleLinkLines.length === 0,
  staleLinkLines.join(' | '));
check('tool cards, sidebar and related links use /<slug>',
  /href=\{`\/\$\{t\.slug\}`\}/.test(read('src/tools/Tools.tsx'))
  && /href=\{`\/\$\{t\.slug\}`\}/.test(read('src/tools/Sidebar.tsx'))
  && /href=\{`\/\$\{t\.slug\}`\}/.test(read('src/tools/toolContent.tsx')));
check('sitemap lists all 154 tools at the top level',
  (sitemapT.match(/<loc>https:\/\/seoaudittools\.pk\/[a-z0-9-]+<\/loc>/g) || []).length >= 154
  && !/seoaudittools\.pk\/free-seo-tools\//.test(sitemapT)
  && !/seoaudittools\.pk\/tool</.test(sitemapT));
check('router strips every legacy nesting prefix to the top-level slug',
  /for \(const prefix of LEGACY_TOOL_PATHS\) \{\s*if \(pathname\.startsWith\(`\$\{prefix\}\/`\)\) return pathname\.slice\(prefix\.length\);/.test(routerSrcT));
check('.htaccess 301s every legacy nesting to /<slug>',
  /RewriteRule \^free-seo-tools\/\(\.\+\?\)\/\?\$ \/\$1 \[R=301,L\]/.test(htaccessT)
  && /RewriteRule \^tool\/\(\.\+\?\)\/\?\$ \/\$1 \[R=301,L\]/.test(htaccessT)
  && /RewriteRule \^free-tools\/\(\.\+\?\)\/\?\$ \/\$1 \[R=301,L\]/.test(htaccessT)
  && /RewriteRule \^free-seo-tool\/\(\.\+\?\)\/\?\$ \/\$1 \[R=301,L\]/.test(htaccessT));
check('.htaccess 301s every bare legacy index spelling to /free-seo-tools',
  ['tools', 'tool', 'free-tools', 'free-seo-tool'].every(name =>
    htaccessT.includes(`RewriteRule ^${name}/?$ /free-seo-tools [R=301,L]`)));
check('stored CMS hrefs upgrade the legacy tool prefixes',
  /for \(const prefix of \['\/free-seo-tools', '\/tool', '\/free-tools', '\/free-seo-tool'\]\) \{\s*if \(value\.startsWith\(`\$\{prefix\}\/`\)\) return value\.slice\(prefix\.length\);/.test(store));

console.log('\n=== 🗂️ Category pages (/ip-tools) ===');
check('every category has its own top-level slug',
  /text: 'text-analysis-tools',/.test(dataSrc) && /management: 'website-management-tools',/.test(dataSrc)
  && /checker: 'website-checker-tools',/.test(dataSrc) && /ip: 'ip-tools',/.test(dataSrc)
  && /converter: 'unit-converter-tools',/.test(dataSrc)
  && (dataSrc.match(/^  (?:text|keyword|backlink|management|checker|domain|ip|pdf|image|calculator|converter): '[a-z-]+-tools',$/gm) || []).length === 11);
check('categoryHref builds the page URL',
  /export const categoryHref = \(category: ToolCategory\): string => `\/\$\{categorySlugs\[category\]\}`;/.test(dataSrc));
check('router resolves a category slug to its own route',
  /const category = categoryFromSlug\(seg\);\s*if \(category\) return `cat\/\$\{category\}`;/.test(routerSrcT));
check('the app renders a category page from that route',
  /route\.startsWith\('cat\/'\) && <ToolsList category=\{categoryKeyOfRoute\(route\) \|\| undefined\} \/>/.test(appSrcTools));
check('breadcrumbs go Home › Free SEO Tools › category',
  /if \(route\.startsWith\('cat\/'\)\) \{[\s\S]{0,240}Free SEO Tools'[\s\S]{0,140}categoryLabels\[cat\] : 'Tools' \}\]/.test(appSrcTools));
check('a category page has its own H1, intro and search',
  /category \? \([\s\S]{0,800}\{categoryLabels\[category\]\}[\s\S]{0,600}\{categoryDescriptions\[category\]\}/.test(read('src/tools/Tools.tsx'))
  && /placeholder=\{category \? `Search \$\{categoryLabels\[category\]\}…` : 'Search tools… e\.g\. plagiarism, sitemap, SSL'\}/.test(read('src/tools/Tools.tsx')));
check('category pages filter the list to that category',
  /const activeCat: 'all' \| ToolCategory = category \|\| 'all';/.test(read('src/tools/Tools.tsx')));
check('search stays in ?q= on whichever page is open',
  /navigate\(qs \? `\$\{basePath\}\?\$\{qs\}` : basePath, \{ replace: true \}\)/.test(read('src/tools/Tools.tsx')));
check('"Show all N tools" leaves a category page for the index',
  /Show all \{tools\.length\} tools/.test(read('src/tools/Tools.tsx'))
  && /const clearFilters = useCallback\(\(\) => \{ setQuery\(''\); navigate\(TOOLS_PATH\); \}, \[\]\);/.test(read('src/tools/Tools.tsx')));
check('SEO gives every category a canonical URL, ItemList and breadcrumb',
  /if \(route\.startsWith\('cat\/'\)\) \{/.test(seoUtil)
  && /const path = `\/\$\{categorySlugs\[cat\]\}`;/.test(seoUtil)
  && /'@type': 'CollectionPage',/.test(seoUtil)
  && /'@type': 'BreadcrumbList',/.test(seoUtil)
  && /title: `\$\{label\} — \$\{list\.length\} Free Online Tools \| \$\{brand\}`,/.test(seoUtil));
check('.htaccess 301s a legacy ?cat= filter onto the category page',
  ['text-analysis-tools', 'website-management-tools', 'website-checker-tools', 'ip-tools', 'unit-converter-tools'].every(slug =>
    htaccessT.includes(`RewriteRule ^free-seo-tools/?$ /${slug}? [R=301,L]`)));
check('router upgrades a mixed ?cat=&q= query without dropping the search',
  /export const canonicalCategoryQuery = \(pathname: string, search: string\): string \| null => \{/.test(routerSrcT)
  && /const category = canonicalCategoryQuery\(next, search\);/.test(routerSrcT)
  && /return `\$\{categoryHref\(key\)\}\$\{qs \? `\?\$\{qs\}` : ''\}`;/.test(routerSrcT));
check('sitemap lists all eleven category pages',
  ['text-analysis-tools', 'keyword-tools', 'backlink-tools', 'website-management-tools', 'website-checker-tools',
    'domain-tools', 'ip-tools', 'pdf-tools', 'image-tools', 'calculator-tools', 'unit-converter-tools']
    .every(slug => sitemapT.includes(`<loc>https://seoaudittools.pk/${slug}</loc>`)));

console.log('\n=== 🃏 Tool cards (four-up, two-line copy) ===');
const listSrcCards = read('src/tools/Tools.tsx');
const dataSrcCards = read('src/tools/data.tsx');
check('the tools listing is four-up on desktop (two-up on phones, one-up on mobile)',
  /grid sm:grid-cols-2 lg:grid-cols-4 gap-4/.test(listSrcCards));
check('category section headings are 1.35rem',
  /const CATEGORY_HEADING_SIZE = \{ fontSize: '1\.35rem' \} as const;/.test(listSrcCards)
  && /style=\{CATEGORY_HEADING_SIZE\}/.test(listSrcCards));
check('tool names on the cards are 1rem',
  /const TOOL_NAME_SIZE = \{ fontSize: '1rem' \} as const;/.test(listSrcCards)
  && /style=\{TOOL_NAME_SIZE\}/.test(listSrcCards));
check('the category heading links to that category page on the index',
  /href=\{categoryHref\(cat\)\}/.test(listSrcCards)
  && /group-hover\/heading:text-indigo-600/.test(listSrcCards));
check('a category page does not link its own heading back to itself',
  /\{category \? \([\s\S]{0,400}<h2 className="font-bold text-slate-900" style=\{CATEGORY_HEADING_SIZE\}>/.test(listSrcCards));
check('every card description is clamped to exactly two lines',
  /line-clamp-2 min-h-\[2\.5rem\]/.test(listSrcCards) && /toolTagline\(t\)/.test(listSrcCards));
const taglineBlock = dataSrcCards.slice(dataSrcCards.indexOf('export const toolTaglines'), dataSrcCards.indexOf('export const toolTagline ='));
const taglines = [...taglineBlock.matchAll(/^  '([a-z0-9-]+)': '((?:[^'\\]|\\.)*)',$/gm)];
const toolSlugs = [...dataSrcCards.matchAll(/slug: '([^']+)'/g)].map(m => m[1]);
const taglineTexts = taglines.map(m => m[2].replace(/\\'/g, "'"));
check('all 154 built-in tools have their own card tagline',
  taglines.length === 155 && toolSlugs.every(slug => taglines.some(m => m[1] === slug)),
  `${taglines.length} taglines for ${toolSlugs.length} tools`);
check('every tagline is a complete two-line sentence (60-108 characters)',
  taglineTexts.every(t => t.length >= 60 && t.length <= 108),
  taglineTexts.filter(t => t.length < 60 || t.length > 108).join(' | '));
check('no two tools share a tagline',
  new Set(taglineTexts).size === taglineTexts.length);
check('the tagline is card-only — descriptions keep serving SEO and tool pages',
  /toolTagline = \(tool: \{ slug: string; description: string \}\): string =>\s*toolTaglines\[tool\.slug\] \|\| tool\.description;/.test(dataSrcCards)
  && /const description = seo\?\.description \|\| tool\.description;/.test(seoUtil));

console.log('\n=== 🧭 Tool Categories mega menu ===');
const appSrc = read('src/App.tsx');
const menuSrc = read('src/components/ToolCategoriesMenu.tsx');
check('Tool Categories trigger lives in the desktop nav',
  /<ToolCategoriesMenu route=\{route\} \/>\s*\n\s*<a href="\/competitor-analysis"/.test(appSrc));
check('burger menu gets the same categories',
  /<ToolCategoriesMobileSection onNavigate=\{\(\) => setMobileMenuOpen\(false\)\} \/>/.test(appSrc));
check('trigger is an accessible disclosure', /aria-haspopup="true"[\s\S]{0,120}aria-expanded=\{open\}/.test(menuSrc)
  && /aria-controls="tool-categories-menu"/.test(menuSrc));
check('panel opens on hover and on click', /onMouseEnter=\{\(\) => \{ clearTimer\(\); setOpen\(true\); \}\}/.test(menuSrc)
  && /onClick=\{\(\) => setOpen\(o => !o\)\}/.test(menuSrc));
check('panel closes on Escape, outside click and navigation',
  /e\.key === 'Escape'/.test(menuSrc) && /wrapRef\.current\.contains/.test(menuSrc) && /useEffect\(\(\) => \{ setOpen\(false\); \}, \[route\]\)/.test(menuSrc));
check('eleven categories in three columns, in the approved order',
  /const COLUMNS: ToolCategory\[\]\[\] = \[\s*\['text', 'keyword', 'backlink', 'calculator'\],\s*\['management', 'checker', 'domain', 'converter'\],\s*\['ip', 'pdf', 'image'\],\s*\];/.test(menuSrc));
check('every category link points at its own category page',
  /href=\{categoryHref\(cat\)\}/.test(menuSrc));
check('counts come from the live CMS tool list', /cms\.state\.tools\.forEach\(t => \{[\s\S]{0,80}if \(t\.status !== 'live'\) return;/.test(menuSrc)
  && /categoryLabels\[cat\]\} <span className="text-slate-400">\(\{counts\.get\(cat\) \|\| 0\}\)/.test(menuSrc));
check('menu offers a browse-all link to /free-seo-tools', /Browse all \{total\} free tools/.test(menuSrc));
const listSrc = read('src/tools/Tools.tsx');
check('tools page drops the category filter chips',
  !/onCatChange|pillCls|countByCat/.test(listSrc)
  && !/All Tools \(\{tools\.length\}\)/.test(listSrc));
check('tools page hero carries the home gradient band',
  /<section className="pt-16 pb-16 px-4 bg-gradient-to-br from-indigo-100 via-violet-50 to-purple-100">/.test(listSrc));
check('filtered tools pages keep a "Show all" reset',
  /Show all \{tools\.length\} tools/.test(listSrc) && /onClick=\{clearFilters\}/.test(listSrc));
check('top-nav text is never bold on hover or when selected',
  (() => {
    const navRegion = appSrc.slice(appSrc.indexOf('hidden md:flex items-center gap-7'), appSrc.indexOf('</nav>'));
    return !/font-(semibold|bold|extrabold|black)/.test(navRegion)
      && /'text-indigo-600' : 'text-slate-600 hover:text-indigo-600'/.test(navRegion)
      && !/font-(semibold|bold)/.test(/<button[\s\S]*?Tool Categories[\s\S]*?<\/button>/.exec(menuSrc)?.[0] || '');
  })());
check('mega panel repeats no heading — the nav item is the label',
  /No heading inside the panel/.test(menuSrc)
  && !/<h[1-6][^>]*>Tool Categories<\/h[1-6]>/.test(menuSrc)
  && /shadow-2xl px-5 py-4 lg:px-6 lg:py-5/.test(menuSrc));
check('panel is a viewport-safe mega panel under the nav', /fixed left-0 right-0 top-16 z-50 px-4 pt-3/.test(menuSrc)
  && /max-w-7xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-2xl/.test(menuSrc));

console.log('\n=== 📱 Text Analysis Tools (layout + mobile) ===');
const toolsSrc = read('src/tools/Tools.tsx');
const grammar = read('src/tools/GrammarChecker.tsx');
const plag = read('src/tools/PlagiarismChecker.tsx');
const rewriter = read('src/tools/ArticleRewriter.tsx');
const engines = read('src/tools/engines.tsx');
check('text category flagged for the stacked layout', /const stacked = tool\.category === 'text';/.test(toolsSrc));
check('stacked layout renders the panel full width above the grid',
  /if \(stacked\) \{[\s\S]{0,320}\{header\}[\s\S]{0,200}\{featuredImage\}[\s\S]{0,200}\{panel\}[\s\S]{0,300}grid lg:grid-cols-\[minmax\(0,1fr\)_minmax\(0,300px\)\]/.test(toolsSrc));
check('sidebar starts level with the About column', /<ToolRelatedContent tool=\{tool\} related=\{related\} \/>[\s\S]{0,200}<div className="mt-10 min-w-0">[\s\S]{0,120}<Sidebar/.test(toolsSrc));
check('other categories keep the classic two-column layout',
  /if \(stacked\) \{[\s\S]{0,1400}return \(\s*<div className="pt-10 pb-20 px-4 min-h-screen">/.test(toolsSrc));
check('text tools use tighter mobile page padding', /<>pt-8 sm:pt-10 pb-16 sm:pb-20 px-3 sm:px-4 min-h-screen<|className="pt-8 sm:pt-10 pb-16 sm:pb-20 px-3 sm:px-4 min-h-screen"/.test(toolsSrc)
  || /pt-8 sm:pt-10 pb-16 sm:pb-20 px-3 sm:px-4/.test(toolsSrc));
check('text-tool heading scales from 26px on phones', /stacked \? 'text-\[26px\] leading-\[1\.15\] sm:text-3xl md:text-5xl'/.test(toolsSrc));
check('grammar checker editor shrinks on phones', /min-h-\[300px\] sm:min-h-\[420px\] p-4 sm:p-6 md:p-8/.test(grammar));
check('grammar checker selects fill the row on phones', /flex flex-1 min-w-0 sm:flex-none items-center rounded-lg/.test(grammar)
  && /appearance-none w-full bg-transparent px-3 sm:px-4 py-3 text-slate-800 text-sm sm:text-\[15px\]/.test(grammar)
  && /w-full sm:w-auto sm:ml-auto bg-gradient-to-r/.test(grammar));
check('grammar stat cards shrink on phones', /border-2 rounded-lg py-3 sm:py-4 px-2 sm:px-3 text-center/.test(grammar));
check('plagiarism editor + toolbar stack on phones', /min-h-\[280px\] sm:min-h-\[380px\] p-4 sm:p-6/.test(plag)
  && /w-full sm:w-auto sm:mr-auto text-sm sm:text-base/.test(plag)
  && /flex overflow-x-auto border-t border-slate-200 px-3 sm:px-5/.test(plag));
check('article rewriter steps + editor scale down on phones', /w-11 h-11 sm:w-14 sm:h-14 rounded-full/.test(rewriter)
  && /min-h-\[300px\] sm:min-h-\[440px\] p-4 sm:p-6 md:p-8/.test(rewriter)
  && /w-full appearance-none bg-white border border-slate-300/.test(rewriter)
  && !/(?<!sm:)min-w-\[240px\]/.test(rewriter));
check('text outputs wrap long tokens', /break-words/.test(engines) && /break-all/.test(engines));
check('case converter results sit in two columns',
  /const CaseConverter[\s\S]{0,1600}<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">[\s\S]{0,200}<div key=\{label\} className="min-w-0 bg-slate-900 rounded-xl p-3">/.test(engines));
check('text-to-speech survives browsers without the speech API', /const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;/.test(engines)
  && /if \(!supported\) return;/.test(engines));

console.log('\n=== 🔗 URLs ===');
check('.htaccess 301 /tools → /free-seo-tools', /RewriteRule \^tools\/\?\$ \/free-seo-tools \[R=301,L\]/.test(htaccess));
check('.htaccess 301 /free-tools → /free-seo-tools', /RewriteRule \^free-tools\/\?\$ \/free-seo-tools \[R=301,L\]/.test(htaccess));
check('.htaccess 301 /tool → /free-seo-tools', /RewriteRule \^tool\/\?\$ \/free-seo-tools \[R=301,L\]/.test(htaccess));
check('.htaccess 301 /free-seo-tool → /free-seo-tools', /RewriteRule \^free-seo-tool\/\?\$ \/free-seo-tools \[R=301,L\]/.test(htaccess));
check('router canonicalises the four index spellings',
  /export const LEGACY_TOOLS_PATHS = \['\/tools', '\/tool', '\/free-tools', '\/free-seo-tool'\];/.test(router)
  && /next = canonicalToolsPath\(next\);/.test(router)
  && /p = canonicalToolsPath\(p\);/.test(router));
check('route alias maps the tools paths to the free-tools route',
  /seg === TOOLS_PATH\.slice\(1\) \|\| LEGACY_TOOLS_PATHS\.some\(p => p\.slice\(1\) === seg\)/.test(router));
check('stored content rewrites legacy tool paths',
  /if \(value === '\/tools' \|\| value === '\/tool' \|\| value === '\/free-tools' \|\| value === '\/free-seo-tool'\) return '\/free-seo-tools';/.test(store));
check('nav default points at /free-seo-tools', /label: 'Free SEO Tools', href: '\/free-seo-tools', visible: true/.test(store));
check('canonical uses clean path (no #/)', /return `\$\{origin\}\$\{clean\}`/.test(seo) && !/return `\$\{origin\}\/#\$\{clean\}`/.test(seo));
check('sitemap uses /free-seo-tools', sitemap.includes('<loc>https://seoaudittools.pk/free-seo-tools</loc>') && !/seoaudittools\.pk\/free-tools</.test(sitemap));

console.log('\n=== ✅ Preserved ===');
check('no "Loading page" anywhere in src', !/Loading page/.test(read('src/App.tsx') + read('src/components/ErrorBoundary.tsx') + read('src/tools/Tools.tsx')));
const codeOnly = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
check('no Suspense / lazyRoute in the app', !/<Suspense|React\.lazy\(|lazyRoute\(/.test(codeOnly(app) + codeOnly(read('src/tools/Tools.tsx')))
  && !existsSync('src/utils/lazyRetry.ts'));
check('no loading state in the built file', !/Loading page|Loading PDF engine/.test(dist));
check('content-shell min-height for the footer', /\.content-shell \{[\s\S]{0,120}min-height: calc\(100vh - 4rem\)/.test(css) && /@supports \(height: 100dvh\)/.test(css));
check('main uses content-shell', /<main id="main-content" tabIndex=\{-1\} className="content-shell">/.test(app));
check('154 built-in tools intact', (tools.match(/slug: '/g) || []).length === 154, String((tools.match(/slug: '/g) || []).length));
check('admin login page + default creds intact', /AdminLoginPage/.test(app) && /passcode: 'admin123'/.test(store) && /export const AdminLoginPage/.test(read('src/cms/AdminLogin.tsx')));
check('no EKSTRUH in src/public/index.html', !/EKSTRUH/.test(read('src/App.tsx') + store + admin + seo + read('index.html') + htaccess));
check('no EKSTRUH in the built file', !/EKSTRUH/.test(dist));
check('single file: no external chunk reference', !/<script[^>]*src="\/assets\//.test(dist));
check('no assets/ directory in dist', !existsSync('dist/assets'));
check('design/CSS present (tailwind inline)', /\.content-shell/.test(dist) && /--tw-/.test(dist));

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} feature checks passed`);
process.exit(failed.length ? 1 : 0);
