'use client'

import { useEffect, useState } from 'react'
import { useKBStore } from '@/store/kb-store'
import { AuthScreen } from '@/components/knowledge-base/auth-screen'
import { Header } from '@/components/knowledge-base/header'
import { Sidebar } from '@/components/knowledge-base/sidebar'
import { DocEditor } from '@/components/knowledge-base/doc-editor'
import { Loader2 } from 'lucide-react'

export default function Home() {
  const { user, setUser, fetchKbs, setLoading } = useKBStore()
  const [checking, setChecking] = useState(true)

  // Check session on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((u) => {
        if (u && u.id) {
          setUser(u)
          fetchKbs()
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!user) {
    return <AuthScreen />
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <DocEditor />
      </div>
    </div>
  )
}
