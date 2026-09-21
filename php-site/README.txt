SEO Audit Tools — PHP site (no build step)
==========================================

Upload the contents of this folder to your Namecheap / Webuzo web root
(public_html). Keep the folder structure:

  index.php
  tools.php
  tool.php
  blog.php
  post.php
  page.php
  competitor-analysis.php
  404.php
  .htaccess
  assets/css/style.css
  assets/js/*.js
  includes/*.php

Requirements
------------
- PHP 8+ (arrow functions / str_starts_with)
- Apache with mod_rewrite (the bundled .htaccess provides clean URLs)

If rewrite rules are not available, open includes/bootstrap.php and set:

  $REWRITES_ON = false;

Links then fall back to tool.php?slug=…, page.php?slug=…, post.php?slug=…

Editing content
---------------
There is no CMS. Edit the PHP arrays:

  includes/content.php      — site settings, legal pages, blog posts, SEO titles
  includes/tools-data.php   — the 154 tools (name, description, category, engine)
  includes/tool-content.php — “About the tool” copy per category

Changes take effect immediately on the next page load.

URLs
----
  /                         homepage audit
  /tools                    directory
  /tool/{slug}              individual tool
  /blog                     blog index
  /blog/{slug}              article
  /p/{slug}                 About, Privacy, Terms, Cookie Policy, Contact, FAQ
  /competitor-analysis      side-by-side audit
