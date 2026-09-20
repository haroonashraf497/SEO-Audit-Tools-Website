import type { BlogArticle } from './types';

export const articlesCoreWebVitals: BlogArticle[] = [
  {
    slug: 'inp-core-web-vital-fix',
    title: 'INP Is the Core Web Vital Nobody Prepared For (Here\u2019s How to Fix It)',
    metaTitle: 'How to Fix INP (Interaction to Next Paint) in 2025 | SEO Audit Pro',
    metaDescription: 'INP replaced FID as a Core Web Vital in March 2024 and thousands of sites failed overnight. Learn what Interaction to Next Paint measures and how to get under 200ms.',
    keywords: ['INP', 'Interaction to Next Paint', 'Core Web Vitals', 'fix INP', 'INP optimization'],
    category: 'Core Web Vitals',
    date: '2025-01-14',
    readTime: '6 min read',
    author: 'SEO Audit Pro Team',
    excerpt: 'When Google swapped FID for INP in March 2024, sites that passed Core Web Vitals for years suddenly started failing. Here\u2019s why, and what you can actually do about it.',
    content: `
On March 12, 2024, Google quietly pulled off one of the biggest shake-ups in Core Web Vitals history. First Input Delay (FID) was retired, and Interaction to Next Paint (INP) took its place. Sites that had passed Core Web Vitals for years woke up failing. If that happened to you, you're in good company. Industry crawls at the time suggested that a large share of sites passing FID did not pass INP.

The frustrating part? Most site owners had no idea why. Their pages looked the same. Nothing had changed in the code. And yet Search Console started flagging URLs left and right.

## What INP actually measures (and why FID was too easy)

FID only measured one thing: the delay before the browser could *start* processing your very first interaction. That's it. It ignored everything after the first click, and it ignored how long the actual work took. Almost everyone passed. It was a bit like a driving test that only checked whether you could open the car door.

INP is much tougher. It watches every click, tap, and keypress during the entire page visit, measures how long each one takes from input to the next visual update, and then reports roughly the worst one. So if your menu opens instantly but your "Add to Cart" button freezes the page for 800ms, INP catches it. FID never did.

The thresholds are strict:

- **Good:** 200 milliseconds or less
- **Needs improvement:** between 200ms and 500ms
- **Poor:** over 500ms

And remember, this is measured at the 75th percentile of real users. Your fast laptop on office wifi doesn't count for much. The metric cares about a mid-range Android phone on a spotty connection.

## The usual suspects behind bad INP

After auditing hundreds of sites, the same culprits show up again and again.

**Long JavaScript tasks.** The browser's main thread can only do one thing at a time. If a script runs for 400ms without a break, any tap during that window just sits there waiting. Analytics bundles, A/B testing tools, and tag managers are repeat offenders.

**Heavy event handlers.** A click handler that recalculates the whole cart, updates the DOM in ten places, and fires three tracking pixels before the browser can paint? That's your INP score right there.

**Third-party scripts.** Chat widgets, session recorders, ad scripts. Every one of them competes for the same main thread as your buttons.

**Rendering too much at once.** Frameworks re-rendering giant component trees on a single state change is a modern classic. React devs, look at your context providers.

## How to actually fix it

Start by finding your slow interactions instead of guessing. Chrome DevTools has a Performance panel with an interactions track. Even easier: install the official Web Vitals extension, turn on console logging, and click around your page like a normal user. It will print every interaction and its duration.

Once you know which interactions hurt, work through these:

**1. Break up long tasks.** Anything over 50ms blocks interactions. Split big loops and heavy functions with scheduler.yield() or a setTimeout of zero so the browser can squeeze in pending input between chunks.

**2. Give visual feedback first, work later.** When a user taps a button, change its state immediately, then do the expensive stuff. Users judge responsiveness by paint, not completion. A spinner that appears in 50ms feels faster than a result that appears in 400ms with nothing in between.

**3. Debounce what happens on input.** Search-as-you-type fields firing an API call and re-render on every keystroke are INP poison. Wait for a pause in typing.

**4. Audit your third parties ruthlessly.** Load a copy of your page with the tag manager blocked and measure again. The difference is often shocking. Delay non-essential scripts until after the first interaction, or load them in a web worker with a tool like Partytown.

**5. Reduce DOM size.** Pages with 5,000+ DOM nodes make every style recalculation slower, which drags out every interaction. Prune what you don't need, and virtualize long lists.

## Don't obsess over lab scores here

One thing that trips people up: Lighthouse alone can't fully measure INP because a lab run doesn't click anything by default. Your PageSpeed Insights *lab* section shows Total Blocking Time (TBT) as a proxy. The INP number you should trust lives in the *field data* at the top of the report, pulled from the Chrome UX Report, and it needs 28 days of real traffic to update.

So when you ship a fix, don't panic that Search Console still shows failing URLs the next morning. The window moves slowly. Track your TBT in the lab as an early signal, watch field INP over the following month, and use the "Validate fix" button in Search Console once your real-user numbers cross under 200ms.

## Questions I keep getting about INP

**Does INP affect rankings directly?** Core Web Vitals are part of Google's page experience signals, and INP is one of the three vitals. It's a tiebreaker more than a dominator: brilliant content with poor INP will still often outrank thin content with great INP. But in competitive niches where everyone's content is decent, experience metrics start deciding who gets the click. And the indirect effect is bigger anyway: sluggish interactions increase abandonment, and lost engagement costs more than any ranking wobble.

**My INP is fine on desktop but fails on mobile. Why?** Because mobile CPUs are slower and your JavaScript takes two to four times longer to execute on a mid-range phone. Same code, weaker hardware. This is normal and it's why you should always debug with CPU throttling turned on in DevTools, four times slowdown at minimum.

**Can a cache plugin or CDN fix INP?** No, and this surprises people. Caching fixes server response time and helps LCP. INP happens after the page has loaded, inside the visitor's browser, while your JavaScript runs. The fix is always about doing less work on the main thread at interaction time. No amount of edge caching changes what executes on the device.

**What's a realistic target?** Under 200ms at the 75th percentile to pass. If you're starting from 500ms or worse, aim for staged wins: get under 400ms first by removing the worst third-party scripts, then chase the long tasks in your own bundle. Sites rarely jump from poor to good in one release, and that's fine.

## The honest takeaway

INP forced a reckoning that was overdue. For years, sites shipped megabytes of JavaScript and passed Core Web Vitals anyway because FID was so forgiving. That loophole is closed.

The good news is that INP fixes tend to be felt by real people. Faster menus, snappier carts, forms that respond instantly. You're not gaming a metric; you're removing friction that was quietly costing you conversions all along. Start with your worst interaction, fix it, and move to the next. Most sites can get under 200ms with a focused week of work.
`,
  },
  {
    slug: 'fix-largest-contentful-paint',
    title: 'How to Actually Fix Largest Contentful Paint (LCP) in 2025',
    metaTitle: 'Fix Largest Contentful Paint (LCP): Practical Guide | SEO Audit Pro',
    metaDescription: 'LCP under 2.5 seconds is the target, yet most sites miss it. A practical, no-fluff guide to diagnosing and fixing slow LCP: images, TTFB, render delay and more.',
    keywords: ['LCP', 'Largest Contentful Paint', 'fix LCP', 'Core Web Vitals', 'page speed'],
    category: 'Core Web Vitals',
    date: '2025-01-08',
    readTime: '7 min read',
    author: 'SEO Audit Pro Team',
    excerpt: 'Everyone tells you to "optimize images" and calls it a day. Real LCP fixes go deeper. Here\u2019s the diagnostic process we use on actual client sites.',
    content: `
Largest Contentful Paint measures one simple thing: how long it takes for the biggest visible element on your page to render. Usually that's a hero image, a banner, or a big headline. Google wants it done in 2.5 seconds or less for 75% of your visitors. Anything over 4 seconds is officially "poor."

Simple to define. Weirdly hard to fix. Because "optimize your images" (the advice you'll find in every recycled blog post) is only one piece of a four-part problem.

## LCP is actually four delays stacked on top of each other

This is the mental model that changed how I debug slow pages. Your LCP time breaks down into:

**1. Time to First Byte (TTFB).** How long the server takes to start responding. If your TTFB is 1.8 seconds, you cannot hit a 2.5 second LCP no matter how small your image is. Do the math before touching anything else.

**2. Resource load delay.** The gap between the HTML arriving and the browser *discovering* it needs your LCP image. This is the sneaky one. If your hero image is set as a CSS background, or injected by JavaScript, or lazy-loaded, the browser finds it late. Sometimes very late.

**3. Resource load time.** The actual download. This is where file size, format, and CDN distance matter.

**4. Render delay.** The image has downloaded but something blocks it from painting. Usually a render-blocking stylesheet or a script that's hogging the main thread.

Run your page through PageSpeed Insights and look at the LCP breakdown in the diagnostics. It tells you which of the four phases eats the most time. Fix the biggest one first. Sounds obvious, but almost nobody does it in that order.

## Fixing each phase, in order of what usually helps most

### Get the image discovered early

The single most common LCP mistake I see: the hero image is lazy-loaded. Native loading="lazy" on your LCP element is self-sabotage. The browser deliberately waits. Remove it from anything above the fold.

Then go further and tell the browser this image matters:

- Add fetchpriority="high" directly on the hero img tag
- If the image lives in CSS or comes from JavaScript, add a preload link in the head
- Prefer a plain img tag in the HTML over CSS backgrounds for hero sections. The preload scanner finds it immediately.

That one attribute, fetchpriority, has shaved 300 to 800ms off LCP on sites I've worked on. It costs nothing.

### Shrink the download

Now the classic advice, done properly. Serve modern formats: WebP is safe everywhere, AVIF compresses even better and browser support is now solid. Size the image for the actual display size using srcset, because shipping a 2400px image to a 380px phone screen is just waste. Compress at quality 75 to 82; almost nobody can see the difference, and the savings are big.

And put it on a CDN. Physical distance still matters. A visitor in Sydney pulling your hero from a server in Frankfurt pays a real latency tax on every single asset.

### Attack TTFB

If your server takes over 800ms to respond, that's your project. Common fixes, roughly in order of bang-for-buck:

- Add full-page caching so repeat requests skip your application entirely
- Upgrade hosting. A $4/month shared plan will always be slow under load, no plugin fixes that
- Use a CDN that caches HTML at the edge, not just images
- Cut slow database queries and bloated middleware. On WordPress, one badly written plugin can add a full second

### Clear the render path

Finally, make sure nothing blocks the paint. Inline your critical CSS so above-the-fold styling doesn't wait on a stylesheet download. Add defer to scripts. Kick third-party tags to after load. If you use web fonts for your headline and the headline *is* your LCP element, use font-display: swap so text renders instantly with a fallback.

## A realistic example

A store I audited last year had a 5.1 second LCP. The breakdown: 1.2s TTFB, 1.9s load delay, 1.4s load time, 0.6s render delay. The hero was a CSS background image, so the browser found it only after downloading and parsing the entire stylesheet.

We moved it to an img tag with fetchpriority="high", converted it to AVIF (410KB down to 68KB), and turned on page caching. New LCP: 1.9 seconds. Total dev time was maybe five hours. No redesign, no replatforming.

## Mistakes that undo good LCP work

A few patterns I see on sites that did "everything right" and still sit at 3.5 seconds:

**Preloading too much.** Preload is a priority tool, and priorities only mean something when few things have them. Sites that preload eight fonts, three images and two stylesheets have effectively preloaded nothing while delaying everything else. One or two preloads per page, aimed at the LCP resource and maybe your main font. That's it.

**A cookie banner that becomes the LCP element.** If your consent overlay is the largest thing painted, you're measuring the banner, not the page. Keep it visually modest, or at least make sure the real hero paints before or alongside it.

**Slideshows in the hero.** Carousels often lazy-render every slide including the first, wait for their JavaScript to initialize, then fade in. That whole dance happens after your budget is spent. If slide one matters, render it as plain HTML and let the script enhance it afterward.

**Testing only the homepage.** Your money pages are templates: product pages, category pages, articles. Each template has its own LCP element and its own problems. Pull the slowest templates from Search Console's Core Web Vitals report, grouped by URL pattern, and fix template by template instead of polishing the homepage for the fifth time.

## Measure the right thing

One last warning. Lab tests (Lighthouse) simulate a single throttled load. Field data (the Chrome UX Report numbers at the top of PageSpeed Insights) reflects your actual visitors over the past 28 days. They often disagree, and Google ranks you on the field data. So treat lab runs as a debugging tool, ship your fixes, then give the field numbers a few weeks to catch up before judging the result.

Get under 2.5 seconds and you're not just pleasing an algorithm. You're inside the window where visitors stop noticing the wait at all. That's the actual prize.
`,
  },
  {
    slug: 'fix-cumulative-layout-shift',
    title: 'Cumulative Layout Shift: Why Your Page Jumps Around and How to Stop It',
    metaTitle: 'Fix Cumulative Layout Shift (CLS): Complete Guide | SEO Audit Pro',
    metaDescription: 'Buttons that move as you click, text that jumps mid-read. CLS ruins user experience and rankings. Learn the real causes of layout shift and how to get under 0.1.',
    keywords: ['CLS', 'Cumulative Layout Shift', 'layout shift fix', 'Core Web Vitals', 'web performance'],
    category: 'Core Web Vitals',
    date: '2024-12-19',
    readTime: '6 min read',
    author: 'SEO Audit Pro Team',
    excerpt: 'You go to tap a link and an ad shoves it down the page at the last second. That\u2019s layout shift, Google measures it, and your site probably has more of it than you think.',
    content: `
You know the feeling. You're reading an article on your phone, you go to tap a link, and at the exact moment your thumb lands, an ad loads above it and the whole page lurches. You've just tapped something else entirely. Maybe bought something. Definitely sworn a little.

That's layout shift, and Google measures it with a Core Web Vital called Cumulative Layout Shift (CLS). Unlike LCP and INP, it isn't a time. It's a score that combines how much of the viewport moved and how far it traveled, summed across the worst burst of shifts during the visit. You want 0.1 or less. Above 0.25 is rated poor.

The good news: of the three Core Web Vitals, CLS is usually the easiest to fix. Most shifts come from a small handful of causes, and every one of them has a known cure.

## Cause #1: Images without dimensions

The classic. Your HTML says "here's an image" but doesn't say how big it is. The browser renders the text first, then the image file arrives, and everything below it gets shoved down.

The fix is almost embarrassingly simple: put width and height attributes on every img tag. Modern browsers use them to reserve the right amount of space before the file loads, even in responsive layouts where CSS scales the image. If you're working with CSS instead, aspect-ratio does the same job.

This one habit, applied everywhere, fixes a huge share of real-world CLS on content sites.

## Cause #2: Ads, embeds, and iframes

Ad slots are shift machines. The ad network decides the creative size at auction time, so the container starts at zero height and then explodes to 280px once the ad arrives, pushing your content down with it.

You can't control what the network sends, but you can control the hole it fills. Reserve space with a min-height on the slot container based on the most common ad size you serve. Yes, you'll occasionally show some empty padding when a smaller creative loads. That's a fair trade for a stable page, and it's exactly what Google's own publisher guidance recommends.

Same logic applies to YouTube embeds, social media widgets, and newsletter signup forms injected by JavaScript. If it loads late, box out its space early.

## Cause #3: Web fonts swapping

Your page renders in a fallback font, then your custom font finishes downloading and every line of text reflows because the letters are a different width. Small individual shifts, but they add up, and they happen right while people are reading.

A few layers of defense:

- Preload your main font file so it arrives before first paint
- Use font-display: swap (or optional if you'd rather skip the swap entirely on slow connections)
- Tune the fallback with the newer CSS descriptors size-adjust, ascent-override and descent-override so the fallback occupies nearly identical space
- Or take the easy win: use a system font stack and skip the problem completely. Plenty of fast sites do.

## Cause #4: Content injected above existing content

Cookie banners that push the page down instead of overlaying it. "Related posts" modules that appear mid-article after an API call. Notification bars added at the top after load. Anything inserted above what the user is already looking at will shift everything below.

Rule of thumb: late-arriving UI should either overlay the page (position it fixed or absolute) or slot into space you reserved in advance. Never insert into the flow above the fold after first paint unless the user asked for it by clicking something.

## Cause #5: Animations done wrong

Animating height, top, or margin causes real layout recalculations, and the shifts can count against CLS. Animate transform and opacity instead. They're handled by the compositor, they're smoother, and they don't move anything else on the page.

## How to actually find your shifts

Numbers first: PageSpeed Insights shows your field CLS from real Chrome users. But to find the culprits, open Chrome DevTools, run a Performance recording while the page loads, and look for the layout shift markers. Click each one and DevTools highlights exactly which element moved. There's no guessing involved.

Also test like a real visitor. Throttle the network to slow 4G. On a fast connection everything loads at once and shifts hide; on a slow one they play out in slow motion right in front of you. And scroll. CLS is measured across the whole page lifetime, not just the initial load, so a shifty infinite-scroll feed or a lazy section that pops in without reserved space still counts.

## Edge cases worth knowing about

A few situations trip up people who've already fixed the basics.

**Shifts you cause don't count; shifts you cause *late* do.** Layout changes within 500ms of a user interaction are excluded from CLS, because the user asked for them. Click "load more," content appears, no penalty. But if that content arrives 800ms after the click because your API is slow, the shift counts. Fast responses to interaction aren't just good UX; they're literally scored differently.

**Session windows changed the math.** CLS is measured in windows of shifts (bursts up to five seconds long), and your score is the worst window, not the lifetime sum. So one chaotic moment during load can define your score even if the rest of the visit is stone stable. Find your worst burst in DevTools and concentrate there.

**Fixed banners that "push" on scroll.** Sticky headers that change height as you scroll (shrinking logos, appearing shadows are fine; height changes are not) can generate repeated small shifts across the whole session. Keep sticky element heights constant and animate the inner contents instead.

**Skeleton screens can lie.** Placeholders only prevent shift if they're the same size as what replaces them. A three-line skeleton swapped for eight lines of real text shifts everything below it just the same. Measure your real content and size the bones to match.

## Why this metric deserves more respect than it gets

CLS often gets treated as the boring third vital, but think about what it protects. Misclicks on ads (which can get your ad account flagged, by the way). Lost reading position. That general feeling that a site is janky and untrustworthy. Users can't name the metric, but they absolutely feel it.

Reserve space for everything that loads late. Give images their dimensions. Overlay instead of inject. Do those three things consistently and your CLS problem mostly disappears, usually within a single sprint.
`,
  },
];
