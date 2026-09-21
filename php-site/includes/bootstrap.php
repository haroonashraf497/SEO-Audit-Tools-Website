<?php
/**
 * SEO Audit Tools — bootstrap
 * Loads all content data and provides the shared helpers used by every page.
 * Pure PHP: no frameworks, no build step, no database.
 */

declare(strict_types=1);

define('SITE_ROOT', __DIR__ . '/..');

// ---- content data (editable PHP arrays) ----
$DATA           = require SITE_ROOT . '/includes/content.php';
$TOOLS_DATA     = require SITE_ROOT . '/includes/tools-data.php';
$TOOL_CONTENT   = require SITE_ROOT . '/includes/tool-content.php';

$SETTINGS  = $DATA['settings'];
$PAGES     = $DATA['pages'];
$POSTS     = $DATA['posts'];
$SEO       = $DATA['seo'];
$TOOLS     = $TOOLS_DATA['tools'];
$CATEGORIES      = $TOOLS_DATA['categories'];
$CATEGORY_ORDER  = $TOOLS_DATA['categoryOrder'];

// ---- helpers ----

/** Escape for HTML output. */
function e(?string $s): string {
  return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
}

/** Current request path without leading/trailing slashes, e.g. "tool/plagiarism-checker". */
function route_path(): string {
  $p = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
  $p = trim($p, '/');
  return $p === '' ? 'home' : $p;
}

/** Find a tool by slug (or null). */
function find_tool(string $slug): ?array {
  global $TOOLS;
  foreach ($TOOLS as $t) { if ($t['slug'] === $slug) return $t; }
  return null;
}

/** Find a CMS page by slug (or null). */
function find_page(string $slug): ?array {
  global $PAGES;
  foreach ($PAGES as $p) { if ($p['slug'] === $slug) return $p; }
  return null;
}

/** Find a blog post by slug (or null). */
function find_post(string $slug): ?array {
  global $POSTS;
  foreach ($POSTS as $p) { if ($p['slug'] === $slug) return $p; }
  return null;
}

/** Live posts sorted by date (newest first). */
function live_posts(): array {
  global $POSTS;
  $out = array_values(array_filter($POSTS, fn($p) => ($p['status'] ?? 'live') === 'live'));
  usort($out, fn($a, $b) => strcmp($b['date'], $a['date']));
  return $out;
}

/** Live tools only. */
function live_tools(): array {
  global $TOOLS;
  return array_values(array_filter($TOOLS, fn($t) => ($t['status'] ?? 'live') === 'live'));
}

/** Tools in a category (live only). */
function tools_in_category(string $cat): array {
  return array_values(array_filter(live_tools(), fn($t) => $t['category'] === $cat));
}

/** Absolute URL for a site route (clean URL when rewrites are active). */
function url(string $route): string {
  global $REWRITES_ON;
  if ($route === '' || $route === 'home') return $REWRITES_ON ? '/' : '/index.php';
  if ($REWRITES_ON) return '/' . $route;
  // Query-string fallback when .htaccess is unavailable
  if (str_starts_with($route, 'tool/'))      return '/tool.php?slug=' . urlencode(substr($route, 5));
  if (str_starts_with($route, 'p/'))         return '/page.php?slug=' . urlencode(substr($route, 2));
  if (str_starts_with($route, 'blog/'))      return '/post.php?slug=' . urlencode(substr($route, 5));
  if ($route === 'tools')                    return '/tools.php';
  if ($route === 'blog')                     return '/blog.php';
  if ($route === 'competitor-analysis')      return '/competitor-analysis.php';
  return '/' . $route;
}

/**
 * Render a CMS page's blocks (heading / text / list / table / cta).
 * Text blocks may contain rich HTML from the editor — same output as the React site.
 */
function render_blocks(array $blocks): void {
  foreach ($blocks as $b) {
    switch ($b['type']) {
      case 'heading':
        if (($b['level'] ?? 2) === 2) echo '<h2 class="h2">' . e($b['text']) . "</h2>\n";
        else echo '<h3 class="h3">' . e($b['text']) . "</h3>\n";
        break;
      case 'text':
        echo '<div class="rich-text text-block">' . $b['text'] . "</div>\n";
        break;
      case 'list':
        echo '<ul class="page-list">' . "\n";
        foreach ($b['items'] as $it) echo '  <li>' . $it . "</li>\n";
        echo "</ul>\n";
        break;
      case 'table':
        echo '<div class="table-wrap"><table>' . "\n";
        echo '<thead><tr>';
        foreach ($b['head'] as $h) echo '<th>' . e($h) . '</th>';
        echo "</tr></thead>\n<tbody>\n";
        foreach ($b['rows'] as $row) {
          echo '<tr>';
          foreach ($row as $i => $cell) {
            echo $i === 0 ? '<td class="mono-cell">' . e($cell) . '</td>' : '<td>' . e($cell) . '</td>';
          }
          echo "</tr>\n";
        }
        echo "</tbody></table></div>\n";
        break;
      case 'cta':
        echo '<div class="cta-block">';
        if (!empty($b['text'])) echo '<p>' . e($b['text']) . '</p>';
        echo '<a class="btn btn-primary" href="' . e($b['href']) . '">' . e($b['label']) . '</a>';
        echo "</div>\n";
        break;
    }
  }
}

