import React from 'react';
import { ShieldCheck, Zap, AlertCircle, HelpCircle } from 'lucide-react';
import { ProductItem } from '../../context/OfferContext';

export const ConfidenceBadge = ({ product }: { product: ProductItem }) => {
  const c = product.confidence;
  
  if (c === 'exact') return (
    <span className="flex items-center gap-1 text-[9px] font-semibold bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full border border-red-500/20">
      <ShieldCheck className="w-3 h-3" /> EXATO
    </span>
  );
  
  if (c === 'high') return (
    <span className="flex items-center gap-1 text-[9px] font-semibold bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full border border-amber-500/20">
      <Zap className="w-3 h-3" /> ALTA
    </span>
  );
  
  if (c === 'low') return (
    <span className="flex items-center gap-1 text-[9px] font-semibold bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-700">
      <AlertCircle className="w-3 h-3" /> MÉDIA
    </span>
  );
  
  return (
    <span className="flex items-center gap-1 text-[9px] font-semibold bg-zinc-900 text-zinc-500 px-2 py-0.5 rounded-full border border-zinc-800">
      <HelpCircle className="w-3 h-3" /> BAIXA
    </span>
  );
};
