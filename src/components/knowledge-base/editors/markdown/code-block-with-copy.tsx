'use client'

import { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { classicDarkStyle } from '@/lib/markdown/classic-dark-style'

export function CodeBlockWithCopy({ language, code }: { language?: string; code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <div className="group relative my-3">
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-3 top-3 z-10 rounded-md border border-white/20 bg-white/90 px-2.5 py-1 text-xs font-medium text-gray-900 opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 hover:bg-white"
      >
        {copied ? '已复制' : '复制'}
      </button>
      <SyntaxHighlighter
        style={classicDarkStyle}
        language={language || 'text'}
        PreTag="div"
        wrapLongLines={false}
        customStyle={{
          margin: 0,
          borderRadius: '12px',
          padding: '16px',
          fontSize: '0.875rem',
          background: '#111827',
          overflowX: 'auto',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}
