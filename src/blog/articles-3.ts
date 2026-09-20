import type { BlogArticle } from './types';

export const articlesWordPress: BlogArticle[] = [
  {
    slug: 'wordpress-plugins-slowing-site',
    title: 'Your WordPress Plugins Are Killing Your SEO (Here\u2019s Proof)',
    metaTitle: 'WordPress Plugins Slowing Your Site? How to Find & Fix It | SEO Audit Pro',
    metaDescription: 'Every WordPress plugin adds weight, queries, or scripts. Learn how to measure exactly which plugins slow your site down and how to cut the bloat without losing features.',
    keywords: ['WordPress plugins slow', 'WordPress performance', 'plugin bloat', 'WordPress speed optimization', 'WordPress SEO'],
    category: 'WordPress SEO',
    date: '2025-01-16',
    readTime: '6 min read',
    author: 'SEO Audit Pro Team',
    excerpt: 'Forty-three active plugins is not a personality. It\u2019s a performance problem. Here\u2019s how to find out what each plugin actually costs you, with real numbers.',
    content: `
There's a moment in almost every WordPress audit where I open the plugins page and just sit quietly for a second. Forty active plugins. Sometimes sixty. A slider plugin from 2019, three different contact form plugins, two SEO suites running side by side, and something called "Ultimate Addons for Something" that nobody remembers installing.

Every one of those has a cost. Not always a big one, but never zero. And the costs stack in ways that quietly murder your Core Web Vitals and, through them, your rankings.

## What a plugin actually costs

People imagine plugins as features sitting in a drawer until needed. In reality, a plugin can hit your site in four separate places:

**PHP execution on every request.** Many plugins run code on every single page load whether they're relevant to that page or not. Each one adds milliseconds to your Time to First Byte. Ten sloppy plugins can add half a second before the browser receives a single byte.

**Database queries.** Some plugins are polite and cache their lookups. Others fire twenty queries per page. A bloated wp_options table with thousands of autoloaded rows (a classic symptom of years of installing and deleting plugins) slows every page on the site.

**Frontend scripts and styles.** This is the visible damage. That popup plugin loads its JavaScript on all 900 of your pages, even though you use one popup on one landing page. Multiply by a page builder, a form plugin, a gallery, a translation bar, and you're shipping 30 requests and a megabyte of assets nobody asked for.

**Admin-side weight.** Less SEO-relevant, but slow admin pages make editors publish less. That has its own cost.

## Measure, don't guess

Here's the part most tutorials skip: you can get actual numbers per plugin instead of vibes.

**Query Monitor** (free plugin, install it temporarily) breaks down every page load: which plugin ran which queries, how long each took, which hooks were slow. Sort by time and your worst offenders reveal themselves in about ninety seconds.

**A staging-site elimination test** is even more convincing. Clone your site, run PageSpeed Insights for a baseline, then deactivate plugins one at a time and re-test. Keep a spreadsheet. When I did this for a client's WooCommerce store last autumn, one "essential" marketing plugin was responsible for 1.1 seconds of TTFB by itself. It made an uncached external API call on every page load. The vendor's support team confirmed it was "expected behavior." It got replaced that week.

**The browser network tab** shows frontend weight per plugin nicely, since WordPress asset URLs include the plugin folder name. Filter by "plugins" and see who's shipping what.

## The usual heavyweights

Certain categories earn their bad reputation:

- **Page builders** (the older generation especially) can wrap every element in six nested divs and load hundreds of KB of CSS and JS globally
- **"Addon packs"** for builders and forms, which register dozens of widgets you'll never place
- **Social share and feed plugins** that pull external scripts from social networks, which are slow and privacy-hostile
- **Related posts plugins** doing expensive similarity queries live on each request
- **Anything that phones an external API synchronously** during page render: currency converters, review importers, stock tickers
- **Duplicate-purpose plugins**: two caching plugins or two SEO plugins will actively fight each other, not just add weight

None of this means "use no plugins." It means each one should pay rent.

## How to cut without breaking things

Work through this on staging first, always:

**1. Deactivate the obvious dead weight.** Anything you can't explain in one sentence goes. Deactivate, wait a week, then delete. Deleting matters: deactivated plugins still get security updates you're not applying, and some leave autoloaded options behind. A cleanup plugin or a quick look at wp_options finishes the job.

**2. Consolidate overlaps.** One SEO plugin. One form plugin. One optimizer. Pick the best of each and migrate.

**3. Replace the heaviest with lighter equivalents.** Almost every popular heavy plugin has a lean alternative. Sliders can become plain CSS. Social buttons can be simple HTML links (which also dodge the tracking scripts). Some builder-based sites are worth slowly rebuilding on the native block editor, which got genuinely good.

**4. Conditionally load what remains.** An asset manager like Asset CleanUp or Perfmatters lets you unload a plugin's scripts everywhere except the pages that use it. The contact form JS belongs on the contact page, not on 900 blog posts. This step alone often removes 15+ requests sitewide.

**5. Cache the rest.** Full-page caching hides PHP-side plugin cost for anonymous visitors. It's a painkiller, not a cure, but you should absolutely take the painkiller too.

## The objections I hear, answered

**"But I need all these features."** Do you, though? Walk the list feature by feature and ask when each was last used. In practice maybe a third survive honest questioning. And plenty of "features" are one-liners in disguise: a code snippet plugin entry, a small theme function, a single CSS rule. You installed a 2MB plugin to hide the admin bar. There was a filter for that.

**"My developer says the page builder is fine."** Modern builders have improved, genuinely. But run the test anyway: build one representative page in the native block editor, put both versions on staging, and compare PageSpeed results side by side. Data ends the debate in either direction, and sometimes the builder does win. More often the difference is 20 to 40 points on mobile.

**"Won't deleting plugins break my content?"** Some leave shortcodes behind that render as ugly raw text, so search your database for the shortcode tags before deleting, and clean up on staging first. This is exactly why the elimination test happens on a clone, never production. Take backups like an adult and the whole process is boring, which is the goal.

**"Is there a magic number of plugins?"** No. Twelve heavy ones can be worse than thirty light ones. Count requests, kilobytes, and query time, not plugin rows. The number is a smell, not a verdict; the measurements are the verdict.

## The SEO connection, spelled out

Google doesn't care how many plugins you have. It cares about what your visitors experience: TTFB feeding into LCP, JavaScript weight feeding into INP, layout-shifting widgets feeding into CLS. Plugin bloat pushes all three the wrong way at once, which is why a plugin diet is often the single highest-impact SEO project a WordPress site can run.

A realistic target for most content sites is 15 to 25 well-chosen plugins, each of them justified, each conditionally loaded where possible. Get there and you'll usually watch your field Core Web Vitals turn green within a couple of CrUX cycles. The rankings tend to follow.
`,
  },
  {
    slug: 'wordpress-seo-setup-guide',
    title: 'WordPress SEO Setup: The Only Guide You Actually Need',
    metaTitle: 'WordPress SEO Setup Guide 2025: Step by Step | SEO Audit Pro',
    metaDescription: 'Permalinks, SEO plugins, sitemaps, schema, noindex traps and more. A complete, practical WordPress SEO configuration guide without the fluff or upsells.',
    keywords: ['WordPress SEO', 'WordPress SEO setup', 'Yoast settings', 'Rank Math setup', 'WordPress sitemap'],
    category: 'WordPress SEO',
    date: '2025-01-03',
    readTime: '7 min read',
    author: 'SEO Audit Pro Team',
    excerpt: 'Most WordPress SEO guides are 6,000 words of plugin screenshots. This is the distilled version: what to configure, what to skip, and the traps that quietly deindex sites.',
    content: `
WordPress powers over 40% of the web, which means WordPress SEO advice is everywhere, and most of it is either outdated, padded to rank for word count, or secretly a plugin affiliate pitch. Let me give you the version I'd give a friend: what actually needs configuring, in order, and the handful of traps that genuinely hurt sites.

## First, the one checkbox that can erase you from Google

Settings, Reading, "Discourage search engines from indexing this site." Developers tick it during the build (correctly) and forget to untick it at launch (catastrophically). The site goes live, weeks pass, traffic never comes, and eventually someone finds the checkbox.

Check it right now if you've launched recently. Then check your homepage source for a noindex robots meta tag anyway, because some plugins and hosts set it independently. This mistake is so common that it should be on a laminated launch checklist taped to every agency wall.

## Permalinks: set once, never touch again

Settings, Permalinks, choose "Post name." Clean URLs like yoursite.com/seo-audit-guide beat query strings and date-based paths for readability and click-through.

The critical word is *once*. Changing permalink structure on an established site breaks every URL you've earned links to unless you map redirects perfectly. If you're inheriting an old site with date-based URLs and decent traffic, the boring advice is usually right: leave it alone. The migration risk outweighs the cosmetic gain.

## One SEO plugin, configured in twenty minutes

Yoast, Rank Math, or SEOPress. They all cover the essentials; pick one and resist installing a second. The setup that matters:

- **Titles and meta templates.** Set sensible defaults per post type, something like "Post Title - Site Name." Then write custom titles for your important pages by hand, because templates produce adequate titles and adequate doesn't win clicks.
- **XML sitemap.** The plugin generates it at something like /sitemap_index.xml. Submit that URL in Google Search Console today, not someday.
- **Noindex the junk archives.** Tag pages, author archives on single-author blogs, date archives, media attachment pages: noindex them all. They're thin duplicates that waste crawl budget. Every plugin has toggles for this.
- **Schema basics.** Set organization or person, add your logo. The plugins output Article schema automatically, which is most of what a content site needs.

That's genuinely it. The other 40 settings are fine on defaults. People burn weekends in plugin settings that would be better spent writing one good article.

## Search Console and the feedback loop

Verify your site in Google Search Console (domain-level verification through DNS is cleanest), submit the sitemap, and then actually look at it monthly. Three reports carry most of the value: Performance (which queries you're gaining or losing), Pages (what's indexed and what's excluded and why), and Core Web Vitals (your field-data pass/fail per template).

Search Console is where problems announce themselves early: a plugin update that accidentally noindexed a post type, a redirect chain from an old migration, a template failing INP. Free monitoring, straight from the source.

## Site structure: the underrated part

Plugins can't fix architecture. A few structural habits do more than any meta description ever will:

**Categories as real topics.** Five to ten categories that map to what you actually cover, each with a written intro on the archive page. Skip tags entirely or use them sparingly; tag sprawl (three hundred tags used once each) creates hundreds of worthless pages.

**Internal links in every post.** When you publish something new, link to it from two or three older relevant posts, and link out from it to your cornerstone content. Orphan pages (zero internal links pointing at them) rank poorly and get crawled rarely. This habit costs five minutes per post and compounds like interest.

**Breadcrumbs on, in the theme or via the SEO plugin.** Good for users, good for sitelinks in search results.

## The speed layer (short version)

Core Web Vitals are covered in depth elsewhere on this blog, so just the WordPress-specific essentials: decent hosting with PHP 8.2 or newer, one caching plugin properly configured, images converted to WebP or AVIF with lazy loading below the fold only, and a hard cap on plugin count. A lean WordPress site passes Core Web Vitals comfortably; a neglected one almost never does.

## Traps that still catch people in 2025

- **The reading-settings checkbox.** Worth repeating. Check it after every migration too.
- **Attachment pages.** WordPress historically created a page per uploaded image: thin, duplicate, indexable. Modern SEO plugins redirect them to the file by default, but verify yours does.
- **Staging sites getting indexed.** Password-protect staging or noindex it properly. Duplicate copies of your whole site in the index cause real headaches.
- **Redirect plugins stacking up.** Years of accumulated rules create chains (A to B to C to D). Crawl your own site occasionally with Screaming Frog and flatten them.
- **Theme-bundled "SEO options."** Older themes shipped their own title and meta fields. Running those alongside an SEO plugin outputs duplicate tags. Disable the theme's version.

## A 60-minute monthly maintenance routine

Setup is one-time; upkeep is what separates sites that stay healthy from sites that decay. Once a month, in roughly this order:

- Open Search Console's Pages report and scan the "not indexed" reasons for anything new or growing. A sudden spike in "excluded by noindex" usually means a plugin update changed a setting behind your back.
- Check the Performance report for queries that lost clicks versus the previous period. Pick one or two declining posts and refresh them: update facts, tighten the intro, add whatever the top-ranking pages now cover that you don't.
- Run your homepage and one key template through PageSpeed Insights. You're watching for regressions, not chasing perfection. New plugin, new problem, usually.
- Click through your own site for five minutes on your phone. Broken layouts and dead buttons get found by owners embarrassingly rarely.
- Add internal links from your two or three newest posts to older relevant content, and vice versa. This is the compounding habit almost nobody keeps.

That's the whole routine. An hour a month catches the problems that turn into "why did traffic drop 40%?" emergencies six months later.

## What actually moves rankings

Here's the honest close. Everything above is table stakes: it removes obstacles so Google can crawl, understand, and serve your content. Rankings themselves come from content that answers real queries better than the current results, links earned because that content deserves them, and enough consistency that Google trusts the domain over time.

Configure the machine once, properly. Then spend your energy where compounding lives: publishing, improving old posts, and building internal links. The sites that win at WordPress SEO are rarely the ones with the fanciest plugin stack. They're the ones that shipped good pages every week while their competitors fiddled with settings.
`,
  },
  {
    slug: 'fix-slow-ttfb-wordpress',
    title: 'Slow TTFB on WordPress? Blame Your Hosting (and These 5 Things)',
    metaTitle: 'Fix Slow TTFB on WordPress: 5 Real Causes & Solutions | SEO Audit Pro',
    metaDescription: 'Time to First Byte over 800ms sabotages your LCP before the page even starts rendering. The five real causes of slow WordPress TTFB and how to fix each one.',
    keywords: ['TTFB WordPress', 'slow server response', 'WordPress hosting speed', 'reduce TTFB', 'WordPress caching'],
    category: 'WordPress SEO',
    date: '2024-12-22',
    readTime: '6 min read',
    author: 'SEO Audit Pro Team',
    excerpt: 'You can optimize images forever, but if your server takes 1.5 seconds to respond, your Core Web Vitals are doomed from the start. Let\u2019s fix the foundation.',
    content: `
Time to First Byte is the performance metric people optimize last and should optimize first. It measures how long a browser waits from requesting your page to receiving the first byte of the response. Everything else (rendering, images, scripts, all of it) queues up behind that wait.

Google's guidance says to keep TTFB under 800 milliseconds, and if you want a comfortable path to a 2.5 second LCP, you really want 200 to 500ms. Yet I test WordPress sites weekly that sit at 1.5, 2, sometimes 3 full seconds. No image optimization survives a handicap like that.

WordPress TTFB problems come down to five causes, and they're diagnosable in an afternoon.

## Cause 1: Cheap shared hosting

The blunt one first. On a $3 to $5 shared plan, you're sharing a server with hundreds of other sites. CPU is throttled, memory is tight, disk I/O is contested, and your PHP requests wait in line behind everyone else's.

Test it: measure TTFB at 6 AM and again at 8 PM. Big swing? You're feeling your neighbors' traffic. That's not fixable with plugins.

Managed WordPress hosting or a modest VPS ($10 to $30 a month) routinely cuts baseline TTFB in half or better. It is the single most reliable speed purchase in all of WordPress. I've watched sites drop from 1,400ms to 300ms by changing nothing except the host.

While you're at it, check your PHP version in the hosting panel. PHP 8.2+ is dramatically faster than the 7.x versions a shocking number of hosts still default to. It's a dropdown. It takes one minute.

## Cause 2: No page caching

Without caching, every visit makes WordPress boot PHP, load every active plugin, run dozens of database queries, and assemble the HTML from scratch. For a blog post that hasn't changed since March, that's absurd. The output is identical every time.

Page caching saves the finished HTML and serves it directly. The request never touches PHP. TTFB for cached hits lands wherever your network latency does, often under 100ms.

Options, roughly in order of preference: your host's built-in server-level cache (fastest, zero config, ask support if you have one), or a well-configured plugin like WP Rocket, W3 Total Cache or WP Super Cache. One caching plugin. Two will conflict, and yes, people do install two.

The classic gotcha is logged-in and cart traffic: caching correctly bypasses those, so WooCommerce checkout flows stay dynamic and slow-ish. That's normal and fine. The other 95% of your traffic gets the fast path.

## Cause 3: A plugin doing something expensive on every request

Some plugins run heavy work during page generation: an uncached call to an external API (weather, currency, reviews, Instagram), a giant option blob loaded on every page, a badly indexed query against a million-row table.

Install Query Monitor on staging and load a few pages. It attributes every query and every slow hook to the responsible plugin by name. The worst offender is usually obvious within minutes, sitting there with 400ms of self-inflicted damage. Replace it, cache its output with a transient, or ask the developer to fix it. External API calls in particular should never happen synchronously during render.

## Cause 4: Database rot

Ten-year-old WordPress databases accumulate sludge: tens of thousands of post revisions, expired transients that never got cleaned, orphaned metadata from deleted plugins, and (the big one) an autoloaded options pile that gets read on every single request. I've seen wp_options autoload data over 5MB. Every page load carried it.

Cleanup is straightforward: WP-Optimize or Advanced Database Cleaner handles revisions and transients; a query on wp_options sorted by autoloaded size finds the bloat left behind by long-gone plugins. Take a backup first, obviously. On old sites this is often worth 100 to 300ms.

Object caching with Redis (one toggle on most decent hosts) helps too, especially for WooCommerce and membership sites where many queries repeat.

## Cause 5: Distance

Your server sits in Dallas. Your customer sits in Melbourne. Physics charges roughly 200ms of round trip for that, before your server does anything at all.

If your audience is genuinely global, put a CDN in front that caches full HTML at the edge, not just images. Cloudflare's page caching (APO for WordPress, or cache rules on any plan) serves your pages from a location near each visitor. Edge-cached TTFB in the tens of milliseconds, worldwide, for a few dollars a month. For single-country audiences, simply hosting in that country gets you most of the benefit.

## A 30-minute diagnostic to find your cause

- Run PageSpeed Insights and note the TTFB in the diagnostics
- Test a static file on your domain (any image URL) with a tool like KeyCDN's performance test: that's your server-plus-network floor
- If the floor is slow everywhere, it's hosting or distance (causes 1 and 5)
- If static files are fast but pages are slow, it's PHP: caching, plugins, or database (causes 2 through 4)
- Install Query Monitor and let it point fingers

Fix the one that's actually yours instead of applying all five blindly. Most sites have one dominant cause and four minor ones.

## Two questions everyone asks next

**"Does TTFB directly affect rankings?"** Indirectly but meaningfully. TTFB is the floor under your LCP, and LCP is a Core Web Vital. Beyond that, Googlebot adjusts crawl rate to what your server comfortably handles; a snappy origin gets crawled more thoroughly, which matters for big sites and fast-moving content. And there's the boring commercial truth: every study on the subject finds slower responses correlate with higher bounce rates. The ranking effect is real but modest; the revenue effect is usually bigger.

**"Cloudflare made my TTFB worse. Why?"** Because a proxy adds a hop. If Cloudflare isn't actually caching your HTML (the default: it caches static assets only), every page request travels visitor to edge to your origin and back, which can add latency over hitting the origin directly. The fix isn't removing the CDN; it's making it earn its place with HTML edge caching via APO or cache rules. A CDN that only caches your logo is a very elaborate way to slow down your pages slightly.

Get TTFB right once and it mostly stays right, barring plugin accidents. It's the least glamorous metric on the report and the one I'd fix first on almost any site.

Get TTFB to 300ms and everything downstream gets easier: LCP budgets open up, crawlers fetch more pages per visit, and the site just *feels* solid in a way visitors notice but can't name. Foundations first.
`,
  },
];
