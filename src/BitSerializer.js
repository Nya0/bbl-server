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
            throw new Error("Serializer is not in use!");
        }
        if (!this.buffer) {
            throw new Error("Buffer is null!");
        }
        if (this.readPosition < 0 || this.writePosition < 0) {
            throw new Error("Invalid position!");
        }
        if (this.readPosition > this.buffer.length) {
            throw new Error("Read position exceeds buffer length!");
        }
    }

    
    WriteByte(value) {
      this.Check();
      this.increaseBuffer(1);
      this.buffer[this.readPosition] = value;
      this.readPosition++;
    }

    WriteBytes(bytes) {
        this.Check();
        
        if (!bytes) {
            this.WriteUInt16(0);
            return;
        }
        
        const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
        
        if (buffer.length > 65535) {
            throw new Error(`Byte array too long: ${buffer.length} bytes exceeds maximum of 65535 bytes`);
        }
        
        this.WriteUInt16(buffer.length);
        if (buffer.length > 0) {
            this.WriteDirectly(buffer);
        }
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
        this.Check();

        const str = (value ?? '').toString();
        const bytes = Buffer.from(str, 'utf8');
        
        if (bytes.length > 65535) {
            throw new Error(`String too long: ${bytes.length} bytes exceeds maximum of 65535 bytes`);
        }
        
        this.WriteUInt16(bytes.length);
        if (bytes.length > 0) {
            this.WriteDirectly(bytes);
        }
    }
    
    ReadByte() {
        this.Check();
        return this.buffer[this.readPosition++];
    }

    ReadBytes() {
        this.Check();
        const length = this.ReadUInt16();
        
        if (length === 0) {
            return Buffer.alloc(0);
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
        try {
            const length = this.ReadUInt16();
            

            if (length === 0) {
                return '';
            }
    
            if (this.readPosition + length > this.buffer.length) {
                throw new Error(`Buffer underrun: Trying to read string of length ${length} at position ${this.readPosition} in buffer of length ${this.buffer.length}`);
            }
    
            const stringBuffer = Buffer.alloc(length);
            this.buffer.copy(stringBuffer, 0, this.readPosition, this.readPosition + length);
            this.readPosition += length;
    
            const result = stringBuffer.toString('utf8');
            
            if (result === undefined) {
                throw new Error('Malformed UTF-8 string data');
            }
    
            return result;
        } catch (error) {
            throw new Error(`Error reading string: ${error.message}`);
        }
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