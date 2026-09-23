import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clearAdminSession, readAdminSession, saveAdminPassword, verifyAdminLogin, writeAdminSession } from './auth';
import { tools as staticTools, type ToolCategory, type InputType } from '../tools/data';
import { allArticles } from '../blog';

/* ============================================================
   SEO Audit Tool — built-in CMS
   Content lives in the browser (localStorage) and the public site
   renders from this store. Export JSON to version it in the repo.
   ============================================================ */

export type Status = 'live' | 'hidden' | 'draft';

export interface SeoEntry { title: string; description: string; slug?: string; noindex?: boolean }

export interface CmsTool {
  slug: string; name: string; description: string; category: ToolCategory;
  engine?: string; input: InputType; placeholder?: string; placeholder2?: string;
  status: Status; custom?: boolean; badge?: string; builtin: boolean;
  featuredImage?: string; featuredImageAlt?: string;
  /** Optional rich-HTML override for the tool page's "About" content.
   *  When empty, the category-level template from toolContent.tsx is used. */
  about?: string;
}

export interface CmsPost {
  slug: string; title: string; metaTitle: string; metaDescription: string; excerpt: string;
  content: string; category: string; date: string; readTime: string; author: string;
  keywords: string[]; status: Status; builtin: boolean;
  featuredImage?: string; featuredImageAlt?: string;
}

export type PageBlock =
  | { id: string; type: 'heading'; text: string; level: 2 | 3 }
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'list'; items: string[] }
  | { id: string; type: 'table'; head: string[]; rows: string[][] }
  | { id: string; type: 'cta'; text: string; label: string; href: string };

export interface CmsPage {
  id: string; slug: string; title: string; metaTitle: string; metaDescription: string;
  /** Rich-text HTML document — the single source of truth for the page body. */
  content?: string;
  /** Legacy block list, kept only so content saved in older builds can migrate. */
  blocks?: PageBlock[]; status: Status;
  featuredImage?: string; featuredImageAlt?: string;
}

export interface SidebarItem { id: string; label: string; href: string; visible: boolean; badge?: string }

export type SidebarWidgetType = 'links' | 'text' | 'image' | 'code';
export type SidebarLinkSource = 'tools' | 'pages' | 'posts' | 'manual';

export interface SidebarWidgetLink {
  id: string;
  label: string;
  href: string;
  badge?: string;
  visible: boolean;
}

export interface SidebarWidget {
  id: string;
  title: string;
  type: SidebarWidgetType;
  visible: boolean;
  source?: SidebarLinkSource;
  linkRefs?: string[];
  links?: SidebarWidgetLink[];
  content?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageHref?: string;
}

export interface SidebarConfig {
  searchBox: boolean; searchPlaceholder: string;
  relevantTools: boolean; relevantCount: number; relevantTitle: string;
  popular: boolean; popularTitle: string; hiddenPopular: string[];
  latest: boolean; latestTitle: string; latestCount: number;
  cta: boolean; ctaTitle: string; ctaText: string; ctaLabel: string; ctaHref: string;
  widgets: SidebarWidget[];
  /** Legacy schema kept only so existing localStorage data can be migrated. */
  customItems?: SidebarItem[];
}

export interface NavItem { id: string; label: string; href: string; visible: boolean }

export interface SectionFlags {
  hero: boolean; auditTool: boolean; results: boolean; features: boolean; howItWorks: boolean;
  whyAudit: boolean; whoBenefits: boolean; freeTools: boolean; fromBlog: boolean; cta: boolean; footer: boolean;
}

export interface SiteSettings { name: string; domain: string; tagline: string; footerNote: string }

export interface CmsState {
  version: number;
  tools: CmsTool[];
  posts: CmsPost[];
  pages: CmsPage[];
  seo: Record<string, SeoEntry>;
  sidebar: SidebarConfig;
  sections: SectionFlags;
  settings: SiteSettings;
  nav: NavItem[];
  passcode: string;
}

/* ---------------- defaults (seeded from the built-in content) ---------------- */
const uid = () => Math.random().toString(36).slice(2, 9);

const defaultTools: CmsTool[] = [
  ...staticTools.map(t => ({ ...t, status: 'live' as Status, builtin: true })),
  {
    slug: 'competitor-analysis',
    name: 'Competitor Analysis',
    description: 'Compare two websites with matching on-page, technical, mobile, security and performance audits.',
    category: 'checker',
    input: 'twotext',
    placeholder: 'https://yourwebsite.com',
    placeholder2: 'https://competitor.com',
    status: 'live',
    builtin: true,
  },
];

const defaultPosts: CmsPost[] = allArticles.map(a => ({
  slug: a.slug, title: a.title, metaTitle: a.metaTitle, metaDescription: a.metaDescription,
  excerpt: a.excerpt, content: a.content, category: a.category, date: a.date, readTime: a.readTime,
  author: a.author, keywords: a.keywords, featuredImage: a.featuredImage, featuredImageAlt: a.featuredImageAlt, status: 'live' as Status, builtin: true,
}));

