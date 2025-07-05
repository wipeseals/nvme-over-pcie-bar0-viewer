import { parseInput, parseHexDump, parseBinaryFile } from '../src/core';

describe('NVMe Parser Core', () => {
  const testHexDump = `00000000: ff ff 03 3c 30 00 00 00 00 04 01 00 00 00 00 00
00000010: 00 00 00 00 01 40 46 00 00 00 00 00 09 00 00 00
00000020: 00 00 00 00 1f 00 1f 00 00 c0 a4 ff 00 00 00 00
00000030: 00 d0 a4 ff 00 00 00 00 00 00 00 00 00 00 00 00`;

  describe('parseHexDump', () => {
    it('should parse valid hex dump format', () => {
      const result = parseHexDump(testHexDump);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(64);
      expect(result[0]).toBe(0xff);
      expect(result[1]).toBe(0xff);
      expect(result[2]).toBe(0x03);
      expect(result[3]).toBe(0x3c);
    });

    it('should handle hex dump without addresses', () => {
      const simpleHex = 'ff ff 03 3c 30 00 00 00';
      const result = parseHexDump(simpleHex);
      expect(result.length).toBe(8);
      expect(result[0]).toBe(0xff);
    });

    it('should throw error for invalid hex characters', () => {
      const invalidHex = '00000000: ff gg 03 3c';
      expect(() => parseHexDump(invalidHex)).toThrow('invalid hexadecimal characters');
    });
  });

  describe('parseBinaryFile', () => {
    it('should parse binary buffer', () => {
      const buffer = Buffer.from([0xff, 0xff, 0x03, 0x3c, 0x30, 0x00, 0x00, 0x00]);
      const result = parseBinaryFile(buffer);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(8);
      expect(result[0]).toBe(0xff);
    });
  });

  describe('parseInput', () => {
    it('should parse hex dump string input', () => {
      const result = parseInput(testHexDump);
      expect(result.registers).toBeDefined();
      expect(result.bytes).toBeDefined();
      expect(result.registers.length).toBeGreaterThan(0);
      expect(result.bytes.length).toBe(64);
    });

    it('should parse binary buffer input', () => {
      // Create a 64-byte buffer with test data
      const buffer = Buffer.alloc(64);
      buffer[0] = 0xff;
      buffer[1] = 0xff;
      buffer[2] = 0x03;
      buffer[3] = 0x3c;
      buffer[4] = 0x30;
      // Set version register at offset 8
      buffer[8] = 0x00;
      buffer[9] = 0x04;
      buffer[10] = 0x01;
      buffer[11] = 0x00;
      
      const result = parseInput(buffer);
      expect(result.registers).toBeDefined();
      expect(result.bytes).toBeDefined();
      expect(result.registers.length).toBeGreaterThan(0);
    });

    it('should throw error for insufficient data', () => {
      const shortData = '00000000: ff ff 03 3c';
      expect(() => parseInput(shortData)).toThrow('At least 64 bytes are required');
    });

    it('should validate CAP register parsing', () => {
      const result = parseInput(testHexDump);
      const capReg = result.registers.find(r => r.name === 'CAP');
      expect(capReg).toBeDefined();
      expect(capReg?.offset).toBe(0x00);
      expect(capReg?.size).toBe(8);
      expect(capReg?.fields).toBeDefined();
      expect(capReg?.fields?.length).toBeGreaterThan(0);
      
      // Check specific fields
      const mqesField = capReg?.fields?.find(f => f.name === 'MQES');
      expect(mqesField).toBeDefined();
      expect(mqesField?.value).toContain('entries');
    });

    it('should validate VS register parsing', () => {
      const result = parseInput(testHexDump);
      const vsReg = result.registers.find(r => r.name === 'VS');
      expect(vsReg).toBeDefined();
      expect(vsReg?.offset).toBe(0x08);
      expect(vsReg?.size).toBe(4);
      expect(vsReg?.description).toBe('NVM Express Specification Version');
    });

    it('should include validation messages', () => {
      const result = parseInput(testHexDump);
      const cstsReg = result.registers.find(r => r.name === 'CSTS');
      const rdyField = cstsReg?.fields?.find(f => f.name === 'RDY');
      
      // RDY field should have info validation when ready
      if (rdyField?.raw === 1) {
        expect(rdyField.validation).toBeDefined();
        expect(rdyField.validation?.some(v => v.level === 'info')).toBe(true);
      }
    });
  });
});