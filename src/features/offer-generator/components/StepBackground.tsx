import React from 'react';
import { useOffer } from '../context/OfferContext';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Image as ImageIcon, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const StepBackground = () => {
  const { config, updateConfig, layouts, setLayouts } = useOffer();
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    const fetch = async () => {
      const { data } = await (supabase as any).from('offer_layouts').select('*').order('created_at', { ascending: false });
      if (data) setLayouts(data);
    };
    fetch();
  }, []);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      updateConfig({ backgroundImageUrl: URL.createObjectURL(file) });
      (window as any)._stagedBg = file;
    }
  };

  const handleSave = async () => {
    if (!config.backgroundImageUrl) return;
    const name = prompt('Nome do layout:');
    if (!name) return;
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
      const { data, error } = await (supabase as any).from('offer_layouts').insert([{ name, image_url: url, config }]).select().single();
      if (error) throw error;
      if (data) setLayouts((prev: any[]) => [data, ...prev]);
      toast.success('Layout salvo!');
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

        {layouts.length > 0 && (
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase text-white/40">Layouts Salvos</label>
            <div className="grid grid-cols-3 gap-2">
              {layouts.map((ly: any) => (
                <button key={ly.id} onClick={() => updateConfig({ backgroundImageUrl: ly.image_url })}
                  className={`aspect-square rounded-xl border-2 overflow-hidden transition-all ${config.backgroundImageUrl === ly.image_url ? 'border-primary shadow-lg shadow-primary/20' : 'border-white/10 hover:border-white/30'}`}
                  title={ly.name}>
                  <img src={ly.image_url} className="w-full h-full object-cover" />
                </button>
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
    </div>
  );
};
