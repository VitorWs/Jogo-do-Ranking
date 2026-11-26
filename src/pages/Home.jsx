import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import {
  AlertCircle,
  ArrowRight,
  Crown,
  Gamepad2,
  HelpCircle,
  Loader2,
  Plus,
  User,
  Users,
} from 'lucide-react';
import { HowToPlaySteps } from '../components/HowToPlayModal.jsx';
import SoundToggle from '../components/SoundToggle.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { db } from '../services/firebase';
import { generateRoomCode } from '../utils/gameLogic';
import {
  getOrCreatePlayerId,
  getSavedNickname,
  saveNickname,
} from '../utils/playerSession';

const DECORATIVE_CARDS = [
  // Topo e cantos superiores
  'bg-pink-500 -left-6 top-8 sm:left-8 sm:top-8 -rotate-12',
  'hidden md:block bg-emerald-500 left-[17%] -top-7 rotate-[18deg]',
  'bg-amber-400 left-[32%] -top-14 sm:left-[33%] sm:-top-10 -rotate-6',
  'hidden md:block bg-purple-500 right-[27%] -top-9 rotate-12',
  'hidden md:block bg-pink-500 right-24 -top-5 -rotate-[18deg]',
  'bg-sky-500 -right-5 top-24 sm:right-8 sm:top-24 rotate-[15deg]',
  // Laterais intermediárias (ocultas no celular)
  'hidden md:block bg-sky-500 -left-4 top-[31%] md:left-4 lg:left-14 rotate-[22deg]',
  'hidden md:block bg-amber-400 -left-5 top-[57%] md:left-8 lg:left-24 -rotate-[18deg]',
  'hidden md:block bg-sky-500 -left-3 bottom-28 md:left-3 lg:left-10 rotate-[16deg]',
  'hidden md:block bg-emerald-500 -right-5 top-[47%] md:right-6 lg:right-20 -rotate-[22deg]',
  'hidden md:block bg-purple-500 -right-3 bottom-32 md:right-4 lg:right-12 rotate-[24deg]',
  // Base e cantos inferiores
  'bg-purple-500 -bottom-6 left-4 sm:bottom-6 sm:left-20 rotate-6',
  'hidden md:block bg-pink-500 left-[26%] -bottom-10 -rotate-[14deg]',
  'bg-emerald-500 right-[32%] -bottom-14 sm:right-[27%] sm:-bottom-9 rotate-[20deg]',
  'bg-amber-400 -bottom-5 right-4 sm:bottom-6 sm:right-20 -rotate-12',
];

