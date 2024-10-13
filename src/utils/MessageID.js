class MessageID {
  constructor(type, id) {
      this.type = type;
      this.id = id;
  }

  write(serializer) {
      serializer.writeByte(this.type);
      serializer.writeInt32(this.id);
  }

  static create(serializer) {
      const type = serializer.readByte();
      const id = serializer.readInt32();
      return new MessageID(type, id);
  }

  revert() {
      const revertedType = this.type === MessageType.Request ? MessageType.Answer : MessageType.Request;
      return new MessageID(revertedType, this.id);
  }

  isMatch(msgID) {
      return this.id === msgID.id;
  }

  get TYPE() {
      return this.type;
  }

  get ID() {
      return this.id;
  }
}

const MessageType = {
  Request: 0,
  Answer: 1,
};

module.exports = { MessageID, MessageType };
