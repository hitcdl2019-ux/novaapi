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
      {"role": "user", "content": "Write a poem about AI"}
    ]
  }'`,
  node: `import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: "sk-YOUR_API_KEY",
  baseURL: "https://api.novaapis.com/v1"
});

const completion = await openai.chat.completions.create({
  model: "deepseek-v4-pro",
  messages: [
    {"role": "user", "content": "Write a poem about AI"}
  ]
});

console.log(completion.choices[0].message);`,
  python: `from openai import OpenAI

client = OpenAI(
    api_key="sk-YOUR_API_KEY",
    base_url="https://api.novaapis.com/v1"
)

completion = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=[
        {"role": "user", "content": "Write a poem about AI"}
    ]
)

print(completion.choices[0].message)`,
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
    <div className='mx-auto mt-16 w-full max-w-2xl text-left'>
      <div className='overflow-hidden rounded-xl border border-border/40 bg-[#0d1117] shadow-lg'>
        {/* Header bar */}
        <div className='flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5'>
          <div className='flex items-center gap-2'>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
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
            className='flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-white/40 transition-colors hover:text-white/80'
          >
            {copied ? (
              <Check className='size-3.5 text-emerald-400' />
            ) : (
              <Copy className='size-3.5' />
            )}
            {copied ? t('Copied') : t('Copy')}
          </button>
        </div>

        {/* Code area */}
        <div className='overflow-x-auto px-4 py-4'>
          <pre className='font-mono text-[13px] leading-relaxed text-[#c9d1d9] whitespace-pre'>
            <code>{SNIPPETS[activeTab]}</code>
          </pre>
        </div>
      </div>
    </div>
  )
}
