'use client'

import {
  FileText, FileCode, FileSpreadsheet, File, FileType, FileImage,
  Folder, FolderOpen, BookOpen, Notebook, NotebookPen,
  Hash, ListTree, Table, Sheet, Code, Braces,
  type LucideIcon,
} from 'lucide-react'

export type DocIconName =
  | 'doc' | 'markdown' | 'sheet' | 'file' | 'code'
  | 'notebook' | 'book' | 'folder' | 'table' | 'list'
  | 'hash' | 'image' | 'filetype'

const iconMap: Record<DocIconName, LucideIcon> = {
  doc: FileText,
  markdown: FileCode,
  sheet: FileSpreadsheet,
  file: File,
  code: Code,
  notebook: Notebook,
  book: BookOpen,
  folder: Folder,
  table: Table,
  list: ListTree,
  hash: Hash,
  image: FileImage,
  filetype: FileType,
}

const colorMap: Record<DocIconName, string> = {
  doc: 'text-blue-500',
  markdown: 'text-indigo-500',
  sheet: 'text-emerald-500',
  file: 'text-gray-400',
  code: 'text-purple-500',
  notebook: 'text-amber-500',
  book: 'text-cyan-500',
  folder: 'text-yellow-500',
  table: 'text-green-500',
  list: 'text-rose-500',
  hash: 'text-pink-500',
  image: 'text-teal-500',
  filetype: 'text-orange-500',
}

export function DocIcon({
  name,
  className,
  size = 16,
}: {
  name: DocIconName | string
  className?: string
  size?: number
}) {
  const iconName = (name in iconMap ? name : 'file') as DocIconName
  const Icon = iconMap[iconName]
  const color = colorMap[iconName]
  return <Icon className={`${color} ${className || ''}`} size={size} />
}

// Emoji icon set for knowledge bases
export const KB_ICONS = [
  '📚', '📁', '📂', '📒', '📓', '📔', '📕', '📗', '📘', '📙',
  '🔧', '⚙️', '🛠️', '💡', '🔍', '📋', '📝', '📊', '📈', '🎯',
  '👥', '🏢', '🏠', '🎨', '🚀', '⭐', '🌟', '💻', '📱', '🌐',
  '🗂️', '🏷️', '📌', '📍', '🎒', '🎁', '🔥', '⚡', '🌈', '🎪',
]

// Document type config
export const DOC_TYPES = {
  doc: {
    label: '文档',
    icon: 'doc' as DocIconName,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    defaultTitle: '无标题文档',
    defaultContent: '',
  },
  markdown: {
    label: 'Markdown',
    icon: 'markdown' as DocIconName,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-50',
    defaultTitle: '无标题文档',
    defaultContent: '# 标题\n\n开始编辑...',
  },
  sheet: {
    label: '表格',
    icon: 'sheet' as DocIconName,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50',
    defaultTitle: '无标题表格',
    defaultContent: JSON.stringify({
      columns: ['列1', '列2', '列3'],
      rows: [['', '', ''], ['', '', ''], ['', '', '']],
    }),
  },
} as const

export type DocType = keyof typeof DOC_TYPES
