<script setup lang="ts">
import { KAlert, KButton, KErrorSummary, KSegmentedControl } from '@khata/ui'
import { Download, FileSpreadsheet, Upload } from '@lucide/vue'
import Papa from 'papaparse'
import { computed, ref } from 'vue'

import { formatDate } from '#shared/dates'
import { formatINR } from '#shared/money'
import { bucket } from '#shared/plan'
import type { ImportResult } from '#shared/types'
import PageHeader from '@/components/PageHeader.vue'
import SelectField from '@/components/SelectField.vue'
import { api } from '@/lib/api'
import { track } from '@/lib/analytics'
import { applyMapping, guessMapping, type Mapping } from '@/lib/csvImport'
import { useAccounts, useMutate } from '@/lib/queries'

const accounts = useAccounts()
const accountOptions = computed(() =>
  (accounts.data.value ?? [])
    .filter((a) => !a.archived)
    .map((a) => ({ value: a.id, label: a.name })),
)

// ---- Export ----
function exportAll() {
  track('export_csv', { rows_bucket: 'all' })
  window.location.href = '/api/export.csv'
}
const template =
  'data:text/csv;charset=utf-8,' +
  encodeURIComponent(
    'Date,Type,Amount,Category,Payee,Note\n05/11/2026,expense,450,Groceries & kirana,DMart,\n01/11/2026,income,85000,Salary,Acme Pvt Ltd,\n',
  )

// ---- Import ----
const fileName = ref('')
const headers = ref<string[]>([])
const data = ref<Record<string, string>[]>([])
const parseError = ref('')
const map = ref<Mapping | null>(null)
const accountId = ref('')
const result = ref<ImportResult | null>(null)

function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  result.value = null
  parseError.value = ''
  fileName.value = file.name
  track('import_csv_start', {})
  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
    complete: (res) => {
      if (!res.meta.fields?.length) {
        parseError.value = 'That file has no header row.'
        return
      }
      if (res.data.length > 1000) {
        parseError.value = `That file has ${res.data.length} rows — split it into files of up to 1,000 rows.`
        return
      }
      headers.value = res.meta.fields
      data.value = res.data
      map.value = guessMapping(res.meta.fields)
      accountId.value ||= accountOptions.value[0]?.value ?? ''
    },
    error: (err) => (parseError.value = err.message),
  })
}

const columnOptions = computed(() => [
  { value: '', label: '— none —' },
  ...headers.value.map((h) => ({ value: h, label: h })),
])
const mapped = computed(() => (map.value ? applyMapping(data.value, map.value) : null))
const preview = computed(() => mapped.value?.rows.slice(0, 8) ?? [])
const errorItems = computed(() =>
  (mapped.value?.errors ?? [])
    .slice(0, 5)
    .map((e) => ({ id: 'csv-file', label: `Row ${e.line}`, message: e.message })),
)

const run = useMutate(
  () => api.post<ImportResult>('/import', { accountId: accountId.value, rows: mapped.value!.rows }),
  ['transactions', 'accounts', 'reports', 'budgets', 'categories'],
  (r) => {
    result.value = r
    track('import_csv_complete', {
      rows_bucket: bucket(r.imported),
      duplicates_bucket: bucket(r.duplicates),
    })
    data.value = []
    headers.value = []
    map.value = null
  },
)
</script>

