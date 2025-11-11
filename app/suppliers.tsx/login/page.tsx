'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { supplierProfileDefaults, useSupplierStore } from '@/stores/useSupplierStore'

const fieldLabel = 'text-sm font-medium text-slate-200 tracking-wide'
const inputStyles =
  'mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/40 focus:outline-none focus:ring-0 transition'

// Интерфейс для профиля поставщика
interface SupplierProfile {
  fullName: string
  email: string
  personalNotes: string
}

export default function SupplierLoginPage() {
  const { profile, orders, updateProfile, replaceOrders, reset } = useSupplierStore()
  const [formState, setFormState] = useState<SupplierProfile>(() => profile)
  const [ordersInput, setOrdersInput] = useState(() => orders.join('\n'))
  const [savedMessage, setSavedMessage] = useState('')
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setFormState(profile)
  }, [profile])

  useEffect(() => {
    setOrdersInput(orders.join('\n'))
  }, [orders])

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current)
      }
    }
  }, [])

  const showMessage = (message: string) => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current)
    }

    setSavedMessage(message)
    feedbackTimeoutRef.current = setTimeout(() => setSavedMessage(''), 3000)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedOrders = ordersInput
      .split('\n')
      .map((order: string) => order.trim())
      .filter(Boolean)

    updateProfile(formState)
    replaceOrders(trimmedOrders)
    showMessage('Данные обновлены и сохранены в этом браузере.')
  }

  const handleReset = () => {
    reset()
    setFormState({ ...supplierProfileDefaults })
    setOrdersInput('')
    showMessage('Форма очищена.')
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-160px)] w-full max-w-5xl flex-col justify-center px-6 py-16">
      <div className="mb-12 space-y-4 text-center">
        <p className="text-sm uppercase tracking-[0.5em] text-blue-300/70">Личный кабинет поставщика</p>
        <h1 className="text-3xl font-semibold text-white md:text-4xl">Вход и карточка поставщика</h1>
        <p className="mx-auto max-w-2xl text-sm text-white/60">
          Здесь вы можете быстро обновить свои контактные данные и отметить актуальные заказы. Вся информация сохраняется локально
          в вашем браузере.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <form
          onSubmit={handleSubmit}
          className="space-y-8 rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl shadow-black/20 backdrop-blur"
        >
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Личные данные</h2>
            <p className="text-sm text-white/50">Укажите основную контактную информацию для связи.</p>
          </div>

          <div>
            <label className={fieldLabel} htmlFor="fullName">
              ФИО
            </label>
            <input
              id="fullName"
              type="text"
              placeholder="Например, Иванов Иван Иванович"
              className={inputStyles}
              value={formState.fullName}
              onChange={(event) => setFormState((state: SupplierProfile) => ({ ...state, fullName: event.target.value }))}
              required
            />
          </div>

          <div>
            <label className={fieldLabel} htmlFor="email">
              Почта
            </label>
            <input
              id="email"
              type="email"
              placeholder="example@company.ru"
              className={inputStyles}
              value={formState.email}
              onChange={(event) => setFormState((state: SupplierProfile) => ({ ...state, email: event.target.value }))}
              required
            />
          </div>

          <div>
            <label className={fieldLabel} htmlFor="personalNotes">
              Дополнительные данные
            </label>
            <textarea
              id="personalNotes"
              placeholder="Контактный телефон, реквизиты или комментарии"
              className={`${inputStyles} min-h-[120px] resize-y`}
              value={formState.personalNotes}
              onChange={(event) => setFormState((state: SupplierProfile) => ({ ...state, personalNotes: event.target.value }))}
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className={fieldLabel} htmlFor="orders">
                Активные заказы
              </label>
              <textarea
                id="orders"
                placeholder="Каждый заказ с новой строки"
                className={`${inputStyles} min-h-[160px] resize-y`}
                value={ordersInput}
                onChange={(event) => setOrdersInput(event.target.value)}
              />
            </div>
            <p className="text-xs text-white/40">
              Список заказов хранится локально. Можно добавлять новые строки и обновлять их в любое время.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-white/80 sm:w-auto"
            >
              Сохранить изменения
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex w-full items-center justify-center rounded-lg border border-white/30 px-5 py-2.5 text-sm font-medium text-white transition hover:border-white/60 hover:text-white sm:w-auto"
            >
              Очистить форму
            </button>
            {savedMessage ? <span className="text-xs text-emerald-300/80">{savedMessage}</span> : null}
          </div>
        </form>

        <aside className="space-y-6 rounded-2xl border border-white/10 bg-white/5 px-6 py-8 text-white/80 shadow-xl shadow-black/20 backdrop-blur">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.4em] text-blue-200/60">Сводка профиля</p>
            <h2 className="text-xl font-semibold text-white">Сохранённые данные</h2>
            <p className="text-sm text-white/50">
              Блок обновляется автоматически после сохранения формы.
            </p>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">ФИО</p>
              <p className="mt-1 text-base text-white">{profile.fullName || '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">Почта</p>
              <p className="mt-1 text-base text-white">{profile.email || '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">Дополнительно</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-white/70">
                {profile.personalNotes.trim() ? profile.personalNotes : 'Дополнительные данные пока не указаны.'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">Текущие заказы</p>
              {orders.length ? (
                <ul className="mt-2 space-y-2 text-sm text-white/80">
                  {orders.map((order: string, index: number) => (
                    <li key={`${order}-${index}`} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-300" aria-hidden />
                      <span>{order}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-white/60">Активных заказов нет — добавьте их через форму.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}