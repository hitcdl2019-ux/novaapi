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
import { type SVGProps } from 'react'
import { cn } from '@/lib/utils'

export function Logo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      id='sinoapi-logo'
      viewBox='0 0 24 24'
      xmlns='http://www.w3.org/2000/svg'
      height='24'
      width='24'
      className={cn('size-6', className)}
      {...props}
    >
      <title>NovaAPI</title>
      <defs>
        <linearGradient id='sino-grad' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0%' stopColor='#DC2626' />
          <stop offset='100%' stopColor='#991B1B' />
        </linearGradient>
      </defs>
      <rect x='1' y='1' width='22' height='22' rx='5' fill='url(#sino-grad)' />
      <text
        x='12'
        y='17'
        textAnchor='middle'
        fill='white'
        fontSize='14'
        fontWeight='bold'
        fontFamily='system-ui, sans-serif'
      >
        S
      </text>
    </svg>
  )
}
