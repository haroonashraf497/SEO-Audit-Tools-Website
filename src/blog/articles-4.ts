import type { BlogArticle } from './types';

export const articlesGoogleIndexing: BlogArticle[] = [
  {
    slug: 'google-not-indexing-pages',
    title: '\u201CDiscovered \u2013 Currently Not Indexed\u201D: Why Google Ignores Your Pages',
    metaTitle: 'Fix "Discovered - Currently Not Indexed" in Search Console | SEO Audit Pro',
    metaDescription: 'Google found your pages and chose not to index them. It\u2019s the most frustrating status in Search Console. Here\u2019s what it really means and the fixes that work.',
    keywords: ['discovered currently not indexed', 'Google indexing issues', 'crawled not indexed', 'Search Console', 'crawl budget'],
    category: 'Google & Indexing',
    date: '2025-01-22',
    readTime: '7 min read',
    author: 'SEO Audit Pro Team',
    excerpt: 'Google knows your page exists. It just doesn\u2019t think it\u2019s worth crawling yet. That stings, but it\u2019s fixable once you understand what the status is really telling you.',
    content: `
Few things in SEO sting quite like opening Search Console's Pages report and finding hundreds of URLs sitting under "Discovered - currently not indexed." Google knows those pages exist. It looked at the URL, shrugged, and decided crawling them could wait. Indefinitely, in some cases.

This status has exploded across sites in the past couple of years, and the usual advice ("just request indexing!") barely scratches it. Let's talk about what's actually going on.

## What the status really means

Google separates discovery, crawling, and indexing into distinct stages. "Discovered - currently not indexed" means stage one happened (Google found the URL, probably in your sitemap or a link) but stage two hasn't: Googlebot hasn't fetched the page yet.

Its close cousin, "Crawled - currently not indexed," means Google did fetch the page, read it, and still declined to add it to the index. Different problem, related causes.

Either way, Google is making a value judgment. Crawling costs Google money, the web is functionally infinite, and its systems constantly predict whether fetching a given URL is likely worth it. When your pages pile up in these buckets, the prediction machine is saying: based on what we know about this site, these URLs probably don't add much.

Harsh. Also useful, once you treat it as feedback instead of a bug.

## The real causes, ranked by how often I see them

**1. Thin or templated content at scale.** Sites that generate thousands of near-identical pages (location pages with swapped city names, tag archives, filtered category combinations, auto-generated content) train Google to expect low value per crawl. Once that expectation sets in, even your good new pages inherit the skepticism.

**2. Weak internal linking.** A page that's only reachable through the sitemap, with zero contextual links from real pages, looks unimportant. Google reasons about your site partly through your own link graph. If *you* don't link to a page, why would Google prioritize it?

**3. Site-wide quality or trust deficits.** New domains with no reputation, sites recovering from spammy history, or sites where the indexed-to-valuable ratio is poor. Indexing rates are increasingly a site-level trust signal playing out URL by URL.

**4. Server health during crawl attempts.** If your host responds slowly or throws 5xx errors when Googlebot visits, Google backs off politely and your crawl capacity shrinks. Check the Crawl Stats report (Settings, Crawl stats) for response-time spikes and error rates. People forget this report exists; it's a goldmine.

**5. Genuine crawl budget limits.** Mostly a large-site problem (hundreds of thousands of URLs). Small sites with indexing trouble almost never have a budget problem; they have a quality-perception problem. Worth saying twice, because "crawl budget" gets blamed for everything.

## What actually works

**Cut the dead weight first.** This is counterintuitive and it's the most effective move: *reduce* the number of URLs you're asking Google to index. Noindex the tag archives, the filtered duplicates, the placeholder pages, the 40 thin posts from 2019 nobody visits. Consolidate overlapping articles into one strong page with redirects. When the ratio of quality-to-junk in your sitemap improves, Google's per-crawl payoff improves, and its appetite for your remaining URLs visibly increases. I've watched stuck sites start indexing normally within weeks of a ruthless pruning.

**Build internal links to stranded pages.** For every important unindexed URL, add contextual links from your strongest indexed pages: the homepage, top category hubs, high-traffic posts. Not a footer link dump; real in-content links with descriptive anchors. This is the single fastest legitimate signal that a page matters.

**Fix what the Crawl Stats report shows.** Average response time creeping past 600ms or error spikes during crawls? Address hosting and caching before anything else. A faster, more reliable origin measurably increases pages crawled per day.

**Keep the sitemap honest.** Only canonical, indexable, 200-status URLs. Every redirect, 404 and noindexed page in there erodes trust in the file. Update lastmod truthfully when content changes, and don't fake it: Google has said it ignores lastmod from sites that lie about it.

**Use Request Indexing sparingly, for what it is.** It nudges a single URL into the crawl queue. Fine for your important new page; useless as a strategy for 500 URLs, and it does nothing about the underlying judgment.

## What doesn't work

Resubmitting the same sitemap daily. Pinging services. Indexing APIs used off-label (the official Indexing API is meant for job postings and livestream pages; bulk-abusing it for regular content has been publicly discouraged and increasingly filtered). Deleting and re-adding the property. Adding more thin pages to "give Google more to find," which is like curing a hangover with breakfast whiskey.

## Three follow-up questions, answered honestly

**How long should I wait before worrying?** For a new page on an established, healthy site: a few days to two weeks is normal. For a new domain: weeks, sometimes a couple of months, while trust builds. Worry becomes justified when *important* pages sit unindexed past a month despite good internal links, or when your indexed-page count trends steadily down without you deleting anything. Trends matter more than snapshots here.

**Does posting to social media or getting the page shared help?** Links from crawled pages anywhere on the web can speed up discovery, and a link from a genuinely popular page absolutely gets Google's attention. But discovery was never your problem with this status; Google already found the URL. What external signals really contribute is evidence of value, and one decent editorial link outweighs a hundred social shares for that purpose.

**Should I delete pages stuck in "crawled - currently not indexed"?** Not reflexively. First decide what each page is for. If it exists for users arriving from other channels (support docs, campaign landing pages), it's fine unindexed; leave it alone or noindex it deliberately. If it was supposed to earn search traffic and Google passed on it, treat that as a review: the page probably needs to be meaningfully better or merged into something stronger, not just resubmitted with crossed fingers.

## A note on patience and expectations

Some pages will never be indexed, and honestly, some shouldn't be. Google's index is no longer a completionist archive of everything on the web; it's curated by predicted usefulness. The practical goal isn't 100% indexation. It's making sure the pages that matter to your business are indexed fast and reliably, which follows from a site where most crawlable URLs genuinely deserve the visit.

Prune hard, link deliberately, keep the server quick, and give it four to eight weeks. That combination resolves the majority of stuck-indexing cases I encounter, without a single trick involved.
`,
  },
  {
    slug: 'mobile-first-indexing-issues',
    title: 'Mobile-First Indexing Problems That Are Costing You Rankings',
    metaTitle: 'Mobile-First Indexing Issues & Fixes: Complete Guide | SEO Audit Pro',
    metaDescription: 'Google now indexes exclusively with a mobile crawler. If your mobile page hides content, blocks resources, or lags, your rankings pay for it. Find and fix the gaps.',
    keywords: ['mobile-first indexing', 'mobile SEO', 'mobile usability', 'responsive design SEO', 'mobile rankings'],
    category: 'Google & Indexing',
    date: '2025-01-10',
    readTime: '6 min read',
    author: 'SEO Audit Pro Team',
    excerpt: 'Googlebot is a phone now. Full stop. Whatever your mobile visitors can\u2019t see, Google can\u2019t rank, and plenty of "responsive" sites still hide half their value on small screens.',
    content: `
Mobile-first indexing finished rolling out years ago, and since mid-2024 Google crawls essentially everything with the smartphone version of Googlebot. Not desktop first with a mobile check. Mobile, period. Whatever exists on your mobile page is your page as far as ranking goes.

Most site owners nod along at this and assume "we're responsive, we're fine." Then you actually compare their desktop and mobile output, and things get interesting. Content hidden on mobile "for cleanliness." Structured data present on one version only. Half the internal links gone because the mega-menu became a hamburger with three items.

If rankings dipped and you never connected it to mobile parity, this is the audit worth doing.

## The parity problem, concretely

Google's guidance is blunt: the mobile version should contain the same content as desktop if you want to rank on it. Yet these gaps show up constantly:

**Trimmed content.** A designer decides the 800-word category description "clutters" mobile and hides it with display:none via a mobile-only rule, or worse, removes it from the mobile DOM entirely. If it's absent from the DOM on mobile, it doesn't exist for indexing. (Content in accordions and tabs that *is* in the DOM is fine, and Google has confirmed collapsed content is fully weighted on mobile. The distinction is DOM presence, not visual visibility.)

**Fewer internal links.** Desktop nav: forty links across menus and footer. Mobile nav: a hamburger with six. Multiply across every page and you've rewired the site's entire link graph for Googlebot. Anchor text disappears, deep sections lose discoverability, and crawl paths shrink.

**Missing structured data.** Schema added by a desktop-oriented template or widget that mobile templates never got. Rich results quietly vanish.

**Different or missing meta tags.** Separate mobile templates (especially legacy m-dot subdomains, which genuinely still exist) drifting out of sync on titles, canonicals, robots meta, hreflang.

**Blocked resources.** Mobile CSS or JS files disallowed in robots.txt, leaving Googlebot rendering a broken version of the page and judging you on it.

## How to actually check

Skip assumptions; compare outputs.

**URL Inspection in Search Console** is the ground truth. Inspect a key page, view the crawled page's rendered HTML, and read what mobile Googlebot actually saw. Search for a sentence you expect to be there. This five-minute check has ended a lot of long debugging sessions.

**Crawl your site twice** with Screaming Frog: once with a desktop user-agent, once with the mobile one, then diff word counts, link counts, titles, and schema per URL. The gaps line themselves up in a spreadsheet.

**Hands on a real phone**, not just a shrunken browser window. Load your top templates. Is the main content there? Do tabs and accordions contain their text in the source? Does anything important require a hover that can't happen on touch?

## Usability signals that pile on

Beyond parity, mobile experience issues compound the damage:

- **Tap targets too small or too close.** Links stacked 20 pixels apart cause misclicks and fail usability checks. Give interactive elements roughly 48px of touch room.
- **Text requiring zoom.** Base font under 16px on mobile is a strain and a signal.
- **Content wider than the viewport.** One oversized table or unconstrained image forces horizontal scrolling; a single CSS line (max-width:100%) usually cures it.
- **Intrusive interstitials.** Full-screen popups on entry from search have carried an explicit penalty risk since 2017 and, more importantly, they torch conversions. Cookie consent handled properly is exempt; the newsletter takeover before the visitor reads a single sentence is not.
- **Mobile Core Web Vitals.** Field data is reported per device class, and mobile is where sites fail. Passing on desktop while failing on mobile is the norm, not the exception, because mobile hardware and networks are less forgiving of heavy JavaScript. Your mobile INP is the honest one.

## Fixing it without a redesign

Responsive design with a single shared DOM remains the safest architecture: one HTML for everyone, CSS deciding presentation. If that's you, most parity issues trace to overzealous display:none pruning and diverging menus, both fixable in templates within days.

Practical sequence:

- Restore any substantive content that mobile templates dropped; use accordions if space is the concern, since collapsed-but-present is perfectly fine
- Rebuild mobile navigation to carry your important internal links, even if grouped into expandable sections
- Sync structured data and meta tags across breakpoints (audit with the Rich Results Test using its mobile crawler setting)
- Unblock all CSS and JS in robots.txt
- If you still run an m-dot subdomain in 2025, prioritize migrating to responsive; maintaining parity across two codebases is a tax you'll pay forever

## Quick answers before you go

**Is desktop dead for SEO then?** No. Google still serves desktop results and desktop experience still matters to desktop users, especially in B2B where it can be most of the revenue. Mobile-first indexing is about which version Google *reads*, not which users matter. The practical rule: rank from your mobile content, convert on whatever device shows up.

**Do separate AMP pages help anymore?** AMP lost its special treatment in Top Stories back in 2021 and the ecosystem has been winding down since. If you're maintaining AMP purely for SEO in 2025, you're maintaining a second codebase for a bonus that no longer exists. A fast responsive page does everything AMP promised.

**My content is inside tabs on mobile. Am I losing rankings?** If the text is present in the HTML and merely hidden until tapped, no. Google has been explicit that content in collapsed sections on mobile gets full weight. The danger is only when tab content loads via a separate request after a click, because then it's absent from the page Googlebot renders. View source; if you can find the text, so can Google.

Still on the fence about whether this matters? Pull your Search Console performance report and segment by device. For most sites, mobile is 60 to 75% of impressions. That's not a secondary audience receiving a secondary experience. That's the primary judge seeing your site the only way it ever will.
`,
  },
  {
    slug: 'recover-google-core-update',
    title: 'Surviving Google Core Updates: What to Do When Your Traffic Tanks',
    metaTitle: 'Google Core Update Recovery: A Realistic Action Plan | SEO Audit Pro',
    metaDescription: 'Traffic dropped 40% overnight after a Google core update? Here\u2019s a realistic recovery framework: how to diagnose the hit, what to fix, and what timeline to expect.',
    keywords: ['Google core update', 'traffic drop recovery', 'algorithm update', 'helpful content', 'SEO recovery'],
    category: 'Google & Indexing',
    date: '2024-12-15',
    readTime: '7 min read',
    author: 'SEO Audit Pro Team',
    excerpt: 'A core update hit and your charts fell off a cliff. Before you panic-delete half your site or buy a "recovery service," read this. Recovery is real, but it doesn\u2019t work how most people think.',
    content: `
It usually starts with a Slack message: "Is something wrong with analytics?" Nothing is wrong with analytics. A Google core update rolled out, and organic traffic just stepped down 30, 40, sometimes 60 percent within a week. No manual action. No warning. No specific page to blame, because everything fell a little and some things fell a lot.

I've sat with enough site owners through this moment to know the emotional arc: shock, then furious Googling, then the temptation to do something drastic tonight. So let's replace panic with a process.

## First, confirm it was actually the update

Serious diagnosis starts with boring verification. Check the dates: Google announces core updates on its Search Status Dashboard, and rollouts take up to a couple of weeks. Does your decline align with the rollout window, or did it start earlier (suggesting a technical issue, a season, or a lost feature like a top story slot)?

Then segment before concluding anything:

- **By page type** in Search Console: did blog content drop while product pages held? That's information.
- **By query type**: informational queries hit harder than branded ones is the classic core-update signature. If branded search fell too, look for technical problems instead.
- **Against competitors**: check a handful of rival sites in a visibility tool. If your whole niche reshuffled, you're in an ecosystem event, not a personal one. Sometimes you even find you lost less than the sites you envy.

And rule out coincidences: a migration, a redesign, robots.txt changes, a CMP update blocking rendering. Core updates get blamed for a lot of self-inflicted wounds that happened the same week.

## What a core-update drop actually means

Google's own framing is worth taking literally: core updates don't target sites, they *reassess* the whole web. Content that fell isn't flagged as bad; other content is now judged to deserve those positions more, under a refreshed definition of quality and relevance.

Which is why there's no penalty to remove, no reconsideration request to file, and no single fix. The system re-scored relevance and trust, and your site landed lower under the new scoring. Recovery means genuinely scoring better, then waiting for a future update to re-evaluate you at scale. Google has been fairly consistent about that last part: meaningful recoveries tend to register around subsequent core updates, months later, not days after you fix things.

That timeline is the hardest pill. Anyone selling you a 30-day core update recovery is selling you weather control.

## The honest audit

With diagnosis done, audit the site the way a skeptical stranger would. Recent updates have been unusually consistent about what they reward and punish, so aim your questions there:

**Is a meaningful share of your content written for rankings rather than readers?** The tells: articles targeting every keyword variation with interchangeable 1,500-word answers, topics far outside your lane chased for traffic, intros that restate the question for three paragraphs, roundups of products nobody at the company touched. Sites built heavily on this pattern, including AI-scaled versions of it, were exactly the profile hit hardest through 2023 and 2024.

**Would anyone recognize you as a source?** Real author names with real credentials, first-hand evidence in reviews (your own photos, your own measurements), an about page that proves humans, and expertise concentrated on topics you plausibly know. This whole cluster, call it E-E-A-T if you like, isn't a checklist item; it's the aggregate impression your site leaves.

**Does your experience quietly annoy people?** Ad density that buries the answer, aggressive interstitials, autoplay, content split across pages for pageviews. Google says helpfulness; users say friction. Same thing.

**Is there dead weight?** Hundreds of thin, outdated, zero-traffic pages dilute the site-level quality picture. The pruning playbook (consolidate, improve, or noindex) applies here just as it does to indexing problems.

## The recovery plan, sequenced

- **Weeks 1-2:** Diagnose and segment as above. Freeze drastic moves. Do not delete half the site in a weekend rage.
- **Month 1:** Fix the worst experience issues (ads, popups, speed) and rewrite or consolidate your ten most important declining pages, adding genuine firsthand value that competitors lack. Compare hits, er, compare *your* page honestly against the pages now outranking it and note what they do better. Usually something is visibly better: specificity, evidence, freshness, focus.
- **Months 2-4:** Work through the content inventory tier by tier. Strengthen author and trust signals sitewide. Keep publishing, but only within topics where you have real standing; breadth without authority is what got many sites here.
- **Ongoing:** Track rankings weekly, not hourly. Note the next core update's dates and watch your trajectory around it.

## What not to do

Don't chase the update with tricks: swapping dates to fake freshness, mass "optimizing" with the same AI that wrote the problem, buying links to "boost authority." Don't panic-migrate domains; the assessment follows the content. And be wary of survivor-bias case studies: for every "we recovered with this one change" thread, hundreds of sites made the same change and stayed flat.

## Questions from the trenches

**"Traffic dropped but rankings look stable. What gives?"** Check *where* you're ranking, not just position. AI Overviews, featured snippets and bigger ad blocks push classic blue links further down, so position four today can receive half the clicks position four earned two years ago. Compare click-through rate by query in Search Console over time. Sometimes the update didn't move you; it moved the page layout around you. The response is different too: win the snippet, strengthen brand search, diversify beyond queries that AI now answers directly.

**"Should I disavow links after a core update?"** Almost certainly not. Core updates aren't link penalties, and Google has repeatedly said most sites shouldn't touch the disavow tool. Disavowing after a core update is a ritual sacrifice: it feels decisive and does nothing. Spend those hours improving your ten most important pages instead.

**"Part of my site recovered and part didn't. Is that normal?"** Completely, and it's a gift: your own site is now a controlled experiment. Compare the recovered sections against the flat ones honestly: depth, evidence, author credibility, user intent match. Whatever separates them is your roadmap, written in your own data.

The sites I've watched genuinely recover shared one trait: they stopped asking "what does Google want" and started asking "why would a reader choose us." The answers overlapped almost perfectly, which is, in the end, the entire point of core updates. Rebuild toward that, give it the months it honestly takes, and the next reassessment has something real to find.
`,
  },
];
