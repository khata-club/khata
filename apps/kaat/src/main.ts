import '@khata/ui/fonts.css'
import './assets/main.css'

import { createApp } from 'vue'

import App from './App.vue'

createApp(App).mount('#app')

// Offline: precache the app shell (production builds only).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
