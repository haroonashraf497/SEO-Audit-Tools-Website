import React, { useMemo, useState } from 'react';
import type { ToolDef, ToolCategory } from './data';
import { categoryLabels } from './data';

interface CategoryCopy {
  intro: string;
  overview: string[];
  use: string[];
  places: [string, string][];
  benefits: { title: string; text: string }[];
  tips: string[];
  faqs: string[];
}

const copy: Record<ToolCategory | 'calculatorLegacy' | 'converterLegacy', CategoryCopy> = {
  text: {
    intro: 'This text analysis tool runs directly in your browser, so your content is processed instantly and privately. Use it to review writing quality, spot common on-page SEO issues, and prepare copy that is easier for readers and search engines to understand.',
    overview: [
      'Text remains one of the clearest signals search engines use to determine what a page is about. This type of tool examines readability, structure, length, spelling and grammar patterns, keyword placement and common formatting problems that can weaken otherwise useful content.',
      'It is especially useful when you need a fast second opinion before publishing. The result does not replace human judgement, but it helps catch repetitive phrasing, missing headings, weak opening copy, inconsistent capitalisation and content that is too thin to compete confidently.',
      'Because the checks happen in the browser, you can paste drafts repeatedly while editing without waiting for a queue, creating an account, or exposing unpublished content to a third-party server.',
    ],
    use: [
      'Paste the content you want to review into the text area.',
      'Review the real-time statistics and highlighted recommendations.',
      'Make the suggested edits directly in your document, CMS, or editor.',
      'Re-run the check after important edits to confirm the improvements.',
    ],
    places: [
      ['Blog posts and guides', 'Check readability, headings, keyword placement and content length before publishing.'],
      ['Product descriptions', 'Remove duplicated manufacturer copy and make product pages unique, specific and useful.'],
      ['Landing pages', 'Ensure the opening paragraph, benefits and calls to action are clear and persuasive.'],
      ['Academic or business writing', 'Catch grammar, punctuation, capitalisation and sentence-structure issues early.'],
      ['Email newsletters', 'Improve clarity before copying content into an email platform.'],
      ['Client or agency deliverables', 'Run a quick final quality-control pass before sending work for approval.'],
    ],
    benefits: [
      { title: 'Faster editing', text: 'Get immediate feedback instead of waiting for a manual proofreading pass.' },
      { title: 'More consistent content', text: 'Apply the same readability and on-page standards across every page.' },
      { title: 'Better reader experience', text: 'Clear sentences, headings and structure reduce bounce risk and improve comprehension.' },
      { title: 'Private drafts', text: 'Unpublished text is handled in your browser and is not uploaded for processing.' },
    ],
    tips: ['Write for the reader first and search engines second.', 'Short paragraphs, headings and lists make technical text easier to scan.', 'Keep the primary topic consistent across the title, H1, opening paragraph and URL.'],
    faqs: ['Do I need to create an account?', 'Is the text I paste uploaded to a server?', 'What writing issues does this tool check?', 'How often should I run a text or SEO content check?', 'Can I use this tool for blog posts, product pages and essays?', 'Does the tool replace a professional proofreader or editor?'],
  },
  keyword: {
    intro: 'Keyword tools help you understand what people search for, how competitive a topic may be, and whether your content matches search intent. Use these results as a research aid before writing or optimising a page.',
    overview: [
      'A strong page begins with a clear search intent. Keyword research helps you move from broad topics to the exact words, questions, modifiers and long-tail phrases your audience uses when looking for information, products or services.',
      'These tools are most useful during planning. They help you avoid creating pages that no one searches for, identify related terms that should appear naturally in supporting sections, and choose a page focus that is specific enough to be realistic.',
      'Treat keyword data as directional rather than absolute. Search behaviour changes by country, season, industry and device, so combine it with competitor analysis, your own analytics and the language customers actually use in enquiries.',
    ],
    use: [
      'Start with a broad topic, then narrow it to specific phrases and questions.',
      'Compare search volume, modifiers and related phrases.',
      'Choose one primary keyword and a small set of closely related terms.',
      'Use the selected terms naturally in titles, headings, body copy and internal links.',
    ],
    places: [
      ['Content planning', 'Build content calendars around questions and topics with clear intent.'],
      ['New landing pages', 'Select a focused phrase before writing titles, headings and body copy.'],
      ['E-commerce categories', 'Use shopper language, attributes and product modifiers in category copy.'],
      ['Local service pages', 'Combine service terms with locations, problem phrases and common questions.'],
      ['Competitor research', 'Compare the topics competitors target and identify less crowded opportunities.'],
      ['Website information architecture', 'Group related keywords into logical pages instead of competing pages.'],
    ],
    benefits: [
      { title: 'Clearer targeting', text: 'Each page can focus on a specific intent instead of covering several topics weakly.' },
      { title: 'Better long-tail opportunities', text: 'Specific phrases often have less competition and higher conversion intent.' },
      { title: 'Stronger content briefs', text: 'Writers receive the terms, questions and related topics a page should cover.' },
      { title: 'Less keyword cannibalisation', text: 'You can assign distinct keywords to pages instead of repeating the same phrase everywhere.' },
    ],
    tips: ['One well-targeted page usually outperforms a page stuffed with many unrelated terms.', 'Long-tail phrases often convert better because they express clearer intent.', 'Avoid using the same keyword on multiple competing pages.'],
    faqs: ['What is a primary keyword?', 'What is the difference between short-tail and long-tail keywords?', 'What keyword density should I use?', 'Are related keywords important?', 'How do I choose the best keyword for a page?', 'Should I optimise one page for several keywords?'],
  },
  backlink: {
    intro: 'Backlinks remain one of the strongest off-page ranking signals because they act as references from other websites. These tools help you inspect link profiles, identify opportunities, and spot links that may need attention.',
    overview: [
      'Search engines use links to discover pages and understand which resources are trusted within a topic. A relevant link from a reputable website is generally more valuable than a large number of low-quality or unrelated links.',
      'Backlink analysis also reveals internal linking opportunities, nofollow usage, broken references, outreach prospects and patterns that could look unnatural. It is useful for SEO audits, competitor research and content promotion.',
      'The goal is not simply to maximise link count. Sustainable link building comes from useful content, genuine relationships, digital PR, directories that add value and pages that others naturally want to reference.',
    ],
    use: [
      'Enter a domain or page URL to review its link profile.',
      'Compare internal, external and nofollow links where available.',
      'Prioritise relevant links from trusted and topically related websites.',
      'Use the results to guide outreach, content promotion and internal linking work.',
    ],
    places: [
      ['Competitor analysis', 'Identify the websites that link to competing pages and look for legitimate opportunities.'],
      ['Content promotion', 'Find sites that already cover a related topic and may reference your resource.'],
      ['Digital PR', 'Support outreach with information about domain relevance and linking patterns.'],
      ['Technical SEO audits', 'Check broken internal links, redirects and nofollow attributes.'],
      ['Local business SEO', 'Review citations, directories and links from regional or industry websites.'],
      ['Migration recovery', 'Detect references that may break or lose value during a domain or URL migration.'],
    ],
    benefits: [
      { title: 'Improved authority signals', text: 'Relevant trusted links can help search engines understand your credibility.' },
      { title: 'More referral traffic', text: 'Useful links can send visitors directly from other websites.' },
      { title: 'Better crawl discovery', text: 'Strong internal and external links help crawlers find important pages.' },
      { title: 'Risk awareness', text: 'You can identify nofollow patterns, broken links and profiles that need review.' },
    ],
    tips: ['A small number of authoritative, relevant links is usually better than many low-quality links.', 'Nofollow links can still send valuable referral traffic.', 'Fix broken internal links before building new external links.'],
    faqs: ['What is a backlink?', 'What is the difference between dofollow and nofollow links?', 'How do backlinks help SEO?', 'Are nofollow links useful?', 'How do I find broken backlinks?', 'Should I buy backlinks?'],
  },
  management: {
    intro: 'Website management tools inspect the technical and on-page elements that affect crawling, indexing, sharing, rendering and page experience. They are designed for quick checks without uploading files or signing in.',
    overview: [
      'A website can have excellent content but still underperform if search engines cannot access, render, understand or share it correctly. Management tools inspect the technical signals that connect content to crawling, indexing, social sharing and browser behaviour.',
      'These tools are practical for routine maintenance and launch checklists. They help developers, marketers and site owners verify redirects, sitemaps, robots directives, meta tags, structured data, page size, scripts, forms, headers and mobile rendering.',
      'Browser-based checks are especially fast for single-page diagnostics. For a site-wide migration or enterprise audit, combine these results with server logs, Google Search Console and a dedicated crawler.',
    ],
    use: [
      'Enter the live URL you want to inspect.',
      'Allow the tool to fetch and parse the public HTML response.',
      'Review each category and prioritise errors before warnings.',
      'Apply fixes in your CMS, theme, server configuration or code.',
    ],
    places: [
      ['Before launching a page', 'Confirm tags, canonical URLs, mobile layout and sharing data are present.'],
      ['After a redesign', 'Verify that forms, redirects, scripts, headings and structured data still work.'],
      ['Routine website maintenance', 'Catch accidental noindex rules, missing tags or heavy resources early.'],
      ['Developer QA', 'Provide a quick checklist when reviewing pull requests or staging pages.'],
      ['Client reporting', 'Turn technical findings into a simple status report with actionable items.'],
      ['Migration checks', 'Compare old and new pages for canonical, redirect, header and metadata consistency.'],
    ],
    benefits: [
      { title: 'Fewer indexing problems', text: 'Blocked pages, bad canonicals and missing tags are easier to catch early.' },
      { title: 'Consistent sharing', text: 'Open Graph and Twitter data control how pages appear when shared.' },
      { title: 'Faster launches', text: 'A repeatable checklist reduces missed steps before release.' },
      { title: 'Cross-team clarity', text: 'Marketers and developers see the same technical requirements and status.' },
    ],
    tips: ['Re-test after deploying changes because caches and proxies can delay updates.', 'Keep structured data, meta tags and social tags consistent with the page content.', 'Document changes so regressions are easier to diagnose later.'],
    faqs: ['Why is website management important for SEO?', 'How often should I audit my website?', 'Can these tools detect every issue?', 'Do browser-based tools access private pages?', 'What should I fix first after an audit?', 'Are the results saved anywhere?'],
  },
  checker: {
    intro: 'Website checker tools evaluate a live page against common SEO, security, mobile and performance best practices. Each result includes an explanation and, where possible, a practical recommendation.',
    overview: [
      'A website checker consolidates many individual audits into one report: on-page metadata, headings, links, HTTPS, mobile usability, page weight, scripts, compression, headers and search appearance. It gives you a quick snapshot of a page’s overall health.',
      'The score is a prioritisation aid rather than a ranking guarantee. It highlights the issues most likely to affect crawling, accessibility, performance and user experience, while still leaving room for context such as industry, audience and page purpose.',
      'Checks are especially valuable when repeated across templates. If one product page has a missing title or heavy script, hundreds of similar pages may share the same problem.',
    ],
    use: [
      'Submit the exact URL, including https:// if you want to test a specific protocol.',
      'Run separate checks for the homepage, key landing pages and templates.',
      'Use the status indicators to separate passing checks from issues.',
      'Re-run the checker after fixing the page to verify the result.',
    ],
    places: [
      ['SEO audits', 'Prioritise technical and on-page fixes using clear status indicators.'],
      ['Client onboarding', 'Create a baseline report before starting optimisation work.'],
      ['Competitor comparison', 'Compare how competitors structure pages and handle basic SEO requirements.'],
      ['Post-launch verification', 'Confirm that production pages meet the launch checklist.'],
      ['Performance triage', 'Identify heavy scripts, large HTML and unoptimised resources.'],
      ['Marketing QA', 'Check social tags, titles, descriptions and mobile appearance before campaigns.'],
    ],
    benefits: [
      { title: 'Fast overview', text: 'Many important checks are consolidated into one easy-to-read report.' },
      { title: 'Actionable priorities', text: 'Errors and warnings show where development or content work should begin.' },
      { title: 'Repeatable process', text: 'The same checks can be applied to every important page template.' },
      { title: 'Better page experience', text: 'Mobile, speed, security and metadata improvements benefit both users and search engines.' },
    ],
    tips: ['A high score is useful, but user experience and business goals also matter.', 'Warnings are opportunities; errors usually have a more direct SEO impact.', 'Check representative pages rather than relying on the homepage alone.'],
    faqs: ['How is the website score calculated?', 'Why might the result differ from Google PageSpeed Insights?', 'Does a good score guarantee top rankings?', 'Which issues are most important?', 'Why can some pages not be fetched?', 'How often should I check my site?'],
  },
  domain: {
    intro: 'Domain tools examine registration, DNS, domain authority signals and related web properties. They are useful for competitive research, domain purchasing, migration planning and understanding the trust history of a website.',
    overview: [
      'Domain data provides context about how long a website has been registered, when it expires, who operates it, how its name servers are configured and whether DNSSEC is present. These details matter during purchases, migrations and security reviews.',
      'Domain reputation and authority-style metrics are estimates based on links, age, history and other signals. They are useful for comparison but do not directly control rankings; a newer domain with excellent content can still outperform an older, neglected domain.',
      'Domain checks are also a practical safeguard. Expired domains can cause service outages, while unexpected registrar or nameserver changes can affect email, hosting, security certificates and search engine access.',
    ],
    use: [
      'Enter a domain name without a path when checking registration or DNS information.',
      'Compare registration age, expiry and registrar data before purchasing or migrating.',
      'Use authority and link signals as estimates, not guarantees of ranking.',
      'Combine domain data with on-page and technical checks for a fuller picture.',
    ],
    places: [
      ['Buying a domain', 'Check age, expiry, registrar, status and nameservers before purchase.'],
      ['Competitive research', 'Compare authority indicators and registration history across competitors.'],
      ['Domain migrations', 'Confirm registrar, DNSSEC and nameserver details before changing infrastructure.'],
      ['Brand protection', 'Monitor expiry dates and avoid accidental loss of important domains.'],
      ['Website acquisition', 'Review domain history and link signals as part of due diligence.'],
      ['Troubleshooting DNS', 'Identify nameserver and registry details when email or hosting behaves unexpectedly.'],
    ],
    benefits: [
      { title: 'Better purchasing decisions', text: 'Registration, expiry and registrar information reduce avoidable domain risk.' },
      { title: 'Migration confidence', text: 'Nameserver and DNSSEC details help prevent email, hosting and certificate issues.' },
      { title: 'Competitive context', text: 'Domain metrics provide a rough view of a site’s accumulated trust signals.' },
      { title: 'Renewal protection', text: 'Clear expiry information helps prevent accidental domain expiration.' },
    ],
    tips: ['Domain age is only one small trust signal; content and links matter more.', 'Check expiry dates to avoid accidental domain loss.', 'Review DNSSEC, nameservers and registrar details during migrations.'],
    faqs: ['What is domain age?', 'Does an older domain automatically rank better?', 'What is domain authority?', 'Why might a domain be unavailable in public registries?', 'How do I check whether a domain is expiring?', 'Does this tool replace a full WHOIS or DNS service?'],
  },
  ip: {
    intro: 'IP tools provide network and geolocation information for public addresses and domains. They can help diagnose hosting, proxy, DNS and connectivity problems without requiring command-line access.',
    overview: [
      'Every public website resolves to one or more IP addresses. Those addresses reveal the hosting network, approximate location, organisation, time zone, connection quality and sometimes whether traffic is passing through a CDN or proxy.',
      'IP information is especially useful when a site behaves differently by region, when a migration appears incomplete, when email delivery fails, or when you need to confirm that DNS changes have propagated. It is also useful for understanding your own connection and browser environment.',
      'IP geolocation identifies network infrastructure, not an individual person. Mobile networks, VPNs and content delivery networks can route traffic far from the visitor’s actual location.',
    ],
    use: [
      'Enter an IPv4, IPv6 address or domain to look up public network details.',
      'Use the location and ISP information to confirm hosting or CDN routing.',
      'Review proxy and address-class details when troubleshooting access issues.',
      'Cross-check important infrastructure changes with your hosting provider.',
    ],
    places: [
      ['DNS and hosting checks', 'Confirm which network or data centre is serving a website.'],
      ['CDN verification', 'See whether a domain resolves to Cloudflare, Akamai, Fastly or another edge network.'],
      ['Proxy or VPN diagnostics', 'Understand why a website appears in another region or network.'],
      ['Migration testing', 'Verify that DNS changes point to the expected new server.'],
      ['Security reviews', 'Review hosting, ASN and approximate network location during incident response.'],
      ['Developer testing', 'Compare local, staging and production network information from the browser.'],
    ],
    benefits: [
      { title: 'No command line required', text: 'Get IP and hosting information using a simple web form.' },
      { title: 'Faster DNS troubleshooting', text: 'CDN, network and location details help isolate routing problems.' },
      { title: 'Useful migration checks', text: 'You can verify whether a domain still points to an old infrastructure address.' },
      { title: 'Transparent geolocation limits', text: 'The tool makes it clear that IP location is approximate.' },
    ],
    tips: ['IP geolocation is approximate and commonly identifies a data centre rather than an end user.', 'A CDN can serve many locations from different IP addresses.', 'Never treat an IP lookup as proof of a person’s exact physical address.'],
    faqs: ['What is an IP address?', 'What is the difference between IPv4 and IPv6?', 'Why is the geolocation approximate?', 'What is a Class C IP block?', 'Why does my website show a CDN or hosting IP?', 'Can I find someone’s exact location from an IP address?'],
  },
  pdf: {
    intro: 'PDF tools perform conversions, merging, splitting, rotation, compression and page inspection directly in your browser. Files are processed locally where possible, which keeps the workflow fast and private.',
    overview: [
      'PDFs are used for invoices, contracts, reports, presentations, scanned documents and downloadable guides, but they often need small adjustments before sharing: a missing page, incorrect orientation, oversized images or a format that cannot be edited.',
      'Browser-based PDF processing removes the need to upload sensitive documents to an unknown server. It is ideal for quick merge, split, rotate, compress and conversion tasks on a laptop or desktop without installing desktop software.',
      'PDF quality depends on the source. Scanned documents behave as images and may need OCR, while documents generated from text can usually preserve selectable text, headings and metadata.',
    ],
    use: [
      'Select or drop your PDF into the specific tool.',
      'Choose pages, orientation, image quality or compression target.',
      'Preview the result before downloading the generated file.',
      'Save the output and check text, images and page breaks afterwards.',
    ],
    places: [
      ['Office administration', 'Merge, split or rotate contracts, forms, invoices and reports.'],
      ['Student and academic work', 'Convert notes or essays to PDF and combine assignment pages.'],
      ['Client deliverables', 'Compress large reports or convert documents before sending them.'],
      ['Scanned paperwork', 'Reorder, rotate or compress image-based PDFs for easier sharing.'],
      ['Legal and finance teams', 'Prepare paginated documents without uploading confidential files.'],
      ['Web publishing', 'Convert text, spreadsheets or presentations into portable downloadable documents.'],
    ],
    benefits: [
      { title: 'Private processing', text: 'Most PDF operations happen on the device, reducing file-sharing risk.' },
      { title: 'No software install', text: 'Common document tasks are available directly in the browser.' },
      { title: 'Smaller files', text: 'Compression can reduce email and upload limits and speed up downloads.' },
      { title: 'Flexible output', text: 'Merge, split, rotate and convert documents to match the required workflow.' },
    ],
    tips: ['Scanned PDFs are images, so text extraction or search may require OCR.', 'Lower compression targets reduce file size but can soften images.', 'Keep an uncompressed backup before making irreversible changes.'],
    faqs: ['Are my PDF files uploaded to a server?', 'Why is text missing after conversion?', 'What is the difference between lossless and target-size compression?', 'Can I edit a scanned PDF?', 'Why does my converted document have different line breaks?', 'Are these PDF tools free to use?'],
  },
  calculatorLegacy: {
    intro: 'Calculator tools perform quick, accurate numerical computations in your browser. Whether you are working out a discount, estimating ad revenue, checking a body-mass index, or verifying a financial formula, these calculators give you the answer instantly without a spreadsheet or external software.',
    overview: [
      'Numbers drive decisions in every business, from pricing and margin analysis to advertising spend, fitness tracking and statistical estimation. A fast, reliable calculator saves time and reduces manual errors, especially when you need quick answers during a meeting, call or planning session.',
      'These calculators are designed for people who work in marketing, sales, finance, retail, healthcare, education and general business. Each tool takes the most common input format for its category and shows the result clearly, with additional context where it matters.',
      'Because every calculation runs locally, there is no need to create an account, paste data into a cloud tool, or worry about sensitive numbers being stored elsewhere. It is just maths — fast, private and available on any device with a browser.',
    ],
    use: [
      'Pick the calculator that matches your task: margin, tax, discount, percentage, probability, EPS, LTV or CPM.',
      'Enter your numbers in the fields provided. Many calculators accept more than one mode or direction.',
      'Review the main result, then read the supporting stats for fuller context.',
      'Use the output to decide pricing, budgeting, reporting or health tracking.',
    ],
    places: [
      ['Sales and pricing', 'Work out markup, margin, discounts and taxes before you publish a price.'],
      ['Marketing budgets', 'Estimate ad spend, CPM costs, revenue projections and campaign ROI.'],
      ['Financial reporting', 'Calculate EPS, LTV, GST and other figures required for quick business reviews.'],
      ['Retail and e-commerce', 'Check sale prices, discounts and PayPal fees before listing a product.'],
      ['Health and fitness', 'Estimate BMI and track changes alongside weight, height or exercise data.'],
      ['Education and research', 'Run quick statistical checks with confidence intervals, averages and probability.'],
    ],
    benefits: [
      { title: 'Instant answers', text: 'Get the result as fast as you can type the numbers — no spreadsheets required.' },
      { title: 'Fewer manual mistakes', text: 'Structured inputs and a single formula reduce the chance of arithmetic errors.' },
      { title: 'Private by default', text: 'Numbers stay in your browser; there is no server to trust with business or health data.' },
      { title: 'Portable across devices', text: 'Every calculator works on desktop, tablet and phone with no setup or login.' },
    ],
    tips: ['Double-check that you enter the right number of decimals, especially for finance.', 'Use the "extract" or "reverse" mode when you already have the final amount.', 'For marketing projections, remember that averages are estimates, not guarantees.', 'Save the result as a screenshot if you need to share it in a report or message.'],
    faqs: ['How do I open the calculator for my use case?', 'Are the formulas behind these calculators publicly verifiable?', 'Can I use these calculators in mobile browsers?', 'Why would I use a browser calculator instead of a spreadsheet?', 'Are my numbers sent to a server?', 'Which calculators work offline?'],
  },
  converterLegacy: {
    intro: 'Unit converter tools let you translate measurements between different systems in seconds. They cover length, temperature, pressure, voltage, power, speed, area, weight and time zones — common units that professionals, students and travellers need regularly.',
    overview: [
      'Different industries, regions and standards use different measurement units, and switching between them quickly is important for accurate communication, reporting and everyday decisions.',
      'These converters use internationally recognised formulas, so the same calculation always gives the same result. The key is choosing the correct input unit and reading the output alongside the reference information.',
      'Browser-based converters work without sign-up or cloud processing, which makes them useful when you need a quick comparison on your phone, a shared computer or any device where a dedicated app is not installed.',
    ],
    use: [
      'Select the converter for the measurement you need.',
      'Pick the input unit, enter a value, and read the converted result instantly.',
      'Switch the "from" and "to" units if you want the reverse comparison.',
      'Use the reference information below each result for context and common benchmarks.',
    ],
    places: [
      ['Construction and engineering', 'Convert lengths, areas and pressure units across countries and specification sheets.'],
      ['Manufacturing and supply chain', 'Translate dimensions, weights and tolerances between imperial and metric workflows.'],
      ['International travel and logistics', 'Switch between time zones, speeds and distances when planning trips or shipments.'],
      ['Science and education', 'Convert laboratory, physics and maths units accurately for reports and classwork.'],
      ['Energy and utilities', 'Check power, voltage and pressure figures in watts, BTU, PSI or kilopascals as needed.'],
      ['Fitness and cooking', 'Move between grams, ounces, pounds and stones when reading or writing nutritional information.'],
    ],
    benefits: [
      { title: 'Instant unit switching', text: 'Compare measurements without retyping or rebuilding formulas manually.' },
      { title: 'Accurate by design', text: 'The tool uses standard mathematical conversions so results are consistent every time.' },
      { title: 'Works anywhere', text: 'No app install required; open the page on any device with a browser and use it.' },
      { title: 'Good for quick comparisons', text: 'Easily see the same value in several related units at once.' },
    ],
    tips: ['Check the input unit before reading the result, especially when copying numbers from a PDF or spreadsheet.', 'Temperature conversions are not simple multiplications — use the full Celsius/Fahrenheit/Kelvin formula.', 'For critical work, confirm the result against an official reference or the published conversion table.', 'Time zone conversions depend on whether daylight-saving applies in each location.'],
    faqs: ['What is the difference between imperial and metric units?', 'How do I convert Celsius to Fahrenheit without a tool?', 'Are these conversions exact or rounded?', 'Which converter should I use for shipping weights?', 'Does the time zone converter account for daylight-saving?', 'Can I use these converters for business reports?'],
  },
  calculator: {
    intro: 'Calculator tools provide quick, clear answers for money, marketing, statistics, health and everyday planning. Each calculation runs in your browser and shows the main result alongside supporting figures, so you can make decisions without opening a spreadsheet.',
    overview: [
      'These calculators are useful when you need a reliable estimate during pricing, reporting, campaign planning, coursework or a client conversation. Enter the values you know, choose the calculation mode, and the result updates immediately.',
      'The tools are designed around common formulas and explain the output in plain language. They are excellent for planning and checking your work, but financial, medical and legal decisions should still be reviewed against the relevant official guidance.',
      'Because calculations happen locally, sensitive figures such as revenue, customer value, wages or health measurements remain in your current browser session.',
    ],
    use: ['Choose the calculator that matches your question.', 'Enter the numbers and select the appropriate calculation mode.', 'Review the headline result and supporting values.', 'Use the result as a planning estimate or as a check against your spreadsheet.'],
    places: [
      ['Pricing and sales', 'Calculate margin, markup, discounts, GST and sales tax before publishing prices.'],
      ['Marketing campaigns', 'Estimate CPM, customer lifetime value and likely advertising returns.'],
      ['Business reporting', 'Work out EPS, averages, percentages and confidence intervals for reports.'],
      ['E-commerce operations', 'Check sale prices, payment fees and net revenue per transaction.'],
      ['Education and research', 'Use statistical calculators for sample analysis and classroom exercises.'],
      ['Personal planning', 'Estimate BMI, age milestones and other everyday measurements quickly.'],
    ],
    benefits: [
      { title: 'Fast decisions', text: 'Get a useful estimate while you are planning, pricing or reviewing data.' },
      { title: 'Clear formulas', text: 'Results are labelled plainly, with the supporting numbers shown next to them.' },
      { title: 'Private figures', text: 'Your business and personal numbers remain in the browser session.' },
      { title: 'Mobile-friendly', text: 'The same calculators work on your phone without downloading an app.' },
    ],
    tips: ['Use the correct units and decimal places before trusting a result.', 'Treat advertising, LTV and revenue projections as estimates rather than guarantees.', 'For tax and health decisions, confirm the output with official or professional advice.', 'Keep a copy of important calculations in your business records.'],
    faqs: ['Are the calculator formulas accurate?', 'Can I use these calculators on my phone?', 'Are my numbers stored or uploaded?', 'Can I use calculator results in a business report?', 'Why might my result differ from a spreadsheet?', 'Are tax, finance and BMI results professional advice?'],
  },
  converter: {
    intro: 'Unit converter tools translate measurements between metric, imperial and specialist systems. They are useful whenever two people, documents or systems use different units and you need a quick, consistent conversion.',
    overview: [
      'Length, weight, pressure, voltage, power, speed, area, temperature and time zones appear in everyday work across engineering, logistics, science, travel, retail and education. A small unit mistake can create a much larger practical problem.',
      'Each converter uses recognised conversion factors and keeps the input and output units visible. That makes it easier to check the direction of the conversion before copying the result into a report, product listing or spreadsheet.',
      'The tools are intentionally simple: choose the units, enter a value and compare the output. No account, extension or calculation software is required.',
    ],
    use: ['Choose the measurement category you need.', 'Select the input and output units.', 'Enter a number and review the converted value.', 'Check the reference information before using the value in critical work.'],
    places: [
      ['Engineering and construction', 'Convert dimensions, pressure, area and power between supplier specifications.'],
      ['Manufacturing and logistics', 'Translate weights, distances and measurements across international standards.'],
      ['Travel planning', 'Compare distances, speeds and local times across countries.'],
      ['Science and education', 'Check unit conversions for homework, lab notes and technical documents.'],
      ['Energy and utilities', 'Convert voltage, power, pressure and related technical measurements.'],
      ['Food, fitness and retail', 'Switch grams, ounces, pounds, kilograms and other consumer-facing units.'],
    ],
    benefits: [
      { title: 'Consistent results', text: 'Standard conversion factors remove repeated manual calculations.' },
      { title: 'Quick comparisons', text: 'See a value in familiar units before making a practical decision.' },
      { title: 'No installation', text: 'Open the converter on any device with a browser and use it immediately.' },
      { title: 'Reduced mistakes', text: 'The selected source and destination units stay visible beside the result.' },
    ],
    tips: ['Always check the selected source unit before copying the output.', 'Temperature uses formulas rather than a simple multiplier.', 'For regulated or safety-critical work, confirm conversions against your official specification.', 'Time zone results can change with daylight-saving rules.'],
    faqs: ['Are the conversion factors exact?', 'What is the difference between metric and imperial units?', 'Does the time-zone tool handle daylight saving?', 'Can I use the converter for technical specifications?', 'Which unit should I use for an international report?', 'Can these tools convert multiple values at once?'],
  },
  image: {
    intro: 'Image tools help optimise visual assets for faster pages and better sharing. Resizing, modern formats and compression are among the quickest wins for Core Web Vitals and mobile performance.',
    overview: [
      'Images are often the heaviest resources on a web page. Oversized photos, unnecessary metadata, legacy formats and missing dimensions can slow loading, increase bandwidth costs and cause layout shifts that annoy mobile visitors.',
      'Image optimisation tools make it easy to resize hero photos, product images, screenshots, thumbnails and social graphics, then export them in an appropriate format. They are useful for designers, marketers, developers and content editors.',
      'Optimisation is not about making images look poor. The best workflow keeps visual quality high while removing extra pixels, excessive file weight and formats that modern browsers do not need.',
    ],
    use: [
      'Upload the image you want to resize, compress or convert.',
      'Choose dimensions, format or quality settings appropriate for the page.',
      'Preview the output and compare the original and resulting file sizes.',
      'Download the optimised asset and add descriptive alt text when publishing.',
    ],
    places: [
      ['Blog and article images', 'Prepare fast-loading featured images and in-content screenshots.'],
      ['E-commerce', 'Resize product photos consistently and reduce page weight.'],
      ['Social sharing', 'Create correctly sized images for cards, profiles and promotions.'],
      ['Website performance audits', 'Compress images flagged as heavy contributors to LCP or bandwidth.'],
      ['Email campaigns', 'Reduce attachment and hosted-image size for faster loading.'],
      ['Design handoffs', 'Export web-friendly assets without relying on desktop editing software.'],
    ],
    benefits: [
      { title: 'Faster pages', text: 'Smaller image files reduce load time and mobile data usage.' },
      { title: 'Better Core Web Vitals', text: 'Optimised, correctly sized images improve LCP and reduce layout shift.' },
      { title: 'Consistent visuals', text: 'Resizing makes thumbnails, heroes and product images more uniform.' },
      { title: 'Simple workflow', text: 'Compress and export directly in the browser without an image editor.' },
    ],
    tips: ['Use WebP or AVIF where supported and keep JPG/PNG fallbacks where necessary.', 'Set explicit width and height attributes to reduce layout shift.', 'Compress images before uploading them to the CMS.'],
    faqs: ['Why should I compress images?', 'What image format is best for the web?', 'Will resizing reduce image quality?', 'What image dimensions should I use?', 'Do images affect SEO rankings?', 'Are my images stored online?'],
  },
};

