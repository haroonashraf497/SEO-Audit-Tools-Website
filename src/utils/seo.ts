import { useEffect, type FC } from 'react';
import { useCms, type CmsState } from '../cms/store';
import { TOOLS_PATH, routeSlugForStored, storedSlugForRoute } from '../router';
import { categoryDescriptions, categoryFromKey, categoryLabels, categorySlugs } from '../tools/data';

export const DEFAULT_ORIGIN = 'https://seoaudittools.pk';
export const DEFAULT_OG_PATH = '/og.jpg';

export interface PageSeo {
  title: string;
  description: string;
  path: string;
  origin: string;
  noindex?: boolean;
  image?: string;
  imageAlt?: string;
  type?: 'website' | 'article';
  canonicalOverride?: string;
  jsonLd?: unknown;
}

const setMeta = (attr: 'name' | 'property', key: string, content?: string) => {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!content) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const setLink = (rel: string, href?: string) => {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!href) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
};

const originOf = (cms: CmsState): string => {
  const host = (cms.settings.domain || 'seoaudittools.pk').replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return `https://${host}`;
};

/**
 * Build the absolute canonical/OG URL for a path.
 *
 * The site uses clean History-API URLs, so canonical and social URLs must be
 * clean too — `https://seoaudittools.pk/#/about` is a different URL to
 * `https://seoaudittools.pk/about` as far as search engines are concerned, and
 * hash URLs never index. Legacy hash-style values (from an older CMS entry or
 * an old override) are converted to their clean path, and the legacy
 * `/tools`, `/tool`, `/free-tools` and `/free-seo-tool` collapse to the
 * `/free-seo-tools` index, and every nested tool spelling
 * (`/free-seo-tools/<slug>`, `/tool/<slug>`, …) to the top-level `/<slug>`.
 */
