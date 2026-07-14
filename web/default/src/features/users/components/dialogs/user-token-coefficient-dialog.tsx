/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useCallback, useEffect, useState } from 'react'
import { Hash, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getUserTokenCoefficient,
  updateUserTokenCoefficient,
} from '../../api'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number | null
  username?: string
}

export function UserTokenCoefficientDialog(props: Props) {
  const { t } = useTranslation()
  const [coefficient, setCoefficient] = useState('1')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    if (!props.userId) return
    setLoading(true)
    try {
      const res = await getUserTokenCoefficient(props.userId)
      if (res.success && res.data) {
        setCoefficient(String(res.data.token_coefficient || 1))
      } else {
        toast.error(res.message || t('Failed to load'))
      }
    } catch {
      toast.error(t('Failed to load'))
    } finally {
      setLoading(false)
    }
  }, [props.userId, t])

  useEffect(() => {
    if (props.open && props.userId) {
      fetchData()
    } else {
      setCoefficient('1')
    }
  }, [props.open, props.userId, fetchData])

  const handleSave = async () => {
    if (!props.userId) return

    const value = Number(coefficient)
    if (!Number.isFinite(value) || value <= 0 || value > 100) {
      toast.error(t('Token coefficient must be greater than 0 and no more than 100'))
      return
    }

    setSaving(true)
    try {
      const res = await updateUserTokenCoefficient(props.userId, value)
      if (res.success) {
        toast.success(t('Saved successfully'))
        props.onOpenChange(false)
      } else {
        toast.error(res.message || t('Failed to save'))
      }
    } catch {
      toast.error(t('Failed to save'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Hash className='h-5 w-5' />
            {t('Token Coefficient')}
          </DialogTitle>
          <DialogDescription>
            {t('Configure the token billing coefficient for this user')}
            {props.username ? ` · ${props.username}` : ''}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className='flex items-center justify-center py-8'>
            <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
          </div>
        ) : (
          <div className='space-y-3'>
            <div className='space-y-2'>
              <Label htmlFor='token-coefficient'>{t('Token coefficient')}</Label>
              <Input
                id='token-coefficient'
                type='number'
                min='0.01'
                max='100'
                step='0.01'
                value={coefficient}
                onChange={(event) => setCoefficient(event.target.value)}
              />
            </div>
            <p className='text-muted-foreground text-sm'>
              {t(
                'Input, output, cache read, and cache write tokens will be multiplied by this coefficient before logging and billing. Default is 1.'
              )}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={saving}
          >
            {t('Cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className='mr-1 h-4 w-4 animate-spin' />}
            {t('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
