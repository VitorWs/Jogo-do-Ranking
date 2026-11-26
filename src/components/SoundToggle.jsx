import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import {
  SOUND_EVENT,
  isSoundEnabled,
  playCardMove,
  setSoundEnabled,
} from '../utils/sound.js';

/**
 * Botão compacto e tátil de Mutar / Ativar Som (apenas ícone centralizado).
 * Persiste `soundEnabled` ("true" | "false") no localStorage.
 */
export default function SoundToggle({ className = '' }) {
  const [enabled, setEnabled] = useState(isSoundEnabled);

  useEffect(() => {
    const sync = () => setEnabled(isSoundEnabled());
    window.addEventListener('storage', sync);
    window.addEventListener(SOUND_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(SOUND_EVENT, sync);
    };
  }, []);

  const toggle = () => {
    const next = !enabled;
    setSoundEnabled(next);
    setEnabled(next);
    if (next) {
      playCardMove();
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={enabled ? 'Mutar efeitos sonoros' : 'Ativar efeitos sonoros'}
      title={enabled ? 'Som ativado (clique para mutar)' : 'Som mutado (clique para ativar)'}
      className={`game-btn game-btn-white game-btn-sm h-11 w-11 shrink-0 !p-0 ${className}`}
    >
      {enabled ? (
        <Volume2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <VolumeX className="h-5 w-5 text-zinc-500 dark:text-rose-400" />
      )}
    </button>
  );
}
