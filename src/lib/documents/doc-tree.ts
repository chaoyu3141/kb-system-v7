export type DocTreeItem = {
  id: string
  title: string
  parentId: string | null
  order: number
  docType: string
  icon: string | null
  depth: number
}

export function flattenDocTree(
  docs: Array<{ id: string; title: string; parentId: string | null; order: number; docType: string; icon: string | null }>,
  parentId: string | null = null,
  depth = 0,
): DocTreeItem[] {
  return docs
    .filter((d) => d.parentId === parentId)
    .sort((a, b) => a.order - b.order)
    .flatMap((doc) => [
      { ...doc, depth },
      ...flattenDocTree(docs, doc.id, depth + 1),
    ])
}
