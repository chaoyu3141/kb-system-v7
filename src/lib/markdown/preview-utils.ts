import type { Element, Text } from 'hast'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export const INLINE_CODE_CLASS =
  'rounded border border-[#e5e7eb] bg-[#f3f4f6] px-1.5 py-0.5 font-mono text-[0.8125rem] text-[#111827]'

export const MARKDOWN_PREVIEW_CLASS =
  'prose prose-sm max-w-none w-full text-left ' +
  '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 ' +
  '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 ' +
  '[&_h3]:text-lg [&_h3]:font-medium [&_h3]:mt-4 [&_h3]:mb-2 ' +
  '[&_p]:my-3 [&_p]:leading-relaxed ' +
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3 ' +
  '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3 ' +
  '[&_li]:my-1 ' +
  '[&_blockquote]:border-l-4 [&_blockquote]:border-emerald-300 [&_blockquote]:pl-4 [&_blockquote]:text-gray-600 [&_blockquote]:italic [&_blockquote]:my-3 ' +
  '[&_a]:text-emerald-600 [&_a]:underline [&_a]:cursor-pointer ' +
  '[&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-3 ' +
  '[&_hr]:border-gray-200 [&_hr]:my-6 ' +
  '[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse ' +
  '[&_th]:bg-gray-50 [&_th]:font-semibold [&_th]:border [&_th]:border-gray-300 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left ' +
  '[&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-2 ' +
  '[&_tr:nth-child(even)]:bg-gray-50 ' +
  '[&_input[type=checkbox]]:mr-2 [&_input[type=checkbox]]:accent-emerald-600 ' +
  '[&_strong]:font-bold [&_em]:italic [&_del]:line-through'

export function normalizeClassName(className?: string | string[]): string {
  if (!className) return ''
  return Array.isArray(className) ? className.join(' ') : className
}

export function hastElementText(node: Element): string {
  return node.children
    .map((child) => {
      if (child.type === 'text') return (child as Text).value
      if (child.type === 'element') return hastElementText(child as Element)
      return ''
    })
    .join('')
}

export function languageFromClassName(className?: string | string[]): string | undefined {
  const match = /language-(\w+)/.exec(normalizeClassName(className))
  return match?.[1]
}

export type MarkdownCodeProps = ComponentPropsWithoutRef<'code'> & {
  inline?: boolean
  node?: Element
}

export function resolveIsInlineCode({ inline, className, children, node }: MarkdownCodeProps): boolean {
  if (inline === true) return true
  if (inline === false) return false

  const classStr = normalizeClassName(className)
  if (/language-\w+/.test(classStr)) return false

  const textFromNode = node?.type === 'element' ? hastElementText(node) : ''
  const textFromChildren = String(children ?? '')
  const rawText = textFromNode || textFromChildren

  if (rawText.includes('\n')) return false

  return true
}

export function getCodeText(node: Element | undefined, children: ReactNode): string {
  const textFromNode = node?.type === 'element' ? hastElementText(node) : ''
  const textFromChildren = String(children ?? '')
  return (textFromNode || textFromChildren).replace(/\n$/, '')
}
