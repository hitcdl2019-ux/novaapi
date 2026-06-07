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
import { Check, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const SNIPPETS = {
  curl: `curl https://api.novaapis.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-YOUR_API_KEY" \\
  -d '{
    "model": "deepseek-v4-pro",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'`,
  node: `import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: "sk-YOUR_API_KEY",
  baseURL: "https://api.novaapis.com/v1"
});

const completion = await openai.chat.completions.create({
  model: "deepseek-v4-pro",
  messages: [{"role": "user", "content": "Hello"}]
});`,
  python: `from openai import OpenAI

client = OpenAI(
    api_key="sk-YOUR_API_KEY",
    base_url="https://api.novaapis.com/v1"
)

completion = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=[{"role": "user", "content": "Hello"}]
)`,
}

type Tab = keyof typeof SNIPPETS

const TABS: { id: Tab; label: string }[] = [
  { id: 'curl', label: 'cURL' },
  { id: 'node', label: 'Node.js' },
  { id: 'python', label: 'Python' },
]

export function HeroTerminalDemo() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('curl')
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(SNIPPETS[activeTab])
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className='mx-auto mt-16 w-full max-w-5xl text-left'>
      <div className='relative'>
        {/* Ambient glow — subtle, confined */}
        <div
          aria-hidden
          className='pointer-events-none absolute -inset-0.5 rounded-2xl opacity-15 blur-xl'
          style={{
            background: 'linear-gradient(to right, #6366f1, #8b5cf6, #a855f7)',
          }}
        />

        {/* Terminal frame */}
        <div className='relative overflow-hidden rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl'>
          {/* Header bar */}
          <div className='flex items-center justify-between border-b border-white/[0.06] px-5 py-2'>
            <div className='flex items-center gap-2'>
              {/* Traffic lights */}
              <div className='flex items-center gap-1.5 mr-3'>
                <div className='size-2.5 rounded-full bg-[#ff5f57]' />
                <div className='size-2.5 rounded-full bg-[#febc2e]' />
                <div className='size-2.5 rounded-full bg-[#28c840]' />
              </div>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                    activeTab === tab.id
                      ? 'bg-white/10 text-white'
                      : 'text-white/40 hover:text-white/70'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleCopy}
              className='flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-white/40 transition-colors hover:text-white/80'
            >
              {copied ? (
                <Check className='size-3 text-emerald-400' />
              ) : (
                <Copy className='size-3' />
              )}
              {copied ? t('Copied') : t('Copy')}
            </button>
          </div>

          {/* Code area */}
          <div className='overflow-hidden border-b border-white/[0.06] px-5 py-4'>
            <div className='mb-2 flex items-center gap-2'>
              <span className='inline-flex items-center rounded bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-indigo-300'>
                Request
              </span>
              <span className='text-white/25 text-[9px]'>{activeTab.toUpperCase()}</span>
            </div>
            <pre className='font-mono text-[11px] leading-snug text-[#c9d1d9] whitespace-pre-wrap break-all'>
              <code>{SNIPPETS[activeTab]}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
