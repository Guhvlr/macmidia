import type { KanbanCard } from '@/contexts/app-types';

export interface StuckCardInfo {
  card: KanbanCard;
  hoursInactive: number;
  formattedInactiveTime: string;
  lastActivityDate: Date;
  isUrgent: boolean;
}

export function isFinalColumn(columnName?: string): boolean {
  if (!columnName) return false;
  const col = columnName.toLowerCase();
  return (
    col.includes('aprovado') || 
    col.includes('programar') || 
    col.includes('concluido') || 
    col.includes('concluído') ||
    col.includes('finalizado') ||
    col.includes('finalizada') ||
    col.includes('finalizad') ||
    col.includes('postado') ||
    col.includes('postagem') ||
    col.includes('publicado') ||
    col.includes('feito')
  );
}

export function formatInactiveTime(hours: number): string {
  if (!hours || hours <= 0) return '0h';
  if (hours < 24) return `${hours}h`;
  
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (remainingHours === 0) {
    return `${days} ${days === 1 ? 'dia' : 'dias'}`;
  }

  return `${days}d ${remainingHours}h`;
}

export function getStuckCards(cards: KanbanCard[], thresholdHours = 24): StuckCardInfo[] {
  const now = new Date().getTime();

  return cards
    .filter(card => !isFinalColumn(card.column))
    .map(card => {
      let latestTime = 0;

      // 1. Check card history
      if (Array.isArray(card.history) && card.history.length > 0) {
        card.history.forEach((act: any) => {
          if (act.createdAt) {
            const t = new Date(act.createdAt).getTime();
            if (t > latestTime) latestTime = t;
          }
        });
      }

      // 2. Check comments
      if (Array.isArray(card.comments) && card.comments.length > 0) {
        card.comments.forEach((c: any) => {
          if (c.createdAt) {
            const t = new Date(c.createdAt).getTime();
            if (t > latestTime) latestTime = t;
          }
        });
      }

      // Fallback: If no activity timestamp found, assume card creation or 36h
      if (latestTime === 0) {
        latestTime = now - 36 * 3600 * 1000;
      }

      const diffMs = now - latestTime;
      const hoursInactive = Math.floor(diffMs / (1000 * 60 * 60));
      const formattedInactiveTime = formatInactiveTime(hoursInactive);

      const isUrgent = Array.isArray(card.labels) && card.labels.some(l => l.toUpperCase().includes('URGENTE'));

      return {
        card,
        hoursInactive,
        formattedInactiveTime,
        lastActivityDate: new Date(latestTime),
        isUrgent
      };
    })
    .filter(info => info.hoursInactive >= thresholdHours)
    .sort((a, b) => b.hoursInactive - a.hoursInactive);
}
