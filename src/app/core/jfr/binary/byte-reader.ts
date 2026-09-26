/**
 * Low-level cursor over a JFR chunk's bytes.
 *
 * JFR fixed-width fields are big-endian. Compressed ("varint") integers are a
 * non-zigzag LEB128 variant: 7 payload bits per byte (continuation in bit 7),
 * up to 8 such bytes, then an optional 9th byte contributing its full 8 bits
 * with no continuation check (64 bits total, matching a Java long/int/short's
 * raw two's-complement bit pattern zero-extended to 64 bits).
 */
export class ByteReader {
  private readonly view: DataView;
  private readonly bytes: Uint8Array;
  pos: number;

  constructor(buffer: ArrayBuffer, byteOffset = 0, byteLength?: number) {
    this.view = new DataView(buffer, byteOffset, byteLength);
    this.bytes = new Uint8Array(buffer, byteOffset, byteLength);
    this.pos = 0;
  }

  get length(): number {
    return this.view.byteLength;
  }

  seek(pos: number): void {
    this.pos = pos;
  }

  skip(n: number): void {
    this.pos += n;
  }

  private need(n: number): void {
    if (this.pos + n > this.view.byteLength) {
      throw new Error(`JFR parse error: attempted to read ${n} bytes at offset ${this.pos}, but buffer ends at ${this.view.byteLength}`);
    }
  }

  readU8(): number {
    this.need(1);
    const v = this.view.getUint8(this.pos);
    this.pos += 1;
    return v;
  }

  readI8(): number {
    this.need(1);
    const v = this.view.getInt8(this.pos);
    this.pos += 1;
    return v;
  }

  readRawI16(): number {
    this.need(2);
    const v = this.view.getInt16(this.pos, false);
    this.pos += 2;
    return v;
  }

  readRawI32(): number {
    this.need(4);
    const v = this.view.getInt32(this.pos, false);
    this.pos += 4;
    return v;
  }

  readRawI64(): bigint {
    this.need(8);
    const v = this.view.getBigInt64(this.pos, false);
    this.pos += 8;
    return v;
  }

  readRawF32(): number {
    this.need(4);
    const v = this.view.getFloat32(this.pos, false);
    this.pos += 4;
    return v;
  }

  readRawF64(): number {
    this.need(8);
    const v = this.view.getFloat64(this.pos, false);
    this.pos += 8;
    return v;
  }

  readBytes(n: number): Uint8Array {
    this.need(n);
    const out = this.bytes.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }

  /**
   * Reads the raw unsigned bit-pattern accumulator shared by all compressed
   * integer widths. The caller reinterprets the low N bits as a signed value
   * of whatever width the field actually declares (see asSigned* below).
   */
  private readVarintRaw(): bigint {
    let acc = 0n;
    for (let i = 0; i < 8; i++) {
      this.need(1);
      const b = this.view.getUint8(this.pos);
      this.pos += 1;
      acc |= BigInt(b & 0x7f) << BigInt(7 * i);
      if ((b & 0x80) === 0) {
        return acc;
      }
    }
    // 9th byte: contributes its full 8 bits, no continuation check.
    this.need(1);
    const last = this.view.getUint8(this.pos);
    this.pos += 1;
    acc |= BigInt(last) << 56n;
    return acc;
  }

  /** Reads a compressed integer and reinterprets it as a signed 32-bit value (int, or narrower: short/byte/char/boolean when compressed). */
  readVarInt32(): number {
    const acc = this.readVarintRaw();
    return Number(BigInt.asIntN(32, acc));
  }

  /** Reads a compressed integer and reinterprets it as a signed 64-bit value (long), returned as bigint to avoid precision loss. */
  readVarInt64(): bigint {
    const acc = this.readVarintRaw();
    return BigInt.asIntN(64, acc);
  }

  /** Reads a compressed 16-bit value (short), or a raw one if `compressed` is false. */
  readShort(compressed: boolean): number {
    return compressed ? Number(BigInt.asIntN(16, this.readVarintRaw())) : this.readRawI16();
  }

  /** Reads an int32-ish field (int/char/boolean all fit here at the wire level), honoring the chunk's compression flag. */
  readInt(compressed: boolean): number {
    return compressed ? this.readVarInt32() : this.readRawI32();
  }

  /** Reads an int64-ish field (long), honoring the chunk's compression flag. */
  readLong(compressed: boolean): bigint {
    return compressed ? this.readVarInt64() : this.readRawI64();
  }

  readByte(): number {
    // byte/int8 is always raw, never compressed, per the JFR format.
    return this.readI8();
  }

  readBoolean(compressed: boolean): boolean {
    return this.readInt(compressed) !== 0;
  }

  readFloat(): number {
    // float/double are always raw, never compressed.
    return this.readRawF32();
  }

  readDouble(): number {
    return this.readRawF64();
  }

  /** Reads a `char` (UTF-16 code unit), honoring the chunk's compression flag. */
  readChar(compressed: boolean): number {
    return compressed ? this.readVarInt32() & 0xffff : this.readRawI16() & 0xffff;
  }

  private static utf8Decoder = new TextDecoder('utf-8');
  private static latin1Decoder = new TextDecoder('latin1');

  /**
   * Reads a JFR-encoded string. Returns either a plain string, or (for mode 2,
   * "constant pool reference") a `{ poolRef: index }` marker the caller must
   * resolve against the String class's own constant pool.
   */
  readEncodedString(compressed: boolean): string | { poolRef: number } {
    const mode = this.readByte();
    switch (mode) {
      case 0: // null
        return '';
      case 1: // empty
        return '';
      case 2: {
        // constant-pool reference: a compressed long index
        const idx = this.readLong(compressed);
        return { poolRef: Number(idx) };
      }
      case 3: {
        // UTF-8 byte array
        const len = this.readInt(compressed);
        const bytes = this.readBytes(len);
        return ByteReader.utf8Decoder.decode(bytes);
      }
      case 4: {
        // char array
        const len = this.readInt(compressed);
        const codes = new Array<number>(len);
        for (let i = 0; i < len; i++) codes[i] = this.readChar(compressed);
        return codesToString(codes);
      }
      case 5: {
        // Latin-1 byte array
        const len = this.readInt(compressed);
        const bytes = this.readBytes(len);
        return ByteReader.latin1Decoder.decode(bytes);
      }
      default:
        throw new Error(`JFR parse error: unknown string encoding mode ${mode} at offset ${this.pos}`);
    }
  }
}

function codesToString(codes: number[]): string {
  const CHUNK = 8192;
  if (codes.length <= CHUNK) return String.fromCharCode(...codes);
  let out = '';
  for (let i = 0; i < codes.length; i += CHUNK) {
    out += String.fromCharCode(...codes.slice(i, i + CHUNK));
  }
  return out;
}
