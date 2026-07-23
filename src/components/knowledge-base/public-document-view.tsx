'use client'

import { formatDistanceToNow, format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { MarkdownPreviewPane } from '@/components/knowledge-base/editors/markdown/markdown-preview-pane'
import { SheetEditor } from '@/components/knowledge-base/editors/sheet-editor'
import { DocIcon } from '@/components/knowledge-base/icons/doc-icons'
import { sanitizeDocHtml } from '@/lib/sanitize/doc-html'

export type PublicDocument = {
  title: string
  content: string | null
  docType: string
  updatedAt: string
  author: { name: string }
}

export function PublicDocumentView({ doc }: { doc: PublicDocument }) {
  const docType = doc.docType || 'doc'
  const updatedLabel = formatDistanceToNow(new Date(doc.updatedAt), {
    addSuffix: true,
    locale: zhCN,
  })
  const updatedExact = format(new Date(doc.updatedAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <header className="mb-8 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <DocIcon name={docType} size={20} />
            <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">公开分享</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">{doc.title}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
            <span>作者：{doc.author.name}</span>
            <span title={updatedExact}>更新于 {updatedLabel}</span>
          </div>
        </header>

        <article className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {docType === 'markdown' && (
            <div className="min-h-[320px]">
              <MarkdownPreviewPane content={doc.content || ''} previewId="public-markdown-preview" />
            </div>
          )}

          {docType === 'doc' && (
            <div
              className="px-8 py-6 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline [&_s]:line-through [&_del]:line-through [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:my-2 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-300 [&_blockquote]:pl-4 [&_blockquote]:text-gray-600 [&_blockquote]:italic [&_pre]:bg-gray-800 [&_pre]:text-gray-100 [&_pre]:p-3 [&_pre]:rounded [&_pre]:overflow-x-auto [&_pre]:text-sm [&_pre]:my-2 [&_a]:text-emerald-600 [&_a]:underline [&_img]:max-w-full [&_img]:rounded [&_img]:my-2 [&_table]:my-3 [&_table]:w-full [&_th]:bg-gray-50 [&_th]:font-medium [&_th]:border [&_th]:border-gray-300 [&_th]:px-3 [&_th]:py-1.5 [&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-1.5"
              dangerouslySetInnerHTML={{
                __html: sanitizeDocHtml(doc.content || '') || '<p class="text-gray-400">暂无内容</p>',
              }}
            />
          )}

          {docType === 'sheet' && (
            <div className="h-[480px]">
              <SheetEditor content={doc.content || ''} onChange={() => {}} readOnly />
            </div>
          )}

          {!['markdown', 'doc', 'sheet'].includes(docType) && (
            <div className="px-8 py-6 text-gray-600 whitespace-pre-wrap">
              {doc.content || '暂无内容'}
            </div>
          )}
        </article>
      </div>
    </div>
  )
}
