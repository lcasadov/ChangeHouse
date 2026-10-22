import { describe, expect, it } from 'vitest';

import { parsePoint } from './geography.js';

/** EWKB de un punto, tal como lo devuelve PostGIS para una columna `geography`. */
function ewkb(lng: number, lat: number, options: { bigEndian?: boolean; srid?: boolean } = {}) {
  const { bigEndian = false, srid = true } = options;
  const buffer = Buffer.alloc(1 + 4 + (srid ? 4 : 0) + 16);
  let offset = 0;
  buffer.writeUInt8(bigEndian ? 0 : 1, offset++);
  const type = srid ? 0x20000001 : 1;
  if (bigEndian) buffer.writeUInt32BE(type, offset);
  else buffer.writeUInt32LE(type, offset);
  offset += 4;
  if (srid) {
    if (bigEndian) buffer.writeUInt32BE(4326, offset);
    else buffer.writeUInt32LE(4326, offset);
    offset += 4;
  }
  if (bigEndian) {
    buffer.writeDoubleBE(lng, offset);
    buffer.writeDoubleBE(lat, offset + 8);
  } else {
    buffer.writeDoubleLE(lng, offset);
    buffer.writeDoubleLE(lat, offset + 8);
  }
  return buffer.toString('hex');
}

describe('parsePoint', () => {
  it('lee longitud y latitud de un EWKB little endian con SRID', () => {
    expect(parsePoint(ewkb(-3.7058, 40.4254))).toEqual({ lat: 40.4254, lng: -3.7058 });
  });

  it('lee un EWKB big endian y uno sin SRID', () => {
    expect(parsePoint(ewkb(-3.7058, 40.4254, { bigEndian: true }))).toEqual({
      lat: 40.4254,
      lng: -3.7058,
    });
    expect(parsePoint(ewkb(2.5, -1.25, { srid: false }))).toEqual({ lat: -1.25, lng: 2.5 });
  });

  it('rechaza lo que no es un punto', () => {
    expect(() => parsePoint('00')).toThrow(/punto/);
    expect(() => parsePoint('')).toThrow(/punto/);
  });
});
