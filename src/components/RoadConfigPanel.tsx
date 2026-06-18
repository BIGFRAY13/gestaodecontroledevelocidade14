import React, { useState, useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AsphaltedStretch } from '../types';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  Undo, 
  X, 
  Info, 
  Layers,
  Settings
} from 'lucide-react';

// Custom icons for vertex markers to look attractive and high contrast
const createVertexIcon = (index: number, isFirst: boolean) => {
  const color = isFirst ? '#10B981' : '#3B82F6'; // First is green, others blue
  return L.divIcon({
    className: 'custom-vertex-icon',
    html: `
      <div style="
        background-color: ${color};
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2px solid #FFFFFF;
        box-shadow: 0 0 6px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 8px;
        font-weight: bold;
      ">${index + 1}</div>
    `,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });
};

interface MapClickHandlerProps {
  onMapClick: (latlng: L.LatLng) => void;
  isDrawing: boolean;
}

function MapEvents({ onMapClick, isDrawing }: MapClickHandlerProps) {
  const map = useMap();
  
  useEffect(() => {
    if (isDrawing) {
      map.getContainer().style.cursor = 'crosshair';
    } else {
      map.getContainer().style.cursor = '';
    }
  }, [isDrawing, map]);

  useMapEvents({
    click(e) {
      if (isDrawing) {
        onMapClick(e.latlng);
      }
    }
  });

  return null;
}

