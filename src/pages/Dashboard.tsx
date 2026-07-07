import { motion, AnimatePresence } from 'motion/react';
import { useState, useMemo, useEffect, useRef, ReactNode } from 'react';
import DashboardCards from '../components/DashboardCards';
import UploadArea from '../components/UploadArea';
import SearchBar from '../components/SearchBar';
import RankingPanel from '../components/RankingPanel';
import Charts from '../components/Charts';
import CMAAReport from '../components/CMAAReport';
import DriverRankingReport from '../components/DriverRankingReport';
import MapView from '../components/MapView';
import DetailedOccurrencesReport from '../components/DetailedOccurrencesReport';
import RoadConfigPanel from '../components/RoadConfigPanel';

import { TelemetryRecord, CorrectiveAction, AsphaltedStretch } from '../types';
import { classifyPoint } from '../services/roadClassificationService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { fetchOperators } from '../services/operatorService';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  ArrowUpRight, 
  Gauge, 
  User as UserIcon,
  Car,
  DollarSign,
  LayoutGrid,
  BarChart3,
  Globe,
  Loader2,
  Activity,
  LayoutDashboard,
  Filter,
  Calendar,
  TrendingUp,
  UserCheck,
  Briefcase,
  ShieldAlert,
  Award,
  History,
  User,
  X,
  ArrowLeft,
  Search
} from 'lucide-react';

export interface ImportHistoryEntry {
  id: string;
  dataImportacao: Date;
  quantidadeRegistros: number;
  usuario: string;
}

const initialChartData = [
  { name: 'Jan', value: 4000 },
  { name: 'Fev', value: 3000 },
  { name: 'Mar', value: 5000 },
  { name: 'Abr', value: 4500 },
  { name: 'Mai', value: 6000 },
  { name: 'Jun', value: 5500 },
];

export interface EnrichedTelemetryRecord extends TelemetryRecord {
  unidade: string;
}

const enrichRecord = (record: TelemetryRecord): EnrichedTelemetryRecord => {
  const str = String(record.matricula || record.codigoOperador || record.descricaoOperador || '0');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash);

  const unidades = ['UVP', 'UVT', 'UCP'];

  return {
    ...record,
    unidade: record.unidade || unidades[index % unidades.length]
  };
};

// IndexedDB Helpers for large data persistence
const DB_NAME = 'GCV_DATABASE';
const STORE_NAME = 'GCV_STORE';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
};

const getIDBValue = (key: string): Promise<any> => {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  });
};

const setIDBValue = (key: string, value: any): Promise<void> => {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  });
};

const deleteIDBValue = (key: string): Promise<void> => {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  });
};

const generateMockData = (): TelemetryRecord[] => {
  const records: TelemetryRecord[] = [];
  const operators = [
    { matricula: '1001', nome: 'MOISES OMINE' },
    { matricula: '1002', nome: 'LUCIANO GERMANO' },
    { matricula: '1003', nome: 'ALEX GOMES' },
    { matricula: '1004', nome: 'ELIS NUNES' },
    { matricula: '1005', nome: 'REINALDO ARANTES' },
    { matricula: '1006', nome: 'LUIZ SA' },
    { matricula: '1007', nome: 'DYVID ABREU' },
    { matricula: '1008', nome: 'LUIZ VELASCO' },
    { matricula: '1009', nome: 'ANDRE SANTOS' }
  ];
  
  const operations = [
    'Transporte Calda Pronta',
    'Caminhão Aplicação',
    'Transporte Vinhaça',
    'Transporte Canavieiro',
    'Estrada de Terra - Vinhaça',
    'Estrada de Terra - Calda',
    'Estrada de Terra - Cana'
  ];

  for (let i = 0; i < 350; i++) {
    const op = operators[i % operators.length];
    const operation = operations[i % operations.length];
    
    const month = i % 12;
    const day = ((i * 7) % 28) + 1;
    const hour = (i * 3) % 24;
    const minute = (i * 11) % 60;
    const date = new Date(2026, month, day, hour, minute);
    
    const isOverSpeed = (i % 3) !== 0; 
    const velocidade = isOverSpeed 
      ? parseFloat((40.5 + (i % 35) * 1.3).toFixed(1)) 
      : parseFloat((20.0 + (i % 20) * 0.9).toFixed(1));
    
    records.push({
      id: `mock-${i}`,
      codigoOperador: op.matricula,
      matricula: op.matricula,
      descricaoOperador: op.nome,
      velocidade,
      latitude: -21.15 + (i % 100) * 0.001,
      longitude: -48.12 + (i % 100) * 0.001,
      operacao: operation,
      dataHora: date,
      frota: `FROTA-${100 + (i % 25)}`
    });
  }
  return records;
};

