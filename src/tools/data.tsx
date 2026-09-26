import React from 'react';

export type ToolCategory =
  | 'text' | 'keyword' | 'backlink' | 'management' | 'checker' | 'domain' | 'ip' | 'pdf' | 'image'
  | 'calculator' | 'converter';

export type InputType = 'text' | 'domain' | 'url' | 'keyword' | 'image' | 'twotext' | 'form' | 'none';

export interface ToolDef {
  slug: string;
  name: string;
  description: string;
  category: ToolCategory;
  input: InputType;
  engine?: string; // working in-browser engine id; undefined = simulated lookup
  placeholder?: string;
  placeholder2?: string;
  featuredImage?: string;
  featuredImageAlt?: string;
}

/**
 * Card tagline for every tool — the one-or-two-line summary shown on the tool
 * cards of /free-seo-tools and the category pages.
 *
 * It is deliberately separate from `description`: the description is the
 * full SEO copy (meta description, tool-page intro), while the tagline is
 * tuned to fit exactly two lines on a four-up card grid. Tools created in the
 * CMS fall back to their own description, so nothing can render empty.
 */
export const toolTaglines: Record<string, string> = {
  // ---------- Text Analysis ----------
  'plagiarism-checker': 'Check up to 1,000 words for copied text and get an instant plagiarism percentage score.',
  'article-rewriter': 'Paste up to 2,000 words and rewrite them with word-by-word synonym suggestions and a fresh tone.',
  'grammar-checker': 'Find spelling, grammar and punctuation mistakes in US or UK English and fix them in one click.',
  'word-counter': 'Count words, characters, sentences and paragraphs, and see an instant reading-time estimate.',
  'spell-checker': 'Catch misspellings, repeated words and common typos before you publish your content.',
  'online-md5-generator': 'Generate MD5, SHA-1, SHA-256 and SHA-512 hashes from any text or string, instantly.',
  'case-converter': 'Switch text between UPPERCASE, lowercase, Title Case and eight other writing styles.',
  'merge-words-online-tool': 'Combine two keyword lists into every possible match for PPC campaigns and long-tail SEO.',
  'text-to-speech': 'Hear any text read aloud in your browser with adjustable voice, pitch and reading speed.',
  'small-text-generator': 'Turn normal text into small caps, superscript and subscript characters for bios and posts.',
  'reverse-text-generator': 'Reverse, mirror or word-flip any text for social posts, puzzles and fun effects.',
  // ---------- Keyword ----------
  'keyword-rank-checker': 'Check where a site ranks on Google for up to ten target keywords, country by country.',
  'keyword-density-checker': 'See word frequency and keyword density percentages so you never over-optimise a page.',
  'keywords-suggestions-tool': 'Turn one seed keyword into hundreds of short and long-tail keyword ideas you can target.',
  'website-keywords-suggestions-tool': 'Discover the keywords a website already ranks for by analysing its pages and content.',
  'keyword-rich-domains-suggestions-tool': 'Find available domain names that contain your target keyword, ready to register.',
  'related-keywords-finder': 'Uncover semantically related terms, questions and phrases that searchers also type.',
  'long-tail-keyword-generator': 'Generate low-competition long-tail keyword variations around any seed term.',
  'keyword-competition-checker': 'Gauge how hard it will be to rank for a keyword, with search volume and CPC.',
  // ---------- Backlink ----------
  'backlink-checker': 'Analyse the backlink profile of any site: referring domains, anchor text and link quality.',
  'backlink-maker': 'Submit your website to well-known directories to build your first genuine backlinks.',
  'website-links-count-checker': 'Count every internal and external link on a page and spot nofollow and broken ones.',
  'link-tracker': 'Check whether a backlink is still live, indexed and pointing at the right page.',
  'link-price-calculator': 'Estimate what a text link is worth using traffic, authority and placement signals.',
  'reciprocal-link-checker': 'Verify that partner sites still link back to you, and find links they have removed.',
  'website-link-analyzer-tool': 'Break down every internal and external link on a page by target, anchor and type.',
  'websites-broken-link-checker': 'Find dead links, 404s and redirect chains that waste crawl budget on your site.',
  // ---------- Website Management ----------
  'website-seo-score-checker': 'Get an SEO score out of 100 with a breakdown of title, meta, headings, links and images.',
  'google-pagerank-checker': 'Estimate the PageRank and modern authority of any domain, and see how link equity works today.',
  'online-ping-website-tool': 'Notify search engines and ping services about new content and measure live response times.',
  'website-page-speed-checker': 'Measure load timing, response time, HTML size and resource counts with speed recommendations.',
  'website-page-size-checker': 'Check the HTML size of a page in KB and see how long it takes to download on real connections.',
  'meta-tags-analyzer': 'Extract and grade every meta tag on a live page, from title and canonical to Open Graph.',
  'meta-tag-generator': 'Build SEO titles, meta descriptions and social tags with a live search and share preview.',
  'xml-sitemap-generator': 'Turn a list of URLs into a valid XML sitemap, ready to submit to search engines.',
  'website-page-snooper': 'View the raw HTML source of any web page with line numbers, tag stats and highlighting.',
  'website-hit-counter': 'Create a customisable visitor hit counter in classic or modern styles with embed code.',
  'url-rewriting-tool': 'Turn dynamic query-string URLs into clean static URLs and generate the matching .htaccess rules.',
  'screen-resolution-simulator': 'Preview any website on phones, tablets, laptops and desktops at exact pixel resolutions.',
  'online-url-encoder-decoder': 'Encode or decode URLs and query strings instantly, with a reserved-character reference.',
  'adsense-calculator': 'Estimate daily, monthly and yearly AdSense earnings from page views, CTR and CPC.',
  'open-graph-checker': 'Validate the Open Graph tags on a page and see a Facebook and LinkedIn share preview.',
  'open-graph-generator': 'Build Open Graph meta tags for websites, articles, products and videos with a live preview.',
  'qr-code-generator': 'Generate high-resolution QR codes for links, Wi-Fi, email, phone and text as PNG or SVG.',
  'htaccess-redirect-generator': 'Generate .htaccess rules for 301 redirects, HTTPS, www, trailing slashes and domain moves.',
  'get-http-headers': 'Read the HTTP response headers of any URL: status, server, caching, security and cookies.',
  'twitter-card-generator': 'Create Twitter/X card meta tags and preview exactly how your shared link will look.',
  'internet-speed-test': 'Measure your download speed, latency and jitter in the browser, with streaming ratings.',
  'wordpress-theme-detector': 'Detect WordPress and identify the active theme, child theme, version and plugins in use.',
  'instant-search-suggestions-tool': 'Expand a seed keyword into hundreds of autocomplete-style suggestions with A-Z patterns.',
  'avg-antivirus-checker': 'Scan a site for HTTPS issues, mixed content, suspicious scripts and blacklist flags.',
  'website-screenshot-generator': 'Capture a full-page screenshot at desktop, tablet or mobile size and download it as an image.',
  'email-privacy': 'Find email addresses exposed to spam bots and generate obfuscated, harvest-proof versions.',
  'mobile-friendly-test': 'Test viewport settings, tap targets, font sizes and responsive images with a phone preview.',
  'online-video-downloader': 'Understand what browsers can and cannot save legally, with safe alternatives to downloader sites.',
  'facebook-video-downloader': 'Learn how to save Facebook videos you own or have permission to use, the official way.',
  'facebook-story-download': 'Save your own Facebook Stories, manage archives and stay on the right side of privacy.',
  'facebook-reels-download': 'Official ways to save your own Facebook Reels, plus safe third-party guidance.',
  'twitter-video-downloader': 'How to save videos from X/Twitter posts using bookmarks and archives, legally.',
  'tiktok-downloader': 'Use the built-in TikTok save feature, keep your own videos clean and avoid risky tools.',
  'url-shortener': 'Shorten long URLs instantly, add UTM tracking parameters and generate a QR code for the result.',
  'website-checker': 'Run a one-click health check: availability, HTTPS, speed, title, headings, links and images.',
  'html-editor': 'Write HTML and CSS with a live side-by-side preview, starter templates and one-click download.',
  'html-viewer': 'Paste HTML and render it instantly in a sandboxed preview next to the formatted source.',
  'xml-formatter': 'Format and validate XML with proper indentation, error detection and element statistics.',
  'xml-beautifier': 'Beautify compressed XML or sitemaps into a readable, indented structure with validation.',
  'css-minify': 'Strip whitespace and comments from CSS to cut file size and speed up page loads.',
  'html-minify': 'Compress HTML by removing whitespace, comments and optional attributes before you deploy.',
  'javascript-minifier': 'Shrink JavaScript files by stripping spacing, comments and dead characters safely.',
  'robots-txt-generator': 'Create a correct robots.txt with crawler rules, disallow paths and a sitemap reference.',
  'php-formatter': 'Beautify messy PHP with consistent indentation, spacing and brace style you can copy.',
  'html-formatter': 'Reformat minified or messy HTML into clean, indented markup that is easy to read.',
  // ---------- Website Checker ----------
  'google-cache-checker': 'See when Google last cached each URL and spot pages that have gone stale.',
  'whois-checker': 'Look up the owner, registrar, creation date and expiry behind any domain in one click.',
  'mozrank-checker': 'Check the link-popularity score of any page on the classic 1 to 10 scale.',
  'page-authority-checker': 'Estimate how well a specific page can rank, based on its own link and content signals.',
  'google-index-checker': 'Confirm which of your URLs Google has actually indexed, and which it has left out.',
  'alexa-rank-checker': 'Estimate global and country traffic rank, audience reach and engagement for any site.',
  'redirect-checker': 'Trace redirect chains hop by hop and see every status code along the way.',
  'similar-page-checker': 'Compare two pages for duplicate or near-identical content before you publish.',
  'cloaking-checker': 'Detect whether different content is served to search crawlers and to real visitors.',
  'google-malware-checker': 'Check whether a domain is flagged for malware, phishing or unwanted software.',
  'check-gzip-compression': 'Verify GZIP or Brotli compression is on and estimate the bandwidth you are saving.',
  'ssl-checker': 'Inspect the issuer, validity dates, chain and encryption strength of any SSL certificate.',
  'server-status-checker': 'Fetch HTTP status codes, response headers and availability for any URL you enter.',
  'code-to-text-ratio-checker': 'Measure visible text against HTML code on a page and see if the ratio hurts ranking.',
  'alexa-rank-comparison': 'Compare traffic rank, visitors and engagement for two websites side by side.',
  'page-comparison': 'Compare two pages on title, meta, headings, word count and technical signals.',
  'comparison-search': 'See where two websites rank side by side across a set of target keywords.',
  'pokemon-go-server-status': 'Check the live status of Pokemon Go login, game and trade servers by region.',
  'blog-finder-tool': 'Find blogs in your niche for outreach, guest posting and link-building campaigns.',
  'apps-rank-tracking-tool': 'Track an app ranking across store categories and countries over time.',
  'spider-simulator': 'See a page exactly as a search crawler does: tags, headings, links and visible text.',
  'what-is-my-browser': 'Detect your browser, version, operating system, screen size and language settings.',
  'social-stats-checker': 'Check share counts across Facebook, Pinterest, LinkedIn and Reddit for any URL.',
  'competitor-analysis': 'Compare two websites side by side across on-page, technical, mobile and speed checks.',
  // ---------- Domain ----------
  'domain-age-checker': 'Find out exactly when a domain was registered and how many years old it is.',
  'domain-authority-checker': 'Check the overall authority score of a domain out of 100 and see how it stacks up.',
  'domain-ip-lookup': 'Resolve the IP address a domain points to, plus the location behind it.',
  'domain-hosting-checker': 'Identify which hosting company and nameservers are powering any domain.',
  'find-dns-records': 'Look up A, AAAA, MX, TXT, CNAME and NS records for any domain in seconds.',
  'domain-name-search': 'Check whether a domain name is available across the most popular TLDs instantly.',
  'blacklist-lookup': 'Check whether a domain or IP appears on major spam and blacklist databases.',
  'expired-domains-tool': 'Discover recently expired domains that still carry authority you could register.',
  // ---------- IP ----------
  'what-is-my-ip': 'See your public IPv4 and IPv6 address, ISP, location, timezone and connection details.',
  'reverse-ip-domain-check': 'Find other websites hosted on the same server IP as any domain you enter.',
  'ip-location': 'Find the city, region, country, coordinates, ISP and timezone of any IP address.',
  'geo-ip-locator': 'Pinpoint an IP on a map with latitude, longitude and the distance from your location.',
  'free-daily-proxy-list': 'Browse a refreshed list of HTTP, HTTPS and SOCKS proxies with country and anonymity.',
  'class-c-ip-checker': 'Check whether several domains share one Class C IP range, a key link-network signal.',
  // ---------- PDF ----------
  'merge-pdf': 'Combine several PDFs into one file, reorder the pages, then compress it further if you want.',
  'rotate-pdf': 'Rotate all pages or a selection by 90, 180 or 270 degrees with live thumbnails, then save.',
  'unlock-pdf': 'Remove the open password from a PDF and clear printing or copying restrictions you own.',
  'lock-pdf': 'Protect a PDF with an open password, owner permissions and 128-bit AES encryption.',
  'pdf-to-word': 'Convert PDF text into an editable Word document with paragraphs and page breaks kept.',
  'word-to-pdf': 'Turn a Word file or typed text into a clean PDF with selectable text and page options.',
  'pdf-to-jpg': 'Render every PDF page as a JPG or PNG between 72 and 300 DPI and download them together.',
  'jpg-to-pdf': 'Combine JPG, PNG and WebP images into one PDF with page size, margins and fit options.',
  'powerpoint-to-pdf': 'Turn PowerPoint text or slide notes into a PDF deck, one slide per page in 16:9 or 4:3.',
  'text-to-pdf': 'Convert notes, text or code into a paginated PDF with font, margin and numbering options.',
  'split-pdf': 'Extract page ranges, split every page into its own file or divide a PDF into equal chunks.',
  'compress-pdf': 'Shrink a PDF with lossless optimisation or adjustable image quality, and see the saving.',
  'compress-pdf-to-50kb': 'Shrink a PDF below 50 KB for strict upload forms, with each quality attempt shown.',
  'compress-pdf-to-100kb': 'Compress a PDF below 100 KB for email attachments and forms while keeping text legible.',
  'compress-pdf-to-200kb': 'Reduce a PDF below 200 KB for exam and visa uploads with automatic quality tuning.',
  'compress-pdf-to-300kb': 'Bring scanned or image-heavy PDFs below 300 KB with a balanced quality setting.',
  'compress-pdf-to-500kb': 'Compress large PDFs below 500 KB while keeping pages readable for sharing or archiving.',
  'excel-to-pdf': 'Turn CSV data or pasted cells into a PDF table with fitted columns and page numbers.',
  // ---------- Image ----------
  'image-compressor': 'Compress JPG and PNG images in your browser with a quality slider and instant preview.',
  'image-resizer': 'Resize images to exact pixel dimensions, keep the aspect ratio and download the result.',
  'image-to-text-converter': 'Extract readable text from screenshots and photos with in-browser OCR.',
  // ---------- Calculator ----------
  'percentage-calculator': 'Work out percentages, percentage change and X as a percent of Y in one calculator.',
  'average-calculator': 'Find the mean, median, mode and range of any list of numbers, instantly.',
  'age-calculator': 'Calculate exact age in years, months and days between any two dates.',
  'bmi-calculator': 'Calculate body-mass index in metric or imperial units with a clear BMI category.',
  'gst-calculator': 'Add or remove GST at 5%, 10%, 15% or a custom rate, inclusive or exclusive.',
  'margin-calculator': 'Work out gross margin, mark-up, cost and selling price from any two inputs.',
  'sales-tax-calculator': 'Add sales tax or VAT at any rate, or extract tax and net amount from a total.',
  'discount-calculator': 'Find the sale price, the saving and the discount percentage from any two values.',
  'cpm-calculator': 'Work out cost per thousand impressions from ad spend and impressions, or the reverse.',
  'ltv-calculator': 'Estimate customer lifetime value from order value, purchase frequency and lifespan.',
  'probability-calculator': 'Calculate single-event, combined and conditional probability for independent events.',
  'paypal-fee-calculator': 'Estimate PayPal fees for standard, business and international transfers before you send.',
  'earnings-per-share-calculator': 'Calculate basic and diluted EPS from net income and outstanding share counts.',
  'confidence-interval-calculator': 'Calculate 90%, 95% and 99% confidence intervals from mean, SD and sample size.',
  // ---------- Unit Converter ----------
  'unit-converter': 'Convert length, mass, temperature, volume, speed, data, pressure and more in one place.',
  'length-converter': 'Convert between millimetres, centimetres, metres, kilometres, inches, feet and miles.',
  'weight-converter': 'Convert between kilograms, grams, pounds, ounces, stones and tonnes instantly.',
  'temperature-converter': 'Convert Celsius, Fahrenheit and Kelvin instantly, with a handy reference chart.',
  'speed-converter': 'Convert between km/h, mph, m/s, knots and ft/s with instant, accurate results.',
  'area-converter': 'Convert square metres, square feet, acres, hectares and square yards in one step.',
  'pressure-conversion': 'Convert pascals, kilopascals, bar, atmospheres, PSI, mmHg and torr instantly.',
  'voltage-conversion': 'Convert between volts, millivolts, kilovolts and microvolts in a single click.',
  'power-conversion': 'Convert between watts, kilowatts, horsepower and BTU per hour instantly.',
  'time-zone-converter': 'Convert the time between any two IANA time zones and see both local times now.',
};

