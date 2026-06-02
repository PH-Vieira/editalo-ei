import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { installBrowserNavigationGuard } from '@/lib/browserNavigationGuard'
import './styles/base.css'

installBrowserNavigationGuard()

createApp(App).use(createPinia()).mount('#app')
