class BitSerializer {
  constructor(buffer = Buffer.alloc(64)) {
    this.buffer = buffer;
    this.readPosition = 0;
    this.writePosition = 0;
  }

  readBool() { return this.readByte() === 1; }
  readByte() { return this.buffer.readUInt8(this.readPosition++); }
  readInt16() {
    const value = this.buffer.readInt16LE(this.readPosition);
    this.readPosition += 2;
    return value;
  }

  readInt32() {
    if (this.readPosition + 4 > this.buffer.length) {
      throw new Error(`Buffer underrun: Tried to read Int32 at position ${this.readPosition} in a buffer of length ${this.buffer.length}`);
    }
    const value = this.buffer.readInt32LE(this.readPosition);
    this.readPosition += 4;
    return value;
  }
  
  readInt64() {
    const value = this.buffer.readBigInt64LE(this.readPosition);
    this.readPosition += 8;
    return value;
  }
  readString() {
    const length = this.readInt16();
    const value = this.buffer.toString('utf8', this.readPosition, this.readPosition + length);
    this.readPosition += length;
    return value;
  }

  writeBool(value) { this.writeByte(value ? 1 : 0); }
  writeByte(value) {
    this.ensureCapacity(1);
    this.buffer.writeUInt8(value, this.writePosition++);
  }
  writeInt16(value) {
    this.ensureCapacity(2);
    this.buffer.writeInt16LE(value, this.writePosition);
    this.writePosition += 2;
  }
  writeInt32(value) {
    this.ensureCapacity(4);
    this.buffer.writeInt32LE(value, this.writePosition);
    this.writePosition += 4;
  }
  writeInt64(value) {
    this.ensureCapacity(8);
    this.buffer.writeBigInt64LE(BigInt(value), this.writePosition);
    this.writePosition += 8;
  }
  writeString(value) {
    const strBuffer = Buffer.from(value, 'utf8');
    this.writeInt16(strBuffer.length);
    this.ensureCapacity(strBuffer.length);
    strBuffer.copy(this.buffer, this.writePosition);
    this.writePosition += strBuffer.length;
  }

  ensureCapacity(additionalBytes) {
    if (this.writePosition + additionalBytes > this.buffer.length) {
      const newBuffer = Buffer.alloc(Math.max(this.buffer.length * 2, this.writePosition + additionalBytes));
      this.buffer.copy(newBuffer);
      this.buffer = newBuffer;
    }
  }

  getData() { return this.buffer.slice(0, this.writePosition); }
}

module.exports = BitSerializer;