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
import { Zap, CreditCard, Code, Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'
import { cn } from '@/lib/utils'

interface FeaturesProps {
  className?: string
}

export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()

  const cards = [
    {
      id: 'unified-api',
      icon: <Zap className='size-6' strokeWidth={1.5} />,
      iconBg: 'bg-amber-50 dark:bg-amber-500/10',
      iconColor: 'text-amber-600 dark:text-amber-400',
      title: t('Unified API, Seamless Access to Global Top Compute'),
      desc: t('NovaAPI deeply integrates the world\'s leading open-source and closed-source AI models, covering cutting-edge deep reasoning, ultra-fast text generation, and multimodal capabilities. No complex configuration needed — just one integration and a single line of code change (fully OpenAI-compatible) to freely switch between top-tier models. Empower your app with multi-model synergy and say goodbye to platform lock-in forever.'),
    },
    {
      id: 'cost',
      icon: <CreditCard className='size-5' strokeWidth={1.5} />,
      iconBg: 'bg-emerald-50 dark:bg-emerald-500/10',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      title: t('Scale Effect Eliminates Middleman Markup'),
      desc: t('No more layered proxies or top-up barriers. Leveraging platform-scale request volume, we partner directly with model providers. NovaAPI ensures authentic, high-fidelity compute resources while passing drastically compressed costs directly to you — whether you\'re experimenting early or deploying at enterprise scale.'),
    },
    {
      id: 'cutting-edge',
      icon: <Code className='size-5' strokeWidth={1.5} />,
      iconBg: 'bg-violet-50 dark:bg-violet-500/10',
      iconColor: 'text-violet-600 dark:text-violet-400',
      title: t('Always One Step Ahead'),
      desc: t('In the era of explosive AI iteration, time is your greatest competitive edge. NovaAPI\'s agile integration architecture promises day-one support for newly released top-tier models. No long waits, no code rewrites — just seamless access to the latest AI technology, keeping your products on the cutting edge.'),
    },
    {
      id: 'security',
      icon: <Shield className='size-6' strokeWidth={1.5} />,
      iconBg: 'bg-sky-50 dark:bg-sky-500/10',
      iconColor: 'text-sky-600 dark:text-sky-400',
      title: t('Rock-Solid Security & Compliance'),
      desc: t('Your business data and core prompts are your most valuable assets. NovaAPI adheres to a "pure pipeline" principle: beyond the token consumption needed for billing, we never log, intercept, or store any conversation between you and the models. Physical-grade privacy isolation provides the strongest compliance safeguard for your global business.'),
    },
  ]

  return (
    <section className='bg-white dark:bg-background relative z-10 px-6 py-20 md:py-28'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-12 text-center'>
          <h2 className='text-3xl leading-tight font-bold tracking-tight md:text-4xl'>
            {t('Why Choose NovaAPI')}
          </h2>
        </AnimateInView>

        <div className='grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-7'>
          {cards.map((card, i) => (
            <AnimateInView
              key={card.id}
              delay={i * 80}
              animation='fade-up'
              className='group relative flex flex-col overflow-hidden rounded-2xl border border-border/30 bg-background p-7 transition-all duration-500 md:p-8 hover:-translate-y-1 hover:shadow-lg'
            >
              <div className={cn(
                'flex size-12 items-center justify-center rounded-xl mb-4 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md',
                card.iconBg, card.iconColor
              )}>
                {card.icon}
              </div>
              <h3 className='mb-3 text-lg font-bold'>{card.title}</h3>
              <p className='text-foreground/70 text-[15px] leading-relaxed'>
                {card.desc}
              </p>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
