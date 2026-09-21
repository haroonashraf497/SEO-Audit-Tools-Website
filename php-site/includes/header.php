<?php
/**
 * Shared header: doctype, SEO meta, navigation.
 * Every public page sets these variables BEFORE including this file:
 *   $PAGE_TITLE, $PAGE_DESC  — <title> and meta description
 *   $BODY_CLASS              — optional extra body classes
 *   $NOINDEX                 — optional true to noindex the page
 */
if (!isset($PAGE_TITLE))  { $PAGE_TITLE = $SEO['home']['title'] ?? 'SEO Audit Tools'; }
if (!isset($PAGE_DESC))   { $PAGE_DESC  = $SEO['home']['description'] ?? ''; }
$ACTIVE = $ACTIVE ?? '';
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= e($PAGE_TITLE) ?></title>
<meta name="description" content="<?= e($PAGE_DESC) ?>">
<meta name="robots" content="<?= !empty($NOINDEX) ? 'noindex, nofollow' : 'index, follow' ?>">
<link rel="canonical" href="<?= e('https://' . $SETTINGS['domain'] . ($_SERVER['REQUEST_URI'] ?? '/')) ?>">
<meta property="og:title" content="<?= e($PAGE_TITLE) ?>">
<meta property="og:description" content="<?= e($PAGE_DESC) ?>">
<meta property="og:type" content="website">
<meta property="og:site_name" content="<?= e($SETTINGS['name']) ?>">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236366f1' stroke-width='2'%3E%3Cpath d='M3 3v18h18'/%3E%3Cpath d='M18 17V9'/%3E%3Cpath d='M13 17V5'/%3E%3Cpath d='M8 17v-3'/%3E%3C/svg%3E">
<link rel="stylesheet" href="/assets/css/style.css">
</head>
<body class="<?= e($BODY_CLASS ?? '') ?>">

<a class="skip-link" href="#main">Skip to content</a>

<nav class="nav" aria-label="Main navigation">
  <div class="nav-inner">
    <a href="<?= url('home') ?>" class="brand" aria-label="<?= e($SETTINGS['name']) ?> home">
      <span class="brand-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
      </span>
      <span class="brand-text"><?= e($SETTINGS['name']) ?></span>
    </a>

    <button class="nav-toggle" type="button" aria-label="Toggle menu" aria-expanded="false" data-nav-toggle>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>

    <div class="nav-links" data-nav-links>
      <a href="<?= url('tools') ?>" class="nav-link<?= $ACTIVE === 'tools' ? ' active' : '' ?>">SEO Tools</a>
      <a href="<?= url('competitor-analysis') ?>" class="nav-link<?= $ACTIVE === 'competitor' ? ' active' : '' ?>">Competitor Analysis</a>
      <a href="<?= url('blog') ?>" class="nav-link<?= $ACTIVE === 'blog' ? ' active' : '' ?>">Blog</a>
      <a href="<?= url('home') ?>" class="btn btn-primary btn-nav">Get Started Free</a>
    </div>
  </div>
</nav>

<main id="main">
