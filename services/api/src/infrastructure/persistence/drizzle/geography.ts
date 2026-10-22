import { type SQL, sql } from 'drizzle-orm';

export interface GeoPoint {
  lat: number;
  lng: number;
}

const WGS84 = 4326;
const SRID_FLAG = 0x20000000;
const POINT_TYPE = 1;
const TYPE_MASK = 0xff;
const HEADER_BYTES = 5;
const SRID_BYTES = 4;
const COORDINATE_BYTES = 8;

/** Escritura de un punto en una columna `geography(Point, 4326)`. */
export function pointSql(point: GeoPoint): SQL {
  return sql`ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), ${WGS84})::geography`;
}

/** Lectura de un punto: PostGIS entrega las columnas `geography` como EWKB en hexadecimal. */
export function parsePoint(hex: string): GeoPoint {
  const bytes = Buffer.from(hex, 'hex');
  if (bytes.length < HEADER_BYTES) throw new Error('El valor geográfico no es un punto');
  const littleEndian = bytes[0] === 1;
  const type = littleEndian ? bytes.readUInt32LE(1) : bytes.readUInt32BE(1);
  if ((type & TYPE_MASK) !== POINT_TYPE) throw new Error('El valor geográfico no es un punto');
  const offset = HEADER_BYTES + (type & SRID_FLAG ? SRID_BYTES : 0);
  const read = (at: number) => (littleEndian ? bytes.readDoubleLE(at) : bytes.readDoubleBE(at));
  return { lng: read(offset), lat: read(offset + COORDINATE_BYTES) };
}
