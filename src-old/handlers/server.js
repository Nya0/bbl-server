const BitSerializer = require('../BitSerializer');
const logger = require('../utils/logger');

class ServerMessageHandlers {
  constructor(masterServer) {
    this.masterServer = masterServer;
    this.handlers = new Map();
    this.initializeHandlers();
  }

  initializeHandlers() {
    // 0 is keepaliv?
    this.handlers.set(1, this.ValidateAccount.bind(this));
    this.handlers.set(2, this.UpdateSteamID.bind(this));
    // Add other server-specific handlers
  }

  getHandler(messageType) {
    return this.handlers.get(messageType);
  }

  //////////////////////

  handleConnect(socket, serializer) {
    logger.info('Handling server connect');
    try {
      const serverInfo = this.parseServerInfo(serializer);
      serverInfo.ip = socket.remoteAddress.split('::ffff:')[1]
      console.log('Parsed serverInfo:', serverInfo);
      console.log('Parsed clients:', this.masterServer.clients);

      this.registerServer(socket, serverInfo);
      this.sendAcknowledgement(socket, true);
      logger.info(`Server connection acknowledged: ${socket.serverKey}`);
      
    } catch (error) {
      logger.error('Error in handleServerConnect:', error);
      this.sendAcknowledgement(socket, 0); // Error
    }
  }

  handleMessage(socket, serializer) {
    const requestType = serializer.readByte();

    logger.server(`Received Message! Request Type: ${requestType}`);

    const handler = this.getHandler(requestType);
    if (handler) {
        handler(socket, serializer);
    } else {
        logger.error(`Unknown request type: ${requestType}`);
    }
  }

  ////////////////////

  sendAcknowledgement(socket, status) {
    const response = new BitSerializer();
    response.writeBool(status);
    this.masterServer.sendMessage(socket, response.getData());
  }

  writeServerInfo(response, server, key) {
    let ip, port;
    if (key.startsWith('::ffff:')) {
      [ip, port] = key.split('::ffff:')[1].split(':');
    } else {
      [ip, port] = key.split(':');
    }

    response.writeString(server.serverName); // RoomName
    response.writeString(ip); // IP
    response.writeInt32(parseInt(port)); // Port
    response.writeString(server.gameMap); // GameMap
    response.writeString(server.gameMode); // GameMode
    response.writeString(server.extraInfo); // ExtraInfo
    response.writeInt32(server.maxPlayers); // MaxCount
    response.writeInt32(server.currentPlayers || 20); // CurrentCount
    response.writeBool(server.isProtected); // isProtected
    response.writeString(server.serverSteamID || "02"); // Server Steam ID, if available
    response.writeByte(1) // Region :	US (0:EU,1:US,2:AS)
  }

  parseServerInfo(serializer) {  
    return { 
      region: serializer.readByte(),
      serverName: serializer.readString(),
      port: serializer.readInt32(),
      gameMap: serializer.readString(),
      gameMode: serializer.readString(),
      extraInfo: serializer.readString(),
      maxPlayers: serializer.readByte(),
      isProtected: serializer.readBool(),
    };
  }

  registerServer(socket, serverInfo) {
    const serverKey = `${serverInfo.ip}:${serverInfo.port}`;
    this.masterServer.servers.set(serverKey, serverInfo);
    socket.isServer = true;
    socket.serverKey = serverKey;
  }

  writeClientInfo(response, steamID) {
    response.writeInt64(steamID); // SteamID
    response.writeString(steamID); // Name     response.writeString(`amogus-${steamID}`); // Name
    response.writeString("https://cdn.discordapp.com/attachments/1207824900006355067/1273051272035041280/Screenshot_20240701_101243.png"); // AvatarURL
    response.writeByte(2); // PermissionLevel
    response.writeByte(10); // Rank
    response.writeInt32(4); // XP
    response.writeInt32(100); // KillCount
    response.writeInt32(50); // DeathCount
    response.writeInt32(10); // WinCount
    response.writeInt32(5); // LostCount
    response.writeInt32(20); // FriendlyShots 
    response.writeInt32(2); // FriendlyKills
    response.writeBool(true); // IsPatreonBacker
    response.writeBool(true); // IsClanOwner
    response.writeBool(false); // isBanned
    response.writeString("skibidi"); // Clan
    response.writeInt16(0) // Size of pref array
    response.writeInt16(0) // Size of Kills array


    // OLD (before Build 100.79.98.95.12[Public])
    // response.writeInt32(123451); // PlayerID
    // response.writeInt64(steamID); // SteamID
    // response.writeString("amogus"); // Name
    // response.writeString("https://media.discordapp.net/stickers/1180619442141536367.webp?size=160"); // AvatarURL
    // response.writeByte(2); // PermissionLevel
    // response.writeByte(10); // Rank
    // response.writeInt32(4); // XP
    // response.writeInt32(100); // KillCount
    // response.writeInt32(50); // DeathCount
    // response.writeInt32(10); // WinCount
    // response.writeInt32(5); // LostCount
    // response.writeInt32(20); // FriendlyShots 
    // response.writeInt32(2); // FriendlyKills
    // response.writeBool(true); // IsPatreonSupporter
    // response.writeBool(true); // IsClanOwner
    // response.writeBool(false); // isBanned
    // response.writeString("skibidi"); // Clan
    // response.writeInt16(0) // Size of pref array
  }
  ////////////////////

  UpdateSteamID(socket, serializer) {
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

  ValidateAccount(socket, serializer) {
    logger.server("Got request for account validation")
    const steamID = serializer.readInt64();
    logger.client(`Steam ID: ${steamID}`);
    const response = new BitSerializer();
    response.writeBool(true); // success

    this.writeClientInfo(response, steamID);
    this.masterServer.sendMessage(socket, response.getData());
  }

  // Additional server-specific methods
}

module.exports = ServerMessageHandlers;
