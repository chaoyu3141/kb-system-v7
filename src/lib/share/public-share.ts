import { randomUUID } from 'crypto'

export type ShareExpireOption = '1week' | '1month' | '3months' | 'forever'

export const SHARE_EXPIRE_OPTIONS: Array<{ value: ShareExpireOption; label: string }> = [
  { value: '1week', label: '1周' },
  { value: '1month', label: '1个月' },
  { value: '3months', label: '3个月' },
  { value: 'forever', label: '永久' },
]

export function computeShareExpireAt(option: ShareExpireOption): Date | null {
  const now = new Date()
  switch (option) {
    case '1week':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    case '1month':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    case '3months':
      return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
    case 'forever':
      return null
  }
}

export function inferExpireOption(expireAt: Date | null | undefined): ShareExpireOption {
  if (!expireAt) return 'forever'
  const diffMs = expireAt.getTime() - Date.now()
  const diffDays = diffMs / (24 * 60 * 60 * 1000)
  if (diffDays <= 8) return '1week'
  if (diffDays <= 35) return '1month'
  if (diffDays <= 95) return '3months'
  return 'forever'
}

export function isShareValid(
  shareEnabled: boolean,
  shareToken: string | null | undefined,
  shareExpireAt: Date | null | undefined,
): boolean {
  if (!shareEnabled || !shareToken) return false
  if (shareExpireAt && shareExpireAt.getTime() <= Date.now()) return false
  return true
}

export function generateShareToken(): string {
  return randomUUID().replace(/-/g, '')
}
