import React, { useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TelemetryRecord } from '../types';
import { format } from 'date-fns';
import { X, ExternalLink, Calendar, Car, Briefcase, Gauge, MapPin } from 'lucide-react';

interface Props {
  data: TelemetryRecord[];
  selectedRecords?: TelemetryRecord[];
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onRecordClick?: (record: TelemetryRecord) => void;
  onClearSelection?: () => void;
}

// Custom CSS defined in index.css but we can also use DivIcon for the vertical bar effect
const createBarIcon = (speed: number, isSelected?: boolean) => {
  // Height proportional to speed for a 3D bar effect
  const height = Math.max(15, speed * 1.5);
  
  let color = '#94A3B8'; // Default grey for low speeds
  if (speed >= 10 && speed <= 20) color = '#1D4ED8';      // 10-20: Blue
  else if (speed > 20 && speed <= 30) color = '#FACC15';  // 21-30: Yellow
  else if (speed > 30 && speed <= 40) color = '#EA580C';  // 31-40: Orange
  else if (speed > 40 && speed <= 50) color = '#DC2626';  // 41-50: Red
  else if (speed > 50 && speed <= 60) color = '#8B5CF6';  // 51-60: Purple
  else if (speed > 60) color = '#16A34A';                 // 61+: Green
  
  if (isSelected) {
    return L.divIcon({
      className: 'custom-bar-icon-selected_marker',
      html: `
        <div style="position: relative;">
          <!-- Glowing high-contrast outline bar -->
          <div style="background-color: ${color}; width: 10px; height: ${height + 6}px; border-radius: 4px; box-shadow: 0 0 15px #F59E0B, 0 0 6px #F59E0B; border: 2.5px solid #FFFFFF;"></div>
          <!-- Beacon indicator -->
          <div style="position: absolute; bottom: -5px; left: 1.5px; width: 7px; height: 7px; background-color: #F59E0B; border-radius: 50%; box-shadow: 0 0 8px #F59E0B; border: 1.5px solid #FFFFFF;"></div>
        </div>
      `,
      iconSize: [10, height + 6],
      iconAnchor: [5, height + 6]
    });
  }

  return L.divIcon({
    className: 'custom-bar-icon',
    html: `<div style="background-color: ${color}; width: 6px; height: ${height}px; border-radius: 3px; box-shadow: 2px 2px 5px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.4);"></div>`,
    iconSize: [6, height],
    iconAnchor: [3, height]
  });
};

const mapCenter: [number, number] = [-20.0, -49.0];

export default function MapView({ 
  data, 
  selectedRecords = [], 
  isFullscreen, 
  onToggleFullscreen, 
  onRecordClick,
  onClearSelection 
}: Props) {
  const [mapType, setMapType] = useState<'normal' | 'satellite'>('satellite');
  const [selectedRecord, setSelectedRecord] = useState<TelemetryRecord | null>(null);

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

  return (
    <div 
      style={{ backgroundColor: '#0F172A' }}
      className={`relative w-full overflow-hidden border border-slate-200 shadow-2xl ${isFullscreen ? 'h-screen rounded-0' : 'h-[700px] rounded-3xl'}`}
    >
      {/* Floating Left Panel of Selected Points Counter */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 pointer-events-auto">
        <div className="bg-[#0F172A]/90 backdrop-blur border border-white/10 px-5 py-3 rounded-2xl flex items-center gap-3 shadow-2xl">
          <div className="w-8 h-8 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400">
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
            className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-[9px] px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all w-fit shadow-lg shadow-red-600/10 active:scale-95 cursor-pointer"
          >
            <X size={10} />
            Limpar Seleção
          </button>
        )}
      </div>

      <div className="absolute top-4 right-4 z-[1000] flex gap-3">
        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            style={{ 
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
              border: '1px solid #CBD5E1'
            }}
            className="px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer hover:bg-slate-50"
          >
            {isFullscreen ? 'Sair' : 'Tela Inteira'}
          </button>
        )}
        <button
          onClick={() => setMapType('normal')}
          style={{ 
            backgroundColor: mapType === 'normal' ? '#1D4ED8' : '#FFFFFF',
            color: mapType === 'normal' ? '#FFFFFF' : '#0F172A',
            border: '1px solid #CBD5E1'
          }}
          className="px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer"
        >
          Mapa
        </button>
        <button
          onClick={() => setMapType('satellite')}
          style={{ 
            backgroundColor: mapType === 'satellite' ? '#1D4ED8' : '#FFFFFF',
            color: mapType === 'satellite' ? '#FFFFFF' : '#0F172A',
            border: '1px solid #CBD5E1'
          }}
          className="px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer"
        >
          Mapa Real
        </button>
      </div>

      {/* Floating Info Sidebar */}
      {selectedRecord && (
        <div 
          style={{ 
            backgroundColor: '#FFFFFF',
            borderRight: '1px solid #CBD5E1',
            boxShadow: '10px 0 30px rgba(0,0,0,0.1)'
          }}
          className="absolute left-0 top-0 bottom-0 w-[320px] z-[1001] flex flex-col animate-in slide-in-from-left duration-300"
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
                  style={{ color: selectedRecord.velocidade > 60 ? '#DC2626' : '#16A34A' }}
                  className="text-5xl font-black italic tracking-tighter"
                >
                  {Number(selectedRecord.velocidade).toFixed(2).replace('.', ',')}
                </h1>
                <span className="text-xs font-black text-slate-400 italic">KM/H</span>
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
        {mapType === 'normal' ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}
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
      </MapContainer>
    </div>
  );
}
