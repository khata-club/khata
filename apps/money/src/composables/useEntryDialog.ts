import { reactive } from 'vue'

import type { Transaction } from '#shared/types'
import type { TxnType as T } from '#shared/constants'

/** One add/edit entry dialog for the whole app (opened from the shell, lists and pages). */
export const entryDialog = reactive<{
  open: boolean
  editing: Transaction | null
  presetType: T
  source: 'quick_add' | 'form'
}>({ open: false, editing: null, presetType: 'expense', source: 'quick_add' })

export function openEntry(
  opts: { editing?: Transaction; type?: T; source?: 'quick_add' | 'form' } = {},
) {
  entryDialog.editing = opts.editing ?? null
  entryDialog.presetType = opts.editing?.type ?? opts.type ?? 'expense'
  entryDialog.source = opts.source ?? 'form'
  entryDialog.open = true
}
