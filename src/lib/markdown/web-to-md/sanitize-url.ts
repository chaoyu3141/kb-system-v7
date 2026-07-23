const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])

function isPrivateIp(ip: string): boolean {
  // Normalize IPv6-mapped IPv4
  const v4 = ip.replace(/^::ffff:/, '')
  if (BLOCKED_HOSTS.has(v4)) return true

  // IPv4 dotted forms
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v4)) {
    const parts = v4.split('.').map((n) => parseInt(n, 10))
    if (parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true
    const [a, b] = parts
    if (a === 0) return true // 0.0.0.0/8
    if (a === 10) return true // 10.0.0.0/8
    if (a === 127) return true // loopback
    if (a === 169 && b === 254) return true // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true // 172.16/12
    if (a === 192 && b === 168) return true // 192.168/16
    if (a === 192 && b === 0) return true // 192.0.0.0/24 (protocol)
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64/10
    if (a >= 224) return true // multicast / reserved
    return false
  }

  // IPv6
  const lower = v4.toLowerCase()
  if (lower === '::1' || lower === '::' ) return true
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true // ULA
  if (lower.startsWith('fe80')) return true // link-local
  if (lower.startsWith('::ffff:')) return isPrivateIp(lower.slice('::ffff:'.length))
  return false
}

export function validateFetchUrl(rawUrl: string): URL {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('URL 格式无效')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('仅支持 http/https 协议')
  }

  // Block non-default ports to reduce SSRF surface
  if (parsed.port && !['80', '443', ''].includes(parsed.port)) {
    throw new Error('不允许使用非标准端口')
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (BLOCKED_HOSTS.has(host) || isPrivateIp(host)) {
    throw new Error('不允许访问内网地址')
  }

  return parsed
}

// Resolve a hostname to IPs and ensure none are private/internal.
// Used before fetching to defend against DNS rebinding.
export async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (BLOCKED_HOSTS.has(host) || isPrivateIp(host)) {
    throw new Error('不允许访问内网地址')
  }
  // Skip DNS resolution for IP literals (already checked above)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return

  let addrs: string[] = []
  try {
    const { promises } = await import('dns')
    const records = await promises.lookup(host, { all: true })
    addrs = records.map((r) => r.address)
  } catch {
    throw new Error('域名解析失败')
  }

  for (const ip of addrs) {
    if (isPrivateIp(ip)) {
      throw new Error('不允许访问内网地址')
    }
  }
}

export function buildFetchHeaders(url: URL): Record<string, string> {
  const host = url.hostname.toLowerCase()
  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  }

  if (host.includes('zhihu.com')) {
    headers.Referer = 'https://www.zhihu.com/'
  } else if (host.includes('weixin.qq.com') || host.includes('mp.weixin.qq.com')) {
    headers.Referer = 'https://mp.weixin.qq.com/'
  } else if (host.includes('jianshu.com')) {
    headers.Referer = 'https://www.jianshu.com/'
  }

  return headers
}
