import Link from 'next/link'
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'


const highlights = [
  {
    title: '24/7 Проверка продавцов',
    description: 'Каждый магазин проходит юридический и маркетинговый аудит перед запуском.',
  },
  {
    title: 'Смарт-аналитика продаж',
    description: 'AI-дашборды прогнозируют спрос и подсказывают вам товары для витрины.',
  },
  {
    title: 'Омниканальные покупки',
    description: 'Один клик — и товар уже в доставке. Поддержка курьеров, ПВЗ и самовывоза.',
  },
]

const categories = [
  { title: 'Tech & Gadgets', count: '3.1k товаров', accent: 'from-cyan-400/40 via-blue-500/20 to-transparent' },
  { title: 'Fashion & Lifestyle', count: '1.8k товаров', accent: 'from-fuchsia-400/40 via-purple-500/20 to-transparent' },
  { title: 'Home Comfort', count: '2.4k товаров', accent: 'from-amber-400/40 via-orange-500/20 to-transparent' },
]

export default function Home() {
  return (
    <div className="relative flex-1">
      <div className="absolute inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_rgba(15,23,42,0.9))]" />

      <section className="mx-auto max-w-6xl px-6 pb-24 pt-16 md:pt-24">
        <div className="grid items-center gap-12 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/70 backdrop-blur">
              <Sparkles className="h-4 w-4 text-cyan-300" />
              <span>Маркетплейс нового закона спроса</span>
            </div>

            <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
              Создавайте витрины и управляйте продажами в одной экосистеме
            </h1>

            <p className="text-lg text-slate-300 md:text-xl">
              Marketplace Vision объединяет бренды, логистику и аналитику, чтобы ваши товары быстрее попадали к покупателям. Создавайте офферы, запускайте кампании и отслеживайте результат в реальном времени.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/products"
                className="group inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 px-8 py-3 text-base font-semibold text-slate-950 shadow-[0_20px_45px_-25px_rgba(56,189,248,0.8)] transition-all hover:translate-y-[-2px]"
              >
                Перейти в каталог
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/create-product"
                className="inline-flex items-center justify-center gap-3 rounded-full border border-white/20 px-8 py-3 text-base font-semibold text-white/80 transition-colors hover:border-white/40 hover:text-white"
              >
                Вывести товар на рынок
              </Link>
            </div>

            <div className="grid gap-6 rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-cyan-500/10 backdrop-blur">
              <div className="grid gap-6 sm:grid-cols-3">
                {highlights.map((feature) => (
                  <div key={feature.title} className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200/80">
                      <CheckCircle2 className="h-4 w-4" />
                      {feature.title}
                    </div>
                    <p className="text-sm text-slate-300/80">{feature.description}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-6 text-xs text-white/50">
                <span>Совместимо с Wildberries, Ozon, Rozetka</span>
                <span className="h-1 w-1 rounded-full bg-white/30" />
                <span>Юридическое сопровождение и маркетинговые кампании</span>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 -z-10 animate-pulse rounded-[2.5rem] bg-gradient-to-br from-sky-500/30 via-indigo-500/20 to-transparent blur-3xl" />
            <div className="rounded-[2.5rem] border border-white/10 bg-slate-900/70 p-8 backdrop-blur-xl">
              <div className="grid gap-6">
                {categories.map((item) => (
                  <div
                    
                    key={item.title}
                    className="group relative overflow-hidden rounded-3xl border border-white/25 bg-slate-950/90 p-6 text-white shadow-[0_20px_35px_-25px_rgba(14,165,233,0.55)] transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.03] hover:border-cyan-300/70 hover:bg-slate-900/95 hover:shadow-[0_30px_45px_-20px_rgba(56,189,248,0.65)]"
                  >
                    <div
                      className={`absolute inset-y-[-40%] right-[-30%] w-3/4 skew-x-[-10deg] bg-gradient-to-l opacity-50 transition-opacity duration-300 group-hover:opacity-80 ${item.accent}`}
                    />
                    <div className="relative">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.32em] text-cyan-100/70 transition-colors duration-300 group-hover:text-cyan-100">
                        Категория
                        <span className="h-1 w-1 rounded-full bg-cyan-200/80" />
                      </span>
                      <h3 className="mt-3 text-2xl font-semibold text-white transition-colors duration-300 group-hover:text-white">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm font-medium text-slate-100/90 transition-colors duration-300 group-hover:text-white">
                        {item.count}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-3xl border border-cyan-400/40 bg-gradient-to-br from-cyan-500/15 via-blue-500/10 to-transparent p-6 text-sm text-slate-200">
                <p className="font-semibold text-cyan-200/95">Маркетинговый акселератор</p>
                <p className="mt-2 text-slate-200/95">
                  Выгружайте карточки на маркетплейсы, запускайте рекламу и синхронизируйте остатки. Мы гарантируем соответствие требованиям закона «О маркетплейсах».
                </p>
                <div className="mt-4 inline-flex items-center gap-2 text-cyan-200/90">
                  Узнать условия
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <span className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200/70">Метрики роста</span>
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">Динамика маркетплейса в реальном времени</h2>
            <p className="text-base text-slate-300/90">
              Покупатели доверяют витринам с прозрачной аналитикой. Демонстрируйте продажи, рейтинг, скорость доставки и повышайте позиции в выдаче.
            </p>
          </div>

          <div className="grid w-full gap-4 sm:grid-cols-2 lg:max-w-xl">
            {[{ value: '98%', label: 'Покупателей возвращаются' }, { value: '12 мин', label: 'Среднее время до первой продажи' }, { value: '6 стран', label: 'Легальная доставка без границ' }, { value: '4.9/5', label: 'Средний рейтинг продавцов' }].map((metric) => (
              <div
                   key={metric.label}
                className="group rounded-3xl border border-white/25 bg-slate-950/85 p-6 text-center text-white shadow-[0_20px_30px_-25px_rgba(14,165,233,0.6)] transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.03] hover:border-cyan-300/70 hover:bg-slate-900/95 hover:shadow-[0_32px_50px_-20px_rgba(56,189,248,0.55)]"
              >
                <div className="text-3xl font-semibold tracking-tight text-white transition-transform duration-300 group-hover:scale-[1.05]">
                  {metric.value}
                </div>
                <p className="mt-2 text-sm font-medium text-slate-100/90 transition-colors duration-300 group-hover:text-white">
                  {metric.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}