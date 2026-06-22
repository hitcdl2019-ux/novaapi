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
import { useState, useCallback, useMemo } from 'react'
import { DEFAULT_CONFIG, DEFAULT_PARAMETER_ENABLED, STORAGE_KEYS } from '../constants'
import {
  loadConfig,
  saveConfig,
  loadParameterEnabled,
  saveParameterEnabled,
  loadMessages,
  saveMessages,
  saveConversation,
  loadConversations,
  deleteConversation as deleteConversationStorage,
  getActiveConversationId,
  setActiveConversationId,
} from '../lib'
import type {
  Message,
  PlaygroundConfig,
  ParameterEnabled,
  ModelOption,
  GroupOption,
  Conversation,
} from '../types'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

function makeConversation(
  overrides: Partial<Conversation> = {}
): Conversation {
  return {
    id: generateId(),
    title: '',
    messages: [],
    config: { ...DEFAULT_CONFIG },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

function resolveActiveId(
  conversations: Conversation[],
  preferredId: string | null
): string | null {
  if (preferredId && conversations.some((c) => c.id === preferredId))
    return preferredId
  return conversations[0]?.id ?? null
}

/**
 * Derive a conversation title from its first user message (truncated to 50 chars).
 */
function deriveTitle(messages: Message[]): string {
  const first = messages.find((m) => m.from === 'user')
  if (!first) return ''
  const text = first.versions[0]?.content || ''
  return text.slice(0, 50).replace(/\n/g, ' ').trim()
}

/**
 * Migrate old-format (single-conversation) localStorage data into the new
 * multi-conversation format.  Clears the old keys so migration only runs once.
 */
function migrateOldData(): Conversation | null {
  const oldMessages = loadMessages()
  if (!oldMessages || oldMessages.length === 0) return null

  const oldConfig = loadConfig()
  const conv = makeConversation({
    messages: oldMessages,
    config: { ...DEFAULT_CONFIG, ...oldConfig },
  })
  conv.title = deriveTitle(conv.messages)

  saveConversation(conv)
  localStorage.removeItem(STORAGE_KEYS.MESSAGES)
  localStorage.removeItem(STORAGE_KEYS.CONFIG)
  localStorage.removeItem(STORAGE_KEYS.PARAMETER_ENABLED)
  setActiveConversationId(conv.id)
  return conv
}

/**
 * Main state management hook for playground — supports multiple conversations.
 */
export function usePlaygroundState() {
  // ── Conversations ────────────────────────────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const existing = loadConversations()
    if (existing.length > 0) return existing

    const migrated = migrateOldData()
    return migrated ? [migrated] : []
  })

  const [activeConversationId, setActiveId] = useState<string | null>(() => {
    const saved = loadConversations()
    if (saved.length > 0) {
      return resolveActiveId(saved, getActiveConversationId())
    }
    return null
  })

  // ── Active conversation helpers ──────────────────────────────────
  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  )

  // ── Derived state (for compatibility with existing consumers) ────
  const [config, setConfigState] = useState<PlaygroundConfig>(() =>
    activeConversation ? { ...DEFAULT_CONFIG, ...activeConversation.config } : { ...DEFAULT_CONFIG }
  )
  const [messages, setMessagesState] = useState<Message[]>(() =>
    activeConversation?.messages ?? []
  )
  const [parameterEnabled, setParameterEnabled] = useState<ParameterEnabled>(() => {
    const saved = loadParameterEnabled()
    return { ...DEFAULT_PARAMETER_ENABLED, ...saved }
  })

  const [models, setModels] = useState<ModelOption[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])

  // ── Persist active conversation ─────────────────────────────────
  const persistActive = useCallback(
    (conv: Conversation | null, messagesArr: Message[], cfg: PlaygroundConfig) => {
      if (!conv) return
      const updated: Conversation = {
        ...conv,
        messages: messagesArr,
        config: cfg,
        updatedAt: Date.now(),
        title: conv.title || deriveTitle(messagesArr),
      }
      saveConversation(updated)
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      )
    },
    []
  )

  // ── Switch to a conversation ────────────────────────────────────
  const loadConversationIntoState = useCallback((conv: Conversation) => {
    const cfg = { ...DEFAULT_CONFIG, ...conv.config }
    setConfigState(cfg)
    saveConfig(cfg)
    setMessagesState(conv.messages)
    saveMessages(conv.messages)
    setActiveId(conv.id)
    setActiveConversationId(conv.id)
  }, [])

  // ── Public API ──────────────────────────────────────────────────

  /** Update config with auto-save to active conversation. */
  const updateConfig = useCallback(
    <K extends keyof PlaygroundConfig>(key: K, value: PlaygroundConfig[K]) => {
      setConfigState((prev) => {
        const updated = { ...prev, [key]: value }
        saveConfig(updated)

        // Persist into active conversation immediately
        setConversations((prevList) => {
          const conv = prevList.find((c) => c.id === activeConversationId)
          if (!conv) return prevList
          const saved: Conversation = {
            ...conv,
            config: updated,
            updatedAt: Date.now(),
          }
          saveConversation(saved)
          return prevList.map((c) => (c.id === saved.id ? saved : c))
        })

        return updated
      })
    },
    [activeConversationId]
  )

  /** Update parameter enabled state. */
  const updateParameterEnabled = useCallback(
    (key: keyof ParameterEnabled, value: boolean) => {
      setParameterEnabled((prev) => {
        const updated = { ...prev, [key]: value }
        saveParameterEnabled(updated)
        return updated
      })
    },
    []
  )

  /** Update messages with auto-save to active conversation. */
  const updateMessages = useCallback(
    (updater: Message[] | ((prev: Message[]) => Message[])) => {
      setMessagesState((prev) => {
        const newMessages =
          typeof updater === 'function' ? updater(prev) : updater
        saveMessages(newMessages)

        if (activeConversation) {
          const updated: Conversation = {
            ...activeConversation,
            messages: newMessages,
            updatedAt: Date.now(),
            title: activeConversation.title || deriveTitle(newMessages),
          }
          saveConversation(updated)
          setConversations((prevList) =>
            prevList.map((c) => (c.id === updated.id ? updated : c))
          )
        }
        return newMessages
      })
    },
    [activeConversation]
  )

  /** Clear all messages in the active conversation. */
  const clearMessages = useCallback(() => {
    updateMessages([])
  }, [updateMessages])

  /** Create a new conversation. Saves the current one first. */
  const createNewConversation = useCallback(() => {
    // Save current conversation first
    if (activeConversation) {
      persistActive(activeConversation, messages, config)
    }

    const conv = makeConversation()
    saveConversation(conv)
    setConversations((prev) => [conv, ...prev])
    loadConversationIntoState(conv)
  }, [activeConversation, messages, config, persistActive, loadConversationIntoState])

  /** Switch to an existing conversation. */
  const switchConversation = useCallback(
    (id: string) => {
      if (id === activeConversationId) return

      // Save current first
      if (activeConversation) {
        persistActive(activeConversation, messages, config)
      }

      const target = conversations.find((c) => c.id === id)
      if (target) {
        loadConversationIntoState(target)
      }
    },
    [
      activeConversationId,
      activeConversation,
      messages,
      config,
      conversations,
      persistActive,
      loadConversationIntoState,
    ]
  )

  /** Delete a conversation by id. */
  const deleteActiveConversation = useCallback(
    (id: string) => {
      deleteConversationStorage(id)
      setConversations((prev) => {
        const remaining = prev.filter((c) => c.id !== id)
        if (id === activeConversationId) {
          if (remaining.length > 0) {
            loadConversationIntoState(remaining[0])
          } else {
            // No conversations left — create a fresh one
            const fresh = makeConversation()
            saveConversation(fresh)
            loadConversationIntoState(fresh)
            return [fresh]
          }
        }
        return remaining
      })
    },
    [activeConversationId, loadConversationIntoState]
  )

  /** Load a conversation by ID from localStorage. Used for URL param restoration. */
  const loadConversationById = useCallback(
    (id: string) => {
      const all = loadConversations()
      const conv = all.find((c) => c.id === id)
      if (conv) {
        loadConversationIntoState(conv)
        // Also add to in-memory list if not already there
        setConversations((prev) => {
          if (prev.some((c) => c.id === id)) return prev
          return [conv, ...prev]
        })
      }
    },
    [loadConversationIntoState]
  )

  /** Reset config to defaults. */
  const resetConfig = useCallback(() => {
    setConfigState(DEFAULT_CONFIG)
    setParameterEnabled(DEFAULT_PARAMETER_ENABLED)
    saveConfig(DEFAULT_CONFIG)
    saveParameterEnabled(DEFAULT_PARAMETER_ENABLED)
  }, [])

  return {
    // Core state
    config,
    parameterEnabled,
    messages,
    models,
    groups,

    // Conversations
    conversations,
    activeConversationId,

    // Setters
    setModels,
    setGroups,

    // Actions
    updateConfig,
    updateParameterEnabled,
    updateMessages,
    clearMessages,
    resetConfig,
    createNewConversation,
    switchConversation,
    deleteConversation: deleteActiveConversation,
    loadConversationById,
  }
}
