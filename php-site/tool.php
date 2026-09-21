<?php
/** Individual tool page. */
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/icons.php';
require __DIR__ . '/includes/sidebar.php';

$slug = (string)($_GET['slug'] ?? '');
$tool = $slug !== '' ? find_tool($slug) : null;
if (!$tool || (($tool['status'] ?? 'live') !== 'live')) {
  http_response_code(404);
  $PAGE_TITLE = 'Tool not found';
  $PAGE_DESC = '';
  $NOINDEX = true;
  $ACTIVE = 'tools';
  include __DIR__ . '/includes/header.php';
  echo '<div class="page-wrap text-center"><h1 class="h1">Tool not found</h1><p class="lead mt-4"><a href="' . url('tools') . '">Browse all tools</a></p></div>';
  include __DIR__ . '/includes/footer.php';
  exit;
}

$PAGE_TITLE = $tool['name'] . ' - Free Online SEO Tool | SEO Audit Tools';
$PAGE_DESC  = $tool['description'];
$ACTIVE = 'tools';
$wide = in_array($tool['slug'], ['plagiarism-checker', 'grammar-checker', 'article-rewriter'], true)
  || in_array($tool['engine'] ?? '', ['wm-htmleditor', 'wm-screensim', 'wm-snooper', 'wm-mobile', 'wm-htmlviewer'], true)
  || ($tool['category'] ?? '') === 'pdf';
$copy = $TOOL_CONTENT[$tool['category']] ?? ($TOOL_CONTENT['management'] ?? null);
$short = tool_short_name($tool['name']);
$related = related_tools($tool, 3);
$cfg = [
  'slug' => $tool['slug'],
  'name' => $tool['name'],
  'description' => $tool['description'],
  'category' => $tool['category'],
  'input' => $tool['input'] ?? 'text',
  'engine' => $tool['engine'] ?? '',
  'placeholder' => $tool['placeholder'] ?? '',
  'placeholder2' => $tool['placeholder2'] ?? '',
];

