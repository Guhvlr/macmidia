import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Search, FileText, Barcode } from 'lucide-react';

interface BulkSearchAreaProps {
  bulkInput: string;
  setBulkInput: (val: string) => void;
  isProcessing: boolean;
  onSearch: () => void;
}

export const BulkSearchArea = ({ 
  bulkInput, 
  setBulkInput, 
  isProcessing, 
  onSearch 
}: BulkSearchAreaProps) => {
  return (
    <div className="p-8 border-b border-white/5 bg-[#0d0d10]">
      <div className="max-w-5xl mx-auto flex gap-6">
        <div className="flex-1">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 block mb-3">
            Entrada de Produtos do Cliente
          </label>
          <Textarea 
            value={bulkInput} 
            onChange={e => setBulkInput(e.target.value)}
            placeholder={"Ex: Coca Cola 2L R$ 8.99\nMonster Mango R$ 9.99\n\nOu por código de barras:\n7896004400913 R$ 5.99"}
            className="bg-black/40 border-white/10 rounded-2xl min-h-[100px] text-sm resize-none custom-scrollbar p-4"
          />
          <div className="flex gap-3 mt-2">
            <span className="flex items-center gap-1.5 text-[9px] text-white/20 font-bold uppercase">
              <FileText className="w-3 h-3" /> Descrição + Preço
            </span>
            <span className="text-white/10">•</span>
            <span className="flex items-center gap-1.5 text-[9px] text-white/20 font-bold uppercase">
              <Barcode className="w-3 h-3" /> Código de Barras + Preço
            </span>
          </div>
        </div>
        <div className="flex items-end">
          <Button 
            onClick={onSearch}
            disabled={isProcessing || !bulkInput.trim()}
            className="h-14 px-8 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.15em] text-[11px] rounded-2xl shadow-lg shadow-primary/20 transition-all flex items-center gap-3 group"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processando...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Localizar Itens</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
