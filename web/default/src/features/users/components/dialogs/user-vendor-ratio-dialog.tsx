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
import { useState, useEffect, useCallback } from 'react'
import { Percent, Plus, Trash2, Loader2 } from 'lucide-react'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getUserModelRatio,
  updateUserModelRatio,
  type ModelRatioOption,
} from '../../api'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number | null
  username?: string
}

interface RatioRow {
  modelName: string
  ratio: string
}

export function UserVendorRatioDialog(props: Props) {
  const { t } = useTranslation()
  const [models, setModels] = useState<ModelRatioOption[]>([])
  const [rows, setRows] = useState<RatioRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    if (!props.userId) return
    setLoading(true)
    try {
      const res = await getUserModelRatio(props.userId)
      if (res.success && res.data) {
        setModels(res.data.models || [])
        const existing = Object.entries(res.data.ratios || {}).map(
          ([modelName, ratio]) => ({ modelName, ratio: String(ratio) })
        )
        setRows(existing)
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
      setRows([])
      setModels([])
    }
  }, [props.open, props.userId, fetchData])

  const usedModelNames = new Set(rows.map((r) => r.modelName).filter(Boolean))

  const addRow = () => {
    setRows((prev) => [...prev, { modelName: '', ratio: '' }])
  }

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  const updateRow = (index: number, patch: Partial<RatioRow>) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    )
  }

  const handleSave = async () => {
    if (!props.userId) return
    const ratios: Record<string, number> = {}
    for (const row of rows) {
      if (!row.modelName || row.ratio.trim() === '') continue
      const value = Number(row.ratio)
      if (Number.isNaN(value) || value < 0) {
        toast.error(t('Ratio must be a number not less than 0'))
        return
      }
      if (ratios[row.modelName] !== undefined) {
        toast.error(t('Duplicate model rule'))
        return
      }
      ratios[row.modelName] = value
    }
    setSaving(true)
    try {
      const res = await updateUserModelRatio(props.userId, ratios)
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
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Percent className='h-5 w-5' />
            {t('Discount Ratio')}
          </DialogTitle>
          <DialogDescription>
            {t('Set a per-model discount ratio override for this user')}
            {props.username ? ` — ${props.username}` : ''}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className='flex items-center justify-center py-8'>
            <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
          </div>
        ) : (
          <div className='space-y-3'>
            <ScrollArea className='max-h-[50vh]'>
              {rows.length === 0 ? (
                <p className='text-muted-foreground py-6 text-center text-sm'>
                  {t('No discount configured')}
                </p>
              ) : (
                <div className='space-y-2 pr-3'>
                  {rows.map((row, index) => (
                    <div key={index} className='flex items-center gap-2'>
                      <Select
                        items={models.map((m) => ({
                          value: m.model_name,
                          label: m.model_name,
                        }))}
                        value={row.modelName}
                        onValueChange={(v) =>
                          v !== null && updateRow(index, { modelName: String(v) })
                        }
                      >
                        <SelectTrigger className='flex-1'>
                          <SelectValue placeholder={t('Model')} />
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectGroup>
                            {models.map((m) => (
                              <SelectItem
                                key={m.model_name}
                                value={m.model_name}
                                disabled={
                                  usedModelNames.has(m.model_name) &&
                                  row.modelName !== m.model_name
                                }
                              >
                                {m.model_name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <Input
                        type='number'
                        min={0}
                        step='0.01'
                        className='w-28'
                        placeholder={t('Ratio')}
                        value={row.ratio}
                        onChange={(e) =>
                          updateRow(index, { ratio: e.target.value })
                        }
                      />
                      <Button
                        variant='ghost'
                        size='sm'
                        className='text-destructive hover:text-destructive h-8 w-8 shrink-0 p-0'
                        onClick={() => removeRow(index)}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <Button
              variant='outline'
              size='sm'
              onClick={addRow}
              disabled={rows.length >= models.length}
            >
              <Plus className='mr-1 h-4 w-4' />
              {t('Add model rule')}
            </Button>
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
