import '@khata/ui/fonts.css'
import './assets/main.css'

import { setChartCurrency } from '@khata/ui'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createApp } from 'vue'

import App from './App.vue'
import { initAnalytics } from './lib/analytics'
import { router } from './router'

// Every Calm Kit chart formats in rupees with lakh/crore units.
setChartCurrency({ symbol: '₹', locale: 'en-IN', compact: 'indian' })
initAnalytics()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => count < 2 && (err as { status?: number }).status !== 401,
      refetchOnWindowFocus: false,
    },
  },
})

createApp(App).use(router).use(VueQueryPlugin, { queryClient }).mount('#app')
