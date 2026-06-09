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
}

export type OperationType = 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
