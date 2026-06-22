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
import { useCallback, useMemo, useState } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { Trash2, MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  loadConversations,
  deleteConversation,
} from '@/features/playground/lib'
import type { NavPlaygroundHistory } from '../types'

/**
 * Playground conversation history navigation item.
 * Uses a Popover to show conversation list near the trigger button,
 * following Google AI Studio's UX pattern.
 */
export function PlaygroundHistoryItem({ item }: { item: NavPlaygroundHistory }) {
  const { t } = useTranslation()
  const { isMobile, setOpenMobile } = useSidebar()
  const navigate = useNavigate()
  const location = useLocation()

  const activeConvId = useMemo(() => {
    const params = new URLSearchParams(location.searchStr || '')
    return params.get('c') || undefined
  }, [location.searchStr])

  const [open, setOpen] = useState(false)
  // Force re-render after deletes that don't trigger navigation
  const [renderKey, setRenderKey] = useState(0)
  const conversations = loadConversations()

  const handleSwitch = useCallback((id: string) => {
    setOpen(false)
    setOpenMobile(false)
    navigate({ to: '/playground', search: { c: id } })
  }, [navigate, setOpenMobile])

  const handleDelete = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    e.preventDefault()
    deleteConversation(id)

    if (activeConvId === id) {
      const remaining = loadConversations()
      if (remaining.length > 0) {
        navigate({ to: '/playground', search: { c: remaining[0].id } })
      } else {
        navigate({ to: '/playground', search: {} })
      }
    } else {
      // No navigation — force re-render to reflect the deletion
      setRenderKey((v) => v + 1)
    }
  }, [activeConvId, navigate])

  const hasAnyActive = activeConvId && conversations.some((c) => c.id === activeConvId)

  return (
    <SidebarMenuItem>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <SidebarMenuButton
              tooltip={item.title}
              className={
                hasAnyActive
                  ? 'data-[popup-open]:bg-sidebar-accent'
                  : undefined
              }
            />
          }
        >
          {item.icon && <item.icon />}
          <span>{item.title}</span>
          {conversations.length > 0 && (
            <span className='ml-auto text-xs text-muted-foreground'>
              {conversations.length}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent
          side={isMobile ? 'bottom' : 'right'}
          align='start'
          sideOffset={isMobile ? 4 : 8}
          className='w-64 p-1.5'
        >
          {conversations.length === 0 ? (
            <div className='px-3 py-4 text-center text-sm text-muted-foreground'>
              {t('No conversations yet')}
            </div>
          ) : (
            <div className='flex max-h-80 flex-col overflow-y-auto'>
              {conversations.map((conv) => {
                const isActive = activeConvId === conv.id
                return (
                  <button
                    key={conv.id}
                    type='button'
                    onClick={() => handleSwitch(conv.id)}
                    className={`group/item flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground'
                    }`}
                  >
                    <MessageSquare
                      size={14}
                      className={`shrink-0 ${
                        isActive ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    />
                    <span className='min-w-0 flex-1 truncate'>
                      {conv.title || t('New chat')}
                    </span>
                    <span
                      className='ml-1 shrink-0 cursor-pointer rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover/item:opacity-100'
                      onClick={(e) => handleDelete(e, conv.id)}
                      role='button'
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation()
                          handleDelete(e as unknown as React.MouseEvent, conv.id)
                        }
                      }}
                      aria-label={t('Delete conversation')}
                    >
                      <Trash2
                        size={14}
                        className='text-muted-foreground hover:text-destructive'
                      />
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </SidebarMenuItem>
  )
}
