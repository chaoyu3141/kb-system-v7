'use client'

import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'

type FindReplaceDialogProps = {
  open: boolean
  onClose: () => void
  content: string
  onReplace: (value: string) => void
}

export function FindReplaceDialog({ open, onClose, content, onReplace }: FindReplaceDialogProps) {
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [status, setStatus] = useState('')

  const handleReplaceAll = () => {
    if (!findText) {
      setStatus('请输入查找内容')
      return
    }
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
    const count = (content.match(regex) || []).length
    if (count === 0) {
      setStatus('未找到匹配内容')
      return
    }
    onReplace(content.replace(regex, replaceText))
    setStatus(`已替换 ${count} 处`)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>查找与替换</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="find">查找</Label>
            <Input id="find" value={findText} onChange={(e) => setFindText(e.target.value)} placeholder="查找内容" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="replace">替换为</Label>
            <Input id="replace" value={replaceText} onChange={(e) => setReplaceText(e.target.value)} placeholder="替换内容" />
          </div>
          {status && <p className="text-sm text-gray-500">{status}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleReplaceAll} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            全部替换
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