<template>
  <PageHeader
    title="Import & export"
    subtitle="Your data, in plain CSV. Works with most Indian bank statement downloads."
  />

  <section
    class="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6 shadow-raised sm:p-8"
  >
    <h2 class="m-0 text-lg font-semibold">Export</h2>
    <p class="m-0 text-sm text-fg-muted">
      Download every entry as a spreadsheet-friendly CSV (opens in Excel or Google Sheets). Filter
      by month on the Entries page to export a single month.
    </p>
    <div class="flex flex-wrap gap-2">
      <KButton class="gap-2" @click="exportAll"
        ><Download :size="16" aria-hidden="true" />Export all entries</KButton
      >
      <KButton
        variant="secondary"
        class="gap-2"
        as="a"
        :href="template"
        download="khata-money-template.csv"
        ><FileSpreadsheet :size="16" aria-hidden="true" />Download a template</KButton
      >
    </div>
  </section>

  <section
    class="flex flex-col gap-5 rounded-xl border border-line bg-surface p-6 shadow-raised sm:p-8"
  >
    <h2 class="m-0 text-lg font-semibold">Import</h2>
    <KAlert v-if="result" tone="success" title="Import complete" @update:open="result = null">
      Added {{ result.imported }} entries<template v-if="result.duplicates"
        >, skipped {{ result.duplicates }} already in khata</template
      ><template v-if="result.createdCategories"
        >, created {{ result.createdCategories }} new categories</template
      >.
    </KAlert>
    <ol class="m-0 flex flex-col gap-1 pl-5 text-sm text-fg-muted">
      <li>Download a statement CSV from net banking (or fill in the template).</li>
      <li>Choose the file, check the columns and the account it belongs to.</li>
      <li>Import — entries already in khata (same date, amount and payee) are skipped.</li>
    </ol>
    <label
      for="csv-file"
      class="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line bg-surface-subtle px-6 py-8 text-center transition-colors hover:border-primary-soft"
    >
      <Upload :size="24" aria-hidden="true" class="text-primary" />
      <span class="font-semibold">{{ fileName || 'Choose a CSV file' }}</span>
      <span class="text-xs text-fg-muted"
        >Up to 1,000 rows · stays in your browser until you press Import</span
      >
      <input id="csv-file" type="file" accept=".csv,text/csv" class="sr-only" @change="onFile" />
    </label>
    <p v-if="parseError" role="alert" class="m-0 text-sm text-danger">{{ parseError }}</p>

    <template v-if="map">
      <div class="grid gap-4 sm:grid-cols-2">
        <SelectField
          v-model="accountId"
          label="Import into account"
          :options="accountOptions"
          required
        />
        <SelectField v-model="map.date" label="Date column" :options="columnOptions" required />
      </div>
      <KSegmentedControl
        v-model="map.amountMode"
        :options="[
          { value: 'split', label: 'Debit & credit columns' },
          { value: 'single', label: 'One amount column' },
        ]"
        label="Amount format"
      />
      <div class="grid gap-4 sm:grid-cols-2">
        <template v-if="map.amountMode === 'split'">
          <SelectField v-model="map.debit" label="Debit / withdrawal" :options="columnOptions" />
          <SelectField v-model="map.credit" label="Credit / deposit" :options="columnOptions" />
        </template>
        <template v-else>
          <SelectField v-model="map.amount" label="Amount" :options="columnOptions" />
          <SelectField
            v-model="map.positiveIs"
            label="Positive amounts are"
            :options="[
              { value: 'expense', label: 'Money spent' },
              { value: 'income', label: 'Money received' },
            ]"
            hint="Ignored when a Type column says expense/income."
          />
          <SelectField v-model="map.type" label="Type column" :options="columnOptions" optional />
        </template>
        <SelectField
          v-model="map.payee"
          label="Payee / narration"
          :options="columnOptions"
          optional
        />
        <SelectField
          v-model="map.category"
          label="Category"
          :options="columnOptions"
          optional
          hint="Unknown names become new categories."
        />
        <SelectField v-model="map.note" label="Note" :options="columnOptions" optional />
      </div>

      <KErrorSummary
        v-if="errorItems.length"
        :title="`${mapped!.errors.length} rows can't be read and will be skipped`"
        :items="errorItems"
      />

      <div v-if="preview.length" class="overflow-x-auto rounded-lg border border-line">
        <table class="w-full border-collapse text-sm">
          <caption class="sr-only">
            Preview of the first rows
          </caption>
          <thead class="bg-surface-subtle text-left text-xs text-fg-muted uppercase">
            <tr>
              <th class="px-3 py-2">Date</th>
              <th class="px-3 py-2">Payee</th>
              <th class="px-3 py-2">Category</th>
              <th class="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in preview" :key="i" class="border-t border-line">
              <td class="px-3 py-2 whitespace-nowrap">{{ formatDate(r.occurredOn) }}</td>
              <td class="max-w-[260px] truncate px-3 py-2">{{ r.payee }}</td>
              <td class="px-3 py-2 text-fg-muted">{{ r.category }}</td>
              <td
                class="px-3 py-2 text-right font-mono whitespace-nowrap"
                :class="r.type === 'income' ? 'text-success' : ''"
              >
                {{ r.type === 'income' ? '+' : '−' }}{{ formatINR(r.amount) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <span class="text-sm text-fg-muted">{{ mapped?.rows.length ?? 0 }} entries ready</span>
        <KButton
          class="ml-auto"
          :disabled="!mapped?.rows.length || !accountId"
          :loading="run.isPending.value"
          @click="run.mutate(undefined)"
        >
          Import {{ mapped?.rows.length ?? 0 }} entries
        </KButton>
      </div>
      <p v-if="run.error.value" role="alert" class="m-0 text-sm text-danger">
        {{ run.error.value.message }}
      </p>
    </template>
  </section>
</template>
