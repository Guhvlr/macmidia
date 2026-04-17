import React from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import { ProductItem } from '../../context/OfferContext';

interface ConfidenceBadgeProps {
  product: ProductItem;
}

export const ConfidenceBadge = ({ product }: ConfidenceBadgeProps) => {
  const c = product.confidence;
  
  if (c === 'exact') return (
    <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full border border-green-500/20">
      <ShieldCheck className="w-2.5 h-2.5" /> EXATO
    </span>
  );
  
  if (c === 'high') return (
    <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full border border-green-500/20">
      <ShieldCheck className="w-2.5 h-2.5" /> ALTA
    </span>
  );
  
  if (c === 'medium') return (
    <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
      <ShieldAlert className="w-2.5 h-2.5" /> MÉDIA
    </span>
  );
  
  if (c === 'low' || c === 'none') return (
    <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
      <ShieldAlert className="w-2.5 h-2.5" /> CONFERIR
    </span>
  );
  
  return (
    <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest bg-white/5 text-white/30 px-2 py-0.5 rounded-full border border-white/10">
      <AlertTriangle className="w-2.5 h-2.5" /> SEM IMAGEM
    </span>
  );
};
