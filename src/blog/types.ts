export interface BlogArticle {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  category: 'Core Web Vitals' | 'PageSpeed' | 'WordPress SEO' | 'Google & Indexing';
  date: string;
  readTime: string;
  author: string;
  excerpt: string;
  content: string;
  featuredImage?: string;
  featuredImageAlt?: string;
}
