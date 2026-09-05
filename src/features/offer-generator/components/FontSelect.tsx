import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { loadGFont, SYSTEM_FONTS } from '../utils/fonts';

interface FontSelectProps {
  value: string;
  onChange: (font: string) => void;
  googleFonts: string[];
  customFonts: { name: string; url: string }[];
  className?: string;
}

const FontSelect: React.FC<FontSelectProps> = ({ value, onChange, googleFonts, customFonts, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus search on open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const displayValue = useMemo(() => {
    if (!value) return 'Montserrat';
    return value.split(',')[0].replace(/['"]/g, '').trim();
  }, [value]);

  const allFonts = useMemo(() => {
    const systemGroup: string[] = [];
    const googleGroup: string[] = [];
    const customGroup: string[] = [];

    googleFonts.forEach(f => {
      if (SYSTEM_FONTS.includes(f)) systemGroup.push(f);
      else googleGroup.push(f);
    });

    customFonts.forEach(f => {
      if (!googleFonts.includes(f.name)) customGroup.push(f.name);
    });

    return { systemGroup, googleGroup, customGroup };
  }, [googleFonts, customFonts]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return {
      systemGroup: allFonts.systemGroup.filter(f => f.toLowerCase().includes(q)),
      googleGroup: allFonts.googleGroup.filter(f => f.toLowerCase().includes(q)),
      customGroup: allFonts.customGroup.filter(f => f.toLowerCase().includes(q)),
    };
  }, [search, allFonts]);

  const handleSelect = (font: string) => {
    loadGFont(font);
    onChange(font);
    setIsOpen(false);
    setSearch('');
  };

  const hasResults = filtered.systemGroup.length + filtered.googleGroup.length + filtered.customGroup.length > 0;

  return (
    <div ref={containerRef} className={`relative ${className || ''}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl h-10 px-3 text-[12px] text-zinc-200 font-medium hover:border-zinc-700 transition-all outline-none focus:border-blue-500/50"
      >
        <span className="truncate" style={{ fontFamily: value || 'Montserrat, sans-serif' }}>{displayValue}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden" style={{ maxHeight: '280px' }}>
          {/* Search */}
          <div className="p-2 border-b border-zinc-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar fonte..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg h-8 pl-8 pr-3 text-[11px] text-zinc-200 outline-none focus:border-blue-500/50 placeholder:text-zinc-600"
              />
            </div>
          </div>

          {/* Options */}
          <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: '230px' }}>
            {!hasResults && (
              <div className="px-3 py-4 text-center text-zinc-500 text-[11px]">Nenhuma fonte encontrada</div>
            )}

            {filtered.customGroup.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[9px] font-bold text-blue-400 uppercase tracking-widest bg-blue-500/5 border-b border-zinc-800">Suas Fontes</div>
                {filtered.customGroup.map(f => (
                  <button
                    key={f}
                    onClick={() => handleSelect(f)}
                    className={`w-full text-left px-3 py-2 text-[12px] font-medium transition-colors hover:bg-zinc-800 ${
                      displayValue === f ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-300'
                    }`}
                    style={{ fontFamily: f }}
                  >
                    {f}
                  </button>
                ))}
              </>
            )}

            {filtered.googleGroup.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[9px] font-bold text-purple-400 uppercase tracking-widest bg-purple-500/5 border-b border-zinc-800">Google Fonts</div>
                {filtered.googleGroup.map(f => {
                  loadGFont(f); // preload for preview
                  return (
                    <button
                      key={f}
                      onClick={() => handleSelect(f)}
                      className={`w-full text-left px-3 py-2 text-[12px] font-medium transition-colors hover:bg-zinc-800 ${
                        displayValue === f ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-300'
                      }`}
                      style={{ fontFamily: f }}
                    >
                      {f}
                    </button>
                  );
                })}
              </>
            )}

            {filtered.systemGroup.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-800/50 border-b border-zinc-800">Sistema</div>
                {filtered.systemGroup.map(f => (
                  <button
                    key={f}
                    onClick={() => handleSelect(f)}
                    className={`w-full text-left px-3 py-2 text-[12px] font-medium transition-colors hover:bg-zinc-800 ${
                      displayValue === f ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-300'
                    }`}
                    style={{ fontFamily: f }}
                  >
                    {f}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FontSelect;
