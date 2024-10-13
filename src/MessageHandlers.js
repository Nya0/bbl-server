const BitSerializer = require('./BitSerializer');
const { MessageID, MessageType } = require('./utils/MessageID');
const logger = require('./utils/logger');

class MessageHandlers {
  constructor(masterServer) {
    this.masterServer = masterServer;
    this.handlers = new Map();
    this.initializeHandlers();
  }

  initializeHandlers() {
    this.handlers.set(1, this.handleRequestRoomList.bind(this));
    this.handlers.set(12, this.handleUpdateServerSteamID.bind(this));
    // Add other handlers here
  }

  get(messageType) {
    return this.handlers.get(messageType);
  }

  handleServerConnect(socket, serializer) {
    logger.info('Handling server connect');
    try {
      const serverInfo = this.parseServerInfo(serializer);
      this.registerServer(socket, serverInfo);
      this.sendAcknowledgement(socket, true);
      logger.info(`Server connection acknowledged: ${socket.serverKey}`);
      
    } catch (error) {
      logger.error('Error in handleServerConnect:', error);
      this.sendAcknowledgement(socket, 0); // Error
    }
  }

  parseServerInfo(serializer) {  
    return { 
      region: serializer.readByte(),
      serverName: serializer.readString(),
      port: serializer.readInt32(),
      map: serializer.readString(),
      mode: serializer.readString(),
      extra: serializer.readString(),
      maxPlayers: serializer.readInt32(),
      passworded: serializer.readBool(),
    };
  }

  registerServer(socket, serverInfo) {
    const serverKey = `${socket.remoteAddress}:${serverInfo.port}`;
    this.masterServer.servers.set(serverKey, serverInfo);
    socket.isServer = true;
    socket.serverKey = serverKey;
  }

  sendAcknowledgement(socket, status) {
    const response = new BitSerializer();
    response.writeBool(status);
    this.masterServer.sendMessage(socket, response.getData());
  }

  handleClientConnect(socket, serializer) {
    logger.client('Handling client connect');
    const steamID = serializer.readInt64();
    logger.client(`Steam ID: ${steamID}`);

    socket.isServer = false;
    socket.steamID = steamID;

    const response = new BitSerializer();
    response.writeBool(true); // success

    this.writeClientInfo(response, steamID);
    this.masterServer.sendMessage(socket, response.getData());
  }

  writeClientInfo(response, steamID) {
    response.writeInt32(123451); // PlayerID
    response.writeInt64(steamID); // SteamID
    response.writeString("amogus"); // Name
    response.writeString("https://media.discordapp.net/stickers/1180619442141536367.webp?size=160"); // AvatarURL
    response.writeByte(2); // PermissionLevel
    response.writeByte(10); // Rank
    response.writeInt32(4); // XP
    response.writeInt32(100); // KillCount
    response.writeInt32(50); // DeathCount
    response.writeInt32(10); // WinCount
    response.writeInt32(5); // LostCount
    response.writeInt32(20); // FriendlyShots 
    response.writeInt32(2); // FriendlyKills
    response.writeBool(true); // IsPatreonSupporter
    response.writeBool(true); // IsClanOwner
    response.writeBool(false); // isBanned
    response.writeString("skibidi"); // Clan
    response.writeInt16(0) // Size of pref array
  }

  handleRequestRoomList(socket, serializer) {
    logger.info('Handling request room list');
    const response = new BitSerializer();

    response.writeByte(1);
    response.writeInt16(this.masterServer.servers.size);
    
    logger.info(`Number of servers: ${this.masterServer.servers.size}`);
    this.masterServer.servers.forEach((server, key) => {
      this.writeServerInfo(response, server, key);
    });

    this.masterServer.sendMessage(socket, response.getData());
    logger.info('Room list response sent');
  }

  writeServerInfo(response, server, key) {
    let ip, port;
    if (key.startsWith('::ffff:')) {
      [ip, port] = key.split('::ffff:')[1].split(':');
    } else {
      [ip, port] = key.split(':');
    }
    
    logger.info(`Server key: ${key}`);
    logger.info(`IP: ${ip}, Port: ${port}`);
    logger.info(`Server Name: ${server.serverName}`);
    logger.info(`Game Mode: ${server.gameMode}`);
    logger.info(`Max Players: ${server.maxPlayers}`);
    logger.info(`Current Players: ${server.currentPlayers}`);
    logger.info(`Is Protected: ${server.isProtected}`);
    logger.info(`Server Steam ID: ${server.serverSteamID || ""}`);

    response.writeString(server.serverName); // RoomName
    response.writeString(ip); // IP
    response.writeInt32(parseInt(port)); // Port
    response.writeString(server.gameMap); // GameMap
    response.writeString(server.gameMode); // GameMode
    response.writeString(server.extraInfo); // ExtraInfo
    response.writeInt32(server.maxPlayers); // MaxCount
    response.writeInt32(server.currentPlayers); // CurrentCount
    response.writeBool(server.isProtected); // isProtected
    response.writeString(server.serverSteamID || "02"); // Server Steam ID, if available
    response.writeByte(1) // Region :	US (0:EU,1:US,2:AS)
  }

  handleRequestCountOfPlayerAndServer(socket, serializer) {
    logger.info('Handling request count of player and server');
    const totalPlayers = this.calculateTotalPlayers();
    const totalServers = this.masterServer.servers.size;

    const response = new BitSerializer();
    response.writeByte(0); // ClientRequests.PlayerAndServerCount
    response.writeInt32(totalPlayers);
    response.writeInt32(totalServers);

    this.masterServer.sendMessage(socket, response.getData());
  }

  calculateTotalPlayers() {
    return Array.from(this.masterServer.servers.values()).reduce((sum, server) => sum + server.currentPlayers, 0);
  }

  updateServerPlayerCount(serverKey, newCount) {
    const server = this.masterServer.servers.get(serverKey);
    if (server) {
      server.currentPlayers = newCount;
      logger.info(`Updated player count for ${serverKey}: ${newCount}`);
    } else {
      logger.warn(`Attempted to update player count for unknown server: ${serverKey}`);
    }
  }

  handleUpdateServerSteamID(socket, serializer, msgID) {
    logger.info('Handling update server Steam ID');
    if (socket.isServer && socket.serverKey) {
      const newServerSteamID = serializer.readString();
      const server = this.masterServer.servers.get(socket.serverKey);
      if (server) {
        server.serverSteamID = newServerSteamID;
        logger.info(`Updated Steam ID for ${socket.serverKey} to ${newServerSteamID}`);
      } else {
        logger.warn(`Server key not found for updating Steam ID: ${socket.serverKey}`);
      }
    } else {
      logger.warn('Attempt to update Steam ID from non-server socket or socket without serverKey');
    }
  }
}

module.exports = MessageHandlers;
