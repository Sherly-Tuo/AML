export interface ParsedDemandBidInput {
  buyerName: string;
  demandKwh: number;
  maxPricePerKwh: number;
  requestedAt?: string;
}

export interface ParsedDemandDataset {
  rows: ParsedDemandBidInput[];
  errors: string[];
  format: 'csv' | 'json';
}

type DemandRowResult = { error: string } | { row: ParsedDemandBidInput };

const buyerAliases = ['buyername', 'buyer', 'name', 'participant', 'household', 'unit', 'customer'];
const demandAliases = ['demandkwh', 'demand', 'kwh', 'quantity', 'requestedkwh', 'energykwh', 'load'];
const priceAliases = ['maxpriceperkwh', 'maxprice', 'bidprice', 'price', 'priceperkwh', 'willingnesstopay', 'bid'];
const timeAliases = ['requestedat', 'time', 'timestamp', 'createdat', 'date'];

const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const detectDelimiter = (headerLine: string) => {
  const candidates = [',', '\t', ';'];
  let best = ',';
  let bestCount = 0;

  for (const candidate of candidates) {
    const count = headerLine.split(candidate).length;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }

  return best;
};

const splitDelimitedLine = (line: string, delimiter: string) => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
};

const parseCsvRows = (raw: string) => {
  const lines = raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return null;
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitDelimitedLine(lines[0], delimiter);

  if (headers.length < 2) {
    return null;
  }

  return lines.slice(1).map((line) => {
    const cells = splitDelimitedLine(line, delimiter);
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = cells[index] ?? '';
      return row;
    }, {});
  });
};

const parseJsonRows = (raw: string) => {
  try {
    const parsed = JSON.parse(raw) as unknown;

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (parsed && typeof parsed === 'object') {
      const container = parsed as Record<string, unknown>;
      const candidates = [container.data, container.rows, container.records, container.items];
      const match = candidates.find(Array.isArray);
      return Array.isArray(match) ? match : null;
    }

    return null;
  } catch {
    return null;
  }
};

const findFieldValue = (row: Record<string, unknown>, aliases: string[]) => {
  const entries = Object.entries(row);

  for (const [key, value] of entries) {
    if (aliases.includes(normalizeKey(key))) {
      return value;
    }
  }

  return undefined;
};

const parseNumber = (value: unknown) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }

  if (typeof value !== 'string') {
    return NaN;
  }

  const cleaned = value.replace(/[$,\s]/g, '').replace(/kwh/gi, '');
  return Number(cleaned);
};

const coerceDemandRow = (row: unknown, rowIndex: number): DemandRowResult => {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return {
      error: `第 ${rowIndex} 行不是可识别的对象格式。`,
    };
  }

  const record = row as Record<string, unknown>;
  const buyerValue = findFieldValue(record, buyerAliases);
  const demandValue = findFieldValue(record, demandAliases);
  const priceValue = findFieldValue(record, priceAliases);
  const timeValue = findFieldValue(record, timeAliases);

  const demandKwh = parseNumber(demandValue);
  const maxPricePerKwh = parseNumber(priceValue);

  if (!Number.isFinite(demandKwh) || demandKwh <= 0) {
    return {
      error: `第 ${rowIndex} 行缺少有效的 demand kWh。`,
    };
  }

  if (!Number.isFinite(maxPricePerKwh) || maxPricePerKwh <= 0) {
    return {
      error: `第 ${rowIndex} 行缺少有效的 bid price。`,
    };
  }

  return {
    row: {
      buyerName:
        typeof buyerValue === 'string' && buyerValue.trim().length > 0
          ? buyerValue.trim()
          : `Demand Buyer ${rowIndex}`,
      demandKwh,
      maxPricePerKwh,
      requestedAt: typeof timeValue === 'string' && timeValue.trim().length > 0 ? timeValue.trim() : undefined,
    },
  };
};

const finalizeRows = (rows: unknown[], format: 'csv' | 'json'): ParsedDemandDataset => {
  const parsedRows: ParsedDemandBidInput[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const result = coerceDemandRow(row, index + 2);
    if ('row' in result) {
      parsedRows.push(result.row);
      return;
    }

    errors.push(result.error);
  });

  return {
    rows: parsedRows,
    errors,
    format,
  };
};

export const parseDemandDataset = (raw: string): ParsedDemandDataset => {
  const trimmed = raw.trim();

  if (!trimmed) {
    return {
      rows: [],
      errors: ['请先粘贴或载入 demand side 数据。'],
      format: 'csv',
    };
  }

  const jsonRows = parseJsonRows(trimmed);
  if (jsonRows) {
    return finalizeRows(jsonRows, 'json');
  }

  const csvRows = parseCsvRows(trimmed);
  if (csvRows) {
    return finalizeRows(csvRows, 'csv');
  }

  return {
    rows: [],
    errors: ['无法识别数据格式。请使用 JSON 数组，或带表头的 CSV / TSV。'],
    format: 'csv',
  };
};