/**
 * Minimal markdown renderer for legacy blog post content
 * (## headings, ### headings, - bullets, **bold**, *italic*, paragraphs).
 */
function render_markdown(string $content): void {
  echo '<div class="rich-text">' . "\n";
  $lines = explode("\n", $content);
  $inList = false;
  foreach ($lines as $raw) {
    $line = trim($raw);
    if ($line === '') { if ($inList) { echo "</ul>\n"; $inList = false; } continue; }
    if (str_starts_with($line, '- ')) {
      if (!$inList) { echo '<ul class="page-list">' . "\n"; $inList = true; }
      echo '<li>' . md_inline(substr($line, 2)) . "</li>\n";
      continue;
    }
    if ($inList) { echo "</ul>\n"; $inList = false; }
    if (str_starts_with($line, '### '))      echo '<h3 class="h3">' . md_inline(substr($line, 4)) . "</h3>\n";
    elseif (str_starts_with($line, '## '))   echo '<h2 class="h2">' . md_inline(substr($line, 3)) . "</h2>\n";
    else                                      echo '<p>' . md_inline($line) . "</p>\n";
  }
  if ($inList) echo "</ul>\n";
  echo "</div>\n";
}

/** Inline markdown: **bold** and *italic*. */
function md_inline(string $s): string {
  $s = e($s);
  $s = preg_replace('/\*\*(.+?)\*\*/', '<strong>$1</strong>', $s);
  $s = preg_replace('/\*(.+?)\*/', '<em>$1</em>', $s);
  return $s;
}

/** Short name for "About the X" headings (matches the React shortName helper). */
function tool_short_name(string $name): string {
  return preg_replace('/\s+(checker|generator|calculator|converter|analyzer|analyser|tool|tools|maker|detector|tester)$/i', '', $name) ?? $name;
}

/** Category label. */
function cat_label(string $cat): string {
  global $CATEGORIES;
  return $CATEGORIES[$cat] ?? ucfirst($cat);
}

/** Related live tools in the same category. */
function related_tools(array $tool, int $n = 3): array {
  $out = [];
  foreach (live_tools() as $t) {
    if ($t['slug'] === $tool['slug']) continue;
    if ($t['category'] === $tool['category']) $out[] = $t;
    if (count($out) >= $n) break;
  }
  return $out;
}

/** FAQ answers that pair with the category question list (same order as the React site). */
function tool_faq_answer(string $name, int $index): string {
  $answers = [
    "No. {$name} is designed to work without sign-up, and most functionality runs immediately in your browser.",
    "Most processing is performed locally in your browser. Public URLs may be requested through a relay when a website blocks browser-based requests, but files and pasted text are not stored by this tool.",
    "{$name} checks the factors described on this page and shows status, explanation and recommended next steps.",
    "Run it whenever you create or significantly change a page, after a website update, migration, redesign, or at least once a month for important pages.",
    "Yes. The same checks apply to blog posts, product pages, landing pages, documentation, essays and other public web pages.",
    "It is a practical first-pass tool. For high-stakes legal, editorial or technical work, review the output manually and use a specialist where appropriate.",
    "The result is based on the public response available to the browser. Firewalls, JavaScript rendering, login walls, geo-restrictions and relay availability can affect what is detected.",
  ];
  return $answers[$index] ?? $answers[0];
}

/** JSON search index for the sidebar / tools directory. */
function search_index_json(): string {
  $tools = [];
  foreach (live_tools() as $t) {
    $tools[] = ['slug' => $t['slug'], 'name' => $t['name'], 'description' => $t['description'], 'category' => $t['category']];
  }
  $posts = [];
  foreach (live_posts() as $p) {
    $posts[] = ['slug' => $p['slug'], 'title' => $p['title'], 'excerpt' => $p['excerpt'] ?? ''];
  }
  return json_encode(['tools' => $tools, 'posts' => $posts], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

// Detect whether mod_rewrite clean URLs are available (Apache + .htaccess).
$REWRITES_ON = true;
