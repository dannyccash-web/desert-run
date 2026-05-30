import { defineConfig } from 'vite'
import reactRefresh from '@vitejs/plugin-react-refresh'
import reactJsx from 'vite-react-jsx'

export default defineConfig({
  base: '/desert-run/',
  plugins: [reactJsx(), reactRefresh()],
})
