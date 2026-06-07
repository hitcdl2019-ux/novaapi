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
import { Settings, Zap, BarChart3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'

export function HowItWorks() {
  const { t } = useTranslation()

  const steps = [
    {
      num: '1',
      title: t('Register Account'),
      desc: t('Sign up for free to get trial credits'),
      icon: <Settings className='size-6' strokeWidth={1.5} />,
    },
    {
      num: '2',
      title: t('Get API Key'),
      desc: t('Generate your API key in the dashboard'),
      icon: <Zap className='size-6' strokeWidth={1.5} />,
    },
    {
      num: '3',
      title: t('Start Calling'),
      desc: t('Just change the API address to start using'),
      icon: <BarChart3 className='size-6' strokeWidth={1.5} />,
    },
  ]

  return (
    <section className='bg-indigo-50 dark:bg-indigo-950/20 relative z-10 px-6 py-20 md:py-28'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-12 text-center'>
          <h2 className='text-3xl font-bold tracking-tight md:text-4xl'>
            {t('Three steps to get started')}
          </h2>
          <p className='text-muted-foreground mt-4 text-base md:text-lg'>
            {t('Just change the API address and key to get started')}
          </p>
        </AnimateInView>

        {/* Steps with connecting line */}
        <div className='relative mx-auto max-w-3xl'>
          {/* Connecting dashed line — spans between step icons */}
          <div
            aria-hidden
            className='absolute left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] top-[2rem] hidden md:block'
          >
            <div className='relative h-[2px]'>
              {/* Gray dashed background line */}
              <div className='absolute inset-0 border-t-2 border-dashed border-gray-300 dark:border-gray-600' />
              {/* Animated glowing progress line — grows from left to right */}
              <div
                className='absolute inset-0 origin-left border-t-2 border-indigo-500 dark:border-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.5)]'
                style={{
                  animation: 'step-line-grow 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                }}
              />
              {/* Traveling light pulse on the dashed line */}
              <div
                className='absolute top-1/2 -translate-y-1/2 h-3 w-16 rounded-full bg-gradient-to-r from-transparent via-indigo-400 to-transparent opacity-80 blur-[2px]'
                style={{
                  animation: 'step-light-travel 3s ease-in-out 1.5s infinite',
                }}
              />
            </div>
          </div>

          <div className='grid gap-8 md:grid-cols-3 md:gap-12'>
            {steps.map((step, i) => (
              <AnimateInView
                key={step.num}
                delay={i * 150}
                animation='fade-up'
                className='relative flex flex-col items-center text-center'
              >
                <div className='relative mb-6 z-10'>
                  <div className='flex size-14 items-center justify-center rounded-2xl border border-indigo-200 dark:border-indigo-700/50 bg-white dark:bg-indigo-950/50 shadow-sm transition-shadow duration-300 hover:shadow-md'>
                    <div className='text-indigo-500 dark:text-indigo-400'>
                      {step.icon}
                    </div>
                  </div>
                  <div className='absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold shadow-sm'>
                    {step.num}
                  </div>
                </div>
                <h3 className='mb-2 text-lg font-bold'>{step.title}</h3>
                <p className='text-muted-foreground max-w-[240px] text-[15px] leading-relaxed'>
                  {step.desc}
                </p>
              </AnimateInView>
            ))}
          </div>
        </div>

        {/* Inject keyframe animations */}
        <style>{`
          @keyframes step-line-grow {
            from { transform: scaleX(0); }
            to { transform: scaleX(1); }
          }
          @keyframes step-light-travel {
            0% { left: -4rem; opacity: 0; }
            10% { opacity: 0.8; }
            90% { opacity: 0.8; }
            100% { left: calc(100% + 4rem); opacity: 0; }
          }
        `}</style>
      </div>
    </section>
  )
}
