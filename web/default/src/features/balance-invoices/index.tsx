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
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getSelf } from '@/lib/api'
import { formatQuota } from '@/lib/format'
import { useStatus } from '@/hooks/use-status'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { SectionPageLayout } from '@/components/layout'
import type { UserWalletData } from '@/features/wallet/types'
import {
  cancelOfflineRechargeRequest,
  adminCompleteOfflineRechargeRequest,
  adminIssueInvoiceRequest,
  adminRejectInvoiceRequest,
  adminRejectOfflineRechargeRequest,
  createInvoiceRequest,
  createOfflineRechargeRequest,
  getAdminInvoiceRequests,
  getAdminOfflineRechargeRequests,
  getAdminProofBlob,
  getInvoiceFileUrl,
  getInvoiceRequests,
  getOfflineRechargeRequests,
  getOfflineRechargeSummary,
  getProofBlob,
  uploadOfflineRechargeProof,
} from './api'
import type {
  ApiResponse,
  InvoiceRequest,
  OfflineRechargeRequest,
  OfflineRechargeStatus,
  PageData,
} from './types'

const amountPresets = [300, 500, 1000]
const rechargePageSizeOptions = [10, 20, 30, 40, 50]

function extractQueryError(query: {
  error: unknown
  data?: { success: boolean; message?: string }
}): string {
  if (query.data && !query.data.success) {
    return query.data.message || 'Request failed'
  }
  if (query.error) {
    const err = query.error as {
      response?: { status?: number; data?: { message?: string } }
      message?: string
    }
    return (
      err.response?.data?.message ||
      (err.response?.status ? `HTTP ${err.response.status}` : '') ||
      err.message ||
      'Request failed'
    )
  }
  return ''
}

function formatMoney(value: number | undefined) {
  return `¥${(value || 0).toFixed(2)}`
}

function formatTime(timestamp: number) {
  if (!timestamp) return '-'
  return new Date(timestamp * 1000).toLocaleString()
}

function parseInvoiceRechargeIds(invoice: InvoiceRequest) {
  const ids = invoice.recharge_request_ids
    ? invoice.recharge_request_ids
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((id) => Number.isFinite(id) && id > 0)
    : []
  return ids.length > 0 ? ids : [invoice.recharge_request_id]
}

function calculateInvoiceableAmount(
  recharges: OfflineRechargeRequest[],
  invoices: InvoiceRequest[]
) {
  const occupiedRechargeIds = new Set<number>()
  invoices
    .filter((invoice) => invoice.status === 'pending' || invoice.status === 'issued')
    .forEach((invoice) => {
      parseInvoiceRechargeIds(invoice).forEach((id) =>
        occupiedRechargeIds.add(id)
      )
    })

  return recharges
    .filter(
      (recharge) =>
        recharge.status === 'completed' && !occupiedRechargeIds.has(recharge.id)
    )
    .reduce((sum, recharge) => sum + recharge.amount, 0)
}

function statusLabel(status: string, t: (key: string) => string) {
  const map: Record<string, string> = {
    pending_payment: 'Pending payment',
    pending_review: 'Pending review',
    completed: 'Credited',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    pending: 'Pending invoice',
    issued: 'Issued',
  }
  return t(map[status] || status)
}

function statusVariant(
  status: string
): 'secondary' | 'destructive' | 'default' {
  if (status === 'completed' || status === 'issued') return 'default'
  if (status === 'rejected') return 'destructive'
  return 'secondary'
}

