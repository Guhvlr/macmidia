import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Pencil, Database, Layers, ImagePlus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TourStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    icon: <Pencil className="w-8 h-8" />,
    title: 'Editar',
    description: 'Clique para alterar o nome, preço ou código de barras de qualquer produto. Você pode salvar apenas para esta oferta (Local) ou salvar permanentemente no banco de dados (BD).',
    color: 'from-blue-500/20 to-blue-600/5'
  },
  {
    icon: <Database className="w-8 h-8" />,
    title: 'Cadastrar',
    description: 'Aparece quando o sistema não encontra o produto. Permite cadastrar um produto novo no banco com foto, nome e código de barras. Nas próximas vezes, ele será encontrado automaticamente!',
    color: 'from-amber-500/20 to-amber-600/5'
  },
  {
    icon: <Layers className="w-8 h-8" />,
    title: 'Variações',
    description: 'Adicione outras versões do mesmo produto: sabores diferentes, tamanhos ou marcas. Ideal para ofertas agrupadas como "Monster Sabores" ou "Leite em Pó 200g e 400g".',
    color: 'from-purple-500/20 to-purple-600/5'
  },
  {
    icon: <ImagePlus className="w-8 h-8" />,
    title: 'Add Foto',
    description: 'Adiciona uma imagem do seu computador apenas para esta oferta, sem alterar o cadastro oficial. Perfeito para promoções especiais ou produtos temporários.',
    color: 'from-green-500/20 to-green-600/5'
  }
];

const TOUR_STORAGE_KEY = 'macoferta-tour-completed';

export const FirstUseTour = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const tourCompleted = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!tourCompleted) {
      // Show after a short delay so the page renders first
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleComplete = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setIsVisible(false);
  };

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  if (!isVisible) return null;

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center animate-in fade-in duration-300">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleComplete}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
        <div className="bg-[#0d0d0f] border-2 border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-black/50">
          
          {/* Header with gradient */}
          <div className={`relative p-8 pb-6 bg-gradient-to-br ${step.color}`}>
            <button 
              onClick={handleComplete}
              className="absolute top-4 right-4 p-2 text-white/40 hover:text-white transition-colors rounded-xl hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                Guia Rápido
              </span>
              <span className="text-[10px] font-bold text-white/30 ml-auto">
                {currentStep + 1} / {TOUR_STEPS.length}
              </span>
            </div>

            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-white border border-white/10 backdrop-blur-sm">
                {step.icon}
              </div>
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                  {step.title}
                </h2>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-6">
            <p className="text-sm text-white/70 leading-relaxed font-medium">
              {step.description}
            </p>
          </div>

          {/* Step indicators */}
          <div className="flex justify-center gap-2 px-8 pb-4">
            {TOUR_STEPS.map((_, i) => (
              <button 
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStep 
                    ? 'w-8 bg-primary' 
                    : i < currentStep 
                      ? 'w-4 bg-white/20' 
                      : 'w-4 bg-white/10'
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between px-8 pb-8 pt-2">
            <button 
              onClick={handleComplete}
              className="text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors py-2 px-3 rounded-lg hover:bg-white/5"
            >
              Pular Tour
            </button>
            
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button 
                  onClick={handlePrev}
                  className="h-10 px-4 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Anterior
                </Button>
              )}
              <Button 
                onClick={handleNext}
                className={`h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                  isLast 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-primary hover:bg-primary/90 text-white'
                }`}
              >
                {isLast ? 'Começar!' : 'Próximo'}
                {!isLast && <ChevronRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
