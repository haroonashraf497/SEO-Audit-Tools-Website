import { useEffect, type FC } from 'react';
import { useCms, type CmsState } from '../cms/store';

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

const absoluteUrl = (origin: string, path: string): string => {
  if (!path || path === '/' || path === '#/' || path === '#') return `${origin}/`;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('#')) return `${origin}/${path}`;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${origin}/#${clean}`;
};

const defaultOg = (origin: string) => `${origin}${DEFAULT_OG_PATH}`;

const orgNode = (origin: string, brand: string) => ({
  '@type': 'Organization',
  '@id': `${origin}/#organization`,
  name: 'EKSTRUH LTD',
  alternateName: brand,
  url: `${origin}/`,
  email: 'help@seoaudittools.pk',
  areaServed: 'Pakistan',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Victoria Grove',
    addressLocality: 'Bolton',
    postalCode: 'BL1 4JW',
    addressCountry: 'GB',
  },
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
    const title = seo?.title || `SEO Audit Tools — Free Website SEO Checker | EKSTRUH LTD`;
    const description = seo?.description || 'Free SEO audit tool plus 150+ practical SEO, speed, IP, PDF, calculator and converter tools from EKSTRUH LTD — built for website owners in Pakistan and worldwide.';
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

  if (route === 'tools') {
    const live = cms.tools.filter(t => t.status === 'live');
    const seo = cms.seo.tools;
    const title = seo?.title || `${live.length}+ Free SEO Tools — Audit, Speed, Calculator & Converter Tools`;
    const description = seo?.description || `Browse ${live.length}+ free tools from EKSTRUH LTD for Pakistan and worldwide: website SEO audit, page speed, keyword research, backlinks, IP lookup, PDF tools, calculators and unit converters.`;
    return {
      title,
      description,
      path: '/tools',
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
          url: `${origin}/tool/${t.slug}`,
        })),
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
        path: `/tool/${slug}`,
        origin,
        noindex: true,
        image: og,
      };
    }
    const seo = cms.seo[`tool:${tool.slug}`];
    const title = seo?.title || `${tool.name} — Free Online Tool | ${brand}`;
    const description = seo?.description || tool.description;
    const url = `${origin}/tool/${tool.slug}`;
    return {
      title,
      description,
      path: `/tool/${tool.slug}`,
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
    const slug = route.slice(2);
    const page = cms.pages.find(p => p.slug === slug);
    if (!page || page.status !== 'live') {
      return {
        title: `Page not available | ${brand}`,
        description: 'This page has not been published yet.',
        path: `/${slug}`,
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
      path: `/${page.slug}`,
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
        url: `${origin}/${page.slug}`,
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
    title: `${brand} | EKSTRUH LTD`,
    description: cms.settings.tagline || 'Free SEO audit and online tools from EKSTRUH LTD.',
    path: '/',
    origin,
    image: og,
  };
};

export const applyPageSeo = (page: PageSeo) => {
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
  setMeta('name', 'author', 'EKSTRUH LTD');
  setLink('canonical', canonical);

  setMeta('property', 'og:site_name', 'SEO Audit Tools');
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
    applyPageSeo(resolvePageSeo(route, state));
  }, [route, state]);
  return null;
};
