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
import { STORAGE_KEYS } from '../constants'
import type { PlaygroundConfig, ParameterEnabled, Message, Conversation } from '../types'
import { sanitizeMessagesOnLoad } from './message-utils'

/**
 * Load playground config from localStorage
 */
export function loadConfig(): Partial<PlaygroundConfig> {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CONFIG)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load config:', error)
  }
  return {}
}

/**
 * Save playground config to localStorage
 */
export function saveConfig(config: Partial<PlaygroundConfig>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save config:', error)
  }
}

/**
 * Load parameter enabled state from localStorage
 */
export function loadParameterEnabled(): Partial<ParameterEnabled> {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.PARAMETER_ENABLED)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load parameter enabled:', error)
  }
  return {}
}

/**
 * Save parameter enabled state to localStorage
 */
export function saveParameterEnabled(
  parameterEnabled: Partial<ParameterEnabled>
): void {
  try {
    localStorage.setItem(
      STORAGE_KEYS.PARAMETER_ENABLED,
      JSON.stringify(parameterEnabled)
    )
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save parameter enabled:', error)
  }
}

/**
 * Load messages from localStorage
 */
export function loadMessages(): Message[] | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES)
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (!Array.isArray(parsed)) {
        localStorage.removeItem(STORAGE_KEYS.MESSAGES)
        return null
      }
      const sanitized = sanitizeMessagesOnLoad(parsed as Message[])
      // Persist sanitized result to avoid re-sanitizing on subsequent loads
      if (sanitized !== parsed) {
        saveMessages(sanitized)
      }
      return sanitized
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load messages:', error)
  }
  return null
}

/**
 * Save messages to localStorage
 */
export function saveMessages(messages: Message[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save messages:', error)
  }
}

/**
 * Clear all playground data
 */
export function clearPlaygroundData(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.CONFIG)
    localStorage.removeItem(STORAGE_KEYS.PARAMETER_ENABLED)
    localStorage.removeItem(STORAGE_KEYS.MESSAGES)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to clear playground data:', error)
  }
}

/**
 * Save a single conversation to localStorage (keyed by id).
 */
export function saveConversation(conversation: Conversation): void {
  try {
    localStorage.setItem(
      `${STORAGE_KEYS.CONVERSATIONS}:${conversation.id}`,
      JSON.stringify(conversation)
    )
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save conversation:', error)
  }
}

/**
 * Load all conversations from localStorage, sorted by updatedAt descending.
 */
export function loadConversations(): Conversation[] {
  try {
    const conversations: Conversation[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(`${STORAGE_KEYS.CONVERSATIONS}:`)) {
        const raw = localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw) as Conversation
          if (parsed.id && Array.isArray(parsed.messages)) {
            conversations.push(parsed)
          }
        }
      }
    }
    return conversations.sort((a, b) => b.updatedAt - a.updatedAt)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load conversations:', error)
    return []
  }
}

/**
 * Delete a single conversation from localStorage by id.
 */
export function deleteConversation(id: string): void {
  try {
    localStorage.removeItem(`${STORAGE_KEYS.CONVERSATIONS}:${id}`)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to delete conversation:', error)
  }
}

/**
 * Get the active conversation id from localStorage.
 */
export function getActiveConversationId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_CONVERSATION)
  } catch {
    return null
  }
}

/**
 * Set the active conversation id in localStorage.
 */
export function setActiveConversationId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_CONVERSATION, id)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save active conversation id:', error)
  }
}
