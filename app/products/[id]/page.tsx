'use client'

import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { useProductStore } from '@/stores/useProductStore'
import { ArrowLeft, Heart } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function ProductDetail() {
  const params = useParams()
  const router = useRouter()
  const { products, toggleLike } = useProductStore()
  const [product, setProduct] = useState<any>(null)

  useEffect(() => {
    const foundProduct = products.find(p => p.id === Number(params.id))
    setProduct(foundProduct)
  }, [params.id, products])

  if (!product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_rgba(2,6,23,0.96))]">
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 px-10 py-12 text-center text-white/70 backdrop-blur">
          <div className="text-2xl font-semibold text-white">Продукт не найден</div>
          <button
            onClick={() => router.push('/products')}
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/70 transition-colors hover:border-white/40 hover:text-white"
          >
            Вернуться в каталог
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_rgba(2,6,23,0.96))] pb-16 pt-12">
      <div className="mx-auto max-w-5xl px-6">
        <button
          onClick={() => router.push('/products')}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-white/60 transition-colors hover:text-white"
        >
          <ArrowLeft size={18} />
          Вернуться в каталог
        </button>

        <div className="overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-950/70 shadow-[0_45px_80px_-60px_rgba(8,47,73,0.95)] backdrop-blur">
          <div className="grid gap-10 p-10 md:grid-cols-[1.1fr_0.9fr]">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70">
               <Image
                src={product.url || product.thumbnailUrl}
                alt={product.title}
                width={960}
                height={960}
                className="h-full w-full object-cover"
                priority
              />
              <button
                onClick={() => toggleLike(product.id)}
                className={`absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 transition-colors ${
                  product.isLiked
                    ? 'bg-gradient-to-br from-rose-500 to-orange-400 text-white'
                    : 'bg-slate-900/70 text-white/70 hover:text-white'
                }`}
              >
                <Heart size={22} fill={product.isLiked ? 'currentColor' : 'none'} />
              </button>
            </div>

            <div className="flex flex-col gap-6">
              <div className="space-y-3">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-white/50">Карточка товара</span>
                <h1 className="text-4xl font-semibold text-white">{product.title}</h1>
              </div>

              {product.price && (
                <div className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-4xl font-bold text-transparent">
                  ${product.price}
                </div>
              )}

              {product.category && (
                <span className="inline-block rounded-full border border-cyan-400/40 bg-cyan-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
                  {product.category}
                </span>
              )}

              <div className="space-y-4 text-sm text-white/60">
                <p className="leading-relaxed">
                  {product.description || 'No description available for this product.'}
                </p>
                <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/50">
                  <div className="flex items-center justify-between">
                    <span>ID продукта</span>
                    <span className="text-white/80">{product.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Статус готовности</span>
                    <span className="text-emerald-300">Готов к продаже</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Поставщик</span>
                    <span className="text-white/70">Подтверждён маркетплейсом</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href={product.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-1"
                >
                  Открыть оригинал
                  <ArrowLeft className="h-4 w-4 rotate-180" />
                </a>
                <button className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/70 transition-colors hover:border-white/40 hover:text-white">
                  Поделиться карточкой
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}