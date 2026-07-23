'use client'

import { useEffect, useState } from 'react'
import { Loader2, Link2Off } from 'lucide-react'
import { PublicDocumentView, type PublicDocument } from '@/components/knowledge-base/public-document-view'

export default function PublicSharePage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string | null>(null)
  const [doc, setDoc] = useState<PublicDocument | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    params.then((p) => setToken(p.token))
  }, [params])

  useEffect(() => {
    if (!token) return
    setLoading(true)
    fetch(`/api/public/documents/${token}`)
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) {
          setError(data.error || '该分享链接已失效')
          setDoc(null)
          return
        }
        setDoc(data)
        setError(null)
      })
      .catch(() => setError('该分享链接已失效'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Link2Off className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-lg font-medium text-gray-700 mb-2">{error || '该分享链接已失效'}</h1>
          <p className="text-sm text-gray-400">链接可能已关闭、过期或不存在</p>
        </div>
      </div>
    )
  }

  return <PublicDocumentView doc={doc} />
}
