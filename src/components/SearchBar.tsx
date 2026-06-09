import { Search, SlidersHorizontal, User, Hash, Filter } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface Suggestion {
  matricula: string;
  nome: string;
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearchVelocity: () => void;
  onClear: () => void;
  onSuggestionSelect?: (value: string) => void;
  placeholder?: string;
  suggestions?: Suggestion[];
  onOpenFilters?: () => void;
  hideActions?: boolean;
}

export default function SearchBar({ 
  value, 
  onChange, 
  onSearchVelocity, 
  onClear, 
  onSuggestionSelect,
  placeholder = "Buscar por matrícula, operador ou velocidade...",
  suggestions = [],
  onOpenFilters,
  hideActions = false
}: SearchBarProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<Suggestion[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value.trim().length > 0 && suggestions.length > 0) {
      const lowerValue = value.toLowerCase();
      const filtered = suggestions.filter(s => 
        s.nome.toLowerCase().includes(lowerValue) || 
        s.matricula.toLowerCase().includes(lowerValue)
      ).slice(0, 8); // Limit to 8 suggestions for better UX
      
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [value, suggestions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (suggestion: Suggestion) => {
    // Determine if we should set the name or matricula based on input type
    // If it's more like a name, use name. If it's numbers, use matricula?
    // Actually, usually users want the name if they are typing it.
    // Let's just use the selected value. 
    // If search was specifically for matricula, maybe they want that.
    // Let's provide both or choose one. 
    // User requested "agilizar a busca" (speed up search).
    const selectedValue = suggestion.nome;
    onChange(selectedValue);
    setShowSuggestions(false);
    if (onSuggestionSelect) {
      onSuggestionSelect(selectedValue);
    }
  };

  return (
    <div className="relative group w-full flex flex-col items-center justify-center mx-auto" ref={containerRef}>
      <div className="relative flex justify-center items-center h-[3.2cm] w-[3.2cm]">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
          <Search className="text-slate-400 group-focus-within:text-blue-600 transition-colors" size={14} />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (filteredSuggestions.length > 0) setShowSuggestions(true);
          }}
          style={{ 
            backgroundColor: '#FFFFFF',
            border: '1px solid #CBD5E1',
            color: '#0F172A',
            width: '3.2cm',
            height: '3.2cm',
            minWidth: '3.2cm',
            maxWidth: '3.2cm',
            minHeight: '3.2cm',
            maxHeight: '3.2cm'
          }}
          className="rounded-[20px] pl-8 pr-8 placeholder:text-[7.5px] placeholder:leading-tight focus:outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition-all text-[10px] font-bold text-center shadow-sm"
          placeholder="Buscar..."
          id="dashboard-search-input"
          autoComplete="off"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
          <button 
            style={{ color: '#475569' }}
            className="p-1 hover:bg-slate-100 rounded-lg transition-all cursor-pointer" 
            id="search-filters"
          >
            <SlidersHorizontal size={12} />
          </button>
        </div>

        {/* Autocomplete Dropdown */}
        {showSuggestions && (
          <div className="absolute z-[110] top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {filteredSuggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.matricula}-${index}`}
                onClick={() => handleSelect(suggestion)}
                className="w-full flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 text-left cursor-pointer group/item"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover/item:bg-blue-50 group-hover/item:text-blue-600 transition-colors">
                  {/* Heuristic: if it's alphanumeric it's matricula, but most are numbers */}
                  {/^\d+$/.test(suggestion.matricula) ? <Hash size={18} /> : <User size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-900 truncate">
                    {suggestion.nome}
                  </p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                    Matrícula: {suggestion.matricula}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {!hideActions && (
        <>
          <div className="flex flex-wrap gap-4 mt-5">
            <button
              onClick={onSearchVelocity}
              style={{ 
                backgroundColor: '#1D4ED8',
                color: '#FFFFFF'
              }}
              className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-600/20 active:scale-95 cursor-pointer"
            >
              Buscar Velocidade
            </button>
            {onOpenFilters && (
              <button
                onClick={onOpenFilters}
                style={{ 
                  backgroundColor: '#10B981',
                  color: '#FFFFFF'
                }}
                className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <Filter size={14} />
                FILTER
              </button>
            )}
            <button
              onClick={onClear}
              style={{ 
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                color: '#475569'
              }}
              className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-sm transition-all active:scale-95 cursor-pointer hover:bg-slate-50"
            >
              Limpar Filtros
            </button>
          </div>
          
          {/* Search info badge */}
          <div className="mt-4 text-[10px] text-slate-400 font-black uppercase tracking-widest flex gap-4 italic text-center justify-center">
            <span>Ex: "45" (45-50 km/h)</span>
            <span className="opacity-40">•</span>
            <span>Ex: "João" (Operador)</span>
            <span className="opacity-40">•</span>
            <span>Ex: "ABC-123" (Matrícula)</span>
          </div>
        </>
      )}
    </div>
  );
}
