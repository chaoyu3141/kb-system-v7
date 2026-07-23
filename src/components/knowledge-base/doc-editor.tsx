'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Edit3, Eye, History, Share2, MoreVertical, Trash2,
  Loader2, Download, FileText,
  ChevronRight, BookOpen, Save, Upload, Globe,
} from 'lucide-react'
import { useKBStore } from '@/store/kb-store'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { VersionHistory } from './version-history'
import { ShareDialog } from './share-dialog'
import { RichTextEditor } from './editors/rich-text-editor'
import { MarkdownEditor } from './editors/markdown-editor'
import { SheetEditor } from './editors/sheet-editor'
import { WebToMdDialog } from './editors/markdown/web-to-md-dialog'
import { MARKDOWN_PREVIEW_ID } from './editors/markdown/constants'
import { exportHtmlDocument, exportPdfViaPrint, exportPngFromElement, exportWordDocument } from '@/lib/markdown/export/export-documents'
import { exportMarkdown, exportPlainText } from '@/lib/markdown/export/export-markdown'
import { DocIcon, DOC_TYPES } from './icons/doc-icons'
import { sanitizeDocHtml } from '@/lib/sanitize/doc-html'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export function DocEditor() {
  const {
    currentKb, currentDoc, selectDoc, refreshCurrentDoc, currentKb: kb,
  } = useKBStore()
  const [mode, setMode] = useState<'edit' | 'preview'>('preview')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showWebToMd, setShowWebToMd] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const importFileInputRef = useRef<HTMLInputElement>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedTitle = useRef('')
  const lastSavedContent = useRef('')
  const pendingDocRef = useRef({ id: '', title: '', content: '' })

  useEffect(() => {
    pendingDocRef.current = {
      id: currentDoc?.id || '',
      title,
      content,
    }
  }, [currentDoc?.id, title, content])

  useEffect(() => {
    return () => {
      const pending = pendingDocRef.current
      if (!pending.id) return
      if (pending.title === lastSavedTitle.current && pending.content === lastSavedContent.current) return
      fetch(`/api/documents/${pending.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: pending.title, content: pending.content }),
      }).catch(() => {})
    }
  }, [currentDoc?.id])

  useEffect(() => {
    if (currentDoc) {
      setTitle(currentDoc.title)
      setContent(currentDoc.content || '')
      setMode(currentDoc.docType === 'markdown' ? 'edit' : 'preview')
      setHasChanges(false)
      lastSavedTitle.current = currentDoc.title
      lastSavedContent.current = currentDoc.content || ''
    }
  }, [currentDoc?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const doSave = useCallback(async (createVersion = false) => {
    if (!currentDoc) return false

    const titleChanged = title !== lastSavedTitle.current
    const contentChanged = content !== lastSavedContent.current
    if (!titleChanged && !contentChanged && !createVersion) return false

    setSaving(true)
    try {
      const res = await fetch(`/api/documents/${currentDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      })

      if (res.ok) {
        lastSavedTitle.current = title
        lastSavedContent.current = content
        setHasChanges(false)
        await refreshCurrentDoc()
        useKBStore.getState().notifyDocListChanged()
        return true
      }

      const data = await res.json().catch(() => ({}))
      toast.error(data.error || '保存失败')
      return false
    } catch {
      toast.error('保存失败')
      return false
    } finally {
      setSaving(false)
    }
  }, [currentDoc, title, content, refreshCurrentDoc])

  const handleSave = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    const saved = await doSave(true)
    if (saved) toast.success('保存成功')
  }, [doSave])

  // Auto-save (debounced)
  useEffect(() => {
    if (!currentDoc) return
    if (title === lastSavedTitle.current && content === lastSavedContent.current) return

    setHasChanges(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => doSave(), 1500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [title, content, currentDoc, doSave])

  const handleDelete = async () => {
    if (!currentDoc) return
    if (!confirm('确定删除此文档？')) return
    const res = await fetch(`/api/documents/${currentDoc.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('文档已删除')
      useKBStore.getState().notifyDocListChanged()
      if (currentKb) {
        useKBStore.getState().selectKb(currentKb.id)
      }
    }
  }

  const handleExport = async (format: string) => {
    if (!currentDoc) return
    const res = await fetch(`/api/documents/${currentDoc.id}/export?format=${format}`)
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${currentDoc.title}.${format === 'md' ? 'md' : format === 'html' ? 'html' : format === 'csv' ? 'csv' : 'txt'}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`已导出 ${format.toUpperCase()}`)
    }
  }

  const handleCreateMarkdownDoc = useCallback(
    async (docTitle: string, docContent: string) => {
      if (!currentKb) return
      const config = DOC_TYPES.markdown
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: docTitle,
          content: docContent,
          knowledgeBaseId: currentKb.id,
          docType: 'markdown',
          icon: config.icon,
          parentId: currentDoc?.parentId ?? null,
        }),
      })
      if (res.ok) {
        const doc = await res.json()
        toast.success('文档创建成功')
        useKBStore.getState().notifyDocListChanged()
        await selectDoc(doc.id)
      } else {
        toast.error('创建文档失败')
      }
    },
    [currentKb, currentDoc?.parentId, selectDoc],
  )

  const handleImportMarkdownDoc = useCallback(
    async (file: File) => {
      const text = await file.text()
      const docTitle = file.name.replace(/\.(md|markdown|txt)$/i, '') || '导入文档'
      await handleCreateMarkdownDoc(docTitle, text)
    },
    [handleCreateMarkdownDoc],
  )

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleImportMarkdownDoc(file)
    e.target.value = ''
  }

  if (!currentKb) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">选择知识库开始阅读</h3>
          <p className="text-sm text-gray-400">从左侧选择知识库和文档</p>
        </div>
      </div>
    )
  }

  if (!currentDoc) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-blue-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-700 mb-2">选择文档开始阅读</h3>
          <p className="text-sm text-gray-400">从左侧选择或新建文档</p>
        </div>
      </div>
    )
  }

  const docType = currentDoc.docType || 'doc'
  const typeConfig = DOC_TYPES[docType as keyof typeof DOC_TYPES] || DOC_TYPES.doc

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Breadcrumb + toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 text-sm text-gray-500 min-w-0">
              <span className="text-base">{currentKb.icon}</span>
              <span className="truncate">{currentKb.name}</span>
              <ChevronRight className="w-3 h-3 text-gray-300" />
              <DocIcon name={docType} size={14} />
              <span className="truncate font-medium text-gray-700">{currentDoc.title}</span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
          {hasChanges && !saving && <span className="text-xs text-amber-500">未保存</span>}
          {!hasChanges && !saving && (
            <span className="text-xs text-gray-400">
              {formatDistanceToNow(new Date(currentDoc.updatedAt), { addSuffix: true, locale: zhCN })}
            </span>
          )}

          {docType !== 'markdown' && (mode === 'preview' ? (
            <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => setMode('edit')}>
              <Edit3 className="w-3.5 h-3.5" /> 编辑
            </Button>
          ) : (
            <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => setMode('preview')}>
              <Eye className="w-3.5 h-3.5" /> 预览
            </Button>
          ))}
          <Button
            size="sm"
            variant={hasChanges ? 'default' : 'ghost'}
            className={cn('h-8 gap-1', hasChanges && 'bg-emerald-600 hover:bg-emerald-700 text-white')}
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            保存
          </Button>

          <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => setShowHistory(true)}>
            <History className="w-3.5 h-3.5" /> 历史
          </Button>

          {docType === 'markdown' && (
            <>
              <input
                ref={importFileInputRef}
                type="file"
                accept=".md,.markdown,.txt"
                className="hidden"
                onChange={handleImportFileChange}
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1"
                title="导入新建文档"
                onClick={() => importFileInputRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5" /> 导入
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 gap-1">
                    <Download className="w-3.5 h-3.5" /> 导出
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportMarkdown(content, title)}>
                    Markdown (.md)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportHtmlDocument(content, title)}>
                    HTML (.html)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportWordDocument(content, title)}>
                    Word (.doc)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportPdfViaPrint(MARKDOWN_PREVIEW_ID)}>
                    PDF（打印）
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      const el = document.getElementById(MARKDOWN_PREVIEW_ID)
                      if (el) await exportPngFromElement(el, title)
                    }}
                  >
                    PNG 图片
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportPlainText(content, title)}>
                    纯文本 (.txt)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1"
                title="网页转 Markdown"
                onClick={() => setShowWebToMd(true)}
              >
                <Globe className="w-3.5 h-3.5" /> 网页转 MD
              </Button>
            </>
          )}

          <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => setShowShare(true)}>
            <Share2 className="w-3.5 h-3.5" /> 分享
          </Button>

          {/* More menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {docType !== 'markdown' && (
                <>
                  <DropdownMenuItem onClick={() => handleExport('md')}>
                    <Download className="w-4 h-4 mr-2" /> 导出 Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('html')}>
                    <Download className="w-4 h-4 mr-2" /> 导出 HTML
                  </DropdownMenuItem>
                  {docType === 'sheet' && (
                    <DropdownMenuItem onClick={() => handleExport('csv')}>
                      <Download className="w-4 h-4 mr-2" /> 导出 CSV
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => handleExport('txt')}>
                    <Download className="w-4 h-4 mr-2" /> 导出 TXT
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" /> 删除文档
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Title input */}
      <div className="px-8 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <DocIcon name={docType} size={20} />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="无标题文档"
            className="flex-1 text-2xl font-bold text-gray-800 bg-transparent focus:outline-none"
          />
        </div>
      </div>

      {/* Editor area based on doc type */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {docType === 'doc' && (
          mode === 'edit' ? (
            <RichTextEditor content={content} onChange={setContent} />
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div
                id="word-preview"
                className="px-8 py-6 max-w-2xl mx-auto [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline [&_s]:line-through [&_del]:line-through [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:my-2 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-300 [&_blockquote]:pl-4 [&_blockquote]:text-gray-600 [&_blockquote]:italic [&_pre]:bg-gray-800 [&_pre]:text-gray-100 [&_pre]:p-3 [&_pre]:rounded [&_pre]:overflow-x-auto [&_pre]:text-sm [&_pre]:my-2 [&_a]:text-emerald-600 [&_a]:underline [&_img]:max-w-full [&_img]:rounded [&_img]:my-2 [&_table]:my-3 [&_table]:w-full [&_th]:bg-gray-50 [&_th]:font-medium [&_th]:border [&_th]:border-gray-300 [&_th]:px-3 [&_th]:py-1.5 [&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-1.5"
                dangerouslySetInnerHTML={{ __html: sanitizeDocHtml(content) || '<p class="text-gray-400">暂无内容，点击「编辑」开始写入</p>' }}
              />
            </div>
          )
        )}

        {docType === 'markdown' && (
          <MarkdownEditor
            key={currentDoc.id}
            content={content}
            onChange={setContent}
            documentId={currentDoc.id}
          />
        )}

        {docType === 'sheet' && (
          <SheetEditor
            content={content}
            onChange={setContent}
            readOnly={mode === 'preview'}
          />
        )}
      </div>

      {/* Version History */}
      <VersionHistory open={showHistory} onClose={() => setShowHistory(false)} docId={currentDoc.id} />

      {/* Share Dialog */}
      <ShareDialog
        open={showShare}
        onClose={() => setShowShare(false)}
        doc={currentDoc ? { id: currentDoc.id, title: currentDoc.title } : null}
      />

      {docType === 'markdown' && (
        <WebToMdDialog
          open={showWebToMd}
          onClose={() => setShowWebToMd(false)}
          onCreateDocument={handleCreateMarkdownDoc}
        />
      )}
    </div>
  )
}
