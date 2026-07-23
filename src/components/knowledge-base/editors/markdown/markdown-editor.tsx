'use client'

import { useEffect, useRef, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useEditorHistory } from '@/hooks/use-editor-history'
import { useSyncScroll } from '@/hooks/use-sync-scroll'
import type { TextareaEditorApi } from '@/lib/markdown/format-text'
import { MarkdownPreviewPane } from './markdown-preview-pane'
import { MarkdownToolbar } from './markdown-toolbar'
import { FindReplaceDialog } from './find-replace-dialog'
import { MARKDOWN_PREVIEW_ID } from './constants'

export type MarkdownEditorProps = {
  content: string
  onChange: (content: string) => void
  documentId: string
}

export { MARKDOWN_PREVIEW_ID }

export function MarkdownEditor({
  content,
  onChange,
  documentId,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previewScrollRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<'split' | 'edit' | 'preview'>('split')
  const [showFind, setShowFind] = useState(false)

  const { undo, redo, resetHistory } = useEditorHistory(content, onChange)
  const { syncFromEditor, syncFromPreview } = useSyncScroll(layout === 'split')

  const api: TextareaEditorApi = {
    getValue: () => textareaRef.current?.value ?? content,
    setValue: onChange,
    getSelection: () => ({
      start: textareaRef.current?.selectionStart ?? 0,
      end: textareaRef.current?.selectionEnd ?? 0,
    }),
    setSelection: (start, end) => textareaRef.current?.setSelectionRange(start, end),
    focus: () => textareaRef.current?.focus(),
  }

  useEffect(() => {
    resetHistory(content)
  }, [documentId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault()
        redo()
      } else if (e.key === 'f') {
        e.preventDefault()
        setShowFind(true)
      }
    }
  }

  const editorPane = (
    <textarea
      ref={textareaRef}
      value={content}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onScroll={() => syncFromEditor(textareaRef.current, previewScrollRef.current)}
      placeholder="使用 Markdown 编写..."
      className="flex-1 min-h-0 px-6 py-6 w-full resize-none focus:outline-none font-mono text-sm leading-relaxed text-gray-700 bg-white overflow-y-auto"
      dir="ltr"
    />
  )

  const previewPane = (
    <MarkdownPreviewPane
      content={content}
      previewId={MARKDOWN_PREVIEW_ID}
      scrollRef={previewScrollRef}
      onScroll={() => syncFromPreview(textareaRef.current, previewScrollRef.current)}
    />
  )

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden" dir="ltr">
      <MarkdownToolbar
        api={api}
        layout={layout}
        onLayoutChange={setLayout}
        onUndo={undo}
        onRedo={redo}
        onFindReplace={() => setShowFind(true)}
      />

      <div className="flex-1 min-h-0 overflow-hidden">
        {layout === 'split' && (
          <PanelGroup direction="horizontal" className="h-full">
            <Panel defaultSize={50} minSize={20}>
              <div className="h-full flex flex-col">{editorPane}</div>
            </Panel>
            <PanelResizeHandle className="w-1.5 bg-gray-100 hover:bg-emerald-200 transition-colors" />
            <Panel defaultSize={50} minSize={20}>
              <div className="h-full flex flex-col border-l border-gray-200 overflow-hidden">
                {previewPane}
              </div>
            </Panel>
          </PanelGroup>
        )}
        {layout === 'edit' && <div className="h-full flex flex-col">{editorPane}</div>}
        {layout === 'preview' && <div className="h-full flex flex-col">{previewPane}</div>}
      </div>

      <FindReplaceDialog
        open={showFind}
        onClose={() => setShowFind(false)}
        content={content}
        onReplace={onChange}
      />
    </div>
  )
}