/** Two-line card copy for a tool: its tagline, or its description as a fallback. */
export const toolTagline = (tool: { slug: string; description: string }): string =>
  toolTaglines[tool.slug] || tool.description;

export const categoryLabels: Record<ToolCategory, string> = {
  text: 'Text Analysis Tools',
  keyword: 'Keyword Tools',
  backlink: 'Backlink Tools',
  management: 'Website Management Tools',
  checker: 'Website Checker Tools',
  domain: 'Domain Tools',
  ip: 'IP Tools',
  pdf: 'PDF Tools',
  image: 'Image Tools',
  calculator: 'Calculator Tools',
  converter: 'Unit Converter Tools',
};

export const categoryDescriptions: Record<ToolCategory, string> = {
  text: 'Plagiarism, grammar, word count, rewriting and other in-browser text checks.',
  keyword: 'Density, suggestions, long-tail ideas and competition for your target terms.',
  backlink: 'Profile, broken-link, reciprocal and link-value checks for any site.',
  management: 'Meta tags, sitemaps, page speed, QR codes, robots.txt and site utilities.',
  checker: 'SSL, index, cache, gzip, redirects and other website health checks.',
  domain: 'Age, authority, DNS, hosting, WHOIS and domain availability lookups.',
  ip: 'Your public IP, geolocation, reverse IP, Class C and proxy lists.',
  pdf: 'Merge, split, compress, convert and protect PDFs on your device.',
  image: 'Compress, resize and extract text from JPG and PNG images.',
  calculator: 'Percentage, BMI, GST, margin, CPM and other free calculators.',
  converter: 'Length, weight, temperature, speed, area and other unit conversions.',
};

