<?php
/** Tools directory — filterable by category and search. */
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/icons.php';

$PAGE_TITLE = $SEO['tools']['title'] ?? 'Free SEO Tools';
$PAGE_DESC  = $SEO['tools']['description'] ?? '';
$ACTIVE = 'tools';
$q = trim((string)($_GET['q'] ?? ''));
$cat = (string)($_GET['cat'] ?? 'all');
$all = live_tools();
include __DIR__ . '/includes/header.php';
?>
<div class="tools-dir">
  <header class="text-center mb-8">
    <h1 class="h1">Free <span class="grad-text" style="background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent">SEO Tools</span></h1>
    <p class="lead mt-4" style="max-width:40rem;margin-left:auto;margin-right:auto"><?= count($all) ?>+ free tools for text analysis, keyword research, backlinks, website management, security checks and domains. No sign-up, most run instantly in your browser.</p>
  </header>

  <div class="search-wrap" style="max-width:36rem;margin:0 auto 2rem" data-tool-search>
    <div class="flex" style="gap:0;border:1px solid var(--slate-300);border-radius:var(--radius-xl);overflow:hidden;background:#fff">
      <input class="input" name="q" value="<?= e($q) ?>" placeholder="Search tools… e.g. plagiarism, sitemap, SSL" style="border:0;border-radius:0;box-shadow:none" aria-label="Search tools">
      <button type="button" class="btn btn-primary" data-search-go style="border-radius:0;width:4.5rem">Go</button>
    </div>
    <div class="search-results" data-search-results hidden></div>
  </div>

  <div class="cat-filter" id="cat-filter">
    <button type="button" class="pill<?= $cat === 'all' ? ' on' : '' ?>" data-cat="all">All Tools (<?= count($all) ?>)</button>
    <?php foreach ($CATEGORY_ORDER as $c): ?>
      <button type="button" class="pill<?= $cat === $c ? ' on' : '' ?>" data-cat="<?= e($c) ?>"><?= e(preg_replace('/ Tools$/', '', cat_label($c))) ?></button>
    <?php endforeach; ?>
  </div>

  <div id="tools-grid">
    <?php foreach ($CATEGORY_ORDER as $c):
      $list = tools_in_category($c);
      if (!$list) continue; ?>
      <section class="mb-8 dir-cat" data-cat="<?= e($c) ?>">
        <div class="flex mb-4">
          <span class="tool-icon cat-<?= e($c) ?> cat-chip"><?= tool_icon_svg($c) ?></span>
          <h2 class="h3" style="margin:0"><?= e(cat_label($c)) ?></h2>
          <span class="small muted">(<?= count($list) ?>)</span>
        </div>
        <div class="grid grid-3">
          <?php foreach ($list as $t): ?>
            <a class="dir-card" href="<?= url('tool/' . $t['slug']) ?>" data-name="<?= e(strtolower($t['name'] . ' ' . $t['description'])) ?>">
              <div class="flex-between">
                <span class="tool-icon cat-<?= e($t['category']) ?> cat-chip"><?= tool_icon_svg($t['category'], 'w-4 h-4') ?></span>
                <?php if (!empty($t['engine'])): ?><span class="instant">Instant</span><?php endif; ?>
              </div>
              <h3><?= e($t['name']) ?></h3>
              <p><?= e($t['description']) ?></p>
            </a>
          <?php endforeach; ?>
        </div>
      </section>
    <?php endforeach; ?>
    <div id="no-tools" class="text-center" style="padding:4rem 0;display:none">
      <p class="h3">No tools found</p>
      <p class="small muted">Try a different search term or category.</p>
    </div>
  </div>
</div>
<script>
(function () {
  var cat = <?= json_encode($cat) ?>;
  var q = <?= json_encode(strtolower($q)) ?>;
  function apply() {
    var any = false;
    document.querySelectorAll('.dir-cat').forEach(function (sec) {
      var showCat = cat === 'all' || sec.getAttribute('data-cat') === cat;
      var cards = sec.querySelectorAll('.dir-card');
      var vis = 0;
      cards.forEach(function (c) {
        var match = !q || (c.getAttribute('data-name') || '').indexOf(q) !== -1;
        c.style.display = (showCat && match) ? '' : 'none';
        if (showCat && match) vis++;
      });
      sec.style.display = vis ? '' : 'none';
      if (vis) any = true;
    });
    document.getElementById('no-tools').style.display = any ? 'none' : 'block';
    document.querySelectorAll('#cat-filter .pill').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-cat') === cat); });
  }
  document.querySelectorAll('#cat-filter .pill').forEach(function (b) {
    b.addEventListener('click', function () { cat = b.getAttribute('data-cat'); apply(); });
  });
  var inp = document.querySelector('[data-tool-search] input');
  if (inp) inp.addEventListener('input', function () { q = inp.value.trim().toLowerCase(); apply(); });
  apply();
})();
</script>
<?php include __DIR__ . '/includes/footer.php'; ?>