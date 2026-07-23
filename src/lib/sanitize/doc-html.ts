import createDOMPurify, { type DOMPurify } from 'dompurify'

// Allowlist-based sanitizer for rich-text (doc) HTML stored in the DB.
// Runs in the browser; use sanitizeHtml() before dangerouslySetInnerHTML.
let cached: DOMPurify | null = null

function getPurifier(): DOMPurify {
  if (cached) return cached
  cached = createDOMPurify(typeof window === 'undefined' ? undefined : (window as any))
  return cached
}

const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'span', 'div',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'b', 'strong', 'i', 'em', 'u', 's', 'del', 'sub', 'sup', 'mark', 'small',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'figure', 'figcaption',
]

const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'colspan', 'rowspan', 'style', 'class']

const ALLOWED_URI_REGEX = /^(https?:|mailto:|data:image\/(png|jpeg|jpg|gif|webp);base64,)/i

export function sanitizeDocHtml(html: string): string {
  const purify = getPurifier()
  if (!purify || !purify.sanitize) return '' // no DOM available (SSR) -> render nothing
  return purify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: ALLOWED_URI_REGEX,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'style', 'link', 'meta', 'base'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'style'],
  })
}
