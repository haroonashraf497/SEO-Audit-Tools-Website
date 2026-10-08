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
check('footer column headings keep their own 18px / capitalize / 0 letter-spacing spec',
  /<h3 className="heading-card text-\[18px\] font-bold capitalize tracking-\[0px\] text-slate-400 mb-4">\{col\.title\}<\/h3>/.test(app)
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
  /href=\{toolCategoryHref\(cms\.state, cat\.key\)\}/.test(appSrcTools) && /href="\/free-seo-tools"/.test(appSrcTools));
check('mega menu links every category to its own page', /href=\{toolCategoryHref\(cms\.state, cat\.key\)\}/.test(menuSrcTools));
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
  /if \(route\.startsWith\('cat\/'\)\) \{[\s\S]{0,240}Free SEO Tools'[\s\S]{0,220}toolCategoryName\(state, cat\)/.test(appSrcTools)
  && /if \(route\.startsWith\('toolcat\/'\)\) \{[\s\S]{0,240}Free SEO Tools'[\s\S]{0,220}resolveToolCategory\(state, slug\)\?\.name/.test(appSrcTools));
check('a category page has its own H1, intro and search',
  /activeKey \? \([\s\S]{0,800}\{activeName\}[\s\S]{0,700}\{activeSubtitle\}/.test(read('src/tools/Tools.tsx'))
  && /placeholder=\{activeKey \? `Search \$\{activeName\}…` : 'Search tools… e\.g\. plagiarism, sitemap, SSL'\}/.test(read('src/tools/Tools.tsx')));
check('category pages filter the list to that category',
  /const active = useMemo<CmsToolCategory \| undefined>\(/.test(read('src/tools/Tools.tsx'))
  && /\(!activeKey \|\| t\.category === activeKey\)/.test(read('src/tools/Tools.tsx')));
check('search stays in ?q= on whichever page is open',
  /navigate\(qs \? `\$\{basePath\}\?\$\{qs\}` : basePath, \{ replace: true \}\)/.test(read('src/tools/Tools.tsx')));
check('"Show all N tools" leaves a category page for the index',
  /Show all \{tools\.length\} tools/.test(read('src/tools/Tools.tsx'))
  && /const clearFilters = useCallback\(\(\) => \{ setQuery\(''\); navigate\(TOOLS_PATH\); \}, \[\]\);/.test(read('src/tools/Tools.tsx')));
check('SEO gives every category a canonical URL, ItemList and breadcrumb',
  /if \(route\.startsWith\('cat\/'\) \|\| route\.startsWith\('toolcat\/'\)\) \{/.test(seoUtil)
  && /const path = toolCategoryHref\(cms, cat\.key\);/.test(seoUtil)
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
const introBlock = dataSrc.slice(dataSrc.indexOf('export const categoryIntros'), dataSrc.indexOf('export const categoryOrder'));
const intros = [...introBlock.matchAll(/^  ([a-z]+): '((?:[^'\\]|\\.)*)',$/gm)].map(m => ({ key: m[1], text: m[2].replace(/\\'/g, "'") }));
check('every category has its own SEO introduction',
  intros.length === 11
  && ['text', 'keyword', 'backlink', 'management', 'checker', 'domain', 'ip', 'pdf', 'image', 'calculator', 'converter'].every(k => intros.some(i => i.key === k)),
  `${intros.length} intros`);
check('each introduction is a substantial, unique, category-specific paragraph',
  intros.every(i => i.text.length >= 200 && i.text.length <= 340)
  && new Set(intros.map(i => i.text)).size === intros.length,
  intros.filter(i => i.text.length < 200 || i.text.length > 340).map(i => `${i.key}:${i.text.length}`).join(', '));
check('the introduction is rendered under the heading on the index and on the category page',
  /\{cat\.description && <p className="text-\[15px\] sm:text-base text-slate-600 leading-relaxed mb-6">\{cat\.description\}<\/p>\}/.test(read('src/tools/Tools.tsx')));
check('the short one-liner stays for the home cards and meta description',
  /export const categoryDescriptions: Record<ToolCategory, string> = \{/.test(dataSrc)
  && /toolCategorySummary\(cms\.state, cat\.key\)/.test(appSrcTools)
  && /\$\{toolCategorySummary\(cms, cat\.key\)\} \$\{list\.length\} free/.test(seoUtil)
  && /export const toolCategorySummary = \(state: CmsState, key: string\): string => \{/.test(store));

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
  /href=\{cat\.builtin \? `\/\$\{cat\.slug\}` : toolCategoryPath\(cat\.slug\)\}/.test(listSrcCards)
  && /group-hover\/heading:text-indigo-600/.test(listSrcCards));
check('a category page does not link its own heading back to itself',
  /\{activeKey \? \([\s\S]{0,460}<h2 className="heading-card font-bold text-slate-900" style=\{CATEGORY_HEADING_SIZE\}>All \{cat\.name\}<\/h2>/.test(listSrcCards));
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
check('the header renders every entry from Admin → Sections & Nav, in list order',
  /\{\/\* Every header link comes from Admin → Sections & Nav, in list order\. \*\/\}/.test(appSrc)
  && /cms\.state\.nav\.filter\(n => n\.visible && \(!\(n\.href \|\| ''\)\.includes\('\/admin'\) \|\| cms\.loggedIn\)\)\.map\(n => \{\s*if \(n\.kind === 'tool-categories'\) return <ToolCategoriesMenu key=\{n\.id\} route=\{route\} label=\{n\.label\} \/>;/.test(appSrc)
  && /if \(n\.kind === 'tool-categories'\) return <ToolCategoriesMobileSection key=\{n\.id\} onNavigate=\{\(\) => setMobileMenuOpen\(false\)\} label=\{n\.label\} \/>;/.test(appSrc));
check('burger menu gets the same categories and the CMS label',
  /<ToolCategoriesMobileSection key=\{n\.id\} onNavigate=\{\(\) => setMobileMenuOpen\(false\)\} label=\{n\.label\} \/>/.test(appSrc));
check('trigger is an accessible disclosure', /aria-haspopup="true"[\s\S]{0,120}aria-expanded=\{open\}/.test(menuSrc)
  && /aria-controls="tool-categories-menu"/.test(menuSrc));
check('panel opens on hover and on click', /onMouseEnter=\{\(\) => \{ clearTimer\(\); setOpen\(true\); \}\}/.test(menuSrc)
  && /onClick=\{\(\) => setOpen\(o => !o\)\}/.test(menuSrc));
check('panel closes on Escape, outside click and navigation',
  /e\.key === 'Escape'/.test(menuSrc) && /wrapRef\.current\.contains/.test(menuSrc) && /useEffect\(\(\) => \{ setOpen\(false\); \}, \[route\]\)/.test(menuSrc));
check('eleven categories in three columns, in the approved order',
  /const COLUMNS: ToolCategory\[\]\[\] = \[\s*\['text', 'keyword', 'backlink', 'calculator'\],\s*\['management', 'checker', 'domain', 'converter'\],\s*\['ip', 'pdf', 'image'\],\s*\];/.test(menuSrc));
check('every category link points at its own category page',
  /href=\{toolCategoryHref\(cms\.state, cat\.key\)\}/.test(menuSrc));
check('counts come from the live CMS tool list', /cms\.state\.tools\.forEach\(t => \{[\s\S]{0,80}if \(t\.status !== 'live'\) return;/.test(menuSrc)
  && /\{cat\.name\} <span className="text-slate-400">\(\{counts\.get\(cat\.key\) \|\| 0\}\)/.test(menuSrc));
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
check('text-tool heading follows the global h1 scale and only tightens its leading',
  /stacked \? ' leading-\[1\.15\]' : ''/.test(toolsSrc)
  && !/stacked \? 'text-\[26px\]/.test(toolsSrc));
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
check('the default navigation menu lists every live header entry, mega menu included',
  /const defaultNav = \(\): NavItem\[\] => \[\s*\{ id: uid\(\), label: 'Home', href: '\/', visible: true, kind: 'link' \},\s*\{ id: uid\(\), label: 'Free SEO Tools', href: '\/free-seo-tools', visible: true, kind: 'link' \},\s*\{ id: uid\(\), label: 'Tool Categories', href: '', visible: true, kind: 'tool-categories' \},\s*\{ id: uid\(\), label: 'Competitor Analysis', href: '\/competitor-analysis', visible: true, kind: 'link' \},\s*\];/.test(store)
  && /nav: defaultNav\(\),/.test(store)
  && /kind\?: 'link' \| 'tool-categories';/.test(store));
check('a menu saved before this update gets the missing entries back in live order',
  /const withHeaderDefaults = \(items: NavItem\[\]\): NavItem\[\] => \{/.test(store)
  && /if \(!out\.some\(n => \(n\.href \|\| ''\)\.trim\(\) === '\/'\)\) \{\s*out\.unshift\(\{ id: uid\(\), label: 'Home', href: '\/', visible: true, kind: 'link' \}\);/.test(store)
  && /if \(!out\.some\(n => n\.kind === 'tool-categories'\)\) \{/.test(store)
  && /out\.splice\(toolsIndex \+ 1, 0, mega\)/.test(store)
  && /if \(!out\.some\(n => \(n\.href \|\| ''\)\.includes\('competitor-analysis'\)\)\) \{/.test(store));
check('the mega-menu entry keeps no URL of its own while other hrefs are cleaned',
  /return nav\.map\(n => \(n\.kind === 'tool-categories' \? \{ \.\.\.n, href: '' \} : \{ \.\.\.n, href: cleanStoredHref\(n\.href\), kind: n\.kind \|\| 'link' \}\)\);/.test(store)
  && /const nav = LEGACY_NAV_SIGNATURES\.includes\(signature\) \? defaultNav\(\) : withHeaderDefaults\(storedNav\);/.test(store));
check('the admin lists the mega-menu row with a note instead of a URL field',
  /hrefNote\?: string;;?/.test(admin)
  && /hrefNote=\{n\.kind === 'tool-categories' \? 'Mega menu → all category pages' : undefined\}/.test(admin)
  && /hrefNote\s*\n?\s*\? <span className=\{inputCls \+ ' max-w-\[240px\] font-mono text-xs bg-slate-50 text-slate-500 flex items-center'\}/.test(admin));
check('the admin navigation copy names the four live links',
  /Every link in the header \(desktop and mobile\) is listed below, in the order it appears — Home, Free SEO Tools, Tool Categories, Competitor Analysis\./.test(admin));
check('the mega-menu trigger shows the label saved in the CMS',
  /export const ToolCategoriesMenu: React\.FC<\{ route\?: string; label\?: string \}> = \(\{ route, label = 'Tool Categories' \}\) => \{/.test(read('src/components/ToolCategoriesMenu.tsx'))
  && /export const ToolCategoriesMobileSection: React\.FC<\{ onNavigate: \(\) => void; label\?: string \}> = \(\{ onNavigate, label = 'Tool Categories' \}\) => \{/.test(read('src/components/ToolCategoriesMenu.tsx'))
  && (read('src/components/ToolCategoriesMenu.tsx').match(/\{label\}\s*\n\s*<Chevron up=\{open\} \/>/g) || []).length === 2);
check('the footer column editor is untouched by the navigation change',
  /const FooterColumnEditor: React\.FC<\{/.test(admin) && /<MenuRowEditor\s*\n\s*key=\{link\.id\}/.test(admin));
check('canonical uses clean path (no #/)', /return `\$\{origin\}\$\{clean\}`/.test(seo) && !/return `\$\{origin\}\/#\$\{clean\}`/.test(seo));
check('sitemap uses /free-seo-tools', sitemap.includes('<loc>https://seoaudittools.pk/free-seo-tools</loc>') && !/seoaudittools\.pk\/free-tools</.test(sitemap));

console.log('\n=== 🏷️ Blog categories ===');
const blogSrc = read('src/blog/Blog.tsx');
const adminSrc = read('src/cms/Admin.tsx');
check('the store models blog categories and their clean URLs',
  /export interface CmsBlogCategory \{[\s\S]{0,200}name: string;[\s\S]{0,80}slug: string;[\s\S]{0,80}visible: boolean;/.test(store)
  && /blogCategories: CmsBlogCategory\[\];/.test(store)
  && /blogCategories: defaultBlogCategories,/.test(store)
  && /export const blogCategorySlug = \(name: string\): string =>/.test(store)
  && /export const UNCATEGORIZED = 'Uncategorized';/.test(store));
check('the five built-in article categories are seeded and migrated',
  /export const defaultBlogCategories: CmsBlogCategory\[\] = \[[\s\S]{0,400}'Core Web Vitals'[\s\S]{0,200}'PageSpeed'[\s\S]{0,200}'WordPress SEO'[\s\S]{0,200}'Google & Indexing'[\s\S]{0,200}'Website Health'/.test(store)
  && /const migrateBlogCategories = \(saved\?: CmsBlogCategory\[\]\): CmsBlogCategory\[\] => \{/.test(store)
  && /blogCategories: migrateBlogCategories\(parsed\.blogCategories\),/.test(store)
  && /blogCategories: migrateBlogCategories\(parsed\.blogCategories\), toolCategories: migrateToolCategories\(parsed\.toolCategories\), competitor: migrateCompetitor\(parsed\.competitor\), seo: migrateSeo/.test(store));
check('adding, renaming, hiding and removing categories all persist',
  /addBlogCategory: \(name\) => \{/.test(store)
  && /saveBlogCategory: \(slug, patch\) => setState\(s => \{/.test(store)
  && /setBlogCategoryVisible: \(slug, visible\) =>/.test(store)
  && /removeBlogCategory: \(slug\) => setState\(s => \{/.test(store));
check('removing a category keeps its posts as Uncategorized',
  /blogCategories: s\.blogCategories\.filter\(c => c\.slug !== slug\),\s*posts: s\.posts\.map\(p => \(p\.category === current\.name \? \{ \.\.\.p, category: UNCATEGORIZED \} : p\)\)/.test(store));
check('renaming a category relabels its posts',
  /posts: nextName === current\.name \? s\.posts : s\.posts\.map\(p => \(p\.category === current\.name \? \{ \.\.\.p, category: nextName \} : p\)\)/.test(store));
check('the admin Blog posts tab carries the new Blog Categories section',
  /const BlogCategoriesSection: React\.FC = \(\) => \{/.test(adminSrc)
  && /<section aria-label="Blog Categories"/.test(adminSrc)
  && /<BlogCategoriesSection \/>\s*\{creating && <NewPostForm/.test(adminSrc));
check('the section has a name field, an auto slug and a save button',
  /<Field label="Category Name">/.test(adminSrc)
  && /<Field label="Category Slug" hint=\{effectiveSlug \? `\/blog\/category\/\$\{effectiveSlug\}`/.test(adminSrc)
  && /const autoSlug = blogCategorySlug\(name\);/.test(adminSrc)
  && /<SaveButton label="Add category" onSave=\{create\} \/>/.test(adminSrc));
check('every category row shows name, slug, post count and its actions',
  /\{blogCategoryHref\(cat\.slug\)\}/.test(adminSrc)
  && /postCount\(cat\)\} post/.test(adminSrc)
  && /setBlogCategoryVisible\(cat\.slug, !cat\.visible\)/.test(adminSrc)
  && /\(editing === cat\.id \? setEditing\(null\) : startEdit\(cat\)\)/.test(adminSrc)
  && /removeBlogCategory\(cat\.slug\)/.test(adminSrc));
check('the post editor and the new-post form both get an Assign Category dropdown',
  /const AssignCategory: React\.FC<\{ value: string; onChange: \(name: string\) => void; ariaLabel\?: string \}>/.test(adminSrc)
  && /<AssignCategory value=\{f\.category\} onChange=\{name => setF\(\{ \.\.\.f, category: name \}\)\} \/>/.test(adminSrc)
  && (adminSrc.match(/<AssignCategory value=\{f\.category\}/g) || []).length === 2
  && /<option value="__new__">\+ Add new category…<\/option>/.test(adminSrc)
  && /addBlogCategory\(clean\);\s*onChange\(clean\);/.test(adminSrc));
check('a category added in the editor appears in the dropdown straight away',
  /const visible = state\.blogCategories\.filter\(c => c\.visible\);/.test(adminSrc)
  && /const valueInList = known\.includes\(value\) \|\| value === UNCATEGORIZED;/.test(adminSrc));
check('the blog index no longer renders the Blog Categories section',
  !/<section aria-label="Blog Categories"/.test(blogSrc)
  && !/Blog Categories<\/h2>/.test(blogSrc)
  && !/href=\{`\/blog\/category\/\$\{cat\.slug\}`\}/.test(blogSrc)
  && /role="tablist" aria-label="Filter articles by category"/.test(blogSrc));
check('every blog filter tab shows its live article count',
  /const tabCounts = useMemo\(\(\) => \{\s*const counts: Record<string, number> = \{ All: posts\.length \};\s*for \(const post of posts\) counts\[post\.category\] = \(counts\[post\.category\] \|\| 0\) \+ 1;/.test(blogSrc)
  && /\{tabCounts\[cat\] \|\| 0\}/.test(blogSrc)
  && /text-indigo-100' : 'text-slate-400'/.test(blogSrc));
check('the category pages, their clean URLs and the admin manager are unchanged',
  /export const BlogCategoryPage: React\.FC<\{ slug: string \}> = \(\{ slug \}\) => \{/.test(blogSrc)
  && /postsInBlogCategory\(state, category\.name\)/.test(blogSrc)
  && /<BlogCategoriesSection \/>/.test(adminSrc)
  && /\{blogCategoryHref\(cat\.slug\)\}/.test(adminSrc));
check('the blog filter tabs come from the CMS categories',
  /const cats = useMemo\(\(\) => visibleBlogCategories\(state\), \[state\]\);/.test(blogSrc)
  && /const tabs = useMemo\(\(\) => \['All', \.\.\.cats\.map\(c => c\.name\)\], \[cats\]\);/.test(blogSrc)
  && /\{tabs\.map\(cat => \(/.test(blogSrc));
check('a category page lists that category only, with its own heading',
  /export const BlogCategoryPage: React\.FC<\{ slug: string \}> = \(\{ slug \}\) => \{/.test(blogSrc)
  && /postsInBlogCategory\(state, category\.name\)/.test(blogSrc)
  && /<h1 className="font-bold text-slate-900 leading-tight mb-4">\{category\.name\} articles<\/h1>/.test(blogSrc));
check('the router resolves /blog/category/<slug> before the article route',
  /if \(seg\.startsWith\('blog\/category\/'\)\) return `blogcat\/\$\{seg\.slice\('blog\/category\/'\.length\)\}`;[\s\S]{0,300}if \(seg\.startsWith\('blog\/'\)\) return `blog\/\$\{seg\.slice\(5\)\}`;/.test(read('src/router.ts')));
check('a blog category can be published on a top-level URL',
  /export const TOP_LEVEL_BLOG_CATEGORY_SLUGS = \['website-health'\];/.test(read('src/router.ts'))
  && /if \(TOP_LEVEL_BLOG_CATEGORY_SLUGS\.includes\(seg\)\) return `blogcat\/\$\{seg\}`;/.test(read('src/router.ts'))
  && /export const blogCategoryHref = \(slug: string\): string =>\s*TOP_LEVEL_BLOG_CATEGORY_SLUGS\.includes\(slug\) \? `\/\$\{slug\}` : `\/blog\/category\/\$\{slug\}`;/.test(read('src/router.ts')));
check('the app renders the category page and its breadcrumb',
  /route\.startsWith\('blogcat\/'\) && <BlogCategoryPage slug=\{route\.slice\('blogcat\/'\.length\)\} \/>/.test(app)
  && /if \(route\.startsWith\('blogcat\/'\)\) \{/.test(app));
check('SEO gives every category a canonical URL, ItemList and breadcrumb',
  /if \(route\.startsWith\('blogcat\/'\)\) \{/.test(read('src/utils/seo.ts'))
  && /const path = blogCategoryHref\(slug\);/.test(read('src/utils/seo.ts'))
  && /title: `\$\{category\.name\} — SEO Guides & Fixes \| \$\{brand\}`,/.test(read('src/utils/seo.ts'))
  && /hasPart: \(cms\.blogCategories \|\| \[\]\)\.filter\(c => c\.visible\)\.map\(c => \(/.test(read('src/utils/seo.ts')));
check('the sitemap lists the built-in category pages',
  ['core-web-vitals', 'pagespeed', 'wordpress-seo', 'google-indexing'].every(slug =>
    sitemap.includes(`<loc>https://seoaudittools.pk/blog/category/${slug}</loc>`))
  && sitemap.includes('<loc>https://seoaudittools.pk/website-health</loc>'));
check('.htaccess carries no Website Health redirect — the old URL simply does not exist',
  !htaccess.includes('website-seo-audit') && !/website-health \[R=301/.test(htaccess));

/* ---- Tool Categories: the categories managed in Admin → Tool Categories ---- */
check('the tool category model carries a key, a name, a slug and a description',
  /export interface CmsToolCategory \{[\s\S]{0,340}key: string;[\s\S]{0,120}name: string;[\s\S]{0,120}slug: string;[\s\S]{0,120}description: string;/.test(store));
check('the eleven built-in categories seed the managed list',
  /export const defaultToolCategories: CmsToolCategory\[\] = categoryOrder\.map\(key => \(\{[\s\S]{0,240}name: categoryLabels\[key\],[\s\S]{0,120}slug: categorySlugs\[key\],[\s\S]{0,120}description: categoryIntros\[key\],/.test(store));
check('the store carries the managed list and defaults to the seeded categories',
  /toolCategories: CmsToolCategory\[\];/.test(store) && /toolCategories: defaultToolCategories,/.test(store));
check('a browser that never saved any gets the seeded list, a saved one is kept',
  /const migrateToolCategories = \(saved\?: CmsToolCategory\[\]\): CmsToolCategory\[\] => \{\s*if \(!Array\.isArray\(saved\) \|\| saved\.length === 0\) return defaultToolCategories;/.test(store));
check('the stored CMS and an imported backup both run the migration',
  (store.match(/toolCategories: migrateToolCategories\(parsed\.toolCategories\)/g) || []).length === 2);
check('adding, editing and deleting a category all persist',
  /addToolCategory: \(\{ name, slug, description \}\) => \{/.test(store)
  && /saveToolCategory: \(key, patch\) => setState\(s => \{/.test(store)
  && /removeToolCategory: \(key\) => setState\(s => \{/.test(store));
check('a new category gets a generated key and the clean slug of its name',
  /let catSlug = toolCategorySlug\(slug \|\| clean\);/.test(store) && /let key = `custom-\$\{catSlug\}`;/.test(store));
check('editing changes the name, the slug and the description',
  /\.\.\.patch, key: current\.key, builtin: current\.builtin, name: nextName, slug: nextSlug/.test(store));
check('deleting a category keeps its tools in the nearest remaining category',
  /const fallback = remaining\[Math\.min\(index, remaining\.length - 1\)\]\.key;/.test(store)
  && /tools: s\.tools\.map\(t => \(t\.category === key \? \{ \.\.\.t, category: fallback \} : t\)\)/.test(store));
check('a category resolves from its key and from its slug',
  /export const resolveToolCategory = \(state: CmsState, value: string\): CmsToolCategory \| undefined => \{/.test(store)
  && /const legacyKey = categoryFromSlug\(value\);\s*return legacyKey \? toolCategoryByKey\(state, legacyKey\) : undefined;/.test(store));
check('a built-in category keeps its top-level page, an added one lives under /tools/category',
  /return cat\.builtin \? `\/\$\{categorySlugs\[cat\.key as ToolCategory\]\}` : `\$\{TOOL_CATEGORY_BASE\}\/\$\{cat\.slug\}`;/.test(store));
check('the tool editor, the new-tool form and the tools filter all use the managed list',
  (adminSrc.match(/state\.toolCategories\.map\(c => <option key=\{c\.id\} value=\{c\.key\}>\{c\.name\}<\/option>\)/g) || []).length >= 3);
check('a tool row shows the managed category name',
  /toolCategoryName\(state, t\.category\)/.test(adminSrc));
check('the Tool Categories tab sits next to Tools and renders its own pane',
  /\['tools', 'Tools'\], \['toolcats', 'Tool Categories'\]/.test(adminSrc)
  && /\{tab === 'toolcats' && <ToolCategoriesPane \/>\}/.test(adminSrc));
// Scoped to the pane itself: the Blog Categories pane still has an
// "Add category" button, and both panes reuse the same field labels.
const seoSrc = read('src/utils/seo.ts');
const toolCatsBody = (() => {
  const at = adminSrc.indexOf('const ToolCategoriesPane');
  const next = adminSrc.slice(at + 1).search(/\nconst [A-Z]/);
  return next < 0 ? adminSrc.slice(at) : adminSrc.slice(at, at + 1 + next);
})();
check('the pane edits each category in place and offers no add-category form',
  /const ToolCategoriesPane: React\.FC = \(\) => \{/.test(adminSrc)
  && /aria-label="Edit category name"/.test(toolCatsBody)
  && /aria-label="Edit category slug"/.test(toolCatsBody)
  && /label="Content Above Tools — appears after the heading, before the tools grid"/.test(toolCatsBody)
  && /aria-label="Edit content above tools"/.test(toolCatsBody)
  && /label="Content Below Tools — Before Footer"/.test(toolCatsBody)
  && !/label="Category Description"/.test(toolCatsBody)
  && !/label="Add category"/.test(toolCatsBody)
  && !/aria-label="Category Name"/.test(toolCatsBody)
  && !/addToolCategory\(/.test(toolCatsBody));
check('the category editor carries the full SEO block in the right order',
  toolCatsBody.indexOf('label="Category Name"') < toolCatsBody.indexOf('label="Category Slug"')
  && toolCatsBody.indexOf('label="Category Slug"') < toolCatsBody.indexOf('label="Content Above Tools')
  && toolCatsBody.indexOf('label="Content Above Tools') < toolCatsBody.indexOf('label="Content Below Tools')
  && toolCatsBody.indexOf('label="Content Below Tools') < toolCatsBody.indexOf('<SeoMetaEditor')
  && toolCatsBody.indexOf('<SeoMetaEditor') < toolCatsBody.indexOf('label="Save Changes"')
  && /<SeoMetaEditor[\s\S]{0,320}noindexControl="checkbox"/.test(toolCatsBody)
  && /placeholder="Add detailed content, FAQs, and information here — appears after all tools and above the footer\.\.\."/.test(toolCatsBody)
  && /fallbackTitle=\{auto\.title\}/.test(toolCatsBody)
  && /fallbackDescription=\{auto\.description\}/.test(toolCatsBody));
// The category copy editors live in the category row and nowhere else: the
// Tools tab used to render a second RichTextEditor writing the same
// CmsToolCategory.content field, which is what the "wrong place" report was
// about. One draftKey, one call site, nothing category-content related in Tools.
const toolsPaneBody = (() => {
  const at = adminSrc.indexOf('const ToolsPane: React.FC');
  const next = adminSrc.slice(at + 1).search(/\nconst [A-Z]/);
  return next < 0 ? adminSrc.slice(at) : adminSrc.slice(at, at + 1 + next);
})();
check('the Tools pane has no category content editor of its own',
  toolsPaneBody.length > 400
  && !/toolcat-content|activeCat|Category page content|Edit content above tools/.test(toolsPaneBody)
  && /const \{ state, setToolStatus, deleteTool \} = useCms\(\);/.test(toolsPaneBody)
  && (adminSrc.match(/draftId\('toolcat-content'/g) || []).length === 1
  && /draftId\('toolcat-content', cat\.key\)/.test(toolCatsBody)
  && /saveToolCategory\(cat\.key, \{ content: html \}\)/.test(toolCatsBody));
check('category meta saves to the shared seo map and blank values stay automatic',
  /const key = `cat:\$\{cat\.key\}`;/.test(toolCatsBody)
  && /if \(!entry\.title && !entry\.description && !entry\.slug && !entry\.noindex\) clearSeo\(key\);/.test(toolCatsBody)
  && /else setSeo\(key, entry\);/.test(toolCatsBody)
  && /const auto = categorySeoFallbacks\(state, \{ \.\.\.cat, name: draft\.name \|\| cat\.name \}/.test(toolCatsBody));
check('the category page head honours the override and falls back to the generated copy',
  /export const categorySeoFallbacks = \(cms: CmsState, cat: CmsToolCategory, brand: string\)/.test(seoSrc)
  && /const seo = cms\.seo\[`cat:\$\{cat\.key\}`\];/.test(seoSrc)
  && /title: \(seo\?\.title \|\| ''\)\.trim\(\) \|\| fallbacks\.title/.test(seoSrc)
  && /const description = \(seo\?\.description \|\| ''\)\.trim\(\) \|\| fallbacks\.description;/.test(seoSrc)
  && /noindex: seo\?\.noindex,/.test(seoSrc)
  && /canonicalOverride: \(seo\?\.slug \|\| ''\)\.trim\(\) \|\| undefined,/.test(seoSrc));
check('every category row shows its name, its URL, its tool count and its own Edit/Delete',
  /<section aria-label="Tool Categories"/.test(adminSrc)
  && /\{paths\.primary\}\{paths\.alias \? ` · \$\{paths\.alias\}` : ''\}/.test(adminSrc)
  && /tool\{count === 1 \? '' : 's'\}/.test(adminSrc)
  && /removeToolCategory\(cat\.key\)/.test(adminSrc)
  && /saveToolCategory\(cat\.key, \{ name: draft\.name/.test(adminSrc));
check('the router gives every category a /tools/category/<slug> URL',
  /export const TOOL_CATEGORY_BASE = '\/tools\/category';/.test(router)
  && /export const toolCategoryPath = \(slug: string\): string => `\$\{TOOL_CATEGORY_BASE\}\/\$\{slug\}`;/.test(router)
  && /if \(seg\.startsWith\(categoryPrefix\)\) return `toolcat\/\$\{seg\.slice\(categoryPrefix\.length\)\}`;/.test(router));
check('the category path is never rewritten to a legacy tool URL',
  /if \(pathname === TOOL_CATEGORY_BASE \|\| pathname\.startsWith\(`\$\{TOOL_CATEGORY_BASE\}\/`\)\) return pathname;/.test(router));
check('the app renders a category page for /tools/category/<slug>',
  /route\.startsWith\('toolcat\/'\) && <ToolsList categorySlug=\{route\.slice\('toolcat\/'\.length\)\} \/>/.test(app)
  && /const isTools = route === 'free-tools' \|\| route === 'tools' \|\| route\.startsWith\('tool\/'\) \|\| route\.startsWith\('cat\/'\) \|\| route\.startsWith\('toolcat\/'\)/.test(app));
check('the directory renders every managed category in admin order',
  /export const ToolsList: React\.FC<\{ category\?: ToolCategory; categorySlug\?: string \}>/.test(listSrcCards)
  && /const managed = toolCategoriesOf\(cmsState\);/.test(listSrcCards)
  && /return \[\.\.\.managed, \.\.\.strays\];/.test(listSrcCards));
check('no tool can fall off the index: a stray category keeps its own section',
  /const strays = \[\.\.\.new Set\(filtered\.map\(t => t\.category\)\)\]/.test(listSrcCards));
check('a category URL that no longer exists shows a not-found page',
  /if \(\(category \|\| categorySlug\) && !active\) \{[\s\S]{0,500}Category not found/.test(listSrcCards));
check('a brand-new category with no tools yet says so instead of 404-ing',
  /const categoryIsEmpty = !!activeKey && tools\.every\(t => t\.category !== activeKey\);/.test(listSrcCards)
  && /No tools in this category yet/.test(listSrcCards));
check('the category page builds its meta copy from the managed description',
  /const description = `\$\{toolCategorySummary\(cms, cat\.key\)\} \$\{list\.length\} free/.test(seoUtil));
check('an unknown category URL is noindexed',
  /const cat = resolveToolCategory\(cms, value\);[\s\S]{0,400}noindex: true/.test(seoUtil));
check('the managed name reaches the tool pages, the sidebar and the breadcrumbs',
  /toolCategoryName\(cmsState, tool\.category\)/.test(read('src/tools/toolContent.tsx'))
  && /toolCategoryName\(cmsState, t\.category\)/.test(read('src/tools/Sidebar.tsx'))
  && /toolCategoryHref\(state, tool\.category\)/.test(app));
check('styling and icons fall back for categories added in the admin',
  /export const categoryStyle = \(key: string\): string =>/.test(dataSrc)
  && /export const categoryLabel = \(key: string\): string =>/.test(dataSrc)
  && /default:\s*\/\/ A category added in the admin/.test(dataSrc));

/* ---- Competitor Analysis: the /competitor-analysis page copy is managed ---- */
check('the competitor page model covers the hero, the inputs, the sections and the FAQs',
  /export interface CmsCompetitor \{[\s\S]{0,200}heroSubtitle: string;[\s\S]{0,120}heroTitle: string;[\s\S]{0,120}heroIntro: string;[\s\S]{0,200}yourLabel: string;[\s\S]{0,120}theirLabel: string;[\s\S]{0,120}buttonText: string;[\s\S]{0,120}fallbackNote: string;/.test(store)
  && /aboutHeading: string;\s*aboutContent: string;/.test(store)
  && /howToHeading: string;\s*howToContent: string;/.test(store)
  && /benefitsHeading: string;[\s\S]{0,140}benefitsIntro: string;[\s\S]{0,220}benefitsContent: string;/.test(store)
  && /faqHeading: string;[\s\S]{0,220}faqsContent: string;/.test(store));
check('benefits and FAQs are one rich-text document each — no per-item editor',
  /\/\*\* One document: each heading is a benefit card, its content the card text\. \*\/\s*benefitsContent: string;/.test(store)
  && /\/\*\* One document: each heading is a question, its content the answer\. \*\/\s*faqsContent: string;/.test(store)
  && !/CmsBenefit|CmsFaqItem/.test(store));
check('the built-in copy seeds the managed page (title, labels, button, fallback note)',
  /export const defaultCompetitor: CmsCompetitor = \{[\s\S]{0,200}heroSubtitle: 'Side-by-side SEO audit',[\s\S]{0,120}heroTitle: 'Website Competitor Analysis',/.test(store)
  && /yourLabel: 'Your website',[\s\S]{0,120}theirLabel: 'Competitor website',/.test(store)
  && /buttonText: 'Compare Both Websites',/.test(store)
  && /fallbackNote: 'If a site blocks browser access/.test(store));
check('the seeded copy keeps the three sections, the five benefits and the seven questions',
  /aboutHeading: 'What is Website Competitor Analysis\?',/.test(store)
  && /howToHeading: 'How to read the comparison report',/.test(store)
  && /benefitsHeading: 'Benefits',/.test(store)
  && /faqHeading: 'Competitor Analysis FAQs',/.test(store)
  && /benefitsContent: joinRichSections\(\[/.test(store)
  && /faqsContent: joinRichSections\(\[/.test(store)
  && (store.match(/\{ title: '[^']+', body: '<p>/g) || []).length >= 12,
  String((store.match(/\{ title: '[^']+', body: '<p>/g) || []).length));
check('the one-editor rule comes from a shared splitter (heading = item)',
  /export const splitRichSections = \(html: string\): RichSection\[\] => \{/.test(read('src/utils/richSections.ts'))
  && /if \(node\.nodeType === 1 && HEADING_TAG\.test\(\(node as HTMLElement\)\.tagName\)\) \{\s*flush\(\);/.test(read('src/utils/richSections.ts'))
  && /export const joinRichSections = \(sections: \{ title: string; body: string \}\[\]\): string =>/.test(read('src/utils/richSections.ts')));
check('the store carries the page copy and defaults to the seeded version',
  /competitor: CmsCompetitor;/.test(store) && /competitor: defaultCompetitor,/.test(store));
check('a browser that never saved any gets the built-in copy, a saved one is completed field by field',
  /const migrateCompetitor = \(saved\?: LegacyCompetitor\): CmsCompetitor => \{\s*if \(!saved \|\| typeof saved !== 'object'\) return defaultCompetitor;/.test(store)
  && /heroTitle: text\(saved\.heroTitle, defaultCompetitor\.heroTitle\)/.test(store)
  && /benefitsIntro: typeof saved\.benefitsIntro === 'string' \? saved\.benefitsIntro : defaultCompetitor\.benefitsIntro/.test(store)
  && /const migrateCompetitor = \(saved\?: LegacyCompetitor\): CmsCompetitor => \{/.test(store));
check('a list saved when each item had its own editor folds into the single document',
  /type LegacyCompetitor = Partial<CmsCompetitor> & \{[\s\S]{0,180}benefits\?: \{ title\?: string; text\?: string \}\[\];[\s\S]{0,120}faqs\?: \{ question\?: string; answer\?: string \}\[\];/.test(store)
  && /const legacyBenefits = Array\.isArray\(saved\.benefits\)[\s\S]{0,200}joinRichSections\(saved\.benefits/.test(store)
  && /const legacyFaqs = Array\.isArray\(saved\.faqs\)[\s\S]{0,200}joinRichSections\(saved\.faqs/.test(store)
  && /benefitsContent: text\(legacyBenefits \|\| saved\.benefitsContent, defaultCompetitor\.benefitsContent\)/.test(store)
  && /faqsContent: text\(legacyFaqs \|\| saved\.faqsContent, defaultCompetitor\.faqsContent\)/.test(store));
check('the stored CMS and an imported backup both run the migration',
  (store.match(/competitor: migrateCompetitor\(parsed\.competitor\)/g) || []).length === 2);
check('one action saves the whole page and shows the standard confirmation',
  /setCompetitor: \(value: CmsCompetitor\) => void;/.test(store)
  && /setCompetitor: \(value\) => setState\(s => \(\{ \.\.\.s, competitor: migrateCompetitor\(value\) \}\)\)/.test(store));
check('the admin tab list places Competitor Analysis after Tool Categories',
  /\['toolcats', 'Tool Categories'\], \['competitor', 'Competitor Analysis'\], \['sidebar', 'Sidebar'\]/.test(adminSrc)
  && /\{tab === 'competitor' && <CompetitorPane \/>\}/.test(adminSrc));
check('the pane edits the page header, the intro and the tool input area',
  /const CompetitorPane: React\.FC = \(\) => \{/.test(adminSrc)
  && /aria-label="Hero title"/.test(adminSrc)
  && /aria-label="Hero subtitle"/.test(adminSrc)
  && /aria-label="Intro paragraph"/.test(adminSrc)
  && /aria-label="Your website label"/.test(adminSrc)
  && /aria-label="Competitor website label"/.test(adminSrc)
  && /aria-label="Button text"/.test(adminSrc)
  && /aria-label="Fallback note"/.test(adminSrc));
check('every content section gets a full WYSIWYG editor — one per section',
  /<RichTextEditor value=\{f\.aboutContent\}/.test(adminSrc)
  && /<RichTextEditor value=\{f\.howToContent\}/.test(adminSrc)
  && /<RichTextEditor value=\{f\.benefitsContent\}/.test(adminSrc)
  && /<RichTextEditor value=\{f\.faqsContent\}/.test(adminSrc)
  && /draftKey=\{draftId\('competitor', 'about'\)\}/.test(adminSrc)
  && /draftKey=\{draftId\('competitor', 'howto'\)\}/.test(adminSrc)
  && (adminSrc.match(/<RichTextEditor value=\{f\.(aboutContent|howToContent|benefitsContent|faqsContent)\}/g) || []).length === 4);
check('the Benefits section is one editor, not one per benefit block',
  /<Field label="Benefits content" hint="One editor for the whole section/.test(adminSrc)
  && /value=\{f\.benefitsContent\}/.test(adminSrc)
  && /draftKey=\{draftId\('competitor', 'benefits'\)\}/.test(adminSrc)
  && !/aria-label=\{`Benefit \$\{index \+ 1\}/.test(adminSrc)
  && !/\+ Add benefit|Move benefit/.test(adminSrc));
check('the FAQs section is one editor, not one per question',
  /<Field label="FAQs content" hint="One editor for the whole section/.test(adminSrc)
  && /value=\{f\.faqsContent\}/.test(adminSrc)
  && /draftKey=\{draftId\('competitor', 'faqs'\)\}/.test(adminSrc)
  && !/aria-label=\{`FAQ \$\{index \+ 1\}/.test(adminSrc)
  && !/\+ Add FAQ|Move FAQ/.test(adminSrc));
check('the admin explains how the single document maps onto the page',
  /make each benefit a Heading 3 and the words under it become that card's text/.test(adminSrc)
  && /make each question a Heading 3 and the words under it become its collapsible answer/.test(adminSrc));
check('the pane saves with "Save Changes", previews and can reset to the seeded copy',
  /<SaveButton label="Save Changes" onSave=\{save\} \/>/.test(adminSrc)
  && /Open the live page →/.test(adminSrc)
  && /onClick=\{\(\) => setF\(defaultCompetitor\)\}/.test(adminSrc));
check('the meta title, description, canonical and indexing stay editable for the page',
  /setSeo\('competitor-analysis', seo\)/.test(adminSrc)
  && /state\.seo\['competitor-analysis'\]/.test(adminSrc)
  && /routeHint="\/competitor-analysis"/.test(adminSrc));
check('the live page reads the hero, the labels, the button and the fallback note from the CMS',
  /const copy = useCms\(\)\.state\.competitor;/.test(read('src/tools/CompetitorAnalysis.tsx'))
  && /\{copy\.heroSubtitle\}[\s\S]{0,120}\{copy\.heroTitle\}[\s\S]{0,160}\{copy\.heroIntro\}/.test(read('src/tools/CompetitorAnalysis.tsx'))
  && /\{copy\.yourLabel\}/.test(read('src/tools/CompetitorAnalysis.tsx'))
  && /\{copy\.theirLabel\}/.test(read('src/tools/CompetitorAnalysis.tsx'))
  && /\{copy\.buttonText\} →/.test(read('src/tools/CompetitorAnalysis.tsx'))
  && /\{copy\.fallbackNote\}/.test(read('src/tools/CompetitorAnalysis.tsx')));
check('the three sections and the FAQs render from the CMS copy',
  /const copy = state\.competitor;/.test(read('src/tools/CompetitorAnalysis.tsx'))
  && /sanitizeRichHtml\(copy\.aboutContent\)/.test(read('src/tools/CompetitorAnalysis.tsx'))
  && /sanitizeRichHtml\(copy\.howToContent\)/.test(read('src/tools/CompetitorAnalysis.tsx'))
  && /splitRichSections\(copy\.benefitsContent\)/.test(read('src/tools/CompetitorAnalysis.tsx'))
  && /splitRichSections\(copy\.faqsContent\)/.test(read('src/tools/CompetitorAnalysis.tsx')));
check('the benefit cards and the FAQ accordion keep their design',
  /benefitItems\.map\(benefit => \(/.test(read('src/tools/CompetitorAnalysis.tsx'))
  && /<h3 className="heading-card text-sm font-bold text-slate-800">\{benefit\.title\}<\/h3>/.test(read('src/tools/CompetitorAnalysis.tsx'))
  && /faqItems\.map\(\(faq, index\) => \(/.test(read('src/tools/CompetitorAnalysis.tsx'))
  && /sanitizeRichHtml\(faq\.body\)/.test(read('src/tools/CompetitorAnalysis.tsx'))
  && /dangerouslySetInnerHTML=\{\{ __html: sanitizeRichHtml\(benefit\.body\) \}\}/.test(read('src/tools/CompetitorAnalysis.tsx')));
check('the comparison tool itself (engines, scoring, results view) is untouched',
  /const buildAudit = \(input: string, page: LivePageData, live: boolean\): Audit => \{/.test(read('src/tools/CompetitorAnalysis.tsx'))
  && /const run = async \(\) => \{/.test(read('src/tools/CompetitorAnalysis.tsx'))
  && /SEO Competitor Comparison/.test(read('src/tools/CompetitorAnalysis.tsx'))
  && /route === 'competitor-analysis'/.test(seoUtil)
  && /path: '\/competitor-analysis',/.test(seoUtil));

console.log('\n=== 📝 Home page tool rows + the article byline ===');
const blogPage = read('src/blog/Blog.tsx');
const articleSource = ['src/blog/articles-1.ts', 'src/blog/articles-2.ts', 'src/blog/articles-3.ts', 'src/blog/articles-4.ts', 'src/blog/articles-5.ts']
  .map(read).join('\n');
check('the home page tool rows and the category rows keep one spacing rhythm',
  /<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 items-stretch">/.test(app)
  && !/gap-4 mb-10 items-stretch/.test(app),
  (app.match(/"grid md:grid-cols-2 lg:grid-cols-4[^"]*"/) || ['not found'])[0]);
check('the categories grid still starts straight after the tools grid',
  /<\/div>\s*\n\s*<div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">/.test(app));
check('every built-in article is bylined SAT Team',
  (articleSource.match(/author: 'SAT Team',/g) || []).length === 13
  && !/SEO Audit Pro Team/.test(articleSource));
check('a post created in the CMS defaults to the same byline',
  /author: p\.author \|\| 'SAT Team',/.test(store));
check('the article header has no badge/date/read-time row above the title',
  !/className="flex items-center gap-3 mb-5"/.test(blogPage)
  && /<header className="mb-10">\s*<h1 className="font-bold text-slate-900 leading-tight mb-4">\{article\.title\}<\/h1>/.test(blogPage));
check('the byline puts the article date directly under the team name',
  /<p className="text-sm font-semibold text-slate-800">\{article\.author\}<\/p>\s*<p className="text-xs text-slate-400">\s*<time dateTime=\{article\.date\}>\{formatDate\(article\.date\)\}<\/time>/.test(blogPage));
check('the read time sits in front of the byline after a divider',
  /aria-hidden="true" \/>\s*<span className="text-sm text-slate-400">\{article\.readTime\}<\/span>/.test(blogPage)
  && /w-px h-9 bg-slate-200/.test(blogPage));
check('the category pill closes the same row and links to its category page',
  /<div className="ml-auto">/.test(blogPage)
  && /const categoryHref = articleCategory \? blogCategoryHref\(articleCategory\.slug\) : null;/.test(blogPage)
  && /const articleCategory = \(state\.blogCategories \|\| \[\]\)\.find\(c => c\.visible && c\.name === article\.category\);/.test(blogPage)
  && /<a href=\{categoryHref\} className=\{`inline-block px-2\.5 py-1 rounded-full text-xs font-semibold border \$\{categoryBadge\(article\.category\)\}`\}>/.test(blogPage));
check('the 154 tools and the rest of the blog page are untouched',
  (tools.match(/slug: '/g) || []).length === 154
  && /<ArticleCard key=\{article\.slug\} article=\{article\} level=\{2\} \/>/.test(blogPage)
  && /export const BlogCategoryPage: React\.FC<\{ slug: string \}>/.test(blogPage));

console.log('\n=== 📚 Blog article sidebar (order + full titles) ===');
const sidebarSrc = read('src/tools/Sidebar.tsx');
check('the sidebar takes an article-page order without changing the default order',
  /export const Sidebar: React\.FC<\{ category\?: string; currentSlug\?: string; currentPost\?: string; order\?: 'default' \| 'article' \}> = \(\{ category, currentSlug, currentPost, order = 'default' \}\) => \{/.test(sidebarSrc)
  && /const panels: \{ key: string; node: React\.ReactNode \}\[\] = order === 'article'/.test(sidebarSrc));
check('the article order is search box → Latest Articles → Other Relevant Tools',
  /\{ key: 'search', node: searchPanel \},\s*\{ key: 'latest', node: latestPanel \},\s*\{ key: 'relevant', node: relevantPanel \},\s*\{ key: 'popular', node: popularPanel \},/.test(sidebarSrc));
check('every other page keeps the original order (search, tools, popular, … then latest)',
  /\{ key: 'search', node: searchPanel \},\s*\{ key: 'relevant', node: relevantPanel \},\s*\{ key: 'popular', node: popularPanel \},[\s\S]{0,200}\{ key: 'latest', node: latestPanel \},/.test(sidebarSrc));
check('the article page asks for its order and nothing else changed there',
  /<Sidebar currentPost=\{article\.slug\} order="article" \/>/.test(blogPage)
  && (blogPage.match(/<Sidebar(?! currentPost=\{article\.slug\} order="article")/g) || []).length === 2);
check('no article title in the sidebar is truncated, clamped or ellipsised',
  /const latestPanel = cfg\.latest && posts\.length > 0 \? \(\s*<ListPanel title=\{cfg\.latestTitle\} items=\{posts\.map\(p => \(\{ href: `\/blog\/\$\{p\.slug\}`, label: p\.title \}\)\)\} arrowClass="text-indigo-500" wrap \/>/.test(sidebarSrc)
  && /const ListPanel: React\.FC<\{ title: React\.ReactNode; items: \{ href: string; label: string; badge\?: string \}\[\]; arrowClass\?: string; wrap\?: boolean \}>/.test(sidebarSrc)
  && /<span className=\{wrap \? 'flex-1 min-w-0 break-words' : 'flex-1 truncate'\}>\{it\.label\}<\/span>/.test(sidebarSrc)
  && /<span className="font-medium text-slate-800">\{p\.title\}<\/span>/.test(sidebarSrc)
  && !/line-clamp-1/.test(sidebarSrc));
check('tool and link lists keep their existing one-line style',
  !/wrap \/>[\s\S]{0,40}label: t\.name/.test(sidebarSrc)
  && /arrowClass="text-blue-600" \/>/.test(sidebarSrc)
  && /title=\{cfg\.relevantTitle\} items=\{relevant\.map\(t => \(\{ href: `\/\$\{t\.slug\}`, label: t\.name \}\)\)\} \/>/.test(sidebarSrc));
check('the sidebar still renders search, tools, popular, widgets, latest and CTA',
  /const searchPanel = cfg\.searchBox \?/.test(sidebarSrc) && /const relevantPanel = cfg\.relevantTools/.test(sidebarSrc)
  && /const popularPanel = cfg\.popular \?/.test(sidebarSrc) && /const latestPanel = cfg\.latest/.test(sidebarSrc)
  && /const ctaPanel = cfg\.cta \?/.test(sidebarSrc) && /const widgetPanels = widgets\.map/.test(sidebarSrc)
  && /<aside className="space-y-5">/.test(sidebarSrc));

console.log('\n=== 🪜 Heading pattern (SEO) ===');
check('the home hero has no trusted-by line',
  !/Trusted by/.test(app) && !/Trusted by/.test(dist));
check('the home hero band has equal space above and below (symmetric padding)',
  /<section className=\{`px-4 py-16 md:py-20 bg-gradient-to-br from-indigo-100 via-violet-50 to-purple-100 \$\{cms\.state\.sections\.hero \? '' : 'hidden'\}`\}>/
    .test(app)
  && !/pt-16 pb-20 px-4 bg-gradient-to-br/.test(app)
  && /<header className="text-center">/.test(app)
  && !/mb-12/.test(app.slice(app.indexOf('{/* Hero Section */}'), app.indexOf('{/* Results Section */}'))));
check('the home h1 takes the global h1 size (42px desktop)',
  /<h1 className="font-bold text-slate-900 mb-6 leading-tight">/.test(app)
  && /main:not\(.admin-shell\) h1:not\(.heading-card\) \{ font-size: var\(--heading-h1\); \}/.test(css)
  && /--heading-h1: 2\.625rem/.test(css));
check('every page has exactly one h1 (each route renders a single header level)',
  (app.match(/<h1 /g) || []).length >= 3
  && (blogPage.match(/<h1 /g) || []).length >= 3
  && !/<h1[\s\S]{0,200}<h1/.test(app));
check('blog cards take a heading level so list pages use h2',
  /const ArticleCard: React\.FC<\{ article: BlogArticle; level\?: 2 \| 3 \}> = \(\{ article, level = 3 \}\) => \(/.test(blogPage)
  && (blogPage.match(/<ArticleCard key=\{article\.slug\} article=\{article\} level=\{2\} \/>/g) || []).length === 2
  && /<ArticleCard key=\{a\.slug\} article=\{a\} \/>/.test(blogPage));
check('a category page labels its tool list instead of repeating the h1',
  /<h2 className="heading-card font-bold text-slate-900" style=\{CATEGORY_HEADING_SIZE\}>All \{cat\.name\}<\/h2>/.test(read('src/tools/Tools.tsx')));
check('the PDF guide sections are h2 (no h1 → h3 jump on tool pages)',
  /<h2 className="font-bold text-slate-900 mb-4">How it works<\/h2>/.test(read('src/tools/pdf/PdfGuide.tsx'))
  && /<h2 className="font-bold text-slate-900 mb-4">Frequently asked questions<\/h2>/.test(read('src/tools/pdf/PdfGuide.tsx')));
check('the heading levels in the built file never jump two steps in one section',
  !/<h1[^>]*>[^<]{0,120}<\/h1>\s*<h3/.test(dist));

console.log('\n=== Heading typography: one global scale + no artificial letter spacing ===');
check('desktop scale is 42 / 34 / 28 / 24 / 20 / 18px',
  /--heading-h1: 2\.625rem/.test(css) && /--heading-h2: 2\.125rem/.test(css) && /--heading-h3: 1\.75rem/.test(css)
  && /--heading-h4: 1\.5rem/.test(css) && /--heading-h5: 1\.25rem/.test(css) && /--heading-h6: 1\.125rem/.test(css));
check('tablet step down (<=1023px) and mobile step down (<=639px) exist',
  /@media \(max-width: 1023px\)[\s\S]{0,400}--heading-h1: 2\.25rem/.test(css)
  && /@media \(max-width: 639px\)[\s\S]{0,400}--heading-h1: 1\.875rem/.test(css));
check('h1-h6 on the public site read from the scale (admin dashboard excluded)',
  ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].every(tag =>
    new RegExp(`main:not\\(\\.admin-shell\\) ${tag}:not\\(\\.heading-card\\) \\{ font-size: var\\(--heading-${tag}\\); \\}`).test(css)));
check('heading-card is the documented opt-out used by component headings',
  /\.heading-card/.test(read('src/index.css')) && /<h3 className="heading-card text-\[18px\]/.test(app)
  && /<h3 className="heading-card text-sm font-bold text-slate-800">\{benefit\.title\}<\/h3>/.test(read('src/tools/CompetitorAnalysis.tsx')));
check('h1-h6 letter-spacing is normal on the public site',
  /main:not\(\.admin-shell\) h1:not\(\.heading-card\),[\s\S]{0,400}h6:not\(\.heading-card\) \{\s*letter-spacing: normal;/.test(css));
check('no artificial letter spacing left on scale headings (no tracking-*, no 0.04em)',
  !/^\s*<h[1-6] (?![^>]*heading-card)[^>]*tracking-/m.test(read('src/App.tsx') + read('src/blog/Blog.tsx') + read('src/tools/Tools.tsx')
    + read('src/tools/CompetitorAnalysis.tsx') + read('src/tools/Sidebar.tsx') + read('src/components/SerpPreview.tsx'))
  && !/\.rich-text h[1-6] \{[^}]*04em/.test(read('src/index.css')));
check('no icon sits above a tool heading any more (tool page + tool cards)',
  !/<div className="inline-flex flex-wrap items-center justify-center gap-2 mb-4">/.test(read('src/tools/Tools.tsx'))
  && !/<div className="flex items-center justify-between mb-3">/.test(read('src/tools/Tools.tsx'))
  && !/w-10 h-10 rounded-xl flex items-center justify-center border/.test(dist)
  && (read('src/tools/Tools.tsx').match(/w-9 h-9 rounded-lg flex items-center justify-center border/g) || []).length === 2);
check('no green "Instant" pill sits above a tool heading any more',
  !/border-emerald-100 px-2\.5 py-1 rounded-full/.test(read('src/tools/Tools.tsx'))
  && !/border-emerald-100 px-2 py-0\.5 rounded-full/.test(read('src/tools/Tools.tsx'))
  && !/border-emerald-100 px-2\.5 py-1 rounded-full/.test(dist)
  && !/border-emerald-100 px-2 py-0\.5 rounded-full/.test(dist)
  && !/>Instant<\/span>/.test(read('src/tools/Tools.tsx')));
check('every h1 on a tool route is capitalised, not uppercase (tool page, category page, index)',
  (read('src/tools/Tools.tsx').match(/className="capitalize font-bold text-slate-900 mb-4"/g) || []).length === 2
  && /<h1 className=\{`tool-page-title font-extrabold text-slate-900 mb-4\$\{stacked \? ' leading-\[1\.15\]' : ''\}`\}>/.test(read('src/tools/Tools.tsx'))
  && !/<h1 className=\{`[^`]*uppercase/.test(read('src/tools/Tools.tsx'))
  && /\.tool-page-title \{ text-transform: capitalize; \}/.test(read('src/index.css'))
  && /\.tool-page-title\{text-transform:capitalize\}/.test(dist.replace(/\s+/g, '')));
check('rich-text (CMS) headings use the same scale and no letter spacing',
  ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].every(tag =>
    new RegExp(`\\.rich-text ${tag} \\{ font-size: var\\(--heading-${tag}\\); font-weight: \\d+; color: #[0-9a-f]{6}; `).test(css)
    || new RegExp(`\\.rich-text ${tag} \\{ font-size: var\\(--heading-${tag}\\);`).test(css))
  && !/\.rich-text h[1-6] \{[^}]*font-size: [0-9.]+rem/.test(css)
  && (css.match(/\.rich-text h6 \{[^}]*letter-spacing: normal;/g) || []).length === 1);
check('no page-specific size utilities left on scale headings',
  !/^\s*<h[1-6] className="(?![^"]*heading-card)[^"]*text-(\[|sm\b|base\b|lg\b|xl\b|2xl\b|3xl\b|4xl\b|5xl\b|6xl\b)/m
    .test(read('src/App.tsx') + read('src/blog/Blog.tsx') + read('src/tools/Tools.tsx') + read('src/tools/Sidebar.tsx')
      + read('src/components/SerpPreview.tsx') + read('src/tools/CompetitorAnalysis.tsx') + read('src/tools/toolContent.tsx')
      + read('src/tools/pdf/PdfGuide.tsx')));
check('no heading carries an inline font-size style',
  !/<h[1-6][^>]{0,200}style=\{\{[^}]*fontSize/.test(read('src/App.tsx') + read('src/blog/Blog.tsx') + read('src/tools/Tools.tsx')
    + read('src/tools/CompetitorAnalysis.tsx') + read('src/tools/Sidebar.tsx')));
check('the built CSS ships the scale and letter-spacing: normal',
  /--heading-h1:2\.625rem/.test(dist.replace(/\s+/g, ''))
  && /main:not\(\.admin-shell\)h1:not\(\.heading-card\)\{font-size:var\(--heading-h1\)\}/.test(dist.replace(/\s+/g, ''))
  && /main:not\(\.admin-shell\)h1:not\(\.heading-card\),main:not\(\.admin-shell\)h2:not\(\.heading-card\)[\s\S]{0,300}\{letter-spacing:normal\}/.test(dist.replace(/\s+/g, '')));
check('all three responsive steps are in the built CSS',
  /--heading-h1:2\.625rem/.test(dist.replace(/\s+/g, '')) && /--heading-h1:2\.25rem/.test(dist.replace(/\s+/g, ''))
  && /--heading-h1:1\.875rem/.test(dist.replace(/\s+/g, '')) && /--heading-h2:1\.625rem/.test(dist.replace(/\s+/g, '')));

console.log('\n=== ⚡ Live-page probes (src/tools/WebTools.tsx) ===');
// The Page Speed Checker shared this hook with nine other URL tools, and two
// defects lived here: the source badge returned itself (so any successful
// fetch crashed the results panel), and both probes were awaited with
// Promise.all (so a 1 s answer still waited on the 15 s text reader).
const webTools = read('src/tools/WebTools.tsx');
check('the source badge renders a live badge instead of recursing into itself',
  /const Src: React\.FC<\{ d: LivePageData \}> = \(\{ d \}\) => d\.reader\s*\?\s*\(/.test(webTools)
  && /\) : <Live ms=\{d\.fetchMs\} \/>;/.test(webTools)
  && !/\)\s*:\s*<Src d=\{d\} \/>;/.test(webTools));
check('probes resolve on the first usable answer, never on the slowest',
  !/await Promise\.all\(\[/.test(webTools)
  && /PROBE_BUDGET_MS = 16_000/.test(webTools)
  && /RELAY_GRACE_MS = 2_500/.test(webTools)
  && /if \(best\) finish\(\);/.test(webTools));
check('a running probe shows its stage and can be stopped',
  /const \[stage, setStage\] = useState\(''\);/.test(webTools)
  // The speed tool's Stop clears its own direct probe as well, so it wraps the
  // hook's cancel rather than passing it straight through.
  && /onCancel=\{(?:f\.cancel|stop)\}/.test(webTools)
  && /const stop = \(\) => \{[^}]*f\.cancel\(\);/.test(webTools)
  && /runId\.current !== me/.test(webTools));
check('a stalled probe reads as a timeout, a refusal as a block',
  /outcome\.timedOut \? 'timeout' : 'blocked'/.test(webTools)
  // One branch now serves both: the blocked path may still be answered by the
  // proxy-free measurement before it falls back to the failure note.
  && /const showDirect = typeof directMs === 'number'/.test(webTools) && /f\.failed === 'timeout'/.test(webTools));
check("a proxy-blocked page is still timed from the visitor's own browser",
  /mode: 'no-cors'/.test(webTools)
  && /const browserTiming = async/.test(webTools)
  && /void browserTiming\(direct\)/.test(webTools)
  && /void f\.run\(\);/.test(webTools)
  // ...and a host that hangs every relay must not hold the spinner for the whole
  // budget: the direct figure is shown early, then replaced if a relay answers.
  && /const early = typeof directMs === 'number' && f\.busy && f\.elapsed >= DIRECT_FIRST_AFTER_S;/.test(webTools)
  && /const settled = !f\.busy && !f\.data && !f\.failed;/.test(webTools)
  && /\{f\.busy && !early && <Spinner/.test(webTools));
check('all ten URL tools keep using the one shared hook',
  (webTools.match(/const f = useFetch\(\);/g) || []).length === 10
  && (webTools.match(/<Src d=\{d\} \/>/g) || []).length >= 6,
  `hooks ${(webTools.match(/const f = useFetch\(\);/g) || []).length}`);

// The Page Speed Checker's report layer: a scored model, an inventory, and an
// export — the "show more info" work must not quietly shrink back to one number.
const report = read('src/utils/pageSpeedReport.ts');
check('the speed tool builds a scored report from the one fetched document',
  /export function buildReport/.test(report) && /Render-blocking requests/.test(report) && /export function reportToMarkdown/.test(report));
check('an unmeasurable factor is excluded from the score, not passed or failed',
  /state: 'unknown'/.test(report) && /weight: 0, earned: 0/.test(report));
check('relative assets are resolved against the document, not counted as third parties',
  /const host = hostOf\(src, baseUrl\)/.test(report) && /const pageUrl = d\.finalUrl/.test(report));
check('the speed panel renders score, breakdown, hosts, timeline, requests and facts',
  /Score breakdown/.test(webTools) && /Priority fixes/.test(webTools) && /What the page asks for/.test(webTools)
  && /Modelled load sequence/.test(webTools) && /Requests in order/.test(webTools) && /Page facts/.test(webTools));
check('the summary copies out as markdown with a fallback path',
  /navigator\.clipboard\?\.writeText/.test(webTools) && /document\.execCommand/.test(webTools));
check('the shipped bundle carries the new report panels',
  /Score breakdown/.test(dist) && /Modelled load sequence/.test(dist) && /Page facts/.test(dist));

console.log('\n=== ✅ Preserved ===');
check('no "Loading page" anywhere in src', !/Loading page/.test(read('src/App.tsx') + read('src/components/ErrorBoundary.tsx') + read('src/tools/Tools.tsx')));
const codeOnly = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
check('no Suspense / lazyRoute in the app', !/<Suspense|React\.lazy\(|lazyRoute\(/.test(codeOnly(app) + codeOnly(read('src/tools/Tools.tsx')))
  && !existsSync('src/utils/lazyRetry.ts'));
check('no loading state in the built file', !/Loading page|Loading PDF engine/.test(dist));
check('content-shell min-height for the footer', /\.content-shell \{[\s\S]{0,120}min-height: calc\(100vh - 4rem\)/.test(css) && /@supports \(height: 100dvh\)/.test(css));
check('main uses content-shell and scopes the admin dashboard out of the heading scale',
  /<main id="main-content" tabIndex=\{-1\} className=\{`content-shell\$\{isAdminRoute \? ' admin-shell' : ''\}`\}>/.test(app)
  && /const isAdminRoute = route === 'admin' \|\| route === 'admin-login' \|\| route === 'admin-reset';/.test(app)
  && /<h3 className="heading-card text-\[18px\] font-bold capitalize tracking-\[0px\] text-slate-400 mb-4">\{col\.title\}<\/h3>/.test(app));
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