const absoluteUrl = (origin: string, path: string): string => {
  if (!path || path === '/' || path === '#/' || path === '#') return `${origin}/`;
  if (/^https?:\/\//i.test(path)) return path;
  let clean = path.startsWith('#') ? path.slice(1) : path;
  if (!clean.startsWith('/')) clean = `/${clean}`;
  clean = clean.replace(/^\/p(?=\/|$)/, '').replace(/\/{2,}/g, '/');
  // Tool pages are top level: /free-seo-tools/<slug>, /tool/<slug>,
  // /free-tools/<slug> and /free-seo-tool/<slug> all canonicalise to /<slug>.
  for (const prefix of [TOOLS_PATH, '/tool', '/free-tools', '/free-seo-tool']) {
    if (clean.startsWith(`${prefix}/`)) clean = clean.slice(prefix.length);
  }
  if (clean === '/tools' || clean === '/tool' || clean === '/free-tools' || clean === '/free-seo-tool') clean = TOOLS_PATH;
  if (clean === '' || clean === '/') return `${origin}/`;
  if (clean.length > 1) clean = clean.replace(/\/+$/, '');
  return `${origin}${clean}`;
};

const defaultOg = (origin: string) => `${origin}${DEFAULT_OG_PATH}`;

const orgNode = (origin: string, brand: string) => ({
  '@type': 'Organization',
  '@id': `${origin}/#organization`,
  name: brand,
  url: `${origin}/`,
  email: 'help@seoaudittools.pk',
  areaServed: 'Pakistan',
});

const websiteNode = (origin: string, brand: string) => ({
  '@type': 'WebSite',
  '@id': `${origin}/#website`,
  name: brand,
  url: `${origin}/`,
  inLanguage: 'en',
  publisher: { '@id': `${origin}/#organization` },
});

const webAppNode = (origin: string, name: string, description: string, url: string) => ({
  '@type': 'WebApplication',
  name,
  description,
  url,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Any',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
  publisher: { '@id': `${origin}/#organization` },
});

export const resolvePageSeo = (route: string, cms: CmsState): PageSeo => {
  const brand = cms.settings.name || 'SEO Audit Tools';
  const origin = originOf(cms);
  const og = defaultOg(origin);

  if (route === 'admin' || route === 'admin-login' || route === 'admin-reset') {
    const path = route === 'admin' ? '/admin' : route === 'admin-login' ? '/admin-login' : '/admin-reset';
    return {
      title: `Admin | ${brand}`,
      description: `Private content manager for ${brand}. This area is not indexed.`,
      path,
      origin,
      noindex: true,
      image: og,
    };
  }

  if (route === 'home') {
    const seo = cms.seo.home;
    const title = seo?.title || `${brand} — Free Website SEO Checker & 150+ Online Tools`;
    const description = seo?.description || 'Free SEO audit tool plus 150+ practical SEO, speed, IP, PDF, calculator and converter tools — built for website owners in Pakistan and worldwide.';
    return {
      title,
      description,
      path: '/',
      origin,
      noindex: seo?.noindex,
      canonicalOverride: seo?.slug,
      image: og,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          orgNode(origin, brand),
          websiteNode(origin, brand),
          webAppNode(origin, brand, description, `${origin}/`),
        ],
      },
    };
  }

  if (route === 'free-tools' || route === 'tools') {
    const live = cms.tools.filter(t => t.status === 'live');
    const seo = cms.seo.tools;
    const title = seo?.title || `${live.length}+ Free SEO Tools — Audit, Speed, Calculator & Converter Tools`;
    const description = seo?.description || `Browse ${live.length}+ free tools for Pakistan and worldwide: website SEO audit, page speed, keyword research, backlinks, IP lookup, PDF tools, calculators and unit converters.`;
    return {
      title,
      description,
      path: '/free-seo-tools',
      origin,
      noindex: seo?.noindex,
      canonicalOverride: seo?.slug,
      image: og,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: `Free SEO Tools from ${brand}`,
        numberOfItems: live.length,
        itemListElement: live.slice(0, 50).map((t, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: t.name,
          url: `${origin}/${t.slug}`,
        })),
      },
    };
  }

  if (route.startsWith('cat/')) {
    const cat = categoryFromKey(route.slice(4));
    if (!cat) {
      return {
        title: `Tools not found | ${brand}`,
        description: 'That category is not available. Browse the free SEO tools directory instead.',
        path: TOOLS_PATH,
        origin,
        noindex: true,
        image: og,
      };
    }
    const list = cms.tools.filter(t => t.status === 'live' && t.category === cat);
    const label = categoryLabels[cat];
    const path = `/${categorySlugs[cat]}`;
    const description = `${categoryDescriptions[cat]} ${list.length} free ${label.toLowerCase()}, no sign-up — most run instantly in your browser.`;
    return {
      title: `${label} — ${list.length} Free Online Tools | ${brand}`,
      description,
      path,
      origin,
      image: og,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'CollectionPage',
            name: label,
            description,
            url: `${origin}${path}`,
            isPartOf: { '@id': `${origin}/#website` },
          },
          {
            '@type': 'ItemList',
            name: label,
            numberOfItems: list.length,
            itemListElement: list.map((t, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: t.name,
              url: `${origin}/${t.slug}`,
            })),
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
              { '@type': 'ListItem', position: 2, name: 'Free SEO Tools', item: `${origin}${TOOLS_PATH}` },
              { '@type': 'ListItem', position: 3, name: label, item: `${origin}${path}` },
            ],
          },
        ],
      },
    };
  }

  if (route.startsWith('tool/')) {
    const slug = route.slice(5);
    const tool = cms.tools.find(t => t.slug === slug && t.status === 'live');
    if (!tool) {
      return {
        title: `Tool not found | ${brand}`,
        description: 'That tool is not available. Browse the free SEO tools directory instead.',
        path: `/${slug}`,
        origin,
        noindex: true,
        image: og,
      };
    }
    const seo = cms.seo[`tool:${tool.slug}`];
    const title = seo?.title || `${tool.name} — Free Online Tool | ${brand}`;
    const description = seo?.description || tool.description;
    const url = `${origin}/${tool.slug}`;
    return {
      title,
      description,
      path: `/${tool.slug}`,
      origin,
      noindex: seo?.noindex,
      canonicalOverride: seo?.slug,
      image: tool.featuredImage || og,
      imageAlt: tool.featuredImageAlt || tool.name,
      jsonLd: webAppNode(origin, tool.name, description, url),
    };
  }

  if (route === 'blog') {
    const seo = cms.seo.blog;
    const title = seo?.title || `SEO Blog: Core Web Vitals, PageSpeed & WordPress Guides | ${brand}`;
    const description = seo?.description || 'Practical SEO guides on fixing INP, LCP and CLS, PageSpeed problems, WordPress performance, indexing issues and Google core updates.';
    return {
      title,
      description,
      path: '/blog',
      origin,
      noindex: seo?.noindex,
      canonicalOverride: seo?.slug,
      image: og,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: `${brand} Blog`,
        description,
        url: `${origin}/blog`,
        publisher: { '@id': `${origin}/#organization` },
        // Every category answers on its own clean URL.
        hasPart: (cms.blogCategories || []).filter(c => c.visible).map(c => ({
          '@type': 'CollectionPage',
          name: c.name,
          url: `${origin}/blog/category/${c.slug}`,
        })),
      },
    };
  }

  if (route.startsWith('blogcat/')) {
    const slug = route.slice('blogcat/'.length);
    const category = (cms.blogCategories || []).find(c => c.slug === slug);
    const posts = category ? cms.posts.filter(p => p.status === 'live' && p.category === category.name) : [];
    const path = `/blog/category/${slug}`;
    if (!category || !category.visible) {
      return {
        title: `Category not found | ${brand}`,
        description: 'That blog category is not available. Browse the SEO blog instead.',
        path: '/blog',
        origin,
        noindex: true,
        image: og,
      };
    }
    const description = `${posts.length} free, practical ${category.name} guides from ${brand}: fixes for the SEO problems website owners actually hit.`;
    return {
      title: `${category.name} — SEO Guides & Fixes | ${brand}`,
      description,
      path,
      origin,
      image: og,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'CollectionPage',
            name: `${category.name} articles`,
            description,
            url: `${origin}${path}`,
            isPartOf: { '@id': `${origin}/#website` },
          },
          {
            '@type': 'ItemList',
            numberOfItems: posts.length,
            itemListElement: posts.map((p, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: p.title,
              url: `${origin}/blog/${p.slug}`,
            })),
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
              { '@type': 'ListItem', position: 2, name: 'Blog', item: `${origin}/blog` },
              { '@type': 'ListItem', position: 3, name: category.name, item: `${origin}${path}` },
            ],
          },
        ],
      },
    };
  }

  if (route.startsWith('blog/')) {
    const slug = route.slice(5);
    const post = cms.posts.find(p => p.slug === slug && p.status === 'live');
    if (!post) {
      return {
        title: `Article not found | ${brand}`,
        description: 'That article is not available. Browse the SEO blog instead.',
        path: `/blog/${slug}`,
        origin,
        noindex: true,
        image: og,
      };
    }
    const seo = cms.seo[`post:${post.slug}`];
    const title = seo?.title || post.metaTitle || post.title;
    const description = seo?.description || post.metaDescription || post.excerpt;
    return {
      title,
      description,
      path: `/blog/${post.slug}`,
      origin,
      noindex: seo?.noindex,
      canonicalOverride: seo?.slug,
      image: post.featuredImage || og,
      imageAlt: post.featuredImageAlt || post.title,
      type: 'article',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description,
        datePublished: post.date,
        author: { '@type': 'Organization', name: post.author || brand },
        publisher: { '@id': `${origin}/#organization` },
        mainEntityOfPage: `${origin}/blog/${post.slug}`,
        keywords: (post.keywords || []).join(', '),
        ...(post.featuredImage ? { image: post.featuredImage } : {}),
      },
    };
  }

  if (route.startsWith('p/')) {
    // A top-level slug carries either a tool (/plagiarism-checker) or a CMS
    // page (/about, /privacy — short legal URLs map onto the stored slugs).
    const rootSlug = route.slice(2);
    const tool = cms.tools.find(t => t.slug === rootSlug && t.status === 'live');
    if (tool && !cms.pages.some(p => p.slug === storedSlugForRoute(rootSlug))) {
      const toolSeo = cms.seo[`tool:${tool.slug}`];
      const toolTitle = toolSeo?.title || `${tool.name} — Free Online Tool | ${brand}`;
      const toolDescription = toolSeo?.description || tool.description;
      return {
        title: toolTitle,
        description: toolDescription,
        path: `/${tool.slug}`,
        origin,
        noindex: toolSeo?.noindex,
        canonicalOverride: toolSeo?.slug,
        image: tool.featuredImage || og,
        imageAlt: tool.featuredImageAlt || tool.name,
        jsonLd: webAppNode(origin, tool.name, toolDescription, `${origin}/${tool.slug}`),
      };
    }
    // Short legal URLs (/privacy) map onto the stored CMS slugs.
    const slug = storedSlugForRoute(rootSlug);
    const page = cms.pages.find(p => p.slug === slug);
    if (!page || page.status !== 'live') {
      return {
        title: `Page not available | ${brand}`,
        description: 'This page has not been published yet.',
        path: `/${routeSlugForStored(slug)}`,
        origin,
        noindex: true,
        image: og,
      };
    }
    const seo = cms.seo[`page:${page.slug}`];
    const title = seo?.title || page.metaTitle || page.title;
    const description = seo?.description || page.metaDescription;
    return {
      title,
      description,
      path: `/${routeSlugForStored(page.slug)}`,
      origin,
      noindex: seo?.noindex,
      canonicalOverride: seo?.slug,
      image: page.featuredImage || og,
      imageAlt: page.featuredImageAlt || page.title,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: page.title,
        description,
        url: `${origin}/${routeSlugForStored(page.slug)}`,
        isPartOf: { '@id': `${origin}/#website` },
        publisher: { '@id': `${origin}/#organization` },
      },
    };
  }

  if (route === 'competitor-analysis') {
    const seo = cms.seo['competitor-analysis'];
    const title = seo?.title || `SEO Competitor Analysis — Compare Two Websites Free | ${brand}`;
    const description = seo?.description || 'Compare your website with a competitor: overall SEO scores, domain registration, on-page checks, Google-style SERP previews and a two-column full audit. Free, no sign-up.';
    return {
      title,
      description,
      path: '/competitor-analysis',
      origin,
      noindex: seo?.noindex,
      canonicalOverride: seo?.slug,
      image: og,
      jsonLd: webAppNode(origin, 'SEO Competitor Analysis', description, `${origin}/competitor-analysis`),
    };
  }

  if (route === 'notfound') {
    return {
      title: `Page not found | ${brand}`,
      description: 'The page you are looking for does not exist or has been moved. Head back to the free SEO audit tool.',
      path: '/',
      origin,
      noindex: true,
      canonicalOverride: '/',
      image: og,
    };
  }

  return {
    title: brand,
    description: cms.settings.tagline || `Free SEO audit and online tools from ${brand}.`,
    path: '/',
    origin,
    image: og,
  };
};

