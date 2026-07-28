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
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  AlertCircle,
  BarChart3,
  FileText,
  ReceiptText,
  Users,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatQuota } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SectionPageLayout } from '@/components/layout'
import { getOperationsDashboard } from './api'
import type {
  OperationsModelRanking,
  OperationsTopUser,
  OperationsTrendPoint,
} from './types'

function formatMoney(value: number | undefined) {
  return `¥${(value || 0).toFixed(2)}`
}

function formatNumber(value: number | undefined) {
  return (value || 0).toLocaleString()
}

function formatItems(count: number | undefined, unit: string) {
  return `${formatNumber(count)} ${unit}`
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startTimestamp(date: string) {
  if (!date) return 0
  return Math.floor(new Date(`${date}T00:00:00`).getTime() / 1000)
}

function endTimestamp(date: string) {
  if (!date) return 0
  return Math.floor(new Date(`${date}T23:59:59`).getTime() / 1000)
}

function StatCard(props: {
  title: string
  value: string
  desc: string
  icon: React.ComponentType<{ className?: string }>
}) {
  const Icon = props.icon
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between gap-3 pb-2'>
        <CardDescription>{props.title}</CardDescription>
        <Icon className='text-muted-foreground size-4' />
      </CardHeader>
      <CardContent>
        <CardTitle className='text-2xl'>{props.value}</CardTitle>
        <p className='text-muted-foreground mt-1 text-xs'>{props.desc}</p>
      </CardContent>
    </Card>
  )
}

function EmptyRow(props: { colSpan: number; text: string }) {
  return (
    <TableRow>
      <TableCell
        colSpan={props.colSpan}
        className='text-muted-foreground py-8 text-center'
      >
        {props.text}
      </TableCell>
    </TableRow>
  )
}

