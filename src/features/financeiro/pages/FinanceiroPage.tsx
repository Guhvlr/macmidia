import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Download, Bot, ChevronLeft, ChevronRight, LayoutList, Calendar as CalendarIcon, BarChart3, Settings, ShieldAlert
} from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Components
import { FinanceSummaryCards } from '../components/FinanceSummaryCards';
import { FinanceTable } from '../components/FinanceTable';
import { FinanceEntryModal } from '../components/FinanceEntryModal';
import { FinanceCategoryManager } from '../components/FinanceCategoryManager';
import { FinanceFilters } from '../components/FinanceFilters';
import { FinanceCalendar } from '../components/FinanceCalendar';
import { FinanceCharts } from '../components/FinanceCharts';
import { FinanceAIChat } from '../components/FinanceAIChat';
import { FinanceDeleteConfirmModal } from '../components/FinanceDeleteConfirmModal';

// Context & Hooks
import { useApp } from '@/contexts/useApp';
import { useFinanceEntries } from '../hooks/useFinanceEntries';
import { useFinanceCategories } from '../hooks/useFinanceCategories';
import { useFinanceAI } from '../hooks/useFinanceAI';
import { FinanceEntry, FinanceFilters as FilterType, FinanceProjectionRow } from '../types/finance-types';