$FOOTER_EXTRA = '<script>window.TOOL_CONFIG = ' . json_encode($cfg, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . ';</script>'
  . '<script src="/assets/js/audit.js"></script>'
  . '<script src="/assets/js/md5.js"></script>'
  . '<script src="/assets/js/engines.js"></script>'
  . '<script src="/assets/js/calculators.js"></script>'
  . '<script src="/assets/js/webtools.js"></script>'
  . '<script src="/assets/js/ip.js"></script>'
  . '<script src="/assets/js/pdf.js"></script>';

include __DIR__ . '/includes/header.php';
?>
<script type="application/ld+json"><?= json_encode([
  '@context' => 'https://schema.org',
  '@type' => 'WebApplication',
  'name' => $tool['name'],
  'description' => $tool['description'],
  'applicationCategory' => 'SEOApplication',
  'operatingSystem' => 'Any',
  'offers' => ['@type' => 'Offer', 'price' => '0', 'priceCurrency' => 'USD'],
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?></script>

<div class="tool-page">
  <div>
    <header class="tool-header">
      <div class="flex" style="justify-content:center;margin-bottom:1rem">
        <span class="tool-icon cat-<?= e($tool['category']) ?> cat-chip"><?= tool_icon_svg($tool['category']) ?></span>
        <?php if (!empty($tool['engine'])): ?><span class="instant">Instant · runs in your browser</span><?php endif; ?>
      </div>
      <h1 class="h1" style="text-transform:uppercase;letter-spacing:-.02em"><?= e($tool['name']) ?></h1>
      <p class="lead mt-4" style="max-width:48rem;margin-left:auto;margin-right:auto"><?= e($tool['description']) ?></p>
    </header>

    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="<?= url('home') ?>">Home</a>
      <span class="sep">&gt;&gt;</span>
      <a href="<?= url('tools') ?>?cat=<?= e($tool['category']) ?>"><?= e(cat_label($tool['category'])) ?></a>
      <span class="sep">&gt;&gt;</span>
      <span style="color:var(--indigo-600)"><?= e($tool['name']) ?></span>
    </nav>

    <div class="tool-panel<?= $wide ? '' : '' ?>" style="<?= $wide ? '' : 'background:var(--slate-50)' ?>">
      <div id="tool-engine"></div>
    </div>

    <?php if ($copy): ?>
    <section class="card mt-8">
      <p class="eyebrow"><?= e(cat_label($tool['category'])) ?></p>
      <h2 class="h2" style="margin-top:0">About the <?= e($short) ?></h2>
      <?php foreach ($copy['overview'] ?? [] as $p): ?>
        <p class="text-block"><?= e($p) ?></p>
      <?php endforeach; ?>
      <div class="grid grid-2 mt-6">
        <div>
          <h3 class="h3" style="margin-top:0">How to use this tool</h3>
          <?php foreach ($copy['use'] ?? [] as $i => $step): ?>
            <div class="use-step mt-4"><span class="use-n"><?= $i + 1 ?></span><span><?= e($step) ?></span></div>
          <?php endforeach; ?>
        </div>
        <div class="te-stat">
          <h3 class="h3" style="margin-top:0">Best-practice tips</h3>
          <ul class="page-list">
            <?php foreach ($copy['tips'] ?? [] as $tip): ?><li><?= e($tip) ?></li><?php endforeach; ?>
          </ul>
        </div>
      </div>
    </section>

    <section class="card mt-8">
      <p class="eyebrow">Use cases</p>
      <h2 class="h2" style="margin-top:0">Where you can use the <?= e($short) ?></h2>
      <p class="small muted mb-6">Practical scenarios where this type of tool saves time, reduces errors or improves the quality of a website and its content.</p>
      <div class="grid grid-2">
        <?php foreach ($copy['places'] ?? [] as $place): ?>
          <div class="place-card">
            <span class="tick">✓</span>
            <div><h3 class="h3" style="margin:0 0 .25rem;font-size:.9rem"><?= e($place[0]) ?></h3><p class="small muted"><?= e($place[1]) ?></p></div>
          </div>
        <?php endforeach; ?>
      </div>
    </section>

    <section class="card mt-8" style="background:linear-gradient(to bottom right,var(--indigo-50),#fff);border-color:var(--indigo-100)">
      <p class="eyebrow">Benefits</p>
      <h2 class="h2" style="margin-top:0">Why use this tool?</h2>
      <div class="grid grid-4">
        <?php foreach ($copy['benefits'] ?? [] as $b): ?>
          <div class="benefit-card">
            <div class="star">★</div>
            <h3 class="h3" style="margin:0 0 .35rem;font-size:.9rem"><?= e($b['title']) ?></h3>
            <p class="small muted"><?= e($b['text']) ?></p>
          </div>
        <?php endforeach; ?>
      </div>
    </section>

    <section class="card mt-8">
      <p class="eyebrow">Answers</p>
      <h2 class="h2" style="margin-top:0"><?= e($short) ?> FAQs</h2>
      <?php foreach (array_slice($copy['faqs'] ?? [], 0, 7) as $i => $q): ?>
        <div class="faq-item<?= $i === 0 ? ' open' : '' ?>">
          <button type="button" class="faq-q" aria-expanded="<?= $i === 0 ? 'true' : 'false' ?>"><?= e($q) ?><span class="chev">+</span></button>
          <div class="faq-a"><?= e(tool_faq_answer($short, $i)) ?></div>
        </div>
      <?php endforeach; ?>
    </section>
    <?php endif; ?>

    <?php if ($related): ?>
    <section class="card mt-8">
      <h2 class="h2" style="margin-top:0">Related tools</h2>
      <p class="small muted mb-6">Continue with these related <?= e(strtolower(cat_label($tool['category']))) ?>.</p>
      <div class="grid grid-3">
        <?php foreach ($related as $r): ?>
          <a class="related-card" href="<?= url('tool/' . $r['slug']) ?>">
            <h3><?= e($r['name']) ?></h3>
            <p class="line-clamp"><?= e($r['description']) ?></p>
          </a>
        <?php endforeach; ?>
      </div>
    </section>
    <?php endif; ?>
  </div>

  <?php render_sidebar($tool['category'], $tool['slug']); ?>
</div>
<?php include __DIR__ . '/includes/footer.php'; ?>