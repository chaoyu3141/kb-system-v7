'use client'

import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Copy, Link2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  SHARE_EXPIRE_OPTIONS,
  inferExpireOption,
  type ShareExpireOption,
} from '@/lib/share/public-share'

interface DocInfo {
  id: string
  title: string
}

type ShareState = {
  shareEnabled: boolean
  shareToken: string | null
  shareExpireAt: string | null
  shareUrl: string | null
}

export function ShareDialog({
  open,
  onClose,
  doc,
}: {
  open: boolean
  onClose: () => void
  doc: DocInfo | null
}) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [share, setShare] = useState<ShareState>({
    shareEnabled: false,
    shareToken: null,
    shareExpireAt: null,
    shareUrl: null,
  })
  const [expireOption, setExpireOption] = useState<ShareExpireOption>('1week')

  useEffect(() => {
    if (!open || !doc) return
    setLoading(true)
    fetch(`/api/documents/${doc.id}/share`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          toast.error(data.error)
          return
        }
        setShare(data)
        if (data.shareExpireAt) {
          setExpireOption(inferExpireOption(new Date(data.shareExpireAt)))
        } else if (data.shareEnabled) {
          setExpireOption('forever')
        }
      })
      .catch(() => toast.error('加载分享设置失败'))
      .finally(() => setLoading(false))
  }, [open, doc?.id])

  const fullShareUrl = share.shareUrl
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${share.shareUrl}`
    : ''

  const updateShare = async (payload: Record<string, unknown>) => {
    if (!doc) return null
    setSaving(true)
    try {
      const res = await fetch(`/api/documents/${doc.id}/share`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      let data: ShareState & { error?: string }
      try {
        data = await res.json()
      } catch {
        toast.error('服务器响应异常，请重启开发服务后重试')
        return null
      }
      if (!res.ok) {
        toast.error(data.error || `开启分享失败 (${res.status})`)
        return null
      }
      setShare(data)
      if (data.shareExpireAt) {
        setExpireOption(inferExpireOption(new Date(data.shareExpireAt)))
      } else if (data.shareEnabled) {
        setExpireOption('forever')
      }
      return data
    } catch {
      toast.error('操作失败，请检查网络连接')
      return null
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (enabled: boolean) => {
    if (!doc) return
    if (enabled) {
      const data = await updateShare({ shareEnabled: true, expireOption })
      if (data) toast.success('公开分享已开启')
    } else {
      const data = await updateShare({ shareEnabled: false })
      if (data) toast.success('公开分享已关闭')
    }
  }

  const handleExpireChange = async (option: ShareExpireOption) => {
    setExpireOption(option)
    if (!share.shareEnabled) return
    await updateShare({ shareEnabled: true, expireOption: option, updateExpireOnly: true })
    toast.success('有效期已更新')
  }

  const handleCopy = async () => {
    if (!fullShareUrl) return
    await navigator.clipboard.writeText(fullShareUrl)
    toast.success('链接已复制到剪贴板')
  }

  const handleDisable = async () => {
    await handleToggle(false)
  }

  const expireHint = share.shareExpireAt
    ? `过期时间：${format(new Date(share.shareExpireAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}`
    : share.shareEnabled
      ? '永久有效'
      : '开启后可生成公开链接'

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>分享 - {doc?.title}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            加载中...
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-sm font-medium text-gray-900">开启公开分享</Label>
                <p className="text-xs text-gray-500 mt-1">开启后，持有链接的人无需登录即可阅读</p>
              </div>
              <Switch
                checked={share.shareEnabled}
                disabled={saving}
                onCheckedChange={handleToggle}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-500">有效期</Label>
              <Select
                value={expireOption}
                onValueChange={(v) => handleExpireChange(v as ShareExpireOption)}
                disabled={saving}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHARE_EXPIRE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">{expireHint}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-500">公开链接</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <Input
                    readOnly
                    value={fullShareUrl}
                    placeholder="开启公开分享后生成链接"
                    className="pl-8 bg-white text-sm"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={handleCopy}
                  disabled={!fullShareUrl || saving}
                  className="shrink-0"
                >
                  <Copy className="w-4 h-4 mr-1" />
                  复制
                </Button>
              </div>
            </div>

            {share.shareEnabled && (
              <Button
                variant="outline"
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                onClick={handleDisable}
                disabled={saving}
              >
                关闭公开分享
              </Button>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>完成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
