'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { BookOpen, LogOut, KeyRound } from 'lucide-react'
import { useKBStore } from '@/store/kb-store'
import { toast } from 'sonner'
import { ChangePasswordDialog } from './change-password-dialog'

export function Header() {
  const { user, setUser, setCurrentDoc, setCurrentKb, setKbs } = useKBStore()
  const [showChangePassword, setShowChangePassword] = useState(false)

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'DELETE' })
    setUser(null)
    setCurrentDoc(null)
    setCurrentKb(null)
    setKbs([])
    toast.success('已退出登录')
  }

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 flex-shrink-0 z-10">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-gray-900">知南观心</span>
      </div>

      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <Avatar className="w-7 h-7">
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">
                  {user?.name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-gray-700">{user?.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{user?.name}</span>
                <span className="text-xs text-gray-400 font-normal">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowChangePassword(true)}>
              <KeyRound className="w-4 h-4 mr-2" /> 修改密码
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="w-4 h-4 mr-2" /> 退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ChangePasswordDialog open={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </header>
  )
}
