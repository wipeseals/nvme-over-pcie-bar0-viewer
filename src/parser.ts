import { Register, RegisterField, ValidationItem } from './types.js';

export const readU32 = (bytes: Uint8Array, offset: number): number => 
  new DataView(bytes.buffer).getUint32(offset, true);

export const readU64 = (bytes: Uint8Array, offset: number): bigint => 
  new DataView(bytes.buffer).getBigUint64(offset, true);

export const toHex = (val: number | bigint, pad: number): string => 
  '0x' + val.toString(16).padStart(pad, '0').toUpperCase();

export function parseHexDump(text: string): Uint8Array {
  const hexContent = text.split('\n')
    .map(line => {
      // If line contains colon, take part after colon, otherwise take whole line
      const colonIndex = line.indexOf(':');
      return colonIndex >= 0 ? line.split(':')[1] || '' : line;
    })
    .join(' ');

  const hexParts = hexContent.trim().split(/\s+/).filter(p => p);
  
  const fullHexString = hexParts.map(p => p.padStart(2, '0')).join('');

  if (/[^0-9a-fA-F]/i.test(fullHexString)) {
    throw new Error(`Input contains invalid hexadecimal characters.`);
  }
  
  const bytes = [];
  for (let i = 0; i < fullHexString.length; i += 2) {
    const byteString = fullHexString.substr(i, 2);
    if (byteString.length === 2) {
      bytes.push(parseInt(byteString, 16));
    }
  }
  return new Uint8Array(bytes);
}

export function parseBinaryFile(buffer: Buffer): Uint8Array {
  return new Uint8Array(buffer);
}

