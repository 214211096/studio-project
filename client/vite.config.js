import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // הבקשות ל-/api עוברות לשרת ה-Node, כך שהעוגייה של ההתחברות עובדת בלי CORS
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})
