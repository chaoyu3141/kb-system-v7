'use client'

import { useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  Heading1, Heading2, Heading3, Quote, Code, Link2, Image,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Subscript, Superscript, Indent, Outdent, Palette, Highlighter,
  Type, Table as TableIcon, Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { safeUrlOrFallback } from '@/lib/sanitize/url'

const FONT_FAMILIES = [
  { label: '宋体', value: 'SimSun, serif' },
  { label: '黑体', value: 'SimHei, sans-serif' },
  { label: '微软雅黑', value: 'Microsoft YaHei, sans-serif' },
  { label: '楷体', value: 'KaiTi, serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Courier New', value: 'Courier New, monospace' },
  { label: 'Georgia', value: 'Georgia, serif' },
]

const FONT_SIZES: Record<string, string> = {
  '12px': '1',
  '14px': '2',
  '16px': '3',
  '18px': '4',
  '24px': '5',
  '32px': '6',
}

const TEXT_COLORS = [
  '#000000', '#333333', '#666666', '#999999', '#cccccc', '#ffffff',
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
]

const BG_COLORS = [
  'transparent', '#fef08a', '#bbf7d0', '#bfdbfe', '#ddd6fe', '#fce7f3',
  '#fecaca', '#fed7aa', '#fef3c7', '#d9f99d', '#a7f3d0', '#bae6fd',
]

export function RichTextEditor({
  content,
  onChange,
}: {
  content: string
  onChange: (content: string) => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showBgPicker, setShowBgPicker] = useState(false)
  const [showTablePicker, setShowTablePicker] = useState(false)

  // Insert HTML at cursor position in textarea
  const insertAtCursor = useCallback((before: string, after: string = '', placeholder: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end) || placeholder
    const newText = content.substring(0, start) + before + selectedText + after + content.substring(end)
    onChange(newText)
    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      textarea.focus()
      const cursorPos = start + before.length + selectedText.length + after.length
      textarea.setSelectionRange(cursorPos, cursorPos)
    })
  }, [content, onChange])

  // Insert raw HTML at cursor
  const insertHTML = useCallback((html: string) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newText = content.substring(0, start) + html + content.substring(end)
    onChange(newText)
    requestAnimationFrame(() => {
      textarea.focus()
      const cursorPos = start + html.length
      textarea.setSelectionRange(cursorPos, cursorPos)
    })
  }, [content, onChange])

  // Wrap selection with HTML tag
  const wrapTag = useCallback((tag: string, attr: string = '') => {
    const open = attr ? `<${tag} ${attr}>` : `<${tag}>`
    insertAtCursor(open, `</${tag}>`, '在此输入')
  }, [insertAtCursor])

  // Toolbar actions
  const actions = {
    bold: () => wrapTag('b'),
    italic: () => wrapTag('i'),
    underline: () => wrapTag('u'),
    strike: () => wrapTag('s'),
    subscript: () => wrapTag('sub'),
    superscript: () => wrapTag('sup'),
    h1: () => wrapTag('h1'),
    h2: () => wrapTag('h2'),
    h3: () => wrapTag('h3'),
    paragraph: () => wrapTag('p'),
    blockquote: () => wrapTag('blockquote'),
    code: () => wrapTag('pre'),
    ul: () => insertAtCursor('<ul>\n  <li>', '</li>\n</ul>\n', '列表项'),
    ol: () => insertAtCursor('<ol>\n  <li>', '</li>\n</ol>\n', '列表项'),
    alignLeft: () => wrapTag('div', 'style="text-align: left"'),
    alignCenter: () => wrapTag('div', 'style="text-align: center"'),
    alignRight: () => wrapTag('div', 'style="text-align: right"'),
    alignJustify: () => wrapTag('div', 'style="text-align: justify"'),
    indent: () => wrapTag('div', 'style="margin-left: 2em"'),
    outdent: () => wrapTag('div', 'style="margin-left: 0"'),
    hr: () => insertHTML('<hr/>\n'),
    link: () => {
      const url = window.prompt('输入链接地址')
      if (url) insertAtCursor(`<a href="${safeUrlOrFallback(url)}">`, '</a>', '链接文字')
    },
    image: () => {
      const url = window.prompt('输入图片地址')
      if (url) insertHTML(`<img src="${safeUrlOrFallback(url)}" alt="图片" style="max-width: 100%; border-radius: 4px; margin: 8px 0;"/>\n`)
    },
    fontName: (value: string) => wrapTag('span', `style="font-family: ${value}"`),
    fontSize: (value: string) => wrapTag('span', `style="font-size: ${value}px"`),
    foreColor: (color: string) => wrapTag('span', `style="color: ${color}"`),
    bgColor: (color: string) => {
      if (color === 'transparent') {
        wrapTag('span', 'style="background: transparent"')
      } else {
        wrapTag('span', `style="background-color: ${color}"`)
      }
    },
  }

  const insertTable = (rows: number, cols: number) => {
    let html = '<table style="border-collapse: collapse; width: 100%; margin: 12px 0;">\n<tbody>\n'
    html += '<tr>\n'
    for (let c = 0; c < cols; c++) {
      html += `  <th style="border: 1px solid #d1d5db; padding: 6px 10px; background: #f3f4f6; text-align: left;">表头${c + 1}</th>\n`
    }
    html += '</tr>\n'
    for (let r = 0; r < rows; r++) {
      html += '<tr>\n'
      for (let c = 0; c < cols; c++) {
        html += `  <td style="border: 1px solid #d1d5db; padding: 6px 10px;">&nbsp;</td>\n`
      }
      html += '</tr>\n'
    }
    html += '</tbody>\n</table>\n'
    insertHTML(html)
    setShowTablePicker(false)
  }

  const ToolBtn = ({ icon: Icon, onClick, title }: { icon: any; onClick: () => void; title: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0 hover:bg-gray-200"
      title={title}
      onClick={onClick}
    >
      <Icon className="w-4 h-4 text-gray-600" />
    </Button>
  )

  const Sep = () => <div className="w-px h-5 bg-gray-300 mx-1" />

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-gray-200 bg-gray-50 flex-wrap gap-y-1">
        {/* Font family */}
        <select
          onChange={(e) => { actions.fontName(e.target.value); e.target.value = '' }}
          className="h-7 text-xs border border-gray-200 rounded px-1 bg-white cursor-pointer hover:border-gray-300"
          defaultValue=""
        >
          <option value="" disabled>字体</option>
          {FONT_FAMILIES.map(f => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
          ))}
        </select>

        {/* Font size */}
        <select
          onChange={(e) => { actions.fontSize(e.target.value); e.target.value = '' }}
          className="h-7 text-xs border border-gray-200 rounded px-1 bg-white cursor-pointer hover:border-gray-300"
          defaultValue=""
        >
          <option value="" disabled>字号</option>
          {Object.entries(FONT_SIZES).map(([label, value]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <Sep />

        {/* Text color */}
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-gray-200"
            title="文字颜色"
            onClick={() => { setShowColorPicker(!showColorPicker); setShowBgPicker(false); setShowTablePicker(false) }}
          >
            <Palette className="w-4 h-4 text-gray-600" />
          </Button>
          {showColorPicker && (
            <div className="absolute top-8 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 grid grid-cols-6 gap-1 w-[168px]">
              {TEXT_COLORS.map(color => (
                <button
                  key={color}
                  className="w-5 h-5 rounded border border-gray-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  onClick={() => { actions.foreColor(color); setShowColorPicker(false) }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Background color */}
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-gray-200"
            title="背景颜色"
            onClick={() => { setShowBgPicker(!showBgPicker); setShowColorPicker(false); setShowTablePicker(false) }}
          >
            <Highlighter className="w-4 h-4 text-gray-600" />
          </Button>
          {showBgPicker && (
            <div className="absolute top-8 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 grid grid-cols-6 gap-1 w-[168px]">
              {BG_COLORS.map(color => (
                <button
                  key={color}
                  className="w-5 h-5 rounded border border-gray-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color === 'transparent' ? '#fff' : color, backgroundImage: color === 'transparent' ? 'linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%)' : undefined, backgroundSize: '8px 8px' }}
                  onClick={() => { actions.bgColor(color); setShowBgPicker(false) }}
                />
              ))}
            </div>
          )}
        </div>

        <Sep />

        {/* Headings */}
        <ToolBtn icon={Heading1} onClick={actions.h1} title="标题1" />
        <ToolBtn icon={Heading2} onClick={actions.h2} title="标题2" />
        <ToolBtn icon={Heading3} onClick={actions.h3} title="标题3" />
        <Sep />

        {/* Inline formatting */}
        <ToolBtn icon={Bold} onClick={actions.bold} title="加粗" />
        <ToolBtn icon={Italic} onClick={actions.italic} title="斜体" />
        <ToolBtn icon={Underline} onClick={actions.underline} title="下划线" />
        <ToolBtn icon={Strikethrough} onClick={actions.strike} title="删除线" />
        <ToolBtn icon={Superscript} onClick={actions.superscript} title="上标" />
        <ToolBtn icon={Subscript} onClick={actions.subscript} title="下标" />
        <Sep />

        {/* Lists */}
        <ToolBtn icon={List} onClick={actions.ul} title="无序列表" />
        <ToolBtn icon={ListOrdered} onClick={actions.ol} title="有序列表" />
        <ToolBtn icon={Quote} onClick={actions.blockquote} title="引用" />
        <ToolBtn icon={Code} onClick={actions.code} title="代码块" />
        <Sep />

        {/* Indent */}
        <ToolBtn icon={Outdent} onClick={actions.outdent} title="减少缩进" />
        <ToolBtn icon={Indent} onClick={actions.indent} title="增加缩进" />
        <Sep />

        {/* Alignment */}
        <ToolBtn icon={AlignLeft} onClick={actions.alignLeft} title="左对齐" />
        <ToolBtn icon={AlignCenter} onClick={actions.alignCenter} title="居中" />
        <ToolBtn icon={AlignRight} onClick={actions.alignRight} title="右对齐" />
        <ToolBtn icon={AlignJustify} onClick={actions.alignJustify} title="两端对齐" />
        <Sep />

        {/* Insert */}
        <ToolBtn icon={Minus} onClick={actions.hr} title="分割线" />
        <ToolBtn icon={Link2} onClick={actions.link} title="链接" />
        <ToolBtn icon={Image} onClick={actions.image} title="图片" />

        {/* Table */}
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-gray-200"
            title="插入表格"
            onClick={() => { setShowTablePicker(!showTablePicker); setShowColorPicker(false); setShowBgPicker(false) }}
          >
            <TableIcon className="w-4 h-4 text-gray-600" />
          </Button>
          {showTablePicker && (
            <div className="absolute top-8 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-[200px]">
              <p className="text-xs text-gray-500 mb-2">选择表格大小</p>
              <div className="grid grid-cols-4 gap-1">
                {[1,2,3,4,5,6].map(r =>
                  [1,2,3,4,5,6].filter(c => c >= r).map(c => (
                    <button
                      key={`${r}-${c}`}
                      className="w-7 h-7 border border-gray-200 hover:bg-emerald-100 hover:border-emerald-400 rounded text-xs"
                      onClick={() => insertTable(r, c)}
                      title={`${r+1}行 × ${c}列`}
                    >
                      {r+1}×{c}
                    </button>
                  ))
                )}
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100">
                <button
                  className="text-xs text-emerald-600 hover:underline"
                  onClick={() => {
                    const r = parseInt(window.prompt('行数', '3') || '0')
                    const c = parseInt(window.prompt('列数', '3') || '0')
                    if (r > 0 && c > 0) insertTable(r, c)
                  }}
                >
                  自定义行列
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Editor - textarea 代替 contentEditable，彻底解决 RTL */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder="使用 Word 编辑器编写...（工具栏可插入格式标签）"
        className="flex-1 px-8 py-6 w-full resize-none focus:outline-none font-mono text-sm leading-relaxed text-gray-700 bg-white overflow-y-auto"
        style={{ minHeight: '300px', direction: 'ltr', textAlign: 'left' }}
        dir="ltr"
        spellCheck={false}
      />
    </div>
  )
}
