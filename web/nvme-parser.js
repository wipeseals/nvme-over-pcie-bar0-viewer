"use strict";
var NVMeParser = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/core.ts
  var core_exports = {};
  __export(core_exports, {
    parseAndValidateNvmeRegisters: () => parseAndValidateNvmeRegisters,
    parseBinaryFile: () => parseBinaryFile,
    parseHexDump: () => parseHexDump,
    parseInput: () => parseInput,
    readU32: () => readU32,
    readU64: () => readU64,
    toHex: () => toHex
  });

  // src/parser.ts
  var readU32 = (bytes, offset) => new DataView(bytes.buffer).getUint32(offset, true);
  var readU64 = (bytes, offset) => new DataView(bytes.buffer).getBigUint64(offset, true);
  var toHex = (val, pad) => "0x" + val.toString(16).padStart(pad, "0").toUpperCase();
  function parseHexDump(text) {
    const hexContent = text.split("\n").map((line) => {
      const colonIndex = line.indexOf(":");
      return colonIndex >= 0 ? line.split(":")[1] || "" : line;
    }).join(" ");
    const hexParts = hexContent.trim().split(/\s+/).filter((p) => p);
    const fullHexString = hexParts.map((p) => p.padStart(2, "0")).join("");
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
  function parseBinaryFile(buffer) {
    return new Uint8Array(buffer);
  }
  function parseAndValidateNvmeRegisters(bytes) {
    const registers = [];
    const page_size = 4096;
    const cap = readU64(bytes, 0);
    registers.push({
      offset: 0,
      size: 8,
      name: "CAP",
      value: cap,
      description: "Controller Capabilities",
      fields: [
        { name: "MQES", bits: "15:0", raw: cap & 0xFFFFn, value: `${Number(cap & 0xFFFFn) + 1} entries` },
        { name: "CQR", bits: "16", raw: cap >> 16n & 1n, value: cap & 1n << 16n ? "Yes" : "No" },
        { name: "AMS (WRR)", bits: "17", raw: cap >> 17n & 1n, value: `Weighted Round Robin: ${cap >> 17n & 1n ? "Supported" : "Not Supported"}` },
        { name: "AMS (VS)", bits: "18", raw: cap >> 18n & 1n, value: `Vendor Specific: ${cap >> 18n & 1n ? "Supported" : "Not Supported"}` },
        { name: "Reserved0", bits: "23:19", raw: cap >> 19n & 0x1Fn },
        { name: "TO", bits: "31:24", raw: cap >> 24n & 0xFFn, value: `${Number(cap >> 24n & 0xFFn) * 500} ms` },
        { name: "DSTRD", bits: "35:32", raw: cap >> 32n & 0xFn, value: `${4 << Number(cap >> 32n & 0xFn)} bytes` },
        { name: "NSSRS", bits: "36", raw: cap >> 36n & 1n, value: cap >> 36n & 1n ? "Yes" : "No" },
        { name: "CSS (NVM)", bits: "37", raw: cap >> 37n & 1n, value: `NVM Command Set: ${cap >> 37n & 1n ? "Supported" : "Not Supported"}` },
        { name: "Reserved1", bits: "44:38", raw: cap >> 38n & 0x7Fn },
        { name: "BPS", bits: "45", raw: cap >> 45n & 1n, value: cap >> 45n & 1n ? "Yes" : "No" },
        { name: "Reserved2", bits: "47:46", raw: cap >> 46n & 0x3n },
        { name: "MPSMIN", bits: "51:48", raw: cap >> 48n & 0xFn, value: `${page_size * 2 ** Number(cap >> 48n & 0xFn)} B` },
        { name: "MPSMAX", bits: "55:52", raw: cap >> 52n & 0xFn, value: `${page_size * 2 ** Number(cap >> 52n & 0xFn)} B` },
        { name: "Reserved3", bits: "63:56", raw: cap >> 56n & 0xFFn }
      ]
    });
    const vs = readU32(bytes, 8);
    registers.push({
      offset: 8,
      size: 4,
      name: "VS",
      value: vs,
      description: "NVM Express Specification Version",
      fields: [
        { name: "TER", bits: "7:0", raw: vs & 255, value: `${vs & 255}` },
        { name: "MNR", bits: "15:8", raw: vs >> 8 & 255, value: `${vs >> 8 & 255}` },
        { name: "MJR", bits: "31:16", raw: vs >> 16 & 65535, value: `${vs >> 16 & 65535}` }
      ]
    });
    registers.push({ offset: 12, size: 4, name: "INTMS", value: readU32(bytes, 12), description: "Interrupt Mask Set" });
    registers.push({ offset: 16, size: 4, name: "INTMC", value: readU32(bytes, 16), description: "Interrupt Mask Clear" });
    const cc = readU32(bytes, 20);
    const cc_shn_map = { 0: "No notification", 1: "Normal shutdown", 2: "Abrupt shutdown", 3: "Reserved" };
    registers.push({
      offset: 20,
      size: 4,
      name: "CC",
      value: cc,
      description: "Controller Configuration",
      fields: [
        { name: "EN", bits: "0", raw: cc & 1, value: cc & 1 ? "Enabled" : "Disabled" },
        { name: "Reserved0", bits: "3:1", raw: cc >> 1 & 7 },
        { name: "CSS", bits: "6:4", raw: cc >> 4 & 7, value: `${toHex(cc >> 4 & 7, 1)} (0=NVM)` },
        { name: "MPS", bits: "10:7", raw: cc >> 7 & 15, value: `${page_size * 2 ** (cc >> 7 & 15)} B` },
        { name: "AMS", bits: "13:11", raw: cc >> 11 & 7, value: `${toHex(cc >> 11 & 7, 1)} (0=WRR)` },
        { name: "SHN", bits: "15:14", raw: cc >> 14 & 3, value: `${cc_shn_map[cc >> 14 & 3]}` },
        { name: "IOSQES", bits: "19:16", raw: cc >> 16 & 15, value: `${2 ** (cc >> 16 & 15)} bytes` },
        { name: "IOCQES", bits: "23:20", raw: cc >> 20 & 15, value: `${2 ** (cc >> 20 & 15)} bytes` },
        { name: "Reserved1", bits: "31:24", raw: cc >> 24 & 255 }
      ]
    });
    const csts = readU32(bytes, 28);
    const csts_shst_map = { 0: "Normal", 1: "Shutdown occurring", 2: "Shutdown complete", 3: "Reserved" };
    registers.push({
      offset: 28,
      size: 4,
      name: "CSTS",
      value: csts,
      description: "Controller Status",
      fields: [
        { name: "RDY", bits: "0", raw: csts & 1, value: csts & 1 ? "Ready" : "Not ready" },
        { name: "CFS", bits: "1", raw: csts >> 1 & 1, value: csts >> 1 & 1 ? "Fatal error" : "No fatal error" },
        { name: "SHST", bits: "3:2", raw: csts >> 2 & 3, value: `${csts_shst_map[csts >> 2 & 3]}` },
        { name: "NSSRO", bits: "4", raw: csts >> 4 & 1, value: csts >> 4 & 1 ? "Reset occurred" : "No reset" },
        { name: "PP", bits: "5", raw: csts >> 5 & 1, value: csts >> 5 & 1 ? "Paused" : "Not paused" },
        { name: "Reserved0", bits: "31:6", raw: csts >> 6 }
      ]
    });
    registers.push({ offset: 32, size: 4, name: "NSSR", value: "N/A", description: "NVM Subsystem Reset (Write-Only)" });
    const aqa = readU32(bytes, 36);
    registers.push({
      offset: 36,
      size: 4,
      name: "AQA",
      value: aqa,
      description: "Admin Queue Attributes",
      fields: [
        { name: "ASQS", bits: "11:0", raw: aqa & 4095, value: `${(aqa & 4095) + 1} entries` },
        { name: "Reserved0", bits: "15:12", raw: aqa >> 12 & 15 },
        { name: "ACQS", bits: "27:16", raw: aqa >> 16 & 4095, value: `${(aqa >> 16 & 4095) + 1} entries` },
        { name: "Reserved1", bits: "31:28", raw: aqa >> 28 & 15 }
      ]
    });
    registers.push({ offset: 40, size: 8, name: "ASQ", value: readU64(bytes, 40), description: "Admin Submission Queue Base Address" });
    registers.push({ offset: 48, size: 8, name: "ACQ", value: readU64(bytes, 48), description: "Admin Completion Queue Base Address" });
    validateRegisters(registers);
    return registers;
  }
  function validateRegisters(registers) {
    const page_size = 4096;
    const getReg = (name) => registers.find((r) => r.name === name);
    const getField = (reg, fieldName) => reg?.fields?.find((f) => f.name.startsWith(fieldName));
    const addValidation = (item, level, message) => {
      if (!item.validation)
        item.validation = [];
      item.validation.push({ level, message });
    };
    registers.forEach((reg) => {
      if (reg.fields) {
        reg.fields.forEach((field) => {
          if (field.name.startsWith("Reserved") && field.raw > 0) {
            addValidation(field, "warning", `Reserved bit(s) (${field.bits}) are not zero. (Value: ${toHex(field.raw, 2)})`);
          }
        });
      }
    });
    const capReg = getReg("CAP");
    const vsReg = getReg("VS");
    const ccReg = getReg("CC");
    const aqaReg = getReg("AQA");
    const cstsReg = getReg("CSTS");
    if (!capReg || !vsReg || !ccReg || !aqaReg || !cstsReg) {
      throw new Error("Required registers not found");
    }
    if (capReg.value === 0n || capReg.value === 0xFFFFFFFFFFFFFFFFn) {
      addValidation(capReg, "error", "CAP register has an invalid value. This may indicate a problem communicating with the device.");
    }
    if (vsReg.value === 4294967295) {
      addValidation(vsReg, "error", "VS register has an invalid value.");
    }
    const cstsCfs = getField(cstsReg, "CFS");
    if (cstsCfs?.raw === 1) {
      addValidation(cstsCfs, "error", "Controller is reporting a fatal status (CFS=1). A reset is required.");
    }
    const cstsRdy = getField(cstsReg, "RDY");
    if (cstsRdy?.raw === 1) {
      addValidation(cstsRdy, "info", "The controller is reporting that it is ready to process commands (RDY = 1).");
    }
    const mpsMin = getField(capReg, "MPSMIN")?.raw;
    const mpsMax = getField(capReg, "MPSMAX")?.raw;
    const mps = getField(ccReg, "MPS");
    if (mps && mpsMin !== void 0 && mpsMax !== void 0) {
      if (mps.raw < mpsMin || mps.raw > mpsMax) {
        addValidation(mps, "error", `The selected Memory Page Size (${mps.value}) is outside the controller's capabilities (MPSMIN/MAX).`);
      }
    }
    const capCssNvm = getField(capReg, "CSS (NVM)");
    const ccCss = getField(ccReg, "CSS");
    if (ccCss && capCssNvm) {
      if (ccCss.raw === 0 && !capCssNvm.raw) {
        addValidation(ccCss, "error", `NVM Command Set was selected, but it is not supported by CAP.CSS.`);
      } else if (ccCss.raw > 7) {
        addValidation(ccCss, "warning", `An undefined I/O Command Set (>${toHex(7, 1)}) was selected.`);
      }
    }
    const ccShn = getField(ccReg, "SHN");
    if (ccShn?.raw === 3) {
      addValidation(ccShn, "warning", `A reserved shutdown notification value (3) is set.`);
    }
    const cstsShst = getField(cstsReg, "SHST");
    if (cstsShst?.raw === 3) {
      addValidation(cstsShst, "warning", `Controller is in a reserved shutdown state (3).`);
    }
    const mqes = getField(capReg, "MQES")?.raw;
    const asqs = getField(aqaReg, "ASQS");
    const acqs = getField(aqaReg, "ACQS");
    if (asqs && mqes !== void 0) {
      if (asqs.raw > mqes) {
        addValidation(asqs, "error", `ASQS (${Number(asqs.raw) + 1}) exceeds the controller's maximum queue entries (CAP.MQES: ${Number(mqes) + 1}).`);
      }
      if (asqs.raw === 0)
        addValidation(asqs, "error", `ASQS must not be zero.`);
    }
    if (acqs && mqes !== void 0) {
      if (acqs.raw > mqes) {
        addValidation(acqs, "error", `ACQS (${Number(acqs.raw) + 1}) exceeds the controller's maximum queue entries (CAP.MQES: ${Number(mqes) + 1}).`);
      }
      if (acqs.raw === 0)
        addValidation(acqs, "error", `ACQS must not be zero.`);
    }
    if (mps) {
      const mpsVal = page_size * 2 ** Number(mps.raw);
      const asqReg = getReg("ASQ");
      const acqReg = getReg("ACQ");
      if (asqReg && typeof asqReg.value === "bigint" && asqReg.value % BigInt(mpsVal) !== 0n) {
        addValidation(asqReg, "error", `ASQ address (${toHex(asqReg.value, 16)}) is not aligned to the Memory Page Size (${mpsVal}B).`);
      }
      if (acqReg && typeof acqReg.value === "bigint" && acqReg.value % BigInt(mpsVal) !== 0n) {
        addValidation(acqReg, "error", `ACQ address (${toHex(acqReg.value, 16)}) is not aligned to the Memory Page Size (${mpsVal}B).`);
      }
    }
  }

  // src/core.ts
  function parseInput(input) {
    let bytes;
    if (typeof input === "string") {
      bytes = parseHexDump(input);
    } else {
      bytes = parseBinaryFile(input);
    }
    if (bytes.length < 64) {
      throw new Error(`Data is insufficient. At least 64 bytes are required, but only ${bytes.length} were found.`);
    }
    const registers = parseAndValidateNvmeRegisters(bytes);
    return {
      registers,
      bytes
    };
  }
  return __toCommonJS(core_exports);
})();
