'use client'

import { useRouter } from 'next/navigation'
import { useProductStore } from '@/stores/useProductStore'
import { Heart, Trash2, Edit, Star } from 'lucide-react'
import { Product } from '@/types/product'
import { useState } from 'react'

interface ProductCardProps {
  product: Product
}

export default function ProductCard({ product }: ProductCardProps) {
  const router = useRouter()
  const { toggleLike, deleteProduct } = useProductStore()
    
  const [imageLoaded, setImageLoaded] = useState(false)

  const handleCardClick = () => {
    router.push(`/products/${product.id}`)
  }

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleLike(product.id)
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(`/products/${product.id}`)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this product?')) {
      deleteProduct(product.id)
    }
  }

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      electronics: 'border border-cyan-400/40 bg-cyan-500/10 text-cyan-200',
      clothing: 'border border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-200',
      books: 'border border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
      home: 'border border-amber-400/40 bg-amber-500/10 text-amber-200'
    }
    return colors[category] || 'border border-white/20 bg-white/5 text-white/60'
  }

  return (
    <div
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 backdrop-blur transition-all duration-300 hover:-translate-y-2 hover:border-cyan-400/40 hover:shadow-[0_35px_60px_-30px_rgba(59,130,246,0.6)]"
      onClick={handleCardClick}
    >
      <div className="relative flex-1">
        <div className="relative h-56 overflow-hidden">
          {!imageLoaded && (
            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-800 to-slate-700" />
          )}
          <img
            src={product.thumbnailUrl}
            alt={product.title}
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </div>

        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={handleLike}
            className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/20 backdrop-blur transition-all duration-300 hover:scale-110 ${
              product.isLiked
                ? 'bg-gradient-to-br from-rose-500 to-orange-400 text-white shadow-lg shadow-rose-500/40'
                : 'bg-slate-900/70 text-white/70 hover:text-white'
            }`}
          >
            <Heart size={18} fill={product.isLiked ? 'currentColor' : 'none'} />
          </button>

          <button
            onClick={handleEdit}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-slate-900/70 text-white/70 opacity-0 transition-all duration-300 hover:scale-110 hover:text-white group-hover:opacity-100"
          >
            <Edit size={18} />
          </button>

          <button
            onClick={handleDelete}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-slate-900/70 text-white/70 opacity-0 transition-all duration-300 hover:scale-110 hover:text-white group-hover:opacity-100"
          >
            <Trash2 size={18} />
          </button>
        </div>

         <div className="flex items-center gap-2 border-t border-white/10 bg-slate-950/70 px-4 py-3 text-sm font-medium text-white/80 backdrop-blur">
          <Star size={16} className="text-amber-400" />
          <span className="tracking-wide">{(Math.random() * 2 + 3).toFixed(1)} / 5.0</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="flex-1 pr-2 text-base font-semibold text-white transition-colors group-hover:text-cyan-300">
            {product.title}
          </h3>

          {product.price && (
            <div className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-2xl font-bold text-transparent">
              ${product.price}
            </div>
          )}
        </div>

        <div className="mt-auto space-y-4">
          {product.category && (
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${getCategoryColor(product.category)}`}>
              {product.category.charAt(0).toUpperCase() + product.category.slice(1)}
            </span>
          )}

          <p className="line-clamp-2 text-sm leading-relaxed text-white/60">
            {product.description || 'No description available for this amazing product.'}
          </p>

          <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs text-white/50">
            <button className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300 transition-colors hover:text-cyan-200">
              Смотреть карточку
            </button>
            <div>ID: {product.id}</div>
          </div>
        </div>
      </div>
    </div>
  )
}