import { useCallback, useEffect, useRef } from 'react'

const MAX_HISTORY = 100

export function useEditorHistory(content: string, onChange: (value: string) => void) {
  const stackRef = useRef<string[]>([content])
  const indexRef = useRef(0)
  const lastRecordedRef = useRef(content)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipRecordRef = useRef(false)

  useEffect(() => {
    if (skipRecordRef.current) {
      skipRecordRef.current = false
      lastRecordedRef.current = content
      return
    }
    if (content === lastRecordedRef.current) return

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (content === lastRecordedRef.current) return
      const stack = stackRef.current.slice(0, indexRef.current + 1)
      stack.push(content)
      if (stack.length > MAX_HISTORY) stack.shift()
      stackRef.current = stack
      indexRef.current = stack.length - 1
      lastRecordedRef.current = content
    }, 400)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [content])

  const undo = useCallback(() => {
    if (indexRef.current <= 0) return false
    indexRef.current -= 1
    const value = stackRef.current[indexRef.current]
    skipRecordRef.current = true
    lastRecordedRef.current = value
    onChange(value)
    return true
  }, [onChange])

  const redo = useCallback(() => {
    if (indexRef.current >= stackRef.current.length - 1) return false
    indexRef.current += 1
    const value = stackRef.current[indexRef.current]
    skipRecordRef.current = true
    lastRecordedRef.current = value
    onChange(value)
    return true
  }, [onChange])

  const resetHistory = useCallback((value: string) => {
    stackRef.current = [value]
    indexRef.current = 0
    lastRecordedRef.current = value
  }, [])

  return { undo, redo, resetHistory, canUndo: indexRef.current > 0, canRedo: indexRef.current < stackRef.current.length - 1 }
}
