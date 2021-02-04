'use strict';

var hex = function(value, len) {
  return ("00000000" + (value >>> 0).toString(16)).substr(-(len || 8));
}

String.prototype.endsWith = function(suffix) {
  return this.indexOf(suffix, this.length - suffix.length) !== -1;
};


var log = function () { 
  console.log.call(console, ('000000000000'+(cpu.totalCycles+cpu.cycles)).substr(-12)+']', Array.prototype.slice.call(arguments).join(''));
}

var cpu = {
  'cause' : 0,
  'cop': new Uint32Array(32),
  'cycles': 0,
  'epc' : 0,
  'gpr': new Int32Array(32),
  'hi' : 0,
  'imask' : 0,
  'istat' : 0,
  'icurr' : 0,
  'lo' : 0,
  'pc' : 0,
  'sr' : 0,
  'totalCycles': 0,

  getCtrl: function(reg) {
    switch (reg) {
      case 12:  return this.sr;
      case 13:  return this.cause;
      case 14:  return this.epc;
      case 15:  return 2;
      default:  //abort('getCtrl:' + reg);
    }
  },

  setCtrl: function(reg, value) {
    this.cop[reg] = value >>> 0
    switch (reg) {
      case  3:  break;
      case  5:  break;
      case  6:  break;
      case  7:  break;
      case  9:  break;
      case 11:  break;
      case 12:  this.sr = value; break;
      case 13:  this.cause = this.cause & 0xfffffcff;
                this.cause |= (value & 0x00000300); 
                break;
      default:  //abort('setCtrl:' + reg);
    }
  },

  rfe: function() {
    this.sr = (this.sr & ~0x0F) | ((this.sr >> 2) & 0x0F);
  },

  lwl: function(reg, addr) {
    var data = memRead32((addr & ~3) & 0x01ffffff);
    switch (addr & 3) {
      case 0: this.gpr[reg] = (this.gpr[reg] & 0x00FFFFFF) | (data << 24); break;
      case 1: this.gpr[reg] = (this.gpr[reg] & 0x0000FFFF) | (data << 16); break;
      case 2: this.gpr[reg] = (this.gpr[reg] & 0x000000FF) | (data <<  8); break;
      case 3: this.gpr[reg] = (this.gpr[reg] & 0x00000000) | (data <<  0); break;
    };
  },

  lwr: function(reg, addr) {
    var data = memRead32((addr & ~3) & 0x01ffffff);
    switch (addr & 3) {
      case 0: this.gpr[reg] = (this.gpr[reg] & 0x00000000) | (data >>>  0); break;
      case 1: this.gpr[reg] = (this.gpr[reg] & 0xFF000000) | (data >>>  8); break;
      case 2: this.gpr[reg] = (this.gpr[reg] & 0xFFFF0000) | (data >>> 16); break;
      case 3: this.gpr[reg] = (this.gpr[reg] & 0xFFFFFF00) | (data >>> 24); break;
    };
  },

  swl: function(reg, addr) {
    var data = memRead32((addr & ~3) & 0x01ffffff) >>> 0;
    switch (addr & 3) {
      case 0: data = (data & 0xFFFFFF00) | (this.gpr[reg] >>> 24); break;
      case 1: data = (data & 0xFFFF0000) | (this.gpr[reg] >>> 16); break;
      case 2: data = (data & 0xFF000000) | (this.gpr[reg] >>>  8); break;
      case 3: data = (data & 0x00000000) | (this.gpr[reg] >>>  0); break;
    };
    memWrite32((addr & ~3) & 0x01ffffff, data);
  },

  swr: function(reg, addr) {
    var data = memRead32((addr & ~3) & 0x01ffffff) >>> 0;
    switch (addr & 3) {
      case 0: data = (data & 0x00000000) | (this.gpr[reg] <<  0); break;
      case 1: data = (data & 0x000000FF) | (this.gpr[reg] <<  8); break;
      case 2: data = (data & 0x0000FFFF) | (this.gpr[reg] << 16); break;
      case 3: data = (data & 0x00FFFFFF) | (this.gpr[reg] << 24); break;
    };
    memWrite32((addr & ~3) & 0x01ffffff, data);
  },


  neg: function(a) {
    var a00 = (a >>  0) & 0xffff;
    var a16 = (a >> 16) & 0xffff;

    var v = (~a00 & 0xFFFF ) + 1;
    a00 = v & 0xFFFF;
    v = (~a16 & 0xFFFF) + (v >>> 16);
    a16 = v & 0xFFFF;

    return (a16 << 16) | a00;
  },

  mult: function(a, b)	{
    a >>= 0; b >>= 0;
    var n = 0;
    if (a < 0) { n ^= 1; a = this.neg(a); }
    if (b < 0) { n ^= 1; b = this.neg(b); }
    this.multu(a, b);
    if (n === 1) {
      var a00 = (this.lo >>>  0) & 0xffff;
      var a16 = (this.lo >>> 16) & 0xffff;
      var a32 = (this.hi >>>  0) & 0xffff;
      var a48 = (this.hi >>> 16) & 0xffff;

      var v = (~a00 & 0xFFFF ) + 1;
      a00 = v & 0xFFFF;
      v = (~a16 & 0xFFFF) + (v >>> 16);
      a16 = v & 0xFFFF;
      v = (~a32 & 0xFFFF) + (v >>> 16);
      a32 = v & 0xFFFF;
      v = (~a48 & 0xFFFF) + (v >>> 16);
      a48 = v & 0xFFFF;

      this.hi = ((a48 << 16) | a32) >> 0;
      this.lo = ((a16 << 16) | a00) >>> 0;
    }
  },

  multu: function(a, b)	{
    a >>>= 0; b >>>= 0;
    var a00 = a & 0xffff;
    var a16 = a >>> 16;
    var b00 = b & 0xffff;
    var b16 = b >>> 16;

    var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
    c00 += (a00 * b00);
    c16 += (c00 >>> 16);
    c00 &= 0xFFFF;

    c16 += (a00 * b16);
    c32 += (c16 >>> 16);
    c16 &= 0xFFFF;

    c16 += (a16 * b00);
    c32 += (c16 >>> 16);
    c16 &= 0xFFFF;

    c32 += (a16 * b16);
    c48 += (c32 >>> 16);
    c32 &= 0xFFFF;

    this.hi = ((c48 << 16) | c32) >>> 0;
    this.lo = ((c16 << 16) | c00) >>> 0;
  },

  div: function(a, b) {
    if (b === 0) {
      if ((a >> 0) >= 0) {
        this.hi = a;
        this.lo = 0xffffffff;
      }
      else {
        this.hi = a;
        this.lo = 0x00000001;
      }
    }
    else
    if (((b >> 0) === -1) && ((a >>> 0) === 0x80000000)){
        this.hi = 0 >> 0;
        this.lo = 0x80000000 >> 0;
    }
    else {
      this.hi = ((a >> 0) % (b >> 0)) >> 0;
      this.lo = ((a >> 0) / (b >> 0)) >> 0;
    }
  },

  divu: function(a, b) {
    if (b === 0) {
      this.hi = a;
      this.lo = 0xffffffff;
    }
    else {
      this.hi = ((a >>> 0) % (b >>> 0)) >>> 0;
      this.lo = ((a >>> 0) / (b >>> 0)) >>> 0;
    }
  }
};

