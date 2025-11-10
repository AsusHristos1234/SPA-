'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

const navigation = [
  { label: 'Каталог', href: '/products' },
  { label: 'Создать товар', href: '/create-product' },
  { label: 'Решения', href: '#' },
  { label: 'Тарифы', href: '#' },
] as const

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="w-full bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between px-6 py-4">
          {/* Левая часть - логотип */}
          <div className="flex items-center">
            <Link href="/" className="text-2xl font-light text-gray-900 tracking-tight">
              Marketplace Vision
            </Link>
          </div>

          {/* Центральная часть - навигация */}
          <nav className="hidden md:flex items-center space-x-8 absolute left-1/2 transform -translate-x-1/2">
            {navigation.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-sm text-gray-600 hover:text-gray-900 font-normal transition-colors duration-200"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Правая часть - кнопки */}
          <div className="hidden md:flex items-center space-x-4">
            <Link
              href="#"
              className="text-sm text-gray-600 hover:text-gray-900 font-normal px-3 py-1.5 transition-colors duration-200"
            >
              Вход для продавцов
            </Link>
            <Link
              href="/create-product"
              className="bg-black text-white text-sm font-normal px-4 py-1.5 rounded transition-colors duration-200 hover:bg-gray-800"
            >
              Стать партнёром
            </Link>
          </div>

          {/* Мобильное меню */}
        
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-1 text-gray-600"
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Мобильное меню */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white">
            <div className="px-6 py-4 space-y-3">
              {navigation.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="block text-gray-600 hover:text-gray-900 py-1.5 text-sm"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <div className="pt-3 space-y-2 border-t border-gray-100">
                <Link
                  href="#"
                  className="block text-gray-600 hover:text-gray-900 py-1.5 text-sm"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Вход для продавцов
                </Link>
                <Link
                  href="/create-product"
                  className="block bg-black text-white text-sm py-1.5 px-3 rounded text-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Стать партнёром
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header