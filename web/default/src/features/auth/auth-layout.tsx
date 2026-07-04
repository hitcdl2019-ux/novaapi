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
import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSystemConfig } from '@/hooks/use-system-config'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { ThemeSwitch } from '@/components/theme-switch'
import { LanguageSwitcher } from '@/components/language-switcher'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation()
  const { systemName, logo, loading } = useSystemConfig()

  const features = [
    t('Access 40+ providers through one endpoint'),
    t('Unified billing and usage analytics'),
    t('Enterprise-grade stability and rate limiting'),
  ]

  return (
    <div className='grid h-svh lg:grid-cols-[1fr_2fr]'>
      {/* Brand panel — desktop only */}
      <div className='bg-primary text-primary-foreground relative hidden flex-col justify-center overflow-hidden p-10 lg:flex'>
        <div className='pointer-events-none absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/25' />
        <div className='pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl' />
        <div className='pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-black/20 blur-3xl' />
        <div className='relative z-10 space-y-6'>
          <div className='space-y-3'>
            <h1 className='text-3xl font-semibold tracking-tight'>
              {systemName}
            </h1>
            <p className='text-primary-foreground/80 max-w-sm text-base leading-relaxed'>
              {t('One unified API for 40+ AI providers.')}
            </p>
          </div>
          <ul className='space-y-3'>
            {features.map((feature) => (
              <li
                key={feature}
                className='text-primary-foreground/90 flex items-start gap-3 text-sm'
              >
                <span className='bg-primary-foreground/15 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full'>
                  <Check className='h-3 w-3' />
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Form panel */}
      <div className='relative flex items-center justify-center px-4 py-10 sm:px-8'>
        <Link
          to='/'
          className='absolute top-6 left-6 z-10 flex items-center transition-opacity hover:opacity-80'
        >
          {loading ? (
            <Skeleton className='h-20 w-40 rounded-lg' />
          ) : (
            <img
              src={logo}
              alt={t('Logo')}
              className='h-20 w-auto object-contain'
            />
          )}
        </Link>
        <div className='absolute top-6 right-6 z-10 flex items-center gap-1'>
          <LanguageSwitcher />
          <ThemeSwitch />
        </div>
        <div className='w-full max-w-md pt-16 lg:pt-0'>
          <Card className='gap-6 p-6 sm:p-8'>{children}</Card>
        </div>
      </div>
    </div>
  )
}
