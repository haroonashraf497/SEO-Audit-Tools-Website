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
check('Footer menu links + Add', /Footer menu links/.test(admin)
  && /footerLinks: \[\.\.\.footerLinks, \{ id: [\s\S]{0,80}label: 'New link', href: '\/', visible: true \}\]/.test(admin));
check('footer menu is the first footer column (still its own nav)', /editable = index === 0 && footerMenuLinks\.length > 0/.test(app)
  && /title = editable \? \(cms\.state\.settings\.footerMenuTitle \|\| col\.title\) : col\.title/.test(app));
check('footerMenuTitle editable', /Field label="Section title"/.test(admin) && /footerMenuTitle/.test(admin));
check('social URLs: FB, X, LinkedIn, IG, YouTube', /\['facebook', 'Facebook URL'\], \['x', 'X \(Twitter\) URL'\], \['linkedin', 'LinkedIn URL'\], \['instagram', 'Instagram URL'\], \['youtube', 'YouTube URL'\]/.test(admin));
check('social icons render only when filled', /\.filter\(entry => entry\.href\)/.test(app));
check('all five icons defined', ['facebook', 'x', 'linkedin', 'instagram', 'youtube'].every(k => new RegExp(`key: '${k}'`).test(app)));
check('"Saved ✓" on every brand/footer card', (admin.match(/<SaveButton /g) || []).length >= 5, String((admin.match(/<SaveButton /g) || []).length));

console.log('\n=== 🦶 Footer redesign ===');
check('four equal footer columns defined', /const FOOTER_COLUMNS[\s\S]{0,900}title: 'Quick Links'[\s\S]{0,900}title: 'SEO Tools'[\s\S]{0,900}title: 'Resources'[\s\S]{0,900}title: 'Company'/.test(app));
check('Quick Links column = audit, tools, blog, about, contact', /title: 'Quick Links', links: \[[\s\S]{0,420}Free SEO Audit[\s\S]{0,200}Free SEO Tools[\s\S]{0,200}Blog[\s\S]{0,200}About[\s\S]{0,200}Contact/.test(app));
check('SEO Tools column = audit, tools, competitor analysis', /title: 'SEO Tools', links: \[[\s\S]{0,320}Free SEO Audit[\s\S]{0,200}Free SEO Tools[\s\S]{0,200}Competitor Analysis/.test(app));
check('Resources column = blog, FAQ, who it\'s for', /title: 'Resources', links: \[[\s\S]{0,320}Blog[\s\S]{0,200}FAQ[\s\S]{0,200}Who It's For/.test(app));
check('Company column = about, contact', /title: 'Company', links: \[[\s\S]{0,220}About[\s\S]{0,200}Contact/.test(app));
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

console.log('\n=== 🔗 URLs ===');
check('.htaccess 301 /tools → /free-tools', /RewriteRule \^tools\/\?\$ \/free-tools \[R=301,L\]/.test(htaccess));
check('.htaccess 301 /tool → /free-tools', /RewriteRule \^tool\/\?\$ \/free-tools \[R=301,L\]/.test(htaccess));
check('router normalises /tools', /if \(next === '\/tools' \|\| next === '\/tool'\) next = '\/free-tools'/.test(router));
check('route alias maps tools → free-tools', /seg === 'free-tools' \|\| seg === 'tools'/.test(router));
check('stored content rewrites /tools', /if \(value === '\/tools' \|\| value === '\/tool'\) return '\/free-tools'/.test(store));
check('nav default points at /free-tools', /label: 'Free SEO Tools', href: '\/free-tools', visible: true/.test(store));
check('canonical uses clean path (no #/)', /return `\$\{origin\}\$\{clean\}`/.test(seo) && !/return `\$\{origin\}\/#\$\{clean\}`/.test(seo));
check('sitemap uses /free-tools', sitemap.includes('<loc>https://seoaudittools.pk/free-tools</loc>') && !/seoaudittools\.pk\/tools</.test(sitemap));

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
