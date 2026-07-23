'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { convertHtmlToMarkdownDocument } from '@/lib/markdown/web-to-md/html-to-markdown'
import { toast } from 'sonner'

type WebToMdDialogProps = {
  open: boolean
  onClose: () => void
  onCreateDocument: (title: string, markdown: string) => Promise<void>
}

export function WebToMdDialog({ open, onClose, onCreateDocument }: WebToMdDialogProps) {
  const [url, setUrl] = useState('')
  const [manualHtml, setManualHtml] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const handleFetch = async () => {
    if (!url.trim()) {
      setStatus('请输入网页 URL')
      return
    }
    setLoading(true)
    setStatus('正在抓取网页...')
    try {
      const res = await fetch('/api/web-to-md', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '抓取失败')
      const { title, markdown } = convertHtmlToMarkdownDocument(data.html)
      await onCreateDocument(title, markdown)
      toast.success('已创建新文档')
      onClose()
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '抓取失败，可尝试手动粘贴 HTML')
    } finally {
      setLoading(false)
    }
  }

  const handleManualConvert = async () => {
    if (!manualHtml.trim()) {
      setStatus('请粘贴 HTML 内容')
      return
    }
    try {
      const { title, markdown } = convertHtmlToMarkdownDocument(manualHtml)
      await onCreateDocument(title, markdown)
      toast.success('已创建新文档')
      onClose()
    } catch {
      setStatus('HTML 转换失败')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>网页转 Markdown</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="web-url">网页 URL</Label>
            <Input
              id="web-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://mp.weixin.qq.com/s/..."
            />
            <p className="text-xs text-gray-400">支持微信公众号、知乎等（通过服务端代理抓取）</p>
          </div>
          <Button
            onClick={handleFetch}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            抓取并新建文档
          </Button>
          <div className="space-y-2">
            <Label htmlFor="manual-html">或手动粘贴 HTML</Label>
            <Textarea
              id="manual-html"
              value={manualHtml}
              onChange={(e) => setManualHtml(e.target.value)}
              placeholder="粘贴网页 HTML 源码..."
              rows={6}
              className="font-mono text-xs"
            />
          </div>
          {status && <p className="text-sm text-amber-600">{status}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleManualConvert}>从 HTML 新建文档</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