const strip = (value: string) => value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const shortName = (name: string) => name.replace(/\s*(Free Online|Online|Free)\s*/gi, '').replace(/tool/i, '').trim() || name;

const Chevron: React.FC<{ open: boolean }> = ({ open }) => (
  <svg className={`w-4 h-4 text-indigo-600 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
);

export const ToolRelatedContent: React.FC<{ tool: ToolDef; related: ToolDef[] }> = ({ tool, related }) => {
  const base = copy[tool.category] || copy.management;
  const name = shortName(tool.name);
  const faqs = useMemo(() => base.faqs.slice(0, 7).map((question, index) => {
    const answerByIndex = [
      `No. ${name} is designed to work without sign-up, and most functionality runs immediately in your browser.`,
      `Most processing is performed locally in your browser. Public URLs may be requested through a relay when a website blocks browser-based requests, but files and pasted text are not stored by this tool.`,
      `${name} checks the factors described on this page and shows status, explanation and recommended next steps.`,
      `Run it whenever you create or significantly change a page, after a website update, migration, redesign, or at least once a month for important pages.`,
      `Yes. The same checks apply to blog posts, product pages, landing pages, documentation, essays and other public web pages.`,
      `It is a practical first-pass tool. For high-stakes legal, editorial or technical work, review the output manually and use a specialist where appropriate.`,
      `The result is based on the public response available to the browser. Firewalls, JavaScript rendering, login walls, geo-restrictions and relay availability can affect what is detected.`,
    ];
    return { q: question, a: answerByIndex[index] };
  }), [base.faqs, name]);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="mt-10 space-y-8">
      <section className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 mb-2">{categoryLabels[tool.category]}</p>
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-4">About the {name}</h2>
        <div className="space-y-4 mb-7">
          {base.overview.map((paragraph, index) => <p key={index} className="text-slate-600 leading-relaxed">{paragraph}</p>)}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-bold text-slate-900 mb-3">How to use this tool</h3>
            <ol className="space-y-2.5">
              {base.use.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm text-slate-600"><span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span><span>{step}</span></li>
              ))}
            </ol>
          </div>
          <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
            <h3 className="font-bold text-slate-900 mb-3">Best-practice tips</h3>
            <ul className="space-y-2.5">
              {base.tips.map(tip => <li key={tip} className="flex gap-2 text-sm text-slate-600"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />{tip}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 mb-2">Use cases</p>
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-2">Where you can use the {name}</h2>
        <p className="text-sm text-slate-500 mb-6">Practical scenarios where this type of tool saves time, reduces errors or improves the quality of a website and its content.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {base.places.map(([title, text]) => (
            <div key={title} className="flex gap-3 rounded-xl border border-slate-200 p-4 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors">
              <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">✓</span>
              <div><h3 className="text-sm font-bold text-slate-800">{title}</h3><p className="text-xs text-slate-500 mt-1 leading-relaxed">{text}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-100 p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 mb-2">Benefits</p>
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-6">Why use this tool?</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {base.benefits.map(benefit => (
            <div key={benefit.title} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center mb-3">★</div>
              <h3 className="text-sm font-bold text-slate-800 mb-1">{benefit.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{benefit.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 mb-2">Answers</p>
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-5">{name} FAQs</h2>
        <div className="divide-y divide-slate-100 border-y border-slate-100">
          {faqs.map((faq, index) => {
            const open = openFaq === index;
            return (
              <div key={faq.q}>
                <button type="button" onClick={() => setOpenFaq(open ? null : index)} aria-expanded={open} className="w-full flex items-center justify-between gap-4 py-4 text-left">
                  <h3 className="text-sm md:text-base font-bold text-slate-800">{faq.q}</h3>
                  <Chevron open={open} />
                </button>
                {open && <p className="pb-4 pr-8 text-sm text-slate-600 leading-relaxed">{faq.a}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {related.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
          <h2 className="text-2xl font-extrabold text-slate-900 mb-1">Related tools</h2>
          <p className="text-sm text-slate-500 mb-5">Continue with these related {categoryLabels[tool.category].toLowerCase()}.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {related.map(t => (
              <a key={t.slug} href={`#/tool/${t.slug}`} className="group rounded-xl border border-slate-200 p-4 hover:border-indigo-300 hover:shadow-md transition-all">
                <h3 className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 mb-1">{t.name}</h3>
                <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">{strip(t.description)}</p>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
