'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ProductList from '@/components/ProductList'
import { useProductStore } from '@/stores/useProductStore'

export default function FavoritesPage() {
  const products = useProductStore((state) => state.products)
  const favorites = useProductStore((state) => state.favorites)
  const initializeProducts = useProductStore((state) => state.initializeProducts)
  const [isLoading, setIsLoading] = useState(products.length === 0)

  useEffect(() => {
    if (products.length === 0) {
      setIsLoading(true)
      fetch('https://jsonplaceholder.typicode.com/photos?_limit=50')
        .then((res) => res.json())
        .then((data) => {
          initializeProducts(data)
          setIsLoading(false)
        })
        .catch(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [products.length, initializeProducts])

  const hasFavorites = favorites && favorites.length > 0

  return (
    <div className="flex-1 bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.12),_rgba(2,6,23,0.95))] pb-20">
      <div className="relative mx-auto max-w-6xl px-6 pt-16">
        <div className="mb-10 flex flex-col gap-6 rounded-3xl border border-white/10 bg-slate-900/70 p-8 backdrop-blur xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-rose-200/70">Избранное</p>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">Ваши товары, отмеченные сердцем</h1>
            <p className="text-sm text-slate-300">
              Здесь собираются товары, которые вы пометили лайком. Управляйте лучшими предложениями и возвращайтесь к ним, когда будете готовы вывести на витрину.
            </p>
          </div>
          <Link
            href="/products"
            className="inline-flex items-center justify-center gap-3 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 transition-transform transition-colors hover:border-white/40 hover:text-white"
          >
            Вернуться в каталог
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="M12 5l-7 7 7 7" />
            </svg>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-3xl border border-white/10 bg-slate-900/60 p-6">
                <div className="mb-4 h-40 rounded-2xl bg-slate-700/60" />
                <div className="mb-2 h-4 rounded-full bg-slate-700/60" />
                <div className="h-4 w-2/3 rounded-full bg-slate-700/60" />
              </div>
            ))}
          </div>
        ) : hasFavorites ? (
          <ProductList products={favorites} />
        ) : (
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-12 text-center text-white/70 backdrop-blur">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-rose-500/30 to-orange-400/30 text-rose-200">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white">Список избранного пуст</h2>
            <p className="mt-3 text-sm text-white/60">Добавляйте товары в избранное с помощью кнопки сердечка — и они появятся здесь для быстрого доступа.</p>
          </div>
        )}
      </div>
    </div>
  )
}

