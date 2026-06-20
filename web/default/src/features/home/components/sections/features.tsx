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
import { Globe, CreditCard, Zap, Shield } from 'lucide-react'
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
      id: 'simple-access',
      icon: <Globe className='size-6' strokeWidth={1.5} />,
      iconBg: 'bg-indigo-50 dark:bg-indigo-500/10',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      title: t('一行代码，极简接入'),
      desc: t('100% 兼容 OpenAI 协议。无需重构代码或招聘算法专家，替换 URL 即可无缝切换全球顶级模型，今天配置，今天上线。'),
    },
    {
      id: 'cost',
      icon: <CreditCard className='size-5' strokeWidth={1.5} />,
      iconBg: 'bg-emerald-50 dark:bg-emerald-500/10',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      title: t('按量付费，极致控本'),
      desc: t('用多少付多少，无隐形门槛、无月租绑定。凭借原厂直采优势，为您提供远低于常规渠道的价格，让试错成本降至最低。'),
    },
    {
      id: 'smart-routing',
      icon: <Zap className='size-6' strokeWidth={1.5} />,
      iconBg: 'bg-amber-50 dark:bg-amber-500/10',
      iconColor: 'text-amber-600 dark:text-amber-400',
      title: t('智能路由，永不断网'),
      desc: t('独创多渠道灾备机制。当某个官方接口拥堵或宕机时，系统将在毫秒级无感切换至备用高速节点，无需您熬夜运维。'),
    },
    {
      id: 'privacy',
      icon: <Shield className='size-6' strokeWidth={1.5} />,
      iconBg: 'bg-sky-50 dark:bg-sky-500/10',
      iconColor: 'text-sky-600 dark:text-sky-400',
      title: t('纯粹管道，隐私无忧'),
      desc: t('坚持物理级隐私隔离。除计费外，绝不记录、不拦截、不存储任何对话与交互数据，用最高标准守护您的商业机密。'),
    },
  ]

  return (
    <section className='bg-white dark:bg-background relative z-10 px-6 py-16 md:py-24'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-10 text-center'>
          <h2 className='text-3xl leading-tight font-bold tracking-tight md:text-4xl'>
            {t('选择 NovaAPI 的理由')}
          </h2>
        </AnimateInView>

        <div className='grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6'>
          {cards.map((card, i) => (
            <AnimateInView
              key={card.id}
              delay={i * 80}
              animation='fade-up'
              className='group relative flex flex-col overflow-hidden rounded-2xl border border-border/30 bg-background p-6 transition-all duration-500 md:p-7 hover:-translate-y-1 hover:shadow-lg'
            >
              <div className={cn(
                'flex size-12 items-center justify-center rounded-xl mb-3 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md',
                card.iconBg, card.iconColor
              )}>
                {card.icon}
              </div>
              <h3 className='mb-2 text-lg font-bold'>{card.title}</h3>
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
