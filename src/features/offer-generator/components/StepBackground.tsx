import React from 'react';
import { useOffer } from '../context/OfferContext';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Image as ImageIcon, Loader2, Save, CheckCircle, Trash2, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export const StepBackground = () => {
  const { config, updateConfig, layouts, setLayouts, selectedClientName } = useOffer();
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveModalOpen, setSaveModalOpen] = React.useState(false);
  const [newLayoutName, setNewLayoutName] = React.useState('');

  React.useEffect(() => {
    const fetch = async () => {
      const { data } = await (supabase as any).from('offer_layouts').select('*').order('created_at', { ascending: false });
      if (data) setLayouts(data);
    };
    fetch();
  }, []);

  const filteredLayouts = React.useMemo(() => {
    if (!selectedClientName) return layouts;
    return layouts.filter(ly => ly.client === selectedClientName || (ly.name && ly.name.startsWith(`[${selectedClientName}]`)));
  }, [layouts, selectedClientName]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      updateConfig({ backgroundImageUrl: URL.createObjectURL(file) });
      (window as any)._stagedBg = file;
    }
  };

  const handleSave = async () => {
    if (!config.backgroundImageUrl) return;
    setSaveModalOpen(true);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Deseja excluir este layout permanentemente?')) return;
    try {
      const { error } = await (supabase as any).from('offer_layouts').delete().eq('id', id);
      if (error) throw error;
      setLayouts(prev => prev.filter(ly => ly.id !== id));
      toast.success('Layout excluído!');
    } catch (e: any) { toast.error(e.message); }
  };

  const confirmSave = async () => {
    if (!newLayoutName) return toast.error('Dê um nome ao layout');
    setIsSaving(true);
    try {
      let url = config.backgroundImageUrl;
      if (url.startsWith('blob:')) {
        const file = (window as any)._stagedBg;
        if (file) {
          const fn = `layout_${Date.now()}.${file.name.split('.').pop()}`;
          const { error } = await supabase.storage.from('product-images').upload(`layouts/${fn}`, file);
          if (error) throw error;
          url = `https://ebvvmddizsggrqasnnvv.supabase.co/storage/v1/object/public/product-images/layouts/${fn}`;
          updateConfig({ backgroundImageUrl: url });
        }
      }
      
      const finalName = selectedClientName ? `[${selectedClientName}] ${newLayoutName}` : newLayoutName;
      const { data, error } = await (supabase as any).from('offer_layouts')
        .insert([{ name: finalName, image_url: url, config, client: selectedClientName }])
        .select().single();
      if (error) throw error;
      if (data) setLayouts((prev: any[]) => [data, ...prev]);
      toast.success('Layout salvo!');
      setSaveModalOpen(false);
      setNewLayoutName('');
    } catch (e: any) { toast.error(e.message); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="h-full flex bg-zinc-950">
      {/* Left Panel */}
      <div className="w-[380px] border-r border-zinc-800/60 bg-zinc-950 p-8 overflow-y-auto custom-scrollbar flex flex-col gap-8">
         {/* Header */}
         <div>
           <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-500 rounded-full text-[10px] font-semibold mb-3">
             <ImageIcon className="w-3.5 h-3.5" /> Passo 1
           </div>
           <h2 className="text-xl font-semibold tracking-tight text-zinc-100">Design de Fundo</h2>
           <p className="text-[12px] text-zinc-400 font-medium mt-1">Escolha ou envie a imagem base que será o fundo do encarte.</p>
         </div>

        {/* Upload Area */}
        <div className="space-y-4">
           <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30 hover:bg-zinc-900/80 hover:border-red-500/50 cursor-pointer transition-all group">
             <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center group-hover:scale-105 group-hover:bg-red-500/20 transition-all duration-300">
               <Upload className="w-5 h-5 text-zinc-400 group-hover:text-red-500 transition-colors" />
             </div>
             <div className="text-center">
               <span className="block text-[13px] font-medium text-zinc-300 group-hover:text-zinc-100 mb-1 transition-colors">Fazer upload de imagem</span>
               <span className="text-[11px] text-zinc-500 font-medium">Arraste ou clique (JPG, PNG)</span>
             </div>
             <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
           </label>

          {config.backgroundImageUrl && (
             <Button onClick={handleSave} disabled={isSaving} className="w-full h-11 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-[12px] font-medium transition-all shadow-sm">
               {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
               Salvar na Biblioteca
             </Button>
          )}
        </div>

        {/* Gallery */}
        {filteredLayouts.length > 0 && (
           <div className="pt-6 border-t border-zinc-800/50 flex flex-col gap-4">
             <div className="flex items-center justify-between">
               <label className="text-[12px] font-medium text-zinc-400 flex items-center gap-2">
                 <Folder className="w-4 h-4 text-zinc-500" />
                 Biblioteca ({selectedClientName || 'Geral'})
               </label>
               <span className="text-[10px] font-medium text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800">{filteredLayouts.length} itens</span>
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                {filteredLayouts.map((ly: any) => (
                  <div key={ly.id} className="relative group/card flex flex-col gap-2">
                    <button onClick={() => updateConfig({ backgroundImageUrl: ly.image_url })}
                      className={`w-full aspect-[4/5] rounded-xl border-2 overflow-hidden transition-all relative ${config.backgroundImageUrl === ly.image_url ? 'border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.15)] ring-2 ring-red-500/20' : 'border-zinc-800/50 hover:border-zinc-700 bg-zinc-900'}`}
                    >
                      <img src={ly.image_url} className="w-full h-full object-cover" />
                      {config.backgroundImageUrl === ly.image_url && (
                        <div className="absolute top-2 left-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-md">
                          <CheckCircle className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                    </button>
                    <p className="text-[11px] font-medium text-zinc-400 truncate px-1 text-center" title={ly.name}>
                      {ly.name.replace(`[${selectedClientName}] `, '')}
                    </p>
                    <button 
                      onClick={(e) => handleDelete(e, ly.id)}
                      className="absolute top-2 right-2 p-1.5 bg-red-500/90 backdrop-blur-md rounded-lg text-white opacity-0 group-hover/card:opacity-100 hover:scale-105 transition-all shadow-md z-10"
                      title="Excluir Layout"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
             </div>
           </div>
        )}
      </div>

      {/* Right: preview */}
      <div className="flex-1 bg-zinc-950/50 flex items-center justify-center p-8 overflow-auto relative">
        {/* Subtle grid background for the canvas area */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-[0.15] z-0" />
        
        {config.backgroundImageUrl ? (
          <div className="shadow-2xl ring-1 ring-zinc-800/50 rounded-xl overflow-hidden relative z-10 bg-zinc-900">
            <img src={config.backgroundImageUrl} style={{ maxWidth: '700px', maxHeight: '750px', objectFit: 'contain' }} />
          </div>
        ) : (
          <div className="text-center space-y-4 relative z-10 p-12 border border-zinc-800/50 bg-zinc-900/20 rounded-3xl backdrop-blur-sm max-w-md">
            <div className="w-20 h-20 bg-zinc-900/50 border border-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <ImageIcon className="w-8 h-8 text-zinc-600" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight text-zinc-300">Nenhum fundo selecionado</h3>
            <p className="text-[13px] text-zinc-500 font-medium">Use o painel lateral para fazer upload de uma nova imagem ou escolha uma da sua biblioteca.</p>
          </div>
        )}
      </div>

      <Dialog open={saveModalOpen} onOpenChange={setSaveModalOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 rounded-[24px] shadow-2xl sm:max-w-md p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-semibold tracking-tight flex items-center gap-3">
               <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                 <Save className="w-5 h-5 text-blue-400" />
               </div>
               Salvar na Biblioteca
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-[13px] font-medium mt-2">
               Dê um nome para identificar este layout na pasta {selectedClientName || 'Geral'}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newLayoutName}
              onChange={(e) => setNewLayoutName(e.target.value)}
              placeholder="Ex: Ofertas de Verão, Banner Principal..."
              className="bg-zinc-900/50 border-zinc-800 rounded-xl h-12 text-[13px] font-medium text-zinc-100 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-zinc-600"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') confirmSave(); }}
            />
          </div>
          <DialogFooter className="gap-3 sm:gap-0 mt-4">
            <Button variant="ghost" onClick={() => setSaveModalOpen(false)} className="rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 text-[12px] font-medium">
              Cancelar
            </Button>
            <Button onClick={confirmSave} disabled={isSaving || !newLayoutName} className="bg-red-600 hover:bg-red-500 rounded-xl px-6 text-[12px] font-semibold text-white shadow-md shadow-red-900/20 transition-all disabled:opacity-50">
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Salvar Layout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
