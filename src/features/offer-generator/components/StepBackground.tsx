import React from 'react';
import { useOffer } from '../context/OfferContext';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Image as ImageIcon, Loader2, Save, CheckCircle, Trash2 } from 'lucide-react';
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
      
      const finalName = selectedClientName ? `[${selectedClientName}] ${name}` : name;
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
    <div className="h-full flex">
      {/* Left: upload + saved */}
      <div className="w-[360px] border-r border-white/5 bg-[#121214] p-6 overflow-y-auto custom-scrollbar space-y-6">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-white mb-1">Etapa 1</h2>
          <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider">Escolha o layout de fundo</p>
        </div>

        <div className="space-y-3">
          <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-white/10 rounded-2xl hover:border-primary/40 cursor-pointer transition-all group">
            <Upload className="w-8 h-8 text-white/20 group-hover:text-primary/60 transition-colors" />
            <span className="text-xs font-bold text-white/40 group-hover:text-white/70">Subir imagem de fundo</span>
            <span className="text-[9px] text-white/20">JPG, PNG, WebP</span>
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          </label>

          {config.backgroundImageUrl && (
            <Button onClick={handleSave} disabled={isSaving} variant="outline" className="w-full bg-white/5 border-white/10 rounded-xl text-xs font-bold">
              {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-2 text-green-400" />}
              Salvar Layout para a Equipe
            </Button>
          )}
        </div>

        {filteredLayouts.length > 0 && (
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase text-white/40">Pastas / Layouts de {selectedClientName || 'Geral'}</label>
            <div className="grid grid-cols-3 gap-2">
              {filteredLayouts.map((ly: any) => (
                <div key={ly.id} className="relative group/card aspect-square">
                  <button onClick={() => updateConfig({ backgroundImageUrl: ly.image_url })}
                    className={`w-full h-full rounded-xl border-2 overflow-hidden transition-all ${config.backgroundImageUrl === ly.image_url ? 'border-primary shadow-lg shadow-primary/20' : 'border-white/10 hover:border-white/30'}`}
                    title={ly.name}>
                    <img src={ly.image_url} className="w-full h-full object-cover" />
                  </button>
                  <button 
                    onClick={(e) => handleDelete(e, ly.id)}
                    className="absolute -top-1.5 -right-1.5 p-1.5 bg-red-500 rounded-lg text-white opacity-0 group-hover/card:opacity-100 hover:scale-110 transition-all shadow-lg z-10"
                    title="Excluir Layout"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: preview */}
      <div className="flex-1 bg-black/40 flex items-center justify-center p-8 overflow-auto">
        {config.backgroundImageUrl ? (
          <div className="shadow-2xl ring-1 ring-white/10 rounded-lg overflow-hidden">
            <img src={config.backgroundImageUrl} style={{ maxWidth: '600px', maxHeight: '600px', objectFit: 'contain' }} />
          </div>
        ) : (
          <div className="text-center space-y-4">
            <ImageIcon className="w-16 h-16 text-white/10 mx-auto" />
            <p className="text-white/20 text-sm font-bold">Selecione ou suba um layout de fundo</p>
            <p className="text-[10px] text-white/15">Essa imagem será a base do seu encarte</p>
          </div>
        )}
      </div>

      <Dialog open={saveModalOpen} onOpenChange={setSaveModalOpen}>
        <DialogContent className="bg-[#0d0d10] border-white/10 text-white rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
               <Save className="w-5 h-5 text-primary" /> Salvar Layout
            </DialogTitle>
            <DialogDescription className="text-white/40 text-[11px] font-bold uppercase tracking-wider">
               Escolha um nome para identificar este layout na pasta {selectedClientName || 'Geral'}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <Input
              value={newLayoutName}
              onChange={(e) => setNewLayoutName(e.target.value)}
              placeholder="Ex: Ofertas de Verão, Banner Principal..."
              className="bg-white/5 border-white/10 rounded-xl h-12 text-sm font-bold text-white focus:border-primary/50 transition-all"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') confirmSave(); }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setSaveModalOpen(false)} className="rounded-xl text-white/30 hover:text-white hover:bg-white/5 text-[10px] font-black uppercase tracking-widest">
              Cancelar
            </Button>
            <Button onClick={confirmSave} disabled={isSaving || !newLayoutName} className="bg-primary hover:bg-primary/90 rounded-xl px-8 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all">
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Confirmar e Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
