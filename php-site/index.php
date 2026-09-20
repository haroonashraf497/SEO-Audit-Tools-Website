<?php
/**
 * Homepage — hero audit tool, features, steps, benefits, audiences,
 * tool highlights, blog teasers and CTA. The audit itself runs in
 * assets/js/audit.js (live fetch + RDAP domain data).
 */
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/icons.php';

$PAGE_TITLE = $SEO['home']['title'] ?? 'SEO Audit Tool - Free Comprehensive SEO Analysis Tool';
$PAGE_DESC  = $SEO['home']['description'] ?? '';
$ACTIVE = 'home';
$live = live_tools();
$posts = live_posts();
include __DIR__ . '/includes/header.php';

$HIGHLIGHT_SLUGS = ['plagiarism-checker', 'percentage-calculator', 'bmi-calculator', 'what-is-my-ip', 'keyword-density-checker', 'backlink-checker', 'unit-converter', 'website-seo-score-checker'];

$FEATURES = [
  ['On-Page SEO Analysis', 'Checks title tags, meta descriptions, heading structure (H1-H6), keyword usage, image alt attributes, internal linking, and canonical tags.'],
  ['Technical SEO Audit', 'Deep analysis of crawlability, XML sitemap validity, robots.txt configuration, URL structures, redirect chains, 404 errors, and schema markup.'],
  ['Mobile-Friendliness Check', 'Tests your site across common device screen sizes and flags usability issues that could hurt your mobile rankings.'],
  ['HTTPS & Security Audit', 'Verifies SSL certificate validity, HTTPS redirect configuration, HSTS headers, and mixed content warnings.'],
  ['Page Speed Analysis', 'Measures Core Web Vitals including LCP, FID, CLS, and provides actionable recommendations for improvement.'],
  ['PDF Report Generation', 'Download detailed reports in PDF format to share with your team or clients with clear, prioritized recommendations.'],
];
$STEPS = [
  ['Enter Your URL', 'Paste your website link. We accept all domains including .co.uk, .com, .org'],
  ['We Crawl Your Site', 'Our servers scan pages, checking over 100 on-page and technical SEO factors'],
  ['Instant SEO Score', 'Get your total score instantly plus detailed breakdown of every key element'],
  ['Download PDF Report', 'Save your complete report and follow clear tips to fix problems'],
];
$BENEFITS = [
  'Identify technical issues affecting rankings',
  'Discover content optimization opportunities',
  'Stay ahead of competitors',
  'Meet latest Google algorithm requirements',
  'Improve user experience and conversions',
];
$AUDIENCES = [
  ['Small Business Owners', 'Improve local search visibility and attract more customers online.', 'globe'],
  ['Digital Marketing Agencies', 'Fast, reliable way to audit client websites and deliver professional reports.', 'chart'],
  ['Bloggers & Content Creators', 'Ensure your content is properly optimized for search engines.', 'file'],
  ['Web Developers', 'Identify and fix technical SEO issues before launching new websites.', 'code'],
  ['E-commerce Businesses', 'Improve product page visibility and attract more customers.', 'trending'],
  ['SEO Professionals', 'Comprehensive analysis tool for detailed website audits.', 'target'],
];
$STATS = [
  ['Websites Audited', '50K+'], ['Issues Found', '2M+'], ['Happy Users', '10K+'], ['Reports Generated', '100K+'],
];
?>

<!-- Hero -->
<section class="hero">
  <span class="hero-badge">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
    Trusted by 10,000+ websites
  </span>
  <h1 class="h1">Free <span class="grad-text">SEO Audit Tool</span></h1>
  <p class="hero-sub">Analyze your website's SEO performance with our comprehensive audit tool.
    Get instant insights, actionable recommendations, and downloadable reports.</p>

  <form id="audit-form" class="audit-form" role="search">
    <input id="audit-url" class="input" type="text" inputmode="url" autocomplete="url"
           placeholder="Enter your website URL (e.g., https://example.com)" aria-label="Website URL" required>
    <button id="audit-button" class="btn btn-primary btn-lg" type="submit">Analyze</button>
  </form>

  <div id="audit-progress" class="progress-track" hidden>
    <div id="audit-progress-fill" class="progress-fill" style="width:0"></div>
  </div>
  <p id="audit-progress-label" class="small muted mt-2" hidden></p>
