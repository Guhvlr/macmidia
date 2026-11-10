import type { KanbanCard } from '@/contexts/app-types';

const COLUMN_KEY_ALIASES: Record<string, string> = {
  'aprovado-e-programar': 'aprovado-programar',
  'aprovado_programar': 'aprovado-programar',
  'aprovado': 'aprovado-programar',
  'postagem': 'aprovado-programar',
  'alteração': 'alteracao',
  'alteracoes': 'alteracao',
  'alterações': 'alteracao',
  'programar-para-mais-dias': 'programar-mais-dias',
  'para-produção': 'para-producao',
  'em-produção': 'em-producao',
  'para-correção': 'para-correcao',
  'correção-cliente': 'correcao-cliente',
  'correcao-do-cliente': 'correcao-cliente',
  'correção-do-cliente': 'correcao-cliente',
  'para-aprovacao-do-cliente': 'correcao-cliente',
  'para-aprovação-do-cliente': 'correcao-cliente',
  'correção-institucional': 'correcao-institucional',
  'correcao_institucional': 'correcao-institucional',
  'apro-e-institucional': 'aprovado-institucional',
  'apro-institucional': 'aprovado-institucional',
  'apro-calendario': 'aprovado-institucional',
  'apro-calendário': 'aprovado-institucional',
  'aprovado-e-institucional': 'aprovado-institucional',
  'aprovado_institucional': 'aprovado-institucional',
};

export function normalizeColumnKey(key?: string | null): string {
  if (!key) return 'para-producao';
  const trimmed = key.trim();
  const lower = trimmed.toLowerCase();
  return COLUMN_KEY_ALIASES[lower] || trimmed;
}

const timestampCache = new WeakMap<KanbanCard, number>();

/**
 * Returns the latest activity timestamp (in ms) for a card,
 * checking its action history and archivedAt timestamp.
 * Cached per card object reference via WeakMap for O(1) sort comparisons.
 */
export function getCardLatestTimestamp(card: KanbanCard): number {
  const cached = timestampCache.get(card);
  if (cached !== undefined) {
    return cached;
  }

  let latest = 0;

  if (Array.isArray(card.history) && card.history.length > 0) {
    for (const act of card.history) {
      if (act?.createdAt) {
        const t = Date.parse(act.createdAt);
        if (!Number.isNaN(t) && t > latest) {
          latest = t;
        }
      }
    }
  }

  if (card.archivedAt) {
    const t = Date.parse(card.archivedAt);
    if (!Number.isNaN(t) && t > latest) {
      latest = t;
    }
  }

  timestampCache.set(card, latest);
  return latest;
}

const movedTimestampCache = new WeakMap<KanbanCard, number>();

/**
 * Returns when the card last entered its current column (in ms):
 * the most recent 'move' or 'create' history entry. Edits, comments and uploads
 * do NOT count, so working on a card doesn't push it to the top.
 * Falls back to archivedAt (set when moved to 'postado').
 */
export function getCardLastMovedTimestamp(card: KanbanCard): number {
  const cached = movedTimestampCache.get(card);
  if (cached !== undefined) {
    return cached;
  }

  let latest = 0;
  if (Array.isArray(card.history)) {
    for (const act of card.history) {
      if (act?.createdAt && (act.actionType === 'move' || act.actionType === 'create')) {
        const t = Date.parse(act.createdAt);
        if (!Number.isNaN(t) && t > latest) {
          latest = t;
        }
      }
    }
  }

  if (card.archivedAt) {
    const t = Date.parse(card.archivedAt);
    if (!Number.isNaN(t) && t > latest) {
      latest = t;
    }
  }

  movedTimestampCache.set(card, latest);
  return latest;
}

const MANUAL_POS_THRESHOLD = -10_000_000;
const BASE_2024_MS = 1704067200000; // Date.UTC(2024, 0, 1)

/**
 * Maps every card onto a unified negative position scale (<= -10,000,000) so that:
 * 1. Existing/legacy cards (which have raw position_index > -10,000,000) automatically
 *    sort with the MOST RECENTLY MOVED cards at the top (more negative = higher up).
 * 2. Any card manually reordered inside a column (or newly moved to the top of a column)
 *    is assigned an explicit position_index <= -10,000,000 on this exact same scale,
 *    allowing full manual drag-and-drop ordering anywhere in the column.
 */
export function getEffectivePositionIndex(card: KanbanCard): number {
  const raw = card.position_index ?? 0;
  if (raw <= MANUAL_POS_THRESHOLD) {
    return raw;
  }

  const movedMs = getCardLastMovedTimestamp(card);
  if (movedMs > 0) {
    const secSince2024 = Math.max(0, Math.floor((movedMs - BASE_2024_MS) / 1000));
    return -30_000_000 - secSince2024;
  }

  // Cards without move history sit below dated cards, preserving their relative order
  const clampedRaw = Math.min(10_000_000, Math.max(0, raw));
  return -30_000_000 + clampedRaw;
}

