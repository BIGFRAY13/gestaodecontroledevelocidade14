export interface TelemetryRecord {
  id: string;
  codigoOperador: string | number;
  matricula: string | number;
  descricaoOperador: string;
  velocidade: number;
  latitude: number;
  longitude: number;
  operacao: string;
  dataHora: Date;
  frota: string;
  unidade?: string;
  frente?: string | number;
  dataSelecao?: string;
}

export interface CorrectiveAction {
  id: string;
  occurrenceId: string;
  actionDate: string;
  responsible: string;
  observation: string;
  actionTypes: string[];
  registeredAt: string;
  registeredBy: string;
}

export type OperationType = 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';

export interface AsphaltedStretch {
  id: string;
  name: string;
  coordinates: Array<{ lat: number; lng: number }>;
  createdAt: string;
  updatedAt: string;
}
