import { create } from 'zustand'

interface DisplayConfig {
  id: number
  label: string
  bounds: { x: number; y: number; width: number; height: number }
  isPrimary: boolean
}

interface DisplayStore {
  displays: DisplayConfig[]
  projectorDisplayId: number | null
  isProjectorActive: boolean

  setDisplays: (displays: DisplayConfig[]) => void
  setProjectorDisplay: (displayId: number | null) => void
  setProjectorActive: (active: boolean) => void
}

export const useDisplayStore = create<DisplayStore>((set) => ({
  displays: [],
  projectorDisplayId: null,
  isProjectorActive: false,

  setDisplays: (displays) => set({ displays }),
  setProjectorDisplay: (projectorDisplayId) => set({ projectorDisplayId }),
  setProjectorActive: (isProjectorActive) => set({ isProjectorActive })
}))