export default function FinanceiroPage() {
  const { loggedUserId, loggedUserRole } = useApp();
  
  // Date state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeView, setActiveView] = useState<'tabela' | 'calendario' | 'graficos'>('tabela');
  const [filters, setFilters] = useState<FilterType>({});
  
  // Modals state
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<FinanceEntry | null>(null);
  
  // Edit state
  const [editingEntry, setEditingEntry] = useState<FinanceEntry | null>(null);
  const [defaultEntryType, setDefaultEntryType] = useState<'entrada' | 'saida'>('saida');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [projections, setProjections] = useState<FinanceProjectionRow[]>([]);

  // Hooks
  const { 
    entries, 
    loading: loadingEntries, 
    fetchEntries, 
    createEntry, 
    updateEntry, 
    toggleStatus,
    bulkUpdateStatus,
    deleteEntry, 
    bulkDeleteEntries,
    duplicateEntry,
    getMonthSummary,
    getProjection,
    getCategoryBreakdown,
    exportCSV 
  } = useFinanceEntries();

  const { 
    categories, 
    createCategory, 
    updateCategory, 
    deleteCategory 
  } = useFinanceCategories();

  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const handleRefresh = useCallback(() => {
    if (loggedUserId) {
      fetchEntries(currentMonth, currentYear, filters);
    }
  }, [loggedUserId, currentMonth, currentYear, filters, fetchEntries]);

  const { 
    messages, 
    isLoading: isAILoading, 
    sendMessage, 
    loadHistory, 
    clearHistory 
  } = useFinanceAI(handleRefresh);

  // Load entries when month/year/filters change
  useEffect(() => {
    handleRefresh();
  }, [handleRefresh]);

  // Load AI chat history on mount
  useEffect(() => {
    if (loggedUserId) {
      loadHistory();
    }
  }, [loggedUserId, loadHistory]);

  // Load projections if on charts tab
  useEffect(() => {
    if (activeView === 'graficos' && loggedUserId) {
      getProjection(currentMonth, currentYear, 6).then(data => {
        setProjections(data);
      });
    }
  }, [activeView, loggedUserId, currentMonth, currentYear, getProjection]);

  // Handlers
  const handlePrevMonth = () => setCurrentDate(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));
  
  const handleNewEntry = (type: 'entrada' | 'saida', initialDate?: string) => {
    setDefaultEntryType(type);
    setEditingEntry(initialDate ? { date: initialDate, type } as any : null);
    setIsEntryModalOpen(true);
  };
  
  const handleEditEntry = (entry: FinanceEntry) => {
    setEditingEntry(entry);
    setIsEntryModalOpen(true);
  };

  const handleSaveEntry = async (data: Partial<FinanceEntry>) => {
    if (editingEntry?.id) {
      await updateEntry(editingEntry.id, data);
    } else {
      await createEntry(data);
    }
    await fetchEntries(currentMonth, currentYear, filters);
    setIsEntryModalOpen(false);
  };
  
  const confirmDelete = async (deleteFuture: boolean = false) => {
    if (deletingEntry) {
      await deleteEntry(deletingEntry.id, deleteFuture);
      setDeletingEntry(null);
    }
  };

  const handleDuplicateEntry = async (id: string) => {
    await duplicateEntry(id);
    await fetchEntries(currentMonth, currentYear, filters);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  
  const toggleSelectAll = () => {
    if (selectedIds.length === entries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(entries.map(e => e.id));
    }
  };

  const handleSaveCategory = async (catData: { id?: string; name: string; type: string; color: string }) => {
    if (catData.id) {
      await updateCategory(catData.id, { name: catData.name, type: catData.type as any, color: catData.color });
    } else {
      await createCategory(catData.name, catData.type as any, catData.color);
    }
  };

  const summary = getMonthSummary();
  const categoryBreakdown = getCategoryBreakdown('saida');

  // GUEST Access Guard
  if (loggedUserRole === 'guest' || loggedUserRole === 'GUEST') {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl max-w-md text-center shadow-xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-zinc-100 mb-2">Acesso Restrito</h2>
          <p className="text-sm text-zinc-400">
            Apenas administradores e colaboradores têm acesso ao módulo financeiro individual.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            Financeiro
          </h1>
          <p className="text-zinc-400 text-sm">Controle financeiro pessoal e individual</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAIChatOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-red-950/40 transition-all hover:scale-[1.02]"
          >
            <Bot className="w-4 h-4" />
            Assistente IA
          </button>
        </div>
      </div>

      {/* Month Navigator & Actions */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-1.5 shadow-sm">
          <button 
            onClick={handlePrevMonth} 
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-100 transition-colors"
            title="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-sm font-semibold w-36 text-center capitalize text-zinc-200">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </div>
          <button 
            onClick={handleNextMonth} 
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-100 transition-colors"
            title="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button 
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl text-sm text-zinc-300 transition-colors"
          >
            <Settings className="w-4 h-4 text-zinc-400" /> Categorias
          </button>
          <button 
            onClick={() => exportCSV(currentMonth, currentYear)}
            className="flex items-center gap-2 px-3.5 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl text-sm text-zinc-300 transition-colors"
          >
            <Download className="w-4 h-4 text-zinc-400" /> Exportar CSV
          </button>
          <button 
            onClick={() => handleNewEntry('saida')}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/15 text-red-400 hover:bg-red-500/25 rounded-xl text-sm font-medium transition-colors border border-red-500/30"
          >
            <Plus className="w-4 h-4" /> Nova Saída
          </button>
          <button 
            onClick={() => handleNewEntry('entrada')}
            className="flex items-center gap-2 px-4 py-2 bg-green-500/15 text-green-400 hover:bg-green-500/25 rounded-xl text-sm font-medium transition-colors border border-green-500/30"
          >
            <Plus className="w-4 h-4" /> Nova Entrada
          </button>
        </div>
      </div>

      {/* Summary Cards com filtro ao clicar */}
      <FinanceSummaryCards 
        summary={summary} 
        selectedTypeFilter={filters.type || 'todos'}
        onSelectTypeFilter={(type) => {
          setFilters(prev => ({
            ...prev,
            type: type === 'todos' ? undefined : type
          }));
        }}
      />

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 mb-6">
        <button 
          onClick={() => setActiveView('tabela')}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-medium transition-all ${
            activeView === 'tabela' 
              ? 'border-b-2 border-red-500 text-zinc-100 font-semibold' 
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <LayoutList className="w-4 h-4" /> Tabela
        </button>
        <button 
          onClick={() => setActiveView('calendario')}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-medium transition-all ${
            activeView === 'calendario' 
              ? 'border-b-2 border-red-500 text-zinc-100 font-semibold' 
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <CalendarIcon className="w-4 h-4" /> Calendário
        </button>
        <button 
          onClick={() => setActiveView('graficos')}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-medium transition-all ${
            activeView === 'graficos' 
              ? 'border-b-2 border-red-500 text-zinc-100 font-semibold' 
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <BarChart3 className="w-4 h-4" /> Relatórios e Projeções
        </button>
      </div>

      {/* Main Content Area */}
      {activeView === 'tabela' && (
        <>
          <FinanceFilters filters={filters} setFilters={setFilters} categories={categories} />
          {loadingEntries ? (
            <div className="p-12 text-center text-zinc-500">Carregando registros...</div>
          ) : (
            <FinanceTable 
              entries={entries} 
              onEdit={handleEditEntry} 
              onDelete={(entry) => setDeletingEntry(entry)}
              onDuplicate={handleDuplicateEntry}
              onToggleStatus={toggleStatus}
              onAdd={() => handleNewEntry('saida')}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onBulkMarkPaid={() => {
                bulkUpdateStatus(selectedIds, 'pago');
                setSelectedIds([]);
              }}
              onBulkMarkPending={() => {
                bulkUpdateStatus(selectedIds, 'previsto');
                setSelectedIds([]);
              }}
              onBulkDelete={() => {
                bulkDeleteEntries(selectedIds);
                setSelectedIds([]);
              }}
              onClearSelection={() => setSelectedIds([])}
            />
          )}
        </>
      )}

      {activeView === 'calendario' && (
        <FinanceCalendar 
          entries={entries} 
          currentDate={currentDate} 
          onDayClick={(dateStr) => {
            handleNewEntry('saida', dateStr);
          }} 
        />
      )}

      {activeView === 'graficos' && (
        <FinanceCharts 
          categoryBreakdown={categoryBreakdown} 
          projections={projections} 
        />
      )}

      {/* Modals & AI Drawer */}
      <FinanceEntryModal 
        isOpen={isEntryModalOpen} 
        onClose={() => setIsEntryModalOpen(false)} 
        onSave={handleSaveEntry}
        entry={editingEntry}
        categories={categories}
        defaultType={defaultEntryType}
      />

      <FinanceCategoryManager 
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        onSaveCategory={handleSaveCategory}
        onDeleteCategory={deleteCategory}
      />

      <FinanceAIChat 
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        messages={messages}
        onSendMessage={sendMessage}
        onClearHistory={clearHistory}
        isLoading={isAILoading}
      />

      <FinanceDeleteConfirmModal 
        isOpen={!!deletingEntry}
        onClose={() => setDeletingEntry(null)}
        onConfirm={() => confirmDelete(false)}
        onConfirmFuture={() => confirmDelete(true)}
        entry={deletingEntry}
        title="Excluir Lançamento"
        description="Tem certeza que deseja excluir este lançamento financeiro? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