/**
 * Public URL slug of every category. The slug is the category name in
 * lower-case with hyphens — "IP Tools" → /ip-tools,
 * "Website Checker Tools" → /website-checker-tools. Each category is a real
 * page (its own canonical URL, title block and tool list), not a ?cat= filter.
 */
export const categorySlugs: Record<ToolCategory, string> = {
  text: 'text-analysis-tools',
  keyword: 'keyword-tools',
  backlink: 'backlink-tools',
  management: 'website-management-tools',
  checker: 'website-checker-tools',
  domain: 'domain-tools',
  ip: 'ip-tools',
  pdf: 'pdf-tools',
  image: 'image-tools',
  calculator: 'calculator-tools',
  converter: 'unit-converter-tools',
};

/** Canonical path of a category page, e.g. '/ip-tools'. */
export const categoryHref = (category: ToolCategory): string => `/${categorySlugs[category]}`;

/** Category behind a URL slug, or null when the slug belongs to another route. */
export const categoryFromSlug = (slug: string): ToolCategory | null => {
  const key = (Object.keys(categorySlugs) as ToolCategory[]).find(c => categorySlugs[c] === slug);
  return key || null;
};

/** Category behind its internal key (`ip`, `checker`, …), or null when the
 *  value is not a category. Used by the `cat/<key>` route id. */
export const categoryFromKey = (key: string): ToolCategory | null =>
  (categoryOrder as string[]).includes(key) ? (key as ToolCategory) : null;

/**
 * SEO introduction shown under a category heading — on the tools index and on
 * that category's own page (/ip-tools, /website-checker-tools, …).
 *
 * Written per category, not templated: it names the tools in the group, what
 * each one does for the visitor and why it is worth using, which is the copy
 * search engines read on the category URL. `categoryDescriptions` above stays
 * the one-line summary used on the home-page cards and in meta descriptions.
 */
export const categoryIntros: Record<ToolCategory, string> = {
  text: 'Check every piece of writing before it goes live: run plagiarism and grammar checks, rewrite articles, count words and characters, generate hashes and clean up formatting. All eleven Text Analysis Tools are free, need no sign-up, and your text never leaves your browser.',
  keyword: 'Find the exact phrases your audience types into Google. Research keyword density, generate short and long-tail ideas, discover the terms a site already ranks for, and measure how hard a term is to win before you write a single word. Eight free keyword research tools, instant results.',
  backlink: 'Build and audit the links that lift your pages up the rankings. Inspect any site\'s backlink profile and anchor text, check whether your links are still live and indexed, value a sponsored link, and find the broken links wasting your crawl budget. Eight free backlink tools, no account needed.',
  management: 'The day-to-day utilities of running a website: generate meta tags, XML sitemaps and robots.txt files, test page speed and page size, read HTTP headers, fix redirects, build QR codes, short URLs and Open Graph tags, and minify the code you ship. 45 free website management tools that work on any site.',
  checker: 'Audit any URL in seconds. Check Google indexing and caching, SSL certificates, redirect chains, GZIP compression, malware flags, code-to-text ratio and server status, then compare two pages or two websites side by side. 24 free website checking tools, with live results straight from your browser.',
  domain: 'Everything you need before you register or buy a domain: age and expiry dates, WHOIS ownership, authority scores, DNS records, hosting and nameservers, spam blacklist status and recently expired domains worth registering. Eight free domain lookup tools with instant results.',
  ip: 'See what the internet sees when it looks at your connection. Find your public IPv4 and IPv6 address, trace any IP\'s location on a map, discover other websites on the same server, and check Class C ranges or a freshly updated proxy list. All six IP tools are free and run in your browser.',
  pdf: 'Work with PDFs without uploading your documents to a stranger\'s server. Merge, split, rotate, compress, lock and unlock files, or convert between PDF, Word, Excel, PowerPoint, JPG and plain text — 18 free PDF tools that process every file locally on your device.',
  image: 'Compress, resize and read images right in your browser. Shrink JPG and PNG files for faster-loading pages, resize photos to exact pixel dimensions, or pull readable text out of screenshots and photos with OCR. Three free image tools with no watermark and no sign-up.',
  calculator: 'Fast, accurate answers for everyday maths and business numbers: percentages, averages, age, BMI, GST and sales tax, profit margins, discounts, CPM, customer lifetime value, PayPal fees, earnings per share and probability. 14 free calculators that update as you type.',
  converter: 'Convert units without hunting through conversion tables. Length, weight, temperature, speed, area, pressure, voltage, power and time zones — ten free converters with instant, accurate results in both directions and no page reloads.',
};

