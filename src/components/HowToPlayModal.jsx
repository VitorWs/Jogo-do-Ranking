import { useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { POSITION_BADGES } from './RankingList.jsx';

const TUTORIAL_STEPS = [
  {
    title: 'Sorteio do Ranqueador',
    description:
      'A cada rodada, um jogador é escolhido como o Juiz/Ranqueador da vez (em rodízio justo para todos jogarem igual).',
  },
  {
    title: '5 Cartas na Mesa',
    description:
      'O sistema sorteia 5 cartas aleatórias e totalmente diferentes entre si para todos verem na tela.',
  },
  {
    title: 'Ranking Secreto',
    description:
      'O Ranqueador ordena as 5 cartas em segredo do 1º (topo) ao 5º (base) de acordo com o seu próprio critério pessoal.',
  },
  {
    title: 'Palpite dos Amigos',
    description:
      'Os demais jogadores tentam adivinhar a ordem exata que o Ranqueador montou e enviam seus palpites.',
  },
  {
    title: 'Revelação e Pontuação',
    description:
      'O Ranqueador revela carta por carta: primeiro os palpites da galera e depois a sua posição real. Cada acerto exato vale 1 ponto (e cravar todas as 5 garante +2 pontos de bônus). Quem somar mais pontos ao final de todas as voltas vence!',
  },
];

/** Lista reutilizável dos 5 passos coloridos de Como Jogar. */
export function HowToPlaySteps() {
  return (
    <ol className="space-y-3">
      {TUTORIAL_STEPS.map((step, index) => (
        <li
          key={step.title}
          className="flex items-start gap-3 rounded-2xl border-2 border-zinc-900 dark:border-zinc-700 bg-[#FFFBF2] dark:bg-[#252834] p-3.5 shadow-[3px_3px_0px_#18181b] dark:shadow-[3px_3px_0px_#000000]"
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-zinc-900 dark:border-zinc-950 shadow-[2px_2px_0px_#18181b] dark:shadow-[2px_2px_0px_#000000] ${
              POSITION_BADGES[index]
            }`}
          >
            <span className="text-lg font-extrabold leading-none tabular-nums">
              {index + 1}
            </span>
          </div>

          <div className="min-w-0 flex-1 space-y-0.5">
            <h3 className="text-sm sm:text-base font-extrabold tracking-tight text-zinc-900 dark:text-[#F8FAFC]">
              {step.title}
            </h3>
            <p className="text-xs sm:text-sm font-semibold leading-relaxed text-zinc-600 dark:text-zinc-300">
              {step.description}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Modal tátil de "Como Jogar" usado no cabeçalho da sala (ou em qualquer tela). */
export default function HowToPlayModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-play-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border-2 border-zinc-900 dark:border-zinc-700 bg-white dark:bg-[#1D1F27] shadow-[8px_8px_0px_#18181b] dark:shadow-[8px_8px_0px_#000000]"
      >
        <header className="flex items-center justify-between gap-3 border-b-2 border-zinc-900 dark:border-zinc-950 bg-amber-400 px-5 py-4">
          <div className="flex items-center gap-2 text-zinc-950">
            <HelpCircle className="h-6 w-6 shrink-0" />
            <h2 id="how-to-play-title" className="text-xl font-extrabold tracking-tight">
              Como Jogar
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar tutorial"
            className="game-btn game-btn-white game-btn-sm h-9 w-9 !p-0"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="overflow-y-auto p-4 sm:p-5">
          <HowToPlaySteps />
        </div>

        <footer className="border-t-2 border-zinc-900 dark:border-zinc-700 bg-[#FFFBF2] dark:bg-[#161821] p-4">
          <button
            type="button"
            onClick={onClose}
            className="game-btn game-btn-emerald w-full py-3 text-sm"
          >
            Entendi, vamos jogar!
          </button>
        </footer>
      </div>
    </div>
  );
}
