</main>

<footer class="footer">
  <div class="footer-inner">
    <div class="footer-brand-row">
      <a href="<?= url('home') ?>" class="footer-brand">
        <span class="brand-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
        </span>
        <span>
          <span class="footer-brand-name"><?= e($SETTINGS['name']) ?></span>
          <span class="footer-brand-tag"><?= e($SETTINGS['tagline']) ?></span>
        </span>
      </a>
      <div class="footer-socials">
        <a href="https://x.com/" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" title="X (Twitter)"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zM17.083 19.77h1.833L7.084 4.126H5.117z"/></svg></a>
        <a href="https://www.linkedin.com/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" title="LinkedIn"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.063 2.063 0 1 1 0-4.126 2.063 2.063 0 0 1 0 4.126zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"/></svg></a>
        <a href="https://www.youtube.com/" target="_blank" rel="noopener noreferrer" aria-label="YouTube" title="YouTube"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>
        <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" title="Facebook"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
      </div>
    </div>

    <div class="footer-columns">
      <nav aria-label="SEO Tools">
        <h3>SEO Tools</h3>
        <ul>
          <li><a href="<?= url('home') ?>">Free SEO Audit</a></li>
          <li><a href="<?= url('competitor-analysis') ?>">Competitor Analysis</a></li>
        </ul>
      </nav>
      <nav aria-label="Resources">
        <h3>Resources</h3>
        <ul>
          <li><a href="<?= url('blog') ?>">Blog</a></li>
          <li><a href="<?= url('p/faq') ?>">FAQ</a></li>
          <li><a href="<?= url('home') ?>#audiences">Who It's For</a></li>
        </ul>
      </nav>
      <nav aria-label="Company">
        <h3>Company</h3>
        <ul>
          <li><a href="<?= url('p/about') ?>">About</a></li>
          <li><a href="<?= url('p/contact') ?>">Contact</a></li>
        </ul>
      </nav>
      <nav aria-label="Legal">
        <h3>Legal</h3>
        <ul>
          <li><a href="<?= url('p/privacy-policy') ?>">Privacy Policy</a></li>
          <li><a href="<?= url('p/cookie-policy') ?>">Cookie Policy</a></li>
          <li><a href="<?= url('p/terms-of-service') ?>">Terms &amp; Conditions</a></li>
          <li><button type="button" class="link-btn" data-cookie-prefs>Cookie preferences</button></li>
        </ul>
      </nav>
    </div>

    <div class="footer-bottom">
      <p>&copy; <?= date('Y') ?> <?= e($SETTINGS['company']) ?> &middot; Trading as <?= e($SETTINGS['domain']) ?>. All rights reserved.</p>
    </div>
  </div>
</footer>

<!-- Cookie consent (PECR) -->
<div class="cookie-banner" data-cookie-banner hidden role="region" aria-label="Cookie consent">
  <div class="cookie-banner-card">
    <div class="cookie-banner-text">
      <h2>We use cookies</h2>
      <p>We use essential cookies to make our site work. With your consent, we may also use analytics, advertising, and affiliate tracking cookies to improve your experience and understand how visitors use our site. <a href="<?= url('p/cookie-policy') ?>">Read our Cookie Policy</a>.</p>
    </div>
    <div class="cookie-banner-actions">
      <button type="button" class="btn btn-ghost" data-cookie-manage>Manage Preferences</button>
      <button type="button" class="btn btn-ghost" data-cookie-decline>Decline</button>
      <button type="button" class="btn btn-primary" data-cookie-accept>Accept All</button>
    </div>
  </div>
</div>

<div class="modal-overlay" data-cookie-modal hidden role="dialog" aria-modal="true" aria-label="Cookie preferences">
  <div class="modal-card">
    <div class="modal-head">
      <h2>Manage cookie preferences</h2>
      <button type="button" class="modal-close" data-cookie-close aria-label="Close cookie preferences">&times;</button>
    </div>
    <div class="modal-body">
      <div class="cookie-toggle-row">
        <div><p class="cookie-toggle-title">Essential</p><p class="cookie-toggle-desc">Required for the site to work and to remember your choices. Always on.</p></div>
        <span class="switch switch-on" role="switch" aria-checked="true" aria-label="Essential cookies (always on)"></span>
      </div>
      <div class="cookie-toggle-row">
        <div><p class="cookie-toggle-title">Analytics</p><p class="cookie-toggle-desc">Google Analytics shows us which tools are used so we can improve them.</p></div>
        <button type="button" class="switch" role="switch" aria-checked="false" aria-label="Analytics cookies" data-toggle="analytics"></button>
      </div>
      <div class="cookie-toggle-row">
        <div><p class="cookie-toggle-title">Advertising</p><p class="cookie-toggle-desc">Google AdSense serves and measures the ads that keep this site free.</p></div>
        <button type="button" class="switch" role="switch" aria-checked="false" aria-label="Advertising cookies" data-toggle="advertising"></button>
      </div>
      <div class="cookie-toggle-row">
        <div><p class="cookie-toggle-title">Affiliate tracking</p><p class="cookie-toggle-desc">Credits referrals when you click partner links, at no cost to you.</p></div>
        <button type="button" class="switch" role="switch" aria-checked="false" aria-label="Affiliate tracking cookies" data-toggle="affiliate"></button>
      </div>
    </div>
    <div class="modal-foot">
      <a href="<?= url('p/cookie-policy') ?>" data-cookie-close-link>Read our Cookie Policy</a>
      <button type="button" class="btn btn-primary" data-cookie-save>Save Preferences</button>
    </div>
  </div>
</div>

<script>window.SEARCH_INDEX = <?= search_index_json() ?>;</script>
<script src="/assets/js/app.js"></script>
<?= $FOOTER_EXTRA ?? '' ?>
</body>
</html>
