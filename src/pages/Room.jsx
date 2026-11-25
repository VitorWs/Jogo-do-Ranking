import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FieldPath,
  deleteField,
  doc,
  onSnapshot,
  runTransaction,
  updateDoc,
} from 'firebase/firestore';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clock,
  Crown,
  Eye,
  HelpCircle,
  Link2,
  Loader2,
  Medal,
  Play,
  RotateCcw,
  Scale,
  Send,
  SkipForward,
  Sparkles,
  Trophy,
  User,
  Users,
  X,
} from 'lucide-react';
import { db } from '../services/firebase';
import cardsData from '../data/cards.json';
import { calculateScore, drawCards } from '../utils/gameLogic';
import {
  getOrCreatePlayerId,
  getSavedNickname,
  saveNickname,
} from '../utils/playerSession';
import HowToPlayModal from '../components/HowToPlayModal.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import RankingList, { POSITION_BADGES } from '../components/RankingList.jsx';

const CARDS_PER_ROUND = 5;
const MIN_CYCLES = 1;
const MAX_CYCLES = 10;
const DEFAULT_CYCLES = 2;

function clampCycles(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_CYCLES;
  return Math.min(MAX_CYCLES, Math.max(MIN_CYCLES, Math.round(n)));
}

/* ----------------------------- helpers ----------------------------- */

/** Lista ordenada e estável de jogadores: [{ id, name, score, joinedAt }] */
function getOrderedPlayers(players = {}) {
  return Object.entries(players)
    .map(([id, p]) => ({
      id,
      name: p?.name ?? 'Jogador',
      score: p?.score ?? 0,
      joinedAt: p?.joinedAt ?? 0,
    }))
    .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
}

/** Atualiza usedCards; se o baralho foi reiniciado pelo drawCards, recomeça a lista. */
function computeUsedCards(usedCards, drawn) {
  const used = new Set(usedCards || []);
  const unused = cardsData.filter((c) => !used.has(c));
  return unused.length < CARDS_PER_ROUND ? [...drawn] : [...usedCards, ...drawn];
}

/** IDs dos jogadores congelados no início da rodada (com fallback para salas antigas). */
function getRoundIds(r) {
  if (Array.isArray(r?.roundPlayerIds) && r.roundPlayerIds.length > 0) return r.roundPlayerIds;
  return Object.keys(r?.players || {});
}

/** Ordem fixa de juízes da partida filtrada pelos jogadores ativos (com fallback seguro). */
function getActiveJudgeOrder(r) {
  const presentIds = getOrderedPlayers(r?.players).map((p) => p.id);
  if (Array.isArray(r?.judgeOrder) && r.judgeOrder.length > 0) {
    const valid = r.judgeOrder.filter((id) => r?.players?.[id]);
    if (valid.length > 0) return valid;
  }
  return presentIds;
}

/** Todos os jogadores da rodada (exceto o juiz) já enviaram palpite? */
function allGuessesIn(r) {
  const ids = getRoundIds(r).filter((id) => id !== r.currentJudgeId && r.players?.[id]);
  return ids.length > 0 && ids.every((id) => Boolean(r.guesses?.[id]));
}

/* --------------------------- UI building blocks --------------------------- */

function Shell({ children }) {
  return (
    <div className="table-bg relative min-h-dvh overflow-x-hidden font-sans text-zinc-900 dark:text-[#F8FAFC]">
      <div className="relative z-10 mx-auto w-full max-w-xl lg:max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        {children}
      </div>
    </div>
  );
}

function Panel({ children, className = '' }) {
  return (
    <section
      className={`rounded-2xl border-2 border-zinc-900 dark:border-zinc-700 bg-white dark:bg-[#1D1F27] p-4 sm:p-5 shadow-[4px_4px_0px_#18181b] dark:shadow-[4px_4px_0px_#000000] ${className}`}
    >
      {children}
    </section>
  );
}

function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-2xl border-2 border-zinc-900 dark:border-zinc-950 bg-rose-300 px-4 py-3 text-sm font-bold text-zinc-950 shadow-[3px_3px_0px_#18181b] dark:shadow-[3px_3px_0px_#000000]"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

const BUTTON_VARIANTS = {
  emerald: 'game-btn-emerald',
  gold: 'game-btn-gold',
  white: 'game-btn-white',
};

function PrimaryButton({ children, loading, variant = 'emerald', className = '', ...props }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className={`game-btn ${BUTTON_VARIANTS[variant]} w-full text-base py-4 ${className}`}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : children}
    </button>
  );
}

