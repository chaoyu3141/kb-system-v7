'use client'

import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import {
  getCodeText,
  INLINE_CODE_CLASS,
  languageFromClassName,
  MARKDOWN_PREVIEW_CLASS,
  resolveIsInlineCode,
  type MarkdownCodeProps,
} from '@/lib/markdown/preview-utils'
import { CodeBlockWithCopy } from './code-block-with-copy'
import { MermaidBlock } from './mermaid-block'

type MarkdownPreviewPaneProps = {
  content: string
  previewId?: string
  scrollRef?: React.RefObject<HTMLDivElement | null>
  onScroll?: () => void
}

export function MarkdownPreviewPane({
  content,
  previewId = 'markdown-preview-pane',
  scrollRef,
  onScroll,
}: MarkdownPreviewPaneProps) {
  const components = useMemo(
    () => ({
      pre({ children }: { children?: React.ReactNode }) {
        return <>{children}</>
      },
      code(props: MarkdownCodeProps) {
        const { inline, className, children, node, ...rest } = props
        const lang = languageFromClassName(className)

        if (lang === 'mermaid') {
          return <MermaidBlock code={getCodeText(node, children)} />
        }

        if (resolveIsInlineCode({ inline, className, children, node })) {
          return (
            <code className={INLINE_CODE_CLASS} {...rest}>
              {children}
            </code>
          )
        }

        return (
          <CodeBlockWithCopy language={lang} code={getCodeText(node, children)} />
        )
      },
    }),
    [],
  )

  return (
    <div
      id={previewId}
      ref={scrollRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto px-6 py-6"
      dir="ltr"
    >
      <div className={MARKDOWN_PREVIEW_CLASS}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={components}
        >
          {content || '*暂无内容*'}
        </ReactMarkdown>
      </div>
    </div>
  )
}
