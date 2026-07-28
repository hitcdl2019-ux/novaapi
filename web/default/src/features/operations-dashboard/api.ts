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
import { api } from '@/lib/api'
import type { OperationsDashboardResponse } from './types'

function isOperationsDashboardResponse(
  value: unknown
): value is OperationsDashboardResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { success?: unknown }).success === 'boolean'
  )
}

export async function getOperationsDashboard(params: {
  start_time?: number
  end_time?: number
}): Promise<OperationsDashboardResponse> {
  const search = new URLSearchParams()
  if (params.start_time) search.set('start_time', String(params.start_time))
  if (params.end_time) search.set('end_time', String(params.end_time))
  const query = search.toString()
  const config = { skipErrorHandler: true } as Record<string, unknown>
  const urls = [
    `/api/operations-dashboard?${query}`,
    `/api/admin/operations/dashboard?${query}`,
  ]

  let lastError: unknown
  for (const url of urls) {
    try {
      const res = await api.get(url, config)
      if (isOperationsDashboardResponse(res.data)) {
        return res.data
      }
      lastError = new Error(`Unexpected response from ${url}`)
    } catch (error) {
      lastError = error
      const status = (error as { response?: { status?: number } }).response
        ?.status
      if (status && status !== 404) throw error
    }
  }
  throw lastError
}
