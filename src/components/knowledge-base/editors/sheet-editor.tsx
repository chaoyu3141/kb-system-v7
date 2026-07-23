'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Plus, Trash2, Download, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight,
  Palette, Highlighter, Type,
  ArrowUp, ArrowDown, Copy, ClipboardPaste,
  Filter, ArrowDownAZ, ArrowUpAZ,
  Grid3x3, Eraser,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Cell {
  value: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  color?: string
  bg?: string
  align?: 'left' | 'center' | 'right'
  fontSize?: number
  wrap?: boolean
}
interface SheetData {
  columns: string[]
  colWidths?: number[]
  rowHeights?: number[]
  rows: Cell[][]
}

const TEXT_COLORS = [
  '#000000', '#333333', '#666666', '#999999',
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#22c55e', '#10b981', '#3b82f6', '#6366f1',
  '#8b5cf6', '#ec4899', '#ffffff',
]

const BG_COLORS = [
  'transparent', '#fef08a', '#bbf7d0', '#bfdbfe', '#ddd6fe', '#fce7f3',
  '#fecaca', '#fed7aa', '#fef3c7', '#d9f99d', '#a7f3d0', '#bae6fd',
  '#e9d5ff', '#fbcfe8', '#fee2e2', '#fffbeb',
]

// Convert col index to Excel letter (0->A, 25->Z, 26->AA)
const colToLetter = (col: number): string => {
  let result = ''
  let n = col
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result
    n = Math.floor(n / 26) - 1
  }
  return result
}

