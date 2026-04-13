import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, FileText, Calendar, Trash2, Loader2, Zap, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface OfferProject {
  id: string;
  name: string;
  offer_date: string;
  state: any;
  created_at: string;
  updated_at: string;
}

interface OfferDashboardProps {
  onOpenProject: (project: OfferProject) => void;
  onCreateProject: (name: string, date: string) => void;
}

export const OfferDashboard: React.FC<OfferDashboardProps> = ({ onOpenProject, onCreateProject }) => {
  const [projects, setProjects] = useState<OfferProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState(format(new Date(), 'dd/MM/yyyy'));
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('offer_projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProjects(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar ofertas:', err);
      toast.error('Erro ao carregar ofertas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error('Informe o nome da oferta');
      return;
    }
    setCreating(true);
    try {
      // Postgres needs YYYY-MM-DD. Convert user input (DD/MM/YYYY or DD/MM)
      let isoDate = format(new Date(), 'yyyy-MM-dd');
      const parts = formDate.split('/');
      if (parts.length >= 2) {
        const d = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        const y = parts[2] && parts[2].length === 4 ? parts[2] : new Date().getFullYear();
        isoDate = `${y}-${m}-${d}`;
      }

      onCreateProject(formName.trim(), isoDate);
      setShowModal(false);
      setFormName('');
    } catch (err: any) {
      toast.error('Erro ao criar oferta: ' + (err.message || ''));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await (supabase as any)
        .from('offer_projects')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setProjects(prev => prev.filter(p => p.id !== id));
      toast.success('Oferta removida!');
    } catch (err: any) {
      toast.error('Erro ao remover: ' + (err.message || ''));
    } finally {
      setDeletingId(null);
    }
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayProjects = projects.filter(p => p.offer_date === todayStr);
  const otherProjects = projects.filter(p => p.offer_date !== todayStr);

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-white/5 bg-[#0d0d10] flex items-center gap-3">
        <Zap className="w-5 h-5 text-yellow-500" />
        <h1 className="text-xl font-black tracking-tighter">MacOferta Pro</h1>
        <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest ml-2">Projetos</span>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center px-6 py-10 overflow-y-auto">
        {/* Create Button */}
        <button
          onClick={() => setShowModal(true)}
          className="group relative w-full max-w-md h-44 rounded-2xl border-2 border-dashed border-white/10 hover:border-primary/50 bg-white/[0.02] hover:bg-primary/[0.04] transition-all duration-300 flex flex-col items-center justify-center gap-3 mb-10"
        >
          <div className="w-14 h-14 rounded-2xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
            <Plus className="w-7 h-7 text-primary" />
          </div>
          <span className="text-lg font-black tracking-tight text-white/60 group-hover:text-white transition-colors">
            + Criar Nova Oferta
          </span>
          <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">
            Clique para iniciar um novo projeto
          </span>
        </button>

        {/* Projects List */}
        {loading ? (
          <div className="flex items-center gap-3 text-white/30 py-12">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Carregando ofertas...</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/20 font-medium">Nenhuma oferta criada ainda hoje.</p>
            <p className="text-[10px] text-white/10 mt-1">As ofertas são salvas temporariamente até às 03:00 AM.</p>
          </div>
        ) : (
          <div className="w-full max-w-2xl space-y-6">
            {/* Today's projects */}
            {todayProjects.length > 0 && (
              <div>
                <h2 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" />
                  Ofertas de Hoje — {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}
                </h2>
                <div className="space-y-2">
                  {todayProjects.map(project => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onOpen={onOpenProject}
                      onDelete={handleDelete}
                      isDeleting={deletingId === project.id}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Other days */}
            {otherProjects.length > 0 && (
              <div>
                <h2 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" />
                  Ofertas Anteriores
                </h2>
                <div className="space-y-2">
                  {otherProjects.map(project => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onOpen={onOpenProject}
                      onDelete={handleDelete}
                      isDeleting={deletingId === project.id}
                    />
                  ))}
                </div>
              </div>
            )}

            <p className="text-[10px] text-white/10 text-center pt-4">
              ⚠ Ofertas são apagadas automaticamente todos os dias às 03:00 AM.
            </p>
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div
            className="bg-[#111116] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-black tracking-tight mb-1">Nova Oferta</h2>
            <p className="text-xs text-white/30 mb-6">Preencha os dados para iniciar o projeto.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5">
                  Nome da Oferta
                </label>
                <input
                  type="text"
                  placeholder="Ex: Oferta Atacadão"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                  autoFocus
                  className="w-full h-11 px-4 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/15 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5">
                  Data da Oferta
                </label>
                <input
                  type="text"
                  placeholder="Ex: 11/04"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                  className="w-full h-11 px-4 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/15 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowModal(false)}
                className="flex-1 h-11 bg-white/5 border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-white/10"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating || !formName.trim()}
                className="flex-1 h-11 bg-primary hover:bg-primary/90 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-primary/20 transition-all"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Continuar
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Card individual de projeto ────────────────────────────── */
const ProjectCard: React.FC<{
  project: OfferProject;
  onOpen: (p: OfferProject) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}> = ({ project, onOpen, onDelete, isDeleting }) => {
  const dateLabel = (() => {
    try {
      // offer_date is "YYYY-MM-DD", we need to parse it correctly
      const [y, m, d] = project.offer_date.split('-').map(Number);
      return format(new Date(y, m - 1, d), 'dd/MM');
    } catch { return project.offer_date; }
  })();

  const timeLabel = (() => {
    try {
      return format(new Date(project.updated_at), 'HH:mm');
    } catch { return ''; }
  })();

  return (
    <div
      className="group flex items-center gap-4 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-primary/30 hover:bg-primary/[0.03] transition-all cursor-pointer"
      onClick={() => onOpen(project)}
    >
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <FileText className="w-4.5 h-4.5 text-primary/70" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white/80 group-hover:text-white truncate transition-colors">
          {project.name}
        </p>
        <p className="text-[10px] text-white/20 font-medium">
          {dateLabel} • Atualizado às {timeLabel}
        </p>
      </div>

      <button
        onClick={e => { e.stopPropagation(); onDelete(project.id); }}
        disabled={isDeleting}
        className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all"
        title="Excluir oferta"
      >
        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      </button>

      <ArrowRight className="w-4 h-4 text-white/10 group-hover:text-primary/50 transition-all group-hover:translate-x-0.5" />
    </div>
  );
};
