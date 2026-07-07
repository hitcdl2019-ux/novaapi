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

export type OfflineRechargeStatus =
  | 'pending_payment'
  | 'pending_review'
  | 'completed'
  | 'rejected'
  | 'cancelled'

export type InvoiceStatus = 'pending' | 'issued' | 'rejected' | 'cancelled'

export interface OfflineRechargeSummary {
  balance_amount: number
  invoiceable_amount: number
  pending_count: number
}

export interface OfflineRechargeRequest {
  id: number
  request_no: string
  user_id: number
  username: string
  business_no: string
  amount: number
  quota: number
  status: OfflineRechargeStatus
  contact_name: string
  contact_method: string
  invoice_required: boolean
  remark: string
  payment_proof_url: string
  payment_remark: string
  review_remark: string
  created_at: number
  updated_at: number
  completed_at: number
}

export interface InvoiceRequest {
  id: number
  invoice_no: string
  user_id: number
  username: string
  recharge_request_id: number
  recharge_request_ids: string
  recharge_request_no: string
  amount: number
  status: InvoiceStatus
  invoice_type: string
  title: string
  tax_no: string
  email: string
  address: string
  phone: string
  bank_name: string
  bank_account: string
  remark: string
  file_url: string
  review_remark: string
  created_at: number
  updated_at: number
}

export interface PageData<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}
