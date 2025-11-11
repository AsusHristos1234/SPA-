import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SupplierProfile {
  fullName: string
  email: string
  personalNotes: string
}

export const supplierProfileDefaults: SupplierProfile = {
  fullName: '',
  email: '',
  personalNotes: '',
}

interface SupplierStore {
  profile: SupplierProfile
  orders: string[]
  updateProfile: (updates: Partial<SupplierProfile>) => void
  replaceOrders: (orders: string[]) => void
  reset: () => void
}

const createInitialProfile = (): SupplierProfile => ({ ...supplierProfileDefaults })

export const useSupplierStore = create<SupplierStore>()(
  persist(
    (set) => ({
      profile: createInitialProfile(),
      orders: [],
      updateProfile: (updates) =>
        set((state) => ({
          profile: { ...state.profile, ...updates },
        })),
      replaceOrders: (orders) => set({ orders }),
      reset: () => set({ profile: createInitialProfile(), orders: [] }),
    }),
    {
      name: 'supplier-account',
    },
  ),
)