export default function Home() {
  const navigate = useNavigate();
  const [playerId] = useState(() => getOrCreatePlayerId());
  const [nickname, setNickname] = useState(() => getSavedNickname());
  const [roomCode, setRoomCode] = useState('');
  const [activeTab, setActiveTab] = useState('play'); // 'play' | 'rules'
  const [loadingAction, setLoadingAction] = useState(null); // 'create' | 'join' | null
  const [error, setError] = useState('');

  const handleNicknameChange = (e) => {
    const value = e.target.value;
    setNickname(value);
    saveNickname(value);
    if (error) setError('');
  };

  const handleRoomCodeChange = (e) => {
    const sanitized = e.target.value
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase()
      .slice(0, 4);
    setRoomCode(sanitized);
    if (error) setError('');
  };

  const validateNickname = () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError('Escolha um apelido antes de criar ou entrar em uma sala.');
      return null;
    }
    saveNickname(trimmed);
    setNickname(trimmed);
    return trimmed;
  };

  const handleCreateRoom = async () => {
    if (loadingAction) return;
    const trimmedName = validateNickname();
    if (!trimmedName) return;

    setError('');
    setLoadingAction('create');

    try {
      let chosenCode = null;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = generateRoomCode();
        const snapshot = await getDoc(doc(db, 'rooms', candidate));
        if (!snapshot.exists()) {
          chosenCode = candidate;
          break;
        }
      }

      if (!chosenCode) {
        setError('Não foi possível gerar um código de sala único. Tente novamente.');
        return;
      }

      await setDoc(doc(db, 'rooms', chosenCode), {
        roomId: chosenCode,
        hostId: playerId,
        status: 'LOBBY',
        round: 1,
        cycles: 2,
        maxRounds: 2,
        currentJudgeId: playerId,
        judgeOrder: [],
        usedCards: [],
        currentItems: [],
        secretRanking: [],
        guesses: {},
        revealedCards: {},
        roundPlayerIds: [],
        roundHistory: [],
        players: {
          [playerId]: {
            name: trimmedName,
            score: 0,
            exactHits: 0,
            joinedAt: Date.now(),
          },
        },
      });

      navigate(`/sala/${chosenCode}`);
    } catch (err) {
      console.error('Erro ao criar sala:', err);
      setError('Erro ao criar a sala no servidor. Verifique sua conexão e tente novamente.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (loadingAction) return;

    const trimmedName = validateNickname();
    if (!trimmedName) return;

    if (roomCode.length !== 4) {
      setError('Digite o código completo de 4 letras da sala.');
      return;
    }

    setError('');
    setLoadingAction('join');

    try {
      const roomRef = doc(db, 'rooms', roomCode);
      const snapshot = await getDoc(roomRef);

      if (!snapshot.exists()) {
        setError('Sala não encontrada. Verifique o código e tente novamente.');
        return;
      }

      const roomData = snapshot.data();
      if (!roomData?.players?.[playerId]) {
        await updateDoc(roomRef, {
          [`players.${playerId}`]: {
            name: trimmedName,
            score: 0,
            exactHits: 0,
            joinedAt: Date.now(),
          },
        });
      }

      navigate(`/sala/${roomCode}`);
    } catch (err) {
      console.error('Erro ao entrar na sala:', err);
      setError('Erro ao entrar na sala. Tente novamente.');
    } finally {
      setLoadingAction(null);
    }
  };

  const isBusy = loadingAction !== null;

  return (
    <div className="table-bg relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-14 font-sans text-zinc-900 dark:text-[#F8FAFC] sm:py-12">
      {/* Peças decorativas espalhadas pela mesa (15 cartas lisas nas 5 cores oficiais) */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-0 overflow-hidden"
      >
        {DECORATIVE_CARDS.map((cardClasses, idx) => (
          <div
            key={idx}
            className={`pointer-events-none select-none absolute h-24 w-16 sm:h-32 sm:w-20 rounded-xl border-2 border-zinc-900 dark:border-zinc-950 shadow-[4px_4px_0px_#18181b] dark:shadow-[4px_4px_0px_#000000] ${cardClasses}`}
          />
        ))}
      </div>

      {/* Botões de som e tema no canto superior */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-2 sm:right-5 sm:top-5">
        <SoundToggle />
        <ThemeToggle />
      </div>

      <main className="relative z-10 w-full max-w-md">
        {/* Caixa de board game */}
        <section className="overflow-hidden rounded-3xl border-2 border-zinc-900 dark:border-zinc-700 bg-white dark:bg-[#1D1F27] shadow-[8px_8px_0px_#18181b] dark:shadow-[8px_8px_0px_#000000]">
          <header className="space-y-3 border-b-2 border-zinc-900 dark:border-zinc-950 bg-emerald-500 px-5 pb-5 pt-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-zinc-900 dark:border-zinc-950 bg-amber-400 shadow-[3px_3px_0px_#18181b] dark:shadow-[3px_3px_0px_#000000]">
              <Crown className="h-7 w-7 text-zinc-950" />
            </div>

            <h1 className="text-4xl font-extrabold uppercase leading-[0.95] tracking-tighter text-zinc-950 sm:text-5xl">
              Jogo do
              <span className="mt-1 block text-white [text-shadow:3px_3px_0_#18181b]">Ranking</span>
            </h1>

            <p className="mx-auto max-w-xs text-sm font-bold leading-snug text-zinc-950">
              5 cartas na mesa. Descubra a ordem secreta do jogador da rodada e marque pontos!
            </p>
          </header>

          {/* Abas: Jogar / Como Jogar */}
          <div className="grid grid-cols-2 gap-2.5 border-b-2 border-zinc-900 dark:border-zinc-700 bg-[#FFFBF2] dark:bg-[#161821] p-3">
            <button
              type="button"
              onClick={() => setActiveTab('play')}
              className={`game-btn game-btn-sm py-2.5 text-sm ${
                activeTab === 'play' ? 'game-btn-emerald' : 'game-btn-white'
              }`}
            >
              <Gamepad2 className="h-4 w-4" />
              Jogar
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className={`game-btn game-btn-sm py-2.5 text-sm ${
                activeTab === 'rules' ? 'game-btn-gold' : 'game-btn-white'
              }`}
            >
              <HelpCircle className="h-4 w-4" />
              Como Jogar
            </button>
          </div>

          {activeTab === 'play' ? (
            <>
              <div className="space-y-5 p-5 sm:p-6">
                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-2xl border-2 border-zinc-900 dark:border-zinc-950 bg-rose-300 px-4 py-3 text-sm font-bold text-zinc-950 shadow-[3px_3px_0px_#18181b] dark:shadow-[3px_3px_0px_#000000]"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Apelido */}
                <div className="space-y-2">
                  <label
                    htmlFor="nickname-input"
                    className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-zinc-700 dark:text-zinc-200"
                  >
                    <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Seu Apelido
                  </label>
                  <input
                    id="nickname-input"
                    type="text"
                    value={nickname}
                    onChange={handleNicknameChange}
                    placeholder="Ex: noobmaster69, auramaxego..."
                    maxLength={20}
                    autoComplete="nickname"
                    disabled={isBusy}
                    className="game-input"
                  />
                </div>

                {/* Criar sala */}
                <button
                  type="button"
                  onClick={handleCreateRoom}
                  disabled={isBusy}
                  className="game-btn game-btn-emerald w-full py-4 text-lg"
                >
                  {loadingAction === 'create' ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Criando sala...
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5" />
                      Criar Nova Sala
                    </>
                  )}
                </button>

                {/* Divisor */}
                <div className="flex items-center gap-3">
                  <div className="h-0.5 flex-1 bg-zinc-900 dark:bg-zinc-700" />
                  <span className="shrink-0 text-xs font-extrabold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                    ou entre em uma
                  </span>
                  <div className="h-0.5 flex-1 bg-zinc-900 dark:bg-zinc-700" />
                </div>

                {/* Entrar */}
                <form onSubmit={handleJoinRoom} className="space-y-3">
                  <label
                    htmlFor="room-code-input"
                    className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-zinc-700 dark:text-zinc-200"
                  >
                    <Users className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                    Código da Sala
                  </label>

                  <div className="flex gap-3">
                    <input
                      id="room-code-input"
                      type="text"
                      value={roomCode}
                      onChange={handleRoomCodeChange}
                      placeholder="ABCD"
                      maxLength={4}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      disabled={isBusy}
                      className="game-input min-w-0 flex-1 text-center text-2xl font-extrabold uppercase tracking-[0.3em]"
                    />
                    <button
                      type="submit"
                      disabled={isBusy}
                      className="game-btn game-btn-gold shrink-0 px-5 text-base"
                    >
                      {loadingAction === 'join' ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          Entrar
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Faixa de regras rápidas */}
              <footer className="grid grid-cols-3 border-t-2 border-zinc-900 dark:border-zinc-700 bg-[#FFFBF2] dark:bg-[#161821] text-center">
                <div className="border-r-2 border-zinc-900 dark:border-zinc-700 px-2 py-3">
                  <span className="block text-xl font-extrabold tracking-tighter text-pink-500">
                    5
                  </span>
                  <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                    Cartas/rodada
                  </span>
                </div>
                <div className="border-r-2 border-zinc-900 dark:border-zinc-700 px-2 py-3">
                  <span className="block text-xl font-extrabold tracking-tighter text-emerald-500">
                    +1
                  </span>
                  <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                    Por posição
                  </span>
                </div>
                <div className="px-2 py-3">
                  <span className="block text-xl font-extrabold tracking-tighter text-amber-500 dark:text-amber-400">
                    +2
                  </span>
                  <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                    Bônus perfeito
                  </span>
                </div>
              </footer>
            </>
          ) : (
            <div className="space-y-4 p-4 sm:p-5">
              <HowToPlaySteps />
              <button
                type="button"
                onClick={() => setActiveTab('play')}
                className="game-btn game-btn-emerald w-full py-3.5 text-base"
              >
                <Gamepad2 className="h-5 w-5" />
                Ir para o Jogo
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
