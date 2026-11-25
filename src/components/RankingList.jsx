import { useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';

/**
 * Cores oficiais das posições (1º ao 5º):
 * 1º Rosa, 2º Verde, 3º Azul, 4º Amarelo, 5º Roxo.
 */
export const POSITION_BADGES = [
  'bg-pink-500 text-white',
  'bg-emerald-500 text-white',
  'bg-sky-500 text-white',
  'bg-amber-400 text-zinc-950',
  'bg-purple-500 text-white',
];

function SortableCard({ id, position, isFirst, isLast, disabled, isDragging, onMove }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    touchAction: disabled ? undefined : 'none',
  };

  const stopDrag = (e) => {
    e.stopPropagation();
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-2.5 rounded-2xl border-2 p-2.5 select-none transition-[box-shadow,transform] duration-100 ${
        disabled
          ? 'cursor-not-allowed opacity-75'
          : 'cursor-grab active:cursor-grabbing'
      } ${
        isDragging
          ? 'border-zinc-900 dark:border-amber-400 bg-amber-50 dark:bg-[#262936] ring-4 ring-amber-400 shadow-[8px_8px_0px_#18181b] dark:shadow-[8px_8px_0px_#000000]'
          : 'border-zinc-900 dark:border-zinc-700 bg-white dark:bg-[#1D1F27] shadow-[4px_4px_0px_#18181b] dark:shadow-[4px_4px_0px_#000000] hover:ring-4 hover:ring-emerald-500 dark:hover:ring-emerald-400 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#18181b] dark:active:shadow-[2px_2px_0px_#000000]'
      }`}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-zinc-900 dark:border-zinc-950 shadow-[2px_2px_0px_#18181b] dark:shadow-[2px_2px_0px_#000000] ${
          POSITION_BADGES[position - 1] ?? 'bg-zinc-200 text-zinc-950'
        }`}
      >
        <span className="text-xl font-extrabold leading-none tracking-tighter tabular-nums">
          {position}º
        </span>
      </div>

      <p className="min-w-0 flex-1 text-base font-extrabold leading-snug tracking-tight text-zinc-900 dark:text-[#F8FAFC] break-words sm:text-lg">
        {id}
      </p>

      <GripVertical
        aria-hidden="true"
        className="hidden sm:block h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-500"
      />

      <div
        className="flex shrink-0 flex-col gap-1.5"
        onPointerDown={stopDrag}
        onTouchStart={stopDrag}
        onKeyDown={stopDrag}
      >
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={disabled || isFirst}
          aria-label={`Subir "${id}"`}
          className="game-btn game-btn-white game-btn-sm h-8 w-9 !p-0"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={disabled || isLast}
          aria-label={`Descer "${id}"`}
          className="game-btn game-btn-white game-btn-sm h-8 w-9 !p-0"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

/**
 * Lista ordenável das cartas (1º no topo ... 5º na base).
 * - Arraste clicando/tocando em qualquer ponto da carta; a numeração atualiza ao vivo.
 * - Botões de seta (↑ e ↓) continuam disponíveis como alternativa rápida.
 */
export default function RankingList({ items, onChange, disabled = false }) {
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Ordem projetada durante o arrasto (usada para renderizar a numeração ao vivo)
  const projected =
    activeId !== null && overId !== null && activeId !== overId
      ? arrayMove(items, items.indexOf(activeId), items.indexOf(overId))
      : items;

  const resetDrag = () => {
    setActiveId(null);
    setOverId(null);
  };

  const handleDragEnd = () => {
    if (projected !== items) onChange(projected);
    resetDrag();
  };

  const moveBy = (index, delta) => {
    const to = index + delta;
    if (disabled || to < 0 || to >= items.length) return;
    onChange(arrayMove(items, index, to));
  };

  return (
    <div className="space-y-3">
      <p className="rounded-xl border-2 border-dashed border-zinc-900 dark:border-zinc-600 bg-[#FFFBF2] dark:bg-[#161821] px-3 py-2 text-center text-xs font-extrabold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
        Ordene do 1º (topo) ao 5º (base)
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragStart={({ active }) => {
          setActiveId(active.id);
          setOverId(active.id);
        }}
        onDragOver={({ over }) => setOverId(over ? over.id : null)}
        onDragEnd={handleDragEnd}
        onDragCancel={resetDrag}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <ol className="space-y-3 pr-1 pb-1">
            {items.map((item, index) => (
              <SortableCard
                key={item}
                id={item}
                position={projected.indexOf(item) + 1}
                isFirst={index === 0}
                isLast={index === items.length - 1}
                disabled={disabled}
                isDragging={activeId === item}
                onMove={(delta) => moveBy(index, delta)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}
