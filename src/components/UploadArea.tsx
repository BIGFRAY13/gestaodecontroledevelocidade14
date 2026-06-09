import React, { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { TelemetryRecord } from '../types';
import { parse } from 'date-fns';

interface UploadAreaProps {
  onDataLoaded: (data: TelemetryRecord[]) => void;
}

export default function UploadArea({ onDataLoaded }: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [importStats, setImportStats] = useState<{
    imported: number;
    ignored: number;
    error: number;
  } | null>(null);

  const normalizeKey = (key: string) =>
    key
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

  const COLUMN_ALIASES = {
    registration: [
      'codigo do operador',
      'código do operador',
      'cod operador',
      'matricula',
      'registro',
      'codigo',
      'id operador',
      'registration',
      'codigooperador',
      'codoperador',
      'idoperador'
    ],
    name: [
      'descrição do operador',
      'descricao do operador',
      'desc operador',
      'desc. operador',
      'nome operador',
      'nome do operador',
      'operador',
      'motorista',
      'condutor',
      'colaborador',
      'funcionario',
      'nome',
      'motorista name',
      'operator name',
      'nome condutor',
      'driver name',
      'driver',
      'operator',
      'employee',
      'descricaodooperador',
      'descricaooperador'
    ],
    speed: [
      'velocidade',
      'kmh',
      'vel',
      'speed',
      'velocidademaxima'
    ],
    latitude: [
      'latitude',
      'lat',
      'latitudegps'
    ],
    longitude: [
      'longitude',
      'long',
      'lon',
      'lng',
      'longitudegps'
    ],
    operation: [
      'operacao',
      'atividade',
      'servico',
      'oper'
    ],
    datetime: [
      'datahora',
      'data',
      'hora',
      'horario',
      'momento'
    ],
    fleet: [
      'frota',
      'fleet',
      'equipamento',
      'veiculo',
      'placa'
    ],
    unidade: [
      'unidade',
      'empresa',
      'filial',
      'usina',
      'centro de custo',
      'centrocusto',
      'branch'
    ]
  };

  const handleFile = async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(extension || '')) {
      setError('Formato de arquivo não suportado. Use XLSX, XLS ou CSV.');
      return;
    }

    if (file.size > 250 * 1024 * 1024) {
      setError('Arquivo muito grande. Máximo 250MB.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);
    setImportStats(null);

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const bstr = e.target?.result as string;
          
          if (!bstr || bstr.length === 0) {
            throw new Error('Arquivo inválido ou corrompido.');
          }

          let workbook: XLSX.WorkBook;
          try {
            // Tentativa de leitura binária padrão para XLSX/XLS/CSV
            workbook = XLSX.read(bstr, { type: 'binary', cellDates: true });
          } catch (firstReadErr) {
            console.warn('Tentando recuperar arquivo com parâmetros reduzidos para contornar compressão corrompida...', firstReadErr);
            try {
              // Se falhar (corrompimento zip / tamanho inválido), tentamos parâmetros leves para simplificar descompactação do JSZip embutido
              workbook = XLSX.read(bstr, { 
                type: 'binary', 
                codepage: 65001, 
                cellDates: true,
                cellStyles: false,
                cellHTML: false,
                cellFormula: false
              });
            } catch (err) {
              throw new Error('Erro ao descompactar a estrutura interna do arquivo Excel. O arquivo pode estar corrompido de forma irrecuperável.');
            }
          }

          let validSheetName = '';
          let json: any[] = [];
          
          // 1. Ler automaticamente a primeira planilha válida.
          // 2. Ignorar abas vazias.
          // 3. Ignorar abas ocultas.
          for (let i = 0; i < workbook.SheetNames.length; i++) {
            const currentName = workbook.SheetNames[i];
            
            // Ignorar abas ocultas (Hidden: 1 ou 2, ou state: hidden)
            const sheetMeta = workbook.Workbook?.Sheets?.[i];
            const isHidden = sheetMeta && (
              sheetMeta.Hidden === 1 || 
              sheetMeta.Hidden === 2 || 
              String(sheetMeta.Hidden).toLowerCase() === 'hidden' || 
              String(sheetMeta.Hidden).toLowerCase() === 'veryhidden' ||
              (sheetMeta as any).state === 'hidden' || 
              (sheetMeta as any).state === 'veryhidden'
            );
            if (isHidden) {
              console.log(`Sheet "${currentName}" ignorada por estar oculta.`);
              continue;
            }

            const worksheet = workbook.Sheets[currentName];
            // Ignorar abas vazias (sem células/!ref)
            if (!worksheet || !worksheet['!ref']) {
              console.log(`Sheet "${currentName}" ignorada por estar vazia (sem !ref).`);
              continue;
            }

            const tempJson = XLSX.utils.sheet_to_json(worksheet, {
              defval: '',
              raw: false,
              blankrows: false
            });

            // Se a planilha não tiver registros, ignorar
            if (tempJson.length === 0) {
              console.log(`Sheet "${currentName}" ignorada por estar vazia.`);
              continue;
            }

            // Primeira planilha válida encontrada
            validSheetName = currentName;
            json = tempJson;
            break;
          }

          if (!validSheetName || json.length === 0) {
            throw new Error('Nenhuma planilha válida, visível e com dados foi encontrada no arquivo.');
          }

          const firstRow = json[0] as Record<string, any>;
          const keys = Object.keys(firstRow);
          
          // Pré-calcular correspondência de colunas (aliasing)
          const findKeyForAlias = (aliases: string[]) => {
            for (const key of keys) {
              const normalizedKey = normalizeKey(key);
              for (const alias of aliases) {
                if (normalizedKey.includes(alias) || alias.includes(normalizedKey)) {
                  return key;
                }
              }
            }
            return '';
          };

          const mappedRegistrationKey = findKeyForAlias(COLUMN_ALIASES.registration);
          const mappedNameKey = findKeyForAlias(COLUMN_ALIASES.name);
          const mappedSpeedKey = findKeyForAlias(COLUMN_ALIASES.speed);
          const mappedLatKey = findKeyForAlias(COLUMN_ALIASES.latitude);
          const mappedLonKey = findKeyForAlias(COLUMN_ALIASES.longitude);
          const mappedOpKey = findKeyForAlias(COLUMN_ALIASES.operation);
          const mappedDTimeKey = findKeyForAlias(COLUMN_ALIASES.datetime);
          const mappedFleetKey = findKeyForAlias(COLUMN_ALIASES.fleet);
          const mappedUnidadeKey = findKeyForAlias(COLUMN_ALIASES.unidade);

          let importedCount = 0;
          let ignoredCount = 0;
          let errorCount = 0;
          const records: TelemetryRecord[] = [];

          // 5. Não cancelar toda a importação por causa de linhas com erro.
          // 6. Importar todos os registros válidos disponíveis.
          json.forEach((row: any, index) => {
            try {
              // Validar linha completamente vazia
              const rowKeys = Object.keys(row);
              const hasAnyValue = rowKeys.some(k => row[k] !== '' && row[k] !== null && row[k] !== undefined);
              if (!hasAnyValue) {
                ignoredCount++;
                return;
              }

              const regVal = mappedRegistrationKey ? row[mappedRegistrationKey] : '';
              const nameVal = mappedNameKey ? row[mappedNameKey] : '';
              const speedVal = mappedSpeedKey ? row[mappedSpeedKey] : '';
              const latVal = mappedLatKey ? row[mappedLatKey] : '';
              const lonVal = mappedLonKey ? row[mappedLonKey] : '';
              const opVal = mappedOpKey ? row[mappedOpKey] : '';
              const dTimeVal = mappedDTimeKey ? row[mappedDTimeKey] : '';
              const fleetVal = mappedFleetKey ? row[mappedFleetKey] : '';
              const unidadeVal = mappedUnidadeKey ? row[mappedUnidadeKey] : '';

              // Se não possui identificador principal nem velocidade, é uma linha de cabeçalho vazia ou rodapé
              if (!regVal && !nameVal && !speedVal) {
                ignoredCount++;
                return;
              }

              const speed = parseFloat(speedVal);
              const lat = parseFloat(latVal);
              const lon = parseFloat(lonVal);

              if (isNaN(speed) || speed <= 0) {
                if (speedVal === '' || speedVal === null || speedVal === undefined || parseFloat(speedVal) === 0) {
                  ignoredCount++;
                } else {
                  errorCount++;
                }
                return;
              }

              if (!nameVal && !regVal) {
                ignoredCount++;
                return;
              }

              if (latVal && isNaN(lat)) {
                errorCount++;
                return;
              }
              if (lonVal && isNaN(lon)) {
                errorCount++;
                return;
              }

              let dataHora: Date;
              if (typeof dTimeVal === 'number' || (typeof dTimeVal === 'string' && !isNaN(Number(dTimeVal)) && dTimeVal.trim() !== '')) {
                const numDTime = Number(dTimeVal);
                const parsed = XLSX.SSF.parse_date_code(numDTime);
                dataHora = new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S);
              } else {
                try {
                  dataHora = new Date(dTimeVal);
                  if (isNaN(dataHora.getTime())) {
                    dataHora = parse(dTimeVal, 'dd/MM/yyyy HH:mm:ss', new Date());
                  }
                } catch {
                  dataHora = new Date();
                }
              }

              if (isNaN(dataHora.getTime())) {
                errorCount++;
                return;
              }

              const now = Date.now();
              records.push({
                id: `c-${now}-${Math.random().toString(36).substring(7)}-${index}`,
                codigoOperador: String(regVal || '---').trim(),
                matricula: String(regVal || '---').trim(),
                descricaoOperador: String(
                  nameVal ||
                  row['Descrição do Operador'] ||
                  row['DESCRIÇÃO DO OPERADOR'] ||
                  row['Motorista'] ||
                  row['MOTORISTA'] ||
                  row['Nome'] ||
                  row['NOME'] ||
                  'SEM NOME'
                ).trim().toUpperCase(),
                velocidade: speed,
                latitude: isNaN(lat) ? 0 : lat,
                longitude: isNaN(lon) ? 0 : lon,
                operacao: String(opVal || '---').trim(),
                dataHora: dataHora,
                frota: String(fleetVal || '---').trim(),
                unidade: unidadeVal ? String(unidadeVal).trim().toUpperCase() : undefined
              });

              importedCount++;
            } catch (err) {
              console.warn(`Erro irrecuperável na linha ${index}:`, err);
              errorCount++;
            }
          });

          // Exibir resultados ou feedback apropriados
          if (records.length === 0) {
            setError(`Nenhum dado pôde ser importado. (Ignorados: ${ignoredCount}, Erros: ${errorCount})`);
          } else {
            setImportStats({
              imported: importedCount,
              ignored: ignoredCount,
              error: errorCount
            });
            onDataLoaded(records);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 8000);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Erro ao processar o arquivo.');
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      setError('Erro ao carregar o arquivo.');
      setIsLoading(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  return (
    <div className="w-full flex justify-center items-center">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        style={{
          width: '3.2cm',
          height: '3.2cm',
          minWidth: '3.2cm',
          maxWidth: '3.2cm',
          minHeight: '3.2cm',
          maxHeight: '3.2cm',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)'
        }}
        className={`relative border-2 border-dashed rounded-[20px] p-3 transition-all flex flex-col items-center justify-center text-center cursor-pointer overflow-hidden mx-auto
          ${isDragging ? 'border-blue-600 bg-blue-50/40' : 'border-blue-500/60 hover:border-blue-600 hover:bg-blue-50/20 bg-white'}
          ${error ? 'border-rose-500/80 bg-rose-50/5' : ''}
          ${success ? 'border-emerald-500/80 bg-emerald-500/5' : ''}
        `}
        id="drag-drop-area"
      >
        <input
          type="file"
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          accept=".xlsx,.xls,.csv"
        />

        {isLoading ? (
          <div className="space-y-1.5">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" strokeWidth={2.5} />
            <p className="text-slate-700 font-bold tracking-tight text-[9px] uppercase">Processando...</p>
          </div>
        ) : success ? (
          <div className="space-y-1 py-1">
            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="text-emerald-600 w-5 h-5" />
            </div>
            <div>
              <p className="text-slate-800 font-black text-[10px] uppercase tracking-wider">Sucesso!</p>
              {importStats && (
                <div className="mt-1 flex flex-col items-center gap-0.5 border-t border-slate-100 pt-1">
                  <p className="text-slate-500 text-[8px] font-semibold leading-normal">
                    <span className="text-emerald-600 font-black">{importStats.imported}</span> ok &bull;{' '}
                    <span className="text-rose-600 font-black">{importStats.error}</span> erro
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1 transition-transform duration-300 ${isDragging ? 'scale-110 bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'}`}>
              <Upload size={16} />
            </div>
            <h3 className="text-slate-800 font-black text-[9px] mb-0.5 uppercase tracking-wider">Importar Telemetria</h3>
            <p className="text-slate-500 text-[8px] max-w-[120px] mx-auto mb-1 leading-normal font-medium">
              Arraste XLSX, XLS, CSV ou clique
            </p>
            
            <div className="flex gap-1 text-[7px] font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-full mt-0.5 border border-slate-200">
              <span className="flex items-center gap-0.5"><FileSpreadsheet size={8} className="text-slate-500" /> EXCEL</span>
              <span className="flex items-center gap-0.5"><FileSpreadsheet size={8} className="text-slate-500" /> CSV</span>
            </div>
          </>
        )}

        {error && (
          <div className="absolute bottom-1 left-1 right-1 flex items-center gap-1 text-rose-600 text-[8px] font-extrabold animate-in fade-in slide-in-from-bottom-2 bg-white border border-rose-200 p-1 rounded-md shadow-sm">
            <AlertCircle size={10} className="shrink-0 text-rose-500" />
            <span className="truncate flex-1 text-left">{error}</span>
            <button onClick={(e) => { e.stopPropagation(); setError(null); }} className="hover:text-slate-800 transition-colors shrink-0">
              <X size={10} className="text-slate-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