export const defaultState: CmsState = {
  version: 12,
  tools: defaultTools,
  posts: defaultPosts,
  pages: [
    {
      id: uid(), slug: 'about', title: 'About SEO Audit Tools', status: 'live',
      metaTitle: 'About SEO Audit Tools | Free SEO Analysis Platform — EKSTRUH LTD', metaDescription: 'About SEO Audit Tools: a free platform from EKSTRUH LTD for website SEO audits, competitor analysis and instant PDF reports — built for website owners in Pakistan and worldwide.',
      blocks: [
        { id: uid(), type: 'text', text: 'SEO Audit Tools is a free online platform built to help website owners, business owners, bloggers, digital marketers, and web developers understand and improve their website\'s performance in search engines. We built this tool to make professional SEO analysis accessible to everyone, without the need for expensive software or technical expertise.' },
        { id: uid(), type: 'text', text: 'Our platform is built to serve website owners in Pakistan and around the world, backed by fast, reliable hosting infrastructure. Every report we generate reflects real data from your website, presented in plain English with clear, prioritised recommendations you can act on immediately.' },
        { id: uid(), type: 'heading', text: 'Who We Are', level: 2 },
        { id: uid(), type: 'text', text: 'SEO Audit Tools is operated by EKSTRUH LTD, a company registered in England and Wales and based in Bolton, England. Our team serves website owners across Pakistan — Karachi, Lahore, Islamabad, Peshawar and beyond — as well as users around the world, and we specialise in building practical web tools that help businesses grow their online presence through better search engine optimisation.' },
        { id: uid(), type: 'text', text: 'We built this platform because most SEO tools are either too expensive, too complicated, or designed for large agencies rather than everyday website owners. Our goal is to change that by giving every website owner access to the same quality of SEO analysis that professionals use.' },
        { id: uid(), type: 'heading', text: 'What We Offer', level: 2 },
        { id: uid(), type: 'text', text: 'Our tools give you strong analysis features to help you:' },
        { id: uid(), type: 'list', items: ['Title tags, meta descriptions, and heading structure', 'Image alt text and internal linking', 'Page speed and Core Web Vitals', 'Mobile usability across the most common device sizes worldwide', 'XML sitemap validity and robots.txt configuration', 'HTTPS and SSL certificate status', 'Canonical tags and URL structure', 'Broken links and redirect chains'] },
        { id: uid(), type: 'text', text: 'Every check feeds into a detailed SEO audit report available to download in PDF format instantly, free of charge.' },
        { id: uid(), type: 'text', text: 'We also offer a free SEO Competitor Analysis tool that lets you compare your website directly against competitor domains. Identify which keywords they rank for, how they structure their content, and where your site has the clearest opportunity to gain ground.' },
        { id: uid(), type: 'heading', text: 'Why Choose Our SEO Audit Tools?', level: 2 },
        { id: uid(), type: 'list', items: ['Free with no sign-up required: Enter your website URL and get your full SEO report within seconds. No account, no payment, no software to install.', 'Plain English results: Every issue comes explained in simple language with a clear recommendation. You do not need an SEO background to understand and act on your report.', 'Comprehensive analysis in one place: On-page SEO, technical issues, page speed, mobile usability, security, and competitor comparison all appear in a single report.', 'Downloadable PDF report: Save your report, share it with your development team, or present it to a client in a professional format.', 'Reliable, Global Infrastructure: Our tool tests mobile usability across the most common device sizes used by visitors worldwide, giving you accurate, relevant results wherever your audience is based.'] },
        { id: uid(), type: 'heading', text: 'Our Commitment to Quality', level: 2 },
        { id: uid(), type: 'text', text: 'We update our SEO audit checks regularly to reflect the latest Google algorithm requirements and best practices. We do not show guesses or placeholder data. Every result in your report comes from a real analysis of your website.' },
        { id: uid(), type: 'text', text: 'If you have questions about your results, want to suggest a feature, or need to get in touch with us, visit our Contact Us page. We read every message and aim to respond promptly.' },
        { id: uid(), type: 'cta', text: 'Questions about your results, or want to suggest a feature?', label: 'Contact Us', href: '#/p/contact' },
      ],
    },
    {
      id: uid(), slug: 'privacy-policy', title: 'Privacy Policy', status: 'live',
      metaTitle: 'Privacy Policy | SEO Audit Tools — EKSTRUH LTD', metaDescription: 'Privacy Policy for SEO Audit Tools (seoaudittools.pk), operated by EKSTRUH LTD: the data we collect, our lawful bases under the UK GDPR and Data Protection Act 2018, Google AdSense and affiliate cookies, and your legal rights.',
      blocks: [
        { id: uid(), type: 'text', text: 'Last Updated: 23 SEP 2026' },
        { id: uid(), type: 'heading', text: '1. Introduction', level: 2 },
        { id: uid(), type: 'text', text: 'Welcome to SEO Audit Tools. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you about how we handle data when you visit our website, use our free online SEO Audit Tools, and interact with our advertisements or affiliate links. Our services are entirely free to use and do not require you to create an account, register, or provide any login credentials to access any report features.' },
        { id: uid(), type: 'heading', text: '2. Who We Are (Data Controller)', level: 2 },
        { id: uid(), type: 'text', text: 'The website and SEO Audit Tools are operated by EKSTRUH LTD, a company registered in England and Wales.' },
        { id: uid(), type: 'list', items: ['Company Name: EKSTRUH LTD', 'Company Registration Number: 16905290', 'Registered Office Address: Victoria Grove, Bolton, United Kingdom, BL1 4JW', 'Contact Email: help@seoaudittools.pk'] },
        { id: uid(), type: 'text', text: 'Because we operate in the United Kingdom, we handle data in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. If you have concerns, you have the right to lodge a complaint with the UK Information Commissioner\'s Office (ICO) at https://ico.org.uk.' },
        { id: uid(), type: 'text', text: 'EKSTRUH LTD has not appointed a Data Protection Officer as we do not meet the threshold requiring one under UK GDPR Article 37.' },
        { id: uid(), type: 'text', text: 'Although our registered office is in the United Kingdom, seoaudittools.pk is built for website owners in Pakistan and worldwide. This policy, and the UK data-protection standards it describes, apply equally to every visitor regardless of where you live.' },
        { id: uid(), type: 'heading', text: '3. The Data We Collect and Process', level: 2 },
        { id: uid(), type: 'text', text: 'Because our platform requires no user registration, we do not collect identity information like your name, home address, or phone number. However, to run our tool and display ads, we automatically process the following information:' },
        { id: uid(), type: 'list', items: ['Technical Data: This includes your Internet Protocol (IP) address, your browser type and version, operating system, and the time/date of your visit.', 'Audit Query Data: This includes the third-party website URLs you paste into our search bar to run an SEO analysis. Our backend script must temporarily process this parameter to deliver your score and PDF report.', 'Tracking & Interaction Data: Data regarding how you navigate our pages, click on affiliate links, or interact with displayed advertisements.'] },
        { id: uid(), type: 'heading', text: '4. Lawful Basis for Processing Your Data', level: 2 },
        { id: uid(), type: 'text', text: 'Under the UK GDPR, we must have a valid lawful basis for processing your personal data. The following table explains the basis we rely on for each type of data we collect:' },
        { id: uid(), type: 'list', items: ['Technical Data (IP address, browser, OS): Processed on the basis of Legitimate Interests (UK GDPR Article 6(1)(f)). We have a legitimate interest in maintaining the security, stability, and performance of our website.', 'Audit Query Data (URLs you submit): Processed on the basis of Contract / Service Delivery (UK GDPR Article 6(1)(b)). Processing this data is necessary to provide you with the SEO audit report you requested.', 'Advertising & Tracking Cookies (Google AdSense): Processed on the basis of Consent (UK GDPR Article 6(1)(a)). We obtain your consent via our cookie banner before placing advertising or tracking cookies on your device.', 'Affiliate Link Tracking Cookies: Processed on the basis of Consent (UK GDPR Article 6(1)(a)). We obtain your consent via our cookie banner before placing affiliate tracking cookies on your device.'] },
        { id: uid(), type: 'heading', text: '5. Sessions and Server Logs', level: 2 },
        { id: uid(), type: 'text', text: 'Our website uses temporary sessions and server logs to deliver your SEO audit results securely and efficiently.' },
        { id: uid(), type: 'list', items: ['Sessions: When you submit a URL for an audit, our tool creates a temporary session on our servers to process your request, track your audit progress, and generate your PDF report. This session data is automatically cleared when you close your browser and is never stored permanently.', 'Server Logs: For security purposes, our servers automatically maintain activity logs of network requests. We use these logs strictly to diagnose errors, block malicious automated bots, and prevent unauthorised access or server overloads.'] },
        { id: uid(), type: 'heading', text: '6. Google AdSense and Third-Party Advertising Cookies', level: 2 },
        { id: uid(), type: 'text', text: 'We partner with third-party networks, specifically Google AdSense, to display advertisements on our website to keep our tools 100% free to the public.' },
        { id: uid(), type: 'list', items: ['Google and its partner vendors use tracking cookies to serve personalised ads to you based on your previous visits to this website or other platforms across the internet.', 'These advertising providers may process technical and online identifiers, including IP addresses, browser information, device identifiers, and interaction data, to measure advertising performance and deliver personalised advertisements.', 'Your Choices: You can completely opt-out of personalised Google advertising tracking by modifying your preferences at https://adssettings.google.com', 'Google Privacy Policy: https://policies.google.com/privacy', 'Google AdSense Policy: https://policies.google.com/technologies/ads'] },
        { id: uid(), type: 'heading', text: '7. Affiliate Link Disclosures and Tracking Cookies', level: 2 },
        { id: uid(), type: 'text', text: 'This website contains affiliate links recommending premium external SEO software, web hosting providers, or digital marketing platforms.' },
        { id: uid(), type: 'list', items: ['If you click on an affiliate link and subsequently make a purchase on that external vendor\'s website, a dedicated tracking cookie is placed in your browser by that third-party affiliate network.', 'This tracking cookie is used solely to assign referral credit to EKSTRUH LTD so we can earn a small commission at no extra cost to you. We do not have access to your personal billing details or external account details during this transaction.'] },
        { id: uid(), type: 'heading', text: '8. Cookie Policy', level: 2 },
        { id: uid(), type: 'text', text: 'Our website uses cookies to operate correctly, display advertisements, and track affiliate referrals. Cookies are small text files stored on your device by your browser.' },
        { id: uid(), type: 'text', text: 'We use the following categories of cookies:' },
        { id: uid(), type: 'list', items: ['Essential Cookies: Required for our website and PHP audit tool to function. These include session cookies that manage your audit progress and PDF report generation. These cannot be disabled without breaking core functionality.', 'Google Analytics Cookies: Used to help us understand how visitors interact with our website by collecting statistical and usage information such as pages visited, device type, browser information, and approximate geographic location. These cookies are only placed after you provide consent through our cookie banner.', 'Advertising Cookies (Google AdSense): Placed by Google to serve personalised advertisements based on your browsing history. These require your consent before being placed.', 'Affiliate Tracking Cookies: Placed by third-party affiliate networks when you click an affiliate link on our website. These track referral credits for commission purposes.'] },
        { id: uid(), type: 'text', text: 'Where we rely on your consent as the lawful basis, you have the right to withdraw that consent at any time. Withdrawing consent will not affect the lawfulness of any processing carried out before you withdrew it.' },
        { id: uid(), type: 'text', text: 'You can manage your cookie preferences at any time using our cookie consent tool at the bottom of this page. You can withdraw your consent or manage your cookie preferences at any time by:' },
        { id: uid(), type: 'list', items: ['Adjusting your browser settings to block or delete cookies', 'Visiting https://adssettings.google.com to manage Google advertising preferences', 'Visiting https://www.aboutcookies.org for general guidance on managing cookies in all browsers'] },
        { id: uid(), type: 'text', text: 'Please note that disabling essential cookies will affect the functionality of our SEO Audit Tools.' },
        { id: uid(), type: 'heading', text: '9. Data Retention', level: 2 },
        { id: uid(), type: 'list', items: ['Server Logs: Retained automatically for security and debugging for a maximum of 30 days before overwrite.', 'Audit Reports: Generated PDF reports are temporarily cached on our servers for download purposes and are automatically deleted within 24 hours.'] },
        { id: uid(), type: 'heading', text: '10. International Data Transfers', level: 2 },
        { id: uid(), type: 'text', text: 'Some of the third-party services we use, including Google AdSense and affiliate tracking networks, may transfer and process your data outside the United Kingdom or European Economic Area (EEA).' },
        { id: uid(), type: 'text', text: 'Where such transfers occur, we ensure that appropriate safeguards are in place in accordance with UK GDPR requirements. Google LLC participates in and complies with the UK-US Data Bridge framework, which provides a legal mechanism for transferring personal data from the UK to the United States.' },
        { id: uid(), type: 'text', text: 'For more information on how Google handles international data transfers, please visit https://policies.google.com/privacy.' },
        { id: uid(), type: 'heading', text: '11. Your Legal Rights under UK GDPR', level: 2 },
        { id: uid(), type: 'text', text: 'Even without a registered account profile, you retain legal rights over your technical digital footprint under UK law. Under the UK GDPR, you have the following rights:' },
        { id: uid(), type: 'list', items: ['Right of Access: You have the right to request a copy of the personal data we hold about you.', 'Right to Rectification: You have the right to request that we correct any inaccurate or incomplete personal data we hold about you.', 'Right to Erasure: You have the right to request that we delete your personal data (the "right to be forgotten"), where there is no legitimate reason for us to continue processing it.', 'Right to Restriction: You have the right to request that we restrict the processing of your personal data in certain circumstances.', 'Right to Object: You have the right to object to the processing of your personal data where we rely on legitimate interests as our lawful basis.', 'Right to Data Portability: You have the right to request that we transfer your personal data to you or a third party in a structured, commonly used, machine-readable format.', 'Automated Decision-Making: We do not carry out any automated decision-making or profiling about you that produces legal or similarly significant effects.'] },
        { id: uid(), type: 'text', text: 'Please note that our website does not currently respond to Do Not Track (DNT) browser signals.' },
        { id: uid(), type: 'text', text: 'To exercise any of these rights, please contact us at help@seoaudittools.pk. We will respond to all requests within 30 days in accordance with UK GDPR requirements.' },
        { id: uid(), type: 'text', text: 'If you are not satisfied with our response, you have the right to lodge a complaint with the Information Commissioner\'s Office (ICO) at https://ico.org.uk.' },
        { id: uid(), type: 'heading', text: '12. Children\'s Privacy', level: 2 },
        { id: uid(), type: 'text', text: 'Our SEO Audit Tools is intended for use by website owners, businesses, marketers, and digital professionals. Our services are not directed at children under the age of 18.' },
        { id: uid(), type: 'text', text: 'We do not knowingly collect personal data from children under 18. If you are a parent or guardian and believe your child has provided us with personal data, please contact us at help@seoaudittools.pk and we will promptly delete such information from our records.' },
        { id: uid(), type: 'heading', text: '13. Changes to This Privacy Policy', level: 2 },
        { id: uid(), type: 'text', text: 'We reserve the right to modify this Privacy Policy at any time. The current version of this Privacy Policy is always accessible on this page.' },
        { id: uid(), type: 'text', text: 'When we make changes, we will update the Last Updated date at the top of this page. We encourage you to review this Privacy Policy periodically to stay informed about how we protect your information. Where appropriate, we may provide additional notice of significant changes to this Privacy Policy on our website.' },
        { id: uid(), type: 'heading', text: '14. Contact Us', level: 2 },
        { id: uid(), type: 'text', text: 'If you have any questions, concerns, or requests regarding this Privacy Policy or how we handle your personal data, please contact us: help@seoaudittools.pk' },
      ],
    },
    {
      id: uid(), slug: 'contact', title: 'Contact', status: 'live',
      metaTitle: 'Contact SEO Audit Tools | EKSTRUH LTD Support', metaDescription: 'Get in touch with EKSTRUH LTD about SEO Audit Tools: support, bug reports, data protection queries, partnerships and feedback. We usually reply within one business day.',
      blocks: [
        { id: uid(), type: 'heading', text: 'Talk to us', level: 2 },
        { id: uid(), type: 'text', text: 'Found a bug, need a tool we do not have yet, or want to work with us? Email <a href="mailto:help@seoaudittools.pk">help@seoaudittools.pk</a> and we will get back to you, usually within one business day. There is no ticket system and no phone menu — your email goes straight to the people who build the site.' },
        { id: uid(), type: 'heading', text: 'Response Time', level: 2 },
        { id: uid(), type: 'text', text: 'Within one business day (Monday to Friday, Pakistan Standard Time). Urgent data-protection requests are prioritised.' },
        { id: uid(), type: 'heading', text: 'Before You Write', level: 2 },
        { id: uid(), type: 'text', text: 'Check our <a href="#/p/privacy-policy">Privacy Policy</a> and <a href="#/p/cookie-policy">Cookie Policy</a> for data-related questions.' },
        { id: uid(), type: 'text', text: 'For tool issues, describe the IP or domain you tried and the error you saw — it helps us fix things faster.' },
        { id: uid(), type: 'heading', text: 'Reporting a bug', level: 2 },
        { id: uid(), type: 'text', text: 'The more you tell us, the faster we can fix it. Helpful things to include: the address of the tool page, the input you gave it, your browser and device, and what you expected to happen versus what actually did. A screenshot never hurts.' },
        { id: uid(), type: 'heading', text: 'Questions about your data', level: 2 },
        { id: uid(), type: 'text', text: 'Because our tools process your inputs in your browser, we usually hold nothing to update or delete. If you want to exercise any right under the UK GDPR — or simply want to know what, if anything, we hold — email us and we will give you a straight answer. You also have the right to complain to the Information Commissioner\'s Office at ico.org.uk.' },
        { id: uid(), type: 'cta', text: 'While you are here,', label: 'Browse 150+ free tools', href: '#/tools' },
      ],
    },
    {
      id: uid(), slug: 'faq', title: 'FAQ', status: 'live',
      metaTitle: 'FAQ | SEO Audit Tools — EKSTRUH LTD', metaDescription: 'Answers to common questions about SEO Audit Tools: free tools, browser-side processing, where domain data comes from, cookies and who runs the site.',
      blocks: [
        { id: uid(), type: 'heading', text: 'Your questions, answered', level: 2 },
        { id: uid(), type: 'heading', text: 'Are the tools really free?', level: 3 },
        { id: uid(), type: 'text', text: 'Yes — all 150+ of them. No accounts, no paywalls, no "free trial" that asks for a card. EKSTRUH LTD runs the site, and the tools that need revenue to keep the lights on say so honestly rather than hiding it.' },
        { id: uid(), type: 'heading', text: 'Do you upload my files or text anywhere?', level: 3 },
        { id: uid(), type: 'text', text: 'No. Every tool on this site does its work in your browser. When you compress a PDF, the file is read and written by your own device. When you paste text into the grammar or plagiarism checker, it is analysed locally. There is no upload step, because there is no server on our side receiving one.' },
        { id: uid(), type: 'heading', text: 'What happens to the URL I audit?', level: 3 },
        { id: uid(), type: 'text', text: 'When you press the audit button, we fetch the page you entered through public relay services so your browser can read it, and then the audit runs on your machine. Only that URL is sent. We do not store the page, the result or any list of the sites you have checked.' },
        { id: uid(), type: 'heading', text: 'Where does the domain registration data come from?', level: 3 },
        { id: uid(), type: 'text', text: 'From RDAP, the official registry protocol that replaced WHOIS lookups. When you check a domain, we query rdap.org, which routes to the registry that actually manages the domain — Verisign for .com, Nominet for .uk and so on. Registration and expiry dates come straight from the registry record, which is as authoritative as public data gets.' },
        { id: uid(), type: 'heading', text: 'Do you use cookies?', level: 3 },
        { id: uid(), type: 'text', text: 'Only the essential kind until you say otherwise. We set a small piece of storage to remember your cookie choice and to keep the admin session working. Analytics, advertising and affiliate tracking cookies are off unless you accept them in the banner — and you can change your mind any time from the cookie preferences link in the footer. The details are in our Cookie Policy.' },
        { id: uid(), type: 'heading', text: 'Can I use the reports for client work?', level: 3 },
        { id: uid(), type: 'text', text: 'Yes. Run audits on your own sites or your clients\' sites and use the reports however helps you. We only ask that you do not resell the tools themselves or present them as your own product.' },
        { id: uid(), type: 'heading', text: 'How accurate are the audits?', level: 3 },
        { id: uid(), type: 'text', text: 'Honest answer: they are a strong diagnostic, not a crystal ball. The checks reflect well-established on-page, technical, mobile, security and performance signals, but no score guarantees rankings — search engines weigh relevance, backlinks and intent in ways no auditor can fully see. Treat the report as a prioritised to-do list, not a verdict.' },
        { id: uid(), type: 'heading', text: 'Who is behind the site?', level: 3 },
        { id: uid(), type: 'text', text: 'EKSTRUH LTD, a company registered in England and Wales. You can read more on the About page, including our company details.' },
        { id: uid(), type: 'heading', text: 'Something looks wrong — who do I tell?', level: 3 },
        { id: uid(), type: 'text', text: 'Email help@seoaudittools.pk with the tool\'s address, what you entered and what happened. Bug reports genuinely make the site better, and we read all of them.' },
      ],
    },
    {
      id: uid(), slug: 'cookie-policy', title: 'Cookie Policy', status: 'live',
      metaTitle: 'Cookie Policy | SEO Audit Tools — EKSTRUH LTD', metaDescription: 'Cookie Policy for SEO Audit Tools (seoaudittools.pk): the cookies we use, including Google Analytics, Google AdSense and affiliate tracking cookies, how to manage your consent, and your rights under the UK GDPR and PECR.',
      blocks: [
        { id: uid(), type: 'text', text: 'Last updated: 20 SEP 2026' },
        { id: uid(), type: 'heading', text: '1. Introduction', level: 2 },
        { id: uid(), type: 'text', text: 'This Cookie Policy explains how EKSTRUH LTD ("we", "us", or "our"), the company behind seoaudittools.pk, uses cookies and similar tracking technologies when you visit our website. It should be read alongside our Privacy Policy.' },
        { id: uid(), type: 'text', text: 'By clicking "Accept All" on our cookie banner, you consent to the use of all cookies described below. You can withdraw or change your consent at any time by using the Manage Preferences button at the bottom of this page.' },
        { id: uid(), type: 'heading', text: '2. What Are Cookies?', level: 2 },
        { id: uid(), type: 'text', text: 'Cookies are small text files placed on your device (computer, tablet, or smartphone) when you visit a website. They help the website remember your actions and preferences over a period of time, so you don\'t have to keep re-entering them whenever you come back to the site or browse from one page to another.' },
        { id: uid(), type: 'text', text: 'Cookies can be first-party (set by us) or third-party (set by services we use, such as Google Analytics). They can also be session cookies (deleted when you close your browser) or persistent cookies (remain on your device for a set period).' },
        { id: uid(), type: 'heading', text: '3. Cookies We Use', level: 2 },
        { id: uid(), type: 'text', text: 'We group our cookies into four categories. The table below lists the cookies currently in use on this website.' },
        { id: uid(), type: 'heading', text: '3.1 Strictly Necessary Cookies', level: 3 },
        { id: uid(), type: 'text', text: 'These cookies are essential for our SEO Audit Tools to work correctly. They enable core functions such as running your audit and generating your PDF report, and cannot be disabled without breaking that functionality.' },
        { id: uid(), type: 'table', head: ['Cookie name', 'Provider', 'Purpose', 'Duration', 'Type'], rows: [
          ['PHPSESSID', 'seoaudittools.pk', 'Maintains your session while your audit runs and your report is generated', 'Session', 'Necessary'],
          ['cookie_consent', 'seoaudittools.pk', 'Stores your cookie consent preferences', '1 year', 'Necessary'],
        ] },
        { id: uid(), type: 'heading', text: '3.2 Analytics Cookies', level: 3 },
        { id: uid(), type: 'text', text: 'These cookies help us understand how visitors use our site — which pages are visited most, where visitors come from, and whether they encounter errors. All information collected is aggregated and anonymised. These are only placed after you consent.' },
        { id: uid(), type: 'table', head: ['Cookie name', 'Provider', 'Purpose', 'Duration', 'Type'], rows: [
          ['_ga', 'Google Analytics', 'Distinguishes unique users by assigning a randomly generated number', '2 years', 'Analytics'],
          ['_ga_*', 'Google Analytics (GA4)', 'Persists session state for GA4 measurement', '2 years', 'Analytics'],
          ['_gid', 'Google Analytics', 'Distinguishes users — expires after 24 hours', '24 hours', 'Analytics'],
        ] },
        { id: uid(), type: 'heading', text: '3.3 Advertising Cookies', level: 3 },
        { id: uid(), type: 'text', text: 'These cookies are placed by Google AdSense to serve advertisements that keep our tools free to use, and to measure ad performance. These require your consent before being placed.' },
        { id: uid(), type: 'table', head: ['Cookie name', 'Provider', 'Purpose', 'Duration', 'Type'], rows: [
          ['_gcl_au', 'Google AdSense', 'Used by Google AdSense for experimenting with advertisement efficiency', '3 months', 'Advertising'],
          ['IDE', 'Google DoubleClick', 'Used to serve targeted advertisements relevant to users', '1 year', 'Advertising'],
        ] },
        { id: uid(), type: 'heading', text: '3.4 Affiliate Tracking Cookies', level: 3 },
        { id: uid(), type: 'text', text: 'These cookies are placed by third-party affiliate networks when you click an affiliate link on our website (for example, a link to SEO software or hosting providers). They track referral credit so EKSTRUH LTD can earn a commission at no extra cost to you. These require your consent before being placed.' },
        { id: uid(), type: 'table', head: ['Cookie name', 'Provider', 'Purpose', 'Duration', 'Type'], rows: [
          ['affiliate_ref', 'Third-party affiliate network (varies by advertiser)', 'Assigns referral credit for commission tracking', 'Up to 90 days', 'Advertising'],
        ] },
        { id: uid(), type: 'heading', text: '4. Third-Party Cookies', level: 2 },
        { id: uid(), type: 'text', text: 'Some cookies on our website are set by third-party services. We do not control these cookies. You can learn more about how third parties use cookies by visiting their respective privacy policies:' },
        { id: uid(), type: 'list', items: ['Google Analytics / Google Ads — Google Privacy Policy: https://policies.google.com/privacy', 'Google DoubleClick — Google Advertising Technologies: https://policies.google.com/technologies/ads'] },
        { id: uid(), type: 'text', text: 'You can opt out of Google Analytics tracking across all websites by installing the Google Analytics Opt-Out Browser Add-on: https://tools.google.com/dlpage/gaoptout.' },
        { id: uid(), type: 'heading', text: '5. How to Manage Cookies', level: 2 },
        { id: uid(), type: 'text', text: 'You can manage your cookie preferences in three ways:' },
        { id: uid(), type: 'list', items: ['Our preference centre — Use the Manage Preferences button below to choose which cookie categories you accept. Your choice will be saved for 12 months.', 'Browser settings — Most browsers allow you to block or delete cookies via their settings. Note that blocking all cookies may affect the functionality of our website. Find instructions for your browser: Chrome (https://support.google.com/chrome/answer/95647), Firefox (https://support.mozilla.org/kb/cookies-information-websites-store-on-your-computer), Edge (https://support.microsoft.com/microsoft-edge), Safari (https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac).', 'Opt-out tools — You can also use the Your Online Choices tool (EU, https://www.youronlinechoices.com) or the DAA opt-out page (US, https://optout.aboutads.info) to manage interest-based advertising preferences.'] },
        { id: uid(), type: 'heading', text: '6. Legal Basis', level: 2 },
        { id: uid(), type: 'text', text: 'We rely on the following legal bases under the UK GDPR and the Privacy and Electronic Communications Regulations (PECR) to set cookies:' },
        { id: uid(), type: 'list', items: ['Strictly necessary cookies — Legitimate interests (and exempted from consent under PECR Regulation 6(4)).', 'Analytics, advertising, and affiliate cookies — Your consent, which you can withdraw at any time.'] },
        { id: uid(), type: 'text', text: 'Where you are visiting from outside the UK, including from Pakistan, we still apply UK GDPR and PECR consent standards to cookies placed by this website, since EKSTRUH LTD is the UK-based data controller.' },
        { id: uid(), type: 'heading', text: '7. Changes to This Policy', level: 2 },
        { id: uid(), type: 'text', text: 'We may update this Cookie Policy from time to time to reflect changes in the cookies we use or for other operational, legal, or regulatory reasons. The date at the top of this page indicates when the policy was last revised. We recommend checking back periodically.' },
        { id: uid(), type: 'heading', text: '8. Contact Us', level: 2 },
        { id: uid(), type: 'text', text: 'If you have any questions about our use of cookies, please contact us: help@seoaudittools.pk' },
      ],
    },
    {
      id: uid(), slug: 'terms-of-service', title: 'Terms & Conditions', status: 'live',
      metaTitle: 'Terms & Conditions | SEO Audit Tools — EKSTRUH LTD', metaDescription: 'Terms & Conditions for SEO Audit Tools (seoaudittools.pk), operated by EKSTRUH LTD: acceptable use, intellectual property, disclaimers, liability limits, UK GDPR rights, cookies and refunds, governed by the laws of England and Wales.',
      blocks: [
        { id: uid(), type: 'text', text: 'Last Updated: 20 SEP 2026' },
        { id: uid(), type: 'heading', text: 'AGREEMENT TO OUR LEGAL TERMS', level: 2 },
        { id: uid(), type: 'text', text: 'We are EKSTRUH LTD ("Company," "we," "us," "our").' },
        { id: uid(), type: 'text', text: 'We operate https://seoaudittools.pk/, as well as any other related products and services that refer or link to these legal terms (the "Legal Terms") (collectively, the "Services").' },
        { id: uid(), type: 'text', text: 'You can contact us by email at help@seoaudittools.pk or by mail to EKSTRUH LTD, Victoria Grove, Bolton, England, United Kingdom, BL1 4JW.' },
        { id: uid(), type: 'text', text: 'These Legal Terms constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you"), and EKSTRUH LTD, concerning your access to and use of the Services. You agree that by accessing the Services, you have read, understood, and agreed to be bound by all of these Legal Terms. IF YOU DO NOT AGREE WITH ALL OF THESE LEGAL TERMS, THEN YOU ARE EXPRESSLY PROHIBITED FROM USING THE SERVICES AND YOU MUST DISCONTINUE USE IMMEDIATELY.' },
        { id: uid(), type: 'text', text: 'Supplemental terms and conditions or documents that may be posted on the Services from time to time are hereby expressly incorporated herein by reference. We reserve the right, in our sole discretion, to make changes or modifications to these Legal Terms at any time and for any reason. We will alert you about any changes by updating the "Last updated" date of these Legal Terms, and you waive any right to receive specific notice of each such change. It is your responsibility to periodically review these Legal Terms to stay informed of updates. You will be subject to, and will be deemed to have been made aware of and to have accepted, the changes in any revised Legal Terms by your continued use of the Services after the date such revised Legal Terms are posted.' },
        { id: uid(), type: 'text', text: 'We recommend that you print a copy of these Legal Terms for your records.' },
        { id: uid(), type: 'heading', text: 'TABLE OF CONTENTS', level: 2 },
        { id: uid(), type: 'list', items: ['1. Our Services', '2. Intellectual Property Rights', '3. User Representations', '4. Prohibited Activities', '5. User Generated Contributions', '6. Contribution License', '7. Services Management', '8. Term and Termination', '9. Modifications and Interruptions', '10. Governing Law', '11. Dispute Resolution', '12. Corrections', '13. Disclaimer', '14. Limitations of Liability', '15. Indemnification', '16. User Data', '17. Electronic Communications, Transactions, and Signatures', '18. Miscellaneous', '19. UK GDPR and Data Protection', '20. Cookie Policy', '21. Refund and Cancellation Policy', '22. Contact Us'] },
        { id: uid(), type: 'heading', text: '1. OUR SERVICES', level: 2 },
        { id: uid(), type: 'text', text: 'EKSTRUH LTD provides an online SEO audit and website analysis platform available at seoaudittools.pk/. Our tools help users check website SEO health, identify technical issues, monitor keyword rankings, analyse page speed, and compare websites with competitors.' },
        { id: uid(), type: 'text', text: 'The information provided when using the Services is not intended for distribution to or use by any person or entity in any jurisdiction or country where such distribution or use would be contrary to law or regulation or which would subject us to any registration requirement within such jurisdiction or country. Accordingly, those persons who choose to access the Services from other locations do so on their own initiative and are solely responsible for compliance with local laws, if and to the extent local laws are applicable.' },
        { id: uid(), type: 'heading', text: '2. INTELLECTUAL PROPERTY RIGHTS', level: 2 },
        { id: uid(), type: 'heading', text: 'Our intellectual property', level: 3 },
        { id: uid(), type: 'text', text: 'We are the owner or the licensee of all intellectual property rights in our Services, including all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics in the Services (collectively, the "Content"), as well as the trademarks, service marks, and logos contained therein (the "Marks").' },
        { id: uid(), type: 'text', text: 'Our Content and Marks are protected by copyright and trademark laws (and various other intellectual property rights and unfair competition laws) and treaties around the world.' },
        { id: uid(), type: 'text', text: 'The Content and Marks are provided in or through the Services "AS IS" for your personal, non-commercial use or internal business purpose only.' },
        { id: uid(), type: 'heading', text: 'Your use of our Services', level: 3 },
        { id: uid(), type: 'text', text: 'Subject to your compliance with these Legal Terms, including the "PROHIBITED ACTIVITIES" section below, we grant you a non-exclusive, non-transferable, revocable license to:' },
        { id: uid(), type: 'list', items: ['access the Services; and', 'download or print a copy of any portion of the Content to which you have properly gained access,'] },
        { id: uid(), type: 'text', text: 'solely for your personal, non-commercial use or internal business purpose.' },
        { id: uid(), type: 'text', text: 'Except as set out in this section or elsewhere in our Legal Terms, no part of the Services and no Content or Marks may be copied, reproduced, aggregated, republished, uploaded, posted, publicly displayed, encoded, translated, transmitted, distributed, sold, licensed, or otherwise exploited for any commercial purpose whatsoever, without our express prior written permission.' },
        { id: uid(), type: 'text', text: 'If you wish to make any use of the Services, Content, or Marks other than as set out in this section or elsewhere in our Legal Terms, please address your request to: help@seoaudittools.pk. If we ever grant you the permission to post, reproduce, or publicly display any part of our Services or Content, you must identify us as the owners or licensors of the Services, Content, or Marks and ensure that any copyright or proprietary notice appears or is visible on posting, reproducing, or displaying our Content.' },
        { id: uid(), type: 'text', text: 'We reserve all rights not expressly granted to you in and to the Services, Content, and Marks.' },
        { id: uid(), type: 'text', text: 'Any breach of these Intellectual Property Rights will constitute a material breach of our Legal Terms and your right to use our Services will terminate immediately.' },
        { id: uid(), type: 'heading', text: 'Your submissions', level: 3 },
        { id: uid(), type: 'text', text: 'Please review this section and the "PROHIBITED ACTIVITIES" section carefully prior to using our Services to understand the (a) rights you give us and (b) obligations you have when you post or upload any content through the Services.' },
        { id: uid(), type: 'text', text: 'Submissions: By directly sending us any question, comment, suggestion, idea, feedback, or other information about the Services ("Submissions"), you agree to assign to us all intellectual property rights in such Submission. You agree that we shall own this Submission and be entitled to its unrestricted use and dissemination for any lawful purpose, commercial or otherwise, without acknowledgment or compensation to you.' },
        { id: uid(), type: 'text', text: 'You are responsible for what you post or upload: By sending us Submissions through any part of the Services you:' },
        { id: uid(), type: 'list', items: ['confirm that you have read and agree with our "PROHIBITED ACTIVITIES" and will not post, send, publish, upload, or transmit through the Services any Submission that is illegal, harassing, hateful, harmful, defamatory, obscene, bullying, abusive, discriminatory, threatening to any person or group, sexually explicit, false, inaccurate, deceitful, or misleading;', 'to the extent permissible by applicable law, waive any and all moral rights to any such Submission;', 'warrant that any such Submission are original to you or that you have the necessary rights and licenses to submit such Submissions and that you have full authority to grant us the above-mentioned rights in relation to your Submissions; and', 'warrant and represent that your Submissions do not constitute confidential information.'] },
        { id: uid(), type: 'text', text: 'You are solely responsible for your Submissions and you expressly agree to reimburse us for any and all losses that we may suffer because of your breach of (a) this section, (b) any third party\'s intellectual property rights, or (c) applicable law.' },
        { id: uid(), type: 'heading', text: '3. USER REPRESENTATIONS', level: 2 },
        { id: uid(), type: 'text', text: 'By using the Services, you represent and warrant that: (1) you have the legal capacity and you agree to comply with these Legal Terms; (2) you are not a minor in the jurisdiction in which you reside; (3) you will not access the Services through automated or non-human means, whether through a bot, script or otherwise; (4) you will not use the Services for any illegal or unauthorized purpose; and (5) your use of the Services will not violate any applicable law or regulation.' },
        { id: uid(), type: 'text', text: 'If you provide any information that is untrue, inaccurate, not current, or incomplete, we have the right to suspend or terminate your access to the Services and refuse any and all current or future use of the Services (or any portion thereof).' },
        { id: uid(), type: 'heading', text: '4. PROHIBITED ACTIVITIES', level: 2 },
        { id: uid(), type: 'text', text: 'You may not access or use the Services for any purpose other than that for which we make the Services available. The Services may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by us.' },
        { id: uid(), type: 'text', text: 'As a user of the Services, you agree not to:' },
        { id: uid(), type: 'list', items: ['Systematically retrieve data or other content from the Services to create or compile, directly or indirectly, a collection, compilation, database, or directory without written permission from us.', 'Trick, defraud, or mislead us and other users, especially in any attempt to learn sensitive account information such as user passwords.', 'Circumvent, disable, or otherwise interfere with security-related features of the Services.', 'Disparage, tarnish, or otherwise harm, in our opinion, us and/or the Services.', 'Use any information obtained from the Services in order to harass, abuse, or harm another person.', 'Make improper use of our support services or submit false reports of abuse or misconduct.', 'Use the Services in a manner inconsistent with any applicable laws or regulations.', 'Engage in unauthorized framing of or linking to the Services.', 'Upload or transmit viruses, Trojan horses, or other material that interferes with any party\'s uninterrupted use and enjoyment of the Services.', 'Engage in any automated use of the system, such as using scripts to send comments or messages, or using any data mining, robots, or similar data gathering and extraction tools.', 'Delete the copyright or other proprietary rights notice from any Content.', 'Attempt to impersonate another user or person or use the username of another user.', 'Interfere with, disrupt, or create an undue burden on the Services or the networks or services connected to the Services.', 'Harass, annoy, intimidate, or threaten any of our employees or agents engaged in providing any portion of the Services to you.', 'Attempt to bypass any measures of the Services designed to prevent or restrict access to the Services, or any portion of the Services.', 'Copy or adapt the Services\' software, including but not limited to Flash, PHP, HTML, JavaScript, or other code.', 'Use the Services as part of any effort to compete with us or otherwise use the Services and/or the Content for any revenue-generating endeavor or commercial enterprise.'] },
        { id: uid(), type: 'heading', text: '5. USER GENERATED CONTRIBUTIONS', level: 2 },
        { id: uid(), type: 'text', text: 'Currently, the Services do not allow users to submit public content. However, should this change in the future, the following terms will apply:' },
        { id: uid(), type: 'text', text: 'We may provide you with the opportunity to create, submit, post, display, transmit, perform, publish, distribute, or broadcast content and materials to us or on the Services, including but not limited to text, writings, video, audio, photographs, graphics, comments, suggestions, or personal information or other material (collectively, "Contributions"). Contributions may be viewable by other users of the Services and through third-party websites. When you create or make available any Contributions, you thereby represent and warrant that:' },
        { id: uid(), type: 'list', items: ['The creation, distribution, transmission, public display, or performance, and the accessing, downloading, or copying of your Contributions do not and will not infringe the proprietary rights, including but not limited to the copyright, patent, trademark, trade secret, or moral rights of any third party.', 'You are the creator and owner of or have the necessary licenses, rights, consents, releases, and permissions to use and to authorize us and other users of the Services to use your Contributions in any manner contemplated by the Services and these Legal Terms.', 'Your Contributions are not false, inaccurate, or misleading.', 'Your Contributions are not unsolicited or unauthorized advertising, promotional materials, pyramid schemes, chain letters, spam, mass mailings, or other forms of solicitation.', 'Your Contributions do not contain any material that is defamatory, obscene, threatening, abusive, or otherwise objectionable.', 'Your Contributions do not contain viruses, worms, malware, trojan horses, or other content that is designed to interrupt, destroy, or limit the functionality of any computer software or hardware.'] },
        { id: uid(), type: 'heading', text: '6. CONTRIBUTION LICENSE', level: 2 },
        { id: uid(), type: 'text', text: 'You and Services agree that we may access, store, process, and use any information and personal data that you provide and your choices (including settings).' },
        { id: uid(), type: 'text', text: 'By submitting suggestions or other feedback regarding the Services, you agree that we can use and share such feedback for any purpose without compensation to you.' },
        { id: uid(), type: 'text', text: 'We do not assert any ownership over your Contributions. You retain full ownership of all of your Contributions and any intellectual property rights or other proprietary rights associated with your Contributions. We are not liable for any statements or representations in your Contributions provided by you in any area on the Services. You are solely responsible for your Contributions to the Services and you expressly agree to exonerate us from any and all responsibility and to refrain from any legal action against us regarding your Contributions.' },
        { id: uid(), type: 'heading', text: '7. SERVICES MANAGEMENT', level: 2 },
        { id: uid(), type: 'text', text: 'We reserve the right, but not the obligation, to: (1) monitor the Services for violations of these Legal Terms; (2) take appropriate legal action against anyone who, in our sole discretion, violates the law or these Legal Terms, including without limitation, reporting such user to law enforcement authorities; (3) in our sole discretion and without limitation, refuse, restrict access to, limit the availability of, or disable (to the extent technologically feasible) any of your Contributions or any portion thereof; (4) in our sole discretion and without limitation, notice, or liability, to remove from the Services or otherwise disable all files and content that are excessive in size or are in any way burdensome to our systems; and (5) otherwise manage the Services in a manner designed to protect our rights and property and to facilitate the proper functioning of the Services.' },
        { id: uid(), type: 'heading', text: '8. TERM AND TERMINATION', level: 2 },
        { id: uid(), type: 'text', text: 'These Legal Terms shall remain in full force and effect while you use the Services. WITHOUT LIMITING ANY OTHER PROVISION OF THESE LEGAL TERMS, WE RESERVE THE RIGHT TO, IN OUR SOLE DISCRETION AND WITHOUT NOTICE OR LIABILITY, DENY ACCESS TO AND USE OF THE SERVICES (INCLUDING BLOCKING CERTAIN IP ADDRESSES), TO ANY PERSON FOR ANY REASON OR FOR NO REASON, INCLUDING WITHOUT LIMITATION FOR BREACH OF ANY REPRESENTATION, WARRANTY, OR COVENANT CONTAINED IN THESE LEGAL TERMS OR OF ANY APPLICABLE LAW OR REGULATION. WE MAY TERMINATE YOUR USE OR PARTICIPATION IN THE SERVICES OR DELETE ANY CONTENT OR INFORMATION THAT YOU POSTED AT ANY TIME, WITHOUT WARNING, IN OUR SOLE DISCRETION.' },
        { id: uid(), type: 'text', text: 'If we terminate or suspend your access to the Services for any reason, you are prohibited from registering and creating a new account under your name, a fake or borrowed name, or the name of any third party, even if you may be acting on behalf of the third party. In addition to terminating or suspending your access, we reserve the right to take appropriate legal action, including without limitation pursuing civil, criminal, and injunctive redress.' },
        { id: uid(), type: 'heading', text: '9. MODIFICATIONS AND INTERRUPTIONS', level: 2 },
        { id: uid(), type: 'text', text: 'We reserve the right to change, modify, or remove the contents of the Services at any time or for any reason at our sole discretion without notice. However, we have no obligation to update any information on our Services. We will not be liable to you or any third party for any modification, price change, suspension, or discontinuance of the Services.' },
        { id: uid(), type: 'text', text: 'We cannot guarantee the Services will be available at all times. We may experience hardware, software, or other problems or need to perform maintenance related to the Services, resulting in interruptions, delays, or errors. We reserve the right to change, revise, update, suspend, discontinue, or otherwise modify the Services at any time or for any reason without notice to you. You agree that we have no liability whatsoever for any loss, damage, or inconvenience caused by your inability to access or use the Services during any downtime or discontinuance of the Services. Nothing in these Legal Terms will be construed to obligate us to maintain and support the Services or to supply any corrections, updates, or releases in connection therewith.' },
        { id: uid(), type: 'heading', text: '10. GOVERNING LAW', level: 2 },
        { id: uid(), type: 'text', text: 'These Legal Terms shall be governed by and defined following the laws of England and Wales. EKSTRUH LTD and yourself irrevocably consent that the courts of England and Wales shall have exclusive jurisdiction to resolve any dispute which may arise in connection with these Legal Terms.' },
        { id: uid(), type: 'heading', text: '11. DISPUTE RESOLUTION', level: 2 },
        { id: uid(), type: 'text', text: 'We will always try to resolve any dispute or complaint informally first. If you have a concern, please contact us at help@seoaudittools.pk and we will do our best to resolve it within 30 days.' },
        { id: uid(), type: 'text', text: 'If a dispute cannot be resolved informally, both parties agree to submit to the exclusive jurisdiction of the courts of England and Wales.' },
        { id: uid(), type: 'heading', text: '12. CORRECTIONS', level: 2 },
        { id: uid(), type: 'text', text: 'There may be information on the Services that contains typographical errors, inaccuracies, or omissions, including descriptions, pricing, availability, and various other information. We reserve the right to correct any errors, inaccuracies, or omissions and to change or update the information on the Services at any time, without prior notice.' },
        { id: uid(), type: 'heading', text: '13. DISCLAIMER', level: 2 },
        { id: uid(), type: 'text', text: 'THE SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. YOU AGREE THAT YOUR USE OF THE SERVICES WILL BE AT YOUR SOLE RISK. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, IN CONNECTION WITH THE SERVICES AND YOUR USE THEREOF, INCLUDING, WITHOUT LIMITATION, THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE MAKE NO WARRANTIES OR REPRESENTATIONS ABOUT THE ACCURACY OR COMPLETENESS OF THE SERVICES\' CONTENT OR THE CONTENT OF ANY WEBSITES OR MOBILE APPLICATIONS LINKED TO THE SERVICES AND WE WILL ASSUME NO LIABILITY OR RESPONSIBILITY FOR ANY (1) ERRORS, MISTAKES, OR INACCURACIES OF CONTENT AND MATERIALS, (2) PERSONAL INJURY OR PROPERTY DAMAGE, OF ANY NATURE WHATSOEVER, RESULTING FROM YOUR ACCESS TO AND USE OF THE SERVICES, (3) ANY UNAUTHORIZED ACCESS TO OR USE OF OUR SECURE SERVERS AND/OR ANY AND ALL PERSONAL INFORMATION AND/OR FINANCIAL INFORMATION STORED THEREIN, (4) ANY INTERRUPTION OR CESSATION OF TRANSMISSION TO OR FROM THE SERVICES, (5) ANY BUGS, VIRUSES, TROJAN HORSES, OR THE LIKE WHICH MAY BE TRANSMITTED TO OR THROUGH THE SERVICES BY ANY THIRD PARTY, AND/OR (6) ANY ERRORS OR OMISSIONS IN ANY CONTENT AND MATERIALS OR FOR ANY LOSS OR DAMAGE OF ANY KIND INCURRED AS A RESULT OF THE USE OF ANY CONTENT POSTED, TRANSMITTED, OR OTHERWISE MADE AVAILABLE VIA THE SERVICES. WE DO NOT WARRANT, ENDORSE, GUARANTEE, OR ASSUME RESPONSIBILITY FOR ANY PRODUCT OR SERVICE ADVERTISED OR OFFERED BY A THIRD PARTY THROUGH THE SERVICES, ANY HYPERLINKED WEBSITE, OR ANY WEBSITE OR MOBILE APPLICATION FEATURED IN ANY BANNER OR OTHER ADVERTISING, AND WE WILL NOT BE A PARTY TO OR IN ANY WAY BE RESPONSIBLE FOR MONITORING ANY TRANSACTION BETWEEN YOU AND ANY THIRD-PARTY PROVIDERS OF PRODUCTS OR SERVICES. AS WITH THE PURCHASE OF A PRODUCT OR SERVICE THROUGH ANY MEDIUM OR IN ANY ENVIRONMENT, YOU SHOULD USE YOUR BEST JUDGMENT AND EXERCISE CAUTION WHERE APPROPRIATE.' },
        { id: uid(), type: 'heading', text: '14. LIMITATIONS OF LIABILITY', level: 2 },
        { id: uid(), type: 'text', text: 'IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY DIRECT, INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFIT, LOST REVENUE, LOSS OF DATA, OR OTHER DAMAGES ARISING FROM YOUR USE OF THE SERVICES, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. NOTWITHSTANDING ANYTHING TO THE CONTRARY CONTAINED HEREIN, OUR LIABILITY TO YOU FOR ANY CAUSE WHATSOEVER AND REGARDLESS OF THE FORM OF THE ACTION, WILL AT ALL TIMES BE LIMITED TO THE LESSER OF THE AMOUNT PAID, IF ANY, BY YOU TO US OR £100 GBP. NOTHING IN THESE LEGAL TERMS EXCLUDES OR LIMITS OUR LIABILITY FOR DEATH OR PERSONAL INJURY CAUSED BY OUR NEGLIGENCE, FOR FRAUD OR FRAUDULENT MISREPRESENTATION, OR FOR ANY OTHER LIABILITY WHICH CANNOT BE EXCLUDED OR LIMITED UNDER APPLICABLE LAW, INCLUDING YOUR STATUTORY RIGHTS AS A CONSUMER UNDER THE CONSUMER RIGHTS ACT 2015. IF YOU ARE A CONSUMER RESIDENT OUTSIDE THE UNITED KINGDOM, INCLUDING IN PAKISTAN, MANDATORY CONSUMER PROTECTION LAWS OF YOUR COUNTRY OF RESIDENCE MAY ALSO APPLY AND ARE NOT AFFECTED BY THIS SECTION.' },
        { id: uid(), type: 'heading', text: '15. INDEMNIFICATION', level: 2 },
        { id: uid(), type: 'text', text: 'You agree to defend, indemnify, and hold us harmless, including our subsidiaries, affiliates, and all of our respective officers, agents, partners, and employees, from and against any loss, damage, liability, claim, or demand, including reasonable attorneys\' fees and expenses, made by any third party due to or arising out of: (1) use of the Services; (2) breach of these Legal Terms; (3) any breach of your representations and warranties set forth in these Legal Terms; (4) your violation of the rights of a third party, including but not limited to intellectual property rights; or (5) any overt harmful act toward any other user of the Services with whom you connected via the Services. Notwithstanding the foregoing, we reserve the right, at your expense, to assume the exclusive defense and control of any matter for which you are required to indemnify us, and you agree to cooperate, at your expense, with our defense of such claims. We will use reasonable efforts to notify you of any such claim, action, or proceeding which is subject to this indemnification upon becoming aware of it.' },
        { id: uid(), type: 'heading', text: '16. USER DATA', level: 2 },
        { id: uid(), type: 'text', text: 'We will maintain certain data that you transmit to the Services for the purpose of managing the performance of the Services, as well as data relating to your use of the Services. Although we perform regular routine backups of data, you are solely responsible for all data that you transmit or that relates to any activity you have undertaken using the Services. You agree that we shall have no liability to you for any loss or corruption of any such data, and you hereby waive any right of action against us arising from any such loss or corruption of such data.' },
        { id: uid(), type: 'heading', text: '17. ELECTRONIC COMMUNICATIONS, TRANSACTIONS, AND SIGNATURES', level: 2 },
        { id: uid(), type: 'text', text: 'Visiting the Services, sending us emails, and completing online forms constitute electronic communications. You consent to receive electronic communications, and you agree that all agreements, notices, disclosures, and other communications we provide to you electronically, via email and on the Services, satisfy any legal requirement that such communication be in writing.' },
        { id: uid(), type: 'text', text: 'YOU HEREBY AGREE TO THE USE OF ELECTRONIC SIGNATURES, CONTRACTS, ORDERS, AND OTHER RECORDS, AND TO ELECTRONIC DELIVERY OF NOTICES, POLICIES, AND RECORDS OF TRANSACTIONS INITIATED OR COMPLETED BY US OR VIA THE SERVICES. YOU HEREBY WAIVE ANY RIGHTS OR REQUIREMENTS UNDER ANY STATUTES, REGULATIONS, RULES, ORDINANCES, OR OTHER LAWS IN ANY JURISDICTION WHICH REQUIRE AN ORIGINAL SIGNATURE OR DELIVERY OR RETENTION OF NON-ELECTRONIC RECORDS, OR TO PAYMENTS OR THE GRANTING OF CREDITS BY ANY MEANS OTHER THAN ELECTRONIC MEANS.' },
        { id: uid(), type: 'heading', text: '18. MISCELLANEOUS', level: 2 },
        { id: uid(), type: 'text', text: 'These Legal Terms and any policies or operating rules posted by us on the Services or in respect to the Services constitute the entire agreement and understanding between you and us. Our failure to exercise or enforce any right or provision of these Legal Terms shall not operate as a waiver of such right or provision. These Legal Terms operate to the fullest extent permissible by law. We may assign any or all of our rights and obligations to others at any time. We shall not be responsible or liable for any loss, damage, delay, or failure to act caused by any cause beyond our reasonable control. If any provision or part of a provision of these Legal Terms is determined to be unlawful, void, or unenforceable, that provision or part of the provision is deemed severable from these Legal Terms and does not affect the validity and enforceability of any remaining provisions. There is no joint venture, partnership, employment or agency relationship created between you and us as a result of these Legal Terms or use of the Services. You agree that these Legal Terms will not be construed against us by virtue of having drafted them. You hereby waive any and all defenses you may have based on the electronic form of these Legal Terms and the lack of signing by the parties hereto to execute these Legal Terms.' },
        { id: uid(), type: 'heading', text: '19. UK GDPR AND DATA PROTECTION', level: 2 },
        { id: uid(), type: 'text', text: 'This section is required under UK law and has been added to ensure compliance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.' },
        { id: uid(), type: 'text', text: 'EKSTRUH LTD is committed to protecting your personal data and complying with all applicable data protection laws in the United Kingdom, including the UK GDPR and the Data Protection Act 2018.' },
        { id: uid(), type: 'text', text: 'We collect and process your personal data only for lawful, specified, and legitimate purposes. Your rights as a data subject include:' },
        { id: uid(), type: 'list', items: ['The right to access the personal data we hold about you', 'The right to correct any inaccurate or incomplete personal data', 'The right to request deletion of your personal data ("right to be forgotten")', 'The right to restrict or object to the processing of your personal data', 'The right to data portability', 'The right to withdraw consent at any time where processing is based on consent'] },
        { id: uid(), type: 'text', text: 'To exercise any of these rights, please contact us at help@seoaudittools.pk.' },
        { id: uid(), type: 'text', text: 'If you are not satisfied with how we handle your personal data, you have the right to lodge a complaint with the Information Commissioner\'s Office (ICO) at https://ico.org.uk.' },
        { id: uid(), type: 'text', text: 'For full details on how we collect, use, store, and protect your personal information, please read our Privacy Policy.' },
        { id: uid(), type: 'heading', text: '20. COOKIE POLICY', level: 2 },
        { id: uid(), type: 'text', text: 'This section is required under UK law (UK GDPR and Privacy and Electronic Communications Regulations) and has been added to ensure full compliance.' },
        { id: uid(), type: 'text', text: 'Our website at seoaudittools.pk uses cookies to improve your experience and help us understand how visitors use our platform. Cookies are small text files placed on your device by your browser when you visit our website.' },
        { id: uid(), type: 'text', text: 'We use the following types of cookies:' },
        { id: uid(), type: 'list', items: ['Essential Cookies: These are necessary for our website to function properly. They enable core features such as page navigation and access to secure areas of the site. The website cannot function correctly without these cookies.', 'Analytics Cookies: These help us understand how visitors interact with our website by collecting and reporting information anonymously. This helps us improve our platform and services.', 'Advertising & Affiliate Cookies: Used to serve relevant advertisements and track affiliate referral links. These require your consent before being placed.'] },
        { id: uid(), type: 'text', text: 'You can manage your cookie preferences at any time using our cookie consent tool in accordance with this policy and UK GDPR requirements.' },
        { id: uid(), type: 'text', text: 'You can control or disable cookies at any time through your browser settings. Please note that disabling certain cookies may affect the functionality of our website. For guidance on managing cookies in your browser, visit https://www.aboutcookies.org.' },
        { id: uid(), type: 'heading', text: '21. REFUND AND CANCELLATION POLICY', level: 2 },
        { id: uid(), type: 'text', text: 'This section is required under UK consumer law, specifically the Consumer Rights Act 2015 and the Consumer Contracts Regulations 2013, and has been added to ensure full legal compliance.' },
        { id: uid(), type: 'text', text: 'The following refund and cancellation terms apply to any paid plans or premium features offered by EKSTRUH LTD through seoaudittools.pk' },
        { id: uid(), type: 'text', text: 'Free Tools: No payment is required for our free SEO audit tools and no refund applies.' },
        { id: uid(), type: 'text', text: 'Paid Plans or Premium Features:' },
        { id: uid(), type: 'list', items: ['You may cancel your subscription at any time by contacting us at help@seoaudittools.pk', 'If you cancel within 14 days of purchase and have not used the premium features, you are entitled to a full refund under the UK statutory cooling-off period', 'If you have accessed or used the paid features within the 14-day period, we reserve the right to apply a pro-rata deduction before issuing a refund', 'Refunds will be processed within 10 business days to your original payment method', 'We do not offer refunds for partial months or unused portions of a subscription beyond the 14-day period'] },
        { id: uid(), type: 'text', text: 'To request a refund, email us at help@seoaudittools.pk with your order reference and reason for cancellation.' },
        { id: uid(), type: 'heading', text: '22. CONTACT US', level: 2 },
        { id: uid(), type: 'text', text: 'If you have any questions, complaints, or requests regarding these Legal Terms, please contact us: help@seoaudittools.pk' },
      ],
    },
  ],
  seo: {
    home: { title: 'SEO Audit Tools — Free Website SEO Checker | EKSTRUH LTD', description: 'Free SEO audit tool plus 150+ practical SEO, speed, IP, PDF, calculator and converter tools from EKSTRUH LTD — built for website owners in Pakistan and worldwide.' },
    tools: { title: 'Free SEO Tools (150+) — Audit, Speed, Calculator & Converter Tools', description: 'Browse 150+ free tools from EKSTRUH LTD for Pakistan and worldwide: website SEO audit, page speed, keyword research, backlinks, IP lookup, PDF tools, calculators and unit converters.' },
    blog: { title: 'SEO Blog: Core Web Vitals, PageSpeed & WordPress Guides', description: 'Practical SEO guides on fixing INP, LCP and CLS, PageSpeed problems, WordPress performance, indexing issues and Google core updates.' },
    'competitor-analysis': { title: 'SEO Competitor Analysis — Compare Two Websites Free | SEO Audit Tools', description: 'Compare your website with a competitor: overall SEO scores, domain registration, on-page checks, Google-style SERP previews and a two-column full audit. Free, no sign-up.' },
  },
  sidebar: {
    searchBox: true, searchPlaceholder: 'Search from SEO tools',
    relevantTools: true, relevantCount: 12, relevantTitle: 'Other Relevant Tools',
    popular: true, popularTitle: 'Popular SEO Tools', hiddenPopular: [],
    latest: true, latestTitle: 'Latest Articles', latestCount: 6,
    cta: true, ctaTitle: 'Free SEO Audit', ctaText: 'Check any website for 100+ on-page, technical and speed issues in 30 seconds.', ctaLabel: 'Run Audit →', ctaHref: '/',
    widgets: [],
  },
  sections: { hero: true, auditTool: true, results: true, features: true, howItWorks: true, whyAudit: true, whoBenefits: true, freeTools: true, fromBlog: true, cta: true, footer: true },
  settings: { name: 'SEO Audit Tools', domain: 'seoaudittools.pk', tagline: 'Pakistan’s free SEO audit + 150 tools', footerNote: 'SEO Audit Tools — free online SEO, calculator and unit converter tools for website owners in Pakistan and worldwide, provided by EKSTRUH LTD.' },
  nav: [
    { id: uid(), label: 'Free SEO Tools', href: '/tools', visible: true },
  ],
  passcode: 'admin123',
};