</section>

<!-- Results mount (audit.js renders here) -->
<section id="audit-results" class="section" style="padding-top:0" hidden></section>

<!-- Features -->
<section id="features" class="section">
  <div class="container">
    <header class="text-center mb-8">
      <h2 class="h1" style="font-size:clamp(1.6rem,3vw,2.4rem)">Everything You Need for Complete SEO Analysis</h2>
      <p class="lead mt-2">Our comprehensive tool checks over 100 SEO factors to give you a complete picture of your website's health.</p>
    </header>
    <div class="grid grid-3">
      <?php foreach ($FEATURES as $f): ?>
        <article class="card">
          <div class="feature-icon" style="background:var(--grad-br);color:#fff">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
          <h3 class="h3" style="margin-top:0"><?= e($f[0]) ?></h3>
          <p class="muted small"><?= e($f[1]) ?></p>
        </article>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- How It Works -->
<section id="how-it-works" class="section section-white">
  <div class="container">
    <header class="text-center mb-8">
      <h2 class="h1" style="font-size:clamp(1.6rem,3vw,2.4rem)">Get Your SEO Audit in 4 Simple Steps</h2>
      <p class="lead mt-2">Our SEO audit tools make running a complete analysis fast, effortless, and free.</p>
    </header>
    <div class="grid grid-4">
      <?php foreach ($STEPS as $i => $s): ?>
        <article class="text-center">
          <div class="step-num" style="margin:0 auto .75rem"><?= $i + 1 ?></div>
          <h3 class="h3" style="margin-top:0"><?= e($s[0]) ?></h3>
          <p class="muted small"><?= e($s[1]) ?></p>
        </article>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- Why SEO Audit -->
<section class="section">
  <div class="container">
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:var(--radius-2xl);padding:clamp(1.5rem,4vw,3rem);color:#fff">
      <div class="grid grid-2">
        <div>
          <h2 class="h1" style="font-size:clamp(1.6rem,3vw,2.2rem);color:#fff">Why Is an SEO Audit Important?</h2>
          <p style="color:#cbd5e1;margin:1.25rem 0">Without a proper SEO audit, it's difficult to know why your website isn't ranking well in Google search results.
            An SEO audit uncovers hidden technical issues, content gaps, and on-page errors that may be holding your website back.</p>
          <ul class="page-list">
            <?php foreach ($BENEFITS as $b): ?>
              <li style="color:#e2e8f0;display:flex;gap:.6rem;align-items:flex-start">
                <svg style="flex-shrink:0;margin-top:.3rem" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                <span><?= e($b) ?></span>
              </li>
            <?php endforeach; ?>
          </ul>
        </div>
        <div class="grid grid-2">
          <?php foreach ($STATS as $s): ?>
            <div class="stat" style="background:rgba(255,255,255,.1);border-radius:var(--radius-2xl)">
              <p class="stat-value"><?= e($s[1]) ?></p>
              <p class="stat-label" style="color:#94a3b8"><?= e($s[0]) ?></p>
            </div>
          <?php endforeach; ?>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Audiences -->
<section id="audiences" class="section section-white">
  <div class="container">
    <header class="text-center mb-8">
      <h2 class="h1" style="font-size:clamp(1.6rem,3vw,2.4rem)">Who Can Benefit from Our SEO Audit Tool?</h2>
      <p class="lead mt-2">Our tool is designed for everyone from beginners to SEO professionals.</p>
    </header>
    <div class="grid grid-3">
      <?php foreach ($AUDIENCES as $a): ?>
        <article class="card" style="background:var(--slate-50)">
          <div class="feature-icon" style="background:var(--grad-br);color:#fff"><?= audience_icon_svg($a[2]) ?></div>
          <h3 class="h3" style="margin-top:0"><?= e($a[0]) ?></h3>
          <p class="muted small"><?= e($a[1]) ?></p>
        </article>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- Free SEO Tools -->
