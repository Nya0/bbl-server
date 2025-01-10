class BitSerializer {
    constructor(data = null) {
        this.inuse = true;
        this.max = 64;
        this.readPosition = 0;
        this.writePosition = 0;

        if (data) {
            this.buffer = Buffer.alloc(data.length);
            data.copy(this.buffer, 0, 0, data.length);
        } else {
            this.buffer = Buffer.alloc(this.max);
        }
    }

    get inUse() {
        return this.inuse;
    }

    get ReadPosition() {
        return this.readPosition;
    }

    set ReadPosition(value) {
        this.readPosition = value;
    }

    get WritePosition() {
        return this.writePosition;
    }

    set WritePosition(value) {
        this.writePosition = value;
    }

    get Buffer() {
        return this.buffer;
    }

    get Data() {
        const array = Buffer.alloc(this.writePosition);
        this.buffer.copy(array, 0, 0, this.writePosition);
        return array;
    }

    get BufferCount() {
        return this.Buffer.length;
    }

    increaseBuffer(value) {
        this.writePosition += value;
        if (!this.buffer) {
            this.buffer = Buffer.alloc(value + this.max);
        } else if (this.buffer.length < this.readPosition + value) {
            const newBuffer = Buffer.alloc(this.readPosition + value + this.max);
            this.buffer.copy(newBuffer);
            this.buffer = newBuffer;
        }
    }

    Check() {
        if (!this.inuse) {
            throw new Error("Serializer is not in use !!!");
        }
    }

    
    WriteByte(value) {
      this.Check();
      this.increaseBuffer(1);
      this.buffer[this.readPosition] = value;
      this.readPosition++;
    }

    WriteDirectly(values) {
        this.Check();
        this.increaseBuffer(values.length);
        values.copy(this.buffer, this.readPosition);
        this.readPosition += values.length;
    }

    WriteInt16(value) {
        this.Check();
        this.increaseBuffer(2);
        this.buffer.writeInt16LE(value, this.readPosition);
        this.readPosition += 2;
    }

    WriteUInt16(value) {
        this.Check();
        this.increaseBuffer(2);
        this.buffer.writeUInt16LE(value, this.readPosition);
        this.readPosition += 2;
    }

    WriteUInt32(value) {
        this.Check();
        this.increaseBuffer(4);
        this.buffer.writeUInt32LE(value, this.readPosition);
        this.readPosition += 4;
    }

    WriteInt32(value) {
        this.Check();
        this.increaseBuffer(4);
        this.buffer.writeInt32LE(value, this.readPosition);
        this.readPosition += 4;
    }

    WriteDouble(value) {
        this.Check();
        this.increaseBuffer(8);
        this.buffer.writeDoubleLE(value, this.readPosition);
        this.readPosition += 8;
    }

    WriteFloat(value) {
        this.Check();
        this.increaseBuffer(4);
        this.buffer.writeFloatLE(value, this.readPosition);
        this.readPosition += 4;
    }

    WriteInt64(value) {
        this.Check();
        this.increaseBuffer(8);
        this.buffer.writeBigInt64LE(BigInt(value), this.readPosition);
        this.readPosition += 8;
    }

    WriteUInt64(value) {
        this.Check();
        this.increaseBuffer(8);
        this.buffer.writeBigUInt64LE(BigInt(value), this.readPosition);
        this.readPosition += 8;
    }

    WriteBool(value) {
        this.Check();
        this.WriteByte(value ? 1 : 0);
    }

    WriteString(value) {
        console.log(`Before WriteString - readPos: ${this.readPosition}, writePos: ${this.writePosition}`);
        this.Check();
        if (value === undefined || value === null) {
            value = '';
        }
        const bytes = Buffer.from(value, 'utf8');
        if (bytes.length > 65535) { // Max UInt16 value
            throw new Error(`String too long: ${bytes.length} bytes exceeds maximum of 65535 bytes`);
        }
        this.WriteUInt16(bytes.length);
        this.WriteDirectly(bytes);
    }
    
    ReadByte() {
        this.Check();
        return this.buffer[this.readPosition++];
    }

    ReadBytes() {
        this.Check();
        const length = this.ReadUInt16();
        if (length === undefined || length < 0) {
            throw new Error(`Invalid string length: ${length}`);
        }
        if (this.readPosition + length > this.buffer.length) {
            throw new Error(`Buffer underrun: Trying to read ${length} bytes at position ${this.readPosition} in buffer of length ${this.buffer.length}`);
        }
        const array = Buffer.alloc(length);
        this.buffer.copy(array, 0, this.readPosition, this.readPosition + length);
        this.readPosition += length;
        return array;
    }

    ReadInt16() {
        this.Check();
        const value = this.buffer.readInt16LE(this.readPosition);
        this.readPosition += 2;
        return value;
    }

    ReadUInt16() {
        this.Check();
        const value = this.buffer.readUInt16LE(this.readPosition);
        this.readPosition += 2;
        return value;
    }

    ReadInt32() {
        this.Check();
        const value = this.buffer.readInt32LE(this.readPosition);
        this.readPosition += 4;
        return value;
    }

    ReadUInt32() {
        this.Check();
        const value = this.buffer.readUInt32LE(this.readPosition);
        this.readPosition += 4;
        return value;
    }

    ReadInt64() {
        this.Check();
        const value = this.buffer.readBigInt64LE(this.readPosition);
        this.readPosition += 8;
        return value;
    }

    ReadUInt64() {
        this.Check();
        const value = this.buffer.readBigUInt64LE(this.readPosition);
        this.readPosition += 8;
        return value;
    }

    ReadDouble() {
        this.Check();
        const value = this.buffer.readDoubleLE(this.readPosition);
        this.readPosition += 8;
        return value;
    }

    ReadFloat() {
        this.Check();
        const value = this.buffer.readFloatLE(this.readPosition);
        this.readPosition += 4;
        return value;
    }

    ReadBool() {
        this.Check();
        return this.ReadByte() === 1;
    }

    ReadBoolean() {
        return this.ReadBool();
    }

    ReadString() {
        this.Check();
        const bytes = this.ReadBytes();
        return bytes.toString('utf8');
    }

    ReadEnum() {
        this.Check();
        return this.ReadByte();
    }


    static Create() {
        return new BitSerializer();
    }

    static Create(data) {
        return new BitSerializer(data);
    }


    Reset() {
        this.writePosition = 0;
        this.readPosition = 0;
    }
}


module.exports = BitSerializer;