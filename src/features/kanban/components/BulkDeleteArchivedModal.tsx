import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { calculateBulkDeleteImpact, executeBulkDelete } from '../utils/bulkDelete';
import { toast } from 'sonner';

interface BulkDeleteArchivedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function BulkDeleteArchivedModal({ open, onOpenChange, onSuccess }: BulkDeleteArchivedModalProps) {
  const [olderThanDays, setOlderThanDays] = useState<string>('60');
  const [isCalculating, setIsCalculating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [impact, setImpact] = useState<{ cardsCount: number; filesCount: number; cardsData: any[] } | null>(null);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (open) {
      setOlderThanDays('60');
      setImpact(null);
      setConfirmText('');
      setIsDeleting(false);
      handleCalculate('60');
    }
  }, [open]);

  const handleCalculate = async (daysVal: string) => {
    const days = parseInt(daysVal, 10);
    if (isNaN(days)) return;
    
    setIsCalculating(true);
    try {
      const result = await calculateBulkDeleteImpact({ olderThanDays: days });
      setImpact(result);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao calcular impacto.');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleDaysChange = (val: string) => {
    setOlderThanDays(val);
    handleCalculate(val);
  };

  const handleConfirm = async () => {
    if (confirmText !== 'EXCLUIR' || !impact || impact.cardsCount === 0) return;
    
    setIsDeleting(true);
    try {
      await executeBulkDelete(impact.cardsData);
      toast.success(`Limpeza concluída! ${impact.cardsCount} cards removidos com sucesso.`);
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast.error('Ocorreu um erro durante a limpeza: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isDeleting && onOpenChange(val)}>
      <DialogContent className="bg-[#121214] border-white/10 text-white max-w-md w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <Trash2 className="w-5 h-5" />
            Limpeza de Arquivados
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Exclua definitivamente os cards antigos e seus arquivos para liberar espaço.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Excluir cards arquivados há mais de:</label>
            <Select value={olderThanDays} onValueChange={handleDaysChange} disabled={isDeleting || isCalculating}>
              <SelectTrigger className="w-full bg-background/50 border-white/10">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent className="bg-[#121214] border-white/10 text-white">
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="60">60 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
                <SelectItem value="180">180 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3">
            {isCalculating ? (
              <div className="flex items-center justify-center py-4 text-muted-foreground text-sm gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Calculando...
              </div>
            ) : impact ? (
              <>
                <p className="text-sm">
                  Serão excluídos <strong className="text-white">{impact.cardsCount} cards</strong> permanentemente.
                </p>
                <p className="text-sm text-muted-foreground">
                  Isso liberará aproximadamente <strong className="text-white/80">{impact.filesCount} arquivos</strong> do armazenamento.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Selecione o período para calcular.</p>
            )}
          </div>

          {impact && impact.cardsCount > 0 && (
            <div className="space-y-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <div className="flex gap-3 text-red-400">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm font-medium leading-relaxed">
                  Esta ação é permanente e não poderá ser desfeita. Todos os dados e imagens vinculadas serão destruídos.
                </p>
              </div>
              <div className="space-y-2 pt-2">
                <label className="text-xs font-medium text-red-400/80 uppercase tracking-wider">
                  Digite "EXCLUIR" para confirmar
                </label>
                <Input 
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="EXCLUIR"
                  disabled={isDeleting}
                  className="bg-black/50 border-red-500/30 focus-visible:ring-red-500 text-red-100 placeholder:text-red-900/50"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="border-white/10 hover:bg-white/5"
          >
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm}
            disabled={
              isDeleting || 
              isCalculating || 
              !impact || 
              impact.cardsCount === 0 || 
              confirmText !== 'EXCLUIR'
            }
            className="bg-red-500 hover:bg-red-600 font-bold w-full sm:w-auto"
          >
            {isDeleting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Excluindo...</>
            ) : (
              'Excluir Definitivamente'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
