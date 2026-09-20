<?php
/** Blog index. */
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/sidebar.php';

$PAGE_TITLE = $SEO['blog']['title'] ?? 'SEO Blog';
$PAGE_DESC  = $SEO['blog']['description'] ?? '';
$ACTIVE = 'blog';
$posts = live_posts();
include __DIR__ . '/includes/header.php';
?>
<div class="tool-page">
  <div>
    <header class="mb-8">
      <p class="eyebrow">Blog</p>
      <h1 class="h1">Practical SEO guides</h1>
      <p class="lead mt-4">Core Web Vitals, PageSpeed, WordPress performance, indexing issues and Google updates — written for people who actually have to fix the site.</p>
    </header>
    <div class="blog-grid" style="grid-template-columns:1fr">
      <?php foreach ($posts as $post): ?>
        <article class="blog-card">
          <p class="eyebrow"><?= e($post['category'] ?? 'SEO') ?></p>
          <h2 class="h3" style="margin-top:0"><a href="<?= url('blog/' . $post['slug']) ?>"><?= e($post['title']) ?></a></h2>
          <p class="muted"><?= e($post['excerpt']) ?></p>
          <p class="small muted mt-4"><?= e($post['date'] ?? '') ?> &middot; <?= e($post['readTime'] ?? '5 min read') ?><?= !empty($post['author']) ? ' &middot; ' . e($post['author']) : '' ?></p>
          <p class="mt-4"><a href="<?= url('blog/' . $post['slug']) ?>">Read article →</a></p>
        </article>
      <?php endforeach; ?>
    </div>
  </div>
  <?php render_sidebar(null, null, null); ?>
</div>
<?php include __DIR__ . '/includes/footer.php'; ?>