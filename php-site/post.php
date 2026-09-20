<?php
/** Single blog post. */
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/sidebar.php';

$slug = (string)($_GET['slug'] ?? '');
$post = $slug !== '' ? find_post($slug) : null;
if (!$post || (($post['status'] ?? 'live') !== 'live')) {
  http_response_code(404);
  $PAGE_TITLE = 'Article not found';
  $NOINDEX = true;
  $ACTIVE = 'blog';
  include __DIR__ . '/includes/header.php';
  echo '<div class="page-wrap text-center"><h1 class="h1">Article not found</h1><p class="lead mt-4"><a href="' . url('blog') . '">Back to the blog</a></p></div>';
  include __DIR__ . '/includes/footer.php';
  exit;
}

$PAGE_TITLE = $post['metaTitle'] ?? $post['title'];
$PAGE_DESC  = $post['metaDescription'] ?? ($post['excerpt'] ?? '');
$ACTIVE = 'blog';
$related = array_values(array_filter(live_posts(), fn($p) => $p['slug'] !== $post['slug'] && ($p['category'] ?? '') === ($post['category'] ?? '')));
$related = array_slice($related, 0, 2);
include __DIR__ . '/includes/header.php';
?>
<div class="tool-page">
  <article>
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="<?= url('home') ?>">Home</a>
      <span class="sep">&gt;&gt;</span>
      <a href="<?= url('blog') ?>">Blog</a>
      <span class="sep">&gt;&gt;</span>
      <span style="color:var(--indigo-600)"><?= e($post['title']) ?></span>
    </nav>
    <p class="eyebrow"><?= e($post['category'] ?? 'SEO') ?></p>
    <h1 class="h1"><?= e($post['title']) ?></h1>
    <p class="article-meta"><?= e($post['date'] ?? '') ?> &middot; <?= e($post['readTime'] ?? '5 min read') ?><?= !empty($post['author']) ? ' &middot; ' . e($post['author']) : '' ?></p>
    <?php if (!empty($post['excerpt'])): ?><p class="lead"><?= e($post['excerpt']) ?></p><?php endif; ?>
    <?php render_markdown($post['content'] ?? ''); ?>

    <?php if ($related): ?>
    <section class="mt-8">
      <h2 class="h2">Related articles</h2>
      <div class="grid grid-2">
        <?php foreach ($related as $r): ?>
          <a class="blog-card" href="<?= url('blog/' . $r['slug']) ?>">
            <p class="eyebrow"><?= e($r['category'] ?? 'SEO') ?></p>
            <h3 class="h3" style="margin-top:0"><?= e($r['title']) ?></h3>
            <p class="muted small"><?= e($r['excerpt'] ?? '') ?></p>
          </a>
        <?php endforeach; ?>
      </div>
    </section>
    <?php endif; ?>
  </article>
  <?php render_sidebar(null, null, $post['slug']); ?>
</div>
<?php include __DIR__ . '/includes/footer.php'; ?>