export function parseAndValidateNvmeRegisters(bytes: Uint8Array): Register[] {
  const registers: Register[] = [];
  const page_size = 4096;

  // --- CAP (Controller Capabilities) ---
  const cap = readU64(bytes, 0x00);
  registers.push({
    offset: 0x00, size: 8, name: 'CAP', value: cap, description: 'Controller Capabilities',
    fields: [
      { name: 'MQES', bits: '15:0', raw: cap & 0xFFFFn, value: `${Number(cap & 0xFFFFn) + 1} entries` },
      { name: 'CQR', bits: '16', raw: (cap >> 16n) & 1n, value: (cap & (1n << 16n)) ? 'Yes' : 'No' },
      { name: 'AMS (WRR)', bits: '17', raw: (cap >> 17n) & 1n, value: `Weighted Round Robin: ${((cap >> 17n) & 1n) ? 'Supported' : 'Not Supported'}` },
      { name: 'AMS (VS)', bits: '18', raw: (cap >> 18n) & 1n, value: `Vendor Specific: ${((cap >> 18n) & 1n) ? 'Supported' : 'Not Supported'}` },
      { name: 'Reserved0', bits: '23:19', raw: (cap >> 19n) & 0x1Fn },
      { name: 'TO', bits: '31:24', raw: (cap >> 24n) & 0xFFn, value: `${Number((cap >> 24n) & 0xFFn) * 500} ms` },
      { name: 'DSTRD', bits: '35:32', raw: (cap >> 32n) & 0xFn, value: `${4 << Number((cap >> 32n) & 0xFn)} bytes` },
      { name: 'NSSRS', bits: '36', raw: (cap >> 36n) & 1n, value: ((cap >> 36n) & 1n) ? 'Yes' : 'No' },
      { name: 'CSS (NVM)', bits: '37', raw: (cap >> 37n) & 1n, value: `NVM Command Set: ${((cap >> 37n) & 1n) ? 'Supported' : 'Not Supported'}` },
      { name: 'Reserved1', bits: '44:38', raw: (cap >> 38n) & 0x7Fn },
      { name: 'BPS', bits: '45', raw: (cap >> 45n) & 1n, value: ((cap >> 45n) & 1n) ? 'Yes' : 'No' },
      { name: 'Reserved2', bits: '47:46', raw: (cap >> 46n) & 0x3n },
      { name: 'MPSMIN', bits: '51:48', raw: (cap >> 48n) & 0xFn, value: `${page_size * (2 ** Number((cap >> 48n) & 0xFn))} B` },
      { name: 'MPSMAX', bits: '55:52', raw: (cap >> 52n) & 0xFn, value: `${page_size * (2 ** Number((cap >> 52n) & 0xFn))} B` },
      { name: 'Reserved3', bits: '63:56', raw: (cap >> 56n) & 0xFFn },
    ]
  });
  
  // --- VS (Version) ---
  const vs = readU32(bytes, 0x08);
  registers.push({
    offset: 0x08, size: 4, name: 'VS', value: vs, description: 'NVM Express Specification Version',
    fields: [
      { name: 'TER', bits: '7:0', raw: vs & 0xFF, value: `${vs & 0xFF}` },
      { name: 'MNR', bits: '15:8', raw: (vs >> 8) & 0xFF, value: `${(vs >> 8) & 0xFF}` },
      { name: 'MJR', bits: '31:16', raw: (vs >> 16) & 0xFFFF, value: `${(vs >> 16) & 0xFFFF}` },
    ]
  });
  
  registers.push({ offset: 0x0C, size: 4, name: 'INTMS', value: readU32(bytes, 0x0C), description: 'Interrupt Mask Set' });
  registers.push({ offset: 0x10, size: 4, name: 'INTMC', value: readU32(bytes, 0x10), description: 'Interrupt Mask Clear' });

  // --- CC (Controller Configuration) ---
  const cc = readU32(bytes, 0x14);
  const cc_shn_map: Record<number, string> = {0: 'No notification', 1: 'Normal shutdown', 2: 'Abrupt shutdown', 3: 'Reserved'};
  registers.push({
    offset: 0x14, size: 4, name: 'CC', value: cc, description: 'Controller Configuration',
    fields: [
      { name: 'EN', bits: '0', raw: cc & 1, value: (cc & 1) ? 'Enabled' : 'Disabled' },
      { name: 'Reserved0', bits: '3:1', raw: (cc >> 1) & 0x7 },
      { name: 'CSS', bits: '6:4', raw: (cc >> 4) & 0x7, value: `${toHex((cc >> 4) & 0x7, 1)} (0=NVM)`},
      { name: 'MPS', bits: '10:7', raw: (cc >> 7) & 0xF, value: `${page_size * (2 ** ((cc >> 7) & 0xF))} B` },
      { name: 'AMS', bits: '13:11', raw: (cc >> 11) & 0x7, value: `${toHex((cc >> 11) & 0x7, 1)} (0=WRR)` },
      { name: 'SHN', bits: '15:14', raw: (cc >> 14) & 0x3, value: `${cc_shn_map[(cc >> 14) & 0x3]}`},
      { name: 'IOSQES', bits: '19:16', raw: (cc >> 16) & 0xF, value: `${2 ** ((cc >> 16) & 0xF)} bytes`},
      { name: 'IOCQES', bits: '23:20', raw: (cc >> 20) & 0xF, value: `${2 ** ((cc >> 20) & 0xF)} bytes`},
      { name: 'Reserved1', bits: '31:24', raw: (cc >> 24) & 0xFF },
    ]
  });

  // --- CSTS (Controller Status) ---
  const csts = readU32(bytes, 0x1C);
  const csts_shst_map: Record<number, string> = {0: 'Normal', 1: 'Shutdown occurring', 2: 'Shutdown complete', 3: 'Reserved'};
  registers.push({
    offset: 0x1C, size: 4, name: 'CSTS', value: csts, description: 'Controller Status',
    fields: [
      { name: 'RDY', bits: '0', raw: csts & 1, value: (csts & 1) ? 'Ready' : 'Not ready' },
      { name: 'CFS', bits: '1', raw: (csts >> 1) & 1, value: ((csts >> 1) & 1) ? 'Fatal error' : 'No fatal error' },
      { name: 'SHST', bits: '3:2', raw: (csts >> 2) & 0x3, value: `${csts_shst_map[(csts >> 2) & 0x3]}` },
      { name: 'NSSRO', bits: '4', raw: (csts >> 4) & 1, value: ((csts >> 4) & 1) ? 'Reset occurred' : 'No reset' },
      { name: 'PP', bits: '5', raw: (csts >> 5) & 1, value: ((csts >> 5) & 1) ? 'Paused' : 'Not paused' },
      { name: 'Reserved0', bits: '31:6', raw: (csts >> 6) },
    ]
  });
  
  registers.push({ offset: 0x20, size: 4, name: 'NSSR', value: 'N/A', description: 'NVM Subsystem Reset (Write-Only)'});

  // --- AQA (Admin Queue Attributes) ---
  const aqa = readU32(bytes, 0x24);
  registers.push({
    offset: 0x24, size: 4, name: 'AQA', value: aqa, description: 'Admin Queue Attributes',
    fields: [
      { name: 'ASQS', bits: '11:0', raw: aqa & 0xFFF, value: `${(aqa & 0xFFF) + 1} entries` },
      { name: 'Reserved0', bits: '15:12', raw: (aqa >> 12) & 0xF},
      { name: 'ACQS', bits: '27:16', raw: (aqa >> 16) & 0xFFF, value: `${((aqa >> 16) & 0xFFF) + 1} entries` },
      { name: 'Reserved1', bits: '31:28', raw: (aqa >> 28) & 0xF },
    ]
  });
  
  registers.push({ offset: 0x28, size: 8, name: 'ASQ', value: readU64(bytes, 0x28), description: 'Admin Submission Queue Base Address' });
  registers.push({ offset: 0x30, size: 8, name: 'ACQ', value: readU64(bytes, 0x30), description: 'Admin Completion Queue Base Address' });
  
  validateRegisters(registers);
  return registers;
}

