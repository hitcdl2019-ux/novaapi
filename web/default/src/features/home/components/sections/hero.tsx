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
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { AnimateInView } from '@/components/animate-in-view'
import { HeroTerminalDemo } from '../hero-terminal-demo'

interface Provider {
  name: string
  logo: string
}

function ProviderLogo({ provider }: { provider: Provider }) {
  const [hasError, setHasError] = useState(false)
  if (hasError) {
    return (
      <div className='flex size-16 items-center justify-center rounded-2xl backdrop-blur-md bg-white/40 shadow-sm border border-white/30'>
        <span className='text-muted-foreground text-lg font-bold'>
          {provider.name.charAt(0)}
        </span>
      </div>
    )
  }
  return (
    <div className='flex size-16 items-center justify-center rounded-2xl backdrop-blur-md bg-white/40 shadow-sm border border-white/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:scale-110'>
      <img
        src={provider.logo}
        alt={provider.name}
        className='size-8 object-contain transition-all duration-300'
        onError={() => setHasError(true)}
      />
    </div>
  )
}

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
  docsLink?: string
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 flex flex-col items-center overflow-hidden px-6 pt-36 pb-20 md:pt-44 md:pb-28 dark:bg-[#0a0a0f]'>
      {/* Light mode gradient — pastel aurora */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10 dark:hidden'
        style={{
          background: [
            'radial-gradient(ellipse 70% 60% at 85% 10%, oklch(0.85 0.08 55 / 70%) 0%, transparent 60%)',
            'radial-gradient(ellipse 65% 55% at 15% 5%, oklch(0.78 0.10 290 / 65%) 0%, transparent 55%)',
            'radial-gradient(ellipse 55% 50% at 70% 40%, oklch(0.82 0.07 210 / 60%) 0%, transparent 60%)',
            'radial-gradient(ellipse 50% 40% at 20% 85%, oklch(0.83 0.09 35 / 50%) 0%, transparent 60%)',
            'radial-gradient(ellipse 45% 35% at 80% 90%, oklch(0.72 0.12 275 / 45%) 0%, transparent 60%)',
            'linear-gradient(180deg, oklch(0.97 0.01 270 / 100%) 0%, oklch(0.94 0.03 260 / 100%) 50%, oklch(0.92 0.04 250 / 100%) 100%)',
          ].join(', '),
          filter: 'blur(0.5px)',
        }}
      />
      {/* Dark mode gradient */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10 hidden dark:block'
        style={{
          background: [
            'radial-gradient(ellipse 70% 50% at 80% 10%, oklch(0.35 0.08 280 / 30%) 0%, transparent 55%)',
            'radial-gradient(ellipse 60% 45% at 15% 15%, oklch(0.25 0.06 260 / 25%) 0%, transparent 50%)',
            'radial-gradient(ellipse 50% 40% at 60% 50%, oklch(0.30 0.05 240 / 20%) 0%, transparent 55%)',
            'radial-gradient(ellipse 40% 35% at 30% 80%, oklch(0.28 0.07 290 / 20%) 0%, transparent 55%)',
            'linear-gradient(180deg, oklch(0.12 0.02 270) 0%, oklch(0.08 0.01 260) 100%)',
          ].join(', '),
          filter: 'blur(0.5px)',
        }}
      />
      {/* Grid pattern */}
      <div
        aria-hidden
        className='absolute inset-0 -z-10 bg-[linear-gradient(to_right,oklch(0.4_0.05_270/6%)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.4_0.05_270/6%)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,oklch(0.6_0.05_270/8%)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.6_0.05_270/8%)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_30%,black_15%,transparent_100%)] bg-[size:3rem_3rem]'
      />

      <div className='flex max-w-6xl flex-col items-center text-center'>
        {/* Pill badge */}
        <div
          className='landing-animate-fade-up mb-6 inline-flex items-center gap-1.5 rounded-full border border-indigo-300/40 bg-indigo-50/60 px-4 py-1.5 text-xs font-medium text-indigo-700 shadow-[0_0_12px_rgba(99,102,241,0.15)] backdrop-blur-sm opacity-0 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-300'
          style={{ animationDelay: '0ms' }}
        >
          <span>🚀</span>
          <span>{t('Latest: DeepSeek-V4-Pro now available at full capacity')}</span>
          <span className='ml-0.5 text-indigo-400'>→</span>
        </div>
        {/* Main title */}
        <h1
          className='landing-animate-fade-up text-[clamp(2.25rem,6vw,4rem)] leading-[1.1] font-bold tracking-tight'
          style={{ animationDelay: '80ms' }}
        >
          <span className='whitespace-nowrap'>{t('Aggregating the World\'s Top AI Models')}</span>
          <br />
          <span className='bg-gradient-to-r from-indigo-500 via-violet-400 to-purple-500 bg-clip-text text-transparent'>
            {t('One API, Total Control')}
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className='landing-animate-fade-up text-muted-foreground/80 mt-6 max-w-3xl text-lg leading-relaxed opacity-0 md:text-xl text-center'
          style={{ animationDelay: '80ms' }}
        >
          {t('Enterprise-grade global AI model API relay. One token, unlimited models — empowering research innovation and business growth!')}
        </p>

        {/* Buttons */}
        <div
          className='landing-animate-fade-up mt-8 flex items-center gap-3 opacity-0'
          style={{ animationDelay: '160ms' }}
        >
          {props.isAuthenticated ? (
            <Button
              className='group rounded-lg'
              render={<Link to='/dashboard' />}
            >
              {t('Go to Dashboard')}
              <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
            </Button>
          ) : (
            <>
              <Button
                className='group rounded-lg'
                render={<Link to='/sign-up' />}
              >
                {t('Get API Key')}
                <ArrowRight className='ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5' />
              </Button>
              <Button
                variant='outline'
                className='border-border/50 hover:border-border hover:bg-muted/50 rounded-lg'
                onClick={() => window.open(props.docsLink || 'https://docs.newapi.pro', '_blank')}
              >
                {t('View Docs')}
              </Button>
            </>
          )}
        </div>

        {/* Terminal code demo moved here */}
        <HeroTerminalDemo />
      </div>

      {/* Supported AI Model Providers — infinite scroll marquee */}
      <div className='mx-auto mt-20 w-full max-w-6xl'>
        <AnimateInView className='mb-10 text-center'>
          <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
            {t('Supported AI Model Providers')}
          </p>
        </AnimateInView>

        <div className='relative overflow-hidden group/marquee'
          style={{
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
            maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
          }}
        >

          {/* Scrolling row — duplicates for seamless loop */}
          <div className='flex animate-marquee gap-12 w-max'>
            {(() => {
              const providers: Provider[] = [
                { name: 'OpenAI', logo: '/logos/openai.svg' },
                { name: 'Claude', logo: '/logos/claude.svg' },
                { name: 'Gemini', logo: '/logos/gemini.svg' },
                { name: 'Grok', logo: '/logos/grok.svg' },
                { name: 'DeepSeek', logo: '/logos/deepseek.svg' },
                { name: 'Qwen', logo: '/logos/qwen.svg' },
                { name: 'Kimi', logo: '/logos/kimi.svg' },
                { name: 'Zhipu GLM', logo: '/logos/zhipu.svg' },
                { name: 'MiniMax', logo: '/logos/minimax.svg' },
                { name: 'Doubao', logo: '/logos/doubao.svg' },
                { name: 'Mistral', logo: '/logos/mistral.svg' },
                { name: 'Llama', logo: '/logos/llama.svg' },
              ]
              const row = (offset: number) =>
                providers.map((p, i) => (
                  <div
                    key={`${offset}-${p.name}`}
                    className='logo-item flex flex-col items-center gap-3'
                    style={{ animationDelay: `${(offset * providers.length + i) * 80}ms` }}
                  >
                    <ProviderLogo provider={p} />
                    <span className='text-muted-foreground text-sm font-medium whitespace-nowrap'>
                      {p.name}
                    </span>
                  </div>
                ))
              return (
                <>
                  {row(0)}
                  {row(1)}
                  {row(2)}
                </>
              )
            })()}
          </div>
        </div>
      </div>
    </section>
  )
}
