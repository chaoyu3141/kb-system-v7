'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Bold, Italic, Strikethrough, List, ListOrdered, Heading1, Heading2, Heading3,
  Quote, Code, Link2, Image, Table, Minus, CheckSquare, Undo2, Redo2, Search,
  Columns2, Eye, FileCode,
} from 'lucide-react'
import type { TextareaEditorApi } from '@/lib/markdown/format-text'
import { insertBlock, insertLineStart, insertText } from '@/lib/markdown/format-text'

type MarkdownToolbarProps = {
  api: TextareaEditorApi
  layout: 'split' | 'edit' | 'preview'
  onLayoutChange: (layout: 'split' | 'edit' | 'preview') => void
  onUndo: () => void
  onRedo: () => void
  onFindReplace: () => void
}

export function MarkdownToolbar({
  api,
  layout,
  onLayoutChange,
  onUndo,
  onRedo,
  onFindReplace,
}: MarkdownToolbarProps) {

  const handleLink = () => {
    const url = window.prompt('输入链接地址')
    if (url) insertText(api, '[', `](${url})`, '链接文字')
  }

  const handleImage = () => {
    const url = window.prompt('输入图片地址')
    if (url) insertText(api, '![', `](${url})`, '图片描述')
  }

  const handleTable = () => {
    insertBlock(api, `\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n| 内容 | 内容 | 内容 |\n`)
  }

  const formatTools = [
    { icon: Heading1, action: () => insertLineStart(api, '# '), title: '标题1' },
    { icon: Heading2, action: () => insertLineStart(api, '## '), title: '标题2' },
    { icon: Heading3, action: () => insertLineStart(api, '### '), title: '标题3' },
    { sep: true },
    { icon: Bold, action: () => insertText(api, '**', '**', '加粗'), title: '加粗' },
    { icon: Italic, action: () => insertText(api, '*', '*', '斜体'), title: '斜体' },
    { icon: Strikethrough, action: () => insertText(api, '~~', '~~', '删除线'), title: '删除线' },
    { icon: Code, action: () => insertText(api, '`', '`', '代码'), title: '行内代码' },
    { sep: true },
    { icon: List, action: () => insertLineStart(api, '- '), title: '无序列表' },
    { icon: ListOrdered, action: () => insertLineStart(api, '1. '), title: '有序列表' },
    { icon: CheckSquare, action: () => insertLineStart(api, '- [ ] '), title: '任务列表' },
    { icon: Quote, action: () => insertLineStart(api, '> '), title: '引用' },
    { icon: FileCode, action: () => insertBlock(api, '\n```\n代码块\n```\n'), title: '代码块' },
    { sep: true },
    { icon: Link2, action: handleLink, title: '链接' },
    { icon: Image, action: handleImage, title: '图片' },
    { icon: Table, action: handleTable, title: '表格' },
    { icon: Minus, action: () => insertBlock(api, '\n---\n'), title: '分割线' },
  ]

  return (
    <div className="flex items-center gap-0.5 px-3 py-2 border-b border-gray-200 bg-gray-50 flex-wrap gap-y-1">
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="撤销" onClick={onUndo}>
        <Undo2 className="w-4 h-4 text-gray-600" />
      </Button>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="重做" onClick={onRedo}>
        <Redo2 className="w-4 h-4 text-gray-600" />
      </Button>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="查找替换" onClick={onFindReplace}>
        <Search className="w-4 h-4 text-gray-600" />
      </Button>
      <div className="w-px h-5 bg-gray-300 mx-1" />

      {formatTools.map((tool, i) => {
        if (tool.sep) return <div key={i} className="w-px h-5 bg-gray-300 mx-1" />
        const Icon = tool.icon!
        return (
          <Button key={i} variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-gray-200" title={tool.title} onClick={tool.action}>
            <Icon className="w-4 h-4 text-gray-600" />
          </Button>
        )
      })}

      <div className="w-px h-5 bg-gray-300 mx-1" />

      <Button
        variant={layout === 'split' ? 'secondary' : 'ghost'}
        size="sm"
        className="h-7 gap-1 px-2"
        title="分屏"
        onClick={() => onLayoutChange('split')}
      >
        <Columns2 className="w-3.5 h-3.5" /> 分屏
      </Button>
      <Button
        variant={layout === 'edit' ? 'secondary' : 'ghost'}
        size="sm"
        className="h-7 gap-1 px-2"
        title="仅编辑"
        onClick={() => onLayoutChange('edit')}
      >
        <FileCode className="w-3.5 h-3.5" /> 编辑
      </Button>
      <Button
        variant={layout === 'preview' ? 'secondary' : 'ghost'}
        size="sm"
        className="h-7 gap-1 px-2"
        title="仅预览"
        onClick={() => onLayoutChange('preview')}
      >
        <Eye className="w-3.5 h-3.5" /> 预览
      </Button>
    </div>
  )
}
