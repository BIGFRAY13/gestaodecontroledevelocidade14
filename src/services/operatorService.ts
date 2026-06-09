
export interface Operator {
  matricula: string;
  nome: string;
}

const SHEET_ID = '15loUO3OZVtx0iTgZMm53-uVJzH3IZZhLe4B0N8Mh64I';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

export async function fetchOperators(): Promise<Map<string, string>> {
  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error('Failed to fetch from Google Sheets');
    const text = await response.text();
    
    // Check if the response is HTML (happens if sheet is private)
    if (text.includes('<html') || text.includes('<!DOCTYPE html')) {
      console.warn('Google Sheet is private. Mapping will not work.');
      throw new Error('PLANILHA PRIVADA: Compartilhe a planilha como "Qualquer pessoa com o link pode ler"');
    }
    
    // Parse CSV handling quotes and commas
    const lines = text.split(/\r?\n/);
    const operatorMap = new Map<string, string>();
    
    // Detect delimiter
    const header = lines[0];
    const commas = (header.match(/,/g) || []).length;
    const semicolons = (header.match(/;/g) || []).length;
    const delimiter = semicolons > commas ? ';' : ',';
    
    console.log(`CSV Delimiter detected: "${delimiter}" (Commas: ${commas}, Semicolons: ${semicolons})`);
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let charIndex = 0; charIndex < line.length; charIndex++) {
        const char = line[charIndex];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          columns.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      columns.push(current.trim());
      
      if (columns.length >= 3) {
        const matricula = columns[1].replace(/^"|"$/g, '').trim();
        const nome = columns[2].replace(/^"|"$/g, '').trim().toUpperCase();
        
        if (matricula && nome) {
          // Store multiple versions of the key to be sure
          const cleanKey = matricula.split('.')[0].replace(/^0+/, '');
          if (cleanKey) operatorMap.set(cleanKey, nome);
          operatorMap.set(matricula, nome);
          operatorMap.set(matricula.trim(), nome);
          
          if (i < 10) console.log(`Mapped: [${matricula}] -> [${nome}]`);
        }
      }
    }
    
    console.log(`Loaded ${operatorMap.size} operators from Google Sheets`);
    return operatorMap;
  } catch (error) {
    console.error('Error fetching operators:', error);
    return new Map();
  }
}
