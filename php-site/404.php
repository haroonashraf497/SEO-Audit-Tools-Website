<?php
http_response_code(404);
require __DIR__ . '/includes/bootstrap.php';
$PAGE_TITLE = 'Page not found | SEO Audit Tools';
$PAGE_DESC = 'The page you requested could not be found.';
$NOINDEX = true;
include __DIR__ . '/includes/header.php';
?>
<div class="page-wrap text-center">
  <p class="eyebrow">404</p>
  <h1 class="h1">Page not found</h1>
  <p class="lead mt-4">That URL does not match a tool, article or page on this site.</p>
  <div class="flex" style="justify-content:center;margin-top:2rem">
    <a class="btn btn-primary" href="<?= url('home') ?>">Go to homepage</a>
    <a class="btn btn-ghost" href="<?= url('tools') ?>">Browse tools</a>
  </div>
</div>
<?php include __DIR__ . '/includes/footer.php'; ?>