/**
 * Deterministic comparator for Kanban cards within a column.
 * 1. Primary sort: unified effective position_index ascending (most recent / top-placed first,
 *    while respecting manual drag-and-drop reordering inside the column).
 * 2. Tie-breaker: most recently moved timestamp descending.
 * 3. Tie-breaker: raw position_index ascending.
 * 4. Final tie-breaker: card ID.
 */
export function compareKanbanCards(a: KanbanCard, b: KanbanCard): number {
  const effA = getEffectivePositionIndex(a);
  const effB = getEffectivePositionIndex(b);
  if (effA !== effB) {
    return effA - effB;
  }

  const movedA = getCardLastMovedTimestamp(a);
  const movedB = getCardLastMovedTimestamp(b);
  if (movedA !== movedB) {
    return movedB - movedA;
  }

  const posA = a.position_index ?? 0;
  const posB = b.position_index ?? 0;
  if (posA !== posB) {
    return posA - posB;
  }

  return a.id.localeCompare(b.id);
}

/**
 * Computes a position_index guaranteed to place a card at the VERY TOP (#1)
 * of the target column across all boards (Employee, PostingBoard, CorrectionBoard).
 */
export function getTopPositionIndex(
  allCards: KanbanCard[],
  targetColumn: string,
  excludeCardId?: string
): number {
  const normalizedTarget = normalizeColumnKey(targetColumn);
  const colCards = allCards.filter(
    c => normalizeColumnKey(c.column) === normalizedTarget && c.id !== excludeCardId
  );

  const nowSecSince2024 = Math.max(0, Math.floor((Date.now() - BASE_2024_MS) / 1000));
  const nowEffective = -30_000_000 - nowSecSince2024;

  if (colCards.length === 0) {
    return nowEffective - 1024;
  }

  const minEffective = Math.min(...colCards.map(c => getEffectivePositionIndex(c)));
  return Math.min(minEffective, nowEffective) - 1024;
}

/**
 * Computes minimal position_index updates when placing/reordering a card at `targetIndex`
 * inside an already-sorted list of cards (`cardsWithoutActive`).
 */
export function computePositionUpdatesAtIndex(
  allCards: KanbanCard[],
  cardsWithoutActive: KanbanCard[],
  activeCardId: string,
  targetColumn: string,
  targetIndex: number
): { id: string; position_index: number; column?: string }[] {
  const clampedIndex = Math.max(0, Math.min(targetIndex, cardsWithoutActive.length));

  // Moving to the top (position 0) -> always place strictly above all cards in this column
  if (clampedIndex === 0 || cardsWithoutActive.length === 0) {
    return [
      {
        id: activeCardId,
        position_index: getTopPositionIndex(allCards, targetColumn, activeCardId),
        column: targetColumn,
      },
    ];
  }

  // Moving to the bottom of the list
  if (clampedIndex >= cardsWithoutActive.length) {
    const lastCard = cardsWithoutActive[cardsWithoutActive.length - 1];
    const maxInList = Math.max(...cardsWithoutActive.map(c => getEffectivePositionIndex(c)));
    const basePos = Math.max(getEffectivePositionIndex(lastCard), maxInList);
    return [
      {
        id: activeCardId,
        position_index: Math.min(MANUAL_POS_THRESHOLD, basePos + 1024),
        column: targetColumn,
      },
    ];
  }

  // Moving between prevCard and nextCard
  const prevCard = cardsWithoutActive[clampedIndex - 1];
  const nextCard = cardsWithoutActive[clampedIndex];
  const prevPos = getEffectivePositionIndex(prevCard);
  const nextPos = getEffectivePositionIndex(nextCard);

  if (nextPos - prevPos >= 2) {
    return [
      {
        id: activeCardId,
        position_index: Math.min(MANUAL_POS_THRESHOLD, Math.floor((prevPos + nextPos) / 2)),
        column: targetColumn,
      },
    ];
  }

  // If prevCard and nextCard have identical or adjacent effective position values,
  // re-space only the prefix up to clampedIndex so all items before nextCard are strictly ordered.
  const newOrderPrefix = [...cardsWithoutActive.slice(0, clampedIndex), { id: activeCardId } as KanbanCard];
  const count = newOrderPrefix.length;
  return newOrderPrefix.map((c, idx) => ({
    id: c.id,
    position_index: Math.min(MANUAL_POS_THRESHOLD, nextPos - (count - idx) * 1024),
    ...(c.id === activeCardId ? { column: targetColumn } : {}),
  }));
}
