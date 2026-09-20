import type { BlogArticle } from './types';
import { articlesCoreWebVitals } from './articles-1';
import { articlesPageSpeed } from './articles-2';
import { articlesWordPress } from './articles-3';
import { articlesGoogleIndexing } from './articles-4';

export type { BlogArticle };

export const allArticles: BlogArticle[] = [
  ...articlesCoreWebVitals,
  ...articlesPageSpeed,
  ...articlesWordPress,
  ...articlesGoogleIndexing,
].sort((a, b) => (a.date < b.date ? 1 : -1));

export const getArticle = (slug: string): BlogArticle | undefined =>
  allArticles.find(a => a.slug === slug);

export const categories = ['All', 'Core Web Vitals', 'PageSpeed', 'WordPress SEO', 'Google & Indexing'] as const;
