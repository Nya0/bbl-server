const net = require('net');
const crypto = require('crypto');

class BitSerializer {
  constructor(buffer = Buffer.alloc(64)) {
    this.buffer = buffer;
    this.readPosition = 0;
    this.writePosition = 0;
  }

  static create(data) {
    return new BitSerializer(Buffer.isBuffer(data) ? data : undefined);
  }

  readBool() { return this.readByte() === 1; }
  readByte() { return this.buffer.readUInt8(this.readPosition++); }
  readInt16() {
    const value = this.buffer.readInt16LE(this.readPosition);
    this.readPosition += 2;
    return value;
  }
  readInt32() {
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

class MessageID {
  constructor() {
    this.currentID = 0;
  }

  createRequest() {
    return this.currentID++;
  }
}

class MasterServer {
  constructor() {
    this.servers = new Map();
    this.clients = new Map();
    this.messageHandlers = new Map();
    this.ticketer = new MessageID();
    this.waitingRequests = new Map();
  }

  initializeMessageHandlers() {
    this.messageHandlers.set(0, this.handleRequestRoomList.bind(this));
    this.messageHandlers.set(1, this.handleRequestCountOfPlayerAndServer.bind(this));
    this.messageHandlers.set(2, this.handleSendMail.bind(this));
    this.messageHandlers.set(3, this.handleUpdateServerInfo.bind(this));
    this.messageHandlers.set(4, this.handleUpdateServerCount.bind(this));
    this.messageHandlers.set(9, this.handleClientConnected.bind(this));
    this.messageHandlers.set(10, this.handleClientDisconnected.bind(this));
    this.messageHandlers.set(11, this.handleAddKill.bind(this));
    this.messageHandlers.set(12, this.handleUpdateServerSteamID.bind(this));
  }

  handleInitialConnection(socket, serializer) {
    const isServer = serializer.readBool();
    if (isServer) {
      this.handleServerConnect(socket, serializer);
    } else {
      this.handleClientConnect(socket, serializer);
    }
  }

  handleServerConnect(socket, serializer) {
    console.log('DEBUG: Handling server connect');
    const serverName = serializer.readString();
    const port = serializer.readInt32();
    const gameMap = serializer.readString();
    const gameMode = serializer.readString();
    const extraInfo = serializer.readString();
    const maxPlayers = serializer.readInt32();
    const isProtected = serializer.readBool();

    console.log(`DEBUG: Server registered: ${serverName} (${gameMap} - ${gameMode})`);

    const serverInfo = { serverName, port, gameMap, gameMode, extraInfo, maxPlayers, isProtected, currentPlayers: 0 };
    const serverKey = `${socket.remoteAddress}:${port}`;
    this.servers.set(serverKey, serverInfo);

    socket.isServer = true;
    socket.serverKey = serverKey;

    const response = BitSerializer.create();
    response.writeByte(1); // Acknowledgement
    this.sendMessage(socket, response.getData());
  }

  handleClientConnect(socket, serializer) {
    console.log('DEBUG: Handling client connect');
    console.log('DEBUG: Remaining buffer:', serializer.buffer.slice(serializer.readPosition).toString('hex'));
  
    try {
      const messageType = serializer.readByte();
      console.log('DEBUG: Message type:', messageType);
  
      const steamID = serializer.readString();
      console.log(`DEBUG: Steam ID: ${steamID}`);
  
      // Read the friends count only if there's enough data left
      let friendsCount = 0;
      if (serializer.readPosition + 2 <= serializer.buffer.length) {
        friendsCount = serializer.readInt16();
        console.log(`DEBUG: Friends Count: ${friendsCount}`);
      } else {
        console.log('DEBUG: Not enough data to read friends count');
      }
  
      const friends = [];
      for (let i = 0; i < friendsCount && serializer.readPosition + 8 <= serializer.buffer.length; i++) {
        friends.push(serializer.readInt64().toString());
      }
      console.log('DEBUG: Friends:', friends);
  
      socket.isServer = false;
      socket.steamID = steamID;
  
      const response = BitSerializer.create();
      response.writeByte(1); // Success response
      
      // BitClientStats
      response.writeString(steamID);
      response.writeByte(0); // PermissionLevel
      response.writeInt32(100); // KillCount
      response.writeInt32(50); // DeathCount
      response.writeInt32(10); // WinCount
      response.writeInt32(5); // LostCount
      response.writeInt32(2); // FriendlyKills
      response.writeInt32(20); // FriendlyShots
      response.writeBool(false); // isBanned
      response.writeString(""); // Clan
  
      // SteamFriendPlayingServer[]
      response.writeInt16(0);
  
      // Mail count
      response.writeInt32(0);
  
      // SteamAccount[]
      response.writeInt16(0);
  
      this.sendMessage(socket, response.getData());
    } catch (error) {
      console.error('ERROR in handleClientConnect:', error);
      const errorResponse = BitSerializer.create();
      errorResponse.writeByte(0); // Error response
      errorResponse.writeString(error.message);
      this.sendMessage(socket, errorResponse.getData());
    }
  }

  handleRequestRoomList(socket, serializer, msgID) {
    console.log('DEBUG: Handling request room list');
    const response = BitSerializer.create();
    response.writeInt32(msgID);
  
    // Predefined puppet servers
    const puppetServers = [
      {
        serverName: 'PuppetServer1',
        serverIP: '192.168.1.1',
        port: 8080,
        gameMap: 'Map1',
        gameMode: 'Mode1',
        currentPlayers: 10,
        maxPlayers: 50,
        isProtected: false,
        extraInfo: 'ExtraInfo1'
      },
      {
        serverName: 'PuppetServer2',
        serverIP: '192.168.1.2',
        port: 8081,
        gameMap: 'Map2',
        gameMode: 'Mode2',
        currentPlayers: 20,
        maxPlayers: 50,
        isProtected: true,
        extraInfo: 'ExtraInfo2'
      }
    ];
  
    response.writeInt16(puppetServers.length);
    
    for (const server of puppetServers) {
      response.writeString(server.serverName);
      response.writeInt32(server.port);
      response.writeString(server.extraInfo);
      response.writeString(server.gameMap);
      response.writeString(server.gameMode);
      response.writeInt32(server.maxPlayers);
      response.writeInt32(server.currentPlayers);
      response.writeBool(server.isProtected);
      response.writeString(server.serverIP); // IP
    }
  
    this.sendMessage(socket, response.getData());
  }
  
  
  

  handleRequestCountOfPlayerAndServer(socket, serializer, msgID) {
    console.log('DEBUG: Handling request count of player and server');
    const totalPlayers = Array.from(this.servers.values()).reduce((sum, server) => sum + server.currentPlayers, 0);
    const totalServers = this.servers.size;

    const response = BitSerializer.create();
    response.writeInt32(msgID);
    response.writeInt32(totalPlayers);
    response.writeInt32(totalServers);

    this.sendMessage(socket, response.getData());
  }

  handleSendMail(socket, serializer, msgID) {
    console.log('DEBUG: Handling send mail');
    // Implement mail sending logic here
  }

  handleUpdateServerInfo(socket, serializer, msgID) {
    console.log('DEBUG: Handling update server info');
    if (socket.isServer && socket.serverKey) {
      const gameMode = serializer.readString();
      const gameMap = serializer.readString();
      const extraInfo = serializer.readString();

      const serverInfo = this.servers.get(socket.serverKey);
      if (serverInfo) {
        serverInfo.gameMode = gameMode;
        serverInfo.gameMap = gameMap;
        serverInfo.extraInfo = extraInfo;
        console.log(`Updated server info for ${socket.serverKey}`);
      }
    }
  }

  handleUpdateServerCount(socket, serializer, msgID) {
    console.log('DEBUG: Handling update server count');
    if (socket.isServer && socket.serverKey) {
      const newCount = serializer.readInt32();
      const serverInfo = this.servers.get(socket.serverKey);
      if (serverInfo) {
        serverInfo.currentPlayers = newCount;
        console.log(`Updated player count for ${socket.serverKey} to ${newCount}`);
      }
    }
  }

  handleClientConnected(socket, serializer, msgID) {
    console.log('DEBUG: Handling client connected');
    if (socket.isServer && socket.serverKey) {
      const steamID = serializer.readString();
      const newServerCount = serializer.readInt32();
      const serverInfo = this.servers.get(socket.serverKey);
      if (serverInfo) {
        serverInfo.currentPlayers = newServerCount;
        console.log(`Client ${steamID} connected to ${socket.serverKey}, new count: ${newServerCount}`);
      }
    }
  }

  handleClientDisconnected(socket, serializer, msgID) {
    console.log('DEBUG: Handling client disconnected');
    if (socket.isServer && socket.serverKey) {
      const steamID = serializer.readString();
      const newServerCount = serializer.readInt32();
      const serverInfo = this.servers.get(socket.serverKey);
      if (serverInfo) {
        serverInfo.currentPlayers = newServerCount;
        console.log(`Client ${steamID} disconnected from ${socket.serverKey}, new count: ${newServerCount}`);
      }
    }
  }

  handleAddKill(socket, serializer, msgID) {
    console.log('DEBUG: Handling add kill');
    if (socket.isServer) {
      const killerSteamID = serializer.readString();
      const victimSteamID = serializer.readString();
      console.log(`Kill registered: ${killerSteamID} killed ${victimSteamID}`);
    }
  }

  handleUpdateServerSteamID(socket, serializer, msgID) {
    console.log('DEBUG: Handling update server Steam ID');
    if (socket.isServer && socket.serverKey) {
      const newServerSteamID = serializer.readString();
      const serverInfo = this.servers.get(socket.serverKey);
      if (serverInfo) {
        serverInfo.serverSteamID = newServerSteamID;
        console.log(`Updated Steam ID for ${socket.serverKey} to ${newServerSteamID}`);
      }
    }
  }

  sendMessage(socket, data) {
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeInt32LE(data.length);
    socket.write(Buffer.concat([lengthBuffer, data]));
    console.log('DEBUG: Sent message, length:', data.length);
  }

  start(port) {
    this.initializeMessageHandlers();

    const server = net.createServer((socket) => {
      console.log('DEBUG: New connection from', socket.remoteAddress);
      let buffer = Buffer.alloc(0);

      socket.on('data', (data) => {
        console.log('DEBUG: Received data, length:', data.length);
        buffer = Buffer.concat([buffer, data]);
        buffer = this.processBuffer(socket, buffer);
      });

      socket.on('end', () => {
        console.log('DEBUG: Connection closed');
        if (socket.isServer) {
          this.servers.delete(socket.serverKey);
          console.log(`DEBUG: Server removed: ${socket.serverKey}`);
        }
      });
    });

    server.listen(port, () => {
      console.log(`BattleBit Emulated Master Server listening on port ${port}`);
    });
  }

  processBuffer(socket, buffer) {
    console.log('DEBUG: Processing buffer, length:', buffer.length);
    console.log('DEBUG: Buffer content:', buffer.toString('hex'));
  
    while (buffer.length >= 4) {
      const messageLength = buffer.readInt32LE(0);
      console.log('DEBUG: Message length:', messageLength);
  
      if (buffer.length >= messageLength + 4) {
        const messageData = buffer.slice(4, messageLength + 4);
        buffer = buffer.slice(messageLength + 4);
        
        console.log('DEBUG: Message data:', messageData.toString('hex'));
        
        const serializer = BitSerializer.create(messageData);
        
        if (!socket.isServer && !socket.steamID) {
          this.handleInitialConnection(socket, serializer);
        } else {
          const msgID = serializer.readInt32();
          const messageType = serializer.readByte();
          console.log('DEBUG: Message ID:', msgID, 'Message Type:', messageType);
  
          const handler = this.messageHandlers.get(messageType);
          if (handler) {
            handler(socket, serializer, msgID);
          } else {
            console.error('ERROR: Unknown message type:', messageType);
          }
        }
      } else {
        break;
      }
    }
    return buffer;
  }
}

const masterServer = new MasterServer();
masterServer.start(27999);