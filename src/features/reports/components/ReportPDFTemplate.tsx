import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { KanbanCard } from '@/contexts/app-types';

interface Props {
  clientName: string;
  startDate: string;
  endDate: string;
  cards: KanbanCard[];
  clientLogoSrc?: string;
  onReady?: (ready: boolean) => void;
}

interface Page {
  isFirst: boolean;
  isLast: boolean;
  days: { date: string; cards: KanbanCard[]; isContinuation: boolean }[];
}

const PAGE_HEIGHT = 1123;
const DAY_TITLE_HEIGHT = 60;     
const CARD_HEIGHT = 240;         
const CARDS_GAP = 10;            
const CARDS_PER_ROW = 4;         
const PAGE_PADDING = 32;
const SAFETY_MARGIN = 30;        

const DaySection = ({ date, cards, isContinuation }: { date: string; cards: KanbanCard[]; isContinuation: boolean }) => (
  <div style={{ marginBottom: 20 }}>
    {!isContinuation && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 3, height: 18, background: 'linear-gradient(180deg, #ff1a1a, #cc0000)', borderRadius: 2 }} />
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', color: 'rgba(255,255,255,0.7)' }}>
          {format(parseISO(date), "dd 'DE' MMMM", { locale: ptBR }).toUpperCase()}
        </div>
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(255,255,255,0.05), transparent)' }} />
      </div>
    )}
    {isContinuation && (
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 12, height: 1, background: 'rgba(255,255,255,0.1)' }} />
        (continuação de {format(parseISO(date), "dd/MM")})
      </div>
    )}

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
      {cards.map(card => (
        <div key={card.id} style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ aspectRatio: '1/1', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {card.coverImage ? (
              <img src={card.coverImage} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 24, opacity: 0.2 }}>📷</span>
            )}
            <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.6)', padding: '3px 6px', borderRadius: 4, fontSize: 8, fontWeight: 700, color: '#fff' }}>
              {card.archivedAt ? format(parseISO(card.archivedAt), 'HH:mm') : '--:--'}
            </div>
            {card.column === 'postado' && (
              <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(76,175,80,0.85)', padding: '2px 5px', borderRadius: 3, fontSize: 7, fontWeight: 800, color: '#fff', letterSpacing: 0.5 }}>POSTADO</div>
            )}
          </div>
          <div style={{ padding: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '26px' }}>{card.clientName}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.calendarClientName || 'Mac Mídia'}</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const ReportPDFTemplate: React.FC<Props> = ({ 
  clientName, 
  startDate, 
  endDate, 
  cards,
  clientLogoSrc,
  onReady
}) => {
  const [pages, setPages] = useState<Page[]>([]);
  const [isReady, setIsReady] = useState(false);

  const totalPosts = cards.length;
  const daysWithActivitySet = new Set(
    cards.filter(c => c.archivedAt).map(c => format(parseISO(c.archivedAt!), 'yyyy-MM-dd'))
  );
  const daysWithActivity = daysWithActivitySet.size;
  
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const avgPerDay = daysWithActivity > 0 ? (totalPosts / daysWithActivity).toFixed(1) : '0';
  const approvalRate = '100';
  
  const periodDays: { date: string; count: number; isActive: boolean }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = format(d, 'yyyy-MM-dd');
    const count = cards.filter(c => 
      c.archivedAt && format(parseISO(c.archivedAt), 'yyyy-MM-dd') === dateStr
    ).length;
    periodDays.push({ 
      date: format(d, 'dd/MM'), 
      count, 
      isActive: count > 0 
    });
  }
  
  const maxCount = Math.max(...periodDays.map(d => d.count), 1);
  const initials = clientName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const cardsByDay = useMemo(() => {
    const grouped: Record<string, KanbanCard[]> = {};
    cards.forEach(card => {
      if (!card.archivedAt) return;
      const day = format(parseISO(card.archivedAt), 'yyyy-MM-dd');
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(card);
    });
    return grouped;
  }, [cards]);

  // Seções Auxiliares para Reuso
  const HeaderSection = () => (
    <div style={{ background: 'linear-gradient(135deg, #1a0a0a 0%, #0a0a0a 70%)', padding: '32px 36px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,26,26,0.15)', border: '1px solid rgba(255,26,26,0.3)', padding: '6px 14px', borderRadius: 100, marginBottom: 12 }}>
            <div style={{ width: 6, height: 6, background: '#ff1a1a', borderRadius: '50%' }} />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: '#ff6b6b' }}>RELATÓRIO MENSAL · CONFIDENCIAL</span>
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 900, letterSpacing: '-2px', lineHeight: 0.95, margin: '0 0 8px', color: '#fff' }}>
            Performance<br/><span style={{ color: '#ff1a1a' }}>de Conteúdo</span>
          </h1>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '4px 0 0', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>
            {format(parseISO(startDate), "MMMM 'de' yyyy", { locale: ptBR })} · {totalDays} dias
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-1px', fontStyle: 'italic' }}>Mac<span style={{ color: '#ff1a1a' }}>•</span></div>
          <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: 3, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>STRATEGIC INTELLIGENCE</div>
        </div>
      </div>
    </div>
  );

  const ClientSection = () => (
    <div style={{ padding: '20px 36px', background: '#0f0f0f', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 16, alignItems: 'center' }}>
      {clientLogoSrc ? (
        <img src={clientLogoSrc} crossOrigin="anonymous" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', border: '2px solid rgba(255,26,26,0.3)' }} />
      ) : (
        <div style={{ width: 56, height: 56, borderRadius: 12, background: 'linear-gradient(135deg, #ff1a1a, #cc0000)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: '#fff' }}>{initials}</div>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>CLIENTE</div>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px', color: '#fff' }}>{clientName}</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4, display: 'flex', gap: 10 }}>
          <span>{format(parseISO(startDate), 'dd/MM')} → {format(parseISO(endDate), 'dd/MM/yyyy')}</span>
        </div>
      </div>
    </div>
  );

  const MetricsSection = () => (
    <div style={{ padding: '20px 36px 0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
      <div style={{ background: 'linear-gradient(135deg, #1a0a0a, #150505)', border: '1px solid rgba(255,26,26,0.2)', borderRadius: 12, padding: 12 }}>
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.2, color: '#ff6b6b', marginBottom: 4 }}>TOTAL POSTS</div>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1, color: '#fff' }}>{totalPosts}</div>
      </div>
      <div style={{ background: 'linear-gradient(135deg, #0a1a0a, #051505)', border: '1px solid rgba(76,175,80,0.2)', borderRadius: 12, padding: 12 }}>
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.2, color: '#4caf50', marginBottom: 4 }}>APROVAÇÃO</div>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1, color: '#fff' }}>{approvalRate}<span style={{ fontSize: 14 }}>%</span></div>
      </div>
      <div style={{ background: 'linear-gradient(135deg, #0a0a1a, #050515)', border: '1px solid rgba(33,150,243,0.2)', borderRadius: 12, padding: 12 }}>
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.2, color: '#2196f3', marginBottom: 4 }}>DIAS ATIVOS</div>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1, color: '#fff' }}>{daysWithActivity}</div>
      </div>
      <div style={{ background: 'linear-gradient(135deg, #1a1100, #150d00)', border: '1px solid rgba(255,193,7,0.2)', borderRadius: 12, padding: 12 }}>
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.2, color: '#ffc107', marginBottom: 4 }}>MÉDIA/DIA</div>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1, color: '#fff' }}>{avgPerDay}</div>
      </div>
    </div>
  );

  useEffect(() => {
    setTimeout(() => {
      const measureContainer = document.getElementById('measure-container');
      if (!measureContainer) return;
      
      const headerBlock = measureContainer.querySelector('[data-section="header-block"]');
      const measuredHeaderHeight = headerBlock ? headerBlock.getBoundingClientRect().height : 600;

      const dayGroups = measureContainer.querySelectorAll('[data-day-group]');
      const dayHeights: Record<string, number> = {};
      
      dayGroups.forEach((el) => {
        const day = el.getAttribute('data-day-group');
        if (day) {
          dayHeights[day] = (el as HTMLElement).getBoundingClientRect().height;
        }
      });
      
      const paginateContentWithRealHeights = (
        cbd: Record<string, KanbanCard[]>, 
        dhs: Record<string, number>,
        headHeight: number
      ): Page[] => {
        const pagesList: Page[] = [];
        let currentPage: Page = { isFirst: true, isLast: false, days: [] };
        let currentHeight = headHeight + 20;
        const availableHeight = PAGE_HEIGHT - PAGE_PADDING * 2 - SAFETY_MARGIN;
        
        const sortedDays = Object.keys(cbd).sort((a, b) => b.localeCompare(a));
        
        for (const day of sortedDays) {
          const dayHeight = dhs[day] || (Math.ceil(cbd[day].length / CARDS_PER_ROW) * (CARD_HEIGHT + CARDS_GAP) + DAY_TITLE_HEIGHT + 24);
          
          if (currentHeight + dayHeight > availableHeight && currentPage.days.length > 0) {
            pagesList.push(currentPage);
            currentPage = { isFirst: false, isLast: false, days: [] };
            currentHeight = PAGE_PADDING;
          }
          
          currentPage.days.push({ date: day, cards: cbd[day], isContinuation: false });
          currentHeight += dayHeight + 20;
        }
        
        if (currentPage.days.length > 0) {
          currentPage.isLast = true;
          pagesList.push(currentPage);
        } else if (pagesList.length > 0) {
          pagesList[pagesList.length - 1].isLast = true;
        }
        
        return pagesList;
      };

      const newPages = paginateContentWithRealHeights(cardsByDay, dayHeights, measuredHeaderHeight);
      setPages(newPages);
      setIsReady(true);
      onReady?.(true);
    }, 400);
  }, [cardsByDay]);

  return (
    <div id="report-pdf-template" style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1 }}>
      {/* Container de Medição */}
      <div 
        id="measure-container" 
        style={{ 
          position: 'fixed', 
          left: '-9999px', 
          top: '-9999px', 
          width: '794px', 
          visibility: 'hidden',
          zIndex: -2
        }}
      >
        <div data-section="header-block">
          <HeaderSection />
          <ClientSection />
          <MetricsSection />
        </div>
        {Object.entries(cardsByDay).map(([day, dayCards]) => (
          <div key={day} data-day-group={day} style={{ marginBottom: 20 }}>
            <DaySection date={day} cards={dayCards} isContinuation={false} />
          </div>
        ))}
      </div>

      {/* Páginas Reais */}
      {isReady && pages.map((page, pIdx) => (
        <div 
          key={pIdx}
          id={`report-page-${pIdx}`}
          style={{ 
            width: '794px',
            height: '1123px',
            maxHeight: '1123px',
            overflow: 'hidden',
            background: '#0a0a0a',
            color: '#fff',
            fontFamily: '-apple-system, "Inter", sans-serif',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            pageBreakAfter: 'always',
            boxSizing: 'border-box'
          }}
        >
          {/* HEADER SECTION (Only on first page) */}
          {page.isFirst && (
            <div data-section="header-block">
              <HeaderSection />
              <ClientSection />
              <MetricsSection />
            </div>
          )}

          {/* DAYS CONTENT */}
          <div style={{ padding: '0 36px 32px', flex: 1 }}>
            {page.days.map(({ date, cards, isContinuation }, dIdx) => (
              <DaySection key={`${date}-${dIdx}`} date={date} cards={cards} isContinuation={isContinuation} />
            ))}
          </div>

          {/* FOOTER SECTION (Only on last page) */}
          {page.isLast && (
            <div style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #000 100%)', padding: '20px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-1px', fontStyle: 'italic', color: '#fff' }}>Mac<span style={{ color: '#ff1a1a' }}>•</span>Mídia</div>
                <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', letterSpacing: 2, marginTop: 2 }}>STRATEGIC INTELLIGENCE</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 7, color: 'rgba(255,255,255,0.2)', letterSpacing: 1 }}>
                <div>GERADO EM {format(new Date(), 'dd/MM/yyyy')}</div>
                <div style={{ marginTop: 2 }}>CONFIDENCIAL · PAGINA {pIdx + 1} DE {pages.length}</div>
              </div>
            </div>
          )}
          
          {/* Page Number for non-last pages */}
          {!page.isLast && (
            <div style={{ position: 'absolute', bottom: 12, right: 36, fontSize: 7, color: 'rgba(255,255,255,0.2)', fontWeight: 700 }}>
              PAGINA {pIdx + 1} DE {pages.length}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
