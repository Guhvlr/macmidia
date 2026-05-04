import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { X, Upload, Trash2, Loader2, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOffer } from '../context/OfferContext';

export const OfferFontsModal = ({ onClose }: { onClose: () => void }) => {
  const { customFonts, fetchFonts } = useOffer();
  const [fonts, setFonts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [newFontName, setNewFontName] = useState('');
  const [fontFile, setFontFile] = useState<File | null>(null);

  useEffect(() => {
    loadDatabaseFonts();
  }, []);

  const loadDatabaseFonts = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any).from('offer_fonts').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setFonts(data || []);
    } catch (err) {
      console.error('Erro ao carregar fontes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!newFontName.trim() || !fontFile) {
      toast.error('Informe o nome e selecione um arquivo de fonte.');
      return;
    }
    
    setUploading(true);
    try {
      const ext = fontFile.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${ext}`;
      const storagePath = `fonts/${fileName}`;

      // Upload para o bucket
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(storagePath, fontFile, { cacheControl: '31536000', upsert: true });

      if (uploadError) throw uploadError;

      // Pegar URL pública
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(storagePath);

      // Inserir no banco
      const { error: dbError } = await (supabase as any)
        .from('offer_fonts')
        .insert({ name: newFontName.trim(), url: publicUrl });

      if (dbError) throw dbError;

      toast.success('Fonte adicionada com sucesso!');
      setNewFontName('');
      setFontFile(null);
      await loadDatabaseFonts();
      await fetchFonts(); // Atualiza no store
    } catch (err: any) {
      toast.error('Erro ao adicionar fonte: ' + (err.message || ''));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, url: string) => {
    try {
      // Remover do banco
      const { error: dbError } = await (supabase as any).from('offer_fonts').delete().eq('id', id);
      if (dbError) throw dbError;

      // Opcional: remover do storage se quiser (pegar o nome do arquivo da URL)
      try {
        const parts = url.split('/');
        const fileName = parts[parts.length - 1];
        await supabase.storage.from('product-images').remove([`fonts/${fileName}`]);
      } catch (e) {
        // Ignorar se falhar ao excluir o arquivo
      }

      toast.success('Fonte removida!');
      setFonts(prev => prev.filter(f => f.id !== id));
      // Ideal seria também remover do DOM (document.fonts), mas isso exige refresh ou lidar com FontFace
    } catch (err: any) {
      toast.error('Erro ao remover: ' + (err.message || ''));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div 
        className="bg-[#111116] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Type className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-white">Gerenciador de Fontes</h2>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Adicione fontes personalizadas</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white/50" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6 overflow-y-auto">
          {/* Adicionar Fonte */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider">Adicionar Nova</h3>
            
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nome da Fonte (ex: Roboto)"
                value={newFontName}
                onChange={e => setNewFontName(e.target.value)}
                className="w-full h-10 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 outline-none focus:border-blue-500/50 transition-all"
              />
              
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2"
                  onChange={e => setFontFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="font-upload"
                />
                <label 
                  htmlFor="font-upload" 
                  className="flex-1 flex items-center justify-center gap-2 h-10 bg-white/5 border border-dashed border-white/20 rounded-lg text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 hover:border-white/40 transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  {fontFile ? fontFile.name : 'Selecionar Arquivo (.ttf, .otf)'}
                </label>

                <Button 
                  onClick={handleUpload} 
                  disabled={uploading || !newFontName.trim() || !fontFile}
                  className="h-10 px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                </Button>
              </div>
            </div>
          </div>

          {/* Lista de Fontes */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider flex items-center justify-between">
              Fontes Salvas
              <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] text-white/80">{fonts.length}</span>
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-8 text-white/30">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : fonts.length === 0 ? (
              <div className="text-center py-8 bg-white/[0.01] border border-white/5 rounded-xl">
                <Type className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-xs text-white/30">Nenhuma fonte personalizada salva.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {fonts.map(font => (
                  <div key={font.id} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-lg hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-white/40">
                        Aa
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white/90">{font.name}</p>
                        <p className="text-[10px] text-white/30 truncate max-w-[200px]" title={font.url}>{font.url}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDelete(font.id, font.url)}
                      className="p-2 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Remover fonte"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
