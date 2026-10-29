import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, MessageSquare, AlignLeft, Barcode, ChevronRight, Layout, Sparkles, User, Users } from 'lucide-react';
import { useApp } from '@/contexts/useApp';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { KanbanCard as KanbanCardType } from '@/contexts/app-types';
import CardDetailDialog from './CardDetailDialog';
import { cn } from '@/lib/utils';
import { getCardLatestTimestamp } from '../utils/cardOrder';

const normalizeText = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const KanbanSearch = () => {
  const { kanbanCards, employees, memberFilter, setMemberFilter, loggedUserRole, loggedUserClientLink } = useApp();
  
  const filteredKanbanCards = useMemo(() => {
    if (loggedUserRole !== 'GUEST') return kanbanCards;
    if (!loggedUserClientLink) return [];
    
    const allowedClients = loggedUserClientLink.split(',').map(id => id.trim());
    return kanbanCards.filter(card => allowedClients.includes(card.calendarClientId || ''));
  }, [kanbanCards, loggedUserRole, loggedUserClientLink]);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<KanbanCardType | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close search on escape or outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const trimmedQuery = query.trim();

  const { results, totalMatches } = useMemo(() => {
    const normQuery = normalizeText(trimmedQuery);
    
    // Base filter: if no query and no member, return nothing (or handle initial state)
    if (!normQuery && memberFilter.length === 0) return { results: [] as KanbanCardType[], totalMatches: 0 };

    const matched: { card: KanbanCardType; score: number; latestTs: number }[] = [];

    for (const card of filteredKanbanCards) {
      // Member filter
      if (memberFilter.length > 0) {
        const isAssigned = card.assignedUsers?.some(u => memberFilter.includes(u.id));
        const isEmployee = memberFilter.includes(card.employeeId);
        if (!isAssigned && !isEmployee) continue;
      }

      if (!normQuery) {
        matched.push({
          card,
          score: card.column !== 'postado' ? 10 : 0,
          latestTs: getCardLatestTimestamp(card),
        });
        continue;
      }

      const normName = normalizeText(card.clientName);
      const normFolder = normalizeText(card.calendarClientName);
      const normDesc = normalizeText(card.description);
      const normOrig = normalizeText(card.originalMessage);
      const normNotes = normalizeText(card.notes);
      const matchLabels = card.labels?.some(l => normalizeText(l).includes(normQuery));
      const matchComments = card.comments?.some(c => normalizeText(c.text).includes(normQuery));

      const matchName = normName.includes(normQuery);
      const matchFolder = normFolder.includes(normQuery);
      const matchDesc = normDesc.includes(normQuery);
      const matchOrig = normOrig.includes(normQuery);
      const matchNotes = normNotes.includes(normQuery);

      if (!matchName && !matchFolder && !matchDesc && !matchOrig && !matchNotes && !matchLabels && !matchComments) {
        continue;
      }

      let score = 0;
      if (normName === normQuery) score += 100;
      else if (normName.startsWith(normQuery)) score += 80;
      else if (matchName) score += 60;
      if (matchFolder) score += 45;
      if (matchLabels) score += 30;
      if (matchDesc || matchOrig || matchNotes || matchComments) score += 15;
      if (card.column !== 'postado' && !card.archivedAt) score += 10;

      matched.push({
        card,
        score,
        latestTs: getCardLatestTimestamp(card),
      });
    }

    matched.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.latestTs !== a.latestTs) return b.latestTs - a.latestTs;
      return (a.card.position_index ?? 0) - (b.card.position_index ?? 0);
    });

    return {
      results: matched.slice(0, 60).map(m => m.card),
      totalMatches: matched.length,
    };
  }, [filteredKanbanCards, trimmedQuery, memberFilter]);

  const highlightMatch = (text: string, q: string) => {
    const cleanQ = q.trim();
    if (!cleanQ || !text) return text;
    try {
      const escaped = escapeRegExp(cleanQ);
      const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
      return (
        <span className="break-all">
          {parts.map((part, i) => 
            normalizeText(part) === normalizeText(cleanQ)
              ? <span key={i} className="text-primary font-bold bg-primary/10 px-0.5 rounded-sm">{part}</span> 
              : part
          )}
        </span>
      );
    } catch {
      return text;
    }
  };

  const getSnippet = (text: string, q: string) => {
    if (!text) return '';
    const cleanQ = q.trim();
    const index = normalizeText(text).indexOf(normalizeText(cleanQ));
    if (index === -1) return text.substring(0, 80) + (text.length > 80 ? '...' : '');
    
    const start = Math.max(0, index - 30);
    const end = Math.min(text.length, index + cleanQ.length + 50);
    let snippet = text.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    return snippet;
  };

  const findWhereMatch = (card: KanbanCardType, q: string) => {
    const normQ = normalizeText(q.trim());
    if (!normQ) return null;
    if (card.calendarClientName && normalizeText(card.calendarClientName).includes(normQ)) {
      return { label: 'Pasta', text: card.calendarClientName };
    }
    if (card.description && normalizeText(card.description).includes(normQ)) return { label: 'Descrição', text: card.description };
    if (card.originalMessage && normalizeText(card.originalMessage).includes(normQ)) return { label: 'Original', text: card.originalMessage };
    if (card.notes && normalizeText(card.notes).includes(normQ)) return { label: 'Notas', text: card.notes };
    if (card.comments?.some(c => normalizeText(c.text).includes(normQ))) {
      const comment = card.comments?.find(c => normalizeText(c.text).includes(normQ));
      return { label: 'Comentário', text: comment?.text || '' };
    }
    return null;
  };

  const memberStats = useMemo(() => {
    const stats: Record<string, { id: string, count: number, name: string, avatar?: string }> = {};
    filteredKanbanCards.forEach(card => {
      if (Array.isArray(card.assignedUsers) && card.assignedUsers.length > 0) {
        card.assignedUsers.forEach(user => {
          if (!stats[user.id]) {
            stats[user.id] = { id: user.id, count: 0, name: user.fullName, avatar: user.avatarUrl };
          }
          stats[user.id].count++;
        });
      } else if (card.employeeId) {
        const emp = employees.find(e => e.id === card.employeeId);
        if (emp) {
          if (!stats[emp.id]) {
            stats[emp.id] = { id: emp.id, count: 0, name: emp.name, avatar: emp.photoUrl || emp.avatar };
          }
          stats[emp.id].count++;
        }
      }
    });
    return Object.values(stats).sort((a, b) => b.count - a.count);
  }, [filteredKanbanCards, employees]);

  return (
    <div ref={containerRef} className="relative w-full max-w-4xl group">
      <div className="relative flex items-center">
        <Search className={cn(
          "absolute left-3.5 w-4 h-4 transition-colors duration-200",
          isOpen ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        )} />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Pesquisar cards, clientes, pastas ou membros..."
          className="pl-10 pr-24 bg-secondary/30 border-border/40 hover:bg-secondary/50 focus:bg-secondary/60 h-10 rounded-xl text-xs font-medium transition-all shadow-sm focus-visible:ring-primary/30 focus-visible:shadow-[0_0_15px_rgba(239,68,68,0.2)]"
        />
        <div className="absolute right-2.5 flex items-center gap-1">
          {memberFilter.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMemberFilter([]);
              }}
              title="Limpar filtro de membros"
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/20 text-primary border border-primary/30 text-[10px] font-bold hover:bg-primary/30 transition-all"
            >
              <Users className="w-3 h-3" />
              <span>{memberFilter.length}</span>
              <X className="w-2.5 h-2.5" />
            </button>
          )}
          {query && (
            <button 
              type="button"
              onClick={() => setQuery('')}
              className="p-1 hover:bg-white/10 rounded-full text-muted-foreground hover:text-foreground transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[760px] max-w-[calc(100vw-40px)] bg-[#22272B] border border-white/5 rounded-lg shadow-2xl overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex divide-x divide-white/5">
            {/* Left Column: Search Results */}
            <div className="flex-1 min-w-0">
              <div className="p-3.5 border-b border-white/5 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/40 px-1">
                  {trimmedQuery.length >= 1 || memberFilter.length > 0
                    ? `Cards Encontrados (${totalMatches})`
                    : 'Cards'
                  }
                </p>
                <div className="flex items-center gap-2">
                  {memberFilter.length > 0 && (
                    <button 
                      onClick={() => setMemberFilter([])}
                      className="text-[10px] font-bold text-primary hover:underline uppercase tracking-tight"
                    >
                      Limpar Filtros ({memberFilter.length})
                    </button>
                  )}
                  {(!trimmedQuery && memberFilter.length === 0) && <span className="text-[10px] text-white/20 italic">Digite ou selecione um membro...</span>}
                </div>
              </div>
              
              <div className="max-h-[520px] overflow-y-auto custom-scrollbar p-1">
                {(trimmedQuery.length >= 1 || memberFilter.length > 0) ? (
                  results.length > 0 ? (
                    results.map(card => {
                      const match = findWhereMatch(card, trimmedQuery);
                      return (
                        <HoverCard key={card.id} openDelay={200}>
                          <HoverCardTrigger asChild>
                            <div
                              onClick={() => {
                                setSelectedCard(card);
                                setIsOpen(false);
                              }}
                              className="group/item flex items-center gap-3.5 p-3 rounded-md hover:bg-white/[0.04] cursor-pointer transition-all mb-0.5"
                            >
                              <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center shrink-0">
                                <Layout className="w-4.5 h-4.5 text-white/60" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col">
                                  <h4 className="text-[14px] font-medium text-white/90 leading-tight">
                                    {highlightMatch(card.clientName, trimmedQuery)}
                                  </h4>
                                  <p className="text-[11px] text-white/30 uppercase tracking-tight mt-0.5">
                                    MAC MIDIA: {card.column.replace(/-/g, ' ')} {card.calendarClientName ? `• ${card.calendarClientName}` : ''} {card.column === 'postado' ? '• Postado' : ''}
                                  </p>
                                </div>
                                
                                {match && (
                                  <p className="text-[11px] text-white/50 mt-1 line-clamp-1 italic">
                                    <span className="font-black text-[9px] uppercase tracking-wider text-white/20 mr-1.5 not-italic">
                                      {match.label}:
                                    </span>
                                    {highlightMatch(getSnippet(match.text, trimmedQuery), trimmedQuery)}
                                  </p>
                                )}
                              </div>
                              <ChevronRight className="w-4 h-4 text-white/10 group-hover/item:text-white/40 group-hover/item:translate-x-0.5 transition-all" />
                            </div>
                          </HoverCardTrigger>
                          <HoverCardContent 
                            side="right" 
                            align="start" 
                            sideOffset={12}
                            className="w-80 p-0 border-white/10 bg-[#1C1C1E] shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-[110]"
                          >
                            {card.coverImage && (
                              <div className="w-full h-32 bg-black/40 overflow-hidden border-b border-white/5">
                                <img src={card.coverImage} className="w-full h-full object-cover opacity-60" />
                              </div>
                            )}
                            <div className="p-4 space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="text-sm font-bold text-white leading-tight uppercase">{card.clientName}</h3>
                                <div className="px-2 py-0.5 rounded-sm bg-primary/20 text-primary text-[9px] font-black uppercase tracking-wider border border-primary/20">
                                  {card.column.replace(/-/g, ' ')}
                                </div>
                              </div>
                              
                              {card.description && (
                                <p className="text-[11px] text-white/40 line-clamp-3 leading-relaxed">
                                  {card.description}
                                </p>
                              )}

                              <div className="pt-2 flex items-center justify-between border-t border-white/5">
                                <div className="flex -space-x-1.5">
                                    {card.assignedUsers?.slice(0, 3).map((u, i) => (
                                      <div key={i} className="w-5 h-5 rounded-full border border-[#1C1C1E] bg-secondary flex items-center justify-center text-[8px] overflow-hidden">
                                        {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover" /> : u.fullName[0]}
                                      </div>
                                    ))}
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Clique para abrir</span>
                              </div>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      );
                    })
                  ) : (
                    <div className="py-12 flex flex-col items-center justify-center text-center px-4">
                      <Search className="w-6 h-6 text-white/10 mb-3" />
                      <p className="text-xs font-bold text-white/40 mb-1">Nenhum card encontrado</p>
                    </div>
                  )
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center text-center px-4 opacity-50">
                    <Layout className="w-10 h-10 text-white/10 mb-4" />
                    <p className="text-[13px] font-medium text-white/40">O que você está procurando?</p>
                    <p className="text-[11px] text-white/20 max-w-[200px] mt-1">Busque por clientes, pastas ou selecione um membro ao lado.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Member Stats */}
            <div className="w-[240px] bg-black/10">
              <div className="p-3.5 border-b border-white/5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/40 px-1 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" /> Membros da Equipe
                </p>
              </div>
              <div className="p-2 space-y-1">
                {memberStats.map(stat => {
                  const isSelected = memberFilter.includes(stat.id);
                  return (
                    <div 
                      key={stat.id} 
                      onClick={() => setMemberFilter(prev => isSelected ? prev.filter(id => id !== stat.id) : [...prev, stat.id])}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-md transition-colors group cursor-pointer",
                        isSelected 
                          ? "bg-primary/20 border border-primary/20" 
                          : "hover:bg-white/5 border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border overflow-hidden shrink-0 transition-all",
                          isSelected ? "border-primary/50 ring-2 ring-primary/20" : "bg-white/5 border-white/10"
                        )}>
                          {stat.avatar ? <img src={stat.avatar} className="w-full h-full object-cover" /> : stat.name[0]}
                        </div>
                        <span className={cn(
                          "text-[12px] font-medium truncate transition-colors",
                          isSelected ? "text-primary font-bold" : "text-white/70 group-hover:text-white"
                        )}>{stat.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                         <span className={cn(
                           "text-[11px] font-black px-2 py-0.5 rounded-full border transition-all",
                           isSelected 
                            ? "bg-primary text-white border-primary" 
                            : "bg-white/5 text-white/30 border-white/5 group-hover:bg-primary/20 group-hover:text-primary group-hover:border-primary/20"
                         )}>
                           {stat.count}
                         </span>
                      </div>
                    </div>
                  );
                })}
                {memberStats.length === 0 && (
                  <div className="py-8 text-center px-4">
                    <User className="w-5 h-5 text-white/10 mx-auto mb-2" />
                    <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Sem atividades</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3 text-[12px] text-white/50 hover:text-white/80 cursor-pointer transition-colors px-1 font-medium">
               <Search className="w-4 h-4" />
               <span>Pesquisa avançada</span>
            </div>
            <div className="flex items-center gap-1.5">
               <span className="text-[10px] font-medium text-white/20 uppercase tracking-wider">Total de {filteredKanbanCards.length} cards</span>
               <div className="flex items-center gap-1 ml-2 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                 <span className="text-[9px] font-black text-white/30">ESC</span>
               </div>
            </div>
          </div>
        </div>
      )}

      {selectedCard && (
        <CardDetailDialog
          card={kanbanCards.find(c => c.id === selectedCard.id) || selectedCard}
          open={!!selectedCard}
          onOpenChange={(open) => !open && setSelectedCard(null)}
        />
      )}
    </div>
  );
};