function RechargeStatusBadge(props: {
  request: OfflineRechargeRequest
  t: (key: string) => string
}) {
  const badge = (
    <Badge variant={statusVariant(props.request.status)}>
      {statusLabel(props.request.status, props.t)}
    </Badge>
  )

  if (props.request.status !== 'rejected') {
    return badge
  }

  return (
    <TooltipProvider delay={100}>
      <Tooltip>
        <TooltipTrigger render={<span className='inline-flex' />}>
          {badge}
        </TooltipTrigger>
        <TooltipContent side='top' className='max-w-xs break-words'>
          <div className='font-medium'>{props.t('Rejection reason')}</div>
          <div className='mt-1'>
            {props.request.review_remark ||
              props.t('No rejection reason provided.')}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

async function openBlobInNewWindow(
  blobPromise: Promise<Blob>,
  fallbackErrorMessage: string
) {
  const newWindow = window.open('', '_blank')
  try {
    const blob = await blobPromise
    const type = blob.type || ''
    // The server returned an error/HTML page instead of the file -
    // surface the real content instead of rendering a wrong page.
    if (!type.startsWith('image/') && type !== 'application/pdf') {
      newWindow?.close()
      let detail = ''
      try {
        const text = await blob.text()
        try {
          const parsed = JSON.parse(text) as { message?: string }
          detail = parsed.message || text.slice(0, 200)
        } catch {
          detail = text.slice(0, 200)
        }
      } catch {
        /* empty */
      }
      toast.error(
        detail
          ? `${fallbackErrorMessage} (${type || 'unknown'}): ${detail}`
          : `${fallbackErrorMessage} (${type || 'unknown'})`
      )
      return
    }
    const url = URL.createObjectURL(blob)
    if (newWindow) {
      newWindow.location.href = url
    } else {
      window.open(url, '_blank')
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch {
    newWindow?.close()
    toast.error(fallbackErrorMessage)
  }
}

function AssetCard(props: { title: string; value: string; desc: string }) {
  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardDescription>{props.title}</CardDescription>
        <CardTitle className='text-2xl'>{props.value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className='text-muted-foreground text-xs'>{props.desc}</p>
      </CardContent>
    </Card>
  )
}

function FlowCard() {
  const { t } = useTranslation()
  const steps = [
    [
      'Submit recharge request',
      'Choose an amount and generate a request number.',
    ],
    ['Contact support', 'Add support and confirm payment details privately.'],
    [
      'Upload payment proof',
      'Upload screenshot after scanning the support code.',
    ],
    [
      'Credited and invoice',
      'Admin credits balance, then invoice can be requested.',
    ],
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Recommended process')}</CardTitle>
        <CardDescription>
          {t('Offline recharge uses support-assisted payment review.')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='grid gap-3 md:grid-cols-4'>
          {steps.map(([title, desc], index) => (
            <div key={title} className='rounded-lg border p-3'>
              <Badge variant='secondary'>{index + 1}</Badge>
              <div className='mt-2 font-medium'>{t(title)}</div>
              <p className='text-muted-foreground mt-1 text-xs'>{t(desc)}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function RechargeForm() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { status } = useStatus()
  const [amount, setAmount] = useState('500')
  const [submittedRequest, setSubmittedRequest] =
    useState<OfflineRechargeRequest | null>(null)
  const [supportQrCodeLoadFailed, setSupportQrCodeLoadFailed] = useState(false)
  const supportQrCodeUrl = (
    (status?.offline_recharge_support_qrcode as string | undefined) || ''
  ).trim()
  const showSupportQrCode = supportQrCodeUrl && !supportQrCodeLoadFailed

  useEffect(() => {
    setSupportQrCodeLoadFailed(false)
  }, [supportQrCodeUrl])

  const mutation = useMutation({
    mutationFn: createOfflineRechargeRequest,
    onError: (error) => {
      const statusCode = (error as { response?: { status?: number } }).response
        ?.status
      if (statusCode === 404) {
        toast.error(
          t('Offline recharge API is unavailable. Please contact admin.')
        )
        return
      }
      toast.error(t('Failed to submit request'))
    },
    onSuccess: async (res) => {
      if (!res.success) {
        toast.error(res.message || t('Failed to submit request'))
        return
      }
      toast.success(t('Recharge request submitted'))
      const submitted =
        res.data ??
        ({
          id: 0,
          request_no: '-',
          amount: Number(amount),
          status: 'pending_payment',
        } as OfflineRechargeRequest)
      setSubmittedRequest(submitted)
      queryClient.setQueryData(
        ['balance-invoices', 'recharges'],
        (old: { data?: { items?: OfflineRechargeRequest[]; total?: number } }) =>
          old?.data
            ? {
                ...old,
                data: {
                  ...old.data,
                  items: [submitted, ...(old.data.items ?? [])],
                  total: (old.data.total ?? 0) + 1,
                },
              }
            : {
                success: true,
                data: {
                  items: [submitted],
                  total: 1,
                  page: 1,
                  page_size: 20,
                },
              }
      )
      await queryClient.invalidateQueries({
        queryKey: ['balance-invoices', 'recharges'],
      })
    },
  })

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('Create recharge request')}</CardTitle>
          <CardDescription>
            {t(
              'No online payment is provided. Contact support after submitting.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>{t('Recharge amount')}</FieldLabel>
              <div className='grid grid-cols-3 gap-2'>
                {amountPresets.map((value) => (
                  <Button
                    key={value}
                    type='button'
                    variant={Number(amount) === value ? 'default' : 'outline'}
                    onClick={() => setAmount(String(value))}
                  >
                    {formatMoney(value)}
                  </Button>
                ))}
              </div>
              <Input
                type='number'
                value={amount}
                min={1}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Button
              disabled={mutation.isPending || Number(amount) <= 0}
              onClick={() =>
                mutation.mutate({
                  amount: Number(amount),
                })
              }
            >
              {mutation.isPending
                ? t('Submitting...')
                : t('Submit recharge request')}
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>

      <Dialog
        open={!!submittedRequest}
        onOpenChange={(open) => !open && setSubmittedRequest(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Recharge request submitted')}</DialogTitle>
            <DialogDescription>
              {t(
                'Scan the QR code to add support and send the request number.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className='flex flex-col items-center gap-4'>
            <div className='w-full rounded-lg border p-3 text-sm'>
              <div className='text-muted-foreground'>{t('Request No.')}</div>
              <div className='font-mono text-base font-medium'>
                {submittedRequest?.request_no}
              </div>
              <div className='text-muted-foreground mt-2'>{t('Amount')}</div>
              <div className='font-medium'>
                {formatMoney(submittedRequest?.amount)}
              </div>
            </div>
            {showSupportQrCode ? (
              <img
                src={supportQrCodeUrl}
                alt={t('Support QR code')}
                className='h-56 w-56 rounded-lg border object-contain p-2'
                onError={() => setSupportQrCodeLoadFailed(true)}
              />
            ) : (
              <div className='text-muted-foreground flex h-56 w-56 items-center justify-center rounded-lg border p-4 text-center text-sm'>
                {t('Support QR code is not configured.')}
              </div>
            )}
            <p className='text-muted-foreground text-center text-sm'>
              {t(
                'After adding support, send the request number to confirm payment details.'
              )}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ProofDialog(props: {
  request: OfflineRechargeRequest | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [remark, setRemark] = useState('')
  const [successRequest, setSuccessRequest] =
    useState<OfflineRechargeRequest | null>(null)
  const mutation = useMutation({
    mutationFn: () =>
      uploadOfflineRechargeProof(props.request!.id, file!, remark),
    onSuccess: async (res) => {
      if (!res.success) {
        toast.error(res.message || t('Upload failed'))
        return
      }
      const request = props.request
      if (request) {
        queryClient.setQueryData<ApiResponse<PageData<OfflineRechargeRequest>>>(
          ['balance-invoices', 'recharges'],
          (old) => {
            if (!old?.data) return old
            return {
              ...old,
              data: {
                ...old.data,
                items: old.data.items.map((item) =>
                  item.id === request.id
                    ? {
                        ...item,
                        status: 'pending_review',
                        payment_proof_url: item.payment_proof_url || 'uploaded',
                        payment_remark: remark,
                      }
                    : item
                ),
              },
            }
          }
        )
        setSuccessRequest({ ...request, status: 'pending_review' })
      }
      toast.success(
        t('Payment proof uploaded, recharge request submitted for review.')
      )
      setFile(null)
      setRemark('')
      props.onOpenChange(false)
      await queryClient.invalidateQueries({
        queryKey: ['balance-invoices', 'summary'],
      })
    },
  })

  return (
    <>
      <Dialog open={!!props.request} onOpenChange={props.onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Upload payment proof')}</DialogTitle>
            <DialogDescription>{props.request?.request_no}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>{t('Payment proof')}</FieldLabel>
              <Input
                type='file'
                accept='image/*,.pdf'
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </Field>
            <Field>
              <FieldLabel>{t('Payment remark')}</FieldLabel>
              <Textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
              />
            </Field>
            <Button
              disabled={!file || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              <Upload />
              {mutation.isPending ? t('Uploading...') : t('Upload')}
            </Button>
          </FieldGroup>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!successRequest}
        onOpenChange={(open) => {
          if (!open) setSuccessRequest(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Payment proof uploaded')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'Your payment proof has been submitted. The recharge request is now under manual review. Your balance will be credited after approval.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {successRequest && (
            <div className='rounded-lg border p-3 text-sm'>
              <div className='text-muted-foreground'>{t('Request No.')}</div>
              <div className='font-mono'>{successRequest.request_no}</div>
              <div className='text-muted-foreground mt-2'>{t('Status')}</div>
              <div>{statusLabel('pending_review', t)}</div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setSuccessRequest(null)}>
              {t('Got it')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function InvoiceDialog(props: {
  requests: OfflineRechargeRequest[]
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [taxNo, setTaxNo] = useState('')
  const [email, setEmail] = useState('')
  const [remark, setRemark] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const totalAmount = props.requests.reduce((sum, item) => sum + item.amount, 0)
  const requestIds = props.requests.map((item) => item.id)
  const requestNos = props.requests.map((item) => item.request_no).join(', ')
  const requiredMissing = !title.trim() || !taxNo.trim() || !email.trim()
  const mutation = useMutation({
    mutationFn: () =>
      createInvoiceRequest({
        recharge_request_id: requestIds[0],
        recharge_request_ids: requestIds,
        amount: totalAmount,
        invoice_type: 'normal',
        title,
        tax_no: taxNo,
        email,
        address: '',
        phone: '',
        bank_name: '',
        bank_account: '',
        remark,
      }),
    onSuccess: async (res) => {
      if (!res.success) {
        toast.error(res.message || t('Failed to submit invoice request'))
        return
      }
      toast.success(t('Invoice request submitted'))
      setConfirmOpen(false)
      props.onOpenChange(false)
      await queryClient.invalidateQueries({ queryKey: ['balance-invoices'] })
    },
  })

  return (
    <>
      <Dialog
        open={props.requests.length > 0}
        onOpenChange={props.onOpenChange}
      >
        <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl'>
          <DialogHeader>
            <DialogTitle>{t('Apply for invoice')}</DialogTitle>
            <DialogDescription>
              {t('Selected recharge requests')}: {requestNos || '-'} ·{' '}
              {t('Total amount')}: {formatMoney(totalAmount)}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <div className='rounded-lg border p-3 text-sm'>
              <div className='font-medium'>
                {t('Invoice application notes')}
              </div>
              <ul className='text-muted-foreground mt-2 list-disc space-y-1 pl-5'>
                <li>{t('The invoice amount per request must be at least 100.')}</li>
                <li>
                  {t(
                    'The current invoice issuance cycle is about 7 working days, and the invoice will be sent to your email.'
                  )}
                </li>
                <li>{t('Amounts with issued invoices are non-refundable.')}</li>
                <li>
                  {t(
                    'Invoice information cannot be modified after submission. If there is any issue, please contact us.'
                  )}
                </li>
              </ul>
            </div>
            {totalAmount > 0 && totalAmount < 100 && (
              <div className='text-destructive rounded-lg border p-3 text-sm'>
                {t('The invoice amount per request must be at least 100.')}
              </div>
            )}
            <Field>
              <FieldLabel>{t('Invoice type')}</FieldLabel>
              <div className='bg-muted/40 rounded-md border px-3 py-2 text-sm'>
                {t('VAT ordinary invoice')}
              </div>
            </Field>
            <Field>
              <FieldLabel>
                {t('Invoice title')}
                <span className='text-destructive'> *</span>
              </FieldLabel>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>
                {t('Taxpayer identification number')}
                <span className='text-destructive'> *</span>
              </FieldLabel>
              <Input value={taxNo} onChange={(e) => setTaxNo(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>
                {t('Email')}
                <span className='text-destructive'> *</span>
              </FieldLabel>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>{t('Remark')}</FieldLabel>
              <Textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
              />
            </Field>
            <Button
              disabled={requiredMissing || totalAmount < 100 || mutation.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              <FileText />
              {mutation.isPending
                ? t('Submitting...')
                : t('Submit invoice request')}
            </Button>
          </FieldGroup>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Confirm invoice information')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'Please verify the invoice title, taxpayer identification number, and email before submitting. Invoice information cannot be modified after submission.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className='space-y-2 rounded-lg border p-3 text-sm'>
            <div>
              <span className='text-muted-foreground'>{t('Invoice title')}: </span>
              {title}
            </div>
            <div>
              <span className='text-muted-foreground'>
                {t('Taxpayer identification number')}:{' '}
              </span>
              {taxNo}
            </div>
            <div>
              <span className='text-muted-foreground'>{t('Email')}: </span>
              {email}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? t('Submitting...') : t('Confirm and submit')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
function InvoiceGuideCard() {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Invoice instructions')}</CardTitle>
        <CardDescription>
          {t('Invoices can be requested after offline recharge is credited.')}
        </CardDescription>
      </CardHeader>
      <CardContent className='text-muted-foreground space-y-2 text-sm'>
        <p>
          {t('Choose a credited recharge record and submit invoice details.')}
        </p>
        <p>{t('The invoice amount per request must be at least 100.')}</p>
        <p>
          {t(
            'The current invoice issuance cycle is about 7 working days, and the invoice will be sent to your email.'
          )}
        </p>
        <p>
          {t('Amounts with issued invoices are non-refundable.')}
        </p>
        <p>
          {t(
            'Invoice information cannot be modified after submission. If there is any issue, please contact us.'
          )}
        </p>
        <p>{t('Support will issue the invoice after manual review.')}</p>
      </CardContent>
    </Card>
  )
}

function InvoiceableRechargeTable(props: {
  recharges: OfflineRechargeRequest[]
  invoices: InvoiceRequest[]
}) {
  const { t } = useTranslation()
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [invoiceRequests, setInvoiceRequests] = useState<
    OfflineRechargeRequest[]
  >([])
  const invoiceByRecharge = useMemo(() => {
    const map = new Map<number, InvoiceRequest>()
    props.invoices.forEach((invoice) => {
      parseInvoiceRechargeIds(invoice).forEach((id) => map.set(id, invoice))
    })
    return map
  }, [props.invoices])
  const invoiceableRecharges = props.recharges.filter(
    (item) => item.status === 'completed' && !invoiceByRecharge.has(item.id)
  )
  const selectedRecharges = invoiceableRecharges.filter((item) =>
    selectedIds.includes(item.id)
  )
  const selectedAmount = selectedRecharges.reduce(
    (sum, item) => sum + item.amount,
    0
  )
  const toggleSelected = (id: number) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('Invoiceable recharge records')}</CardTitle>
          <CardDescription>
            {t(
              'Select one or more credited recharge records to apply for a combined invoice.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='mb-4 flex flex-col gap-3 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <div className='font-medium'>
                {t('Selected amount')}: {formatMoney(selectedAmount)}
              </div>
              <div className='text-muted-foreground'>
                {t('The invoice amount per request must be at least 100.')}
                {' '}
                {t('Amounts with issued invoices are non-refundable.')}
              </div>
            </div>
            <Button
              size='sm'
              disabled={selectedAmount < 100}
              onClick={() => setInvoiceRequests(selectedRecharges)}
            >
              {t('Apply combined invoice')}
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-[64px]'>{t('Select')}</TableHead>
                <TableHead>{t('Request No.')}</TableHead>
                <TableHead>{t('Amount')}</TableHead>
                <TableHead>{t('Credited time')}</TableHead>
                <TableHead>{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoiceableRecharges.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(item.id)}
                      onCheckedChange={() => toggleSelected(item.id)}
                    />
                  </TableCell>
                  <TableCell className='font-mono'>{item.request_no}</TableCell>
                  <TableCell>{formatMoney(item.amount)}</TableCell>
                  <TableCell>{formatTime(item.completed_at)}</TableCell>
                  <TableCell>
                    <Button
                      size='sm'
                      variant='outline'
                      disabled={item.amount < 100}
                      onClick={() => setInvoiceRequests([item])}
                    >
                      {t('Apply invoice')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {invoiceableRecharges.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className='text-muted-foreground py-8 text-center'
                  >
                    {t('No invoiceable recharge records.')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <InvoiceDialog
        requests={invoiceRequests}
        onOpenChange={(open) => {
          if (!open) setInvoiceRequests([])
        }}
      />
    </>
  )
}

function InvoiceRecordsTable(props: { invoices: InvoiceRequest[] }) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Invoice records')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Invoice No.')}</TableHead>
              <TableHead>{t('Recharge request')}</TableHead>
              <TableHead>{t('Amount')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.invoices.map((item) => (
              <TableRow key={item.id}>
                <TableCell className='font-mono'>{item.invoice_no}</TableCell>
                <TableCell className='font-mono'>
                  {item.recharge_request_no}
                </TableCell>
                <TableCell>{formatMoney(item.amount)}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(item.status)}>
                    {statusLabel(item.status, t)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {item.file_url && (
                    <Button
                      size='sm'
                      variant='outline'
                      render={
                        <a href={getInvoiceFileUrl(item.id)} target='_blank' />
                      }
                    >
                      {t('Download invoice')}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {props.invoices.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className='text-muted-foreground py-8 text-center'
                >
                  {t('No invoice records yet.')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function RechargeRecordsTable(props: {
  recharges: OfflineRechargeRequest[]
  title: string
  description: string
  emptyMessage: string
  showRejectionReason?: boolean
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [proofRequest, setProofRequest] =
    useState<OfflineRechargeRequest | null>(null)
  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelOfflineRechargeRequest(id),
    onSuccess: async (res) => {
      if (!res.success) {
        toast.error(res.message || t('Cancel failed'))
        return
      }
      toast.success(t('Recharge request cancelled'))
      await queryClient.invalidateQueries({ queryKey: ['balance-invoices'] })
    },
    onError: () => {
      toast.error(t('Cancel failed'))
    },
  })
  const colSpan = props.showRejectionReason ? 6 : 5

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t(props.title)}</CardTitle>
          <CardDescription>{t(props.description)}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Request No.')}</TableHead>
                <TableHead>{t('Amount')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
                <TableHead>{t('Created')}</TableHead>
                {props.showRejectionReason && (
                  <TableHead>{t('Rejection reason')}</TableHead>
                )}
                <TableHead>{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.recharges.map((item) => {
                const cancellable =
                  item.status === 'pending_payment' ||
                  item.status === 'pending_review'
                return (
                  <TableRow key={item.id}>
                    <TableCell className='font-mono'>
                      {item.request_no}
                    </TableCell>
                    <TableCell>{formatMoney(item.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(item.status)}>
                        {statusLabel(item.status, t)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatTime(item.created_at)}</TableCell>
                    {props.showRejectionReason && (
                      <TableCell className='max-w-[240px] break-words'>
                        {item.status === 'rejected'
                          ? item.review_remark || '-'
                          : '-'}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className='flex flex-wrap gap-2'>
                        {cancellable && (
                          <Button
                            size='sm'
                            onClick={() => setProofRequest(item)}
                          >
                            {t('Upload proof')}
                          </Button>
                        )}
                        {item.payment_proof_url && (
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() =>
                              openBlobInNewWindow(
                                getProofBlob(item.id),
                                t('Failed to open proof')
                              )
                            }
                          >
                            {t('View proof')}
                          </Button>
                        )}
                        {cancellable && (
                          <Button
                            size='sm'
                            variant='outline'
                            disabled={cancelMutation.isPending}
                            onClick={() => cancelMutation.mutate(item.id)}
                          >
                            {t('Cancel')}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {props.recharges.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={colSpan}
                    className='text-muted-foreground py-8 text-center'
                  >
                    {t(props.emptyMessage)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <ProofDialog
        request={proofRequest}
        onOpenChange={(open) => {
          if (!open) setProofRequest(null)
        }}
      />
    </>
  )
}

export function OfflineRechargePage() {
  const { t } = useTranslation()
  const userQuery = useQuery({
    queryKey: ['user', 'self'],
    queryFn: getSelf,
  })
  const user = userQuery.data?.data as UserWalletData | undefined
  const rechargeQuery = useQuery({
    queryKey: ['balance-invoices', 'recharges'],
    queryFn: getOfflineRechargeRequests,
    enabled: !!user?.id,
    refetchOnMount: 'always',
    staleTime: 0,
  })

  const recharges = rechargeQuery.data?.data?.items ?? []
  const pendingRecharges = recharges.filter(
    (item) =>
      item.status === 'pending_payment' || item.status === 'pending_review'
  )
  const historicalRecharges = recharges.filter(
    (item) =>
      item.status !== 'pending_payment' && item.status !== 'pending_review'
  )
  const pendingRechargeCount = recharges.filter(
    (item) =>
      item.status === 'pending_payment' || item.status === 'pending_review'
  ).length

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Recharge')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='grid gap-4 xl:grid-cols-[1fr_380px]'>
          <div className='flex min-w-0 flex-col gap-4'>
            <div className='grid gap-3 md:grid-cols-2'>
              <AssetCard
                title={t('Available balance')}
                value={formatQuota(user?.quota ?? 0)}
                desc={t('Estimated from current account quota.')}
              />
              <AssetCard
                title={t('Pending recharge requests')}
                value={String(pendingRechargeCount)}
                desc={t('Recharge requests waiting for payment or review.')}
              />
            </div>
            <FlowCard />
            <RechargeRecordsTable
              recharges={pendingRecharges}
              title='Pending recharge requests'
              description='Recharge requests waiting for payment or review.'
              emptyMessage='No pending recharge requests.'
            />
            <RechargeRecordsTable
              recharges={historicalRecharges}
              title='Historical recharge records'
              description='Completed, rejected, or cancelled recharge records.'
              emptyMessage='No historical recharge records yet.'
              showRejectionReason
            />
          </div>
          <div className='flex flex-col gap-4'>
            <RechargeForm />
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

export function InvoicesPage() {
  const { t } = useTranslation()
  const summaryQuery = useQuery({
    queryKey: ['balance-invoices', 'summary'],
    queryFn: getOfflineRechargeSummary,
    refetchOnMount: 'always',
    staleTime: 0,
  })
  const rechargeQuery = useQuery({
    queryKey: ['balance-invoices', 'recharges'],
    queryFn: getOfflineRechargeRequests,
    refetchOnMount: 'always',
    staleTime: 0,
  })
  const invoiceQuery = useQuery({
    queryKey: ['balance-invoices', 'invoices'],
    queryFn: getInvoiceRequests,
    refetchOnMount: 'always',
    staleTime: 0,
  })

  const summary = summaryQuery.data?.data
  const recharges = rechargeQuery.data?.data?.items ?? []
  const invoices = invoiceQuery.data?.data?.items ?? []
  const localInvoiceableAmount = calculateInvoiceableAmount(recharges, invoices)
  const invoiceableAmount = Math.max(
    summary?.invoiceable_amount ?? 0,
    localInvoiceableAmount
  )
  const pendingInvoiceCount = invoices.filter(
    (item) => item.status === 'pending'
  ).length

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Invoices')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='grid gap-4 xl:grid-cols-[1fr_380px]'>
          <div className='flex min-w-0 flex-col gap-4'>
            <div className='grid gap-3 md:grid-cols-2'>
              <AssetCard
                title={t('Invoiceable amount')}
                value={formatMoney(invoiceableAmount)}
                desc={t('Completed offline recharges not yet invoiced.')}
              />
              <AssetCard
                title={t('Pending invoice requests')}
                value={String(pendingInvoiceCount)}
                desc={t('Invoice requests waiting for review or issuance.')}
              />
            </div>
            <InvoiceableRechargeTable
              recharges={recharges}
              invoices={invoices}
            />
            <InvoiceRecordsTable invoices={invoices} />
          </div>
          <InvoiceGuideCard />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

export const BalanceInvoices = OfflineRechargePage

function AdminReviewActions(props: {
  type: 'recharge' | 'invoice'
  id: number
  status: string
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [remark, setRemark] = useState('')
  const completeMutation = useMutation({
    mutationFn: () =>
      props.type === 'recharge'
        ? adminCompleteOfflineRechargeRequest(props.id, remark)
        : adminIssueInvoiceRequest(props.id, remark),
    onSuccess: async (res) => {
      if (!res.success) {
        toast.error(res.message || t('Operation failed'))
        return
      }
      toast.success(t('Operation completed'))
      setRemark('')
      await queryClient.invalidateQueries({
        queryKey: ['admin-balance-invoices'],
      })
    },
  })
  const rejectMutation = useMutation({
    mutationFn: () =>
      props.type === 'recharge'
        ? adminRejectOfflineRechargeRequest(props.id, remark)
        : adminRejectInvoiceRequest(props.id, remark),
    onSuccess: async (res) => {
      if (!res.success) {
        toast.error(res.message || t('Operation failed'))
        return
      }
      toast.success(t('Rejected'))
      setRemark('')
      await queryClient.invalidateQueries({
        queryKey: ['admin-balance-invoices'],
      })
    },
  })

  const actionable =
    props.type === 'recharge'
      ? props.status === 'pending_review'
      : props.status === 'pending'

  if (!actionable) return null

  return (
    <div className='flex min-w-[260px] flex-col gap-2'>
      <Input
        placeholder={t('Review remark')}
        value={remark}
        onChange={(e) => setRemark(e.target.value)}
      />
      <div className='flex gap-2'>
        <Button
          size='sm'
          onClick={() => completeMutation.mutate()}
          disabled={completeMutation.isPending || rejectMutation.isPending}
        >
          {props.type === 'recharge' ? t('Credit') : t('Mark issued')}
        </Button>
        <Button
          size='sm'
          variant='destructive'
          onClick={() => rejectMutation.mutate()}
          disabled={completeMutation.isPending || rejectMutation.isPending}
        >
          {t('Reject')}
        </Button>
      </div>
    </div>
  )
}

function invoiceTypeLabel(type: string, t: (key: string) => string) {
  return type === 'normal' ? t('VAT ordinary invoice') : type || '-'
}

function InvoiceDetailsDialog(props: {
  invoice: InvoiceRequest | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const invoice = props.invoice

  if (!invoice) return null

  const rows = [
    [t('Invoice No.'), invoice.invoice_no],
    [t('User'), invoice.username || String(invoice.user_id)],
    [t('Recharge request'), invoice.recharge_request_no],
    [t('Amount'), formatMoney(invoice.amount)],
    [t('Status'), statusLabel(invoice.status, t)],
    [t('Invoice type'), invoiceTypeLabel(invoice.invoice_type, t)],
    [t('Invoice title'), invoice.title],
    [t('Taxpayer identification number'), invoice.tax_no],
    [t('Email'), invoice.email],
    [t('Remark'), invoice.remark],
    [t('Review remark'), invoice.review_remark],
    [t('Created'), formatTime(invoice.created_at)],
  ]

  return (
    <Dialog open={Boolean(invoice)} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{t('Invoice details')}</DialogTitle>
          <DialogDescription>
            {t('View invoice information required for manual issuance.')}
          </DialogDescription>
        </DialogHeader>
        <div className='grid gap-3 text-sm'>
          {rows.map(([label, value]) => (
            <div
              key={label}
              className='grid gap-1 rounded-lg border p-3 sm:grid-cols-[160px_minmax(0,1fr)]'
            >
              <div className='text-muted-foreground'>{label}</div>
              <div className='break-words'>{value || '-'}</div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function AdminBalanceInvoices() {
  const { t } = useTranslation()
  const [rechargeKeyword, setRechargeKeyword] = useState('')
  const [rechargeStatusFilter, setRechargeStatusFilter] = useState<
    '' | OfflineRechargeStatus
  >('')
  const [rechargePage, setRechargePage] = useState(1)
  const [rechargePageSize, setRechargePageSize] = useState(10)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRequest | null>(
    null
  )
  const rechargesQuery = useQuery({
    queryKey: ['admin-balance-invoices', 'recharges'],
    queryFn: getAdminOfflineRechargeRequests,
    refetchOnMount: 'always',
    staleTime: 0,
  })
  const invoicesQuery = useQuery({
    queryKey: ['admin-balance-invoices', 'invoices'],
    queryFn: getAdminInvoiceRequests,
    refetchOnMount: 'always',
    staleTime: 0,
  })
  const rechargesError = extractQueryError(rechargesQuery)
  const invoicesError = extractQueryError(invoicesQuery)
  const recharges = rechargesQuery.data?.data?.items ?? []
  const invoices = invoicesQuery.data?.data?.items ?? []
  const filteredRecharges = useMemo(() => {
    const keyword = rechargeKeyword.trim().toLowerCase()
    return recharges.filter((item) => {
      if (rechargeStatusFilter && item.status !== rechargeStatusFilter) {
        return false
      }
      if (!keyword) return true
      return [
        item.request_no,
        item.business_no || '',
        item.username,
        String(item.user_id),
        String(item.id),
      ].some((value) => value.toLowerCase().includes(keyword))
    })
  }, [rechargeKeyword, rechargeStatusFilter, recharges])
  const hasRechargeFilters = Boolean(rechargeKeyword || rechargeStatusFilter)
  const rechargeTotalPages = Math.max(
    1,
    Math.ceil(filteredRecharges.length / rechargePageSize)
  )
  const currentRechargePage = Math.min(rechargePage, rechargeTotalPages)
  const pagedRecharges = useMemo(() => {
    const start = (currentRechargePage - 1) * rechargePageSize
    return filteredRecharges.slice(start, start + rechargePageSize)
  }, [currentRechargePage, filteredRecharges, rechargePageSize])

  useEffect(() => {
    setRechargePage(1)
  }, [rechargeKeyword, rechargeStatusFilter, rechargePageSize])

  useEffect(() => {
    if (rechargePage > rechargeTotalPages) {
      setRechargePage(rechargeTotalPages)
    }
  }, [rechargePage, rechargeTotalPages])

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Recharge & Invoice Review')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-4'>
          <Card>
            <CardHeader>
              <CardTitle>{t('Offline recharge requests')}</CardTitle>
              <CardDescription>
                {t(
                  'Review support-assisted payments and credit balances manually.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]'>
                <Input
                  placeholder={t('Search request no., username or user ID')}
                  value={rechargeKeyword}
                  onChange={(e) => setRechargeKeyword(e.target.value)}
                />
                <NativeSelect
                  className='w-full'
                  value={rechargeStatusFilter}
                  onChange={(e) =>
                    setRechargeStatusFilter(
                      e.target.value as '' | OfflineRechargeStatus
                    )
                  }
                >
                  <option value=''>{t('All statuses')}</option>
                  {(
                    [
                      'pending_payment',
                      'pending_review',
                      'completed',
                      'rejected',
                      'cancelled',
                    ] as OfflineRechargeStatus[]
                  ).map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status, t)}
                    </option>
                  ))}
                </NativeSelect>
                <Button
                  variant='outline'
                  onClick={() => {
                    setRechargeKeyword('')
                    setRechargeStatusFilter('')
                  }}
                  disabled={!hasRechargeFilters}
                >
                  {t('Reset')}
                </Button>
              </div>
              <Table className='table-fixed'>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-[140px]'>
                      {t('Request No.')}
                    </TableHead>
                    <TableHead className='w-[150px]'>
                      {t('Business No')}
                    </TableHead>
                    <TableHead className='w-[110px]'>{t('User')}</TableHead>
                    <TableHead className='w-[90px]'>{t('Amount')}</TableHead>
                    <TableHead className='w-[120px]'>{t('Status')}</TableHead>
                    <TableHead className='w-[150px]'>{t('Created')}</TableHead>
                    <TableHead className='w-[90px]'>{t('Proof')}</TableHead>
                    <TableHead className='w-[280px]'>{t('Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rechargesError && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className='text-destructive py-8 text-center'
                      >
                        {rechargesError}
                      </TableCell>
                    </TableRow>
                  )}
                  {pagedRecharges.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className='break-all font-mono text-xs'>
                        {item.request_no}
                      </TableCell>
                      <TableCell className='break-all font-mono text-xs'>
                        {item.business_no || '-'}
                      </TableCell>
                      <TableCell className='truncate'>{item.username}</TableCell>
                      <TableCell>{formatMoney(item.amount)}</TableCell>
                      <TableCell>
                        <RechargeStatusBadge request={item} t={t} />
                      </TableCell>
                      <TableCell>{formatTime(item.created_at)}</TableCell>
                      <TableCell>
                        {item.payment_proof_url && (
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() =>
                              openBlobInNewWindow(
                                getAdminProofBlob(item.id),
                                t('Failed to open proof')
                              )
                            }
                          >
                            {t('View proof')}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <AdminReviewActions
                          type='recharge'
                          id={item.id}
                          status={item.status}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!rechargesError && filteredRecharges.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className='text-muted-foreground py-8 text-center'
                      >
                        {hasRechargeFilters
                          ? t('No recharge records match the filters.')
                          : t('No recharge records yet.')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {filteredRecharges.length > 0 && (
                <div className='mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                  <div className='flex items-center gap-2'>
                    <NativeSelect
                      value={String(rechargePageSize)}
                      onChange={(e) =>
                        setRechargePageSize(Number(e.target.value))
                      }
                    >
                      {rechargePageSizeOptions.map((pageSize) => (
                        <option key={pageSize} value={pageSize}>
                          {pageSize}
                        </option>
                      ))}
                    </NativeSelect>
                    <span className='text-muted-foreground text-sm'>
                      {t('Rows per page')}
                    </span>
                  </div>
                  <div className='flex items-center gap-3'>
                    <span className='text-muted-foreground text-sm'>
                      {t('Page {{current}} of {{total}}', {
                        current: currentRechargePage,
                        total: rechargeTotalPages,
                      })}
                    </span>
                    <div className='flex gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() =>
                          setRechargePage((page) => Math.max(1, page - 1))
                        }
                        disabled={currentRechargePage <= 1}
                      >
                        {t('Previous')}
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() =>
                          setRechargePage((page) =>
                            Math.min(rechargeTotalPages, page + 1)
                          )
                        }
                        disabled={currentRechargePage >= rechargeTotalPages}
                      >
                        {t('Next')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('Invoice requests')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Invoice No.')}</TableHead>
                    <TableHead>{t('User')}</TableHead>
                    <TableHead>{t('Recharge request')}</TableHead>
                    <TableHead>{t('Title')}</TableHead>
                    <TableHead>{t('Amount')}</TableHead>
                    <TableHead>{t('Status')}</TableHead>
                    <TableHead>{t('Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoicesError && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className='text-destructive py-8 text-center'
                      >
                        {invoicesError}
                      </TableCell>
                    </TableRow>
                  )}
                  {invoices.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className='font-mono'>
                        {item.invoice_no}
                      </TableCell>
                      <TableCell>{item.username}</TableCell>
                      <TableCell className='font-mono'>
                        {item.recharge_request_no}
                      </TableCell>
                      <TableCell>{item.title}</TableCell>
                      <TableCell>{formatMoney(item.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(item.status)}>
                          {statusLabel(item.status, t)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className='flex flex-col gap-2'>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => setSelectedInvoice(item)}
                          >
                            {t('View details')}
                          </Button>
                          <AdminReviewActions
                            type='invoice'
                            id={item.id}
                            status={item.status}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!invoicesError && invoices.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className='text-muted-foreground py-8 text-center'
                      >
                        {t('No invoice records yet.')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <InvoiceDetailsDialog
            invoice={selectedInvoice}
            onOpenChange={(open) => {
              if (!open) setSelectedInvoice(null)
            }}
          />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

