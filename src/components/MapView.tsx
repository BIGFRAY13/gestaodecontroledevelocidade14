import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Popup,
  useMap,
  Polyline,
  Polygon,
  LayerGroup,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TelemetryRecord, AsphaltedStretch } from '../types';
import { format } from 'date-fns';
import { X, Calendar, Car, Briefcase, Gauge, MapPin, Maximize2, Minimize2, Filter } from 'lucide-react';

interface Props {
  data: TelemetryRecord[];
  selectedRecords?: TelemetryRecord[];
  stretches?: AsphaltedStretch[];
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onRecordClick?: (record: TelemetryRecord) => void;
  onClearSelection?: () => void;
  // Dynamic filters pass-through for managing view state in Fullscreen Mode
  onOpenFilters?: () => void;
  activeFilters?: {
    unidade: string;
    frente: string;
    operacao: string;
    frota: string;
    speedRange: string;
  };

  // State bindings for top-of-map Filter Toolbar
  selectedUnidade: string;
  setSelectedUnidade: (val: string) => void;
  selectedFrente: string;
  setSelectedFrente: (val: string) => void;
  selectedOperacao: string;
  setSelectedOperacao: (val: string) => void;
  selectedFrota: string;
  setSelectedFrota: (val: string) => void;
  excessSpeed: number | '';
  setExcessSpeed: (val: number | '') => void;

  availableUnidades: string[];
  availableFrentes: string[];
  availableOperacoes: string[];
  availableFrotas: string[];
}

// Custom CSS defined in index.css but we can also use DivIcon for the vertical bar effect
const createBarIcon = (speed: number, isSelected?: boolean) => {
  const scaleMultiplier = 1.5;
  const minHeight = 15;
  const height = Math.max(minHeight, speed * scaleMultiplier);
  const width = 6;
  const selectedWidth = 10;
  
  let color = '#94A3B8'; // Default grey for low speeds
  if (speed >= 10 && speed <= 20) color = '#3B82F6';      // Bright Blue (Improved contrast)
  else if (speed > 20 && speed <= 30) color = '#FBBF24';  // Amber/Yellow
  else if (speed > 30 && speed <= 40) color = '#F97316';  // Orange
  else if (speed > 40 && speed <= 50) color = '#EF4444';  // Bright Red
  else if (speed > 50 && speed <= 60) color = '#8B5CF6';  // Purple
  else if (speed > 60) color = '#10B981';                 // Green (Solinftec green)
  
  if (isSelected) {
    return L.divIcon({
      className: 'custom-bar-icon-selected_marker',
      html: `
        <div class="bar-icon-inner-selected" style="position: relative;">
          <!-- Glowing high-contrast outline bar -->
          <div style="background-color: ${color}; width: ${selectedWidth}px; height: ${height + 8}px; border-radius: 6px; box-shadow: 0 0 20px #FBBF24, 0 0 8px #FBBF24; border: 3px solid #FFFFFF;"></div>
          <!-- Beacon indicator -->
          <div style="position: absolute; bottom: -6px; left: 1.5px; width: 9px; height: 9px; background-color: #FBBF24; border-radius: 50%; box-shadow: 0 0 10px #FBBF24; border: 2px solid #FFFFFF;"></div>
        </div>
      `,
      iconSize: [selectedWidth, height + 8],
      iconAnchor: [selectedWidth / 2, height + 8]
    });
  }

  return L.divIcon({
    className: 'custom-bar-icon',
    html: `
      <div class="bar-icon-inner" style="
        background-color: ${color}; 
        width: ${width}px; 
        height: ${height}px; 
        border-radius: 4px; 
        box-shadow: 0 2px 6px rgba(0,0,0,0.5); 
        border: 1px solid #FFFFFF;
      "></div>
    `,
    iconSize: [width, height],
    iconAnchor: [width / 2, height]
  });
};

const mapCenter: [number, number] = [-20.0, -49.0];

function MapEventController({ onMapInstance }: { onMapInstance: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    if (map) {
      onMapInstance(map);
    }
  }, [map, onMapInstance]);
  return null;
}