function RevenueTrendTable(props: { data: OperationsTrendPoint[] }) {
  const { t } = useTranslation()
  const rows = props.data.slice(-14).reverse()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Revenue Trend')}</CardTitle>
        <CardDescription>
          {t('Daily successful recharge and issued invoice amounts.')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Date')}</TableHead>
              <TableHead>{t('Recharge Amount')}</TableHead>
              <TableHead>{t('Issued Invoice Amount')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item) => (
              <TableRow key={item.date}>
                <TableCell>{item.date}</TableCell>
                <TableCell>{formatMoney(item.recharge_amount)}</TableCell>
                <TableCell>{formatMoney(item.invoice_amount)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <EmptyRow colSpan={3} text={t('No data in selected range.')} />
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function TopUsersTable(props: {
  title: string
  description: string
  data: OperationsTopUser[]
  valueType: 'money' | 'quota'
}) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
        <CardDescription>{props.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('User')}</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>{t('Amount')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.data.map((item) => (
              <TableRow key={`${item.user_id}-${item.username}`}>
                <TableCell>{item.username || '-'}</TableCell>
                <TableCell>{item.user_id}</TableCell>
                <TableCell>
                  {props.valueType === 'money'
                    ? formatMoney(item.amount)
                    : formatQuota(item.quota)}
                </TableCell>
              </TableRow>
            ))}
            {props.data.length === 0 && (
              <EmptyRow colSpan={3} text={t('No data in selected range.')} />
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function ModelRankingTable(props: { data: OperationsModelRanking[] }) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Model Usage Ranking')}</CardTitle>
        <CardDescription>
          {t('Top models by consumed quota in the selected range.')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Model')}</TableHead>
              <TableHead>{t('Requests')}</TableHead>
              <TableHead>{t('Quota')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.data.map((item) => (
              <TableRow key={item.model_name || 'unknown'}>
                <TableCell className='font-mono'>
                  {item.model_name || '-'}
                </TableCell>
                <TableCell>{formatNumber(item.request_count)}</TableCell>
                <TableCell>{formatQuota(item.quota)}</TableCell>
              </TableRow>
            ))}
            {props.data.length === 0 && (
              <EmptyRow colSpan={3} text={t('No data in selected range.')} />
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function OperationsDashboard() {
  const { t } = useTranslation()
  const defaultRange = useMemo(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 29)
    return {
      start: toDateInputValue(start),
      end: toDateInputValue(end),
    }
  }, [])
  const [startDate, setStartDate] = useState(defaultRange.start)
  const [endDate, setEndDate] = useState(defaultRange.end)
  const startTime = startTimestamp(startDate)
  const endTime = endTimestamp(endDate)

  const query = useQuery({
    queryKey: ['operations-dashboard', startTime, endTime],
    queryFn: () =>
      getOperationsDashboard({
        start_time: startTime,
        end_time: endTime,
      }),
  })

  const data = query.data?.data
  const summary = data?.summary
  const todos = data?.todos

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Operations Dashboard')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Track revenue, users, usage, and pending operations.')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Actions>
        <div className='flex flex-wrap items-center gap-2'>
          <Input
            type='date'
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            aria-label={t('Stats start date')}
            className='w-[150px]'
          />
          <Input
            type='date'
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            aria-label={t('Stats end date')}
            className='w-[150px]'
          />
          <Button
            variant='outline'
            onClick={() => {
              setStartDate(defaultRange.start)
              setEndDate(defaultRange.end)
            }}
          >
            {t('Last 30 days')}
          </Button>
        </div>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-4'>
          {query.data && !query.data.success && (
            <Card>
              <CardContent className='text-destructive flex items-center gap-2 py-4 text-sm'>
                <AlertCircle className='size-4' />
                {query.data.message || t('Failed to load')}
              </CardContent>
            </Card>
          )}

          <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
            <StatCard
              title={t('Recharge Amount')}
              value={formatMoney(summary?.recharge_amount)}
              desc={t('Successful recharge orders in selected range.')}
              icon={Wallet}
            />
            <StatCard
              title={t('Issued Invoice Amount')}
              value={formatMoney(summary?.invoice_amount)}
              desc={t('Issued invoice amount in selected range.')}
              icon={ReceiptText}
            />
            <StatCard
              title={t('New Users')}
              value={formatNumber(summary?.new_users)}
              desc={t('Newly registered users in selected range.')}
              icon={Users}
            />
            <StatCard
              title={t('Active Users')}
              value={formatNumber(summary?.active_users)}
              desc={t('Users with API consumption logs in selected range.')}
              icon={Users}
            />
            <StatCard
              title={t('Requests')}
              value={formatNumber(summary?.request_count)}
              desc={t('API consumption request count in selected range.')}
              icon={BarChart3}
            />
            <StatCard
              title={t('Used Quota')}
              value={formatQuota(summary?.used_quota || 0)}
              desc={t('Consumed quota in selected range.')}
              icon={BarChart3}
            />
            <StatCard
              title={t('Pending Recharges')}
              value={formatNumber(summary?.pending_recharge_count)}
              desc={t('Offline recharge requests waiting for payment or review.')}
              icon={Wallet}
            />
            <StatCard
              title={t('Pending Invoices')}
              value={formatNumber(summary?.pending_invoice_count)}
              desc={t('Invoice requests waiting for review or issuance.')}
              icon={FileText}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t('Operations Todo')}</CardTitle>
              <CardDescription>
                {t('Items that need administrator follow-up.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='grid gap-3 md:grid-cols-2'>
                <div className='flex items-center justify-between gap-3 rounded-lg border p-3'>
                  <div>
                    <div className='font-medium'>{t('Pending Recharges')}</div>
                    <div className='text-muted-foreground text-sm'>
                      {formatItems(todos?.pending_recharge_count, t('items'))}{' '}
                      {formatMoney(todos?.pending_recharge_amount)}
                    </div>
                  </div>
                  <Button variant='outline' size='sm' render={<Link to='/recharge-invoice-review' />}>
                    {t('Review')}
                  </Button>
                </div>
                <div className='flex items-center justify-between gap-3 rounded-lg border p-3'>
                  <div>
                    <div className='font-medium'>{t('Pending Invoices')}</div>
                    <div className='text-muted-foreground text-sm'>
                      {formatItems(todos?.pending_invoice_count, t('items'))}{' '}
                      {formatMoney(todos?.pending_invoice_amount)}
                    </div>
                  </div>
                  <Button variant='outline' size='sm' render={<Link to='/recharge-invoice-review' />}>
                    {t('Review')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className='grid gap-4 xl:grid-cols-2'>
            <RevenueTrendTable data={data?.revenue_trend ?? []} />
            <ModelRankingTable data={data?.model_ranking ?? []} />
            <TopUsersTable
              title={t('Top Recharge Users')}
              description={t('Users ranked by successful recharge amount.')}
              data={data?.top_recharge_users ?? []}
              valueType='money'
            />
            <TopUsersTable
              title={t('Top Consume Users')}
              description={t('Users ranked by consumed quota.')}
              data={data?.top_consume_users ?? []}
              valueType='quota'
            />
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