function validateRegisters(registers: Register[]): void {
  const page_size = 4096;
  const getReg = (name: string) => registers.find(r => r.name === name);
  const getField = (reg: Register | undefined, fieldName: string) => reg?.fields?.find(f => f.name.startsWith(fieldName));
  const addValidation = (item: Register | RegisterField, level: ValidationItem['level'], message: string) => {
    if (!item.validation) item.validation = [];
    item.validation.push({ level, message });
  };

  // --- Check Reserved Bits (Warning Level) ---
  registers.forEach(reg => {
    if (reg.fields) {
      reg.fields.forEach(field => {
        if (field.name.startsWith('Reserved') && field.raw > 0) {
          addValidation(field, 'warning', `Reserved bit(s) (${field.bits}) are not zero. (Value: ${toHex(field.raw, 2)})`);
        }
      });
    }
  });

  const capReg = getReg('CAP');
  const vsReg = getReg('VS');
  const ccReg = getReg('CC');
  const aqaReg = getReg('AQA');
  const cstsReg = getReg('CSTS');

  if (!capReg || !vsReg || !ccReg || !aqaReg || !cstsReg) {
    throw new Error('Required registers not found');
  }

  // --- Initial Health Check ---
  if (capReg.value === 0n || capReg.value === 0xFFFFFFFFFFFFFFFFn) {
    addValidation(capReg, 'error', 'CAP register has an invalid value. This may indicate a problem communicating with the device.');
  }
  if (vsReg.value === 0xFFFFFFFF) {
    addValidation(vsReg, 'error', 'VS register has an invalid value.');
  }
  const cstsCfs = getField(cstsReg, 'CFS');
  if (cstsCfs?.raw === 1) {
    addValidation(cstsCfs, 'error', 'Controller is reporting a fatal status (CFS=1). A reset is required.');
  }
  const cstsRdy = getField(cstsReg, 'RDY');
  if (cstsRdy?.raw === 1) {
    addValidation(cstsRdy, 'info', 'The controller is reporting that it is ready to process commands (RDY = 1).');
  }
  
  // --- Configuration Consistency Checks ---
  const mpsMin = getField(capReg, 'MPSMIN')?.raw as bigint;
  const mpsMax = getField(capReg, 'MPSMAX')?.raw as bigint;
  const mps = getField(ccReg, 'MPS');
  if (mps && mpsMin !== undefined && mpsMax !== undefined) {
    if (mps.raw < mpsMin || mps.raw > mpsMax) {
      addValidation(mps, 'error', `The selected Memory Page Size (${mps.value}) is outside the controller's capabilities (MPSMIN/MAX).`);
    }
  }

  const capCssNvm = getField(capReg, 'CSS (NVM)');
  const ccCss = getField(ccReg, 'CSS');
  if (ccCss && capCssNvm) {
    if (ccCss.raw === 0 && !capCssNvm.raw) {
      addValidation(ccCss, 'error', `NVM Command Set was selected, but it is not supported by CAP.CSS.`);
    } else if (ccCss.raw > 0x7) {
      addValidation(ccCss, 'warning', `An undefined I/O Command Set (>${toHex(7,1)}) was selected.`);
    }
  }
  
  const ccShn = getField(ccReg, 'SHN');
  if (ccShn?.raw === 3) {
    addValidation(ccShn, 'warning', `A reserved shutdown notification value (3) is set.`);
  }
  const cstsShst = getField(cstsReg, 'SHST');
  if (cstsShst?.raw === 3) {
    addValidation(cstsShst, 'warning', `Controller is in a reserved shutdown state (3).`);
  }

  const mqes = getField(capReg, 'MQES')?.raw as bigint;
  const asqs = getField(aqaReg, 'ASQS');
  const acqs = getField(aqaReg, 'ACQS');
  if (asqs && mqes !== undefined) {
    if (asqs.raw > mqes) {
      addValidation(asqs, 'error', `ASQS (${Number(asqs.raw) + 1}) exceeds the controller's maximum queue entries (CAP.MQES: ${Number(mqes) + 1}).`);
    }
    if (asqs.raw === 0) addValidation(asqs, 'error', `ASQS must not be zero.`);
  }
  if (acqs && mqes !== undefined) {
    if (acqs.raw > mqes) {
      addValidation(acqs, 'error', `ACQS (${Number(acqs.raw) + 1}) exceeds the controller's maximum queue entries (CAP.MQES: ${Number(mqes) + 1}).`);
    }
    if (acqs.raw === 0) addValidation(acqs, 'error', `ACQS must not be zero.`);
  }
   
  if (mps) {
    const mpsVal = page_size * (2 ** Number(mps.raw));
    const asqReg = getReg('ASQ');
    const acqReg = getReg('ACQ');
    if (asqReg && typeof asqReg.value === 'bigint' && asqReg.value % BigInt(mpsVal) !== 0n) {
      addValidation(asqReg, 'error', `ASQ address (${toHex(asqReg.value, 16)}) is not aligned to the Memory Page Size (${mpsVal}B).`);
    }
    if (acqReg && typeof acqReg.value === 'bigint' && acqReg.value % BigInt(mpsVal) !== 0n) {
      addValidation(acqReg, 'error', `ACQ address (${toHex(acqReg.value, 16)}) is not aligned to the Memory Page Size (${mpsVal}B).`);
    }
  }
}