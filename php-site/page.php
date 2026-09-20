<?php
/** CMS / legal pages (About, Privacy, Terms, Cookie Policy, Contact, FAQ). */
require __DIR__ . '/includes/bootstrap.php';

$slug = (string)($_GET['slug'] ?? '');
$page = $slug !== '' ? find_page($slug) : null;
if (!$page || (($page['status'] ?? 'live') !== 'live')) {
  http_response_code(404);
  $PAGE_TITLE = 'Page not found';
  $NOINDEX = true;
  include __DIR__ . '/includes/header.php';
  echo '<div class="page-wrap text-center"><h1 class="h1">Page not found</h1><p class="lead mt-4"><a href="' . url('home') . '">Back to the homepage</a></p></div>';
  include __DIR__ . '/includes/footer.php';
  exit;
}

$PAGE_TITLE = $page['metaTitle'] ?? $page['title'];
$PAGE_DESC  = $page['metaDescription'] ?? '';
$ACTIVE = '';
include __DIR__ . '/includes/header.php';
?>
<article class="page-wrap">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="<?= url('home') ?>">Home</a>
    <span class="sep">&gt;&gt;</span>
    <span style="color:var(--indigo-600)"><?= e($page['title']) ?></span>
  </nav>
  <h1 class="h1"><?= e($page['title']) ?></h1>
  <?php render_blocks($page['blocks'] ?? []); ?>
</article>
<?php include __DIR__ . '/includes/footer.php'; ?>