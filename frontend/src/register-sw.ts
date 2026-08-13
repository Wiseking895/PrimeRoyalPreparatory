import { registerSW } from 'virtual:pwa-register'

registerSW({
  immediate: true,
  onOfflineReady() {
    console.info('[pwa] PRPS is ready to work offline.')
  },
})