function getDistanceMeters(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateStretchLengthStr(stretch: AsphaltedStretch): string {
  let lengthMeters = 0;
  for (let i = 0; i < stretch.coordinates.length - 1; i++) {
    lengthMeters += getDistanceMeters(stretch.coordinates[i], stretch.coordinates[i + 1]);
  }
  if (lengthMeters >= 1000) {
    return `${(lengthMeters / 1000).toFixed(2).replace('.', ',')} km`;
  }
  return `${Math.round(lengthMeters)} m`;
}

export default function MapView({ 
  data, 
  selectedRecords = [], 
  stretches = [],
  isFullscreen, 
  onToggleFullscreen, 
  onRecordClick,
  onClearSelection,
  onOpenFilters,
  activeFilters,
  selectedUnidade,
  setSelectedUnidade,
  selectedFrente,
  setSelectedFrente,
  selectedOperacao,
  setSelectedOperacao,
  selectedFrota,
  setSelectedFrota,
  excessSpeed,
  setExcessSpeed,
  availableUnidades,
  availableFrentes,
  availableOperacoes,
  availableFrotas
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapType, setMapType] = useState<'normal' | 'satellite'>('satellite');
  const [selectedRecord, setSelectedRecord] = useState<TelemetryRecord | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [map, setMap] = useState<L.Map | null>(null);
  const [showExcessInput, setShowExcessInput] = useState(false);

  useEffect(() => {
    console.log('[DEBUG_MAP] Ocorrências enviadas para renderizar no mapa:', data.length);
  }, [data]);

  // Prevent background scrolling when in fullscreen mode
  useEffect(() => {
    if (isFullscreen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isFullscreen]);

  // Invalidate map size when fullscreen toggles
  useEffect(() => {
    if (map) {
      // Invalidate immediately
      map.invalidateSize();

      // And also after a 300ms delay to make sure the transition has completed and container layout is fully rendered
      const timer = setTimeout(() => {
        map.invalidateSize();
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [isFullscreen, map]);

  // Sync native browser Fullscreen exits with local state and execute invalidateSize
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (map) {
        map.invalidateSize();
      }
      const isCurrentlyNativeFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement ||
        (document as any).mozFullScreenElement
      );
      // Synchronize in case native fullscreen was dismissed (e.g., ESC key pressed)
      if (!isCurrentlyNativeFullscreen && isFullscreen) {
        onToggleFullscreen?.();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, [isFullscreen, onToggleFullscreen, map]);

  const handleToggleFullscreen = async () => {
    if (!onToggleFullscreen) return;
    
    // Call props function to update application state
    onToggleFullscreen();

    if (!isFullscreen) {
      try {
        const container = mapContainerRef.current;
        if (container) {
          if (container.requestFullscreen) {
            await container.requestFullscreen();
          } else if ((container as any).webkitRequestFullscreen) {
            await (container as any).webkitRequestFullscreen();
          } else if ((container as any).msRequestFullscreen) {
            await (container as any).msRequestFullscreen();
          }
        }
      } catch (err) {
        console.warn("Fullscreen API is blocked or unsupported, relying on CSS fallback:", err);
        // Do not call onToggleFullscreen() again to toggle off, let the CSS fallback work!
      }
    } else {
      try {
        const hasNativeFs = !!(
          document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).msFullscreenElement
        );
        if (hasNativeFs) {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if ((document as any).webkitExitFullscreen) {
            await (document as any).webkitExitFullscreen();
          } else if ((document as any).msExitFullscreen) {
            await (document as any).msExitFullscreen();
          }
        }
      } catch (err) {
        console.warn("Could not exit native fullscreen:", err);
      }
    }
  };

  const validPoints = data
    .filter(
      (item) => item.latitude && item.longitude && !isNaN(Number(item.latitude)) && !isNaN(Number(item.longitude))
    )
    .slice(0, 1000);

  const center: [number, number] = validPoints.length > 0 
    ? [Number(validPoints[0].latitude), Number(validPoints[0].longitude)]
    : mapCenter;

  const handleMarkerClick = (record: TelemetryRecord) => {
    setSelectedRecord(record);
    onRecordClick?.(record);
  };

  // Module 01: Heatmap of occurrence concentrations above 40 km/h
  const heatClusters = useMemo(() => {
    const clusters: {
      id: string;
      centerLat: number;
      centerLng: number;
      count: number;
      avgSpeed: number;
      maxSpeed: number;
      operators: Set<string>;
      fleets: Set<string>;
      points: TelemetryRecord[];
    }[] = [];

    // Filter infraction points
    const over40Points = data.filter(item => 
      item.latitude && item.longitude && 
      !isNaN(Number(item.latitude)) && !isNaN(Number(item.longitude)) &&
      (item as any).isInfraction
    );

    over40Points.forEach(item => {
      const lat = Number(item.latitude);
      const lng = Number(item.longitude);
      
      // Determine distance proximity (~150-200 meters grid)
      const found = clusters.find(c => {
        const dLat = Math.abs(c.centerLat - lat);
        const dLng = Math.abs(c.centerLng - lng);
        return dLat < 0.0015 && dLng < 0.0015;
      });

      if (found) {
        found.points.push(item);
        found.count += 1;
        found.maxSpeed = Math.max(found.maxSpeed, item.velocidade);
        found.centerLat = found.points.reduce((sum, p) => sum + Number(p.latitude), 0) / found.points.length;
        found.centerLng = found.points.reduce((sum, p) => sum + Number(p.longitude), 0) / found.points.length;
        if (item.descricaoOperador) found.operators.add(item.descricaoOperador);
        if (item.frota) found.fleets.add(item.frota);
      } else {
        const operators = new Set<string>();
        if (item.descricaoOperador) operators.add(item.descricaoOperador);
        const fleets = new Set<string>();
        if (item.frota) fleets.add(item.frota);

        clusters.push({
          id: `heat-${item.id}`,
          centerLat: lat,
          centerLng: lng,
          count: 1,
          avgSpeed: item.velocidade,
          maxSpeed: item.velocidade,
          operators,
          fleets,
          points: [item]
        });
      }
    });

    clusters.forEach(c => {
      c.avgSpeed = c.points.reduce((sum, p) => sum + p.velocidade, 0) / c.points.length;
    });

    return clusters;
  }, [data]);

  // Color specifications for heatmap based on Concentration count
  const getClusterColor = (count: number) => {
    if (count <= 2) return '#22C55E'; // Green: Baixa incidência
    if (count <= 5) return '#EAB308'; // Yellow: Média incidência
    if (count <= 10) return '#F97316'; // Orange: Alta incidência
    return '#EF4444'; // Red: Local crítico
  };

  const getClusterLevelText = (count: number) => {
    if (count <= 2) return 'Baixa incidência';
    if (count <= 5) return 'Média incidência';
    if (count <= 10) return 'Alta incidência';
    return 'Local crítico';
  };

  const containerStyle: React.CSSProperties = isFullscreen ? {
    backgroundColor: '#0F172A',
    width: '100vw',
    height: '100vh',
    maxWidth: 'none',
    maxHeight: 'none',
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: 999999,
  } : {
    backgroundColor: '#0F172A'
  };

  return (
    <div 
      ref={mapContainerRef}
      style={containerStyle}
      className={isFullscreen ? 'overflow-hidden relative' : 'relative w-full h-[700px] overflow-hidden border border-slate-200 shadow-2xl rounded-3xl transition-all duration-300'}
    >
      {/* Dynamic Overlay Floating Filter Toolbar - High Quality Glassmorphism */}
      <div 
        onMouseDown={(e) => e.stopPropagation()} 
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className={`absolute ${isFullscreen ? 'bottom-4' : 'top-4'} left-4 z-[1001] flex flex-wrap items-center gap-4 bg-slate-900/95 backdrop-blur-md border border-white/10 p-3.5 rounded-2xl shadow-2xl pointer-events-auto text-white animate-in ${isFullscreen ? 'slide-in-from-bottom' : 'slide-in-from-top'} duration-300 max-w-[calc(100%-480px)]`}
      >
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-emerald-400 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-[#10B981]">Filtros do Mapa</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* 1. UNIDADE */}
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Unidade</span>
            <select 
              value={selectedUnidade}
              onChange={(e) => setSelectedUnidade(e.target.value)}
              className="bg-slate-800 text-white border border-white/10 text-xs font-bold rounded-xl py-2 px-3 focus:outline-none focus:border-emerald-400 transition-all cursor-pointer min-w-[100px]"
            >
              <option value="Todas">Todas</option>
              {['UVP', 'UVT', 'UCP'].map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
              {availableUnidades.filter(u => u !== 'UVP' && u !== 'UVT' && u !== 'UCP').map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          {/* 2. SETOR */}
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Setor</span>
            <select 
              value={selectedFrente}
              onChange={(e) => setSelectedFrente(e.target.value)}
              className="bg-slate-800 text-white border border-white/10 text-xs font-bold rounded-xl py-2 px-3 focus:outline-none focus:border-emerald-400 transition-all cursor-pointer min-w-[120px]"
            >
              <option value="Todas">Todos</option>
              {availableFrentes.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* 3. OPERAÇÃO */}
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Operação</span>
            <select 
              value={selectedOperacao}
              onChange={(e) => setSelectedOperacao(e.target.value)}
              className="bg-slate-800 text-white border border-white/10 text-xs font-bold rounded-xl py-2 px-3 focus:outline-none focus:border-emerald-400 transition-all cursor-pointer min-w-[140px]"
            >
              <option value="Todas">Todas</option>
              {availableOperacoes.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          {/* 4. FROTA */}
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Frota</span>
            <select 
              value={selectedFrota}
              onChange={(e) => setSelectedFrota(e.target.value)}
              className="bg-slate-800 text-white border border-white/10 text-xs font-bold rounded-xl py-2 px-3 focus:outline-none focus:border-emerald-400 transition-all cursor-pointer min-w-[120px]"
            >
              <option value="Todas">Todas</option>
              {availableFrotas.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* 5. EXCESSO BUTTON / INPUT TOGGLE */}
          <div className="flex items-center gap-2 pt-3">
            <button 
              type="button"
              onClick={() => setShowExcessInput(!showExcessInput)}
              className={`font-semibold text-xs rounded-xl py-2 px-3 flex items-center gap-1.5 transition-all h-[34px] ${
                showExcessInput || excessSpeed !== ''
                  ? 'bg-emerald-500 text-slate-950 font-black'
                  : 'bg-slate-800 text-white border border-white/10 hover:bg-slate-700'
              }`}
            >
              <span>EXCESSO</span>
              {excessSpeed !== '' && (
                <span className="bg-slate-900/80 text-white text-[10px] px-1.5 py-0.5 rounded-lg font-black">
                  &gt;={excessSpeed}
                </span>
              )}
            </button>

            {showExcessInput && (
              <input 
                type="number"
                min="0"
                value={excessSpeed}
                onChange={(e) => {
                  const val = e.target.value;
                  setExcessSpeed(val === '' ? '' : Number(val));
                }}
                placeholder="Ex: 45"
                className="bg-slate-800 text-white border border-emerald-400 text-xs font-bold rounded-xl py-1.5 px-2.5 focus:outline-none transition-all w-[70px] h-[34px] animate-in slide-in-from-left duration-200"
                autoFocus
              />
            )}
          </div>

          {/* 6. CLEAN BUTTON */}
          <div className="flex flex-col gap-1 justify-end pt-3">
            <button 
              type="button"
              onClick={() => {
                setSelectedUnidade('Todas');
                setSelectedFrente('Todas');
                setSelectedOperacao('Todas');
                setSelectedFrota('Todas');
                setExcessSpeed('');
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 font-bold transition-all p-2 rounded-xl text-[10px] uppercase flex items-center justify-center cursor-pointer h-[34px] tracking-wider"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      {/* Floating Left Panel of Selected Points Counter & Active Filters */}
      <div className="absolute top-28 left-4 z-[1000] flex flex-col gap-2.5 pointer-events-auto max-w-[280px]">
        <div className="bg-[#0F172A]/90 backdrop-blur border border-white/10 px-5 py-3 rounded-2xl flex items-center gap-3 shadow-2xl">
          <div className="w-8 h-8 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
            <MapPin size={16} />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Ocorrências Selecionadas</p>
            <h4 className="text-xs font-black text-white">{selectedRecords.length} selecionadas</h4>
          </div>
        </div>
        
        {selectedRecords.length > 0 && onClearSelection && (
          <button
            onClick={onClearSelection}
            className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-[9px] px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all w-fit shadow-lg shadow-red-600/10 active:scale-95 cursor-pointer animate-in fade-in zoom-in duration-200"
          >
            <X size={10} />
            Limpar Seleção
          </button>
        )}


      </div>

      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 items-end pointer-events-auto">
        <button
          onClick={() => setMapType('satellite')}
          style={{ 
            backgroundColor: mapType === 'satellite' ? '#1D4ED8' : '#FFFFFF',
            color: mapType === 'satellite' ? '#FFFFFF' : '#0F172A',
            border: '1px solid #CBD5E1'
          }}
          className="px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer shadow-md hover:scale-105"
        >
          Mapa Real
        </button>

        <button
          onClick={() => setMapType('normal')}
          style={{ 
            backgroundColor: mapType === 'normal' ? '#1D4ED8' : '#FFFFFF',
            color: mapType === 'normal' ? '#FFFFFF' : '#0F172A',
            border: '1px solid #CBD5E1'
          }}
          className="px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer shadow-md hover:scale-105"
        >
          Mapa
        </button>

        {/* Heatmap Toggle Button Module 01 */}
        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          style={{ 
            backgroundColor: showHeatmap ? '#EF4444' : '#1E293B',
            color: '#FFFFFF',
            border: showHeatmap ? '1.5px solid #EF4444' : '1px solid #1E293B'
          }}
          className="px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5 hover:brightness-110 shadow-lg active:scale-95 text-white hover:scale-105"
        >
          🔥 {showHeatmap ? 'Pontos de Excesso' : 'Mapa de Calor'}
        </button>

        {onToggleFullscreen && (
          <button
            onClick={handleToggleFullscreen}
            style={{ 
              backgroundColor: isFullscreen ? '#EF4444' : '#FFFFFF',
              color: isFullscreen ? '#FFFFFF' : '#0F172A',
              border: isFullscreen ? '1.5px solid #EF4444' : '1px solid #CBD5E1'
            }}
            className="px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5 hover:brightness-110 shadow-lg active:scale-95 hover:scale-105"
          >
            {isFullscreen ? (
              <>
                <Minimize2 size={14} /> ✕ SAIR DA TELA CHEIA
              </>
            ) : (
              <>
                <Maximize2 size={14} /> ⛶ TELA CHEIA
              </>
            )}
          </button>
        )}
      </div>

      {/* Floating Info Sidebar */}
      {selectedRecord && (
        <div 
          style={{ 
            backgroundColor: '#FFFFFF',
            borderRight: '1px solid #CBD5E1',
            boxShadow: '10px 0 30px rgba(0,0,0,0.1)'
          }}
          className="absolute left-0 top-0 bottom-0 w-[320px] z-[1001] flex flex-col animate-in slide-in-from-left duration-300 pointer-events-auto"
        >
          <div 
            style={{ backgroundColor: '#0F172A' }}
            className="p-6 text-white flex items-center justify-between"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Operador Selecionado</p>
              <h2 className="text-lg font-black uppercase tracking-tight mt-1">{selectedRecord.matricula}</h2>
            </div>
            <button 
              onClick={() => setSelectedRecord(null)}
              className="p-2 hover:bg-white/10 rounded-xl transition-all"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nome do Operador</p>
              <h3 className="text-base font-black uppercase text-slate-900 leading-tight">
                {selectedRecord.descricaoOperador || 'SEM MOTORISTA'}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar size={12} />
                  <p className="text-[10px] font-black uppercase tracking-widest">Data/Hora</p>
                </div>
                <p className="text-xs font-bold text-slate-700">{format(selectedRecord.dataHora, "dd/MM/yyyy HH:mm:ss")}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-400">
                  <Car size={12} />
                  <p className="text-[10px] font-black uppercase tracking-widest">Frota</p>
                </div>
                <p className="text-xs font-bold text-slate-700">{selectedRecord.frota || '---'}</p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-slate-400">
                <Briefcase size={12} />
                <p className="text-[10px] font-black uppercase tracking-widest">Operação</p>
              </div>
              <p className="text-xs font-bold text-slate-700 uppercase">{selectedRecord.operacao}</p>
            </div>

            <div 
              style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
              className="p-5 rounded-2xl flex flex-col items-center justify-center text-center"
            >
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Gauge size={16} />
                <p className="text-[10px] font-black uppercase tracking-widest">Velocidade Atual</p>
              </div>
              <div className="flex items-baseline gap-1">
                <h1 
                  style={{ color: (selectedRecord as any).isInfraction ? '#DC2626' : '#16A34A' }}
                  className="text-5xl font-black italic tracking-tighter"
                >
                  {Number(selectedRecord.velocidade).toFixed(2).replace('.', ',')}
                </h1>
                <span className="text-xs font-black text-slate-400 italic">KM/H</span>
              </div>

              {/* Dynamic via type, limit and excess */}
              <div className="mt-4 pt-4 border-t border-slate-100 w-full text-left space-y-2 text-[10px] font-bold text-slate-600 uppercase">
                <div className="flex justify-between">
                  <span>Tipo de via:</span>
                  <span className="text-slate-950">{(selectedRecord as any).roadType || 'Estrada de Terra'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Limite Real:</span>
                  <span className="text-slate-950">{(selectedRecord as any).roadLimit || 40} KM/H</span>
                </div>
                <div className="flex justify-between">
                  <span>Excesso:</span>
                  <span style={{ color: (selectedRecord as any).isInfraction ? '#DC2626' : '#16A34A' }}>
                    {parseFloat((selectedRecord as any).excesso || 0) > 0 
                      ? `${Number((selectedRecord as any).excesso).toFixed(2).replace('.', ',')} KM/H`
                      : 'Nenhum'
                    }
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                const url = `https://www.google.com/maps/search/?api=1&query=${selectedRecord.latitude},${selectedRecord.longitude}`;
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
              style={{ backgroundColor: '#1D4ED8' }}
              className="w-full h-14 rounded-2xl text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:bg-blue-700 shadow-lg shadow-blue-600/20"
            >
              <MapPin size={16} /> Abrir no Google Maps
            </button>
          </div>
          
          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">
              Auditoria de Telemetria G.C.V PRO
            </p>
          </div>
        </div>
      )}

      {/* Dynamic Speed Color Legend Box (High quality visual support) */}
      <div className={`absolute bottom-4 right-4 z-[1000] bg-[#0F172A]/95 backdrop-blur border border-white/15 p-4 rounded-2xl shadow-2xl transition-all duration-300 max-w-[245px] pointer-events-auto text-white space-y-2.5 ${isFullscreen ? 'scale-105' : 'opacity-90 hover:opacity-100'}`}>
        <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-[#10B981]">Código de Cores</span>
          <span className="text-[8px] text-slate-400 font-extrabold uppercase bg-white/5 px-1.5 py-0.5 rounded leading-none">Velocidade</span>
        </div>
        <div className="grid grid-cols-1 gap-1.5 text-[10px] font-medium text-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-[#10B981] border border-white/35 shrink-0"></div>
            <span>&gt; 60 km/h (Massa Crítica)</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-[#8B5CF6] border border-white/35 shrink-0"></div>
            <span>51 - 60 km/h (Acelerado)</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-[#EF4444] border border-white/35 shrink-0"></div>
            <span>41 - 50 km/h (Excesso Alto)</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-[#F97316] border border-white/35 shrink-0"></div>
            <span>31 - 40 km/h (Excesso Médio)</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-[#FBBF24] border border-white/35 shrink-0"></div>
            <span>21 - 30 km/h (Moderado)</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-[#3B82F6] border border-white/35 shrink-0"></div>
            <span>10 - 20 km/h (Operacional)</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-[#94A3B8] border border-white/35 shrink-0"></div>
            <span>&lt; 10 km/h (Manobra / Parado)</span>
          </div>
        </div>

        {/* Dynamic Road Type classification legend (Floating panel overlay as requested) */}
        <div className="border-t border-white/10 pt-2 mt-2 space-y-1.5 text-[10px] font-medium text-slate-200 uppercase">
          <span className="text-[9px] font-black uppercase tracking-widest text-blue-400 block border-b border-white/5 pb-1 mb-1 leading-none">Classificação de Vias</span>
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-2 bg-blue-600 rounded opacity-85 shrink-0"></div>
            <span>🟦 Vicinal Asfaltada (60)</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-2 bg-amber-800 rounded opacity-85 shrink-0"></div>
            <span>🟫 Estrada de Terra (40)</span>
          </div>
        </div>
      </div>

      <MapContainer
        center={center}
        zoom={validPoints.length > 0 ? 15 : 4}
        scrollWheelZoom={true}
        className="w-full h-full"
        preferCanvas={true}
        zoomAnimation={false}
        fadeAnimation={true}
        markerZoomAnimation={false}
      >
        {/* Render saved asphalt stretches dynamically on map in Blue color */}
        {stretches && (
          <LayerGroup key="asphalt-stretches">
            {stretches.map((stretch) => {
              const path = stretch.coordinates.map(c => [c.lat, c.lng] as [number, number]);
              return (
                <Polyline
                  key={stretch.id}
                  positions={path}
                  pathOptions={{ color: '#2563EB', weight: 6, opacity: 0.85 }}
                >
                  <Popup>
                    <div className="p-2 space-y-1 text-slate-800 text-[11px] font-bold">
                      <div className="font-extrabold text-slate-950 border-b border-slate-100 pb-1 mb-1 text-xs">
                        {stretch.name}
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500 uppercase">Via:</span>
                        <span className="text-slate-900 font-extrabold">VICINAL ASFALTADA</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500 uppercase">Extensão:</span>
                        <span className="text-slate-900 font-extrabold">{calculateStretchLengthStr(stretch)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500 uppercase">Data Cadastro:</span>
                        <span className="text-slate-900 font-extrabold">
                          {new Date(stretch.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </Popup>
                </Polyline>
              );
            })}
          </LayerGroup>
        )}
        <MapEventController onMapInstance={setMap} />
        {mapType === 'normal' ? (
          <TileLayer
            key="tile-normal"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        ) : (
          <TileLayer
            key="tile-satellite"
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}

        {showHeatmap ? (
          /* Render Heatmap circles based on concentration module 01 */
          <LayerGroup key="heatmap-circles">
            {heatClusters.map((cluster) => {
              const color = getClusterColor(cluster.count);
              return (
                <Circle
                  key={cluster.id}
                  center={[cluster.centerLat, cluster.centerLng]}
                  radius={200}
                  pathOptions={{
                    fillColor: color,
                    color: color,
                    fillOpacity: 0.65,
                    weight: 2,
                    dashArray: '3, 6'
                  }}
                >
                  <Popup>
                    <div className="p-4 bg-slate-900 border border-white/10 text-white rounded-2xl space-y-3 text-xs min-w-[280px] shadow-2xl">
                      <div className="border-b border-white/10 pb-2 mb-1 flex items-center justify-between">
                        <span className="font-sans font-black uppercase tracking-widest text-[9px]" style={{ color }}>
                          🔥 {getClusterLevelText(cluster.count)}
                        </span>
                        <span style={{ backgroundColor: color }} className="inline-block w-4 h-4 rounded-full border border-white/20 animate-pulse shrink-0" />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center p-2 bg-white/5 rounded-xl">
                        <div>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Ocorrências</p>
                          <h4 style={{ color }} className="text-xl font-black mt-0.5">{cluster.count}</h4>
                        </div>
                        <div>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Velo Máxima</p>
                          <h4 className="text-xl font-black text-white mt-0.5">{cluster.maxSpeed.toFixed(0)} <span className="text-[9px]">KM/H</span></h4>
                        </div>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Velocidade Média:</span>
                          <span className="font-extrabold text-[#FACC15]">{cluster.avgSpeed.toFixed(1).replace('.', ',')} km/h</span>
                        </div>
                        <div className="pt-2 border-t border-white/5">
                          <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider mb-0.5">Operadores envolvidos:</span>
                          <p className="text-[10px] text-slate-100 font-extrabold uppercase leading-tight tracking-tight leading-normal whitespace-pre-wrap">
                            {Array.from(cluster.operators).slice(0, 4).join(', ') || 'Nenhum'}
                            {cluster.operators.size > 4 ? ` (+${cluster.operators.size - 4})` : ''}
                          </p>
                        </div>
                        <div className="pt-2 border-t border-white/5">
                          <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider mb-0.5">Frotas envolvidas:</span>
                          <p className="text-[10px] text-emerald-400 font-extrabold uppercase leading-tight tracking-tight">
                            {Array.from(cluster.fleets).slice(0, 5).join(', ') || 'Nenhuma'}
                            {cluster.fleets.size > 5 ? ` (+${cluster.fleets.size - 5})` : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Circle>
              );
            })}
          </LayerGroup>
        ) : (
          /* Render normal speed indicators bars with adaptive scale sizes */
          <LayerGroup key="normal-markers">
            {validPoints.map((item) => {
              const isSelected = selectedRecords.some((r) => r.id === item.id);
              return (
                <Marker
                  key={item.id}
                  position={[Number(item.latitude), Number(item.longitude)]}
                  icon={createBarIcon(item.velocidade, isSelected)}
                  eventHandlers={{
                    click: () => handleMarkerClick(item)
                  }}
                />
              );
            })}
          </LayerGroup>
        )}
      </MapContainer>
    </div>
  );
}
