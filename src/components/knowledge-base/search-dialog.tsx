'use client'

import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, FileText, Loader2 } from 'lucide-react'
import { useKBStore } from '@/store/kb-store'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface SearchResult {
  id: string
  title: string
  snippet: string
  knowledgeBaseId: string
  knowledgeBaseName: string
  knowledgeBaseIcon: string | null
  updatedAt: string
}

export function SearchDialog({
  open, onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const { selectKb, selectDoc } = useKBStore()

  useEffect(() => {
    if (!open) {
      setQ('')
      setResults([])
    }
  }, [open])

  useEffect(() => {
    if (q.trim().length === 0) {
      setResults([])
      return
    }
    setLoading(true)
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then(setResults)
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [q])

  const handleSelect = async (result: SearchResult) => {
    await selectKb(result.knowledgeBaseId)
    await selectDoc(result.id)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索文档标题和内容..."
            className="flex-1 outline-none text-sm bg-transparent"
            autoFocus
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        </div>
        <ScrollArea className="max-h-96">
          <div className="p-2">
            {results.length === 0 && !loading && q.trim().length > 0 && (
              <p className="text-sm text-gray-400 text-center py-8">未找到匹配文档</p>
            )}
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => handleSelect(r)}
                className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span>{r.knowledgeBaseIcon || '📁'}</span>
                  <FileText className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">{r.title}</span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {formatDistanceToNow(new Date(r.updatedAt), { addSuffix: true, locale: zhCN })}
                  </span>
                </div>
                {r.snippet && (
                  <p className="text-xs text-gray-500 line-clamp-2 pl-6">{r.snippet}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5 pl-6">{r.knowledgeBaseName}</p>
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
