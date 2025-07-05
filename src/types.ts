export interface RegisterField {
  name: string;
  bits: string;
  raw: number | bigint;
  value?: string;
  validation?: ValidationItem[];
}

export interface Register {
  offset: number;
  size: number;
  name: string;
  value: number | bigint | string;
  description: string;
  fields?: RegisterField[];
  validation?: ValidationItem[];
}

export interface ValidationItem {
  level: 'error' | 'warning' | 'info';
  message: string;
}

export interface ParseResult {
  registers: Register[];
  bytes: Uint8Array;
}