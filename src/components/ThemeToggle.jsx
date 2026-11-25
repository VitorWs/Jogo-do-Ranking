import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const STORAGE_KEY = 'theme'; // "dark" | "light"
const THEME_EVENT = 'ranking-theme-change';

function readTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }
}

function applyTheme(next) {
  const isDark = next === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', isDark ? '#121318' : '#F4EFE6');
  }
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Armazenamento indisponível: mantém apenas na sessão atual
  }
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
}

/**
 * Botão compacto e tátil de alternância Claro / Escuro (apenas ícone centralizado).
 * Salva a escolha em localStorage ("dark" | "light") e sincroniza entre telas.
 */
export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(readTheme);
  const isDark = theme === 'dark';

  useEffect(() => {
    const sync = () => setTheme(readTheme());
    window.addEventListener('storage', sync);
    window.addEventListener(THEME_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(THEME_EVENT, sync);
    };
  }, []);

  const toggle = () => {
    const next = isDark ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo noturno'}
      title={isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Noturno'}
      className={`game-btn game-btn-white game-btn-sm h-11 w-11 shrink-0 !p-0 ${className}`}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-amber-400" />
      ) : (
        <Moon className="h-5 w-5 text-zinc-900" />
      )}
    </button>
  );
}
