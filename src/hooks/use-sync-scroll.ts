import { useCallback, useRef } from 'react'

export function useSyncScroll(enabled: boolean) {
  const syncingRef = useRef(false)

  const syncFromEditor = useCallback(
    (editorEl: HTMLElement | null, previewEl: HTMLElement | null) => {
      if (!enabled || !editorEl || !previewEl || syncingRef.current) return
      syncingRef.current = true
      const editorMax = editorEl.scrollHeight - editorEl.clientHeight
      const previewMax = previewEl.scrollHeight - previewEl.clientHeight
      if (editorMax <= 0 || previewMax <= 0) {
        syncingRef.current = false
        return
      }
      const ratio = editorEl.scrollTop / editorMax
      previewEl.scrollTop = ratio * previewMax
      requestAnimationFrame(() => {
        syncingRef.current = false
      })
    },
    [enabled],
  )

  const syncFromPreview = useCallback(
    (editorEl: HTMLElement | null, previewEl: HTMLElement | null) => {
      if (!enabled || !editorEl || !previewEl || syncingRef.current) return
      syncingRef.current = true
      const editorMax = editorEl.scrollHeight - editorEl.clientHeight
      const previewMax = previewEl.scrollHeight - previewEl.clientHeight
      if (editorMax <= 0 || previewMax <= 0) {
        syncingRef.current = false
        return
      }
      const ratio = previewEl.scrollTop / previewMax
      editorEl.scrollTop = ratio * editorMax
      requestAnimationFrame(() => {
        syncingRef.current = false
      })
    },
    [enabled],
  )

  return { syncFromEditor, syncFromPreview }
}