export const categoryOrder: ToolCategory[] = ['text', 'keyword', 'backlink', 'management', 'checker', 'domain', 'ip', 'pdf', 'image', 'calculator', 'converter'];

export const categoryStyles: Record<ToolCategory, string> = {
  text: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  keyword: 'bg-violet-50 text-violet-700 border-violet-100',
  backlink: 'bg-blue-50 text-blue-700 border-blue-100',
  management: 'bg-slate-100 text-slate-700 border-slate-200',
  checker: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  domain: 'bg-amber-50 text-amber-700 border-amber-100',
  ip: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  pdf: 'bg-red-50 text-red-700 border-red-100',
  image: 'bg-rose-50 text-rose-700 border-rose-100',
  calculator: 'bg-teal-50 text-teal-700 border-teal-100',
  converter: 'bg-orange-50 text-orange-700 border-orange-100',
};

export const ToolIcon: React.FC<{ category: ToolCategory; className?: string }> = ({ category, className = 'w-5 h-5' }) => {
  const common = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (category) {
    case 'text':
      return <svg {...common}><path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" /></svg>;
    case 'keyword':
      return <svg {...common}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>;
    case 'backlink':
      return <svg {...common}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>;
    case 'management':
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
    case 'checker':
      return <svg {...common}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>;
    case 'domain':
      return <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>;
    case 'ip':
      return <svg {...common}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>;
    case 'pdf':
      return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 15h6M9 18h4M9 12h2" /></svg>;
    case 'calculator':
      return <svg {...common}><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="10" x2="10" y2="10" /><line x1="14" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="10" y2="14" /><line x1="14" y1="14" x2="16" y2="14" /><line x1="8" y1="18" x2="16" y2="18" /></svg>;
    case 'converter':
      return <svg {...common}><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>;
    case 'image':
      return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" /></svg>;
  }
};

