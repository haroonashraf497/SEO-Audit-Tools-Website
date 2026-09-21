import React, { useEffect, useMemo, useState } from 'react';
import { categories, type BlogArticle } from './index';
import { Sidebar } from '../tools/Sidebar';
import { useCms, livePosts } from '../cms/store';
import { sanitizeRichHtml } from '../utils/sanitize';

// ---------- Tiny markdown renderer (headings, bold, lists, paragraphs) ----------
const renderInline = (text: string): React.ReactNode[] => {
  // handle **bold** and *italic*
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) parts.push(<strong key={key++} className="font-semibold text-slate-900">{match[1]}</strong>);
    else parts.push(<em key={key++}>{match[2]}</em>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
};

const MarkdownContent: React.FC<{ content: string }> = ({ content }) => {
  // Content written in the CMS rich-text editor contains HTML tags; render it
  // as sanitised rich HTML. Legacy posts use the markdown parser below.
  const isRichHtml = /<[a-z][^>]*>/i.test(content);
  const html = useMemo(() => (isRichHtml ? sanitizeRichHtml(content) : ''), [content, isRichHtml]);
  const blocks = useMemo(() => {
    if (isRichHtml) return [];
    const lines = content.split('\n');
    const out: React.ReactNode[] = [];
    let listItems: string[] = [];
    let key = 0;

    const flushList = () => {
      if (listItems.length) {
        out.push(
          <ul key={key++} className="space-y-2 my-5 pl-1">
            {listItems.map((item, i) => (
              <li key={i} className="flex gap-3 text-slate-700 leading-relaxed">
                <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                <span>{renderInline(item)}</span>
              </li>
            ))}
          </ul>
        );
        listItems = [];
      }
    };

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) { flushList(); continue; }
      if (line.startsWith('### ')) {
        flushList();
        out.push(<h3 key={key++} className="text-xl font-bold text-slate-900 mt-8 mb-3">{renderInline(line.slice(4))}</h3>);
      } else if (line.startsWith('## ')) {
        flushList();
        out.push(<h2 key={key++} className="text-2xl font-bold text-slate-900 mt-10 mb-4">{renderInline(line.slice(3))}</h2>);
      } else if (line.startsWith('- ')) {
        listItems.push(line.slice(2));
      } else {
        flushList();
        out.push(<p key={key++} className="text-slate-700 leading-relaxed my-4">{renderInline(line)}</p>);
      }
    }
    flushList();
    return out;
  }, [content, isRichHtml]);

  if (isRichHtml) return <div className="rich-text text-slate-700" dangerouslySetInnerHTML={{ __html: html }} />;

  return <div>{blocks}</div>;
};

// ---------- Category badge colors (subtle) ----------
const categoryColor: Record<string, string> = {
  'Core Web Vitals': 'bg-indigo-50 text-indigo-700 border-indigo-100',
  'PageSpeed': 'bg-violet-50 text-violet-700 border-violet-100',
  'WordPress SEO': 'bg-slate-100 text-slate-700 border-slate-200',
  'Google & Indexing': 'bg-blue-50 text-blue-700 border-blue-100',
};

const formatDate = (iso: string): string => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ---------- Article card ----------
const ArticleCard: React.FC<{ article: BlogArticle }> = ({ article }) => (
  <article className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all flex flex-col">
    {article.featuredImage && (
      <a href={`#/blog/${article.slug}`} className="block -mx-1 -mt-1 mb-5 overflow-hidden rounded-xl bg-slate-100 aspect-[1.91/1]">
        <img src={article.featuredImage} alt={article.featuredImageAlt || article.title} width="1200" height="630" loading="lazy" className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300" onError={e => { e.currentTarget.parentElement?.classList.add('hidden'); }} />
      </a>
    )}
    <div className="flex items-center gap-3 mb-4">
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${categoryColor[article.category]}`}>
        {article.category}
      </span>
      <span className="text-xs text-slate-400">{article.readTime}</span>
    </div>
    <h3 className="text-lg font-bold text-slate-900 leading-snug mb-3">
      <a href={`#/blog/${article.slug}`} className="hover:text-indigo-600 transition-colors">
        {article.title}
      </a>
    </h3>
    <p className="text-sm text-slate-600 leading-relaxed mb-4 flex-1">{article.excerpt}</p>
    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
      <time dateTime={article.date} className="text-xs text-slate-400">{formatDate(article.date)}</time>
      <a href={`#/blog/${article.slug}`} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1">
        Read article
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
      </a>
    </div>
  </article>
);

