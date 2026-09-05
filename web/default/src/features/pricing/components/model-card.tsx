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
import { memo } from 'react'
import { ChevronRight, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { DEFAULT_TOKEN_UNIT } from '../constants'
import {
  getDynamicPriceEntries,
  getDynamicDisplayGroupRatio,
  getDynamicPricingSummary,
  type DynamicPriceEntry,
  type DynamicPricingSummary,
} from '../lib/dynamic-price'
import { parseTags } from '../lib/filters'
import {
  getModelDiscountLabel,
  getModelDiscountMultiplier,
  hasModelDiscount,
  isTokenBasedModel,
} from '../lib/model-helpers'
import { formatPrice, formatRequestPrice } from '../lib/price'
import { formatBillingCurrencyFromUSD } from '@/lib/currency'
import type { PricingModel, TokenUnit, PriceType } from '../types'
import { ModelPerfBadge, type ModelPerfBadgeData } from './model-perf-badge'

type PeakValleyPriceRow = {
  key: 'peak' | 'offPeak'
  labelKey: string
  timeLabel: string
  entries: DynamicPriceEntry[]
}

export interface ModelCardProps {
  model: PricingModel
  onClick: () => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  perf?: ModelPerfBadgeData
  isAdmin?: boolean
}

function normalizeTierLabel(label: unknown): string {
  return String(label || '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

function isPeakTier(label: unknown): boolean {
  const normalized = normalizeTierLabel(label)
  return (
    (normalized.includes('peak') ||
      normalized.includes('高峰') ||
      normalized.includes('峰')) &&
    !isOffPeakTier(label)
  )
}

function isOffPeakTier(label: unknown): boolean {
  const normalized = normalizeTierLabel(label)
  return (
    normalized.includes('offpeak') ||
    normalized.includes('idle') ||
    normalized.includes('valley') ||
    normalized.includes('空闲') ||
    normalized.includes('低峰') ||
    normalized.includes('谷')
  )
}

function formatHourLabel(value: string): string {
  const hour = Number(value)
  if (!Number.isFinite(hour)) return value
  return `${String(hour).padStart(2, '0')}:00`
}

function getPeakHourRanges(expression: string): string[] {
  const peakTierIndex = expression.search(/tier\(\s*["']peak["']/i)
  const conditionExpr =
    peakTierIndex > 0 ? expression.slice(0, peakTierIndex) : expression
  const ranges: string[] = []
  const rangeRe =
    /hour\(\s*["'][^"']+["']\s*\)\s*>=\s*(\d+(?:\.\d+)?)\s*&&\s*hour\(\s*["'][^"']+["']\s*\)\s*<\s*(\d+(?:\.\d+)?)/gi
  let match
  while ((match = rangeRe.exec(conditionExpr)) !== null) {
    ranges.push(`${formatHourLabel(match[1])}-${formatHourLabel(match[2])}`)
  }
  return ranges
}

function isWeekendAllDayOffPeak(expression: string): boolean {
  const peakTierIndex = expression.search(/tier\(\s*["']peak["']/i)
  if (peakTierIndex <= 0) return false

  const conditionExpr = expression.slice(0, peakTierIndex)
  if (!/weekday\s*\(/i.test(conditionExpr)) return false

  const normalized = conditionExpr.replace(/\s+/g, '')
  const patterns = [
    /!\(weekday\(["'][^"']+["']\)==0\|\|weekday\(["'][^"']+["']\)==6\)/i,
    /weekday\(["'][^"']+["']\)!=0&&weekday\(["'][^"']+["']\)!=6/i,
    /weekday\(["'][^"']+["']\)>=1&&weekday\(["'][^"']+["']\)<=5/i,
  ]

  return patterns.some((pattern) => pattern.test(normalized))
}

function getPeakValleyPriceRows(
  summary: DynamicPricingSummary,
  options: Parameters<typeof getDynamicPriceEntries>[1],
  t: (key: string) => string
): PeakValleyPriceRow[] {
  const peakRanges = getPeakHourRanges(summary.rawExpression)
  if (peakRanges.length === 0) return []
  const weekendAllDayOffPeak = isWeekendAllDayOffPeak(summary.rawExpression)

  const peakTier = summary.tiers.find((tier) => isPeakTier(tier.label))
  const offPeakTier =
    summary.tiers.find((tier) => isOffPeakTier(tier.label)) ||
    summary.tiers.find((tier) => tier !== peakTier)

  if (!peakTier || !offPeakTier) return []

  return [
    {
      key: 'peak',
      labelKey: 'Peak price',
      timeLabel: weekendAllDayOffPeak
        ? `${t('Mon-Fri')} ${peakRanges.join(', ')}`
        : peakRanges.join(', '),
      entries: getDynamicPriceEntries(peakTier, options),
    },
    {
      key: 'offPeak',
      labelKey: 'Off-peak price',
      timeLabel: weekendAllDayOffPeak
        ? `${t('Weekends all day')} · ${t('Other times')}`
        : t('Other times'),
      entries: getDynamicPriceEntries(offPeakTier, options),
    },
  ].filter((row) => row.entries.length > 0)
}

export const ModelCard = memo(function ModelCard(props: ModelCardProps) {
  const { t, i18n } = useTranslation()
  const { copyToClipboard } = useCopyToClipboard()
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const priceRate = props.priceRate ?? 1
  const usdExchangeRate = props.usdExchangeRate ?? 1
  const showRechargePrice = props.showRechargePrice ?? false
  const isTokenBased = isTokenBasedModel(props.model)
  const tokenUnitLabel = tokenUnit === 'K' ? '1K' : '1M'
  const tags = parseTags(props.model.tags)
  const endpoints = props.model.supported_endpoint_types || []
  const vendorIcon = props.model.vendor_icon
    ? getLobeIcon(props.model.vendor_icon, 28)
    : null
  const initial = props.model.model_name?.charAt(0).toUpperCase() || '?'
  const isDynamicPricing =
    props.model.billing_mode === 'tiered_expr' &&
    Boolean(props.model.billing_expr)
  const hasDiscount = hasModelDiscount(props.model)
  const discountMultiplier = getModelDiscountMultiplier(props.model)
  const discountLabel = getModelDiscountLabel(props.model, i18n.language)
  // Show every billing dimension that has been configured for the model.
  // input/output are always present; the rest appear only when their ratio is set.
  const tokenPriceEntries: {
    key: string
    label: string
    type: PriceType
    dim?: boolean
  }[] = isTokenBased
    ? [
        { key: 'input', label: t('Input'), type: 'input' },
        { key: 'output', label: t('Output'), type: 'output' },
        ...(props.model.cache_ratio != null
          ? [{ key: 'cache', label: t('Cached'), type: 'cache' as PriceType, dim: true }]
          : []),
        ...(props.model.create_cache_ratio != null
          ? [{ key: 'create_cache', label: t('Cache Write'), type: 'create_cache' as PriceType, dim: true }]
          : []),
        ...(props.model.image_ratio != null
          ? [{ key: 'image', label: t('Image'), type: 'image' as PriceType, dim: true }]
          : []),
        ...(props.model.audio_ratio != null
          ? [{ key: 'audio_input', label: t('Audio In'), type: 'audio_input' as PriceType, dim: true }]
          : []),
        ...(props.model.audio_ratio != null &&
        props.model.audio_completion_ratio != null
          ? [{ key: 'audio_output', label: t('Audio Out'), type: 'audio_output' as PriceType, dim: true }]
          : []),
      ]
    : []
  const dynamicPriceOptions = {
    tokenUnit,
    showRechargePrice,
    priceRate,
    usdExchangeRate,
    groupRatioMultiplier: getDynamicDisplayGroupRatio(props.model),
    discountMultiplier: 1,
  }
  const discountedDynamicPriceOptions = hasDiscount
    ? { ...dynamicPriceOptions, discountMultiplier }
    : dynamicPriceOptions
  const dynamicSummary = isDynamicPricing
    ? getDynamicPricingSummary(props.model, dynamicPriceOptions)
    : null
  const hasVideoTiers = Boolean(
    dynamicSummary && /tier\(\s*["'](?:480p|720p|1080p|4k)[ _-](?:video|text)/i.test(dynamicSummary.rawExpression) ||
    dynamicSummary?.tiers.some((tier) =>
      /(?:480p|720p|1080p|4k)[ _-]?(?:video|text|input|output)/i.test(
        tier.label || ''
      )
    )
  )
  const discountedDynamicSummary =
    hasDiscount && isDynamicPricing
      ? getDynamicPricingSummary(props.model, discountedDynamicPriceOptions)
      : null
  const peakValleyRows =
    dynamicSummary &&
    !dynamicSummary.isSpecialExpression &&
    !dynamicSummary.tiers.some((tier) =>
      /(?:480p|720p|1080p|4k)[ _-]?(?:video|text|input|output)/i.test(
        tier.label || ''
      )
    )
      ? getPeakValleyPriceRows(dynamicSummary, dynamicPriceOptions, t)
      : []
  const discountedPeakValleyRows =
    discountedDynamicSummary && !discountedDynamicSummary.isSpecialExpression
      ? getPeakValleyPriceRows(
          discountedDynamicSummary,
          discountedDynamicPriceOptions,
          t
        )
      : []

  const requestPrice = formatRequestPrice(
    props.model,
    showRechargePrice,
    priceRate,
    usdExchangeRate
  )
  const discountedRequestPrice = hasDiscount
    ? formatRequestPrice(
        props.model,
        showRechargePrice,
        priceRate,
        usdExchangeRate,
        discountMultiplier
      )
    : null

  const bottomTags = [...endpoints.slice(0, 2), ...tags.slice(0, 2)]
  const hiddenCount =
    Math.max(endpoints.length - 2, 0) +
    Math.max(tags.length - 2, 0)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    copyToClipboard(props.model.model_name || '')
  }

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-xl border border-border/40 p-3 transition-all duration-300 sm:p-5',
        'hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-md hover:scale-[1.01]'
      )}
    >
      {/* Header: icon + name + price + actions */}
      <div className='flex items-start justify-between gap-2.5 sm:gap-3'>
        <div className='flex min-w-0 items-start gap-2.5 sm:gap-3'>
          <div className='bg-muted/40 flex size-9 shrink-0 items-center justify-center rounded-lg sm:size-10 sm:rounded-xl'>
            {vendorIcon || (
              <span className='text-muted-foreground text-sm font-bold'>
                {initial}
              </span>
            )}
          </div>
          <div className='min-w-0'>
            <div className='flex min-w-0 items-center gap-1.5'>
              <h3 className='text-foreground min-w-0 shrink truncate font-mono text-[15px] leading-tight font-bold'>
                {props.model.model_name}
              </h3>
              {discountLabel && (
                <span className='inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'>
                  {discountLabel}
                </span>
              )}
            </div>
            <div className='mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs sm:mt-1 sm:gap-x-3'>
              {dynamicSummary ? (
                dynamicSummary.isSpecialExpression && !hasVideoTiers ? (
                  <span className='min-w-0'>
                    <span className='text-amber-700 dark:text-amber-300'>
                      {t('Special billing expression')}
                    </span>
                    <code className='text-muted-foreground/70 mt-0.5 line-clamp-1 block font-mono text-[11px] break-all'>
                      {dynamicSummary.rawExpression}
                    </code>
                  </span>
              ) : peakValleyRows.length > 0 ? (
                  <div className='w-full space-y-1'>
                    {peakValleyRows.map((row) => (
                      <div
                        key={row.key}
                        className='flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5'
                      >
                        <span className='text-foreground shrink-0 font-medium'>
                          {t(row.labelKey)}
                        </span>
                        <span className='text-muted-foreground/70 shrink-0'>
                          {row.timeLabel}
                        </span>
                        {row.entries.map((entry) => {
                          const discountedEntry = discountedPeakValleyRows
                            .find((item) => item.key === row.key)
                            ?.entries.find((item) => item.key === entry.key)

                          return (
                            <span
                              key={entry.key}
                              className='text-muted-foreground whitespace-nowrap'
                            >
                              {t(entry.shortLabel)}{' '}
                              <span className='text-foreground font-mono font-semibold'>
                                {discountedEntry ? (
                                  <>
                                    <span className='text-muted-foreground/50 line-through'>
                                      {entry.formatted}
                                    </span>
                                    <span className='ml-1'>
                                      {discountedEntry.formatted}
                                    </span>
                                  </>
                                ) : (
                                  entry.formatted
                                )}
                              </span>
                              /{tokenUnitLabel}
                            </span>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                ) : hasVideoTiers ? (
                  <div className='flex w-full flex-col gap-y-1'>
                    {dynamicSummary.tiers.map((tier) => {
                      const label = tier.label || ''
                      const price = Number(tier.output_unit_cost || tier.input_unit_cost)
                      if (!price || !label) return null
                      const displayLabel = label.replace(/_/g, ' ').replace(/\bvideo\b/i, '有视频').replace(/\btext\b/i, '无视频')
                      return <span key={label} className='text-muted-foreground whitespace-nowrap'><span className='text-foreground font-medium'>{displayLabel}</span>{' '}<span className='text-foreground font-mono font-semibold'>{formatBillingCurrencyFromUSD(price, dynamicPriceOptions)}</span>/{tokenUnitLabel}</span>
                    })}
                  </div>
                ) : dynamicSummary.entries.length > 0 ? (
                  <>
                    {dynamicSummary.entries.map((entry) => {
                      const discountedEntry = discountedDynamicSummary?.entries.find(
                        (item) => item.key === entry.key
                      )

                      return (
                        <span
                          key={entry.key}
                          className='text-muted-foreground whitespace-nowrap'
                        >
                          {t(entry.shortLabel)}{' '}
                          <span className='text-foreground font-mono font-semibold'>
                            {discountedEntry ? (
                              <>
                                <span className='text-muted-foreground/50 line-through'>
                                  {entry.formatted}
                                </span>
                                <span className='ml-1'>
                                  {discountedEntry.formatted}
                                </span>
                              </>
                            ) : (
                              entry.formatted
                            )}
                          </span>
                          /{tokenUnitLabel}
                        </span>
                      )
                    })}
                  </>
                ) : (
                  <span className='text-muted-foreground text-xs'>
                    {t('Dynamic Pricing')}
                  </span>
                )
              ) : isTokenBased ? (
                <>
                  {tokenPriceEntries.map((entry) => {
                    const originalPrice = formatPrice(
                      props.model,
                      entry.type,
                      tokenUnit,
                      showRechargePrice,
                      priceRate,
                      usdExchangeRate
                    )
                    const discountedPrice = hasDiscount
                      ? formatPrice(
                          props.model,
                          entry.type,
                          tokenUnit,
                          showRechargePrice,
                          priceRate,
                          usdExchangeRate,
                          discountMultiplier
                        )
                      : null

                    return (
                      <span
                        key={entry.key}
                        className={cn(
                          'whitespace-nowrap',
                          entry.dim
                            ? 'text-muted-foreground/60'
                            : 'text-muted-foreground'
                        )}
                      >
                        {entry.label}{' '}
                        <span
                          className={cn(
                            'font-mono',
                            entry.dim ? '' : 'text-foreground font-semibold'
                          )}
                        >
                          {discountedPrice ? (
                            <>
                              <span className='text-muted-foreground/50 line-through'>
                                {originalPrice}
                              </span>
                              <span className='ml-1'>{discountedPrice}</span>
                            </>
                          ) : (
                            originalPrice
                          )}
                        </span>
                        /{tokenUnitLabel}
                      </span>
                    )
                  })}
                </>
              ) : (
                <span className='text-muted-foreground whitespace-nowrap'>
                  <span className='text-foreground font-mono font-semibold'>
                    {discountedRequestPrice ? (
                      <>
                        <span className='text-muted-foreground/50 line-through'>
                          {requestPrice}
                        </span>
                        <span className='ml-1'>{discountedRequestPrice}</span>
                      </>
                    ) : (
                      requestPrice
                    )}
                  </span>{' '}
                  / {t('request')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className='flex shrink-0 items-center gap-1.5'>
          {props.isAdmin && (
            <button
              type='button'
              onClick={props.onClick}
              className='text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors sm:px-2.5 sm:py-1.5'
            >
              {t('Details')}
              <ChevronRight className='size-3.5' />
            </button>
          )}
          <button
            type='button'
            onClick={handleCopy}
            className='text-muted-foreground hover:text-foreground hover:bg-muted rounded-md border p-1.5 transition-colors'
            title={t('Copy')}
          >
            <Copy className='size-3.5' />
          </button>
        </div>
      </div>

      {/* Description */}
      <p className='text-muted-foreground mt-2 line-clamp-1 flex-1 text-[13px] leading-relaxed sm:mt-4 sm:line-clamp-2 sm:min-h-[2.5rem]'>
        {props.model.description || t('No description available.')}
      </p>

      {/* Footer: tags on the left, perf badge on the right */}
      <div className='mt-2 flex items-center justify-between gap-x-2 sm:mt-4'>
        <div className='flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 sm:gap-x-3 sm:gap-y-1'>
          {bottomTags.map((item) => (
            <span key={item} className='text-muted-foreground/70 text-xs'>
              {item}
            </span>
          ))}
          <span className='text-muted-foreground/50 text-xs'>
            {tokenUnitLabel}
          </span>
          {dynamicSummary && dynamicSummary.tierCount > 1 && (
            <span className='text-muted-foreground/50 text-xs'>
              {t('{{count}} tiers', { count: dynamicSummary.tierCount })}
            </span>
          )}
          {hiddenCount > 0 && (
            <span className='text-muted-foreground/40 text-xs'>
              +{hiddenCount}
            </span>
          )}
        </div>
        {props.isAdmin && <ModelPerfBadge perf={props.perf} />}
      </div>
    </div>
  )
})
