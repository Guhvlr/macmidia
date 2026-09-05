import type { CalendarTask, KanbanCard } from '@/contexts/app-types';
import { isFinalColumn } from '@/features/kanban/utils/stuckCards';

export type TaskStatusType = 'completed' | 'overdue' | 'in_progress' | 'pending';

export interface TaskStatusInfo {
  statusType: TaskStatusType;
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  isOverdue: boolean;
  linkedCard?: KanbanCard;
}

export function getCalendarTaskStatus(
  task: CalendarTask, 
  kanbanCards: KanbanCard[] = []
): TaskStatusInfo {
  // 1. Find linked Kanban Card (by linked_card_id or client/title match)
  let linkedCard: KanbanCard | undefined = undefined;

  if ((task as any).linked_card_id) {
    linkedCard = kanbanCards.find(c => c.id === (task as any).linked_card_id);
  }

  // Fallback match ONLY if task has content or description to match specifically.
  // Never match purely by clientName alone, as that returns a random card of that client.
  if (!linkedCard && task.clientName && (task.content || task.description)) {
    const taskText = (task.content || task.description || '').trim().toLowerCase();
    if (taskText.length >= 3) {
      linkedCard = kanbanCards.find(c => 
        c.clientName?.toLowerCase() === task.clientName?.toLowerCase() &&
        ((c.description && c.description.toLowerCase().includes(taskText)) ||
         (c.originalMessage && c.originalMessage.toLowerCase().includes(taskText)))
      );
    }
  }

  const rawStatus = (task.status || '').toLowerCase().trim();
  const isCardCompleted = linkedCard ? isFinalColumn(linkedCard.column) : false;

  // Explicit status checks override default linked card in_progress banner
  if (rawStatus === 'para correção' || rawStatus === 'para-correcao' || rawStatus === 'correcao-cliente') {
    return {
      statusType: 'overdue',
      label: '🔴 Para Correção',
      badgeBg: 'bg-red-500/20',
      badgeText: 'text-red-400 font-bold',
      badgeBorder: 'border-red-500/40',
      isOverdue: false,
      linkedCard
    };
  }

  if (rawStatus === 'alteração' || rawStatus === 'alteracao') {
    return {
      statusType: 'in_progress',
      label: '🟠 Em Alteração',
      badgeBg: 'bg-orange-500/20',
      badgeText: 'text-orange-400 font-bold',
      badgeBorder: 'border-orange-500/40',
      isOverdue: false,
      linkedCard
    };
  }

  if (rawStatus === 'publicado') {
    return {
      statusType: 'in_progress',
      label: '🔵 Aprovação Cliente',
      badgeBg: 'bg-blue-500/20',
      badgeText: 'text-blue-400 font-bold',
      badgeBorder: 'border-blue-500/40',
      isOverdue: false,
      linkedCard
    };
  }

  if (rawStatus === 'reprovado') {
    return {
      statusType: 'overdue',
      label: '💔 Reprovado',
      badgeBg: 'bg-rose-500/20',
      badgeText: 'text-rose-400 font-bold',
      badgeBorder: 'border-rose-500/40',
      isOverdue: false,
      linkedCard
    };
  }

  if (isCardCompleted || rawStatus === 'aprovado' || rawStatus === 'aprovado-programar' || rawStatus === 'concluido' || rawStatus === 'concluído') {
    return {
      statusType: 'completed',
      label: '🟢 Aprovado / Concluído',
      badgeBg: 'bg-emerald-500/20',
      badgeText: 'text-emerald-400 font-bold',
      badgeBorder: 'border-emerald-500/30',
      isOverdue: false,
      linkedCard
    };
  }

  if (rawStatus === 'em produção' || rawStatus === 'em producao') {
    return {
      statusType: 'in_progress',
      label: '🟡 Aprovado MAC',
      badgeBg: 'bg-yellow-500/20',
      badgeText: 'text-yellow-400 font-bold',
      badgeBorder: 'border-yellow-500/40',
      isOverdue: false,
      linkedCard
    };
  }

  // Check if date is overdue
  const todayStr = new Date().toISOString().split('T')[0];
  const isPastDate = task.date < todayStr;

  if (isPastDate) {
    return {
      statusType: 'overdue',
      label: '🔴 ATRASADO (Prazo Estourado)',
      badgeBg: 'bg-red-500/20',
      badgeText: 'text-red-400 animate-pulse',
      badgeBorder: 'border-red-500/40',
      isOverdue: true,
      linkedCard
    };
  }

  if (linkedCard) {
    return {
      statusType: 'in_progress',
      label: '🟡 Em Produção no Kanban',
      badgeBg: 'bg-amber-500/20',
      badgeText: 'text-amber-400 font-bold',
      badgeBorder: 'border-amber-500/30',
      isOverdue: false,
      linkedCard
    };
  }

  return {
    statusType: 'pending',
    label: '⚪ Pendente de Envio',
    badgeBg: 'bg-zinc-500/20',
    badgeText: 'text-zinc-400',
    badgeBorder: 'border-zinc-500/30',
    isOverdue: false
  };
}