// ---------- Blog listing page ----------
export const BlogList: React.FC = () => {
  const { state } = useCms();
  const posts = useMemo(() => livePosts(state) as unknown as BlogArticle[], [state]);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const filtered = activeCategory === 'All' ? posts : posts.filter(a => a.category === activeCategory);

  return (
    <div className="pt-10 pb-20 px-4 min-h-screen">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] gap-8 items-start">
        <div className="min-w-0">
          <header className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              The SEO Audit Tool{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Blog</span>
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Practical, no-fluff guides on the SEO problems people are actually struggling with:
              Core Web Vitals, PageSpeed scores, WordPress performance, and Google indexing.
            </p>
          </header>

          {/* Category filter */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-10" role="tablist" aria-label="Filter articles by category">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {filtered.map(article => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        </div>
        <Sidebar />
      </div>
    </div>
  );
};

// ---------- Single article page ----------
export const BlogArticlePage: React.FC<{ slug: string }> = ({ slug }) => {
  const { state } = useCms();
  const article = useMemo(() => (state.posts.find(p => p.slug === slug && p.status === 'live') || null) as unknown as BlogArticle | null, [state.posts, slug]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [article]);

  if (!article) {
    return (
      <div className="pt-16 pb-20 px-4 text-center min-h-screen">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Article not found</h1>
        <a href="#/blog" className="text-indigo-600 font-semibold hover:underline">Back to the blog</a>
      </div>
    );
  }

  const related = (livePosts(state) as unknown as BlogArticle[]).filter(a => a.category === article.category && a.slug !== article.slug).slice(0, 2);

  return (
    <div className="pt-10 pb-20 px-4 min-h-screen">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] gap-8 items-start">
      <article className="min-w-0 w-full">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${categoryColor[article.category]}`}>
              {article.category}
            </span>
            <time dateTime={article.date} className="text-sm text-slate-400">{formatDate(article.date)}</time>
            <span className="text-sm text-slate-400">·</span>
            <span className="text-sm text-slate-400">{article.readTime}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight mb-4">{article.title}</h1>
          <p className="text-lg text-slate-600 leading-relaxed">{article.excerpt}</p>
          <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-200">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
              SP
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{article.author}</p>
              <p className="text-xs text-slate-400">SEO & Performance Specialists</p>
            </div>
          </div>
        </header>

        {article.featuredImage && (
          <figure className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 aspect-[1.91/1]">
            <img src={article.featuredImage} alt={article.featuredImageAlt || article.title} width="1200" height="630" className="w-full h-full object-cover" onError={e => { e.currentTarget.parentElement?.classList.add('hidden'); }} />
          </figure>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-10 shadow-sm">
          <MarkdownContent content={article.content} />
        </div>

        {/* CTA */}
        <div className="mt-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-2">Check your own site in 30 seconds</h2>
          <p className="text-indigo-100 mb-6">Run a free SEO audit and see exactly where your pages stand on the issues covered in this article.</p>
          <a href="#/" className="inline-block bg-white text-indigo-600 px-8 py-3 rounded-xl font-semibold hover:shadow-lg transition-shadow">
            Run Free SEO Audit
          </a>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-14">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Keep reading</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {related.map(a => (
                <ArticleCard key={a.slug} article={a} />
              ))}
            </div>
          </div>
        )}
      </article>
      <Sidebar currentPost={article.slug} />
      </div>
    </div>
  );
};
