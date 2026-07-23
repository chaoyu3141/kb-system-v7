import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import {
  assertPublicHost,
  buildFetchHeaders,
  validateFetchUrl,
} from '@/lib/markdown/web-to-md/sanitize-url'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const body = await req.json()
  const rawUrl = body.url as string
  if (!rawUrl) return NextResponse.json({ error: '缺少 URL' }, { status: 400 })

  let parsedUrl: URL
  try {
    parsedUrl = validateFetchUrl(rawUrl)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'URL 无效' }, { status: 400 })
  }

  try {
    // Defense against DNS rebinding: resolve and reject private IPs.
    await assertPublicHost(parsedUrl)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'URL 无效' }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)

    // Do NOT follow redirects automatically; if a redirect is returned,
    // the caller must re-submit the final URL (which is re-validated).
    const res = await fetch(parsedUrl.toString(), {
      headers: buildFetchHeaders(parsedUrl),
      signal: controller.signal,
      redirect: 'manual',
    })
    clearTimeout(timeout)

    // Treat 3xx as disallowed to avoid redirect-based SSRF bypass.
    if (res.status >= 300 && res.status < 400) {
      return NextResponse.json(
        { error: '目标存在重定向，请直接粘贴最终网页地址' },
        { status: 400 },
      )
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

    return NextResponse.json({ html, url: parsedUrl.toString() })
  } catch (e) {
    const message = e instanceof Error ? e.message : '抓取失败'
    return NextResponse.json(
      { error: `${message}，请尝试手动粘贴 HTML` },
      { status: 502 },
    )
  }
}

