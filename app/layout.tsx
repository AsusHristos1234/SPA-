import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

import Header from '../components/layout/Header'

export const metadata: Metadata = {
  title: 'Product Catalog App',
  description: 'A modern product catalog with favorites and filtering',
}

type RootLayoutProps = {
  children: React.ReactNode
}

type FooterColumn = {
  title: string
  links?: { label: string; href: string }[]
  details?: string[]
}

const footerColumns: FooterColumn[] = [
  {
    title: 'О школе',
    links: [
      { label: 'О процессе обучения', href: '#' },
      { label: 'Дговор и соглашения', href: '#' },
      { label: 'Отзывы студентов', href: '#' },
      { label: 'Сертификаты и партнёры', href: '#' },
    ],
  },
  {
    title: 'Курсы',
    links: [
      { label: 'UI/UX Web-дизайн', href: '#' },
      { label: 'Front-End', href: '#' },
      { label: 'Дизайн интерьера', href: '#' },
      { label: 'Видеомонтаж & MOTION design', href: '#' },
      { label: 'Графический дизайн', href: '#' },
    ],
  },
  {
    title: 'Время работы',
    details: [
      'Пн – Пт: с 09:00 до 18:00 (GMT +3)',
      'Сб – Вс: консультации по заявке',
    ],
  },
  {
    title: 'Контакты'  ,
    details: [
      'Viber: +8 (888)-888-88-88',
      'WhatsApp & Telegram: +8 (888)-888-88-88',
      'Тел.: +8 (888)-888-88-88'
    ],
  },
]

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ru" className="scroll-smooth">
      <body
        id="top"
        className="relative flex min-h-screen flex-col bg-slate-950 text-slate-100 antialiased"
      >
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-x-0 top-[-10%] h-[500px] bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.25),_rgba(15,23,42,0.75))]" />
          <div className="absolute bottom-[-20%] left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-gradient-to-br from-purple-500/20 via-blue-500/10 to-transparent blur-3xl" />
        </div>

        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
function Footer() {
  return (
    <footer className="bg-[#050505] text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-16 lg:flex-row lg:items-start">
        <Link
          href="https://www.canva.com/ru_ru/obuchenie/shapka-sajta/"
          className="inllne-flex select-none items-center justify-center rounded-full border border-[#f7931e] bg-[#f7931e] px-10 py-3 text-xs font-semibold uppercase tracking-[0.5em] text-black transition-colors hover:bg-transparent hover:text-[#f7931e] lg:hidden"
        >
          Оставить заявку
        </Link>

        

        <div className="flex flex-1 flex-col gap-12 lg:flex-row lg:gap-16">
          <div className="space-y-4">
          
            <p className="max-w-xs text-sm text-white/70">
              Современная школа дизайна и медиа, где практикующие наставники помогают создавать проекты с первого занятия.
            </p>
          </div>

          <div className="grid flex-1 gap-10 text-sm text-white/70 sm:grid-cols-2 lg:grid-cols-4">
            {footerColumns.map((column) => (
              <div key={column.title} className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-[#f7931e]">
                  {column.title}
                </h3>

                {column.links ? (
                  <ul className="space-y-3">
                    {column.links.map(({ href, label }) => (
                      <li key={label}>
                        <a
                          href={href}
                          className="transition-colors hover:text-white"
                        >
                          {label}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {column.details ? (
                  <ul className="space-y-3">
                    {column.details.map((line) => (
                      <li key={line} className="text-white/80">
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>©2013–2025 | Все права защищены.</p>
          <p>Разработка и продвижение</p>
        </div>
      </div>
    </footer>
  )
}