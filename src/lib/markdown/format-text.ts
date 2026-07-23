export type TextareaEditorApi = {
  getValue: () => string
  setValue: (value: string) => void
  getSelection: () => { start: number; end: number }
  setSelection: (start: number, end: number) => void
  focus: () => void
}

export function insertText(
  api: TextareaEditorApi,
  before: string,
  after: string = '',
  placeholder: string = '',
) {
  const { start, end } = api.getSelection()
  const content = api.getValue()
  const selectedText = content.substring(start, end) || placeholder
  const newText = content.substring(0, start) + before + selectedText + after + content.substring(end)
  api.setValue(newText)
  requestAnimationFrame(() => {
    api.focus()
    if (selectedText) {
      api.setSelection(start + before.length, start + before.length + selectedText.length)
    } else {
      const cursorPos = start + before.length + after.length
      api.setSelection(cursorPos, cursorPos)
    }
  })
}

export function insertLineStart(api: TextareaEditorApi, prefix: string) {
  const { start } = api.getSelection()
  const content = api.getValue()
  const lineStart = content.lastIndexOf('\n', start - 1) + 1
  const lineEnd = content.indexOf('\n', start)
  const currentLine = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd)
  const newText =
    content.substring(0, lineStart) + prefix + currentLine + content.substring(lineEnd === -1 ? content.length : lineEnd)
  api.setValue(newText)
  requestAnimationFrame(() => {
    api.focus()
    api.setSelection(lineStart + prefix.length, lineStart + prefix.length + currentLine.length)
  })
}

export function insertBlock(api: TextareaEditorApi, block: string) {
  const { start } = api.getSelection()
  const content = api.getValue()
  const prefix = start > 0 && content[start - 1] !== '\n' ? '\n' : ''
  const newText = content.substring(0, start) + prefix + block + content.substring(start)
  api.setValue(newText)
  requestAnimationFrame(() => {
    api.focus()
    const pos = start + prefix.length + block.length
    api.setSelection(pos, pos)
  })
}

export function wrapSelection(api: TextareaEditorApi, before: string, after: string) {
  const { start, end } = api.getSelection()
  const content = api.getValue()
  const selected = content.slice(start, end)
  const newText = content.slice(0, start) + before + selected + after + content.slice(end)
  api.setValue(newText)
  requestAnimationFrame(() => {
    api.focus()
    api.setSelection(start + before.length, start + before.length + selected.length)
  })
}
