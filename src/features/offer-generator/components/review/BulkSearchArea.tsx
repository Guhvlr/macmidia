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
    <div className="p-8 border-b border-zinc-800 bg-zinc-950">
      <div className="max-w-5xl mx-auto flex gap-6 items-start">
        <div className="flex-1">
          <label className="text-[12px] font-semibold text-zinc-400 block mb-2">
            Entrada de Produtos do Cliente
          </label>
          <Textarea 
            value={bulkInput} 
            onChange={e => setBulkInput(e.target.value)}
            placeholder={"Ex: Coca Cola 2L R$ 8.99\nMonster Mango R$ 9.99\n\nOu por código de barras:\n7896004400913 R$ 5.99"}
            className="bg-zinc-900 border-zinc-800/60 rounded-xl min-h-[100px] text-[13px] font-medium text-zinc-100 placeholder:text-zinc-600 resize-none custom-scrollbar p-4 focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 shadow-sm"
          />
          <div className="flex gap-4 mt-3">
            <span className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium">
              <FileText className="w-3.5 h-3.5 text-zinc-600" /> Descrição + Preço
            </span>
            <span className="text-zinc-700">•</span>
            <span className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium">
              <Barcode className="w-3.5 h-3.5 text-zinc-600" /> Código de Barras + Preço
            </span>
          </div>
        </div>
        <div className="flex items-end mt-7">
          <Button 
            onClick={onSearch}
            disabled={isProcessing || !bulkInput.trim()}
            className="h-12 px-8 bg-red-600 hover:bg-red-500 text-white font-semibold text-[13px] rounded-xl shadow-md shadow-red-900/20 transition-all flex items-center gap-2 group disabled:opacity-50"
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