export function SheetEditor({
  content,
  onChange,
  readOnly,
}: {
  content: string
  onChange: (content: string) => void
  readOnly?: boolean
}) {
  const [data, setData] = useState<SheetData>(() => {
    try {
      const parsed = JSON.parse(content)
      if (parsed.columns && parsed.rows) {
        // Migrate old string[][] format to Cell[][]
        if (parsed.rows[0] && typeof parsed.rows[0][0] === 'string') {
          parsed.rows = parsed.rows.map((row: string[]) =>
            row.map((cell: string) => ({ value: cell }))
          )
        }
        return parsed
      }
    } catch {}
    return {
      columns: ['列1', '列2', '列3', '列4'],
      colWidths: [120, 120, 120, 120],
      rows: [
        [{value:''},{value:''},{value:''},{value:''}],
        [{value:''},{value:''},{value:''},{value:''}],
        [{value:''},{value:''},{value:''},{value:''}],
        [{value:''},{value:''},{value:''},{value:''}],
        [{value:''},{value:''},{value:''},{value:''}],
      ],
    }
  })

  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
  const [editingHeader, setEditingHeader] = useState<number | null>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showBgPicker, setShowBgPicker] = useState(false)
  const [showFontSize, setShowFontSize] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; row: number; col: number } | null>(null)
  const [resizing, setResizing] = useState<{ col: number; startX: number; startWidth: number } | null>(null)
  const [copiedCell, setCopiedCell] = useState<{ row: number; col: number } | null>(null)
  const [selectedRange, setSelectedRange] = useState<{ startRow: number; startCol: number; endRow: number; endCol: number } | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const parsed = JSON.parse(content)
      if (parsed.columns && parsed.rows) {
        if (parsed.rows[0] && typeof parsed.rows[0][0] === 'string') {
          parsed.rows = parsed.rows.map((row: string[]) =>
            row.map((cell: string) => ({ value: cell }))
          )
        }
        setData(parsed)
      }
    } catch {}
  }, [content])

  // Close context menu on click anywhere
  useEffect(() => {
    const handler = () => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', handler)
      return () => document.removeEventListener('click', handler)
    }
  }, [contextMenu])

  // Handle column resize mouse move
  useEffect(() => {
    if (!resizing) return
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing) return
      const delta = e.clientX - resizing.startX
      const newWidth = Math.max(60, resizing.startWidth + delta)
      const newWidths = [...(data.colWidths || data.columns.map(() => 120))]
      newWidths[resizing.col] = newWidth
      const newData = { ...data, colWidths: newWidths }
      setData(newData)
      onChange(JSON.stringify(newData))
    }
    const handleMouseUp = () => setResizing(null)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizing, data, onChange])

  const updateData = (newData: SheetData) => {
    setData(newData)
    onChange(JSON.stringify(newData))
  }

  const getCell = (row: number, col: number): Cell => {
    return data.rows[row]?.[col] || { value: '' }
  }

  const updateCell = (row: number, col: number, patch: Partial<Cell>) => {
    const newRows = [...data.rows]
    const cell = { ...newRows[row][col], ...patch }
    newRows[row] = [...newRows[row]]
    newRows[row][col] = cell
    updateData({ ...data, rows: newRows })
  }

  const updateCellValue = (row: number, col: number, value: string) => {
    updateCell(row, col, { value })
  }

  // Apply style to a range of cells
  const applyStyleToRange = (patch: Partial<Cell>) => {
    if (!selectedRange && !selectedCell) return
    const range = selectedRange || {
      startRow: selectedCell!.row, startCol: selectedCell!.col,
      endRow: selectedCell!.row, endCol: selectedCell!.col,
    }
    const newRows = [...data.rows]
    const minRow = Math.min(range.startRow, range.endRow)
    const maxRow = Math.max(range.startRow, range.endRow)
    const minCol = Math.min(range.startCol, range.endCol)
    const maxCol = Math.max(range.startCol, range.endCol)
    for (let r = minRow; r <= maxRow; r++) {
      newRows[r] = [...newRows[r]]
      for (let c = minCol; c <= maxCol; c++) {
        newRows[r][c] = { ...newRows[r][c], ...patch }
      }
    }
    updateData({ ...data, rows: newRows })
  }

  const updateColumn = (col: number, value: string) => {
    const newColumns = [...data.columns]
    newColumns[col] = value
    updateData({ ...data, columns: newColumns })
  }

  const addRow = (at?: number) => {
    const newRow = new Array(data.columns.length).fill(null).map(() => ({ value: '' }))
    if (at !== undefined) {
      const newRows = [...data.rows]
      newRows.splice(at + 1, 0, newRow)
      updateData({ ...data, rows: newRows })
    } else {
      updateData({ ...data, rows: [...data.rows, newRow] })
    }
  }

  const addColumn = () => {
    updateData({
      ...data,
      columns: [...data.columns, `列${data.columns.length + 1}`],
      colWidths: [...(data.colWidths || []), 120],
      rows: data.rows.map((row) => [...row, { value: '' }]),
    })
  }

  const insertRow = (at: number) => {
    const newRow = new Array(data.columns.length).fill(null).map(() => ({ value: '' }))
    const newRows = [...data.rows]
    newRows.splice(at, 0, newRow)
    updateData({ ...data, rows: newRows })
  }

  const insertColumn = (at: number) => {
    const newColumns = [...data.columns]
    newColumns.splice(at, 0, `列${data.columns.length + 1}`)
    const newWidths = [...(data.colWidths || data.columns.map(() => 120))]
    newWidths.splice(at, 0, 120)
    const newRows = data.rows.map((row) => {
      const newRow = [...row]
      newRow.splice(at, 0, { value: '' })
      return newRow
    })
    updateData({ ...data, columns: newColumns, colWidths: newWidths, rows: newRows })
  }

  const deleteRow = (idx: number) => {
    updateData({ ...data, rows: data.rows.filter((_, i) => i !== idx) })
  }

  const deleteColumn = (idx: number) => {
    const newWidths = (data.colWidths || []).filter((_, i) => i !== idx)
    updateData({
      ...data,
      columns: data.columns.filter((_, i) => i !== idx),
      colWidths: newWidths,
      rows: data.rows.map((row) => row.filter((_, i) => i !== idx)),
    })
  }

  const clearFormat = () => {
    applyStyleToRange({ bold: false, italic: false, underline: false, color: undefined, bg: undefined, align: undefined, fontSize: undefined })
  }

  // Copy/paste
  const copyCell = () => {
    if (selectedCell) {
      setCopiedCell({ row: selectedCell.row, col: selectedCell.col })
      toast.success('已复制')
    }
  }

  const pasteCell = () => {
    if (copiedCell && selectedCell) {
      const source = getCell(copiedCell.row, copiedCell.col)
      updateCell(selectedCell.row, selectedCell.col, { ...source })
    }
  }

  // Sort by column
  const sortByColumn = (col: number, ascending: boolean) => {
    const newRows = [...data.rows]
    newRows.sort((a, b) => {
      const av = typeof a[col] === 'string' ? a[col] : (a[col] as Cell).value
      const bv = typeof b[col] === 'string' ? b[col] : (b[col] as Cell).value
      const an = parseFloat(av)
      const bn = parseFloat(bv)
      if (!isNaN(an) && !isNaN(bn)) {
        return ascending ? an - bn : bn - an
      }
      return ascending ? av.localeCompare(bv) : bv.localeCompare(av)
    })
    updateData({ ...data, rows: newRows })
    toast.success(ascending ? '已升序排序' : '已降序排序')
  }

  // Filter by column (simple filter: highlight non-empty cells)
  const [filterCol, setFilterCol] = useState<number | null>(null)
  const [filterValue, setFilterValue] = useState('')

  // Formula evaluation
  const evalFormula = (formula: string): string => {
    if (!formula.startsWith('=')) return formula
    try {
      let expr = formula.substring(1).toUpperCase()
      // Replace SUM(range)
      expr = expr.replace(/SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/g, (_, c1, r1, c2, r2) => {
        const col1 = colToLetter(0) === c1 ? 0 : c1.charCodeAt(0) - 65
        const col2 = c2.charCodeAt(0) - 65
        const row1 = parseInt(r1) - 1
        const row2 = parseInt(r2) - 1
        let sum = 0
        for (let r = row1; r <= row2; r++) {
          for (let c = col1; c <= col2; c++) {
            const v = parseFloat(getCell(r, c).value)
            if (!isNaN(v)) sum += v
          }
        }
        return String(sum)
      })
      // AVERAGE(range)
      expr = expr.replace(/AVERAGE\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/g, (_, c1, r1, c2, r2) => {
        const col1 = c1.charCodeAt(0) - 65
        const col2 = c2.charCodeAt(0) - 65
        const row1 = parseInt(r1) - 1
        const row2 = parseInt(r2) - 1
        let sum = 0, count = 0
        for (let r = row1; r <= row2; r++) {
          for (let c = col1; c <= col2; c++) {
            const v = parseFloat(getCell(r, c).value)
            if (!isNaN(v)) { sum += v; count++ }
          }
        }
        return count > 0 ? String(sum / count) : '0'
      })
      // COUNT(range)
      expr = expr.replace(/COUNT\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/g, (_, c1, r1, c2, r2) => {
        const col1 = c1.charCodeAt(0) - 65
        const col2 = c2.charCodeAt(0) - 65
        const row1 = parseInt(r1) - 1
        const row2 = parseInt(r2) - 1
        let count = 0
        for (let r = row1; r <= row2; r++) {
          for (let c = col1; c <= col2; c++) {
            const v = parseFloat(getCell(r, c).value)
            if (!isNaN(v)) count++
          }
        }
        return String(count)
      })
      // MAX(range)
      expr = expr.replace(/MAX\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/g, (_, c1, r1, c2, r2) => {
        const col1 = c1.charCodeAt(0) - 65
        const col2 = c2.charCodeAt(0) - 65
        const row1 = parseInt(r1) - 1
        const row2 = parseInt(r2) - 1
        let max = -Infinity
        for (let r = row1; r <= row2; r++) {
          for (let c = col1; c <= col2; c++) {
            const v = parseFloat(getCell(r, c).value)
            if (!isNaN(v) && v > max) max = v
          }
        }
        return max === -Infinity ? '0' : String(max)
      })
      // MIN(range)
      expr = expr.replace(/MIN\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/g, (_, c1, r1, c2, r2) => {
        const col1 = c1.charCodeAt(0) - 65
        const col2 = c2.charCodeAt(0) - 65
        const row1 = parseInt(r1) - 1
        const row2 = parseInt(r2) - 1
        let min = Infinity
        for (let r = row1; r <= row2; r++) {
          for (let c = col1; c <= col2; c++) {
            const v = parseFloat(getCell(r, c).value)
            if (!isNaN(v) && v < min) min = v
          }
        }
        return min === Infinity ? '0' : String(min)
      })
      // Replace cell references like A1, B2, etc.
      expr = expr.replace(/([A-Z]+)(\d+)/g, (_, col, row) => {
        let colIdx = 0
        for (let i = 0; i < col.length; i++) {
          colIdx = colIdx * 26 + (col.charCodeAt(i) - 64)
        }
        colIdx--
        const rowIdx = parseInt(row) - 1
        const cell = getCell(rowIdx, colIdx)
        const val = parseFloat(cell.value)
        return isNaN(val) ? '0' : String(val)
      })
      // Evaluate basic arithmetic
      const result = Function(`"use strict"; return (${expr})`)()
      // Round to avoid floating point issues
      return String(Math.round(result * 1e10) / 1e10)
    } catch {
      return '#ERROR'
    }
  }

  const getDisplayValue = (row: number, col: number): string => {
    const cell = getCell(row, col)
    if (cell.value.startsWith('=')) {
      return evalFormula(cell.value)
    }
    return cell.value
  }

  const handleKeyDown = (e: React.KeyboardEvent, row: number, col: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        if (row > 0) {
          setSelectedCell({ row: row - 1, col })
          cellRefs.current[`${row - 1}-${col}`]?.focus()
        }
      } else {
        if (row < data.rows.length - 1) {
          setSelectedCell({ row: row + 1, col })
          cellRefs.current[`${row + 1}-${col}`]?.focus()
        } else {
          addRow()
          requestAnimationFrame(() => {
            cellRefs.current[`${row + 1}-${col}`]?.focus()
          })
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) {
        if (col > 0) {
          setSelectedCell({ row, col: col - 1 })
          cellRefs.current[`${row}-${col - 1}`]?.focus()
        }
      } else {
        if (col < data.columns.length - 1) {
          setSelectedCell({ row, col: col + 1 })
          cellRefs.current[`${row}-${col + 1}`]?.focus()
        } else if (row < data.rows.length - 1) {
          setSelectedCell({ row: row + 1, col: 0 })
          cellRefs.current[`${row + 1}-0`]?.focus()
        }
      }
    } else if (e.key === 'ArrowRight' && (e.currentTarget as HTMLInputElement).selectionStart === (e.currentTarget as HTMLInputElement).value.length) {
      e.preventDefault()
      if (col < data.columns.length - 1) {
        setSelectedCell({ row, col: col + 1 })
        cellRefs.current[`${row}-${col + 1}`]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && (e.currentTarget as HTMLInputElement).selectionStart === 0) {
      e.preventDefault()
      if (col > 0) {
        setSelectedCell({ row, col: col - 1 })
        cellRefs.current[`${row}-${col - 1}`]?.focus()
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (row < data.rows.length - 1) {
        setSelectedCell({ row: row + 1, col })
        cellRefs.current[`${row + 1}-${col}`]?.focus()
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (row > 0) {
        setSelectedCell({ row: row - 1, col })
        cellRefs.current[`${row - 1}-${col}`]?.focus()
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (e.currentTarget as HTMLInputElement && (e.currentTarget as HTMLInputElement).value === '') {
        e.preventDefault()
        if (selectedRange) {
          const minRow = Math.min(selectedRange.startRow, selectedRange.endRow)
          const maxRow = Math.max(selectedRange.startRow, selectedRange.endRow)
          const minCol = Math.min(selectedRange.startCol, selectedRange.endCol)
          const maxCol = Math.max(selectedRange.startCol, selectedRange.endCol)
          const newRows = [...data.rows]
          for (let r = minRow; r <= maxRow; r++) {
            newRows[r] = [...newRows[r]]
            for (let c = minCol; c <= maxCol; c++) {
              newRows[r][c] = { value: '' }
            }
          }
          updateData({ ...data, rows: newRows })
        } else if (selectedCell) {
          updateCellValue(selectedCell.row, selectedCell.col, '')
        }
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      copyCell()
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      pasteCell()
    }
  }

  const handleContextMenu = (e: React.MouseEvent, row: number, col: number) => {
    e.preventDefault()
    setSelectedCell({ row, col })
    setContextMenu({ x: e.clientX, y: e.clientY, row, col })
  }

  const handleCellMouseDown = (e: React.MouseEvent, row: number, col: number) => {
    if (e.shiftKey && selectedCell) {
      setSelectedRange({
        startRow: selectedCell.row,
        startCol: selectedCell.col,
        endRow: row,
        endCol: col,
      })
    } else {
      setSelectedCell({ row, col })
      setSelectedRange(null)
      setIsSelecting(true)
    }
  }

  const handleCellMouseEnter = (row: number, col: number) => {
    if (isSelecting && selectedCell) {
      setSelectedRange({
        startRow: selectedCell.row,
        startCol: selectedCell.col,
        endRow: row,
        endCol: col,
      })
    }
  }

  useEffect(() => {
    const handler = () => setIsSelecting(false)
    if (isSelecting) {
      document.addEventListener('mouseup', handler)
      return () => document.removeEventListener('mouseup', handler)
    }
  }, [isSelecting])

  const isCellInRange = (row: number, col: number): boolean => {
    if (!selectedRange) return false
    const minRow = Math.min(selectedRange.startRow, selectedRange.endRow)
    const maxRow = Math.max(selectedRange.startRow, selectedRange.endRow)
    const minCol = Math.min(selectedRange.startCol, selectedRange.endCol)
    const maxCol = Math.max(selectedRange.startCol, selectedRange.endCol)
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol
  }

  const exportCSV = () => {
    const csv = [
      data.columns.map((c) => `"${c}"`).join(','),
      ...data.rows.map((row) => row.map((cell) => {
        const v = typeof cell === 'string' ? cell : (cell as Cell).value
        const display = v.startsWith('=') ? evalFormula(v) : v
        return `"${display.replace(/"/g, '""')}"`
      }).join(',')),
    ].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'export.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV 已导出')
  }

  const colIndexToLetter = (col: number): string => colToLetter(col)

  // Get selected cell address (e.g., "A1")
  const selectedAddr = selectedCell ? `${colIndexToLetter(selectedCell.col)}${selectedCell.row + 1}` : ''

  // Calculate sum/avg of selected range
  const rangeStats = (() => {
    if (!selectedRange) return null
    const minRow = Math.min(selectedRange.startRow, selectedRange.endRow)
    const maxRow = Math.max(selectedRange.startRow, selectedRange.endRow)
    const minCol = Math.min(selectedRange.startCol, selectedRange.endCol)
    const maxCol = Math.max(selectedRange.startCol, selectedRange.endCol)
    let sum = 0, count = 0
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const v = parseFloat(getDisplayValue(r, c))
        if (!isNaN(v)) { sum += v; count++ }
      }
    }
    return { sum, count, avg: count > 0 ? sum / count : 0 }
  })()

  if (readOnly) {
    return (
      <div className="flex-1 overflow-auto bg-white">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="w-10 h-7 bg-gray-50 border border-gray-200 sticky top-0 z-10"></th>
              {data.columns.map((col, i) => (
                <th
                  key={i}
                  className="px-2 h-7 bg-gray-50 border border-gray-200 text-xs font-medium text-gray-600 text-center sticky top-0 z-10"
                  style={{ minWidth: (data.colWidths || [])[i] || 120 }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => (
              <tr key={ri}>
                <td className="w-10 h-7 bg-gray-50 border border-gray-200 text-xs text-gray-400 text-center">{ri + 1}</td>
                {row.map((cell, ci) => {
                  const display = getDisplayValue(ri, ci)
                  const c = cell as Cell
                  return (
                    <td
                      key={ci}
                      className="px-2 h-7 border border-gray-200 text-sm text-gray-700"
                      style={{
                        minWidth: (data.colWidths || [])[ci] || 120,
                        fontWeight: c.bold ? 'bold' : 'normal',
                        fontStyle: c.italic ? 'italic' : 'normal',
                        textDecoration: c.underline ? 'underline' : 'none',
                        color: c.color || undefined,
                        backgroundColor: c.bg && c.bg !== 'transparent' ? c.bg : undefined,
                        textAlign: c.align || 'left',
                        fontSize: c.fontSize ? `${c.fontSize}px` : '14px',
                      }}
                    >
                      {display}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3 py-1.5 text-xs text-gray-400 border-t border-gray-200 bg-gray-50">
          {data.rows.length} 行 × {data.columns.length} 列
        </div>
      </div>
    )
  }

  const ToolBtn = ({ icon: Icon, onClick, title, disabled, active }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "w-7 h-7 flex items-center justify-center rounded transition-colors",
        disabled
          ? "text-gray-300 cursor-not-allowed"
          : active
            ? "bg-emerald-100 text-emerald-700"
            : "text-gray-500 hover:bg-gray-200 hover:text-gray-700"
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white" ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-gray-200 bg-gray-50 flex-wrap gap-y-1">
        <ToolBtn icon={Plus} onClick={() => addRow()} title="添加行" />
        <ToolBtn icon={Grid3x3} onClick={addColumn} title="添加列" />
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <ToolBtn icon={Bold} onClick={() => applyStyleToRange({ bold: !getCell(selectedCell?.row || 0, selectedCell?.col || 0).bold })} title="加粗" disabled={!selectedCell && !selectedRange} />
        <ToolBtn icon={Italic} onClick={() => applyStyleToRange({ italic: !getCell(selectedCell?.row || 0, selectedCell?.col || 0).italic })} title="斜体" disabled={!selectedCell && !selectedRange} />
        <ToolBtn icon={Underline} onClick={() => applyStyleToRange({ underline: !getCell(selectedCell?.row || 0, selectedCell?.col || 0).underline })} title="下划线" disabled={!selectedCell && !selectedRange} />
        <div className="w-px h-5 bg-gray-300 mx-1" />
        {/* Text color */}
        <div className="relative">
          <ToolBtn icon={Type} onClick={() => setShowColorPicker(!showColorPicker)} title="文字颜色" disabled={!selectedCell && !selectedRange} />
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 grid grid-cols-5 gap-1">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  className="w-5 h-5 rounded border border-gray-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    applyStyleToRange({ color })
                    setShowColorPicker(false)
                  }}
                />
              ))}
            </div>
          )}
        </div>
        {/* Background color */}
        <div className="relative">
          <ToolBtn icon={Highlighter} onClick={() => setShowBgPicker(!showBgPicker)} title="背景颜色" disabled={!selectedCell && !selectedRange} />
          {showBgPicker && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 grid grid-cols-4 gap-1">
              {BG_COLORS.map((color) => (
                <button
                  key={color}
                  className="w-5 h-5 rounded border border-gray-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color === 'transparent' ? '#fff' : color, backgroundImage: color === 'transparent' ? 'linear-gradient(45deg, #ccc 25%, transparent 25%)' : undefined }}
                  onClick={() => {
                    applyStyleToRange({ bg: color })
                    setShowBgPicker(false)
                  }}
                />
              ))}
            </div>
          )}
        </div>
        {/* Font size */}
        <div className="relative">
          <ToolBtn icon={Type} onClick={() => setShowFontSize(!showFontSize)} title="字号" disabled={!selectedCell && !selectedRange} />
          {showFontSize && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
              {[12, 13, 14, 15, 16, 18, 20, 24, 28, 32].map((size) => (
                <button
                  key={size}
                  className="w-full px-4 py-1 text-left hover:bg-gray-100 text-sm"
                  style={{ fontSize: `${size}px` }}
                  onClick={() => {
                    applyStyleToRange({ fontSize: size })
                    setShowFontSize(false)
                  }}
                >
                  {size}px
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <ToolBtn icon={AlignLeft} onClick={() => applyStyleToRange({ align: 'left' })} title="左对齐" disabled={!selectedCell && !selectedRange} />
        <ToolBtn icon={AlignCenter} onClick={() => applyStyleToRange({ align: 'center' })} title="居中" disabled={!selectedCell && !selectedRange} />
        <ToolBtn icon={AlignRight} onClick={() => applyStyleToRange({ align: 'right' })} title="右对齐" disabled={!selectedCell && !selectedRange} />
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <ToolBtn icon={Copy} onClick={copyCell} title="复制 (Ctrl+C)" disabled={!selectedCell} />
        <ToolBtn icon={ClipboardPaste} onClick={pasteCell} title="粘贴 (Ctrl+V)" disabled={!selectedCell || !copiedCell} />
        <ToolBtn icon={Eraser} onClick={clearFormat} title="清除格式" disabled={!selectedCell && !selectedRange} />
        <div className="w-px h-5 bg-gray-300 mx-1" />
        {/* Sort buttons */}
        {selectedCell && (
          <>
            <ToolBtn icon={ArrowUpAZ} onClick={() => sortByColumn(selectedCell.col, true)} title="升序排序" />
            <ToolBtn icon={ArrowDownAZ} onClick={() => sortByColumn(selectedCell.col, false)} title="降序排序" />
          </>
        )}
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <button
          onClick={exportCSV}
          className="h-7 px-3 flex items-center gap-1 text-xs text-gray-600 hover:bg-gray-200 rounded transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> 导出 CSV
        </button>
      </div>

      {/* Formula bar */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-1">
          <span className="text-xs font-mono text-gray-500 min-w-[40px] text-center bg-gray-100 px-2 py-0.5 rounded">
            {selectedAddr || '-'}
          </span>
          <span className="text-xs text-gray-400 font-mono">fx</span>
        </div>
        <input
          type="text"
          value={selectedCell ? getCell(selectedCell.row, selectedCell.col).value : ''}
          onChange={(e) => {
            if (selectedCell) updateCellValue(selectedCell.row, selectedCell.col, e.target.value)
          }}
          placeholder="输入值或 =公式 (如 =SUM(A1:A5), =A1+B1, =AVERAGE(B1:B3))"
          className="flex-1 text-sm px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-emerald-400 font-mono"
          disabled={!selectedCell}
        />
      </div>

      {/* Spreadsheet grid */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th className="w-10 h-7 bg-gray-50 border border-gray-200 sticky top-0 left-0 z-20"></th>
              {data.columns.map((col, i) => (
                <th
                  key={i}
                  className="bg-gray-50 border border-gray-200 sticky top-0 z-10 relative group"
                  style={{ width: (data.colWidths || [])[i] || 120, minWidth: 60 }}
                >
                  {editingHeader === i ? (
                    <input
                      autoFocus
                      value={col}
                      onChange={(e) => updateColumn(i, e.target.value)}
                      onBlur={() => setEditingHeader(null)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setEditingHeader(null) }}
                      className="w-full h-full text-center text-xs font-medium text-gray-600 bg-white focus:outline-none px-1"
                    />
                  ) : (
                    <div
                      className="h-full flex items-center justify-center text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-100 px-2"
                      onClick={() => setEditingHeader(i)}
                    >
                      <span className="truncate">{col}</span>
                    </div>
                  )}
                  {/* Column letter label */}
                  <div className="text-[10px] text-gray-300 absolute top-0 right-1">
                    {colIndexToLetter(i)}
                  </div>
                  {/* Resize handle */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-emerald-400"
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      setResizing({
                        col: i,
                        startX: e.clientX,
                        startWidth: (data.colWidths || [])[i] || 120,
                      })
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => (
              <tr key={ri}>
                <td className="w-10 h-7 bg-gray-50 border border-gray-200 text-xs text-gray-400 text-center sticky left-0 z-10 select-none">
                  {ri + 1}
                </td>
                {row.map((cell, ci) => {
                  const c = cell as Cell
                  const isSelected = selectedCell?.row === ri && selectedCell?.col === ci
                  const inRange = isCellInRange(ri, ci)
                  const display = getDisplayValue(ri, ci)
                  return (
                    <td
                      key={ci}
                      className="border border-gray-200 p-0 relative"
                      style={{ width: (data.colWidths || [])[ci] || 120, minWidth: 60 }}
                      onContextMenu={(e) => handleContextMenu(e, ri, ci)}
                      onMouseDown={(e) => handleCellMouseDown(e, ri, ci)}
                      onMouseEnter={() => handleCellMouseEnter(ri, ci)}
                    >
                      <input
                        ref={(el) => { cellRefs.current[`${ri}-${ci}`] = el }}
                        type="text"
                        value={c.value}
                        onChange={(e) => updateCellValue(ri, ci, e.target.value)}
                        onFocus={() => setSelectedCell({ row: ri, col: ci })}
                        onKeyDown={(e) => handleKeyDown(e, ri, ci)}
                        className={cn(
                          "w-full h-7 px-2 text-sm border-none focus:outline-none",
                          isSelected ? "ring-2 ring-emerald-500 ring-inset z-10 relative bg-white" : "",
                          inRange && !isSelected ? "bg-emerald-50" : "",
                        )}
                        style={{
                          fontWeight: c.bold ? 'bold' : 'normal',
                          fontStyle: c.italic ? 'italic' : 'normal',
                          textDecoration: c.underline ? 'underline' : 'none',
                          color: c.color || '#374151',
                          backgroundColor: c.bg && c.bg !== 'transparent' ? c.bg : (inRange && !isSelected ? '#ecfdf5' : undefined),
                          textAlign: c.align || 'left',
                          fontSize: c.fontSize ? `${c.fontSize}px` : '14px',
                        }}
                      />
                      {/* Show computed value overlay for formula cells */}
                      {c.value.startsWith('=') && (
                        <div className="absolute inset-0 pointer-events-none flex items-center px-2 text-sm text-gray-500 bg-white" style={{ zIndex: isSelected ? -1 : 1 }}>
                          {display}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 px-3 py-1 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
        <span>{data.rows.length} 行 × {data.columns.length} 列</span>
        {selectedCell && (
          <span className="text-gray-400">
            当前: {selectedAddr}
          </span>
        )}
        {rangeStats && rangeStats.count > 0 && (
          <span className="text-gray-400">
            求和: {Math.round(rangeStats.sum * 100) / 100} | 平均: {Math.round(rangeStats.avg * 100) / 100} | 计数: {rangeStats.count}
          </span>
        )}
        {copiedCell && (
          <span className="text-emerald-600">已复制 {colIndexToLetter(copiedCell.col)}{copiedCell.row + 1}</span>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-gray-50 flex items-center gap-2 text-sm"
              onClick={() => { copyCell(); setContextMenu(null) }}
            >
              <Copy className="w-3.5 h-3.5" /> 复制
            </button>
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-gray-50 flex items-center gap-2 text-sm"
              onClick={() => { pasteCell(); setContextMenu(null) }}
            >
              <ClipboardPaste className="w-3.5 h-3.5" /> 粘贴
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-gray-50 flex items-center gap-2 text-sm"
              onClick={() => { insertRow(contextMenu.row + 1); setContextMenu(null) }}
            >
              <ArrowDown className="w-3 h-3" /> 在下方插入行
            </button>
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-gray-50 flex items-center gap-2 text-sm"
              onClick={() => { insertRow(contextMenu.row); setContextMenu(null) }}
            >
              <ArrowUp className="w-3 h-3" /> 在上方插入行
            </button>
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-gray-50 flex items-center gap-2 text-sm"
              onClick={() => { insertColumn(contextMenu.col + 1); setContextMenu(null) }}
            >
              <ArrowDown className="w-3 h-3 rotate-90" /> 在右侧插入列
            </button>
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-gray-50 flex items-center gap-2 text-sm"
              onClick={() => { insertColumn(contextMenu.col); setContextMenu(null) }}
            >
              <ArrowUp className="w-3 h-3 rotate-90" /> 在左侧插入列
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-gray-50 flex items-center gap-2 text-sm"
              onClick={() => { sortByColumn(contextMenu.col, true); setContextMenu(null) }}
            >
              <ArrowUpAZ className="w-3 h-3" /> 升序排序
            </button>
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-gray-50 flex items-center gap-2 text-sm"
              onClick={() => { sortByColumn(contextMenu.col, false); setContextMenu(null) }}
            >
              <ArrowDownAZ className="w-3 h-3" /> 降序排序
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-red-50 text-red-600 flex items-center gap-2 text-sm"
              onClick={() => { deleteRow(contextMenu.row); setContextMenu(null) }}
            >
              <Trash2 className="w-3 h-3" /> 删除此行
            </button>
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-red-50 text-red-600 flex items-center gap-2 text-sm"
              onClick={() => { deleteColumn(contextMenu.col); setContextMenu(null) }}
            >
              <Trash2 className="w-3 h-3" /> 删除此列
            </button>
          </div>
        </>
      )}
    </div>
  )
}
