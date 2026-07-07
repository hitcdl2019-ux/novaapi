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
import type {
  ApiResponse,
  InvoiceRequest,
  OfflineRechargeRequest,
  OfflineRechargeSummary,
  PageData,
} from './types'

export async function getOfflineRechargeSummary(): Promise<
  ApiResponse<OfflineRechargeSummary>
> {
  const res = await api.get('/api/offline-recharge/summary', {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

export async function getOfflineRechargeRequests(): Promise<
  ApiResponse<PageData<OfflineRechargeRequest>>
> {
  const res = await api.get('/api/offline-recharge/requests?p=1&page_size=100', {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

export async function createOfflineRechargeRequest(request: {
  amount: number
}): Promise<ApiResponse<OfflineRechargeRequest>> {
  const res = await api.post('/api/offline-recharge/requests', request, {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

export async function uploadOfflineRechargeProof(
  id: number,
  file: File,
  paymentRemark: string
): Promise<ApiResponse> {
  const form = new FormData()
  form.append('file', file)
  form.append('payment_remark', paymentRemark)
  const res = await api.post(`/api/offline-recharge/requests/${id}/proof`, form)
  return res.data
}

export async function cancelOfflineRechargeRequest(
  id: number
): Promise<ApiResponse> {
  const res = await api.post(`/api/offline-recharge/requests/${id}/cancel`)
  return res.data
}

export async function getInvoiceRequests(): Promise<
  ApiResponse<PageData<InvoiceRequest>>
> {
  const res = await api.get('/api/invoices/?p=1&page_size=100', {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

export async function createInvoiceRequest(request: {
  recharge_request_id: number
  recharge_request_ids?: number[]
  amount: number
  invoice_type: string
  title: string
  tax_no: string
  email: string
  address: string
  phone: string
  bank_name: string
  bank_account: string
  remark: string
}): Promise<ApiResponse<InvoiceRequest>> {
  const res = await api.post('/api/invoices/', request)
  return res.data
}

export function getProofUrl(id: number): string {
  return `/api/offline-recharge/requests/${id}/proof`
}

export async function getProofBlob(id: number): Promise<Blob> {
  const res = await api.get(getProofUrl(id), {
    responseType: 'blob',
    disableDuplicate: true,
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

export function getInvoiceFileUrl(id: number): string {
  return `/api/invoices/${id}/file`
}

export async function getAdminOfflineRechargeRequests(): Promise<
  ApiResponse<PageData<OfflineRechargeRequest>>
> {
  const res = await api.get(
    '/api/admin/offline-recharge/requests?p=1&page_size=100',
    {
      skipErrorHandler: true,
    } as Record<string, unknown>
  )
  return res.data
}

export async function adminCompleteOfflineRechargeRequest(
  id: number,
  remark: string
): Promise<ApiResponse> {
  const res = await api.post(
    `/api/admin/offline-recharge/requests/${id}/complete`,
    {
      remark,
    }
  )
  return res.data
}

export async function adminRejectOfflineRechargeRequest(
  id: number,
  remark: string
): Promise<ApiResponse> {
  const res = await api.post(
    `/api/admin/offline-recharge/requests/${id}/reject`,
    {
      remark,
    }
  )
  return res.data
}

export async function getAdminInvoiceRequests(): Promise<
  ApiResponse<PageData<InvoiceRequest>>
> {
  const res = await api.get('/api/admin/invoices/?p=1&page_size=100', {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

export async function adminIssueInvoiceRequest(
  id: number,
  remark: string
): Promise<ApiResponse> {
  const form = new FormData()
  form.append('remark', remark)
  const res = await api.post(`/api/admin/invoices/${id}/issue`, form)
  return res.data
}

export async function adminRejectInvoiceRequest(
  id: number,
  remark: string
): Promise<ApiResponse> {
  const res = await api.post(`/api/admin/invoices/${id}/reject`, { remark })
  return res.data
}

export function getAdminProofUrl(id: number): string {
  return `/api/admin/offline-recharge/requests/${id}/proof`
}

export async function getAdminProofBlob(id: number): Promise<Blob> {
  const res = await api.get(getAdminProofUrl(id), {
    responseType: 'blob',
    disableDuplicate: true,
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}