function ChartContainer({ children, hasData }: { children: ReactNode; hasData: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Initial size
    setDimensions({
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight
    });

    const observer = new ResizeObserver((entries) => {
      if (!entries || !entries[0]) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const isValid = hasData && dimensions.width > 10 && dimensions.height > 10;

  return (
    <div ref={containerRef} className="w-full h-full min-h-[300px] flex items-center justify-center">
      {isValid ? children : (
        <div className="text-slate-400 text-xs font-semibold tracking-tight text-center py-12">
          Aguardando dados de telemetria e dimensões válidas...
        </div>
      )}
    </div>
  );
}

type ViewMode = 'dashboard' | 'operational' | 'executive' | 'map';

interface DashboardPageProps {
  activeTab?: string;
}

export default function DashboardPage({ activeTab }: DashboardPageProps) {
  const [stretches, setStretches] = useState<AsphaltedStretch[]>(() => {
    try {
      const saved = localStorage.getItem('GCV_ASPHALT_STRETCHES');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Error reading GCV_ASPHALT_STRETCHES", e);
    }
    return [];
  });

  const [maxDistanceRoad, setMaxDistanceRoad] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('GCV_MAX_DISTANCE_ROAD');
      return saved ? parseInt(saved, 10) : 30;
    } catch (e) {
      console.error("Error reading GCV_MAX_DISTANCE_ROAD", e);
    }
    return 30;
  });

  useEffect(() => {
    localStorage.setItem('GCV_ASPHALT_STRETCHES', JSON.stringify(stretches));
  }, [stretches]);

  useEffect(() => {
    localStorage.setItem('GCV_MAX_DISTANCE_ROAD', maxDistanceRoad.toString());
  }, [maxDistanceRoad]);

  const [data, setData] = useState<TelemetryRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [loading, setLoading] = useState(false);
  const [searchedSpeed, setSearchedSpeed] = useState<number | null>(null);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [alertZone, setAlertZone] = useState<TelemetryRecord[]>([]);
  const [occurrenceRanking, setOccurrenceRanking] = useState<{
    id: string;
    name: string;
    matricula: string | number;
    speed: number;
    count: number;
  }[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [showRankingReport, setShowRankingReport] = useState(false);
  const [showDetailedOccurrencesReport, setShowDetailedOccurrencesReport] = useState(false);
  const [reportData, setReportData] = useState<TelemetryRecord[]>([]);
  const [operatorMap, setOperatorMap] = useState<Map<string, string>>(new Map());
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>([]);

  // Advanced Dashboard Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedUnidade, setSelectedUnidade] = useState('Todas');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [appliedUnidade, setAppliedUnidade] = useState('Todas');
  const [selectedFrente, setSelectedFrente] = useState('Todas');
  const [selectedOperacao, setSelectedOperacao] = useState('Todas');
  const [selectedFrota, setSelectedFrota] = useState('Todas');
  const [selectedMatricula, setSelectedMatricula] = useState('');
  const [selectedOperador, setSelectedOperador] = useState('');
  const [speedRange, setSpeedRange] = useState<'Todas' | '40-50' | '50-60' | '60-70' | '70-80' | '80+'>('Todas');
  const [excessSpeed, setExcessSpeed] = useState<number | ''>('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [selectedPointsOnMap, setSelectedPointsOnMap] = useState<TelemetryRecord[]>([]);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number | null>(null);

  // States for corrective actions and risk operator modules
  const [correctiveActions, setCorrectiveActions] = useState<CorrectiveAction[]>(() => {
    try {
      const saved = localStorage.getItem('GCV_CORRECTIVE_ACTIONS');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Error reading GCV_CORRECTIVE_ACTIONS", e);
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('GCV_CORRECTIVE_ACTIONS', JSON.stringify(correctiveActions));
  }, [correctiveActions]);

  useEffect(() => {
    console.log('[DEBUG_DASHBOARD] Total de registros carregados na base de dados:', data.length);
  }, [data]);

  const [selectedOccurrenceForAction, setSelectedOccurrenceForAction] = useState<TelemetryRecord | null>(null);
  const [operatorSearchTerm, setOperatorSearchTerm] = useState('');

  // BASE 2: Histórico de Ocorrências Selecionadas no Mapa
  const [historicalSelections, setHistoricalSelections] = useState<TelemetryRecord[]>(() => {
    try {
      const saved = localStorage.getItem('GCV_HISTORIC_SELECTIONS_MAP');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((item: any) => ({
            ...item,
            dataHora: item.dataHora ? new Date(item.dataHora) : new Date(),
            dataSelecao: item.dataSelecao ? item.dataSelecao : new Date().toISOString()
          }));
        }
      }
    } catch (e) {
      console.error("Error reading GCV_HISTORIC_SELECTIONS_MAP", e);
    }
    return [];
  });

  // Save BASE 2 to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('GCV_HISTORIC_SELECTIONS_MAP', JSON.stringify(historicalSelections));
  }, [historicalSelections]);

  // Helper to save selections to historical base (guarantees no duplicates)
  const saveSelectionsToHistory = (records: TelemetryRecord[]) => {
    setHistoricalSelections((prev) => {
      const updated = [...prev];
      let changed = false;
      records.forEach(item => {
        const exists = updated.some(r => r.id === item.id);
        if (!exists) {
          const cleanMat = item.matricula.toString().split('.')[0].replace(/^0+/, '').trim();
          const mappedName = operatorMap.get(cleanMat) || operatorMap.get(item.matricula.toString().trim()) || item.descricaoOperador || 'SEM MOTORISTA';
          const enrichedItem = { 
            ...item, 
            ...enrichRecord(item), 
            descricaoOperador: mappedName,
            dataSelecao: new Date().toISOString()
          };
          updated.push(enrichedItem);
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  };

  // Automatically sync any selectedPointsOnMap to historicalSelections
  useEffect(() => {
    if (selectedPointsOnMap.length > 0) {
      saveSelectionsToHistory(selectedPointsOnMap);
    }
  }, [selectedPointsOnMap]);

  // Load state history from localStorage/IndexedDB on initial mount
  useEffect(() => {
    // Load persisted raw telemetry data from IndexedDB first
    getIDBValue('GCV_TELEMETRY_DATA')
      .then((savedData) => {
        if (savedData && Array.isArray(savedData)) {
          const mapped = savedData.map((item: any) => ({
            ...item,
            dataHora: new Date(item.dataHora)
          }));
          setData(mapped);
        } else {
          // Fallback to localStorage
          const localSaved = localStorage.getItem('GCV_TELEMETRY_DATA');
          if (localSaved) {
            try {
              const parsed = JSON.parse(localSaved);
              const mapped = parsed.map((item: any) => ({
                ...item,
                dataHora: new Date(item.dataHora)
              }));
              setData(mapped);
            } catch (err) {
              console.error('Error loading fallback telemetry', err);
            }
          }
        }
      })
      .catch((err) => {
        console.error('Error opening IndexedDB telemetry data, checking localStorage', err);
        // Fallback to localStorage
        const localSaved = localStorage.getItem('GCV_TELEMETRY_DATA');
        if (localSaved) {
          try {
            const parsed = JSON.parse(localSaved);
            const mapped = parsed.map((item: any) => ({
              ...item,
              dataHora: new Date(item.dataHora)
            }));
            setData(mapped);
          } catch (e) {
            console.error('Error loading fallback telemetry', e);
          }
        }
      });

    // Load import history
    const savedHistory = localStorage.getItem('GCV_IMPORT_HISTORY');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        const mapped = parsed.map((item: any) => ({
          ...item,
          dataImportacao: new Date(item.dataImportacao)
        }));
        setImportHistory(mapped);
      } catch (e) {
        console.error('Error loading import history', e);
      }
    }

    const savedRanking = localStorage.getItem('GCV_TOP_OCORRENCIAS_HISTORICO');
    if (savedRanking) {
      try {
        setOccurrenceRanking(JSON.parse(savedRanking));
      } catch (e) {
        console.error('Error loading ranking history', e);
      }
    }
  }, []);

  // Save changes to localStorage whenever states update to preserve data after container close
  useEffect(() => {
    localStorage.setItem('GCV_TOP_OCORRENCIAS_HISTORICO', JSON.stringify(occurrenceRanking));
  }, [occurrenceRanking]);

  useEffect(() => {
    localStorage.setItem('GCV_ALERT_ZONE_HISTORICO', JSON.stringify(alertZone));
  }, [alertZone]);

  // Fetch operator names on mount
  useEffect(() => {
    fetchOperators().then(map => {
      setOperatorMap(map);
    });
  }, []);

  // Map the names when data is uploaded or operator map is ready
  useEffect(() => {
    if (data.length > 0 && operatorMap.size > 0) {
      const newData = data.map(item => {
        const rawMatricula = item.matricula.toString().trim();
        const cleanMat = rawMatricula.split('.')[0].replace(/^0+/, '').trim();
        const expectedName = operatorMap.get(cleanMat) || operatorMap.get(rawMatricula);
        
        if (expectedName && item.descricaoOperador !== expectedName) {
          return { ...item, descricaoOperador: expectedName };
        }
        return item;
      });

      // Only update if something actually changed to avoid infinite cycles
      const hasChanges = newData.some((item, index) => item !== data[index]);
      if (hasChanges) {
        setData(newData);
      }
    }
  }, [operatorMap, data]);

  const addRecordsToRanking = (records: TelemetryRecord[]) => {
    setOccurrenceRanking((prev) => {
      let copy = [...prev];
      records.forEach((item) => {
        const cleanMat = item.matricula.toString().split('.')[0].replace(/^0+/, '').trim();
        const mappedName = operatorMap.get(cleanMat) || operatorMap.get(item.matricula.toString().trim()) || item.descricaoOperador || 'SEM MOTORISTA';
        
        const existsIndex = copy.findIndex((p) => p.name === mappedName);
        if (existsIndex >= 0) {
          copy[existsIndex] = {
            ...copy[existsIndex],
            count: copy[existsIndex].count + 1,
            speed: Math.max(copy[existsIndex].speed, item.velocidade),
          };
        } else {
          copy.push({
            id: item.id || `c-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            name: mappedName,
            matricula: item.matricula,
            speed: item.velocidade,
            count: 1,
          });
        }
      });
      return copy.sort((a, b) => b.count - a.count);
    });
  };

  const registerOccurrence = (item: TelemetryRecord) => {
    // Ensure the name is mapped if possible before registering
    const cleanMat = item.matricula.toString().split('.')[0].replace(/^0+/, '').trim();
    const mappedName = operatorMap.get(cleanMat) || operatorMap.get(item.matricula.toString().trim()) || item.descricaoOperador;
    const enrichedItem = { ...item, ...enrichRecord(item), descricaoOperador: mappedName };

    setSelectedPointsOnMap((prev) => {
      const exists = prev.some(r => r.id === item.id);
      if (exists) {
        return prev.filter(r => r.id !== item.id);
      }
      return [...prev, enrichedItem];
    });

    setAlertZone((prev) => {
      if (prev.some(r => r.id === item.id)) return prev;
      return [enrichedItem, ...prev];
    });
  };

  const handleDataLoaded = (records: TelemetryRecord[]) => {
    setData(records);
    
    // Add to import history
    const newEntry: ImportHistoryEntry = {
      id: `import-${Date.now()}`,
      dataImportacao: new Date(),
      quantidadeRegistros: records.length,
      usuario: 'lucianogermano13@gmail.com'
    };
    
    setImportHistory(prev => {
      const updated = [newEntry, ...prev];
      localStorage.setItem('GCV_IMPORT_HISTORY', JSON.stringify(updated));
      return updated;
    });

    // Save GCV_TELEMETRY_DATA to persist
    setIDBValue('GCV_TELEMETRY_DATA', records)
      .then(() => {
        // Clean up any old telemetry data in localStorage to preserve space
        localStorage.removeItem('GCV_TELEMETRY_DATA');
      })
      .catch((err) => {
        console.error('Error saving telemetry data to IndexedDB, trying localStorage fallback', err);
        try {
          localStorage.setItem('GCV_TELEMETRY_DATA', JSON.stringify(records));
        } catch (e) {
          console.error('Error saving telemetry data to localStorage fallback', e);
        }
      });

    setAlertZone([]);
    localStorage.removeItem('GCV_ALERT_ZONE_HISTORICO');
    setSearchedSpeed(null);
    setSearchTerm('');
  };

  const handleSearchVelocity = () => {
    const value = parseFloat(searchTerm.replace(',', '.'));
    if (!isNaN(value)) {
      setSearchedSpeed(value);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchedSpeed(null);
  };

  const handleSearchInfractions = () => {
    if (!startDate || !endDate || selectedUnidade === 'Todas') {
      return;
    }
    
    setLoading(true);
    
    setTimeout(() => {
      setAppliedStartDate(startDate);
      setAppliedEndDate(endDate);
      setAppliedUnidade(selectedUnidade);
      
      const matchingRecords = data.filter(record => {
        const enriched = { ...record, ...enrichRecord(record) };
        
        const rDate = record.dataHora;
        const sDate = new Date(startDate);
        const eDate = new Date(endDate + 'T23:59:59');
        
        if (rDate < sDate || rDate > eDate) return false;
        if (enriched.unidade !== selectedUnidade) return false;

        if (selectedMatricula.trim()) {
          const mat = String(record.matricula || '').toLowerCase();
          if (!mat.includes(selectedMatricula.trim().toLowerCase())) return false;
        }

        if (selectedOperador.trim()) {
          const op = String(record.descricaoOperador || '').toLowerCase();
          if (!op.includes(selectedOperador.trim().toLowerCase())) return false;
        }
        
        return true;
      });
      
      setSelectedPointsOnMap(matchingRecords);
      
      const infractions = matchingRecords.filter(r => {
        const enriched = enrichRecord(r);
        const cls = classifyPoint(r.latitude, r.longitude, r.velocidade, stretches, maxDistanceRoad, enriched.unidade);
        return cls.isInfraction;
      });
      setAlertZone(infractions);
      
      setLoading(false);
      setIsFilterPanelOpen(false);
    }, 800);
  };

  const activeDataset = useMemo(() => {
    return data;
  }, [data]);

  const enrichedData = useMemo(() => {
    return activeDataset.map(r => {
      const enriched = enrichRecord(r);
      const cls = classifyPoint(r.latitude, r.longitude, r.velocidade, stretches, maxDistanceRoad, enriched.unidade);
      return {
        ...enriched,
        roadType: cls.type,
        roadLimit: cls.limit,
        excesso: cls.excess,
        isInfraction: cls.isInfraction
      };
    });
  }, [activeDataset, stretches, maxDistanceRoad]);

  const availableUnidades = useMemo(() => {
    const set = new Set<string>();
    enrichedData.forEach(r => {
      if (r.unidade) set.add(r.unidade);
    });
    return Array.from(set).sort();
  }, [enrichedData]);

  const availableFrentes = useMemo(() => {
    const set = new Set<string>();
    enrichedData.forEach(r => {
      if (r.frente) set.add(r.frente);
    });
    return Array.from(set).sort();
  }, [enrichedData]);

  const availableOperacoes = useMemo(() => {
    const set = new Set<string>();
    enrichedData.forEach(r => {
      if (r.operacao) set.add(r.operacao);
    });
    return Array.from(set).sort();
  }, [enrichedData]);

  const availableFrotas = useMemo(() => {
    const set = new Set<string>();
    enrichedData.forEach(r => {
      if (r.frota) set.add(r.frota);
    });
    return Array.from(set).sort();
  }, [enrichedData]);

  const filteredRecordsOnMap = useMemo(() => {
    const searchFiltered = enrichedData.filter(record => {
      if (!searchTerm.trim()) return true;
      
      const v = parseFloat(searchTerm.replace(',', '.'));
      if (!isNaN(v)) {
        return Math.floor(record.velocidade) === Math.floor(v);
      }
      
      const term = searchTerm.toLowerCase();
      return (
        (record.descricaoOperador || '').toLowerCase().includes(term) ||
        (record.matricula || '').toString().toLowerCase().includes(term)
      );
    });

    const result = searchFiltered.filter(record => {
      // 1. Date filters (Período Inicial)
      if (appliedStartDate) {
        const sDate = new Date(appliedStartDate);
        if (record.dataHora < sDate) return false;
      }
      // 2. Date filters (Período Final)
      if (appliedEndDate) {
        const eDate = new Date(appliedEndDate + 'T23:59:59');
        if (record.dataHora > eDate) return false;
      }
      // 3. Unidade (Usa filtro selecionado para atualização imediata)
      if (selectedUnidade !== 'Todas') {
        if (record.unidade !== selectedUnidade) return false;
      }
      // 4. Setor (Frente)
      if (selectedFrente !== 'Todas') {
        if (record.frente !== selectedFrente) return false;
      }
      // 5. Operação
      if (selectedOperacao !== 'Todas') {
        if (record.operacao !== selectedOperacao) return false;
      }
      // 6. Frota
      if (selectedFrota !== 'Todas') {
        if (record.frota !== selectedFrota) return false;
      }
      // 7. Matrícula
      if (selectedMatricula.trim()) {
        const mat = String(record.matricula || '').toLowerCase();
        if (!mat.includes(selectedMatricula.trim().toLowerCase())) return false;
      }
      // 8. Operador
      if (selectedOperador.trim()) {
        const op = String(record.descricaoOperador || '').toLowerCase();
        if (!op.includes(selectedOperador.trim().toLowerCase())) return false;
      }
      // 9. Faixa de Velocidade
      if (speedRange !== 'Todas') {
        const vel = record.velocidade;
        if (speedRange === '40-50' && (vel < 40 || vel > 50)) return false;
        if (speedRange === '50-60' && (vel < 50 || vel > 60)) return false;
        if (speedRange === '60-70' && (vel < 60 || vel > 70)) return false;
        if (speedRange === '70-80' && (vel < 70 || vel > 80)) return false;
        if (speedRange === '80+' && vel < 80) return false;
      }
      // 10. Excesso de Velocidade
      if (excessSpeed !== '') {
        if (record.velocidade < excessSpeed) return false;
      }
      return true;
    });

    console.log('[DEBUG_DASHBOARD] Filtros aplicados:', {
      selectedUnidade,
      selectedFrente,
      selectedOperacao,
      selectedFrota,
      excessSpeed,
      speedRange
    }, 'Resultados após filtragem:', result.length);

    return result;
  }, [enrichedData, searchTerm, appliedStartDate, appliedEndDate, selectedUnidade, selectedFrente, selectedOperacao, selectedFrota, selectedMatricula, selectedOperador, speedRange, excessSpeed]);

  const filteredData = filteredRecordsOnMap;

  const filteredDashboardData = useMemo(() => {
    let list = historicalSelections.map(r => {
      const enriched = enrichRecord(r);
      const cls = classifyPoint(r.latitude, r.longitude, r.velocidade, stretches, maxDistanceRoad, enriched.unidade);
      return {
        ...enriched,
        roadType: cls.type,
        roadLimit: cls.limit,
        excesso: cls.excess,
        isInfraction: cls.isInfraction
      };
    });
    return list.filter(record => {
      // 1. Date filters (Período Inicial)
      if (appliedStartDate) {
        const sDate = new Date(appliedStartDate);
        if (record.dataHora < sDate) return false;
      }
      // 2. Date filters (Período Final)
      if (appliedEndDate) {
        const eDate = new Date(appliedEndDate + 'T23:59:59');
        if (record.dataHora > eDate) return false;
      }
      // 3. Unidade
      if (appliedUnidade !== 'Todas') {
        if (record.unidade !== appliedUnidade) return false;
      }
      // 4. Frente
      if (selectedFrente !== 'Todas') {
        if (record.frente !== selectedFrente) return false;
      }
      // 5. Operação
      if (selectedOperacao !== 'Todas') {
        if (record.operacao !== selectedOperacao) return false;
      }
      // 6. Frota
      if (selectedFrota !== 'Todas') {
        if (record.frota !== selectedFrota) return false;
      }
      // 7. Matrícula
      if (selectedMatricula.trim()) {
        const mat = String(record.matricula || '').toLowerCase();
        if (!mat.includes(selectedMatricula.trim().toLowerCase())) return false;
      }
      // 8. Operador
      if (selectedOperador.trim()) {
        const op = String(record.descricaoOperador || '').toLowerCase();
        if (!op.includes(selectedOperador.trim().toLowerCase())) return false;
      }
      // 9. Faixa de Velocidade
      if (speedRange !== 'Todas') {
        const vel = record.velocidade;
        if (speedRange === '40-50' && (vel < 40 || vel > 50)) return false;
        if (speedRange === '50-60' && (vel < 50 || vel > 60)) return false;
        if (speedRange === '60-70' && (vel < 60 || vel > 70)) return false;
        if (speedRange === '70-80' && (vel < 70 || vel > 80)) return false;
        if (speedRange === '80+' && vel < 80) return false;
      }
      return true;
    });
  }, [historicalSelections, appliedStartDate, appliedEndDate, appliedUnidade, selectedFrente, selectedOperacao, selectedFrota, selectedMatricula, selectedOperador, speedRange, stretches, maxDistanceRoad]);

  // Calculations for fullscreen month occurrences detours
  const monthName = useMemo(() => {
    if (selectedMonthIndex === null) return '';
    return ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'][selectedMonthIndex] || '';
  }, [selectedMonthIndex]);

  const occurrencesForMonth = useMemo(() => {
    if (selectedMonthIndex === null) return [];
    
    return filteredDashboardData
      .filter(record => record.dataHora.getMonth() === selectedMonthIndex)
      .sort((a, b) => b.velocidade - a.velocidade); // Sort by highest speed to lowest
  }, [filteredDashboardData, selectedMonthIndex]);

  const summaryStats = useMemo(() => {
    if (occurrencesForMonth.length === 0) {
      return { count: 0, maxSpeed: 0, avgSpeed: 0, uniqueDrivers: 0 };
    }
    
    const count = occurrencesForMonth.length;
    const speeds = occurrencesForMonth.map(o => o.velocidade);
    const maxSpeed = Math.max(...speeds);
    const avgSpeed = speeds.reduce((sum, s) => sum + s, 0) / count;
    
    const uniqueDriversSet = new Set();
    occurrencesForMonth.forEach(o => {
      if (o.descricaoOperador) uniqueDriversSet.add(o.descricaoOperador);
      else if (o.matricula) uniqueDriversSet.add(o.matricula);
    });
    const uniqueDrivers = uniqueDriversSet.size;
    
    return { count, maxSpeed, avgSpeed, uniqueDrivers };
  }, [occurrencesForMonth]);

  // Occurrences summary: count matching speeds > 40
  const totalDashboardOcorrencias = useMemo(() => {
    return filteredDashboardData.filter(r => (r as any).isInfraction).length;
  }, [filteredDashboardData]);

  // Month-by-month index chart
  const monthlyDashboardChartData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const counts = Array(12).fill(0);
    
    filteredDashboardData.forEach(r => {
      if ((r as any).isInfraction) {
        const m = r.dataHora.getMonth();
        if (m >= 0 && m < 12) {
          counts[m]++;
        }
      }
    });

    return months.map((name, idx) => ({
      name,
      ocorrencias: counts[idx]
    }));
  }, [filteredDashboardData]);

  // Ranking of operators with speed > 40
  const driversDashboardRanking = useMemo(() => {
    const countsMap = new Map<string, { 
      name: string; 
      matricula: string; 
      count: number; 
      maxSpeed: number; 
      occurrences: TelemetryRecord[];
    }>();
    
    filteredDashboardData.forEach(r => {
      if ((r as any).isInfraction) {
        const driverName = r.descricaoOperador ? String(r.descricaoOperador).trim().toUpperCase() : 'MOTORISTA DESCONHECIDO';
        const driverMat = r.matricula ? String(r.matricula).split('.')[0].replace(/^0+/, '').trim() : '---';
        const key = `${driverName}_${driverMat}`;
        
        const stats = countsMap.get(key) || { 
          name: driverName, 
          matricula: driverMat, 
          count: 0, 
          maxSpeed: 0, 
          occurrences: [] 
        };
        countsMap.set(key, {
          name: driverName,
          matricula: driverMat,
          count: stats.count + 1,
          maxSpeed: Math.max(stats.maxSpeed, r.velocidade),
          occurrences: [...stats.occurrences, r]
        });
      }
    });

    return Array.from(countsMap.values())
      .sort((a, b) => b.count - a.count);
  }, [filteredDashboardData]);

  // Helper to obtain computed status of occurrence based on registered actions
  const getOccurrenceStatus = (id: string, actions: CorrectiveAction[]) => {
    const relevantActions = actions.filter(act => act.occurrenceId === id);
    if (relevantActions.length === 0) return 'PENDENTE';
    
    // Check if "Encerrado" is selected within actionTypes list
    const isClosed = relevantActions.some(act => act.actionTypes.includes('Encerrado'));
    if (isClosed) return 'CONCLUÍDA';
    
    return 'EM TRATATIVA';
  };

  // Module 02: Analytical assessment of operator risk index based on speed occurrences > 40 km/h
  const operatorsRiskIndices = useMemo(() => {
    const countsMap = new Map<string, { name: string; matricula: string; occurrences: number; maxSpeed: number; lastOccurrence: Date | null }>();
    
    enrichedData.forEach(r => {
      if ((r as any).isInfraction) {
        const driverName = r.descricaoOperador ? String(r.descricaoOperador).trim().toUpperCase() : 'SEM MOTORISTA';
        const driverMat = r.matricula ? String(r.matricula).split('.')[0].replace(/^0+/, '').trim() : '---';
        const key = driverMat || driverName;
        
        const stats = countsMap.get(key) || { name: driverName, matricula: driverMat, occurrences: 0, maxSpeed: 0, lastOccurrence: null };
        const recordDate = r.dataHora instanceof Date ? r.dataHora : new Date(r.dataHora);
        countsMap.set(key, {
          name: driverName,
          matricula: driverMat,
          occurrences: stats.occurrences + 1,
          maxSpeed: Math.max(stats.maxSpeed, r.velocidade),
          lastOccurrence: (!stats.lastOccurrence || recordDate > stats.lastOccurrence) ? recordDate : stats.lastOccurrence
        });
      }
    });

    return Array.from(countsMap.values()).map(o => {
      let riskLevel: '🔴 ALTO RISCO' | '🟡 MÉDIO RISCO' | '🟢 BAIXO RISCO' = '🟢 BAIXO RISCO';
      if (o.occurrences > 5) riskLevel = '🔴 ALTO RISCO';
      else if (o.occurrences >= 3) riskLevel = '🟡 MÉDIO RISCO';
      
      return {
        ...o,
        riskLevel
      };
    }).sort((a, b) => b.occurrences - a.occurrences);
  }, [enrichedData]);

  // Operator search matching logic
  const filteredOperatorsRisk = useMemo(() => {
    return operatorsRiskIndices.filter(op => {
      if (!operatorSearchTerm.trim()) return true;
      const term = operatorSearchTerm.toLowerCase();
      return op.name.toLowerCase().includes(term) || op.matricula.toLowerCase().includes(term);
    });
  }, [operatorsRiskIndices, operatorSearchTerm]);

  // Module 05: Aggregate occurrence count categories
  const occurrenceStats = useMemo(() => {
    let pendentes = 0;
    let emTratativa = 0;
    let concluidas = 0;

    const over40 = enrichedData.filter(r => (r as any).isInfraction);

    over40.forEach(item => {
      const status = getOccurrenceStatus(item.id, correctiveActions);
      if (status === 'PENDENTE') pendentes++;
      else if (status === 'EM TRATATIVA') emTratativa++;
      else if (status === 'CONCLUÍDA') concluidas++;
    });

    return {
      total: over40.length,
      pendentes,
      emTratativa,
      concluidas
    };
  }, [enrichedData, correctiveActions]);

  // Operator risk ranges tallies
  const operatorRiskCounts = useMemo(() => {
    let alto = 0;
    let medio = 0;
    let baixo = 0;

    operatorsRiskIndices.forEach(op => {
      if (op.riskLevel === '🔴 ALTO RISCO') alto++;
      else if (op.riskLevel === '🟡 MÉDIO RISCO') medio++;
      else baixo++;
    });

    return {
      alto,
      medio,
      baixo
    };
  }, [operatorsRiskIndices]);

  const kpiData = useMemo(() => {
    const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const counts = {
      caldaPronta: data.filter(d => {
        const op = normalize(d.operacao || '');
        return op.includes('calda pronta') || op.includes('calda');
      }).length,
      aplicacao: data.filter(d => {
        const op = normalize(d.operacao || '');
        return op.includes('aplicacao') || op.includes('aplica');
      }).length,
      vinhaca: data.filter(d => {
        const op = normalize(d.operacao || '');
        return op.includes('vinhaca') || op.includes('vinha');
      }).length,
      canavieiro: data.filter(d => {
        const op = normalize(d.operacao || '');
        return op.includes('canavieiro') || op.includes('cana');
      }).length,
    };

    return [
      {
        title: 'Transporte Calda Pronta',
        value: counts.caldaPronta,
        icon: DollarSign,
        color: '#10B981',
      },
      {
        title: 'Caminhão Aplicação',
        value: counts.aplicacao,
        icon: UserIcon,
        color: '#1D4ED8',
      },
      {
        title: 'Transporte Vinhaça',
        value: counts.vinhaca,
        icon: Car,
        color: '#F59E0B',
      },
      {
        title: 'Transporte Canavieiro',
        value: counts.canavieiro,
        icon: Gauge,
        color: '#8B5CF6',
      },
    ];
  }, [data]);

  const searchSuggestions = useMemo(() => {
    const suggestions: { matricula: string; nome: string }[] = [];
    const seen = new Set<string>();

    operatorMap.forEach((nome, matricula) => {
      const key = `${matricula}-${nome}`;
      if (!seen.has(key)) {
        suggestions.push({ matricula, nome });
        seen.add(key);
      }
    });
    
    // Also add unique names from loaded data just in case they aren't in the operatorMap
    data.forEach(item => {
      const matricula = item.matricula.toString();
      const nome = item.descricaoOperador;
      const key = `${matricula}-${nome}`;
      if (nome && nome !== matricula && !seen.has(key)) {
        suggestions.push({ matricula, nome });
        seen.add(key);
      }
    });

    return suggestions;
  }, [operatorMap, data]);

  if (activeTab === 'road-config') {
    return (
      <div style={{ backgroundColor: '#F8FAFC' }} className="min-h-screen">
        <header
          style={{
            backgroundColor: '#0F172A',
            borderBottom: '1px solid #1E293B',
            display: isMapFullscreen ? 'none' : 'block'
          }}
          className="sticky top-0 z-[100] w-full"
        >
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                style={{ backgroundColor: '#1D4ED8' }}
                className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20"
              >
                <Gauge color="white" size={24} />
              </div>
              <div>
                <h1 style={{ color: '#FFFFFF' }} className="text-2xl font-black italic tracking-tighter">
                  G.C.V PRO
                </h1>
                <p style={{ color: '#94A3B8' }} className="text-[10px] font-black uppercase tracking-widest">
                  Gestão de Velocidade Inteligente
                </p>
              </div>
            </div>
          </div>
        </header>
        <RoadConfigPanel
          stretches={stretches}
          onSaveStretch={(s) => setStretches(prev => {
            const index = prev.findIndex(x => x.id === s.id);
            if (index !== -1) {
              const clone = [...prev];
              clone[index] = s;
              return clone;
            }
            return [...prev, s];
          })}
          onDeleteStretch={(id) => setStretches(prev => prev.filter(x => x.id !== id))}
          maxDistanceRoad={maxDistanceRoad}
          onMaxDistanceRoadChange={setMaxDistanceRoad}
        />
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#F8FAFC' }} className="min-h-screen">
      {/* Dynamic Header */}
      <header
        style={{
          backgroundColor: '#0F172A',
          borderBottom: '1px solid #1E293B',
          display: isMapFullscreen ? 'none' : 'block'
        }}
        className="sticky top-0 z-[100] w-full"
      >
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              style={{ backgroundColor: '#1D4ED8' }}
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20"
            >
              <Gauge color="white" size={24} />
            </div>
            <div>
              <h1 style={{ color: '#FFFFFF' }} className="text-2xl font-black italic tracking-tighter">
                G.C.V PRO
              </h1>
              <p style={{ color: '#94A3B8' }} className="text-[10px] font-black uppercase tracking-widest">
                Gestão de Velocidade Inteligente
              </p>
            </div>
          </div>

          {/* Navigation removed, only one workspace exists */}
        </div>
      </header>

      <div className={!isMapFullscreen ? "max-w-7xl mx-auto px-6 py-6 space-y-6 pb-16" : ""}>
        {/* Sub Header for description if not map */}
        {viewMode !== 'map' && (
          <div className="flex items-center justify-between">
            <div>
              <h2 style={{ color: '#0F172A' }} className="text-3xl font-black uppercase tracking-tight">Painel de Controle</h2>
              <p style={{ color: '#475569' }} className="text-sm font-bold mt-1 uppercase tracking-widest opacity-60 italic">Monitoramento em tempo real</p>
            </div>
            {data.length > 0 && (
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowReport(true)}
                  style={{ backgroundColor: '#1D4ED8' }}
                  className="h-12 px-6 rounded-2xl text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:brightness-110 transition-all cursor-pointer"
                >
                  Gerar Relatório
                </button>
              </div>
            )}
          </div>
        )}

      {/* Upload area */}
      {data.length === 0 && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto w-full">
          <UploadArea onDataLoaded={handleDataLoaded} />
        </motion.div>
      )}
      {/* Main Stats (Visible in all modes but Map and Dashboard) */}

      {searchedSpeed !== null && (
        <div className="mb-4 px-5 py-3 bg-brand/10 border border-brand/20 rounded-2xl max-w-2xl mx-auto">
          <p className="text-sm font-black text-brand uppercase tracking-wider text-center">
            Mostrando velocidades entre: {searchedSpeed} e {searchedSpeed + 5} KM/H
          </p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {loading && (
          <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center">
            <div className="bg-slate-900 border border-white/10 rounded-3xl p-10 shadow-2xl text-center">
              <Loader2 className="w-12 h-12 text-brand animate-spin mx-auto mb-4" />
              <p className="text-xl font-black text-white">
                Processando relatório...
              </p>
            </div>
          </div>
        )}

        {viewMode === 'dashboard' && (
          <motion.div
            key="dashboard-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={isMapFullscreen ? { transform: 'none' } : undefined}
            className="space-y-6"
          >
            {/* Search & Upload Area Unified Panel - Vertically Stacked right above the map */}
            {data.length > 0 && (
              <div 
                style={{ 
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.03)'
                }}
                className="rounded-[32px] p-5 max-w-2xl mx-auto flex flex-col items-center justify-center gap-5 border border-slate-200 w-full animate-in fade-in zoom-in-95 duration-200"
              >
                {/* 1. Row of Actions (Buttons) */}
                <div className="flex flex-wrap justify-center items-center gap-3 w-full border-b border-slate-100 pb-3">
                  <button
                    onClick={handleSearchVelocity}
                    style={{ 
                      backgroundColor: '#1D4ED8',
                      color: '#FFFFFF'
                    }}
                    className="h-10 px-5 rounded-2xl font-black uppercase tracking-wider text-[9px] shadow-md shadow-blue-500/10 active:scale-95 hover:bg-blue-800 transition-all cursor-pointer"
                  >
                    Buscar Velocidade
                  </button>



                  <button
                    onClick={handleClearSearch}
                    style={{ 
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      color: '#475569'
                    }}
                    className="h-10 px-5 rounded-2xl font-black uppercase tracking-wider text-[9px] shadow-sm active:scale-95 hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Limpar Filtros
                  </button>
                </div>

                {/* 2. Side-by-Side Row of Config/Inputs */}
                <div className="flex flex-row justify-center items-start gap-12 w-full">
                  {/* Left Column: Fonte de Dados */}
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-2 text-center">
                      Fonte de Dados
                    </p>
                    <UploadArea onDataLoaded={handleDataLoaded} />
                  </div>

                  {/* Right Column: Buscar Registros */}
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-2 text-center">
                      Buscar Registros
                    </p>
                    <SearchBar 
                      value={searchTerm} 
                      onChange={setSearchTerm} 
                      onSearchVelocity={handleSearchVelocity}
                      onClear={handleClearSearch}
                      suggestions={searchSuggestions}
                      onOpenFilters={() => setIsFilterPanelOpen(true)}
                      hideActions={true}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 4. MAPA (MapView) */}
            <div className={isMapFullscreen ? "" : "w-full h-[550px] rounded-[32px] overflow-hidden shadow-lg border border-slate-200"}>
              <MapView 
                key="map-operational"
                data={filteredData} 
                selectedRecords={selectedPointsOnMap}
                stretches={stretches}
                isFullscreen={isMapFullscreen} 
                onToggleFullscreen={() => setIsMapFullscreen(!isMapFullscreen)} 
                onRecordClick={registerOccurrence}
                onClearSelection={() => setSelectedPointsOnMap([])}
                onOpenFilters={() => setIsFilterPanelOpen(true)}
                activeFilters={{
                  unidade: selectedUnidade,
                  frente: selectedFrente,
                  operacao: selectedOperacao,
                  frota: selectedFrota,
                  speedRange: speedRange
                }}
                selectedUnidade={selectedUnidade}
                setSelectedUnidade={setSelectedUnidade}
                selectedFrente={selectedFrente}
                setSelectedFrente={setSelectedFrente}
                selectedOperacao={selectedOperacao}
                setSelectedOperacao={setSelectedOperacao}
                selectedFrota={selectedFrota}
                setSelectedFrota={setSelectedFrota}
                excessSpeed={excessSpeed}
                setExcessSpeed={setExcessSpeed}
                availableUnidades={availableUnidades}
                availableFrentes={availableFrentes}
                availableOperacoes={availableOperacoes}
                availableFrotas={availableFrotas}
              />
            </div>

            {/* Charts & Ranking Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Year Month-Over-Month Speed occurrences Chart -> SECOND requested component */}
              <div 
                style={{ 
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  boxShadow: '0 20px 50px rgba(15, 23, 42, 0.05)'
                }}
                className="lg:col-span-3 rounded-[32px] p-8 space-y-6"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                      <TrendingUp size={20} />
                    </div>
                    <div>
                      <h4 style={{ color: '#0F172A' }} className="text-base font-black uppercase tracking-tight">OCORRÊNCIAS ACIMA DE 40 KM/H POR MÊS</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Evolução mensal de registros em excesso</p>
                    </div>
                  </div>
                </div>

                <div className="w-full min-h-[350px] h-[350px]">
                  <ChartContainer hasData={data.length > 0}>
                    <ResponsiveContainer width="100%" height={350} minHeight={350}>
                      <BarChart data={monthlyDashboardChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#64748B', fontSize: 11, fontWeight: 'bold' }} 
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#64748B', fontSize: 11, fontWeight: 'bold' }} 
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#0F172A', 
                            border: 'none', 
                            borderRadius: '16px',
                            color: '#FFF',
                            fontSize: '11px',
                            fontFamily: 'Inter',
                            fontWeight: 'bold',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                          }}
                          labelStyle={{ color: '#94A3B8', fontWeight: 'black', textTransform: 'uppercase', marginBottom: '4px' }}
                        />
                        <Bar 
                          dataKey="ocorrencias" 
                          name="Ocorrências"
                          fill="#1D4ED8" 
                          radius={[8, 8, 0, 0]}
                        >
                          {monthlyDashboardChartData.map((entry, index) => {
                            const hasValue = entry.ocorrencias > 0;
                            return (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={hasValue ? '#1D4ED8' : '#E2E8F0'} 
                                onClick={() => {
                                  if (hasValue) {
                                    setSelectedMonthIndex(index);
                                  }
                                }}
                                className="cursor-pointer hover:opacity-80 transition-opacity"
                              />
                            );
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </div>
            </div>



          </motion.div>
        )}

        {viewMode === 'operational' && (
          <motion.div 
            key="operational"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-10"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                {/* Ranking de Ocorrências - Migrated to Operational for visibility */}
                <div 
                  style={{ 
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    boxShadow: '0 20px 50px rgba(15, 23, 42, 0.05)'
                  }}
                  className="rounded-[32px] overflow-hidden"
                >
                  <div 
                    style={{ backgroundColor: '#10B981', borderBottom: '1px solid #059669' }}
                    className="p-6 flex items-center justify-between"
                  >
                    <h2 className="text-xl font-black tracking-tight text-white uppercase italic">Ranking de Ocorrências</h2>
                    <button
                      onClick={() => setOccurrenceRanking([])}
                      style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
                      className="h-10 px-5 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap hover:bg-white/20"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="max-h-[600px] overflow-y-auto">
                    {occurrenceRanking.length === 0 && (
                      <div className="p-10 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                        Nenhuma ocorrência registrada no período
                      </div>
                    )}

                    {occurrenceRanking.map((item, index) => (
                      <div
                        key={item.id}
                        style={{ borderBottom: '1px solid #F1F5F9' }}
                        className="flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div 
                             style={{ backgroundColor: '#F1F5F9', color: '#475569' }}
                             className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl"
                          >
                            {index + 1}
                          </div>
                          <div>
                            <h3 style={{ color: '#0F172A' }} className="text-sm font-black uppercase">
                              {item.name || 'SEM MOTORISTA'}
                            </h3>
                            <p style={{ color: '#10B981' }} className="text-[10px] font-black uppercase tracking-tight italic">
                              {Number(item.speed).toFixed(2).replace('.', ',')} KM/H
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <h2 style={{ color: '#10B981' }} className="text-3xl font-black tracking-tighter leading-none">{item.count}</h2>
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">
                            ocorrências
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div 
                  style={{ 
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1'
                  }}
                  className="p-8 rounded-[32px] space-y-6"
                >
                  <div>
                    <h3 style={{ color: '#0F172A' }} className="text-xs font-black uppercase tracking-[0.2em] mb-4">Ações Estratégicas</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => setShowReport(true)}
                        style={{ backgroundColor: '#10B981' }}
                        className="h-16 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-white hover:brightness-110 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Activity size={16} /> Gerar Relatório
                      </button>
                      <button 
                        style={{ backgroundColor: '#0F172A' }}
                        className="h-16 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-white hover:brightness-125 transition-all cursor-pointer" 
                        onClick={() => {
                          setData([]);
                          setAlertZone([]);
                          setOccurrenceRanking([]);
                          setImportHistory([]);
                          localStorage.removeItem('GCV_TELEMETRY_DATA');
                          localStorage.removeItem('GCV_IMPORT_HISTORY');
                          deleteIDBValue('GCV_TELEMETRY_DATA').catch((err) => 
                            console.error('Error clearing telemetry db', err)
                          );
                        }}
                      > 
                        Limpar Dados
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {viewMode === 'executive' && (
          <motion.div 
            key="executive"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-10"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <Charts data={alertZone} />
              </div>
              <div className="space-y-8">
                {/* Ranking de Ocorrências - Standard Style */}
                <div 
                  style={{ 
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1'
                  }}
                  className="rounded-[32px] overflow-hidden"
                >
                  <div 
                    style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}
                    className="p-6 flex items-center justify-between"
                  >
                    <h2 style={{ color: '#0F172A' }} className="text-xs font-black tracking-widest text-emerald-600 uppercase">Top Ocorrências</h2>
                    <button
                      onClick={() => setOccurrenceRanking([])}
                      style={{ color: '#475569', border: '1px solid #CBD5E1' }}
                      className="h-8 px-4 bg-white hover:bg-slate-50 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="max-h-[500px] overflow-y-auto">
                    {occurrenceRanking.length === 0 && (
                      <div className="p-10 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                        Sem ocorrências registradas
                      </div>
                    )}

                    {occurrenceRanking.map((item, index) => (
                      <div
                        key={item.id}
                        style={{ borderBottom: '1px solid #F1F5F9' }}
                        className="flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div 
                             style={{ backgroundColor: '#F1F5F9', color: '#475569' }}
                             className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm"
                          >
                            {index + 1}
                          </div>
                          <div>
                            <h3 style={{ color: '#0F172A' }} className="text-[11px] font-black uppercase leading-tight">
                              {item.name || 'SEM MOTORISTA'}
                            </h3>
                            <p style={{ color: '#16A34A' }} className="text-[10px] font-bold italic">
                              {Number(item.speed).toFixed(2).replace('.', ',')} KM/H
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <h2 style={{ color: '#16A34A' }} className="text-xl font-black">{item.count}</h2>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {viewMode === 'map' && (
          <motion.div 
            key="map"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className={isMapFullscreen ? "fixed inset-0 z-[50] bg-black p-0 m-0" : ""}
            style={isMapFullscreen ? { transform: 'none' } : undefined}
          >
            <MapView 
              key="map-viewmode"
              data={filteredData} 
              selectedRecords={selectedPointsOnMap}
              stretches={stretches}
              isFullscreen={isMapFullscreen} 
              onToggleFullscreen={() => setIsMapFullscreen(!isMapFullscreen)} 
              onRecordClick={registerOccurrence}
              onClearSelection={() => setSelectedPointsOnMap([])}
              onOpenFilters={() => setIsFilterPanelOpen(true)}
              activeFilters={{
                unidade: selectedUnidade,
                frente: selectedFrente,
                operacao: selectedOperacao,
                frota: selectedFrota,
                speedRange: speedRange
              }}
              selectedUnidade={selectedUnidade}
              setSelectedUnidade={setSelectedUnidade}
              selectedFrente={selectedFrente}
              setSelectedFrente={setSelectedFrente}
              selectedOperacao={selectedOperacao}
              setSelectedOperacao={setSelectedOperacao}
              selectedFrota={selectedFrota}
              setSelectedFrota={setSelectedFrota}
              excessSpeed={excessSpeed}
              setExcessSpeed={setExcessSpeed}
              availableUnidades={availableUnidades}
              availableFrentes={availableFrentes}
              availableOperacoes={availableOperacoes}
              availableFrotas={availableFrotas}
            />
            {!isMapFullscreen && (
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {/* SPEEDS DETECTED */}
                 <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1' }} className="rounded-3xl p-8">
                   <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                     SPEEDS DETECTED
                   </p>
                   <h1 style={{ color: '#1D4ED8' }} className="text-6xl font-black mt-4">
                     {alertZone.length}
                   </h1>
                 </div>

                 {/* ALERT ZONE */}
                 <div style={{ backgroundColor: '#DBEAFE', border: '1px solid #93C5FD' }} className="rounded-3xl p-8">
                   <p style={{ color: '#1D4ED8' }} className="text-xs font-black uppercase tracking-[0.2em]">
                     ALERT ZONE
                   </p>
                   <h1 style={{ color: '#DC2626' }} className="text-6xl font-black mt-4">
                     {alertZone.length}
                   </h1>
                 </div>

                 <div style={{ backgroundColor: '#0F172A' }} className="p-8 rounded-3xl border border-white/10">
                   <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-4">Cobertura GPS</h4>
                   <h1 className="text-4xl font-black text-white italic">99.8%</h1>
                   <div style={{ backgroundColor: '#16A34A' }} className="h-1 w-20 rounded-full mt-4"></div>
                   <p className="text-[10px] text-white/60 font-black uppercase mt-4 tracking-widest flex items-center gap-2">
                     <span style={{ backgroundColor: '#16A34A' }} className="w-2 h-2 rounded-full animate-pulse"></span>
                     Sinal Executivo
                   </p>
                 </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReport && (
          <CMAAReport 
            data={alertZone} 
            searchedSpeed={searchedSpeed}
            onClose={() => setShowReport(false)} 
            onPDFGenerated={addRecordsToRanking}
            correctiveActions={correctiveActions}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRankingReport && (
          <DriverRankingReport 
            data={filteredDashboardData} 
            dashboardRanking={driversDashboardRanking}
            onClose={() => setShowRankingReport(false)}
            appliedStartDate={appliedStartDate}
            appliedEndDate={appliedEndDate}
            appliedUnidade={appliedUnidade}
            appliedOperacao={selectedOperacao}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDetailedOccurrencesReport && (
          <DetailedOccurrencesReport 
            data={occurrencesForMonth}
            cardCount={occurrencesForMonth.length}
            onClose={() => setShowDetailedOccurrencesReport(false)}
            appliedStartDate={appliedStartDate || startDate}
            appliedEndDate={appliedEndDate || endDate}
            appliedUnidade={appliedUnidade || selectedUnidade}
            appliedOperacao={selectedOperacao}
            appliedFrente={selectedFrente}
          />
        )}
      </AnimatePresence>

      {/* Advanced Filter Slide-over Drawer */}
      <AnimatePresence>
        {isFilterPanelOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterPanelOpen(false)}
              className={`fixed inset-0 bg-black ${isMapFullscreen ? 'z-[150]' : 'z-[120]'}`}
            />
            
            {/* Filter Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              style={{ backgroundColor: '#FFFFFF', borderLeft: '1px solid #CBD5E1' }}
              className={`fixed right-0 top-0 bottom-0 w-[420px] max-w-full shadow-2xl flex flex-col pointer-events-auto ${isMapFullscreen ? 'z-[155]' : 'z-[130]'}`}
            >
              <div style={{ backgroundColor: '#0F172A' }} className="p-6 text-white flex items-center justify-between shadow-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emulator-500/10 flex items-center justify-center text-emerald-400">
                    <Filter size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight">Filtros Avançados</h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Refine as ocorrências do mapa e painel</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsFilterPanelOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-all cursor-pointer text-slate-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 1. Unidade */}
                <div className="flex flex-col gap-2">
                  <label style={{ color: '#475569' }} className="text-[10px] font-black uppercase tracking-wider">
                    Unidade (Empresa)
                  </label>
                  <select
                    value={selectedUnidade}
                    onChange={(e) => setSelectedUnidade(e.target.value)}
                    className="w-full py-3 px-4 rounded-xl border border-slate-200 text-xs text-slate-800 font-bold focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/5 bg-slate-50 transition-all cursor-pointer"
                  >
                    <option value="Todas">Todas as Unidades</option>
                    {availableUnidades.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                    {availableUnidades.length === 0 && (
                      <>
                        <option value="UVP">UVP</option>
                        <option value="UVT">UVT</option>
                        <option value="UCP">UCP</option>
                      </>
                    )}
                  </select>
                </div>

                {/* 2. Frente */}
                <div className="flex flex-col gap-2">
                  <label style={{ color: '#475569' }} className="text-[10px] font-black uppercase tracking-wider">
                    Frente de Trabalho
                  </label>
                  <select
                    value={selectedFrente}
                    onChange={(e) => setSelectedFrente(e.target.value)}
                    className="w-full py-3 px-4 rounded-xl border border-slate-200 text-xs text-slate-800 font-bold focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/5 bg-slate-50 transition-all cursor-pointer"
                  >
                    <option value="Todas">Todas as Frentes</option>
                    {availableFrentes.map((frente) => (
                      <option key={frente} value={frente}>{frente}</option>
                    ))}
                    {availableFrentes.length === 0 && (
                      <>
                        <option value="Frente 1">Frente 1</option>
                        <option value="Frente 2">Frente 2</option>
                        <option value="Frente 3">Frente 3</option>
                      </>
                    )}
                  </select>
                </div>

                {/* 3. Operação */}
                <div className="flex flex-col gap-2">
                  <label style={{ color: '#475569' }} className="text-[10px] font-black uppercase tracking-wider">
                    Operação
                  </label>
                  <select
                    value={selectedOperacao}
                    onChange={(e) => setSelectedOperacao(e.target.value)}
                    className="w-full py-3 px-4 rounded-xl border border-slate-200 text-xs text-slate-800 font-bold focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/5 bg-slate-50 transition-all cursor-pointer"
                  >
                    <option value="Todas">Todas as Operações</option>
                    {availableOperacoes.map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                </div>

                {/* 4. Frota */}
                <div className="flex flex-col gap-2">
                  <label style={{ color: '#475569' }} className="text-[10px] font-black uppercase tracking-wider">
                    Frota (Equipamento)
                  </label>
                  <select
                    value={selectedFrota}
                    onChange={(e) => setSelectedFrota(e.target.value)}
                    className="w-full py-3 px-4 rounded-xl border border-slate-200 text-xs text-slate-800 font-bold focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/5 bg-slate-50 transition-all cursor-pointer"
                  >
                    <option value="Todas">Todas as Frotas</option>
                    {availableFrotas.map((frota) => (
                      <option key={frota} value={frota}>{frota}</option>
                    ))}
                  </select>
                </div>

                {/* 5. Matrícula */}
                <div className="flex flex-col gap-2">
                  <label style={{ color: '#475569' }} className="text-[10px] font-black uppercase tracking-wider">
                    Matrícula
                  </label>
                  <input
                    type="text"
                    value={selectedMatricula}
                    onChange={(e) => setSelectedMatricula(e.target.value)}
                    placeholder="Filtrar por matrícula..."
                    className="w-full py-3 px-4 rounded-xl border border-slate-200 text-xs text-slate-800 font-bold focus:outline-none focus:border-blue-600 bg-slate-50 transition-all"
                  />
                </div>

                {/* 6. Operador */}
                <div className="flex flex-col gap-2">
                  <label style={{ color: '#475569' }} className="text-[10px] font-black uppercase tracking-wider">
                    Operador
                  </label>
                  <input
                    type="text"
                    value={selectedOperador}
                    onChange={(e) => setSelectedOperador(e.target.value)}
                    placeholder="Filtrar por nome do operador..."
                    className="w-full py-3 px-4 rounded-xl border border-slate-200 text-xs text-slate-800 font-bold focus:outline-none focus:border-blue-600 bg-slate-50 transition-all"
                  />
                </div>

                {/* 7 & 8. Período */}
                <div className="flex flex-col gap-2">
                  <label style={{ color: '#475569' }} className="text-[10px] font-black uppercase tracking-wider">
                    Período Inicial / Final
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="py-3 px-4 rounded-xl border border-slate-200 text-xs text-slate-800 font-bold focus:outline-none focus:border-blue-600 bg-slate-50 transition-all cursor-pointer"
                    />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="py-3 px-4 rounded-xl border border-slate-200 text-xs text-slate-800 font-bold focus:outline-none focus:border-blue-600 bg-slate-50 transition-all cursor-pointer"
                    />
                  </div>
                </div>

                {/* 9. Faixa de Velocidade */}
                <div className="flex flex-col gap-2">
                  <label style={{ color: '#475569' }} className="text-[10px] font-black uppercase tracking-wider">
                    Faixa de Velocidade
                  </label>
                  <select
                    value={speedRange}
                    onChange={(e) => setSpeedRange(e.target.value as any)}
                    className="w-full py-3 px-4 rounded-xl border border-slate-200 text-xs text-slate-800 font-bold focus:outline-none focus:border-blue-600 bg-slate-50 transition-all cursor-pointer"
                  >
                    <option value="Todas">Todas as Faixas (&gt; 40 km/h)</option>
                    <option value="40-50">De 40 a 50 km/h</option>
                    <option value="50-60">De 50 a 60 km/h</option>
                    <option value="60-70">De 60 a 70 km/h</option>
                    <option value="70-80">De 70 a 80 km/h</option>
                    <option value="80+">Acima de 80 km/h</option>
                  </select>
                </div>
              </div>
              
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button
                  onClick={() => {
                    setSelectedUnidade('Todas');
                    setSelectedFrente('Todas');
                    setSelectedOperacao('Todas');
                    setSelectedFrota('Todas');
                    setSelectedMatricula('');
                    setSelectedOperador('');
                    setStartDate('');
                    setEndDate('');
                    setSpeedRange('Todas');
                    setAppliedStartDate('');
                    setAppliedEndDate('');
                    setAppliedUnidade('Todas');
                    setSelectedPointsOnMap([]);
                    setAlertZone([]);
                  }}
                  className="flex-1 py-3.5 border border-slate-200 text-[#475569] hover:bg-slate-100 text-xs font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer text-center"
                >
                  Resetar
                </button>
                <button
                  onClick={() => {
                    if (startDate && endDate && selectedUnidade !== 'Todas') {
                      handleSearchInfractions();
                    } else {
                      setIsFilterPanelOpen(false);
                    }
                  }}
                  style={{ 
                    backgroundColor: (startDate && endDate && selectedUnidade !== 'Todas') ? '#1D4ED8' : '#10B981' 
                  }}
                  className="flex-1 py-3.5 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all hover:brightness-110 cursor-pointer text-center flex items-center justify-center gap-2"
                >
                  {(startDate && endDate && selectedUnidade !== 'Todas') ? (
                    <>
                      <Search size={14} /> Buscar
                    </>
                  ) : (
                    'OK'
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Fullscreen Month Occurrence Details Overlay */}
      <AnimatePresence>
        {selectedMonthIndex !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ type: 'spring', damping: 25 }}
            style={{ backgroundColor: '#F8FAFC' }}
            className="fixed inset-0 z-[140] w-full h-full overflow-y-auto flex flex-col p-6 md:p-12"
          >
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-8 mb-8">
              <div className="flex items-center gap-4">
                <div 
                  onClick={() => setSelectedMonthIndex(null)}
                  className="w-12 h-12 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 cursor-pointer transition-all active:scale-95 shadow-sm"
                >
                  <ArrowLeft size={18} />
                </div>
                <div>
                  <h1 style={{ color: '#0F172A' }} className="text-2xl font-black uppercase tracking-tight">
                    DETALHAMENTO DAS OCORRÊNCIAS
                  </h1>
                  <p className="text-xs font-black uppercase tracking-widest text-[#1D4ED8] mt-0.5">
                    OCORRÊNCIAS DE {monthName} (REGISTROS SELECIONADOS NO MAPA)
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => setSelectedMonthIndex(null)}
                style={{ backgroundColor: '#0F172A' }}
                className="px-6 py-3.5 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl flex items-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95"
              >
                Voltar ao Painel
              </button>
            </div>

            {/* Resume KPIs Group */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Card 1: Quantidade */}
              <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                  <Activity size={20} />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Quantidade de Ocorrências</p>
                  <h4 style={{ color: '#0F172A' }} className="text-2xl font-black">{summaryStats.count}</h4>
                </div>
              </div>

              {/* Card 2: Maior Velocidade */}
              <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-600 animate-pulse">
                  <Gauge size={20} />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Maior Velocidade</p>
                  <h4 style={{ color: '#DC2626' }} className="text-2xl font-black">
                    {summaryStats.maxSpeed > 0 ? `${summaryStats.maxSpeed.toFixed(1).replace('.', ',')} km/h` : '---'}
                  </h4>
                </div>
              </div>

              {/* Card 3: Velocidade Média */}
              <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Velocidade Média</p>
                  <h4 style={{ color: '#EA580C' }} className="text-2xl font-black">
                    {summaryStats.avgSpeed > 0 ? `${summaryStats.avgSpeed.toFixed(1).replace('.', ',')} km/h` : '---'}
                  </h4>
                </div>
              </div>

              {/* Card 4: Quantidade de Operadores */}
              <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-600">
                  <User size={20} />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Quantidade de Operadores</p>
                  <h4 style={{ color: '#8B5CF6' }} className="text-2xl font-black">{summaryStats.uniqueDrivers}</h4>
                </div>
              </div>
            </div>

            {/* List Table Container */}
            <div className="flex-1 bg-white border border-slate-200 rounded-[32px] overflow-hidden flex flex-col shadow-sm">
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 style={{ color: '#0F172A' }} className="text-base font-black uppercase tracking-tight">Ocorrências Filtradas</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Lista detalhada ordenada da maior para a menor velocidade</p>
                </div>
                
                <div className="flex items-center gap-3 ml-auto sm:ml-0">
                  <button
                    onClick={() => setShowDetailedOccurrencesReport(true)}
                    style={{ backgroundColor: '#1D4ED8' }}
                    className="px-5 h-10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-blue-600/10"
                  >
                    📄 Relatório
                  </button>
                  <div className="text-xs font-black uppercase tracking-widest text-[#1D4ED8] bg-blue-50 px-3 h-10 flex items-center rounded-xl">
                    {occurrencesForMonth.length} de {selectedPointsOnMap.length} selecionadas
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC' }} className="border-b border-slate-100">
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Ord</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Data</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Hora</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Velocidade</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Operador</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Matrícula</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Operação</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Unidade</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Frente</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400">Frota</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Latitude</th>
                      <th className="py-4 px-6 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Longitude</th>
                    </tr>
                  </thead>
                  <tbody>
                    {occurrencesForMonth.map((rec, idx) => (
                      <tr 
                        key={rec.id} 
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-3 px-6 text-xs text-center font-black text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-6 text-xs font-bold text-slate-800 whitespace-nowrap">
                          {format(rec.dataHora, 'dd/MM/yyyy')}
                        </td>
                        <td className="py-3 px-6 text-xs font-bold text-slate-800 whitespace-nowrap">
                          {format(rec.dataHora, 'HH:mm:ss')}
                        </td>
                        <td className="py-3 px-6 text-xs font-black text-red-600 text-right whitespace-nowrap font-mono">
                          {rec.velocidade.toFixed(1).replace('.', ',')} km/h
                        </td>
                        <td className="py-3 px-6 text-xs font-bold text-slate-800 uppercase max-w-[180px] truncate">
                          {rec.descricaoOperador || '---'}
                        </td>
                        <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap font-mono">
                          {rec.matricula || '---'}
                        </td>
                        <td className="py-3 px-6 text-xs text-slate-600 max-w-[180px] truncate">
                          {rec.operacao || '---'}
                        </td>
                        <td className="py-3 px-6 text-xs font-bold text-slate-600 whitespace-nowrap">
                          {rec.unidade || '---'}
                        </td>
                        <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap">
                          {rec.frente || '---'}
                        </td>
                        <td className="py-3 px-6 text-xs text-slate-600 whitespace-nowrap font-mono">
                          {rec.frota || '---'}
                        </td>
                        <td className="py-3 px-6 text-xs text-slate-400 text-right whitespace-nowrap font-mono">
                          {rec.latitude?.toFixed(6) || '---'}
                        </td>
                        <td className="py-3 px-6 text-xs text-slate-400 text-right whitespace-nowrap font-mono">
                          {rec.longitude?.toFixed(6) || '---'}
                        </td>
                      </tr>
                    ))}
                    {occurrencesForMonth.length === 0 && (
                      <tr>
                        <td colSpan={12} className="py-12 text-center text-xs font-bold text-slate-400">
                          Nenhuma ocorrência encontrada para este mês nos pontos selecionados no mapa.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  </div>
  );
}

