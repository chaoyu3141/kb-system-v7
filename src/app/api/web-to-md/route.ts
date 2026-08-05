import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import {
  assertPublicHost,
  buildFetchHeaders,
  cookieHeaderFromJar,
  mergeSetCookie,
  validateFetchUrl,
} from '@/lib/markdown/web-to-md/sanitize-url'

const MAX_REDIRECTS = 5

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const body = await req.json()
  const rawUrl = body.url as string
  if (!rawUrl) return NextResponse.json({ error: '缺少 URL' }, { status: 400 })

  let currentUrl: URL
  try {
    currentUrl = validateFetchUrl(rawUrl)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'URL 无效' }, { status: 400 })
  }

  try {
    // Defense against DNS rebinding: resolve and reject private IPs.
    await assertPublicHost(currentUrl)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'URL 无效' }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)

    // Follow redirects manually so each hop is re-validated (SSRF-safe).
    // Preserve cookies across hops to match browser / previous auto-follow behavior.
    const cookieJar = new Map<string, string>()
    let res: Response | null = null
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      res = await fetch(currentUrl.toString(), {
        headers: buildFetchHeaders(currentUrl, cookieHeaderFromJar(cookieJar)),
        signal: controller.signal,
        redirect: 'manual',
      })
      mergeSetCookie(cookieJar, res)

      if (res.status < 300 || res.status >= 400) break

      if (hop === MAX_REDIRECTS) {
        clearTimeout(timeout)
        return NextResponse.json(
          { error: '重定向次数过多，请直接粘贴最终网页地址' },
          { status: 400 },
        )
      }

      const location = res.headers.get('location')
      if (!location) {
        clearTimeout(timeout)
        return NextResponse.json(
          { error: '目标存在重定向但缺少 Location，请直接粘贴最终网页地址' },
          { status: 400 },
        )
      }

      let nextUrl: URL
      try {
        // Resolve relative Location against the current URL, then re-validate.
        nextUrl = validateFetchUrl(new URL(location, currentUrl).toString())
        await assertPublicHost(nextUrl)
      } catch (e) {
        clearTimeout(timeout)
        return NextResponse.json(
          { error: e instanceof Error ? e.message : '重定向目标无效' },
          { status: 400 },
        )
      }

      currentUrl = nextUrl
    }

    clearTimeout(timeout)

    if (!res) {
      return NextResponse.json({ error: '抓取失败，请尝试手动粘贴 HTML' }, { status: 502 })
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: `抓取失败 (${res.status})，请尝试手动粘贴 HTML` },
        { status: 502 },
      )
    }

    const buffer = await res.arrayBuffer()
    if (buffer.byteLength > 5 * 1024 * 1024) {
      return NextResponse.json({ error: '网页内容过大' }, { status: 413 })
    }

    const html = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
    if (!html || html.length < 100) {
      return NextResponse.json({ error: '网页内容为空或过短' }, { status: 502 })
    }

    return NextResponse.json({ html, url: currentUrl.toString() })
  } catch (e) {
    const message = e instanceof Error ? e.message : '抓取失败'
    return NextResponse.json(
      { error: `${message}，请尝试手动粘贴 HTML` },
      { status: 502 },
    )
  }
}
