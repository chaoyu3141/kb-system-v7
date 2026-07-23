// URL scheme allowlist for user-supplied link/image URLs.
// Blocks javascript:, data: (non-image), vbscript:, file:, etc.

const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:'])

export function isSafeUrl(raw: string): boolean {
  if (!raw) return false
  const trimmed = raw.trim()
  // Allow relative URLs (no protocol) and anchors.
  if (trimmed.startsWith('#') || trimmed.startsWith('/')) return true
  try {
    const url = new URL(trimmed)
    if (SAFE_SCHEMES.has(url.protocol)) return true
    // Allow data: images only with safe mime types
    if (url.protocol === 'data:') {
      return /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(trimmed)
    }
    return false
  } catch {
    return false
  }
}

export function safeUrlOrFallback(raw: string, fallback = '#'): string {
  return isSafeUrl(raw) ? raw : fallback
}
