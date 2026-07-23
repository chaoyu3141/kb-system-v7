'use client'

import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { History, RotateCcw } from 'lucide-react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { toast } from 'sonner'

interface Version {
  id: string
  title: string
  content: string | null
  version: number
  editorId: string
  createdAt: string
  editor: { id: string; name: string }
}

export function VersionHistory({
  open, onClose, docId,
}: {
  open: boolean
  onClose: () => void
  docId: string
}) {
  const [versions, setVersions] = useState<Version[]>([])
  const [selected, setSelected] = useState<Version | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && docId) {
      setLoading(true)
      fetch(`/api/documents/${docId}/versions`)
        .then((r) => r.json())
        .then((data) => {
          setVersions(data)
          setSelected(data[0] || null)
        })
        .finally(() => setLoading(false))
    }
  }, [open, docId])

  const handleRestore = async (version: Version) => {
    if (!confirm(`确定恢复到版本 v${version.version}？当前内容将创建新版本。`)) return
    const res = await fetch(`/api/documents/${docId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: version.title, content: version.content }),
    })
    if (res.ok) {
      toast.success('已恢复到历史版本')
      onClose()
      // Refresh current doc
      window.location.reload()
    } else {
      toast.error('恢复失败')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" /> 历史版本
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-4 h-[60vh]">
          {/* Version list */}
          <div className="w-64 border-r border-gray-200 pr-4">
            <ScrollArea className="h-full">
              {loading && <p className="text-sm text-gray-400 py-4">加载中...</p>}
              {!loading && versions.length === 0 && (
                <p className="text-sm text-gray-400 py-4">暂无历史版本</p>
              )}
              <div className="space-y-1">
                {versions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelected(v)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selected?.id === v.id ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-gray-900">v{v.version}</span>
                      <span className="text-xs text-gray-400">
                        {format(new Date(v.createdAt), 'MM-dd HH:mm', { locale: zhCN })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">{v.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{v.editor.name}</p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Version content */}
          <div className="flex-1 flex flex-col">
            {selected ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-gray-500">
                    版本 v{selected.version} · {selected.editor.name} · {format(new Date(selected.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRestore(selected)}
                    className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> 恢复此版本
                  </Button>
                </div>
                <ScrollArea className="flex-1 border border-gray-200 rounded-lg p-4">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {selected.content || '(空)'}
                  </pre>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                选择左侧版本查看内容
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
