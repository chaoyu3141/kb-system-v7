function convertTable(table: Element): string {
  const rows = Array.from(table.querySelectorAll('tr'))
  if (!rows.length) return ''
  let md = '\n'
  rows.forEach((tr, i) => {
    const cells = Array.from(tr.querySelectorAll('td, th')).map((td) =>
      htmlToMarkdown(td).trim().replace(/\|/g, '\\|'),
    )
    if (cells.length) {
      md += '| ' + cells.join(' | ') + ' |\n'
      if (i === 0) {
        md += '|' + cells.map(() => '---').join('|') + '|\n'
      }
    }
  })
  return md + '\n'
}

export function htmlToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent || '').replace(/\s+/g, ' ')
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ''

  const el = node as Element
  const tag = el.tagName.toLowerCase()
  const children = Array.from(el.childNodes).map(htmlToMarkdown).join('')

  switch (tag) {
    case 'h1':
      return '# ' + children.trim() + '\n\n'
    case 'h2':
      return '## ' + children.trim() + '\n\n'
    case 'h3':
      return '### ' + children.trim() + '\n\n'
    case 'h4':
      return '#### ' + children.trim() + '\n\n'
    case 'h5':
      return '##### ' + children.trim() + '\n\n'
    case 'h6':
      return '###### ' + children.trim() + '\n\n'
    case 'p':
      return children.trim() + '\n\n'
    case 'br':
      return '\n'
    case 'a':
      return '[' + children + '](' + (el.getAttribute('href') || '') + ')'
    case 'strong':
    case 'b':
      return '**' + children + '**'
    case 'em':
    case 'i':
      return '*' + children + '*'
    case 'code':
      return '`' + children + '`'
    case 'pre': {
      const code = el.querySelector('code')
      if (code) {
        const cls = code.className || ''
        const m = cls.match(/language-(\w+)/)
        const lang = m ? m[1] : ''
        return '\n```' + lang + '\n' + code.textContent?.trim() + '\n```\n\n'
      }
      return '\n```\n' + children.trim() + '\n```\n\n'
    }
    case 'ul':
      return (
        Array.from(el.children)
          .map((li) => '- ' + htmlToMarkdown(li).trim())
          .join('\n') + '\n\n'
      )
    case 'ol':
      return (
        Array.from(el.children)
          .map((li, idx) => idx + 1 + '. ' + htmlToMarkdown(li).trim())
          .join('\n') + '\n\n'
      )
    case 'li':
      return children.trim()
    case 'blockquote':
      return '> ' + children.trim().replace(/\n/g, '\n> ') + '\n\n'
    case 'hr':
      return '---\n\n'
    case 'table':
      return convertTable(el)
    case 'div':
    case 'figure':
    case 'section':
      return children.trim() + '\n\n'
    default:
      return children
  }
}

export function extractMeta(doc: Document) {
  const title =
    doc.querySelector('title')?.textContent?.trim() ||
    doc.querySelector('h1')?.textContent?.trim() ||
    ''
  const author =
    doc.querySelector('meta[name="author"]')?.getAttribute('content')?.trim() ||
    doc.querySelector('meta[property="article:author"]')?.getAttribute('content')?.trim() ||
    ''
  const published =
    doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content')?.trim() ||
    doc.querySelector('time')?.getAttribute('datetime')?.trim() ||
    doc.querySelector('time')?.textContent?.trim() ||
    ''
  return { title, author, published }
}

export function extractMainContent(doc: Document): Element {
  const wechatContent = doc.querySelector('#js_content')
  if (wechatContent) return wechatContent

  const selectors = [
    'article',
    '[role="main"]',
    '.post-content',
    '.entry-content',
    '.article-content',
    '.rich_media_content',
    '.content',
    '#content',
    'main',
  ]
  for (const sel of selectors) {
    const el = doc.querySelector(sel)
    if (el) return el
  }
  return doc.body
}

export function stripUnwantedElements(root: Element): Element {
  const selectors =
    'script, style, nav, aside, header, footer, form, iframe, svg, video, audio, canvas, .ad, .ads, .advertisement, .sidebar, .comments, .comment, #comments, [class*="ad-"], [class*="ads-"], [id*="ad-"], [class*="comment"], [id*="comment"]'
  root.querySelectorAll(selectors).forEach((el) => el.remove())
  return root
}

export function convertHtmlToMarkdownDocument(html: string): { title: string; markdown: string } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const meta = extractMeta(doc)
  const main = stripUnwantedElements(extractMainContent(doc).cloneNode(true) as Element)
  let md = htmlToMarkdown(main).trim()

  if (meta.title) {
    md = '# ' + meta.title + '\n\n' + md
  }
  if (meta.author || meta.published) {
    const metaLine = [meta.author && `作者：${meta.author}`, meta.published && `日期：${meta.published}`]
      .filter(Boolean)
      .join(' | ')
    if (metaLine) md = md.replace(/^# .+\n\n/, (m) => m + metaLine + '\n\n')
  }

  return { title: meta.title || '网页导入', markdown: md }
}
