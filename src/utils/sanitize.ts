// Basic HTML sanitiser for rich-text content authored in the CMS.
// The CMS is passcode-gated and content is admin-authored, but this keeps
// accidental script injection, inline event handlers and javascript: URLs
// out of public pages regardless of how the content was produced.

const BLOCKED_TAGS = /<\s*\/?\s*(script|iframe|object|embed|form|input|button|style|link|meta)[^>]*>/gi;

export const sanitizeRichHtml = (html: string): string => {
  if (!html) return '';
  return html
    // Drop dangerous elements entirely (including their content for script/style).
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(BLOCKED_TAGS, '')
    // Strip inline event handlers: onclick="..." / onerror='...' / onload=...
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Neutralise javascript:/data: URLs in href/src attributes.
    .replace(/(href|src)\s*=\s*(?:"\s*(javascript|data)\s*:[^"]*"|'\s*(javascript|data)\s*:[^']*'|(javascript|data)\s*:[^\s>]*)/gi, '$1="#"');
};
