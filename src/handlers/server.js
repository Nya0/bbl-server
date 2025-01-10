const BitSerializer = require('../BitSerializer');
const logger = require('../utils/logger');

class ServerMessageHandlers {
  constructor(masterServer) {
    this.masterServer = masterServer;
    this.handlers = new Map();
    this.initializeHandlers();
  }

  initializeHandlers() {
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
      this.sendAcknowledgement(socket, false); // Error
    }
  }

  handleMessage(socket, serializer) {
    const requestType = serializer.ReadByte();
    if (requestType === 0) {
      return //keepAlive request
    }
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
    response.WriteBool(status);
    this.masterServer.sendMessage(socket, response.Data);
  }

  WriteServerInfo(response, server, key) {
    let ip, port;
    if (key.startsWith('::ffff:')) {
      [ip, port] = key.split('::ffff:')[1].split(':');
    } else {
      [ip, port] = key.split(':');
    }

    response.WriteString(server.serverName); // RoomName
    response.WriteString(ip); // IP
    response.WriteInt32(parseInt(port)); // Port
    response.WriteString(server.gameMap); // GameMap
    response.WriteString(server.gameMode); // GameMode
    response.WriteString(server.extraInfo); // ExtraInfo
    response.WriteInt32(server.maxPlayers); // MaxCount
    response.WriteInt32(server.currentPlayers || 20); // CurrentCount
    response.WriteBool(server.isProtected); // isProtected
    response.WriteString(server.serverSteamID || "02"); // Server Steam ID, if available
    response.WriteByte(1) // Region :	US (0:EU,1:US,2:AS)
  }

  parseServerInfo(serializer) {  
    return { 
      region: serializer.ReadByte(),
      serverName: serializer.ReadString(),
      port: serializer.ReadInt32(),
      gameMap: serializer.ReadString(),
      gameMode: serializer.ReadString(),
      extraInfo: serializer.ReadString(),
      maxPlayers: serializer.ReadByte(),
      isProtected: serializer.ReadBool(),
    };
  }

  registerServer(socket, serverInfo) {
    const serverKey = `${serverInfo.ip}:${serverInfo.port}`;
    this.masterServer.servers.set(serverKey, serverInfo);
    socket.isServer = true;
    socket.serverKey = serverKey;
  }

  WriteClientInfo(response, steamID) {
    response.WriteInt64(steamID); // SteamID
    response.WriteString(`amogus-${steamID}`); // Name
    response.WriteString("https://cdn.discordapp.com/attachments/1207824900006355067/1273051272035041280/Screenshot_20240701_101243.png"); // AvatarURL
    response.WriteByte(2); // PermissionLevel
    response.WriteByte(10); // Rank
    response.WriteInt32(4); // XP
    response.WriteInt32(100); // KillCount
    response.WriteInt32(50); // DeathCount
    response.WriteInt32(10); // WinCount
    response.WriteInt32(5); // LostCount
    response.WriteInt32(20); // FriendlyShots 
    response.WriteInt32(2); // FriendlyKills
    response.WriteBool(true); // IsPatreonBacker
    response.WriteBool(true); // IsClanOwner
    response.WriteBool(false); // isBanned
    response.WriteString("skibidi"); // Clan
    response.WriteInt16(0) // Size of pref array
    response.WriteInt16(0) // Size of Kills array


    // OLD (before Build 100.79.98.95.12[Public])
    // response.WriteInt32(123451); // PlayerID
    // response.WriteInt64(steamID); // SteamID
    // response.WriteString("amogus"); // Name
    // response.WriteString("https://media.discordapp.net/stickers/1180619442141536367.webp?size=160"); // AvatarURL
    // response.WriteByte(2); // PermissionLevel
    // response.WriteByte(10); // Rank
    // response.WriteInt32(4); // XP
    // response.WriteInt32(100); // KillCount
    // response.WriteInt32(50); // DeathCount
    // response.WriteInt32(10); // WinCount
    // response.WriteInt32(5); // LostCount
    // response.WriteInt32(20); // FriendlyShots 
    // response.WriteInt32(2); // FriendlyKills
    // response.WriteBool(true); // IsPatreonSupporter
    // response.WriteBool(true); // IsClanOwner
    // response.WriteBool(false); // isBanned
    // response.WriteString("skibidi"); // Clan
    // response.WriteInt16(0) // Size of pref array
  }
  ////////////////////

  UpdateSteamID(socket, serializer) {
    logger.info('Handling update server Steam ID');
    if (socket.isServer && socket.serverKey) {
      const newServerSteamID = serializer.ReadString();
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
    const steamID = serializer.ReadInt64();
    logger.client(`Steam ID: ${steamID}`);
    const response = new BitSerializer();

    this.WriteClientInfo(response, steamID);
    this.masterServer.sendMessage(socket, response.Data);
  }

  // Additional server-specific methods
}

module.exports = ServerMessageHandlers;