<section class="section">
  <div class="container">
    <header class="text-center mb-8">
      <h2 class="h1" style="font-size:clamp(1.6rem,3vw,2.4rem)"><?= count($live) ?>+ Free <span class="grad-text">SEO Tools</span></h2>
      <p class="lead mt-2">A complete toolkit in one place: text analysis, keyword research, backlink checks,
        domain lookups and website management. Most run instantly, right in your browser.</p>
    </header>

    <div class="grid grid-4 mb-8">
      <?php
      $bySlug = [];
      foreach ($live as $t) { $bySlug[$t['slug']] = $t; }
      foreach ($HIGHLIGHT_SLUGS as $slug):
        if (!isset($bySlug[$slug])) continue;
        $t = $bySlug[$slug]; ?>
        <a class="tool-card" href="<?= url('tool/' . $t['slug']) ?>">
          <span class="tool-icon tool-icon-<?= e($t['category']) ?>"><?= tool_icon_svg($t['category']) ?></span>
          <h3><?= e($t['name']) ?></h3>
          <p><?= e($t['description']) ?></p>
        </a>
      <?php endforeach; ?>
    </div>

    <div class="grid grid-4">
      <?php foreach ($CATEGORY_ORDER as $cat):
        if ($cat === 'image') continue;
        $count = count(tools_in_category($cat)); ?>
        <a class="card flex-between" href="<?= url('tools') ?>" style="padding:1rem 1.25rem">
          <span class="flex" style="gap:.6rem">
            <span style="color:var(--indigo-600)"><?= tool_icon_svg($cat) ?></span>
            <span style="font-weight:600;font-size:.875rem"><?= e($CATEGORIES[$cat] ?? $cat) ?></span>
          </span>
          <span class="small muted"><?= $count ?> tools</span>
        </a>
      <?php endforeach; ?>
    </div>

    <div class="text-center mt-8">
      <a class="btn btn-primary btn-lg" href="<?= url('tools') ?>">Explore All <?= count($live) ?> Free Tools</a>
    </div>
  </div>
</section>

<!-- From the Blog -->
<?php if (count($posts) > 0): ?>
<section class="section section-white">
  <div class="container">
    <header class="text-center mb-8">
      <h2 class="h1" style="font-size:clamp(1.6rem,3vw,2.4rem)">From the Blog</h2>
      <p class="lead mt-2">Practical guides on the SEO problems people are actually struggling with right now.</p>
    </header>
    <div class="grid grid-3">
      <?php foreach (array_slice($posts, 0, 3) as $post): ?>
        <article class="card">
          <p class="eyebrow"><?= e($post['category'] ?? 'SEO') ?></p>
          <h3 class="h3" style="margin-top:0"><a href="<?= url('blog/' . $post['slug']) ?>"><?= e($post['title']) ?></a></h3>
          <p class="muted small"><?= e($post['excerpt']) ?></p>
          <p class="small muted mt-4"><?= e($post['date']) ?> &middot; <?= e($post['readTime'] ?? '5 min read') ?></p>
        </article>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<!-- CTA -->
<section id="cta" class="section">
  <div class="container text-center" style="max-width:56rem">
    <h2 class="h1" style="font-size:clamp(1.6rem,3vw,2.4rem)">Ready to Improve Your Website's SEO?</h2>
    <p class="lead mt-2 mb-8">Don't let SEO issues slow down your website's growth. Start your free audit today and
      take the first step towards better search engine rankings.</p>
    <div class="flex" style="justify-content:center">
      <a class="btn btn-primary btn-lg" href="<?= url('home') ?>">Start Free Audit
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </a>
      <a class="btn btn-ghost btn-lg" href="#features">View Sample Report</a>
    </div>
  </div>
</section>

<script src="/assets/js/audit.js"></script>
<?php include __DIR__ . '/includes/footer.php'; ?>
