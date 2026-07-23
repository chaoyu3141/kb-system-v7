import { marked } from 'marked'
import { downloadBlob, escapeHtml } from './download-blob'

marked.setOptions({ breaks: true, gfm: true })

function markdownToHtml(md: string): string {
  return marked.parse(md || '') as string
}

const wordStyles = `
body { font-family: "Microsoft YaHei", "SimSun", "PingFang SC", sans-serif; font-size: 12pt; line-height: 1.6; color: #000; }
h1 { font-size: 20pt; font-weight: bold; margin: 18pt 0 10pt; }
h2 { font-size: 16pt; font-weight: bold; margin: 14pt 0 8pt; }
h3 { font-size: 14pt; font-weight: bold; margin: 12pt 0 6pt; }
pre, code { font-family: Consolas, "Courier New", monospace; }
pre { background: #111827; color: #e5e7eb; padding: 8pt; border-radius: 4px; overflow-x: auto; }
code { background: #f3f4f6; padding: 1pt 3pt; border-radius: 2px; }
blockquote { border-left: 3px solid #ccc; margin: 6pt 0; padding: 4pt 10pt; color: #555; }
table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
th, td { border: 1px solid #ccc; padding: 5pt 8pt; }
th { background: #f5f5f5; font-weight: bold; }
`

const htmlStyles = `
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 16px; line-height: 1.7; max-width: 820px; margin: 40px auto; padding: 0 20px; color: #212529; background: #fff; }
h1, h2, h3 { margin: 24px 0 12px; font-weight: 600; }
h1 { font-size: 2em; border-bottom: 1px solid #dee2e6; padding-bottom: 8px; }
h2 { font-size: 1.5em; border-bottom: 1px solid #dee2e6; padding-bottom: 6px; }
p { margin: 0 0 14px; }
a { color: #059669; text-decoration: none; }
a:hover { text-decoration: underline; }
ul, ol { margin: 0 0 14px; padding-left: 2em; }
pre { background: #111827; color: #e5e7eb; padding: 16px; border-radius: 12px; overflow-x: auto; }
code { background: #f3f4f6; color: #111827; padding: 2px 6px; border-radius: 4px; font-family: Consolas, monospace; }
pre code { background: none; color: inherit; padding: 0; }
blockquote { border-left: 4px solid #10b981; padding-left: 16px; color: #6b7280; margin: 16px 0; }
table { border-collapse: collapse; width: 100%; margin: 16px 0; }
th, td { border: 1px solid #d1d5db; padding: 8px 12px; }
th { background: #f9fafb; }
img { max-width: 100%; height: auto; border-radius: 8px; }
`

export function exportHtmlDocument(content: string, title: string) {
  const bodyHtml = markdownToHtml(content)
  const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <style>${htmlStyles}</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${bodyHtml}
</body>
</html>`
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' })
  downloadBlob(blob, `${title || '未命名文档'}.html`)
}

export function exportWordDocument(content: string, title: string) {
  const bodyHtml = markdownToHtml(content)
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>${wordStyles}</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${bodyHtml}
</body>
</html>`
  const blob = new Blob([fullHtml], { type: 'application/msword;charset=utf-8' })
  downloadBlob(blob, `${title || '未命名文档'}.doc`)
}

export function exportPdfViaPrint(previewElementId: string) {
  const el = document.getElementById(previewElementId)
  if (!el) return false
  document.body.classList.add('markdown-print-mode')
  window.print()
  document.body.classList.remove('markdown-print-mode')
  return true
}

export async function exportPngFromElement(element: HTMLElement, filename: string) {
  const domtoimage = await import('dom-to-image-more')
  const dataUrl = await domtoimage.toPng(element, {
    bgcolor: '#ffffff',
    quality: 1,
    style: { margin: '0', padding: '24px' },
  })
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  downloadBlob(blob, `${filename || '未命名文档'}.png`)
}