function WaitingBox({ title, subtitle }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-zinc-900 dark:border-zinc-950 bg-amber-300 shadow-[3px_3px_0px_#18181b] dark:shadow-[3px_3px_0px_#000000]">
        <Clock className="h-7 w-7 animate-pulse text-zinc-950" />
      </div>
      <p className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-[#F8FAFC]">
        {title}
      </p>
      {subtitle && (
        <p className="max-w-xs text-sm font-semibold text-zinc-600 dark:text-zinc-300">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function Header({ room, roomId, players, playerId, isHost, onRemove, onOpenHelp }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      const input = document.createElement('input');
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(input);
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ranked = [...players].sort((a, b) => b.score - a.score);

  return (
    <header className="mb-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/"
          aria-label="Voltar para o início"
          className="game-btn game-btn-white game-btn-sm h-11 w-11 shrink-0 !p-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col items-center rounded-2xl border-2 border-zinc-900 dark:border-zinc-700 bg-white dark:bg-[#1D1F27] px-2.5 py-1.5 shadow-[3px_3px_0px_#18181b] dark:shadow-[3px_3px_0px_#000000]">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            Sala
          </span>
          <span className="text-xl sm:text-2xl font-extrabold leading-none tracking-[0.22em] text-zinc-900 dark:text-[#F8FAFC]">
            {roomId}
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copiar link de convite"
          title="Copiar link de convite"
          className="game-btn game-btn-gold game-btn-sm h-11 shrink-0 px-3 text-xs"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" /> <span className="hidden sm:inline">Copiado</span>
            </>
          ) : (
            <>
              <Link2 className="h-4 w-4" /> <span className="hidden sm:inline">Convidar</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenHelp}
          aria-label="Como jogar"
          title="Como jogar"
          className="game-btn game-btn-white game-btn-sm h-11 w-11 shrink-0 !p-0"
        >
          <HelpCircle className="h-5 w-5" />
        </button>

        <ThemeToggle />
      </div>

      {room.status !== 'LOBBY' && (
        <div className="flex justify-center">
          <span className="rounded-full border-2 border-zinc-900 dark:border-amber-400/70 bg-zinc-900 dark:bg-[#1D1F27] px-4 py-1 text-xs font-extrabold uppercase tracking-wider text-amber-300 shadow-[3px_3px_0px_#fbbf24]">
            Rodada {Math.min(room.round, room.maxRounds)} / {room.maxRounds}
          </span>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2 lg:hidden">
        {ranked.map((p) => {
          const isMe = p.id === playerId;
          const isJudgeNow =
            room.status !== 'LOBBY' &&
            room.status !== 'FINISHED' &&
            p.id === room.currentJudgeId;
          return (
            <span
              key={p.id}
              className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-extrabold shadow-[2px_2px_0px_#18181b] dark:shadow-[2px_2px_0px_#000000] ${
                isMe
                  ? 'border-zinc-900 dark:border-zinc-950 bg-sky-300 text-zinc-950'
                  : 'border-zinc-900 dark:border-zinc-700 bg-white dark:bg-[#1D1F27] text-zinc-900 dark:text-[#F8FAFC]'
              }`}
            >
              {p.id === room.hostId && <Crown className="h-3.5 w-3.5 text-amber-500" />}
              {isJudgeNow && (
                <Scale
                  aria-label="Juiz da rodada"
                  className={`h-3.5 w-3.5 ${
                    isMe ? 'text-zinc-950' : 'text-pink-500 dark:text-amber-300'
                  }`}
                />
              )}
              <span className="max-w-[7rem] truncate">{p.name}</span>
              <span className="rounded-full border border-zinc-900/30 bg-amber-300 px-1.5 text-zinc-950">
                {p.score}
              </span>
              {isHost && p.id !== playerId && (
                <button
                  type="button"
                  onClick={() => onRemove(p)}
                  aria-label={`Remover ${p.name}`}
                  title="Remover jogador"
                  className="-mr-1 flex h-4 w-4 items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-rose-400 hover:text-zinc-950 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          );
        })}
      </div>
    </header>
  );
}

/* ------------------------------ nickname gate ------------------------------ */

function NicknameGate({ roomId, onSubmit, busy, error }) {
  const [name, setName] = useState('');
  return (
    <Shell>
      <Panel className="mt-10 space-y-5">
        <div className="space-y-1 text-center">
          <p className="text-xs font-extrabold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            Entrando na sala
          </p>
          <p className="text-4xl font-extrabold tracking-[0.25em] text-zinc-900 dark:text-[#F8FAFC]">
            {roomId}
          </p>
        </div>
        <ErrorBanner message={error} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onSubmit(name.trim());
          }}
          className="space-y-4"
        >
          <label
            htmlFor="quick-nickname"
            className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-zinc-700 dark:text-zinc-200"
          >
            <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Como quer ser chamado?
          </label>
          <input
            id="quick-nickname"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="Seu apelido"
            className="game-input"
          />
          <PrimaryButton type="submit" loading={busy} disabled={!name.trim()}>
            Entrar na sala
          </PrimaryButton>
        </form>
      </Panel>
    </Shell>
  );
}

/* --------------------------------- views --------------------------------- */

function LobbyView({ room, players, isHost, busy, onChangeCycles, onStart }) {
  const canStart = players.length >= 2;
  const syncedCycles = clampCycles(room.cycles);
  const [sliderCycles, setSliderCycles] = useState(syncedCycles);
  const debounceRef = useRef(null);

  useEffect(() => {
    setSliderCycles(syncedCycles);
  }, [syncedCycles]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const displayCycles = isHost ? sliderCycles : syncedCycles;
  const totalRounds = players.length * displayCycles;
  const cycleText = `${displayCycles} ${displayCycles === 1 ? 'volta' : 'voltas'} por jogador`;
  const roundsText = `${totalRounds} ${totalRounds === 1 ? 'rodada' : 'rodadas'} no total`;
  const rangeRatio = (displayCycles - MIN_CYCLES) / (MAX_CYCLES - MIN_CYCLES);
  const rangePos = `calc(0.875rem + (100% - 1.75rem) * ${rangeRatio})`;

  const applyCycles = (value) => {
    const next = clampCycles(value);
    setSliderCycles(next);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChangeCycles(next);
    }, 120);
  };

  const handleSliderChange = (e) => {
    applyCycles(e.target.value);
  };

  return (
    <Panel className="space-y-5">
      <div className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
        <Users className="h-5 w-5 text-amber-500 dark:text-amber-400" />
        Jogadores na sala ({players.length})
      </div>

      <ul className="space-y-2.5">
        {players.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-xl border-2 border-zinc-900 dark:border-zinc-700 bg-[#FFFBF2] dark:bg-[#252834] px-4 py-3 shadow-[3px_3px_0px_#18181b] dark:shadow-[3px_3px_0px_#000000]"
          >
            <span className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-zinc-900 dark:text-[#F8FAFC]">
              {p.name}
              {p.id === room.hostId && (
                <span className="inline-flex items-center gap-1 rounded-full border-2 border-zinc-900 dark:border-zinc-950 bg-amber-300 px-2 py-0.5 text-[10px] font-extrabold uppercase text-zinc-950">
                  <Crown className="h-3 w-3" /> Anfitrião
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {isHost ? (
        <div className="space-y-4">
          <div className="space-y-3 rounded-2xl border-2 border-zinc-900 dark:border-zinc-700 bg-[#FFFBF2] dark:bg-[#161821] p-4 shadow-[3px_3px_0px_#18181b] dark:shadow-[3px_3px_0px_#000000]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="cycles-slider"
                className="text-xs font-extrabold uppercase tracking-wider text-zinc-600 dark:text-zinc-300"
              >
                Voltas por jogador
              </label>
              <span className="rounded-xl border-2 border-zinc-900 dark:border-zinc-950 bg-amber-400 px-3 py-1 text-xs sm:text-sm font-extrabold tracking-tight text-zinc-950 shadow-[2px_2px_0px_#18181b] dark:shadow-[2px_2px_0px_#000000] tabular-nums">
                {cycleText} — {roundsText}
              </span>
            </div>

            <div className="pt-1">
              <input
                id="cycles-slider"
                type="range"
                min={MIN_CYCLES}
                max={MAX_CYCLES}
                step={1}
                value={sliderCycles}
                onChange={handleSliderChange}
                disabled={busy}
                style={{ '--range-pos': rangePos }}
                className="game-range"
              />
              <div className="mt-2.5 flex justify-between px-[calc(2px+0.875rem)] text-xs font-extrabold tabular-nums">
                {Array.from({ length: MAX_CYCLES - MIN_CYCLES + 1 }, (_, i) => i + MIN_CYCLES).map(
                  (tick) => {
                    const active = tick === sliderCycles;
                    return (
                      <button
                        key={tick}
                        type="button"
                        onClick={() => applyCycles(tick)}
                        disabled={busy}
                        className={`flex w-0 justify-center leading-none transition-colors cursor-pointer disabled:cursor-not-allowed ${
                          active
                            ? 'scale-110 text-emerald-600 dark:text-amber-400'
                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                        }`}
                      >
                        {tick}
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          </div>

          <PrimaryButton
            onClick={() => {
              clearTimeout(debounceRef.current);
              onStart(sliderCycles);
            }}
            loading={busy}
            disabled={!canStart}
          >
            <Play className="h-5 w-5" /> Iniciar Jogo
          </PrimaryButton>
          {!canStart && (
            <p className="text-center text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              São necessários pelo menos 2 jogadores. Compartilhe o link de convite!
            </p>
          )}
        </div>
      ) : (
        <WaitingBox
          title="Aguardando o anfitrião iniciar..."
          subtitle={`${cycleText} — ${roundsText}`}
        />
      )}
    </Panel>
  );
}

function RankingView({ room, judgeName, isJudge, busy, onConfirm }) {
  const [order, setOrder] = useState(room.currentItems);

  if (!isJudge) {
    return (
      <Panel>
        <WaitingBox
          title={`Aguardando ${judgeName} ordenar as 5 cartas...`}
          subtitle="Depois disso, você vai tentar adivinhar a ordem de preferência dele."
        />
      </Panel>
    );
  }

  return (
    <Panel className="space-y-4">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-zinc-900 dark:text-[#F8FAFC]">
          <Scale className="h-6 w-6 shrink-0 text-pink-500 dark:text-amber-400" />
          Você é o Juiz da vez!
        </h2>
        <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
          Ordene as cartas de acordo com a sua preferência pessoal. Os outros vão tentar adivinhar.
        </p>
      </div>
      <RankingList items={order} onChange={setOrder} disabled={busy} />
      <PrimaryButton onClick={() => onConfirm(order)} loading={busy}>
        <Check className="h-5 w-5" /> Confirmar Meu Ranking
      </PrimaryButton>
    </Panel>
  );
}

function GuessingView({ room, players, playerId, judgeName, isJudge, isSpectator, busy, onSubmit }) {
  const [order, setOrder] = useState(room.currentItems);
  const guessers = players.filter(
    (p) => p.id !== room.currentJudgeId && getRoundIds(room).includes(p.id)
  );
  const guessed = guessers.filter((p) => room.guesses?.[p.id]);
  const missing = guessers.length - guessed.length;

  if (isJudge) {
    return (
      <Panel className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-[#F8FAFC]">
            Palpites em andamento
          </h2>
          <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
            {missing > 0
              ? `Faltam ${missing} jogador(es) enviarem o palpite.`
              : 'Todos enviaram! Revelando...'}
          </p>
        </div>
        <ul className="space-y-2.5">
          {guessers.map((p) => {
            const done = Boolean(room.guesses?.[p.id]);
            return (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-xl border-2 border-zinc-900 dark:border-zinc-700 bg-[#FFFBF2] dark:bg-[#252834] px-4 py-3 shadow-[3px_3px_0px_#18181b] dark:shadow-[3px_3px_0px_#000000]"
              >
                <span className="text-base font-extrabold tracking-tight text-zinc-900 dark:text-[#F8FAFC]">
                  {p.name}
                </span>
                {done ? (
                  <span className="inline-flex items-center gap-1 rounded-full border-2 border-zinc-900 dark:border-zinc-950 bg-emerald-400 px-2.5 py-0.5 text-xs font-extrabold text-zinc-950">
                    <Check className="h-3.5 w-3.5" /> Enviou
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border-2 border-zinc-900 dark:border-zinc-600 bg-zinc-100 dark:bg-[#161821] px-2.5 py-0.5 text-xs font-extrabold text-zinc-600 dark:text-zinc-300">
                    <Clock className="h-3.5 w-3.5 animate-pulse" /> Pensando...
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
    );
  }

  if (isSpectator) {
    return (
      <Panel>
        <WaitingBox
          title="Você está assistindo esta rodada"
          subtitle="Você entrará automaticamente na próxima rodada."
        />
      </Panel>
    );
  }

  if (room.guesses?.[playerId]) {
    return (
      <Panel>
        <WaitingBox
          title="Palpite enviado!"
          subtitle={
            missing > 0
              ? `Aguardando mais ${missing} jogador(es)...`
              : 'Preparando a revelação...'
          }
        />
      </Panel>
    );
  }

  return (
    <Panel className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-[#F8FAFC]">
          Qual a ordem de {judgeName}?
        </h2>
        <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
          Ordene as cartas do jeito que você acha que{' '}
          <strong className="text-zinc-900 dark:text-amber-300">{judgeName}</strong> ordenou.
        </p>
      </div>
      <RankingList items={order} onChange={setOrder} disabled={busy} />
      <PrimaryButton onClick={() => onSubmit(order)} loading={busy}>
        <Send className="h-5 w-5" /> Enviar Palpite
      </PrimaryButton>
    </Panel>
  );
}

function ResultsView({ room, players, playerId, judgeName, isJudge, isHost, busy, onReveal, onNext }) {
  const revealMap =
    room.revealedCards && typeof room.revealedCards === 'object' && !Array.isArray(room.revealedCards)
      ? room.revealedCards
      : {};
  const doneCount = Object.values(revealMap).filter((v) => v === 'ALL').length;
  const allRevealed = doneCount === CARDS_PER_ROUND;
  const guessers = players.filter(
    (p) => p.id !== room.currentJudgeId && getRoundIds(room).includes(p.id)
  );
  const isLastRound = room.round >= room.maxRounds;

  return (
    <div className="space-y-4">
      <Panel className="space-y-1 !border-zinc-900 dark:!border-zinc-950 !bg-amber-300">
        <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-zinc-950">
          <Sparkles className="h-5 w-5 shrink-0" />
          Revelação
        </h2>
        <p className="text-sm font-bold text-zinc-800">
          {allRevealed
            ? 'Todas as cartas foram reveladas!'
            : isJudge
              ? `Revele os palpites e depois a sua posição, carta por carta. (${doneCount}/${CARDS_PER_ROUND})`
              : `Aguardando o juiz... (${doneCount}/${CARDS_PER_ROUND} cartas completas)`}
        </p>
      </Panel>

      {room.currentItems.map((card) => {
        const stage = revealMap[card]; // undefined | 'GUESSES' | 'ALL'
        const showGuesses = stage === 'GUESSES' || stage === 'ALL';
        const showAnswer = stage === 'ALL';
        const judgePos = room.secretRanking.indexOf(card) + 1;

        return (
          <Panel key={card} className="space-y-3 !p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="min-w-0 flex-1 text-lg font-extrabold leading-snug tracking-tight text-zinc-900 dark:text-[#F8FAFC] break-words">
                {card}
              </h3>
              {showAnswer && (
                <span
                  className={`shrink-0 rounded-xl border-2 border-zinc-900 dark:border-zinc-950 px-3 py-1 text-sm font-extrabold tracking-tight shadow-[2px_2px_0px_#18181b] dark:shadow-[2px_2px_0px_#000000] ${
                    POSITION_BADGES[judgePos - 1] ?? 'bg-zinc-200 text-zinc-950'
                  }`}
                >
                  Posição do Juiz: {judgePos}º lugar
                </span>
              )}
            </div>

            {showGuesses && (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {guessers.map((p) => {
                  const guess = room.guesses?.[p.id];
                  const pos = guess ? guess.indexOf(card) + 1 : 0;
                  const hit = pos !== 0 && pos === judgePos;
                  const color = !showAnswer
                    ? 'border-zinc-900 dark:border-zinc-600 bg-zinc-100 dark:bg-[#262936] text-zinc-900 dark:text-[#F8FAFC]'
                    : hit
                      ? 'border-zinc-900 dark:border-zinc-950 bg-emerald-400 text-zinc-950'
                      : 'border-zinc-900 dark:border-zinc-950 bg-rose-400 text-zinc-950';
                  return (
                    <li
                      key={p.id}
                      className={`flex items-center justify-between gap-2 rounded-xl border-2 px-3 py-2 text-sm font-extrabold tracking-tight shadow-[2px_2px_0px_#18181b] dark:shadow-[2px_2px_0px_#000000] transition-colors ${color}`}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        {showAnswer &&
                          (hit ? (
                            <Check className="h-4 w-4 shrink-0" />
                          ) : (
                            <X className="h-4 w-4 shrink-0" />
                          ))}
                        <span className="truncate">
                          {p.name}
                          {p.id === playerId && ' (você)'}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">{pos ? `${pos}º lugar` : '—'}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            {!stage &&
              (isJudge ? (
                <button
                  type="button"
                  onClick={() => onReveal(card, 'GUESSES')}
                  disabled={busy}
                  className="game-btn game-btn-emerald w-full text-sm"
                >
                  <Eye className="h-4 w-4" /> 1. Mostrar Palpites
                </button>
              ) : (
                <p className="flex items-center gap-2 text-sm font-bold text-zinc-600 dark:text-zinc-400">
                  <Clock className="h-4 w-4 animate-pulse" /> Aguardando o juiz...
                </p>
              ))}

            {stage === 'GUESSES' &&
              (isJudge ? (
                <button
                  type="button"
                  onClick={() => onReveal(card, 'ALL')}
                  disabled={busy}
                  className="game-btn game-btn-gold w-full text-sm"
                >
                  <Eye className="h-4 w-4" /> 2. Revelar Minha Posição
                </button>
              ) : (
                <p className="flex items-center gap-2 text-sm font-bold text-zinc-600 dark:text-zinc-400">
                  <Clock className="h-4 w-4 animate-pulse" /> Aguardando o juiz revelar a posição dele...
                </p>
              ))}
          </Panel>
        );
      })}

      {allRevealed && (isJudge || isHost) && (
        <PrimaryButton onClick={onNext} loading={busy}>
          {isLastRound ? (
            <>
              <Trophy className="h-5 w-5" /> Ver Resultado Final
            </>
          ) : (
            <>
              <SkipForward className="h-5 w-5" /> Próxima Rodada
            </>
          )}
        </PrimaryButton>
      )}
      {allRevealed && !(isJudge || isHost) && (
        <p className="text-center text-sm font-bold text-zinc-700 dark:text-zinc-300">
          Aguardando {judgeName} avançar para a próxima rodada...
        </p>
      )}
    </div>
  );
}

function FinishedView({ players, playerId, isHost, busy, onReplay }) {
  const podium = [...players].sort((a, b) => b.score - a.score);
  const rowColors = [
    'border-zinc-900 dark:border-zinc-950 bg-amber-300 text-zinc-950',
    'border-zinc-900 dark:border-zinc-950 bg-sky-200 text-zinc-950',
    'border-zinc-900 dark:border-zinc-950 bg-orange-300 text-zinc-950',
  ];

  return (
    <Panel className="space-y-5">
      <div className="space-y-1 text-center">
        <Trophy className="mx-auto h-10 w-10 text-amber-500 dark:text-amber-400" />
        <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-[#F8FAFC]">
          Fim de jogo!
        </h2>
        {podium[0] && (
          <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
            <strong className="text-zinc-900 dark:text-amber-300">{podium[0].name}</strong> venceu com{' '}
            {podium[0].score} ponto(s)!
          </p>
        )}
      </div>

      <ol className="space-y-2.5">
        {podium.map((p, i) => {
          const isTop3 = i < 3;
          return (
            <li
              key={p.id}
              className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 shadow-[3px_3px_0px_#18181b] dark:shadow-[3px_3px_0px_#000000] ${
                rowColors[i] ??
                'border-zinc-900 dark:border-zinc-700 bg-white dark:bg-[#252834] text-zinc-900 dark:text-[#F8FAFC]'
              }`}
            >
              <span className="flex items-center gap-3 text-lg font-extrabold tracking-tight">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-zinc-900 dark:border-zinc-950 bg-white text-sm font-extrabold text-zinc-950 tabular-nums">
                  {i === 0 ? (
                    <Trophy className="h-4 w-4 text-amber-500" />
                  ) : i < 3 ? (
                    <Medal className="h-4 w-4 text-zinc-700" />
                  ) : (
                    `${i + 1}º`
                  )}
                </span>
                {p.name}
                {p.id === playerId && (
                  <span
                    className={`text-xs font-bold ${
                      isTop3 ? 'text-zinc-700' : 'text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    (você)
                  </span>
                )}
              </span>
              <span className="text-2xl font-extrabold tabular-nums">{p.score}</span>
            </li>
          );
        })}
      </ol>

      {isHost ? (
        <PrimaryButton onClick={onReplay} loading={busy} variant="gold">
          <RotateCcw className="h-5 w-5" /> Jogar Novamente
        </PrimaryButton>
      ) : (
        <p className="text-center text-sm font-bold text-zinc-700 dark:text-zinc-300">
          Aguardando o anfitrião iniciar uma nova partida...
        </p>
      )}
    </Panel>
  );
}

function Sidebar({ room, players, playerId, isHost, onRemove }) {
  const inRound = ['RANKING', 'GUESSING', 'RESULTS'].includes(room.status);
  const showGuessState = room.status === 'GUESSING' || room.status === 'RESULTS';
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const roundIds = getRoundIds(room);

  return (
    <aside className="hidden lg:block lg:sticky lg:top-6">
      <Panel className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
          <Users className="h-5 w-5 text-amber-500 dark:text-amber-400" />
          Participantes ({players.length})
        </div>
        <ul className="space-y-3">
          {sorted.map((p) => {
            const isJudge = inRound && p.id === room.currentJudgeId;
            const isMe = p.id === playerId;
            const sent = Boolean(room.guesses?.[p.id]);
            const rowStyle = isJudge
              ? 'border-zinc-900 dark:border-zinc-950 bg-amber-300 text-zinc-950'
              : isMe
                ? 'border-zinc-900 dark:border-sky-400 bg-sky-200 dark:bg-[#232A3B] text-zinc-950 dark:text-[#F8FAFC]'
                : 'border-zinc-900 dark:border-zinc-700 bg-white dark:bg-[#252834] text-zinc-900 dark:text-[#F8FAFC]';

            return (
              <li
                key={p.id}
                className={`rounded-xl border-2 px-4 py-3 shadow-[3px_3px_0px_#18181b] dark:shadow-[3px_3px_0px_#000000] ${rowStyle}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-lg font-extrabold tracking-tight">
                    {p.id === room.hostId && (
                      <Crown
                        className={`h-4 w-4 shrink-0 ${
                          isJudge ? 'text-zinc-950' : 'text-amber-600 dark:text-amber-400'
                        }`}
                      />
                    )}
                    <span className="truncate">{p.name}</span>
                    {isMe && (
                      <span
                        className={`shrink-0 text-xs font-bold ${
                          isJudge ? 'text-zinc-800' : 'text-zinc-600 dark:text-sky-300'
                        }`}
                      >
                        (você)
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="rounded-lg border-2 border-zinc-900 dark:border-zinc-700 bg-white dark:bg-[#121318] px-2 text-2xl font-extrabold tabular-nums text-zinc-950 dark:text-amber-300">
                      {p.score}
                    </span>
                    {isHost && !isMe && (
                      <button
                        type="button"
                        onClick={() => onRemove(p)}
                        aria-label={`Remover ${p.name}`}
                        title="Remover jogador ausente"
                        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-transparent hover:border-zinc-950 hover:bg-rose-400 hover:text-zinc-950 cursor-pointer ${
                          isJudge ? 'text-zinc-800' : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-extrabold">
                  {isJudge && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-950 px-2.5 py-0.5 uppercase tracking-wide text-amber-300">
                      <Scale className="h-3.5 w-3.5" /> Juiz da rodada
                    </span>
                  )}
                  {inRound && !isJudge && !roundIds.includes(p.id) && (
                    <span className="inline-flex items-center gap-1 rounded-full border-2 border-zinc-900 dark:border-zinc-950 bg-sky-300 px-2.5 py-0.5 text-zinc-950">
                      <Eye className="h-3.5 w-3.5" /> Assistindo
                    </span>
                  )}
                  {showGuessState && !isJudge && roundIds.includes(p.id) && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-0.5 ${
                        sent
                          ? 'border-zinc-900 dark:border-zinc-950 bg-emerald-400 text-zinc-950'
                          : 'border-zinc-900 dark:border-zinc-600 bg-zinc-100 dark:bg-[#161821] text-zinc-900 dark:text-zinc-300'
                      }`}
                    >
                      {sent ? (
                        <>
                          <Check className="h-3 w-3" /> Palpite enviado
                        </>
                      ) : (
                        <>
                          <Clock className="h-3 w-3" /> Pensando...
                        </>
                      )}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
    </aside>
  );
}

/* ---------------------------------- page ---------------------------------- */

export default function Room() {
  const { roomId: rawRoomId = '' } = useParams();
  const roomId = rawRoomId.toUpperCase();
  const roomRef = useMemo(() => doc(db, 'rooms', roomId), [roomId]);

  const [playerId] = useState(() => getOrCreatePlayerId());
  const [playerName, setPlayerName] = useState(() => getSavedNickname().trim());

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  // Assinatura em tempo real
  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      roomRef,
      (snap) => {
        if (snap.exists()) {
          setRoom(snap.data());
          setNotFound(false);
        } else {
          setRoom(null);
          setNotFound(true);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Erro no onSnapshot:', err);
        setError('Perdemos a conexão com a sala. Recarregue a página.');
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [roomRef]);

  // Garante que o jogador atual esteja em players (link direto / nova aba)
  const isInRoom = Boolean(room?.players?.[playerId]);
  useEffect(() => {
    if (!room || isInRoom || !playerName) return;
    updateDoc(roomRef, {
      [`players.${playerId}`]: { name: playerName, score: 0, joinedAt: Date.now() },
    }).catch((err) => {
      console.error('Erro ao entrar na sala:', err);
      setError('Não foi possível entrar na sala.');
    });
  }, [room, isInRoom, playerName, playerId, roomRef]);

  const players = useMemo(() => getOrderedPlayers(room?.players), [room?.players]);

  // Transição de segurança GUESSING -> RESULTS (executada pelo juiz)
  const status = room?.status;
  const judgeId = room?.currentJudgeId;
  const guessesComplete = Boolean(room) && allGuessesIn(room);
  useEffect(() => {
    if (status !== 'GUESSING' || judgeId !== playerId || !guessesComplete) return;
    runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      const r = snap.data();
      if (!r || r.status !== 'GUESSING' || !allGuessesIn(r)) return;
      tx.update(roomRef, { status: 'RESULTS', revealedCards: {} });
    }).catch((err) => console.error('Erro na transição para RESULTS:', err));
  }, [status, judgeId, playerId, guessesComplete, roomRef]);

  /** Executa uma ação assíncrona com estado de carregamento e erro. */
  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      console.error(err);
      setError('Algo deu errado. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------- actions ------------------------------- */

  const handleNickname = (name) =>
    run(async () => {
      saveNickname(name);
      setPlayerName(name);
    });

  const handleChangeCycles = (c) => {
    const valid = clampCycles(c);
    updateDoc(roomRef, {
      cycles: valid,
      maxRounds: Math.max(players.length, 1) * valid,
    }).catch((err) => {
      console.error('Erro ao atualizar voltas:', err);
      setError('Não foi possível salvar a quantidade de voltas.');
    });
  };

  const handleStart = (chosenCycles) =>
    run(async () => {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        const r = snap.data();
        if (!r || r.status !== 'LOBBY') return;
        const ordered = getOrderedPlayers(r.players);
        if (ordered.length < 2) return;

        const cycles = clampCycles(chosenCycles ?? r.cycles);
        const maxRounds = ordered.length * cycles;

        // Sorteia o primeiro juiz aleatoriamente e fixa a sequência (judgeOrder)
        const startIdx = Math.floor(Math.random() * ordered.length);
        const judgeOrder = [
          ...ordered.slice(startIdx).map((p) => p.id),
          ...ordered.slice(0, startIdx).map((p) => p.id),
        ];

        const cards = drawCards(cardsData, r.usedCards || [], CARDS_PER_ROUND);
        tx.update(roomRef, {
          status: 'RANKING',
          round: 1,
          cycles,
          maxRounds,
          judgeOrder,
          currentJudgeId: judgeOrder[0],
          roundPlayerIds: ordered.map((p) => p.id),
          currentItems: cards,
          usedCards: computeUsedCards(r.usedCards || [], cards),
          secretRanking: [],
          guesses: {},
          revealedCards: {},
        });
      });
    });

  const handleConfirmRanking = (order) =>
    run(() =>
      updateDoc(roomRef, { secretRanking: order, guesses: {}, revealedCards: {}, status: 'GUESSING' })
    );

  const handleSubmitGuess = (order) =>
    run(async () => {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        const r = snap.data();
        if (!r || r.status !== 'GUESSING') return;
        if (!getRoundIds(r).includes(playerId) || playerId === r.currentJudgeId) return;
        const next = { ...r, guesses: { ...(r.guesses || {}), [playerId]: order } };
        const update = { [`guesses.${playerId}`]: order };
        if (allGuessesIn(next)) {
          update.status = 'RESULTS';
          update.revealedCards = {};
        }
        tx.update(roomRef, update);
      });
    });

  const handleReveal = (card, stage) =>
    run(() => updateDoc(roomRef, new FieldPath('revealedCards', card), stage));

  const handleNextRound = () =>
    run(async () => {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        const r = snap.data();
        if (
          !r ||
          r.status !== 'RESULTS' ||
          Object.values(r.revealedCards || {}).filter((v) => v === 'ALL').length !== CARDS_PER_ROUND
        ) {
          return;
        }

        const ordered = getOrderedPlayers(r.players);
        const update = {};

        ordered.forEach((p) => {
          if (p.id === r.currentJudgeId || !getRoundIds(r).includes(p.id)) return;
          const gained = calculateScore(r.secretRanking, r.guesses?.[p.id]);
          update[`players.${p.id}.score`] = p.score + gained;
        });

        if (r.round >= r.maxRounds) {
          update.status = 'FINISHED';
        } else {
          // Avança sequencialmente pela lista fixa judgeOrder (em loop)
          const activeOrder = getActiveJudgeOrder(r);
          const currentIdx = activeOrder.indexOf(r.currentJudgeId);
          const nextJudgeId = activeOrder[(currentIdx + 1) % activeOrder.length];

          const cards = drawCards(cardsData, r.usedCards || [], CARDS_PER_ROUND);
          update.round = r.round + 1;
          update.currentJudgeId = nextJudgeId;
          update.roundPlayerIds = Object.keys(r.players);
          update.currentItems = cards;
          update.usedCards = computeUsedCards(r.usedCards || [], cards);
          update.secretRanking = [];
          update.guesses = {};
          update.revealedCards = {};
          update.status = 'RANKING';
        }

        tx.update(roomRef, update);
      });
    });

  const handleReplay = () =>
    run(async () => {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        const r = snap.data();
        if (!r || r.status !== 'FINISHED') return;
        const playerIds = Object.keys(r.players || {});
        const cycles = clampCycles(r.cycles);
        const update = {
          status: 'LOBBY',
          round: 1,
          maxRounds: Math.max(playerIds.length, 1) * cycles,
          judgeOrder: [],
          roundPlayerIds: [],
          currentItems: [],
          secretRanking: [],
          guesses: {},
          revealedCards: {},
        };
        playerIds.forEach((id) => {
          update[`players.${id}.score`] = 0;
        });
        tx.update(roomRef, update);
      });
    });

  const handleRemovePlayer = (target) => {
    if (!window.confirm(`Remover ${target.name} da sala?`)) return;
    run(async () => {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        const r = snap.data();
        if (!r || !r.players?.[target.id] || target.id === r.hostId) return;

        const remainingPlayers = { ...r.players };
        delete remainingPlayers[target.id];
        const roundIds = getRoundIds(r).filter((id) => id !== target.id);
        const prevOrder = getActiveJudgeOrder(r);
        const nextJudgeOrder = prevOrder.filter((id) => id !== target.id);

        const update = {
          [`players.${target.id}`]: deleteField(),
          roundPlayerIds: roundIds,
          judgeOrder: nextJudgeOrder,
        };
        const inGame = ['RANKING', 'GUESSING', 'RESULTS'].includes(r.status);

        if (inGame) {
          if (roundIds.length < 2 || nextJudgeOrder.length < 1) {
            // Sobrou gente de menos: volta para o lobby
            Object.assign(update, {
              status: 'LOBBY',
              round: 1,
              judgeOrder: [],
              roundPlayerIds: [],
              currentItems: [],
              secretRanking: [],
              guesses: {},
              revealedCards: {},
            });
          } else if (target.id === r.currentJudgeId) {
            // Juiz removido: avança para o próximo em judgeOrder e recomeça a rodada
            const removedIdx = prevOrder.indexOf(target.id);
            const nextJudgeId =
              nextJudgeOrder[removedIdx >= 0 ? removedIdx % nextJudgeOrder.length : 0];
            const cards = drawCards(cardsData, r.usedCards || [], CARDS_PER_ROUND);
            Object.assign(update, {
              status: 'RANKING',
              currentJudgeId: nextJudgeId,
              currentItems: cards,
              usedCards: computeUsedCards(r.usedCards || [], cards),
              secretRanking: [],
              guesses: {},
              revealedCards: {},
            });
          } else {
            const { [target.id]: _removed, ...restGuesses } = r.guesses || {};
            update[`guesses.${target.id}`] = deleteField();
            const next = {
              ...r,
              players: remainingPlayers,
              roundPlayerIds: roundIds,
              guesses: restGuesses,
            };
            if (r.status === 'GUESSING' && allGuessesIn(next)) {
              update.status = 'RESULTS';
              update.revealedCards = {};
            }
          }
        }

        tx.update(roomRef, update);
      });
    });
  };

  /* -------------------------------- render -------------------------------- */

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-2 py-24 font-bold text-zinc-700 dark:text-zinc-300">
          <Loader2 className="h-5 w-5 animate-spin" /> Conectando à sala {roomId}...
        </div>
      </Shell>
    );
  }

  if (notFound) {
    return (
      <Shell>
        <Panel className="mt-10 space-y-4 text-center">
          <p className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-[#F8FAFC]">
            Sala {roomId} não encontrada
          </p>
          <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
            Confira o código ou crie uma nova sala.
          </p>
          <Link to="/" className="game-btn game-btn-white mx-auto inline-flex px-5 py-3 text-sm">
            <ArrowLeft className="h-4 w-4" /> Voltar ao início
          </Link>
        </Panel>
      </Shell>
    );
  }

  if (!room) {
    return (
      <Shell>
        <ErrorBanner message={error || 'Não foi possível carregar a sala.'} />
      </Shell>
    );
  }

  if (!playerName) {
    return <NicknameGate roomId={roomId} onSubmit={handleNickname} busy={busy} error={error} />;
  }

  if (!isInRoom) {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-2 py-24 font-bold text-zinc-700 dark:text-zinc-300">
          <Loader2 className="h-5 w-5 animate-spin" /> Entrando na sala...
        </div>
      </Shell>
    );
  }

  const isHost = playerId === room.hostId;
  const isJudge = playerId === room.currentJudgeId;
  const isSpectator =
    ['RANKING', 'GUESSING', 'RESULTS'].includes(room.status) &&
    !getRoundIds(room).includes(playerId);
  const judgeName = room.players?.[room.currentJudgeId]?.name ?? 'o juiz';
  // `key` por rodada: reinicia o estado local das listas ordenáveis a cada rodada
  const roundKey = `${room.round}-${(room.currentItems || []).join('|')}`;

  return (
    <Shell>
      <Header
        room={room}
        roomId={roomId}
        players={players}
        playerId={playerId}
        isHost={isHost}
        onRemove={handleRemovePlayer}
        onOpenHelp={() => setHelpOpen(true)}
      />
      <HowToPlayModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <div className="mb-3">
        <ErrorBanner message={error} />
      </div>

      {isSpectator && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border-2 border-zinc-900 dark:border-zinc-950 bg-sky-300 px-4 py-3 text-sm font-semibold text-zinc-950 shadow-[4px_4px_0px_#18181b] dark:shadow-[4px_4px_0px_#000000]">
          <Eye className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <strong className="font-extrabold">Partida em andamento!</strong> Você está assistindo esta rodada e entrará
            automaticamente na próxima.
          </span>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
        <div className="min-w-0">
          {room.status === 'LOBBY' && (
            <LobbyView
              room={room}
              players={players}
              isHost={isHost}
              busy={busy}
              onChangeCycles={handleChangeCycles}
              onStart={handleStart}
            />
          )}

          {room.status === 'RANKING' && (
            <RankingView
              key={roundKey}
              room={room}
              judgeName={judgeName}
              isJudge={isJudge}
              busy={busy}
              onConfirm={handleConfirmRanking}
            />
          )}

          {room.status === 'GUESSING' && (
            <GuessingView
              key={roundKey}
              room={room}
              players={players}
              playerId={playerId}
              judgeName={judgeName}
              isJudge={isJudge}
              isSpectator={isSpectator}
              busy={busy}
              onSubmit={handleSubmitGuess}
            />
          )}

          {room.status === 'RESULTS' && (
            <ResultsView
              room={room}
              players={players}
              playerId={playerId}
              judgeName={judgeName}
              isJudge={isJudge}
              isHost={isHost}
              busy={busy}
              onReveal={handleReveal}
              onNext={handleNextRound}
            />
          )}

          {room.status === 'FINISHED' && (
            <FinishedView
              players={players}
              playerId={playerId}
              isHost={isHost}
              busy={busy}
              onReplay={handleReplay}
            />
          )}
        </div>
        <Sidebar
          room={room}
          players={players}
          playerId={playerId}
          isHost={isHost}
          onRemove={handleRemovePlayer}
        />
      </div>
    </Shell>
  );
}