/** The author/site name used across meta tags — always the CMS brand. */
const FALLBACK_BRAND = 'SEO Audit Tools';

export const applyPageSeo = (page: PageSeo, brandName: string = FALLBACK_BRAND) => {
  const canonical = page.canonicalOverride
    ? (/^https?:\/\//i.test(page.canonicalOverride)
      ? page.canonicalOverride
      : absoluteUrl(page.origin, page.canonicalOverride))
    : absoluteUrl(page.origin, page.path);
  const image = page.image || defaultOg(page.origin);
  const robots = page.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

  document.title = page.title;
  setMeta('name', 'description', page.description);
  setMeta('name', 'robots', robots);
  setMeta('name', 'author', brandName);
  setLink('canonical', canonical);

  setMeta('property', 'og:site_name', brandName);
  setMeta('property', 'og:locale', 'en_GB');
  setMeta('property', 'og:type', page.type || 'website');
  setMeta('property', 'og:url', canonical);
  setMeta('property', 'og:title', page.title);
  setMeta('property', 'og:description', page.description);
  setMeta('property', 'og:image', image);
  setMeta('property', 'og:image:width', '1200');
  setMeta('property', 'og:image:height', '630');
  setMeta('property', 'og:image:alt', page.imageAlt || page.title);

  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', page.title);
  setMeta('name', 'twitter:description', page.description);
  setMeta('name', 'twitter:image', image);

  ['article-jsonld', 'tool-jsonld', 'tools-jsonld'].forEach(id => document.getElementById(id)?.remove());
  let ld = document.getElementById('page-jsonld') as HTMLScriptElement | null;
  if (!page.jsonLd) {
    ld?.remove();
    return;
  }
  if (!ld) {
    ld = document.createElement('script');
    ld.id = 'page-jsonld';
    ld.type = 'application/ld+json';
    document.head.appendChild(ld);
  }
  const payload = page.jsonLd as Record<string, unknown>;
  ld.textContent = JSON.stringify(
    payload['@context'] ? payload : { '@context': 'https://schema.org', ...payload },
  );
};

export const SeoManager: FC<{ route: string }> = ({ route }) => {
  const { state } = useCms();
  useEffect(() => {
    applyPageSeo(resolvePageSeo(route, state), state.settings.name || FALLBACK_BRAND);
  }, [route, state]);
  return null;
};
