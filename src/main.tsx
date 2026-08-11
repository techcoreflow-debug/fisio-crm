import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from '@/components/shared/error-boundary'

// Depois de um deploy novo, o navegador pode ainda ter a página antiga em
// cache, apontando pra um arquivo de tela (chunk) que não existe mais no
// servidor — vira "Failed to fetch dynamically imported module". Em vez
// de mostrar erro, recarrega a página sozinho (uma vez só, pra não entrar
// em loop se o problema for outro).
window.addEventListener('vite:preloadError', () => {
  const jaTentou = sessionStorage.getItem('fisio:recarregado-apos-erro-chunk')
  if (jaTentou) return
  sessionStorage.setItem('fisio:recarregado-apos-erro-chunk', '1')
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
