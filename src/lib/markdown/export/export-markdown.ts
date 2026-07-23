import { downloadBlob } from './download-blob'

export function exportMarkdown(content: string, title: string) {
  const md = `# ${title}\n\n${content || ''}`
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  downloadBlob(blob, `${title || '未命名文档'}.md`)
}

export function exportPlainText(content: string, title: string) {
  const text = `${title}\n\n${content || ''}`
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  downloadBlob(blob, `${title || '未命名文档'}.txt`)
}
