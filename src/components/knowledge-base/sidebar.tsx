'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  FileText, FileCode, FileSpreadsheet, MoreHorizontal, ChevronRight, ChevronDown,
  Plus, Search, Upload, Trash2, Edit3, BookOpen,
  FolderPlus, FilePlus, Sparkles, ChevronLeft, Folder, Copy,
} from 'lucide-react'
import { useKBStore } from '@/store/kb-store'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { KB_ICONS, DOC_TYPES, DocIcon } from './icons/doc-icons'
import { flattenDocTree } from '@/lib/documents/doc-tree'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export function Sidebar() {
  const { user, kbs, currentKb, documents, currentDoc, fetchKbs, selectKb, fetchDocuments, selectDoc, setCurrentDoc, docListRevision } = useKBStore()
  const [expandedKbs, setExpandedKbs] = useState<Set<string>>(new Set())
  const [docTree, setDocTree] = useState<Record<string, any[]>>({})
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set())
  const [showCreateKb, setShowCreateKb] = useState(false)
  const [showCreateDoc, setShowCreateDoc] = useState(false)
  const [createDocType, setCreateDocType] = useState<string>('doc')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [draggedDoc, setDraggedDoc] = useState<{ id: string; kbId: string; parentId: string | null } | null>(null)
  const [dragOverDoc, setDragOverDoc] = useState<string | null>(null)
  const [dragOverKb, setDragOverKb] = useState<string | null>(null)
  const [kbForm, setKbForm] = useState({ name: '', description: '', icon: '📚' })
  const [newDocTitle, setNewDocTitle] = useState('')
  const [editingKb, setEditingKb] = useState<string | null>(null)
  const [kbEditForm, setKbEditForm] = useState({ name: '', description: '', icon: '📚' })
  const [renamingDoc, setRenamingDoc] = useState<{ id: string; title: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refreshKbDocs = async (kbId: string) => {
    const docs = await fetchDocuments(kbId, null, true)
    setDocTree((prev) => ({ ...prev, [kbId]: docs }))
  }

  // Load docs for expanded KBs (also refresh when doc list changes)
  useEffect(() => {
    expandedKbs.forEach(async (kbId) => {
      await refreshKbDocs(kbId)
    })
  }, [expandedKbs, docListRevision]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-expand current KB
  useEffect(() => {
    if (currentKb && !expandedKbs.has(currentKb.id)) {
      setExpandedKbs((prev) => new Set([...prev, currentKb.id]))
    }
  }, [currentKb]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcut for search
  const searchInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const toggleKb = (kbId: string) => {
    setExpandedKbs((prev) => {
      const next = new Set(prev)
      if (next.has(kbId)) next.delete(kbId)
      else next.add(kbId)
      return next
    })
  }

  const toggleDoc = async (docId: string) => {
    setExpandedDocs((prev) => {
      const next = new Set(prev)
      if (next.has(docId)) next.delete(docId)
      else next.add(docId)
      return next
    })
  }

  const handleCreateKb = async () => {
    if (!kbForm.name.trim()) return
    const res = await fetch('/api/knowledge-bases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(kbForm),
    })
    if (res.ok) {
      toast.success('知识库创建成功')
      setShowCreateKb(false)
      setKbForm({ name: '', description: '', icon: '📚' })
      fetchKbs()
    }
  }

  const handleCreateDoc = async (docType: string) => {
    if (!currentKb) {
      toast.error('请先选择知识库')
      return
    }
    const config = DOC_TYPES[docType as keyof typeof DOC_TYPES]
    const title = newDocTitle.trim() || config.defaultTitle
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        content: config.defaultContent,
        knowledgeBaseId: currentKb.id,
        docType,
        icon: config.icon,
        parentId: currentDoc?.parentId ?? null,
      }),
    })
    if (res.ok) {
      const doc = await res.json()
      toast.success('文档创建成功')
      setShowCreateDoc(false)
      setNewDocTitle('')
      await refreshKbDocs(currentKb.id)
      useKBStore.getState().notifyDocListChanged()
      selectDoc(doc.id)
    }
  }

  const handleDeleteKb = async (kbId: string) => {
    if (!confirm('确定删除此知识库？所有文档将一并删除。')) return
    const res = await fetch(`/api/knowledge-bases/${kbId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('知识库已删除')
      if (currentKb?.id === kbId) {
        setCurrentDoc(null)
        useKBStore.getState().setCurrentKb(null)
      }
      fetchKbs()
    }
  }

  const handleEditKb = async () => {
    if (!editingKb || !kbEditForm.name.trim()) return
    const res = await fetch(`/api/knowledge-bases/${editingKb}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(kbEditForm),
    })
    if (res.ok) {
      toast.success('知识库已更新')
      setEditingKb(null)
      fetchKbs()
    }
  }

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm('确定删除此文档？')) return
    const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('文档已删除')
      if (currentKb) {
        await refreshKbDocs(currentKb.id)
        useKBStore.getState().notifyDocListChanged()
      }
      if (currentDoc?.id === docId) setCurrentDoc(null)
    }
  }

  const handleCopyDoc = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}`)
      if (!res.ok) {
        toast.error('获取文档失败')
        return
      }
      const doc = await res.json()
      const config = DOC_TYPES[doc.docType as keyof typeof DOC_TYPES] || DOC_TYPES.doc
      const createRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${doc.title} - 副本`,
          content: doc.content || '',
          knowledgeBaseId: doc.knowledgeBaseId,
          docType: doc.docType || 'doc',
          icon: doc.icon || config.icon,
          parentId: doc.parentId ?? null,
        }),
      })
      if (createRes.ok) {
        const newDoc = await createRes.json()
        toast.success('副本创建成功')
        if (currentKb) {
          await refreshKbDocs(currentKb.id)
          useKBStore.getState().notifyDocListChanged()
        }
        selectDoc(newDoc.id)
      } else {
        toast.error('复制失败')
      }
    } catch {
      toast.error('复制失败')
    }
  }

  const handleRenameDoc = async () => {
    if (!renamingDoc?.title.trim()) return
    const res = await fetch(`/api/documents/${renamingDoc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: renamingDoc.title.trim() }),
    })
    if (res.ok) {
      toast.success('重命名成功')
      const docId = renamingDoc.id
      setRenamingDoc(null)
      if (currentKb) {
        await refreshKbDocs(currentKb.id)
        useKBStore.getState().notifyDocListChanged()
      }
      if (currentDoc?.id === docId) {
        await selectDoc(docId)
      }
    } else {
      toast.error('重命名失败')
    }
  }

  // Inline search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    setSearchLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data)
        }
      } catch {}
      setSearchLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleSearchResultClick = async (r: any) => {
    // Find the KB and select it, then select the doc
    const kb = kbs.find(k => k.id === r.knowledgeBaseId)
    if (kb) {
      selectKb(kb.id)
      if (!expandedKbs.has(kb.id)) {
        setExpandedKbs(prev => new Set([...prev, kb.id]))
      }
      // Fetch docs if needed
      if (!docTree[kb.id]) {
        await refreshKbDocs(kb.id)
      }
    }
    // Fetch and select the doc
    try {
      const res = await fetch(`/api/documents/${r.id}`)
      if (res.ok) {
        const doc = await res.json()
        setCurrentDoc(doc)
      }
    } catch {}
    setSearchQuery('')
    setSearchResults([])
  }

  // Drag and drop for documents
  const handleDragStart = (e: React.DragEvent, doc: any, kbId: string) => {
    e.stopPropagation()
    setDraggedDoc({ id: doc.id, kbId, parentId: doc.parentId || null })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', doc.id)
  }

  const handleDragOver = (e: React.DragEvent, docId?: string, kbId?: string) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (docId) setDragOverDoc(docId)
    else if (kbId) setDragOverKb(kbId)
  }

  const handleDragLeave = () => {
    setDragOverDoc(null)
    setDragOverKb(null)
  }

  const handleDrop = async (e: React.DragEvent, targetDoc?: any, targetKbId?: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!draggedDoc) return

    const targetKb = targetKbId || targetDoc?.knowledgeBaseId || draggedDoc.kbId
    const targetParent = targetDoc ? (targetDoc.id === draggedDoc.id ? null : targetDoc.id) : null

    // Don't drop on self or if same position
    if (targetDoc && targetDoc.id === draggedDoc.id) {
      setDraggedDoc(null)
      setDragOverDoc(null)
      setDragOverKb(null)
      return
    }

    // Calculate new order
    const siblings = docTree[targetKb] || []
    let newOrder = siblings.length
    if (targetDoc) {
      const idx = siblings.findIndex((d: any) => d.id === targetDoc.id)
      newOrder = idx >= 0 ? idx : siblings.length
    }

    try {
      await fetch(`/api/documents/${draggedDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId: targetParent,
          order: newOrder,
          knowledgeBaseId: targetKb !== draggedDoc.kbId ? targetKb : undefined,
        }),
      })

      // Refresh doc trees
      await refreshKbDocs(targetKb)
      if (targetKb !== draggedDoc.kbId) {
        await refreshKbDocs(draggedDoc.kbId)
      }
      useKBStore.getState().notifyDocListChanged()
      toast.success('文档已移动')
    } catch {
      toast.error('移动失败')
    }

    setDraggedDoc(null)
    setDragOverDoc(null)
    setDragOverKb(null)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentKb) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('knowledgeBaseId', currentKb.id)

    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    if (res.ok) {
      toast.success(`已上传: ${file.name}`)
      await refreshKbDocs(currentKb.id)
      useKBStore.getState().notifyDocListChanged()
    } else {
      toast.error('上传失败')
    }
    e.target.value = ''
  }

  return (
    <div className="w-64 h-full flex flex-col border-r border-gray-200 bg-white flex-shrink-0">
      {/* Search */}
      {/* Inline search */}
      <div className="px-3 py-2 border-b border-gray-100 relative">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索文档..."
            className="w-full pl-8 pr-3 py-1.5 text-sm text-gray-900 bg-gray-50 hover:bg-gray-100 focus:bg-white focus:ring-2 focus:ring-emerald-200 rounded-md border border-transparent focus:border-emerald-300 transition-all outline-none"
          />
          {searchLoading && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <div className="w-3 h-3 border-2 border-gray-300 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
        {/* Search results dropdown */}
        {searchQuery.trim() && searchResults.length > 0 && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-80 overflow-y-auto z-50">
            {searchResults.map((r) => (
              <button
                key={r.id}
                onClick={() => handleSearchResultClick(r)}
                className="w-full px-3 py-2 hover:bg-gray-50 text-left border-b border-gray-50 last:border-0"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span>{r.knowledgeBaseIcon || '📁'}</span>
                  <FileText className="w-3 h-3 text-gray-400" />
                  <span className="text-sm font-medium text-gray-800 truncate">{r.title}</span>
                </div>
                {r.snippet && (
                  <p className="text-xs text-gray-400 line-clamp-1 pl-6">{r.snippet}</p>
                )}
                <p className="text-xs text-gray-300 mt-0.5 pl-6">{r.knowledgeBaseName}</p>
              </button>
            ))}
          </div>
        )}
        {searchQuery.trim() && !searchLoading && searchResults.length === 0 && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-4 text-center text-sm text-gray-400 z-50">
            未找到相关文档
          </div>
        )}
      </div>

      {/* KB list */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <div className="flex items-center justify-between px-1 py-1">
          <span className="text-xs font-medium text-gray-700 uppercase tracking-wider">知识库</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setShowCreateKb(true)}
            title="新建知识库"
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </Button>
        </div>

        {kbs.map((kb) => (
          <div key={kb.id}>
            {/* KB item */}
            <div
              className={cn(
                "group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                currentKb?.id === kb.id ? "bg-emerald-50 text-emerald-700" : "hover:bg-gray-50 text-gray-900",
                dragOverKb === kb.id && "ring-2 ring-emerald-300"
              )}
              onClick={() => { selectKb(kb.id); toggleKb(kb.id) }}
              onDragOver={(e) => handleDragOver(e, undefined, kb.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, undefined, kb.id)}
            >
              {expandedKbs.has(kb.id) ? (
                <ChevronDown className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
              )}
              <span className="text-sm flex-shrink-0">{kb.icon || '📁'}</span>
              <span className="text-sm truncate flex-1 text-gray-900">{kb.name}</span>

              {/* Add document "+" button (语雀风格) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity"
                    title="添加文档"
                  >
                    <Plus className="w-4 h-4 text-gray-700" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation()
                    useKBStore.getState().setCurrentKb(kb)
                    setCreateDocType('doc')
                    setShowCreateDoc(true)
                  }}>
                    <FileText className="w-4 h-4 mr-2 text-blue-500" /> 文档
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation()
                    useKBStore.getState().setCurrentKb(kb)
                    setCreateDocType('markdown')
                    setShowCreateDoc(true)
                  }}>
                    <FileCode className="w-4 h-4 mr-2 text-indigo-500" /> Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation()
                    useKBStore.getState().setCurrentKb(kb)
                    setCreateDocType('sheet')
                    setShowCreateDoc(true)
                  }}>
                    <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-500" /> 表格
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation()
                    useKBStore.getState().setCurrentKb(kb)
                    setTimeout(() => fileInputRef.current?.click(), 100)
                  }}>
                    <Upload className="w-4 h-4 mr-2" /> 导入文档
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* KB actions dropdown (三点) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity"
                    title="更多操作"
                  >
                    <MoreHorizontal className="w-4 h-4 text-gray-700" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation()
                    setEditingKb(kb.id)
                    setKbEditForm({ name: kb.name, description: kb.description || '', icon: kb.icon || '📚' })
                  }}>
                    <Edit3 className="w-3.5 h-3.5 mr-2" /> 重命名
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteKb(kb.id) }} className="text-red-600">
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> 删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Documents under this KB */}
            {expandedKbs.has(kb.id) && docTree[kb.id] && (
              <div className="ml-4 border-l border-gray-100">
                {docTree[kb.id].length === 0 ? (
                  <div className="px-2 py-1 text-xs text-gray-300">暂无文档</div>
                ) : (
                  flattenDocTree(docTree[kb.id]).map((doc) => (
                    <div
                      key={doc.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, doc, kb.id)}
                      onDragOver={(e) => handleDragOver(e, doc.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, doc)}
                      className={cn(
                        "group flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition-colors ml-1",
                        currentDoc?.id === doc.id ? "bg-emerald-50 text-emerald-700" : "hover:bg-gray-50 text-gray-800",
                        dragOverDoc === doc.id && "ring-2 ring-emerald-300 bg-emerald-50",
                        draggedDoc?.id === doc.id && "opacity-50"
                      )}
                      style={{ paddingLeft: `${8 + doc.depth * 12}px` }}
                      onClick={() => selectDoc(doc.id)}
                    >
                      <DocIcon name={doc.docType || 'doc'} size={14} className="flex-shrink-0" />
                      <span className="text-sm truncate flex-1">{doc.title}</span>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-200 rounded"
                          >
                            <MoreHorizontal className="w-3 h-3 text-gray-400" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopyDoc(doc.id) }}>
                            <Copy className="w-3.5 h-3.5 mr-2" /> 复制
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            setRenamingDoc({ id: doc.id, title: doc.title })
                          }}>
                            <Edit3 className="w-3.5 h-3.5 mr-2" /> 重命名
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc.id) }} className="text-red-600">
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> 删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}

        {kbs.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-gray-400 mb-3">还没有知识库</p>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => setShowCreateKb(true)}
            >
              <Plus className="w-3 h-3 mr-1" /> 新建知识库
            </Button>
          </div>
        )}
      </div>

      {/* Hidden file input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.txt,.csv,.html"
        onChange={handleUpload}
        className="hidden"
      />

      {/* Create KB Dialog */}
      <Dialog open={showCreateKb} onOpenChange={setShowCreateKb}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建知识库</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input
                value={kbForm.name}
                onChange={(e) => setKbForm({ ...kbForm, name: e.target.value })}
                placeholder="知识库名称"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>描述（可选）</Label>
              <Input
                value={kbForm.description}
                onChange={(e) => setKbForm({ ...kbForm, description: e.target.value })}
                placeholder="简短描述"
              />
            </div>
            <div className="space-y-2">
              <Label>图标</Label>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                {KB_ICONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setKbForm({ ...kbForm, icon })}
                    className={cn(
                      "w-8 h-8 flex items-center justify-center rounded text-lg hover:bg-gray-100",
                      kbForm.icon === icon && "bg-emerald-100 ring-2 ring-emerald-400"
                    )}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateKb(false)}>取消</Button>
            <Button
              onClick={handleCreateKb}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit KB Dialog */}
      <Dialog open={!!editingKb} onOpenChange={(v) => !v && setEditingKb(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑知识库</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input
                value={kbEditForm.name}
                onChange={(e) => setKbEditForm({ ...kbEditForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Input
                value={kbEditForm.description}
                onChange={(e) => setKbEditForm({ ...kbEditForm, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>图标</Label>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                {KB_ICONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setKbEditForm({ ...kbEditForm, icon })}
                    className={cn(
                      "w-8 h-8 flex items-center justify-center rounded text-lg hover:bg-gray-100",
                      kbEditForm.icon === icon && "bg-emerald-100 ring-2 ring-emerald-400"
                    )}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingKb(null)}>取消</Button>
            <Button onClick={handleEditKb} className="bg-emerald-600 hover:bg-emerald-700 text-white">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Doc Dialog */}
      <Dialog open={showCreateDoc} onOpenChange={setShowCreateDoc}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              新建{DOC_TYPES[createDocType as keyof typeof DOC_TYPES]?.label || '文档'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>文档标题</Label>
              <Input
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                placeholder="请输入文档标题（可留空）"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateDoc(createDocType)
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDoc(false)}>取消</Button>
            <Button
              onClick={() => handleCreateDoc(createDocType)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Doc Dialog */}
      <Dialog open={!!renamingDoc} onOpenChange={(v) => !v && setRenamingDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名文档</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>文档标题</Label>
              <Input
                value={renamingDoc?.title ?? ''}
                onChange={(e) => setRenamingDoc((prev) => prev ? { ...prev, title: e.target.value } : null)}
                placeholder="请输入文档标题"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameDoc()
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenamingDoc(null)}>取消</Button>
            <Button onClick={handleRenameDoc} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