const cache = new Array(0x02000000 >> 2);
cache.fill(null);

var cpuException = function(id, pc) {
  cpu.sr    = (cpu.sr & ~0x3F) | ((cpu.sr << 2) & 0x3F);
  cpu.cause = (cpu.cause & ~0x7C) | id;
  cpu.epc   = pc;
  //console.error(hex(cpu.pc));
  cpu.pc    = 0x80000080;// & 0x01ffffff;
}

var cpuInterrupt = function() {
  if ((cpu.sr & 1) === 1) {
    let ip = cpu.cause & 0x300;
    let im = cpu.sr & 0x300;
    if ((ip & im) !== 0) {
      cpuException((ip & im), cpu.pc);
      return true;
    }
    else
    if ((cpu.sr & 0x400) === 0x400) {
      if (cpu.istat & cpu.imask) {
        // log('cpuInterrupt:', hex(cpu.istat & cpu.imask));
        cpuException(0x400, cpu.pc);
        return true;
      }
    }
  }
  return false;
}

var getCacheIndex = function(pc) {
  pc = pc & 0x01ffffff;
  if (pc < 0x800000) pc &= 0x1fffff;
  return pc >>> 2;
}

var clearCodeCache = function(addr, size) {
  addr = addr & 0x01ffffff;
  const base = (addr < 0x800000) ?  (addr & 0x1fffff) >>> 2 : addr >>> 2;
  const words = !size ? 1 : size >>> 2;

  for (let i = 0; i < words; ++i) {
    // if (cache[base + i]) console.warn(`cache-clean: $${((base + i) << 2).toString(16)}`)
    cache[base + i] = null;
  }
}

var recompile = function(pc) {
  var lutIndex = getCacheIndex(pc)
  if (cache[lutIndex]) {
    return cache[lutIndex];
  }

  var dynamic = compileBlock(pc);
  cache[lutIndex] = dynamic; // comment out for testing recompiler faults (dead slow though)
  return dynamic;
}

function update(cycles) {
  var endOfFrame = false;

  cdr.advance(cycles);
  mdc.update(cycles);
  spu.advance(cycles);
  joy.update(cycles);
  endOfFrame = gpu.advance(cycles);

  rc0.advance(cycles);
  rc1.advance(cycles);
  rc2.advance(cycles);

  dma.advance(cycles);

  return endOfFrame;
}

let statsCycles = 33868800;
let statInts = 0;

const CYCLES_PER_BLOCK = 128; // ~3.78 us