import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/useApp';
import type { KanbanColumnDef } from '@/contexts/app-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Upload, X, Sparkles, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  employeeId?: string;
  /** When provided, the card is created directly in this column (no selector shown) */
  fixedColumnKey?: string;
  columnKey?: string;
  /** Custom trigger element. If omitted, a default "+" button is rendered */
  trigger?: React.ReactNode;
  
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showEmployeeSelect?: boolean;
}

const AddCardDialog = ({ employeeId: initialEmployeeId, fixedColumnKey, columnKey, trigger, open, onOpenChange, showEmployeeSelect }: Props) => {
  const { addKanbanCard, employees } = useApp();
  const [internalOpen, setInternalOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId || '');
  const [aiLoading, setAiLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isControlled = open !== undefined && onOpenChange !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  const setDialogOpen = isControlled ? onOpenChange : setInternalOpen;

  useEffect(() => {
    if (dialogOpen && initialEmployeeId && !selectedEmployeeId) {
      setSelectedEmployeeId(initialEmployeeId);
    }
  }, [dialogOpen, initialEmployeeId]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => setImages(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const handleProcessWithAI = async () => {
    if (!description.trim()) {
      toast.error('Digite uma descrição para corrigir.');
      return;
    }
    setAiLoading(true);

    try {
      const { data: settingsData } = await (supabase as any).from('settings').select('value').eq('key', 'openai_api_key').single();
      const apiKey = settingsData?.value;
      if (!apiKey) {
        toast.error('Chave da OpenAI não configurada.');
        setAiLoading(false);
        return;
      }

      const systemPrompt = `Você é um assistente de marketing para uma agência de mídia.
Sua tarefa é receber uma mensagem/briefing e transformá-la em uma descrição profissional organizada.
REGRAS: 1. Corrija ortografia e gramática. 2. Organize o conteúdo de forma clara. 3. NUNCA use markdown/asteriscos. Retorne o texto puramente plano.
Retorne JSON: {"clientName": "...", "description": "..."}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: description }],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        }),
      });

      if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
      const data = await response.json();
      const parsedData = JSON.parse(data.choices?.[0]?.message?.content || '{}');
      
      const processedText = (parsedData.description || description).replace(/\*/g, '');
      setDescription(processedText);
      if (parsedData.clientName && !clientName) {
        setClientName(parsedData.clientName.toUpperCase());
      }
      toast.success('✨ Descrição corrigida com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro na IA.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;
    addKanbanCard({
      clientName, description, images,
      column: fixedColumnKey || columnKey || 'para-producao',
      timeSpent: 0, timerRunning: false, employeeId: selectedEmployeeId || initialEmployeeId || '',
    });
    setClientName(''); setDescription(''); setImages([]); setDialogOpen(false);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger || (
            <button className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-all group">
              <Plus className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span>Adicionar card</span>
            </button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="glass-card border-border/50">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Novo Card</DialogTitle>
          <DialogDescription className="sr-only">Preencha as informações para criar um novo card de produção no Kanban.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Nome do cliente"
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            className="bg-secondary/40 border-border/50 rounded-xl h-11"
            autoFocus
          />
          <div className="space-y-1 relative">
            <div className="flex items-center justify-between mb-1 px-1">
               <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Descrição</label>
               <Button 
                type="button"
                variant="ghost" 
                onClick={handleProcessWithAI}
                disabled={aiLoading || !description.trim()}
                className="h-6 px-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-[9px] font-bold uppercase tracking-wider border border-purple-500/20"
              >
                {aiLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                {aiLoading ? 'Processando...' : 'Corrigir com IA'}
              </Button>
            </div>
            <Textarea
              placeholder="Adicione o briefing ou lista de produtos aqui..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="bg-secondary/40 border-border/50 min-h-[100px] rounded-xl focus-visible:ring-purple-500/30"
            />
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border/40 rounded-xl p-3 text-center cursor-pointer hover:border-primary/40 transition-colors"
          >
            <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Clique ou arraste imagens</p>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
          </div>

          {images.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-border/30">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-0 right-0 bg-destructive rounded-bl-lg p-0.5">
                    <X className="w-3 h-3 text-destructive-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showEmployeeSelect && employees.length > 0 && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Responsável pelo Card</label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger className="bg-secondary/40 border-border/50 h-11 rounded-xl">
                  <SelectValue placeholder="Selecione o funcionário" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button type="submit" className="w-full h-11 btn-primary-glow font-semibold rounded-xl" disabled={!clientName.trim() || (showEmployeeSelect && !selectedEmployeeId)}>Adicionar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCardDialog;
