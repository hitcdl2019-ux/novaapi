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
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useSystemConfig } from '@/hooks/use-system-config'

const NovaAPISVG = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    width='72'
    height='72'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' />
    <path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' />
  </svg>
)

export function Footer() {
  const { t } = useTranslation()
  const { systemName, logo: systemLogo, footerHtml } = useSystemConfig()

  const displayName = systemName || 'NovaAPI'
  const currentYear = new Date().getFullYear()

  // Custom HTML footer mode (backwards-compatible)
  if (footerHtml) {
    return (
      <footer className='border-border/40 relative z-10 border-t'>
        <div className='mx-auto w-full max-w-6xl px-6 py-5'>
          <div
            className='custom-footer text-muted-foreground text-center text-sm'
            dangerouslySetInnerHTML={{ __html: footerHtml }}
          />
        </div>
      </footer>
    )
  }

  return (
    <footer className='border-t border-border/40 bg-background mt-12 py-12'>
      <div className='mx-auto max-w-6xl px-6 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12'>

        {/* Left: Brand */}
        <div className='flex flex-col space-y-0'>
          <Link to='/' className='text-foreground hover:opacity-80 transition-opacity'>
            {systemLogo ? (
              <img src={systemLogo} alt={displayName} className='h-[4.5rem] w-auto' />
            ) : (
              <NovaAPISVG />
            )}
          </Link>
          <p className='text-sm text-muted-foreground leading-relaxed ml-4'>
            {t('大模型聚合平台')}
            <br />
            {t('一站式接入所有主流大模型')}
          </p>
        </div>

        {/* Middle: Nav */}
        <div className='flex flex-col space-y-4'>
          <h3 className='font-bold text-foreground text-sm tracking-widest pt-5'>
            {t('导航')}
          </h3>
          <nav className='flex flex-col space-y-3'>
            <Link
              to='/pricing'
              className='text-sm text-muted-foreground hover:text-primary transition-colors w-fit'
            >
              {t('模型中心')}
            </Link>
            <a
              href='https://docs.novaapis.com'
              target='_blank'
              rel='noreferrer'
              className='text-sm text-muted-foreground hover:text-primary transition-colors w-fit'
            >
              {t('文档中心')}
            </a>
          </nav>
        </div>

        {/* Right: Legal */}
        <div className='flex flex-col space-y-4'>
          <h3 className='font-bold text-foreground text-sm tracking-widest pt-5'>
            {t('法律')}
          </h3>
          <nav className='flex flex-col space-y-3'>
            <Link
              to='/user-agreement'
              className='text-sm text-muted-foreground hover:text-primary transition-colors w-fit'
            >
              {t('服务条款')}
            </Link>
            <Link
              to='/privacy-policy'
              className='text-sm text-muted-foreground hover:text-primary transition-colors w-fit'
            >
              {t('隐私政策')}
            </Link>
          </nav>
        </div>

      </div>

      {/* Bottom copyright */}
      <div className='mx-auto max-w-6xl px-6 mt-12 pt-8 border-t border-border/30 flex flex-col items-center text-xs text-muted-foreground/45'>
        <p>&copy; {currentYear} {displayName}. {t('All rights reserved.')}</p>
        <p className='mt-1'>{t('Built for Global Developers.')}</p>
      </div>
    </footer>
  )
}
