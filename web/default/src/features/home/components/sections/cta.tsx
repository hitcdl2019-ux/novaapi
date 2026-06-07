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
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { AnimateInView } from '@/components/animate-in-view'

interface CTAProps {
  className?: string
  isAuthenticated?: boolean
  docsLink?: string
}

export function CTA(props: CTAProps) {
  const { t } = useTranslation()

  if (props.isAuthenticated) {
    return null
  }

  const docsUrl = props.docsLink || 'https://docs.newapi.pro'

  return (
    <section className='relative z-10 overflow-hidden bg-slate-900 px-6 py-20 md:py-28'>
      {/* Central deep glow — universe-like depth */}
      <div
        aria-hidden
        className='pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
        style={{
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, oklch(0.55 0.22 280 / 30%) 0%, oklch(0.45 0.18 260 / 15%) 40%, transparent 70%)',
          filter: 'blur(80px)',
          borderRadius: '50%',
        }}
      />
      {/* Ambient glow orbs */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0'
        style={{
          background: [
            'radial-gradient(ellipse 60% 50% at 20% 30%, oklch(0.55 0.18 270 / 15%) 0%, transparent 60%)',
            'radial-gradient(ellipse 50% 40% at 80% 60%, oklch(0.65 0.15 280 / 12%) 0%, transparent 55%)',
            'radial-gradient(ellipse 40% 35% at 50% 80%, oklch(0.50 0.12 290 / 10%) 0%, transparent 55%)',
          ].join(', '),
        }}
      />
      {/* Subtle grid */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,oklch(1_0_0/4%)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/4%)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,black_10%,transparent_100%)]'
      />

      <AnimateInView
        className='relative mx-auto max-w-4xl text-center'
        animation='scale-in'
      >
        <h2 className='text-3xl leading-tight font-bold tracking-tight text-white md:text-[2.75rem]'>
          <span className='block whitespace-nowrap'>{t('Ready to Build with NovaAPI?')}</span>
          <span className='block whitespace-nowrap bg-gradient-to-r from-indigo-400 via-violet-300 to-purple-400 bg-clip-text text-transparent'>
            {t('One step to unlock the world\'s top AI power')}
          </span>
        </h2>
        <p className='mx-auto mt-6 max-w-lg text-base leading-relaxed text-slate-300 md:text-lg'>
          {t(
            'Sign up now to get your API key and instantly access 50+ flagship models — no complex setup, no platform lock-in.'
          )}
        </p>
        <div className='mt-10 flex items-center justify-center gap-4'>
          <Button
            className='group rounded-lg bg-indigo-500 text-white hover:bg-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.3)]'
            render={<Link to='/sign-up' />}
          >
            {t('Get API Key')}
            <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
          </Button>
          <Button
            variant='outline'
            className='rounded-lg border-white/20 bg-transparent text-white hover:border-white/50 hover:bg-white/5'
            onClick={() => window.open(docsUrl, '_blank')}
          >
            {t('View Docs')}
          </Button>
        </div>
      </AnimateInView>
    </section>
  )
}
