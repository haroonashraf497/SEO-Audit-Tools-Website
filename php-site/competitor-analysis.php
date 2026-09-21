<?php
/** Side-by-side competitor SEO audit. */
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/sidebar.php';

$PAGE_TITLE = 'Website Competitor Analysis — Side-by-side SEO Audit | SEO Audit Tools';
$PAGE_DESC  = 'Compare two websites with the same on-page, technical, mobile, security and performance checks. Domain registration dates from public RDAP registry data.';
$ACTIVE = 'competitor';
$FOOTER_EXTRA = '<script src="/assets/js/audit.js"></script><script src="/assets/js/competitor.js"></script>';
include __DIR__ . '/includes/header.php';
?>
<div class="tool-page">
  <div>
    <div id="ca-app"></div>

    <div class="te mt-8">
      <section class="card">
        <p class="eyebrow">About the tool</p>
        <h2 class="h2" style="margin-top:0">What is Website Competitor Analysis?</h2>
        <p class="text-block">This tool audits two public web pages with the same checklist, then puts the results next to each other. That makes differences easier to spot than reading two separate reports.</p>
        <p class="text-block">Use it when a competitor outranks you, when you are planning a new landing page, or when you want a practical benchmark before rewriting content. The report does not copy a competitor’s strategy. It shows where their page is stronger, where yours already leads, and which gaps are worth investigating.</p>
        <p class="text-block">The comparison covers page titles, descriptions, headings, word count, images, internal and external links, nofollow attributes, responsive signals, security and HTML performance. Keyword frequency is extracted from the visible page copy so you can compare topic coverage without relying on guessed search-volume data.</p>
      </section>
      <div class="grid grid-2">
        <section class="card">
          <h2 class="h3" style="margin-top:0">How to read the comparison report</h2>
          <?php
          $steps = [
            'Compare matching page types. A homepage should be compared with a homepage, not a blog article.',
            'Start with the overall and category scores to locate the largest gap.',
            'Read the individual checks. Each one explains the finding and the recommended fix.',
            'Review keywords for missing subtopics, not phrases to copy.',
            'Inspect internal and external URL samples to understand how each page supports navigation and authority.',
            'Turn the priority plan into a development or content checklist, then re-run the analysis.',
          ];
          foreach ($steps as $i => $s): ?>
            <div class="use-step mt-4"><span class="use-n"><?= $i + 1 ?></span><?= e($s) ?></div>
          <?php endforeach; ?>
        </section>
        <section class="card" style="background:linear-gradient(to bottom right,var(--indigo-50),#fff);border-color:var(--indigo-100)">
          <h2 class="h3" style="margin-top:0">Benefits</h2>
          <?php
          $bens = [
            ['A fair benchmark', 'Both pages are tested with identical rules, so score differences are easier to interpret.'],
            ['Clear priorities', 'Errors and warnings become a focused improvement plan instead of a long, unstructured audit.'],
            ['Better content briefs', 'Keyword and heading comparisons reveal topics and supporting sections that may be missing.'],
            ['Stronger internal linking', 'URL samples show how each page directs visitors and crawlers to related content.'],
            ['Faster reviews', 'Marketers, developers and clients can discuss one side-by-side report instead of switching between tools.'],
          ];
          foreach ($bens as $b): ?>
            <div class="benefit-card mt-4">
              <h3 class="h3" style="margin:0 0 .25rem;font-size:.9rem"><?= e($b[0]) ?></h3>
              <p class="small muted"><?= e($b[1]) ?></p>
            </div>
          <?php endforeach; ?>
        </section>
      </div>
      <section class="card">
        <p class="eyebrow">Questions</p>
        <h2 class="h2" style="margin-top:0">Competitor Analysis FAQs</h2>
        <?php
        $faqs = [
          ['What does the competitor analysis compare?', 'It compares both pages across on-page SEO, technical signals, mobile readiness, security, performance, keywords, content depth and link structure. Domain registration and expiry dates for both sites come from public RDAP registry data.'],
          ['Does this tool check an entire website?', 'It compares the two exact URLs you enter. For a broader view, test matching templates such as both homepages, both service pages, or both product pages.'],
          ['Why does a report say Estimated fallback?', 'Some websites block browser or CORS access. In that case the tool completes with stable URL-based sample data so the workflow does not fail, and labels the result clearly.'],
          ['Does a higher SEO score guarantee better rankings?', 'No. The score measures important technical and on-page signals. Rankings also depend on relevance, backlinks, brand trust, user intent and competition.'],
          ['How should I use the keyword comparison?', 'Look for meaningful terms your competitor covers that your page misses. Add useful sections where needed, but avoid copying text or stuffing keywords.'],
          ['What should I fix first?', 'Start with red errors, especially missing titles, noindex directives, missing H1 tags, HTTP pages and mobile viewport problems. Then work through warnings.'],
          ['Is the analysis stored?', 'No. Both URLs are processed in the browser session. The tool does not create an account or store a comparison history.'],
        ];
        foreach ($faqs as $i => $faq): ?>
          <div class="faq-item<?= $i === 0 ? ' open' : '' ?>">
            <button type="button" class="faq-q" aria-expanded="<?= $i === 0 ? 'true' : 'false' ?>"><?= e($faq[0]) ?><span class="chev">+</span></button>
            <div class="faq-a"><?= e($faq[1]) ?></div>
          </div>
        <?php endforeach; ?>
      </section>
    </div>
  </div>
  <?php render_sidebar(); ?>
</div>
<?php include __DIR__ . '/includes/footer.php'; ?>