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

export interface OperationsDashboardSummary {
  recharge_amount: number
  invoice_amount: number
  new_users: number
  active_users: number
  request_count: number
  used_quota: number
  pending_recharge_count: number
  pending_invoice_count: number
}

export interface OperationsTrendPoint {
  date: string
  recharge_amount: number
  invoice_amount: number
}

export interface OperationsTopUser {
  user_id: number
  username: string
  amount: number
  quota: number
}

export interface OperationsModelRanking {
  model_name: string
  request_count: number
  quota: number
}

export interface OperationsTodoSummary {
  pending_recharge_count: number
  pending_recharge_amount: number
  pending_invoice_count: number
  pending_invoice_amount: number
}

export interface OperationsDashboard {
  summary: OperationsDashboardSummary
  revenue_trend: OperationsTrendPoint[]
  top_recharge_users: OperationsTopUser[]
  top_consume_users: OperationsTopUser[]
  model_ranking: OperationsModelRanking[]
  todos: OperationsTodoSummary
}

export interface OperationsDashboardResponse {
  success: boolean
  message?: string
  data?: OperationsDashboard
}
