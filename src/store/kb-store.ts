import { create } from 'zustand'

interface User {
  id: string
  email: string
  name: string
  avatar: string | null
}

interface KnowledgeBase {
  id: string
  name: string
  description: string | null
  icon: string | null
  ownerId: string
  owner: { id: string; name: string; email: string }
  permissions: Array<{
    id: string
    userId: string
    role: string
    user: { id: string; name: string; email: string }
  }>
  _count?: { documents: number }
}

interface DocMeta {
  id: string
  title: string
  parentId: string | null
  order: number
  docType: string // "doc" | "markdown" | "sheet"
  icon: string | null
  createdAt: string
  updatedAt: string
  authorId: string
}

interface DocDetail extends DocMeta {
  content: string | null
  knowledgeBaseId: string
  author: { id: string; name: string }
  children: DocMeta[]
}

interface KBState {
  user: User | null
  kbs: KnowledgeBase[]
  currentKb: KnowledgeBase | null
  documents: DocMeta[]
  currentDoc: DocDetail | null
  loading: boolean
  docListRevision: number

  // Actions
  setUser: (user: User | null) => void
  setKbs: (kbs: KnowledgeBase[]) => void
  setCurrentKb: (kb: KnowledgeBase | null) => void
  setDocuments: (docs: DocMeta[]) => void
  setCurrentDoc: (doc: DocDetail | null) => void
  setLoading: (loading: boolean) => void

  fetchKbs: () => Promise<void>
  selectKb: (kbId: string) => Promise<void>
  fetchDocuments: (kbId: string, parentId?: string | null, all?: boolean) => Promise<DocMeta[]>
  selectDoc: (docId: string) => Promise<void>
  refreshCurrentDoc: () => Promise<void>
  notifyDocListChanged: () => void
}

export const useKBStore = create<KBState>((set, get) => ({
  user: null,
  kbs: [],
  currentKb: null,
  documents: [],
  currentDoc: null,
  loading: false,
  docListRevision: 0,

  setUser: (user) => set({ user }),
  setKbs: (kbs) => set({ kbs }),
  setCurrentKb: (kb) => set({ currentKb: kb }),
  setDocuments: (docs) => set({ documents: docs }),
  setCurrentDoc: (doc) => set({ currentDoc: doc }),
  setLoading: (loading) => set({ loading }),

  fetchKbs: async () => {
    const res = await fetch('/api/knowledge-bases')
    if (res.ok) {
      const kbs = await res.json()
      set({ kbs })
    }
  },

  selectKb: async (kbId) => {
    const res = await fetch(`/api/knowledge-bases/${kbId}`)
    if (res.ok) {
      const kb = await res.json()
      set({ currentKb: kb, currentDoc: null, documents: kb.documents || [] })
    }
  },

  fetchDocuments: async (kbId, parentId = null, all = false) => {
    const url = all
      ? `/api/documents?kbId=${kbId}&all=true`
      : `/api/documents?kbId=${kbId}&parentId=${parentId || 'null'}`
    const res = await fetch(url)
    if (res.ok) {
      const docs = await res.json()
      return docs
    }
    return []
  },

  notifyDocListChanged: () => {
    set((s) => ({ docListRevision: s.docListRevision + 1 }))
  },

  selectDoc: async (docId) => {
    const res = await fetch(`/api/documents/${docId}`)
    if (res.ok) {
      const doc = await res.json()
      set({ currentDoc: doc })
    }
  },

  refreshCurrentDoc: async () => {
    const { currentDoc } = get()
    if (currentDoc) {
      await get().selectDoc(currentDoc.id)
    }
  },
}))
