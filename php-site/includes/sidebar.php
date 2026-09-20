<?php
/** Right-hand sidebar used on tool, blog and competitor pages. */
function render_sidebar(?string $category = null, ?string $currentSlug = null, ?string $currentPost = null): void {
  $popular = [
    ['plagiarism-checker', 'Accurate Results'], ['article-rewriter', 'New'], ['grammar-checker', null], ['what-is-my-ip', null],
    ['website-seo-score-checker', 'Popular'], ['percentage-calculator', null], ['bmi-calculator', null],
    ['keyword-density-checker', null], ['compress-pdf', 'New'], ['merge-pdf', null], ['meta-tags-analyzer', null],
    ['qr-code-generator', null],
  ];
  $defaults = ['plagiarism-checker', 'grammar-checker', 'word-counter', 'keyword-density-checker', 'meta-tag-generator', 'website-seo-score-checker', 'what-is-my-ip', 'compress-pdf'];
  $relevant = [];
  foreach (live_tools() as $t) {
    if ($t['slug'] === $currentSlug) continue;
    if ($category ? ($t['category'] === $category) : in_array($t['slug'], $defaults, true)) $relevant[] = $t;
    if (count($relevant) >= 8) break;
  }
  $posts = array_values(array_filter(live_posts(), fn($p) => $p['slug'] !== $currentPost));
  $posts = array_slice($posts, 0, 5);
  ?>
  <aside class="tool-aside">
    <div class="sidebar-widget">
      <div class="search-wrap" data-tool-search>
        <div class="flex" style="gap:0;border:1px solid var(--slate-300);border-radius:.6rem;overflow:hidden;background:#fff">
          <input class="input" style="border:0;border-radius:0;box-shadow:none" placeholder="Search from SEO tools" aria-label="Search tools">
          <button type="button" class="btn btn-primary" data-search-go aria-label="Search" style="border-radius:0;width:4.5rem;padding:0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          </button>
        </div>
        <div class="search-results" data-search-results hidden></div>
      </div>
    </div>

    <?php if ($relevant): ?>
    <div class="sidebar-widget">
      <h3><?= $category ? 'Relevant tools' : 'Useful tools' ?></h3>
      <?php foreach ($relevant as $t): ?>
        <a class="list-row" href="<?= url('tool/' . $t['slug']) ?>">
          <svg class="arrow" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13.2 5.2 20 12l-6.8 6.8-1.4-1.4 4.4-4.4H4v-2h12.2l-4.4-4.4z"/></svg>
          <span><?= e($t['name']) ?></span>
        </a>
      <?php endforeach; ?>
    </div>
    <?php endif; ?>

    <div class="sidebar-widget">
      <h3>Popular tools</h3>
      <?php foreach ($popular as [$slug, $badge]):
        $t = find_tool($slug); if (!$t || $t['slug'] === $currentSlug) continue; ?>
        <a class="list-row" href="<?= url('tool/' . $t['slug']) ?>">
          <svg class="arrow" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="color:var(--indigo-600)"><path d="M13.2 5.2 20 12l-6.8 6.8-1.4-1.4 4.4-4.4H4v-2h12.2l-4.4-4.4z"/></svg>
          <span style="flex:1"><?= e($t['name']) ?></span>
          <?php if ($badge === 'New'): ?><span class="badge-new">New</span>
          <?php elseif ($badge === 'Popular'): ?><span class="badge-pop">Popular</span>
          <?php elseif ($badge): ?><span class="badge-new"><?= e($badge) ?></span><?php endif; ?>
        </a>
      <?php endforeach; ?>
    </div>

    <?php if ($posts): ?>
    <div class="sidebar-widget">
      <h3>Latest articles</h3>
      <?php foreach ($posts as $p): ?>
        <a class="list-row" href="<?= url('blog/' . $p['slug']) ?>">
          <svg class="arrow" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="color:var(--indigo-500)"><path d="M13.2 5.2 20 12l-6.8 6.8-1.4-1.4 4.4-4.4H4v-2h12.2l-4.4-4.4z"/></svg>
          <span><?= e($p['title']) ?></span>
        </a>
      <?php endforeach; ?>
    </div>
    <?php endif; ?>

    <div class="sidebar-cta">
      <p style="font-weight:800;font-size:1.05rem;margin:0">Free SEO audit</p>
      <p>Run a full on-page, technical and performance check in seconds.</p>
      <a href="<?= url('home') ?>">Start free audit</a>
    </div>
  </aside>
  <?php
}