export const tools: ToolDef[] = [
  // ---------- Text Analysis ----------
  { slug: 'plagiarism-checker', name: 'Plagiarism Checker', description: 'Free plagiarism checker for students, teachers, and content creators. Check plagiarism of up to 1000 words and get instant & accurate plagiarism results with percentages.', category: 'text', input: 'text', engine: 'plagiarism', placeholder: 'Enter text here to check for Plagiarism' },
  { slug: 'article-rewriter', name: 'Article Rewriter', description: 'Free article rewriter and paraphrasing tool. Paste up to 2000 words, review word-by-word synonym suggestions, and get a unique, readable version of your content in seconds.', category: 'text', input: 'text', engine: 'rewriter', placeholder: 'Paste content here to rewrite' },
  { slug: 'grammar-checker', name: 'Grammar Check', description: 'Free online grammar checker for American and British English. Paste your text to find spelling, grammar, punctuation and style mistakes, then fix them with one click.', category: 'text', input: 'text', engine: 'grammar', placeholder: 'Paste your text here and click the "Check Grammar" button.' },
  { slug: 'word-counter', name: 'Word Counter', description: 'Count words, characters, sentences and estimate reading time instantly.', category: 'text', input: 'text', engine: 'wordcount', placeholder: 'Start typing or paste your text here...' },
  { slug: 'spell-checker', name: 'Spell Checker', description: 'Catch common spelling mistakes and typos before you publish.', category: 'text', input: 'text', engine: 'spell', placeholder: 'Paste text to check spelling...' },
  { slug: 'online-md5-generator', name: 'MD5 Generator', description: 'Generate MD5, SHA-1, SHA-256 and SHA-512 hashes from any string.', category: 'text', input: 'text', engine: 'hash', placeholder: 'Type the text to hash...' },
  { slug: 'case-converter', name: 'Case Converter', description: 'Switch text between UPPERCASE, lowercase, Title Case and more.', category: 'text', input: 'text', engine: 'case', placeholder: 'Paste text to convert its case...' },
  { slug: 'merge-words-online-tool', name: 'Merge Words', description: 'Combine keyword lists into every possible match for PPC and SEO.', category: 'text', input: 'twotext', engine: 'merge', placeholder: 'List one...\nshoes\nboots', placeholder2: 'List two...\nred\nfor men' },
  { slug: 'text-to-speech', name: 'Text to Speech', description: 'Listen to any text read aloud in your browser with voice and speed controls.', category: 'text', input: 'text', engine: 'tts', placeholder: 'Type or paste the text you want to hear...' },
  { slug: 'small-text-generator', name: 'Small Text Generator', description: 'Convert normal text into small caps, superscript and subscript styles.', category: 'text', input: 'text', engine: 'smalltext', placeholder: 'Type text to convert into small styles...' },
  { slug: 'reverse-text-generator', name: 'Reverse Text Generator', description: 'Reverse, flip and word-reverse text for social posts and fun effects.', category: 'text', input: 'text', engine: 'reverse', placeholder: 'Type text to reverse...' },

  // ---------- Keyword ----------
  { slug: 'keyword-rank-checker', name: 'Keyword Rank Checker', description: 'Check where a website ranks on Google for up to 10 target keywords.', category: 'keyword', input: 'twotext', placeholder: 'example.com', placeholder2: 'seo audit, free seo tool, rank checker' },
  { slug: 'keyword-density-checker', name: 'Keyword Density Checker', description: 'Analyze word frequency and keyword density percentages in your content.', category: 'keyword', input: 'text', engine: 'density', placeholder: 'Paste your article to analyze keyword density...' },
  { slug: 'keywords-suggestions-tool', name: 'Keywords Suggestion Tool', description: 'Get hundreds of short and long-tail keyword ideas from a seed keyword.', category: 'keyword', input: 'keyword', placeholder: 'e.g. running shoes' },
  { slug: 'website-keywords-suggestions-tool', name: 'Website Keywords Suggestions', description: 'Discover keywords a website already ranks for based on its content.', category: 'keyword', input: 'domain', placeholder: 'example.com' },
  { slug: 'keyword-rich-domains-suggestions-tool', name: 'Keyword Rich Domain Finder', description: 'Find available domain names that contain your target keyword.', category: 'keyword', input: 'keyword', engine: 'domainideas', placeholder: 'e.g. coffee shop' },
  { slug: 'related-keywords-finder', name: 'Related Keywords Finder', description: 'Uncover semantically related terms and questions searchers ask.', category: 'keyword', input: 'keyword', placeholder: 'e.g. seo audit' },
  { slug: 'long-tail-keyword-generator', name: 'Long Tail Keyword Generator', description: 'Generate low-competition long-tail variations around a seed keyword.', category: 'keyword', input: 'keyword', engine: 'longtail', placeholder: 'e.g. email marketing' },
  { slug: 'keyword-competition-checker', name: 'Keyword Competition Checker', description: 'Gauge how hard it will be to rank for a keyword, with volume and CPC.', category: 'keyword', input: 'keyword', placeholder: 'e.g. best web hosting' },

  // ---------- Backlinks ----------
  { slug: 'backlink-checker', name: 'Backlink Checker', description: 'Analyze the backlink profile, referring domains and anchor text of any site.', category: 'backlink', input: 'domain', placeholder: 'example.com' },
  { slug: 'backlink-maker', name: 'Backlink Maker', description: 'Submit your website to well-known directories to build initial backlinks.', category: 'backlink', input: 'domain', engine: 'backlinkmaker', placeholder: 'https://example.com' },
  { slug: 'website-links-count-checker', name: 'Website Links Count Checker', description: 'Count internal and external links on any page at a glance.', category: 'backlink', input: 'url', placeholder: 'https://example.com/page' },
  { slug: 'link-tracker', name: 'Link Tracker', description: 'Verify whether a backlink is live, indexed and pointing where it should.', category: 'backlink', input: 'url', placeholder: 'https://example.com/link-to-check' },
  { slug: 'link-price-calculator', name: 'Link Price Calculator', description: 'Estimate the value of a text link based on traffic and authority signals.', category: 'backlink', input: 'url', placeholder: 'https://example.com' },
  { slug: 'reciprocal-link-checker', name: 'Reciprocal Link Checker', description: 'Check whether partner sites are still linking back to you.', category: 'backlink', input: 'twotext', placeholder: 'https://yoursite.com', placeholder2: 'https://partnersite.com' },
  { slug: 'website-link-analyzer-tool', name: 'Website Link Analyzer', description: 'Break down every internal and external link found on a page.', category: 'backlink', input: 'url', placeholder: 'https://example.com' },
  { slug: 'websites-broken-link-checker', name: 'Broken Link Checker', description: 'Find dead links, 404s and redirect problems across your pages.', category: 'backlink', input: 'domain', placeholder: 'example.com' },

  // ---------- Website Management ----------
  { slug: 'website-seo-score-checker', name: 'Website SEO Score Checker', description: 'Get an instant SEO score out of 100 with a detailed breakdown of title, meta, headings, images, links, social tags and technical signals from the live page.', category: 'management', input: 'url', engine: 'wm-seoscore', placeholder: 'https://example.com' },
  { slug: 'google-pagerank-checker', name: 'Google PageRank Checker', description: 'Estimate the PageRank (0–10) and modern authority equivalents of any domain with an explanation of how link equity works today.', category: 'management', input: 'domain', engine: 'wm-pagerank', placeholder: 'example.com' },
  { slug: 'online-ping-website-tool', name: 'Online Ping Website Tool', description: 'Notify search engines and ping services about new or updated content, and measure live HTTP response times from your browser.', category: 'management', input: 'url', engine: 'wm-ping', placeholder: 'https://example.com/new-post' },
  { slug: 'website-page-speed-checker', name: 'Website Page Speed Checker', description: 'Measure real load timing for any page: response time, HTML size, code-to-text ratio, resource counts and Core Web Vitals-style recommendations.', category: 'management', input: 'url', engine: 'wm-speed', placeholder: 'https://example.com' },
  { slug: 'website-page-size-checker', name: 'Website Page Size Checker', description: 'Check the exact HTML size of a page in bytes/KB, compare it to averages, and see how long it takes to download on different connections.', category: 'management', input: 'url', engine: 'wm-pagesize', placeholder: 'https://example.com' },
  { slug: 'meta-tags-analyzer', name: 'Meta Tags Analyzer', description: 'Extract and grade every meta tag on a live page: title, description, robots, canonical, viewport, charset, Open Graph, Twitter cards and more.', category: 'management', input: 'url', engine: 'wm-metaanalyze', placeholder: 'https://example.com' },
  { slug: 'meta-tag-generator', name: 'Meta Tag Generator', description: 'Build SEO title, description and social meta tags with live preview.', category: 'management', input: 'form', engine: 'metatags' },
  { slug: 'website-page-snooper', name: 'Website Page Snooper', description: 'View the raw HTML source of any web page with line numbers, tag statistics and syntax highlighting — no browser dev tools needed.', category: 'management', input: 'url', engine: 'wm-snooper', placeholder: 'https://example.com' },
  { slug: 'website-hit-counter', name: 'Website Hit Counter', description: 'Generate a customisable visitor hit counter in classic or modern styles with copy-paste embed code.', category: 'management', input: 'none', engine: 'wm-hitcounter' },
  { slug: 'xml-sitemap-generator', name: 'XML Sitemap Generator', description: 'Turn a list of URLs into a valid XML sitemap ready for search engines.', category: 'management', input: 'text', engine: 'sitemap', placeholder: 'Paste your URLs, one per line...\nhttps://example.com/\nhttps://example.com/about' },
  { slug: 'url-rewriting-tool', name: 'URL Rewriting Tool', description: 'Convert dynamic URLs with query strings into clean, SEO-friendly static URLs and generate the matching .htaccess rewrite rules.', category: 'management', input: 'none', engine: 'wm-urlrewrite' },
  { slug: 'screen-resolution-simulator', name: 'Screen Resolution Simulator', description: 'Preview how any website renders on phones, tablets, laptops and desktops at exact pixel resolutions.', category: 'management', input: 'none', engine: 'wm-screensim' },
  { slug: 'online-url-encoder-decoder', name: 'Online URL Encoder / Decoder', description: 'Encode or decode URLs and query strings instantly, with component-level breakdown and a reference table of reserved characters.', category: 'management', input: 'none', engine: 'wm-urlencode' },
  { slug: 'adsense-calculator', name: 'AdSense Calculator', description: 'Estimate daily, monthly and yearly AdSense earnings from page views, CTR and CPC — with revenue-per-visitor and traffic targets.', category: 'management', input: 'none', engine: 'wm-adsense' },
  { slug: 'open-graph-checker', name: 'Open Graph Checker', description: 'Fetch a live page and validate every Open Graph tag, with a Facebook/LinkedIn share preview and fix suggestions.', category: 'management', input: 'url', engine: 'wm-ogcheck', placeholder: 'https://example.com' },
  { slug: 'open-graph-generator', name: 'Open Graph Generator', description: 'Create complete Open Graph meta tags for websites, articles, products and videos with a live social share preview.', category: 'management', input: 'none', engine: 'wm-oggen' },
  { slug: 'qr-code-generator', name: 'QR Code Generator', description: 'Generate high-resolution QR codes for URLs, text, Wi-Fi, email, phone and SMS — download as PNG or SVG, no watermark.', category: 'management', input: 'none', engine: 'wm-qr' },
  { slug: 'htaccess-redirect-generator', name: 'Htaccess Redirect Generator', description: 'Generate correct .htaccess rules for 301/302 redirects, www/non-www, HTTPS enforcement, trailing slashes and domain moves.', category: 'management', input: 'none', engine: 'wm-htaccess' },
  { slug: 'get-http-headers', name: 'Get HTTP Headers', description: 'Retrieve the HTTP response headers of any URL: status, server, caching, compression, security headers and cookies, with explanations.', category: 'management', input: 'url', engine: 'wm-headers', placeholder: 'https://example.com' },
  { slug: 'twitter-card-generator', name: 'Twitter Card Generator', description: 'Generate Twitter/X card meta tags (summary, large image, player, app) with a live preview of how your link will look.', category: 'management', input: 'none', engine: 'wm-twittercard' },
  { slug: 'internet-speed-test', name: 'Internet Speed Test', description: 'Measure your real download speed, latency and jitter directly in the browser, with a rating for streaming, gaming and video calls.', category: 'management', input: 'none', engine: 'wm-speedtest' },
  { slug: 'wordpress-theme-detector', name: 'WordPress Theme Detector', description: 'Detect whether a site runs WordPress and identify its active theme, child theme, version and installed plugins from the live source.', category: 'management', input: 'url', engine: 'wm-wpdetect', placeholder: 'https://example.com' },
  { slug: 'instant-search-suggestions-tool', name: 'Instant Search Suggestions Tool', description: 'Expand any seed keyword into hundreds of autocomplete-style suggestions using A–Z, question and modifier patterns.', category: 'management', input: 'none', engine: 'wm-suggest' },
  { slug: 'avg-antivirus-checker', name: 'AVG Antivirus Checker', description: 'Run a website safety check: HTTPS, mixed content, suspicious scripts, iframes, redirects and blacklist status with a safety score.', category: 'management', input: 'url', engine: 'wm-antivirus', placeholder: 'https://example.com' },
  { slug: 'website-screenshot-generator', name: 'Website Screenshot Generator', description: 'Capture a full-page screenshot of any website at desktop, tablet or mobile size and download it as an image.', category: 'management', input: 'none', engine: 'wm-screenshot' },
  { slug: 'email-privacy', name: 'Email Privacy', description: 'Scan a page for exposed email addresses that spam bots can harvest, and generate obfuscated, bot-proof versions.', category: 'management', input: 'url', engine: 'wm-emailprivacy', placeholder: 'https://example.com/contact' },
  { slug: 'mobile-friendly-test', name: 'Mobile Friendly Test', description: 'Test a live page for viewport configuration, responsive images, font sizes, tap targets and mobile usability with a phone preview.', category: 'management', input: 'url', engine: 'wm-mobile', placeholder: 'https://example.com' },
  { slug: 'online-video-downloader', name: 'Online Video Downloader', description: 'Understand how to legally save online videos, what browsers can and cannot do, and safe alternatives to shady downloader sites.', category: 'management', input: 'none', engine: 'wm-video', placeholder: 'https://' },
  { slug: 'facebook-video-downloader', name: 'Facebook Video Downloader', description: 'Learn how to save Facebook videos you own or have permission to use, plus Facebook\u2019s official download options.', category: 'management', input: 'none', engine: 'wm-video' },
  { slug: 'facebook-story-download', name: 'Facebook Story Download', description: 'How to save your own Facebook Stories, archive settings, and privacy considerations for saving others\u2019 stories.', category: 'management', input: 'none', engine: 'wm-video' },
  { slug: 'facebook-reels-download', name: 'Facebook Reels Download', description: 'Official ways to save Facebook Reels, creator download settings, and safe third-party guidance.', category: 'management', input: 'none', engine: 'wm-video' },
  { slug: 'twitter-video-downloader', name: 'Twitter Video Downloader', description: 'How to save videos from X/Twitter posts, bookmark and archive options, and copyright guidance.', category: 'management', input: 'none', engine: 'wm-video' },
  { slug: 'tiktok-downloader', name: 'TikTok Downloader', description: 'TikTok\u2019s built-in save feature, watermark-free options for your own videos, and what to avoid in third-party downloaders.', category: 'management', input: 'none', engine: 'wm-video' },
  { slug: 'css-minify', name: 'CSS Minifier', description: 'Strip whitespace and comments from CSS to reduce file size.', category: 'management', input: 'text', engine: 'minify-css', placeholder: 'Paste your CSS here...' },
  { slug: 'html-minify', name: 'HTML Minifier', description: 'Compress HTML by removing whitespace, comments and optional attributes.', category: 'management', input: 'text', engine: 'minify-html', placeholder: 'Paste your HTML here...' },
  { slug: 'javascript-minifier', name: 'JS Minifier', description: 'Shrink JavaScript files by removing spacing and dead characters.', category: 'management', input: 'text', engine: 'minify-js', placeholder: 'Paste your JavaScript here...' },
  { slug: 'robots-txt-generator', name: 'Robots.txt Generator', description: 'Create a correct robots.txt file with crawler rules and sitemap reference.', category: 'management', input: 'form', engine: 'robots' },
  { slug: 'url-shortener', name: 'URL Shortener', description: 'Shorten long URLs instantly with a free public shortening API, add UTM tracking parameters and generate a QR code for the result.', category: 'management', input: 'none', engine: 'wm-shortener' },
  { slug: 'website-checker', name: 'Website Checker', description: 'One-click website health check: availability, HTTPS, response time, title, description, headings, links, images, social tags and more.', category: 'management', input: 'url', engine: 'wm-seoscore', placeholder: 'https://example.com' },
  { slug: 'html-editor', name: 'HTML Editor', description: 'Write HTML and CSS with a live side-by-side preview, starter templates and one-click download.', category: 'management', input: 'none', engine: 'wm-htmleditor' },
  { slug: 'php-formatter', name: 'PHP Formatter', description: 'Beautify messy PHP code with consistent indentation, spacing and brace style.', category: 'management', input: 'none', engine: 'wm-format-php' },
  { slug: 'html-formatter', name: 'HTML Formatter', description: 'Reformat minified or messy HTML into clean, indented, readable markup.', category: 'management', input: 'none', engine: 'wm-format-html' },
  { slug: 'html-viewer', name: 'HTML Viewer', description: 'Paste HTML code and instantly render it in a sandboxed preview alongside the formatted source.', category: 'management', input: 'none', engine: 'wm-htmlviewer' },
  { slug: 'xml-formatter', name: 'XML Formatter', description: 'Format and validate XML with proper indentation, error detection and element statistics.', category: 'management', input: 'none', engine: 'wm-format-xml' },
  { slug: 'xml-beautifier', name: 'XML Beautifier', description: 'Beautify compressed XML or sitemaps into readable, indented structure with validation.', category: 'management', input: 'none', engine: 'wm-format-xml' },

  // ---------- Website Checker ----------
  { slug: 'google-cache-checker', name: 'Google Cache Checker', description: 'See when Google last cached each of your pages.', category: 'checker', input: 'domain', placeholder: 'example.com' },
  { slug: 'whois-checker', name: 'Whois Checker', description: 'Look up domain owner, registrar and registration dates.', category: 'checker', input: 'domain', placeholder: 'example.com' },
  { slug: 'mozrank-checker', name: 'MozRank Checker', description: 'Check the link popularity score of any page on a 1 to 10 scale.', category: 'checker', input: 'domain', placeholder: 'example.com' },
  { slug: 'page-authority-checker', name: 'Page Authority Checker', description: 'Predict how well a specific page will rank in search results.', category: 'checker', input: 'url', placeholder: 'https://example.com/page' },
  { slug: 'google-index-checker', name: 'Google Index Checker', description: 'Confirm which of your pages Google has actually indexed.', category: 'checker', input: 'domain', placeholder: 'example.com' },
  { slug: 'alexa-rank-checker', name: 'Website Authority / Traffic Rank', description: 'Estimate global and country traffic rank and audience reach.', category: 'checker', input: 'domain', placeholder: 'example.com' },
  { slug: 'redirect-checker', name: 'Redirect Checker', description: 'Trace redirect chains and see every status code along the way.', category: 'checker', input: 'url', placeholder: 'https://example.com/old-page' },
  { slug: 'similar-page-checker', name: 'Similar Page Checker', description: 'Compare two pages for duplicate or near-identical content.', category: 'checker', input: 'twotext', placeholder: 'Paste URL or content of page A...', placeholder2: 'Paste URL or content of page B...' },
  { slug: 'cloaking-checker', name: 'Cloaking Checker', description: 'Detect whether different content is served to crawlers and users.', category: 'checker', input: 'domain', placeholder: 'example.com' },
  { slug: 'google-malware-checker', name: 'Google Malware Checker', description: 'Check whether a domain is flagged for malware or phishing.', category: 'checker', input: 'domain', placeholder: 'example.com' },
  { slug: 'check-gzip-compression', name: 'GZIP Compression Checker', description: 'Verify GZIP or Brotli compression and estimate bandwidth savings.', category: 'checker', input: 'domain', placeholder: 'example.com' },
  { slug: 'ssl-checker', name: 'SSL Checker', description: 'Inspect SSL certificate issuer, validity and encryption details.', category: 'checker', input: 'domain', placeholder: 'example.com' },
  { slug: 'server-status-checker', name: 'Check Server Status', description: 'Fetch HTTP status codes, response headers and server availability for any URL.', category: 'checker', input: 'url', placeholder: 'https://example.com' },
  { slug: 'code-to-text-ratio-checker', name: 'Code to Text Ratio Checker', description: 'Measure the percentage of visible text versus HTML code on a page.', category: 'checker', input: 'url', placeholder: 'https://example.com/page' },
  { slug: 'alexa-rank-comparison', name: 'Alexa Rank Comparison', description: 'Compare traffic rank, visitors and engagement of two websites side by side.', category: 'checker', input: 'twotext', placeholder: 'example.com', placeholder2: 'competitor.com' },
  { slug: 'page-comparison', name: 'Page Comparison', description: 'Compare two pages on title, meta, headings, word count and technical signals.', category: 'checker', input: 'twotext', placeholder: 'https://example.com/a', placeholder2: 'https://example.com/b' },
  { slug: 'spider-simulator', name: 'Spider Simulator', description: 'See a page exactly as a search engine crawler sees it: tags, headings, links and text.', category: 'checker', input: 'url', placeholder: 'https://example.com' },
  { slug: 'comparison-search', name: 'Comparison Search', description: 'Compare where two sites rank across a set of target keywords.', category: 'checker', input: 'twotext', placeholder: 'yoursite.com', placeholder2: 'competitor.com' },
  { slug: 'pokemon-go-server-status', name: 'Pokemon Go Server Status Finder', description: 'Check the live status of Pokemon Go login, game and trade servers by region.', category: 'checker', input: 'none' },
  { slug: 'blog-finder-tool', name: 'Blog Finder Tool', description: 'Find blogs in your niche for outreach, guest posting and link building.', category: 'checker', input: 'keyword', placeholder: 'e.g. digital marketing' },
  { slug: 'apps-rank-tracking-tool', name: 'Apps Rank Tracking Tool', description: 'Track an app\u2019s ranking position across app store categories and countries.', category: 'checker', input: 'keyword', placeholder: 'App name or bundle ID' },
  { slug: 'what-is-my-browser', name: 'What is my Browser', description: 'Instantly detect your browser, version, operating system, screen size and settings.', category: 'checker', input: 'none' },
  { slug: 'social-stats-checker', name: 'Social Stats Checker', description: 'Check social share counts across Facebook, Pinterest, LinkedIn and Reddit for any URL.', category: 'checker', input: 'url', placeholder: 'https://example.com' },

  // ---------- Domain ----------
  { slug: 'domain-age-checker', name: 'Domain Age Checker', description: 'Find out exactly when a domain was registered and how old it is.', category: 'domain', input: 'domain', placeholder: 'example.com' },
  { slug: 'domain-authority-checker', name: 'Domain Authority Checker', description: 'Check the overall authority score of a domain out of 100.', category: 'domain', input: 'domain', placeholder: 'example.com' },
  { slug: 'domain-ip-lookup', name: 'Domain IP Lookup', description: 'Resolve the IP address a domain points to and its location.', category: 'domain', input: 'domain', placeholder: 'example.com' },
  { slug: 'domain-hosting-checker', name: 'Domain Hosting Checker', description: 'Identify which hosting company and nameservers power a domain.', category: 'domain', input: 'domain', placeholder: 'example.com' },
  { slug: 'find-dns-records', name: 'Find DNS Records', description: 'Look up A, AAAA, MX, TXT and CNAME records for any domain.', category: 'domain', input: 'domain', placeholder: 'example.com' },
  { slug: 'domain-name-search', name: 'Domain Name Search', description: 'Check domain availability across popular TLDs instantly.', category: 'domain', input: 'keyword', engine: 'domainavail', placeholder: 'mynewbusiness' },
  { slug: 'blacklist-lookup', name: 'Blacklist Lookup', description: 'Check whether a domain or IP is listed on major spam databases.', category: 'domain', input: 'domain', placeholder: 'example.com' },
  { slug: 'expired-domains-tool', name: 'Expired Domain Tool', description: 'Discover recently expired domains with existing authority you could register.', category: 'domain', input: 'keyword', placeholder: 'e.g. tech blog' },

  // ---------- IP Tools ----------
  { slug: 'what-is-my-ip', name: 'What is my IP', description: 'See your public IPv4/IPv6 address, ISP, location, timezone, connection type and browser details instantly.', category: 'ip', input: 'none', engine: 'myip' },
  { slug: 'reverse-ip-domain-check', name: 'Reverse IP Domain Check', description: 'Discover other websites hosted on the same server IP address as any domain.', category: 'ip', input: 'domain', engine: 'reverseip', placeholder: 'example.com or 93.184.216.34' },
  { slug: 'ip-location', name: 'IP Location', description: 'Find the city, region, country, coordinates, ISP and timezone of any IP address.', category: 'ip', input: 'domain', engine: 'iplocation', placeholder: 'Enter an IP address (e.g. 8.8.8.8)' },
  { slug: 'geo-ip-locator', name: 'GEO IP Locator', description: 'Pinpoint an IP on a map with latitude, longitude, distance from you and full geo data.', category: 'ip', input: 'domain', engine: 'geoip', placeholder: 'IP address or domain name' },
  { slug: 'free-daily-proxy-list', name: 'Free Daily Proxy List', description: 'Browse a refreshed list of HTTP, HTTPS and SOCKS proxies with country, speed and anonymity level.', category: 'ip', input: 'none', engine: 'proxylist' },
  { slug: 'class-c-ip-checker', name: 'Class C IP Checker', description: 'Check whether multiple domains share the same Class C IP range, a key link-network signal.', category: 'ip', input: 'text', engine: 'classc', placeholder: 'Enter up to 20 domains, one per line\nexample.com\nexample.org' },

  // ---------- PDF Tools (all processing happens in the browser) ----------
  { slug: 'merge-pdf', name: 'Merge PDF', description: 'Combine multiple PDF files into one document. Reorder files by drag-free arrows, see page counts and sizes, shrink the merged PDF with the optional compressor, and download it instantly. Files never leave your device.', category: 'pdf', input: 'none', engine: 'pdf-merge' },
  { slug: 'rotate-pdf', name: 'Rotate PDF', description: 'Rotate all pages or selected pages by 90°, 180° or 270° with live page thumbnails, then save a permanently rotated PDF.', category: 'pdf', input: 'none', engine: 'pdf-rotate' },
  { slug: 'unlock-pdf', name: 'Unlock PDF', description: 'Remove the open password and permission restrictions (printing, copying, editing) from a PDF you have the right to unlock.', category: 'pdf', input: 'none', engine: 'pdf-unlock' },
  { slug: 'lock-pdf', name: 'Lock PDF', description: 'Protect a PDF with an open password and owner password, set permissions for printing, copying and editing, using 128-bit AES encryption.', category: 'pdf', input: 'none', engine: 'pdf-lock' },
  { slug: 'pdf-to-word', name: 'PDF To Word', description: 'Convert PDF text into an editable Word (.docx) document with paragraphs and page breaks preserved, plus a plain-text export.', category: 'pdf', input: 'none', engine: 'pdf-to-word' },
  { slug: 'word-to-pdf', name: 'Word To PDF', description: 'Convert Word documents (.docx) or typed text into a clean PDF with selectable text, page size and font options.', category: 'pdf', input: 'none', engine: 'word-to-pdf' },
  { slug: 'pdf-to-jpg', name: 'PDF To JPG', description: 'Render every PDF page as a high-quality JPG or PNG at your chosen resolution (72–300 DPI) and download individually or all at once.', category: 'pdf', input: 'none', engine: 'pdf-to-jpg' },
  { slug: 'jpg-to-pdf', name: 'JPG To PDF', description: 'Turn JPG, PNG and WebP images into a single PDF with page size, orientation, margin and fit options — preserving image quality.', category: 'pdf', input: 'none', engine: 'jpg-to-pdf' },
  { slug: 'powerpoint-to-pdf', name: 'PowerPoint To PDF', description: 'Create a PDF slide deck from PowerPoint text content or slide notes: one slide per page in 16:9 or 4:3 with title and bullet styling.', category: 'pdf', input: 'none', engine: 'ppt-to-pdf' },
  { slug: 'text-to-pdf', name: 'Text To PDF', description: 'Convert plain text, notes or code into a paginated PDF with font, size, margins, line spacing and page-number options.', category: 'pdf', input: 'none', engine: 'text-to-pdf' },
  { slug: 'split-pdf', name: 'Split PDF', description: 'Extract page ranges, split every page into its own file, or divide a PDF into equal chunks — with thumbnails and per-file sizes.', category: 'pdf', input: 'none', engine: 'pdf-split' },
  { slug: 'compress-pdf', name: 'Compress PDF', description: 'Reduce PDF file size with lossless optimisation or adjustable image compression, showing before/after size and savings percentage.', category: 'pdf', input: 'none', engine: 'pdf-compress' },
  { slug: 'compress-pdf-to-50kb', name: 'Compress PDF to 50KB', description: 'Shrink a PDF to under 50 KB for strict upload limits on government portals and job applications, with quality-vs-size attempts shown.', category: 'pdf', input: 'none', engine: 'pdf-compress-50' },
  { slug: 'compress-pdf-to-100kb', name: 'Compress PDF to 100KB', description: 'Compress a PDF to below 100 KB for email attachments and online forms while keeping text legible.', category: 'pdf', input: 'none', engine: 'pdf-compress-100' },
  { slug: 'compress-pdf-to-200kb', name: 'Compress PDF to 200KB', description: 'Reduce a PDF under 200 KB — ideal for exam and visa application uploads — with automatic quality tuning.', category: 'pdf', input: 'none', engine: 'pdf-compress-200' },
  { slug: 'compress-pdf-to-300kb', name: 'Compress PDF to 300KB', description: 'Bring scanned documents and image-heavy PDFs under 300 KB with balanced quality.', category: 'pdf', input: 'none', engine: 'pdf-compress-300' },
  { slug: 'compress-pdf-to-500kb', name: 'Compress PDF to 500KB', description: 'Compress large PDFs to under 500 KB while preserving readability for sharing and archiving.', category: 'pdf', input: 'none', engine: 'pdf-compress-500' },
  { slug: 'excel-to-pdf', name: 'Excel To PDF', description: 'Convert spreadsheet data (CSV or pasted cells) into a PDF table with auto-fitted columns, header styling, landscape option and page numbers.', category: 'pdf', input: 'none', engine: 'excel-to-pdf' },

  // ---------- Calculator Tools ----------
  { slug: 'age-calculator', name: 'Age Calculator', description: 'Calculate exact age in years, months and days between two dates, useful for birthday calculators, eligibility checks and record verification.', category: 'calculator', input: 'none', engine: 'calc-age' },
  { slug: 'average-calculator', name: 'Average Calculator', description: 'Find the mean, median, mode and range of any list of numbers instantly.', category: 'calculator', input: 'none', engine: 'calc-avg' },
  { slug: 'confidence-interval-calculator', name: 'Confidence Interval Calculator', description: 'Calculate 90%, 95% and 99% confidence intervals from a sample mean, standard deviation and sample size.', category: 'calculator', input: 'none', engine: 'calc-ci' },
  { slug: 'gst-calculator', name: 'GST Calculator', description: 'Add or remove GST (Goods and Services Tax) at 5%, 10%, 15% or any custom rate with inclusive and exclusive modes.', category: 'calculator', input: 'none', engine: 'calc-gst' },
  { slug: 'margin-calculator', name: 'Margin Calculator', description: 'Calculate gross margin, mark-up percentage, selling price and cost from any input combination.', category: 'calculator', input: 'none', engine: 'calc-margin' },
  { slug: 'percentage-calculator', name: 'Percentage Calculator', description: 'Find what percent X is of Y, calculate X% of Y, find the difference between two numbers as a percentage, or increase/decrease a number by a percentage.', category: 'calculator', input: 'none', engine: 'calc-pct' },
  { slug: 'probability-calculator', name: 'Probability Calculator', description: 'Calculate simple probability, combined probability and statistical likelihood for independent events.', category: 'calculator', input: 'none', engine: 'calc-prob' },
  { slug: 'sales-tax-calculator', name: 'Sales Tax Calculator', description: 'Add sales tax or VAT at any rate to a price, or extract the tax and original amount from a total.', category: 'calculator', input: 'none', engine: 'calc-tax' },
  { slug: 'ltv-calculator', name: 'LTV Calculator', description: 'Estimate customer lifetime value from average order value, purchase frequency, and average customer lifespan.', category: 'calculator', input: 'none', engine: 'calc-ltv' },
  { slug: 'discount-calculator', name: 'Discount Calculator', description: 'Calculate the sale price, savings amount and percentage discount from any original price and discount amount or rate.', category: 'calculator', input: 'none', engine: 'calc-discount' },
  { slug: 'cpm-calculator', name: 'CPM Calculator', description: 'Estimate cost per thousand impressions from total ad spend and impressions, or work out impressions from a budget and CPM.', category: 'calculator', input: 'none', engine: 'calc-cpm' },
  { slug: 'paypal-fee-calculator', name: 'PayPal Fee Calculator', description: 'Estimate PayPal transaction fees for standard, business and international transfers with the current fee formulas.', category: 'calculator', input: 'none', engine: 'calc-paypal' },
  { slug: 'earnings-per-share-calculator', name: 'Earnings Per Share Calculator', description: 'Calculate EPS from net income and outstanding shares, and compare basic versus diluted EPS.', category: 'calculator', input: 'none', engine: 'calc-eps' },
  { slug: 'bmi-calculator', name: 'BMI Calculator', description: 'Calculate body-mass index from weight and height with metric and imperial units and a BMI category label.', category: 'calculator', input: 'none', engine: 'calc-bmi' },

  // ---------- Unit Converter Tools ----------
  { slug: 'unit-converter', name: 'Unit Converter', description: 'Universal unit converter for length, mass, temperature, volume, speed, data, pressure and more.', category: 'converter', input: 'none', engine: 'conv-unit' },
  { slug: 'length-converter', name: 'Length Converter', description: 'Convert between millimetres, centimetres, metres, kilometres, inches, feet, yards and miles.', category: 'converter', input: 'none', engine: 'conv-length' },
  { slug: 'temperature-converter', name: 'Temperature Converter', description: 'Convert between Celsius, Fahrenheit and Kelvin with instant results and a reference chart.', category: 'converter', input: 'none', engine: 'conv-temp' },
  { slug: 'time-zone-converter', name: 'Time Zone Converter', description: 'Convert time between any two IANA time zones and see the current local time for both locations.', category: 'converter', input: 'none', engine: 'conv-timezone' },
  { slug: 'pressure-conversion', name: 'Pressure Converter', description: 'Convert between pascals, kilopascals, bar, atmospheres, PSI, mmHg and torr.', category: 'converter', input: 'none', engine: 'conv-pressure' },
  { slug: 'voltage-conversion', name: 'Voltage Converter', description: 'Convert between volts, millivolts, kilovolts and microvolts.', category: 'converter', input: 'none', engine: 'conv-voltage' },
  { slug: 'power-conversion', name: 'Power Converter', description: 'Convert between watts, kilowatts, horsepower and BTU/hour.', category: 'converter', input: 'none', engine: 'conv-power' },
  { slug: 'speed-converter', name: 'Speed Converter', description: 'Convert between km/h, mph, m/s, knots and ft/s.', category: 'converter', input: 'none', engine: 'conv-speed' },
  { slug: 'area-converter', name: 'Area Converter', description: 'Convert between square metres, square feet, acres, hectares and square yards.', category: 'converter', input: 'none', engine: 'conv-area' },
  { slug: 'weight-converter', name: 'Weight Converter', description: 'Convert between kilograms, grams, pounds, ounces and stones.', category: 'converter', input: 'none', engine: 'conv-weight' },

  // ---------- Image ----------

  { slug: 'image-compressor', name: 'Image Compressor', description: 'Compress JPG and PNG images in your browser with a quality slider.', category: 'image', input: 'image', engine: 'image-compress' },
  { slug: 'image-resizer', name: 'Image Resizer', description: 'Resize images to exact pixel dimensions and download the result.', category: 'image', input: 'image', engine: 'image-resize' },
  { slug: 'image-to-text-converter', name: 'Image to Text Converter', description: 'Extract readable text from screenshots and photos (OCR).', category: 'image', input: 'image' },
];

export const getTool = (slug: string): ToolDef | undefined => tools.find(t => t.slug === slug);
