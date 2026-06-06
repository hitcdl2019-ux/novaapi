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
      id: 'network',
      span: 'md:col-span-2',
      icon: <Zap className='size-6' strokeWidth={1.5} />,
      iconBg: 'bg-amber-50 dark:bg-amber-500/10',
      iconColor: 'text-amber-600 dark:text-amber-400',
      title: t('Global Network, Lightning Fast'),
      desc: t('High-performance API gateway deployed overseas with dedicated lines to mainland China server clusters. Solves cross-border high latency and packet loss, ensuring smooth streaming output (Stream).'),
    },
    {
      id: 'payment',
      span: 'md:col-span-1',
      icon: <CreditCard className='size-5' strokeWidth={1.5} />,
      iconBg: 'bg-emerald-50 dark:bg-emerald-500/10',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      title: t('Zero-Barrier Payments'),
      desc: t('Full support for Stripe, PayPal and international credit cards. No Chinese mainland bank account or real-name verification (KYC) required.'),
    },
    {
      id: 'compatible',
      span: 'md:col-span-1',
      icon: <Code className='size-5' strokeWidth={1.5} />,
      iconBg: 'bg-violet-50 dark:bg-violet-500/10',
      iconColor: 'text-violet-600 dark:text-violet-400',
      title: t('OpenAI Compatible'),
      desc: t('No need to restructure your code. Seamlessly migrate your existing AI applications and workflows. One line change to switch.'),
    },
    {
      id: 'security',
      span: 'md:col-span-2',
      icon: <Shield className='size-6' strokeWidth={1.5} />,
      iconBg: 'bg-sky-50 dark:bg-sky-500/10',
      iconColor: 'text-sky-600 dark:text-sky-400',
      title: t('Security & Privacy Compliance'),
      desc: t('We do not store any conversation or request data. Enterprise-grade high availability (SLA) with dynamic load balancing. Dedicated nodes available for enterprise clients.'),
    },
  ]

  return (
    <section className='bg-white dark:bg-background relative z-10 px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-16 text-center'>
          <h2 className='text-2xl leading-tight font-bold tracking-tight md:text-3xl'>
            {t('An Industrial-Grade Gateway for Global Developers')}
          </h2>
        </AnimateInView>

        <div className='grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5'>
          {cards.map((card, i) => (
            <AnimateInView
              key={card.id}
              delay={i * 80}
              animation='fade-up'
              className={cn(
                'group relative flex flex-col overflow-hidden rounded-2xl border border-border/30 bg-background p-6 transition-all duration-500 md:p-7 hover:-translate-y-1 hover:shadow-lg',
                card.span
              )}
            >
              <div className={cn(
                'flex size-12 items-center justify-center rounded-xl mb-4 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md',
                card.iconBg, card.iconColor
              )}>
                {card.icon}
              </div>
              <h3 className='mb-2 text-base font-bold'>{card.title}</h3>
              <p className='text-foreground/65 text-sm leading-relaxed'>
                {card.desc}
              </p>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