/* ---------------- page content migration ---------------- */
/** Escape a plain-text fragment for generated HTML. */
const escHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Turn a legacy href into a clean path. Keeps external, mailto, tel and
 *  in-page fragment links untouched. */
const cleanStoredHref = (href: string): string => {
  const value = (href || '').trim();
  if (!value || value === '#') return '/';
  if (/^(https?:|mailto:|tel:)/i.test(value)) return value;
  if (value.startsWith('#')) {
    const path = value.slice(1);
    if (!path) return '/';
    if (!path.startsWith('/')) return value; // in-page fragment — keep as-is
    const clean = path.replace(/^\/p\//, '/').replace(/^\//, '').replace(/\/+$/, '');
    return clean === '' ? '/' : `/${clean}`;
  }
  return value;
};

/** Rewrite stored #/… links inside HTML to clean paths. */
const cleanStoredHtml = (html: string): string =>
  html
    .replace(/href=["']#\/p\/([^"']*)["']/gi, 'href=/"$1"')
    .replace(/href=["']#\/([a-z0-9][^"']*)["']/gi, 'href=/"$1"')
    .replace(/href=["']#\/?(?=["'])/gi, 'href="/"');

/** Convert a legacy block list into one rich-text HTML document. */
export const blocksToHtml = (blocks: PageBlock[]): string =>
  blocks
    .map(b => {
      switch (b.type) {
        case 'heading': {
          const text = (b.text || '').trim();
          if (!text) return '';
          const tag = b.level === 2 ? 'h2' : 'h3';
          return `<${tag}>${escHtml(text)}</${tag}>`;
        }
        case 'list': {
          const items = (b.items || []).map(it => `<li>${escHtml(it)}</li>`).join('');
          return items ? `<ul>${items}</ul>` : '';
        }
        case 'table': {
          if (!b.head?.length && !b.rows?.length) return '';
          const head = b.head?.length
            ? `<thead><tr>${b.head.map(h => `<th>${escHtml(h)}</th>`).join('')}</tr></thead>`
            : '';
          const body = `<tbody>${(b.rows || [])
            .map(row => `<tr>${row.map(c => `<td>${escHtml(c)}</td>`).join('')}</tr>`)
            .join('')}</tbody>`;
          return `<table>${head}${body}</table>`;
        }
        case 'cta': {
          const href = cleanStoredHref(b.href || '#/');
          const label = (b.label || '').trim();
          const text = (b.text || '').trim();
          const link = label ? `<a href="${href}">${escHtml(label)}</a>` : '';
          if (text && link) return `<p><strong>${escHtml(text)}</strong> ${link}</p>`;
          if (link) return `<p>${link}</p>`;
          return text ? `<p><strong>${escHtml(text)}</strong></p>` : '';
        }
        case 'text':
        default: {
          const text = (b.text || '').replace(/\r\n/g, '\n');
          if (!text.trim()) return '';
          // Old text blocks may already contain inline HTML (links, <code>, bold).
          const body = /<[a-z][^>]*>/i.test(text) ? text : escHtml(text).replace(/\n/g, '<br/>');
          return `<p>${body}</p>`;
        }
      }
    })
    .filter(Boolean)
    .join('\n');

/** Make a page's rich-text `content` the source of truth. Pages saved with
 *  the old block editor are converted once and their legacy #/… links are
 *  rewritten to clean paths. */
export const withPageContent = (page: CmsPage): CmsPage => {
  const html = page.content?.trim() ? page.content : blocksToHtml(page.blocks || []);
  return { ...page, content: cleanStoredHtml(html) };
};

/* ---------------- persistence ---------------- */
const KEY = 'seoaudittool:cms:v1';

/** One-time content migration for browsers that already have CMS data in
 *  localStorage. Version 2 rewrote the original About, Privacy and Contact
 *  pages and added FAQ, Cookie Policy and Terms of Service; version 3 filled
 *  in the real EKSTRUH LTD company details and documented Google Analytics,
 *  Google AdSense and affiliate links; version 4 replaced the Privacy Policy
 *  with the new 14-section policy; version 5 replaced the Terms of Service
 *  with the new 22-section Terms & Conditions; version 6 replaced the About
 *  page with the new content; version 7 replaced the Cookie Policy with the
 *  new 8-section policy including cookie tables; version 9 removed the
 *  company-details block from the Contact page; version 10 added Response
 *  Time and Before You Write, and linked the contact email. Version 11 stores
 *  each page as a single rich-text document (converted from blocks at load).
 *  Version 12 completes the Pakistan rebrand: fixed the remaining singular
 *  "SEO Audit Tool" brand strings in Contact/FAQ/home metadata, unified the
 *  Contact response time, corrected the Privacy Policy's stale "PHP-based"
 *  tool description, and refreshed the Pakistan-focused About/footer copy.
 *  Pages the admin created themselves are always preserved. */
const migratePages = (pages: CmsPage[]): CmsPage[] => {
  const bySlug = new Map(pages.map(p => [p.slug, p]));
  const known = defaultState.pages.map(d => (bySlug.has(d.slug) ? { ...d, id: bySlug.get(d.slug)!.id } : d));
  const knownSlugs = new Set(defaultState.pages.map(p => p.slug));
  const custom = pages.filter(p => !knownSlugs.has(p.slug));
  return [...known, ...custom];
};

/** Brand and domain used before the site moved to "SEO Audit Tools" at
 *  seoaudittools.pk. Browsers that still have an old value cached in
 *  localStorage are migrated to the new defaults. Genuinely custom values
 *  set via Admin are always preserved. */
const LEGACY_BRAND_NAME = 'SEO Audit Tool';
const LEGACY_DOMAINS = ['seoaudittool.pk', 'seoaudittool.co.uk'];
const migrateSettings = (stored: Partial<SiteSettings> | undefined): SiteSettings => {
  const merged = { ...defaultState.settings, ...(stored || {}) };
  if (merged.name === LEGACY_BRAND_NAME) merged.name = defaultState.settings.name;
  if (LEGACY_DOMAINS.includes(merged.domain)) merged.domain = defaultState.settings.domain;
  return merged;
};

/** SEO entries still carrying the pre-rebrand home title (singular brand)
 *  are upgraded to the new defaults; admin-edited entries are preserved. */
const LEGACY_SEO_HOME_TITLE = 'SEO Audit Tool — Free Website SEO Checker | EKSTRUH LTD';
const migrateSeo = (stored: Record<string, SeoEntry> | undefined): Record<string, SeoEntry> => {
  const merged = { ...defaultState.seo, ...(stored || {}) };
  if (merged.home?.title === LEGACY_SEO_HOME_TITLE) merged.home = defaultState.seo.home;
  return merged;
};

/** The old sidebar search placeholder ("Search from SEO tools") reads badly;
 *  browsers that never customised it are moved to the polished wording. */
const LEGACY_SEARCH_PLACEHOLDER = 'Search from SEO tools';
const migrateSidebar = (stored: Partial<SidebarConfig> | undefined): SidebarConfig => {
  const merged = { ...defaultState.sidebar, ...(stored || {}) };
  if (!merged.searchPlaceholder || merged.searchPlaceholder === LEGACY_SEARCH_PLACEHOLDER) merged.searchPlaceholder = defaultState.sidebar.searchPlaceholder;
  return merged;
};

/** Untouched default navs from earlier builds. Admin-edited menus are kept. */
const LEGACY_NAV_SIGNATURES = [
  'Features|#features;Tools|#/tools;Blog|#/blog;Users|#audiences',
  'SEO Tools|#/tools',
];
const migrateNav = (stored: NavItem[] | undefined): NavItem[] => {
  const storedNav = Array.isArray(stored) && stored.length ? stored : defaultState.nav;
  const signature = storedNav.map(n => `${n.label}|${n.href}`).join(';');
  const nav = LEGACY_NAV_SIGNATURES.includes(signature) ? defaultState.nav : storedNav;
  // Menus saved under the old hash URLs keep pointing at the same pages,
  // now via clean paths.
  return nav.map(n => ({ ...n, href: cleanStoredHref(n.href) }));
};

const load = (): CmsState => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<CmsState>;
    const parsedVersion = typeof parsed.version === 'number' ? parsed.version : 1;
    const oldSidebar = parsed.sidebar || {};
    const oldItems = Array.isArray((oldSidebar as SidebarConfig).customItems) ? (oldSidebar as SidebarConfig).customItems || [] : [];
    const migratedWidgets: SidebarWidget[] = Array.isArray((oldSidebar as SidebarConfig).widgets)
      ? (oldSidebar as SidebarConfig).widgets || []
      : oldItems.length
        ? [{ id: uid(), title: 'Featured links', type: 'links', visible: true, source: 'manual', links: oldItems.map(item => ({ ...item })) }]
        : [];
    return {
      ...defaultState, ...parsed,
      version: Math.max(defaultState.version, parsedVersion),
      // Append tools introduced by newer builds to an existing browser CMS
      // without overwriting the admin's edits, visibility or custom tools.
      tools: Array.from(new Map([...defaultState.tools, ...(parsed.tools || [])].map(tool => [tool.slug, tool])).values()),
      pages: (parsedVersion < defaultState.version ? migratePages(parsed.pages || []) : (parsed.pages || defaultState.pages)).map(withPageContent),
      settings: migrateSettings(parsed.settings),
      nav: migrateNav(parsed.nav),
      sidebar: { ...migrateSidebar(oldSidebar), widgets: migratedWidgets },
      sections: { ...defaultState.sections, ...(parsed.sections || {}) },
      seo: migrateSeo(parsed.seo),
    };
  } catch { return defaultState; }
};

interface Ctx {
  state: CmsState;
  update: (patch: Partial<CmsState>) => void;
  /* tools */
  addTool: (t: Partial<CmsTool>) => string;
  saveTool: (slug: string, patch: Partial<CmsTool>) => void;
  setToolStatus: (slug: string, status: Status) => void;
  deleteTool: (slug: string) => void;
  /* posts */
  addPost: (p: Partial<CmsPost>) => string;
  savePost: (slug: string, patch: Partial<CmsPost>) => void;
  setPostStatus: (slug: string, status: Status) => void;
  deletePost: (slug: string) => void;
  /* pages */
  addPage: (p: Partial<CmsPage>) => string;
  savePage: (id: string, patch: Partial<CmsPage>) => void;
  setPageStatus: (id: string, status: Status) => void;
  deletePage: (id: string) => void;
  /* seo */
  setSeo: (key: string, entry: SeoEntry) => void;
  clearSeo: (key: string) => void;
  /* settings + sections + nav + sidebar */
  setSections: (patch: Partial<SectionFlags>) => void;
  setSidebar: (patch: Partial<SidebarConfig>) => void;
  setSettings: (patch: Partial<SiteSettings>) => void;
  setNav: (nav: NavItem[]) => void;
  /* data */
  reset: () => void;
  importJson: (json: string) => boolean;
  exportJson: () => string;
  /* storage health */
  storageWarning: string | null;
  /* auth */
  loggedIn: boolean;
  login: (username: string, password: string, remember?: boolean) => Promise<boolean>;
  logout: () => void;
  setPasscode: (code: string) => Promise<void>;
}

const CmsContext = createContext<Ctx | null>(null);

export const CmsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<CmsState>(() => load());
  const [loggedIn, setLoggedIn] = useState(() => readAdminSession() !== null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  // Content is persisted in this browser. Uploaded images are embedded as
  // data URLs, so a full quota is the one failure mode worth surfacing loudly
  // instead of losing an edit silently.
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      setStorageWarning(null);
    } catch {
      setStorageWarning('Browser storage is full, so your latest change could not be saved. Remove large inline images, then export your CMS JSON before continuing.');
    }
  }, [state]);

  const update = useCallback((patch: Partial<CmsState>) => setState(s => ({ ...s, ...patch })), []);

  const ctx: Ctx = useMemo(() => ({
    state, update,
    addTool: (t) => { const slug = t.slug || `custom-${uid()}`; setState(s => ({ ...s, tools: [{ slug, name: t.name || 'New tool', description: t.description || '', category: t.category || 'management', input: t.input || 'text', engine: t.engine, placeholder: t.placeholder, placeholder2: t.placeholder2, status: t.status || 'draft', custom: true, builtin: false, badge: t.badge, featuredImage: t.featuredImage, featuredImageAlt: t.featuredImageAlt, about: t.about }, ...s.tools] })); return slug; },
    saveTool: (slug, patch) => setState(s => ({ ...s, tools: s.tools.map(t => (t.slug === slug ? { ...t, ...patch } : t)) })),
    setToolStatus: (slug, status) => setState(s => ({ ...s, tools: s.tools.map(t => (t.slug === slug ? { ...t, status } : t)) })),
    deleteTool: (slug) => setState(s => ({ ...s, tools: s.tools.filter(t => t.slug !== slug) })),

    addPost: (p) => { const slug = p.slug || `post-${uid()}`; setState(s => ({ ...s, posts: [{ slug, title: p.title || 'Untitled post', metaTitle: p.metaTitle || p.title || 'Untitled post', metaDescription: p.metaDescription || '', excerpt: p.excerpt || '', content: p.content || '', category: p.category || 'Google & Indexing', date: p.date || new Date().toISOString().slice(0, 10), readTime: p.readTime || '6 min read', author: p.author || 'SEO Audit Tools Team', keywords: p.keywords || [], featuredImage: p.featuredImage, featuredImageAlt: p.featuredImageAlt, status: p.status || 'draft', builtin: false }, ...s.posts] })); return slug; },
    savePost: (slug, patch) => setState(s => ({ ...s, posts: s.posts.map(p => (p.slug === slug ? { ...p, ...patch } : p)) })),
    setPostStatus: (slug, status) => setState(s => ({ ...s, posts: s.posts.map(p => (p.slug === slug ? { ...p, status } : p)) })),
    deletePost: (slug) => setState(s => ({ ...s, posts: s.posts.filter(p => p.slug !== slug) })),

    addPage: (p) => { const id = uid(); setState(s => ({ ...s, pages: [{ id, slug: p.slug || `page-${id}`, title: p.title || 'New page', metaTitle: p.metaTitle || p.title || 'New page', metaDescription: p.metaDescription || '', content: p.content || '', featuredImage: p.featuredImage, featuredImageAlt: p.featuredImageAlt, status: p.status || 'draft' }, ...s.pages] })); return id; },
    savePage: (id, patch) => setState(s => ({ ...s, pages: s.pages.map(p => (p.id === id ? { ...p, ...patch } : p)) })),
    setPageStatus: (id, status) => setState(s => ({ ...s, pages: s.pages.map(p => (p.id === id ? { ...p, status } : p)) })),
    deletePage: (id) => setState(s => ({ ...s, pages: s.pages.filter(p => p.id !== id) })),

    setSeo: (key, entry) => setState(s => ({ ...s, seo: { ...s.seo, [key]: entry } })),
    clearSeo: (key) => setState(s => { const next = { ...s.seo }; delete next[key]; return { ...s, seo: next }; }),
    setSections: (patch) => setState(s => ({ ...s, sections: { ...s.sections, ...patch } })),
    setSidebar: (patch) => setState(s => ({ ...s, sidebar: { ...s.sidebar, ...patch } })),
    setSettings: (patch) => setState(s => ({ ...s, settings: { ...s.settings, ...patch } })),
    setNav: (nav) => setState(s => ({ ...s, nav })),

    reset: () => setState({ ...defaultState }),
    exportJson: () => JSON.stringify({ ...state, pages: state.pages.map(pg => { const { blocks: _blocks, ...rest } = pg; return rest; }) }, null, 2),
    importJson: (json) => { try { const parsed = JSON.parse(json) as CmsState; if (!parsed.tools || !parsed.posts) return false; const legacyItems = parsed.sidebar?.customItems || []; const widgets = parsed.sidebar?.widgets || (legacyItems.length ? [{ id: uid(), title: 'Featured links', type: 'links' as SidebarWidgetType, visible: true, source: 'manual' as SidebarLinkSource, links: legacyItems }] : []); const parsedVersion = typeof parsed.version === 'number' ? parsed.version : 1; setState({ ...defaultState, ...parsed, version: Math.max(defaultState.version, parsedVersion), pages: (parsedVersion < defaultState.version ? migratePages(parsed.pages || []) : (parsed.pages || defaultState.pages)).map(withPageContent), settings: migrateSettings(parsed.settings), nav: migrateNav(parsed.nav), sidebar: { ...defaultState.sidebar, ...parsed.sidebar, widgets } }); return true; } catch { return false; } },

    storageWarning,
    loggedIn,
    login: async (username, password, remember = true) => {
      const ok = await verifyAdminLogin(username, password, state.passcode);
      if (!ok) return false;
      writeAdminSession(username.trim(), remember);
      setLoggedIn(true);
      return true;
    },
    logout: () => { clearAdminSession(); setLoggedIn(false); },
    setPasscode: async (code) => {
      setState(s => ({ ...s, passcode: code }));
      await saveAdminPassword(code);
    },
  }), [state, loggedIn, update, storageWarning]);

  return <CmsContext.Provider value={ctx}>{children}</CmsContext.Provider>;
};

export const useCms = (): Ctx => {
  const c = useContext(CmsContext);
  if (!c) throw new Error('useCms must be used inside CmsProvider');
  return c;
};

/* ---------------- selectors used by the public site ---------------- */
export const liveTools = (s: CmsState) => s.tools.filter(t => t.status === 'live' && t.slug !== 'competitor-analysis');
export const livePosts = (s: CmsState) => s.posts.filter(p => p.status === 'live').sort((a, b) => (a.date < b.date ? 1 : -1));
export const findTool = (s: CmsState, slug: string) => s.tools.find(t => t.slug === slug);
export const findPost = (s: CmsState, slug: string) => s.posts.find(p => p.slug === slug);
export const findPage = (s: CmsState, slug: string) => s.pages.find(p => p.slug === slug);
