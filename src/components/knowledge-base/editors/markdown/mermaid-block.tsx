'use client'

import { useEffect, useRef, useState } from 'react'

export function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict' })
        const id = `mermaid-${Math.random().toString(36).slice(2)}`
        const { svg: rendered } = await mermaid.render(id, code.trim())
        if (!cancelled) {
          setSvg(rendered)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Mermaid 渲染失败')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code])

  if (error) {
    return (
      <pre className="my-3 rounded-xl bg-[#111827] p-4 text-sm text-red-300 overflow-x-auto">
        {code}
      </pre>
    )
  }

  return (
    <div
      ref={ref}
      className="my-3 overflow-x-auto rounded-xl border border-gray-200 bg-white p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