// Controller to auto center map on existing points
function MapCenterController({ coords }: { coords: { lat: number; lng: number }[] }) {
  const map = useMap();
  useEffect(() => {
    if (coords && coords.length > 0) {
      const bounds = L.latLngBounds(coords.map(c => [c.lat, c.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [coords, map]);
  return null;
}

// Helper functions for distance/extension calculation
function getDistanceMeters(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
  const R = 6371000; // Earth's radius in meters
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

interface Props {
  stretches: AsphaltedStretch[];
  onSaveStretch: (stretch: AsphaltedStretch) => void;
  onDeleteStretch: (id: string) => void;
  activeStretchesCount?: number;
  maxDistanceRoad: number;
  onMaxDistanceRoadChange: (dist: number) => void;
}

export default function RoadConfigPanel({
  stretches,
  onSaveStretch,
  onDeleteStretch,
  maxDistanceRoad,
  onMaxDistanceRoadChange
}: Props) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stretchName, setStretchName] = useState('');
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }[]>([]);
  const [mapType, setMapType] = useState<'normal' | 'satellite'>('satellite');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Auto zoom on stretch selection
  const [zoomToCoords, setZoomToCoords] = useState<{ lat: number; lng: number }[] | null>(null);

  const startNewStretch = () => {
    setIsDrawing(true);
    setEditingId(null);
    setStretchName('');
    setCurrentCoords([]);
    setErrorMsg(null);
  };

  const editStretch = (stretch: AsphaltedStretch) => {
    setIsDrawing(true);
    setEditingId(stretch.id);
    setStretchName(stretch.name);
    setCurrentCoords([...stretch.coordinates]);
    setZoomToCoords([...stretch.coordinates]);
    setErrorMsg(null);
  };

  const deleteStretch = (stretch: AsphaltedStretch) => {
    if (window.confirm(`Tem certeza que deseja excluir o trecho "${stretch.name}"?`)) {
      onDeleteStretch(stretch.id);
      if (editingId === stretch.id) {
        cancelDrawing();
      }
    }
  };

  const handleMapClick = (latlng: L.LatLng) => {
    setCurrentCoords((prev) => [...prev, { lat: latlng.lat, lng: latlng.lng }]);
  };

  const undoLastPoint = () => {
    setCurrentCoords((prev) => prev.slice(0, -1));
  };

  const clearPoints = () => {
    setCurrentCoords([]);
  };

  const cancelDrawing = () => {
    setIsDrawing(false);
    setEditingId(null);
    setStretchName('');
    setCurrentCoords([]);
    setErrorMsg(null);
  };

  const saveStretch = () => {
    if (!stretchName.trim()) {
      setErrorMsg('Por favor, informe o nome do trecho asfaltado.');
      return;
    }
    if (currentCoords.length < 2) {
      setErrorMsg('O trecho asfaltado precisa de pelo menos 2 pontos.');
      return;
    }

    const nowStr = new Date().toISOString();
    const stretchToSave: AsphaltedStretch = {
      id: editingId || `stretch-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name: stretchName.trim(),
      coordinates: [...currentCoords],
      createdAt: stretches.find(s => s.id === editingId)?.createdAt || nowStr,
      updatedAt: nowStr
    };

    onSaveStretch(stretchToSave);
    cancelDrawing();
  };

  // Pre-filter stretches for search
  const filteredStretches = stretches.filter(s => 
    s.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="w-full flex flex-col gap-6 max-w-7xl mx-auto px-6 py-6 pb-16">
      
      {/* Top Title Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0F172A] text-white p-6 rounded-[24px]">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
            <Layers className="text-blue-500 w-6 h-6" /> CONFIGURAÇÃO DE VIAS
          </h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#94A3B8] mt-1">
            Cadastro de trechos asfaltados (Vicinais) para cálculo automático de infrações
          </p>
        </div>
        
        {!isDrawing && (
          <button
            onClick={startNewStretch}
            style={{ backgroundColor: '#1D4ED8' }}
            className="flex items-center gap-2 h-11 px-5 rounded-2xl text-white font-black text-xs uppercase tracking-widest hover:brightness-110 shadow-lg shadow-blue-500/20 active:scale-95 transition-all cursor-pointer animate-none"
          >
            <Plus size={16} /> ➕ Cadastrar Via Asfaltada
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Settings and Stretches List */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Config Card */}
          <div className="bg-white border border-slate-200 rounded-[28px] p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <div style={{ backgroundColor: '#EEF2FF', color: '#4F46E5' }} className="w-9 h-9 rounded-xl flex items-center justify-center">
                <Settings className="w-4.5 h-4.5" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 leading-none">
                  Parâmetro de Proximidade
                </h4>
                <p className="text-[9px] font-black text-slate-400 mt-1 uppercase">
                  Distância Máxima da Via Asfaltada
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-1.5">
              {[20, 30, 40, 50].map((dist) => (
                <button
                  key={dist}
                  onClick={() => onMaxDistanceRoadChange(dist)}
                  className={`h-9 px-1 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                    maxDistanceRoad === dist
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/25'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {dist}m
                </button>
              ))}
            </div>
            <p className="text-[9px] font-black text-slate-400 leading-normal uppercase">
              Pontos dentro deste raio das linhas azuis serão classificados como Vicinal Asfaltada (60 km/h). O restante será Estrada de Terra (40 km/h).
            </p>
          </div>

          {/* Stretches list */}
          <div className="bg-white border border-slate-200 rounded-[28px] overflow-hidden flex flex-col shadow-sm">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                Trechos Cadastrados ({filteredStretches.length})
              </h4>
              
              <div className="mt-3 relative">
                <input
                  type="text"
                  placeholder="Buscar trecho..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full h-10 pl-4 pr-10 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:border-blue-500 placeholder-slate-400"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
              {filteredStretches.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                  Nenhum trecho de asfalto cadastrado
                </div>
              ) : (
                filteredStretches.map((stretch) => (
                  <div 
                    key={stretch.id}
                    className={`p-4 flex flex-col gap-2 hover:bg-slate-50/40 transition-colors ${editingId === stretch.id ? 'bg-blue-50/60 border-l-4 border-blue-600' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <button
                        onClick={() => setZoomToCoords([...stretch.coordinates])}
                        className="text-slate-800 font-black text-xs uppercase text-left truncate hover:text-blue-600 transition-colors cursor-pointer"
                        title="Centralizar no mapa"
                      >
                        🗺️ {stretch.name}
                      </button>
                      
                      <span className="text-[8px] font-black uppercase text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full shrink-0">
                        Vicinal
                      </span>
                    </div>

                    <p className="text-[10px] font-semibold text-slate-400 leading-tight">
                      Extensão: <span className="font-bold text-slate-600">{calculateStretchLengthStr(stretch)}</span> &bull; 
                      Pontos: <span className="font-mono text-slate-600">{stretch.coordinates.length}</span>
                    </p>

                    <div className="flex items-center gap-2 mt-1 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => editStretch(stretch)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-slate-50 transition-colors text-[9px] font-black uppercase tracking-wider cursor-pointer"
                      >
                        ✏️ Editar
                      </button>
                      
                      <button
                        onClick={() => deleteStretch(stretch)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors text-[9px] font-black uppercase tracking-wider cursor-pointer ml-auto"
                      >
                        🗑️ Excluir
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Map & Drawing Tools */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          
          {/* Map Controls Card / State box */}
          {isDrawing ? (
            <div className="bg-blue-50 border border-blue-200 rounded-[24px] p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 animate-in fade-in duration-200">
              <div className="space-y-1">
                <span className="text-[9px] font-black uppercase tracking-wider text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">
                  {editingId ? '✏️ Modo Edição' : '➕ Novo Cadastro'}
                </span>
                
                <div className="mt-2.5">
                  <input
                    type="text"
                    placeholder="Nome da Via (ex: Vicinal Fazenda Boa Vista)"
                    value={stretchName}
                    onChange={(e) => setStretchName(e.target.value)}
                    className="w-full md:w-80 h-10 px-4 rounded-xl border border-blue-300 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-blue-600 placeholder-slate-400 shadow-sm"
                  />
                </div>
                
                <p className="text-[10px] text-blue-800 font-bold max-w-md pt-1 uppercase leading-none">
                  🖱️ Clique no mapa para desenhar a linha do asfalto (adicione múltiplos pontos)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0 animate-none">
                <button
                  type="button"
                  onClick={undoLastPoint}
                  disabled={currentCoords.length === 0}
                  className="flex items-center gap-1.5 h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all text-[10px] font-black uppercase tracking-wider cursor-pointer"
                >
                  <Undo size={14} /> Desfazer
                </button>

                <button
                  type="button"
                  onClick={clearPoints}
                  disabled={currentCoords.length === 0}
                  className="flex items-center gap-1.5 h-10 px-4 rounded-xl border border-rose-300 bg-white text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-all text-[10px] font-black uppercase tracking-wider cursor-pointer"
                >
                  <Trash2 size={14} /> Limpar
                </button>

                <button
                  type="button"
                  onClick={cancelDrawing}
                  className="flex items-center gap-1.5 h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-800 transition-all text-[10px] font-black uppercase tracking-wider cursor-pointer"
                >
                  <X size={14} /> Cancelar
                </button>

                <button
                  type="button"
                  onClick={saveStretch}
                  style={{ backgroundColor: '#16A34A' }}
                  className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-white font-black text-[10px] uppercase tracking-wider hover:brightness-110 shadow-md shadow-emerald-500/10 active:scale-95 transition-all cursor-pointer"
                >
                  <Save size={14} /> Salvar Alterações
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-[24px] p-5 flex items-start gap-3">
              <Info className="text-amber-600 mt-0.5 shrink-0" size={18} />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 leading-none">
                  Manual de Classificação
                </h4>
                <p className="text-[10px] font-bold text-amber-800 mt-1 uppercase leading-relaxed">
                  Para que o asfalto seja considerado no sistema, clique no botão <strong>"Cadastrar Via Asfaltada"</strong> acima e trace a rota de asfalto. Todas as outras regiões serão automaticamente classificadas como Estrada de Terra (Limite 40 km/h).
                </p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-700 text-xs font-bold uppercase tracking-wider leading-none">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Interactive Map Visualizer */}
          <div className="w-full h-[550px] rounded-[32px] overflow-hidden border border-slate-200 shadow-md relative">
            
            {/* Map Legends */}
            <div className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur border border-slate-200 rounded-2xl p-4 shadow-lg space-y-2.5 max-w-[280px]">
              <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-800 border-b border-slate-100 pb-1.5">
                Legenda de Vias
              </h5>
              
              <div className="space-y-2 text-[10px] font-bold text-slate-600 uppercase">
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-1 bg-blue-600 rounded shrink-0 opacity-80"></div>
                  <span>🟦 Via Asfaltada ({maxDistanceRoad}m)</span>
                </div>
                
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-1 bg-amber-800 rounded shrink-0 opacity-80"></div>
                  <span>🟫 Estrada de Terra</span>
                </div>
              </div>
            </div>

            {/* Map Layer Selector Toolbar */}
            <div className="absolute bottom-4 left-4 z-[1000] flex gap-2">
              <button
                onClick={() => setMapType('normal')}
                className={`h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md ${mapType === 'normal' ? 'bg-slate-950 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                Normal
              </button>
              <button
                onClick={() => setMapType('satellite')}
                className={`h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md ${mapType === 'satellite' ? 'bg-slate-950 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                Satélite
              </button>
            </div>

            <MapContainer
              center={[-20.0, -49.0]}
              zoom={13}
              scrollWheelZoom={true}
              className="w-full h-full"
              preferCanvas={true}
            >
              <MapEvents onMapClick={handleMapClick} isDrawing={isDrawing} />
              
              {zoomToCoords && <MapCenterController coords={zoomToCoords} />}

              {mapType === 'normal' ? (
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              ) : (
                <TileLayer
                  attribution='Map data &copy; ESRI Satellite'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              )}

              {/* 1. Render all REGISTERED/SAVED stretches in BLUE line */}
              {stretches.map((stretch) => {
                const isSelectedForEdit = editingId === stretch.id;
                if (isSelectedForEdit) return null; // Rendered below with active state

                const pathData = stretch.coordinates.map(c => [c.lat, c.lng] as [number, number]);

                return (
                  <Polyline
                    key={stretch.id}
                    positions={pathData}
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

              {/* 2. Render CURRENTLY DRAWING / BEING EDITED stretch in BLUE line */}
              {isDrawing && currentCoords.length > 0 && (
                <>
                  <Polyline
                    positions={currentCoords.map(c => [c.lat, c.lng] as [number, number])}
                    pathOptions={{ color: '#2563EB', weight: 8, dashArray: '8, 8', opacity: 0.95 }}
                  />

                  {/* Render vertex handles so users see where clicks are */}
                  {currentCoords.map((coord, index) => (
                    <Marker
                      key={`vertex-${index}`}
                      position={[coord.lat, coord.lng]}
                      icon={createVertexIcon(index, index === 0)}
                      eventHandlers={{
                        click: () => {
                          // Click vertex to delete it!
                          setCurrentCoords((prev) => prev.filter((_, i) => i !== index));
                        }
                      }}
                    />
                  ))}
                </>
              )}
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
