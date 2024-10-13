const BitSerializer = require('../BitSerializer');
const logger = require('../utils/logger');

class ClientMessageHandlers {
  constructor(masterServer) {
    this.masterServer = masterServer;
    this.handlers = new Map();
    this.initializeHandlers();
  }

  initializeHandlers() {
    this.handlers.set(1, this.handleRequestRoomList.bind(this));
    // Add other client-specific handlers
  }

  getHandler(messageType) {
    return this.handlers.get(messageType);
  }

  ///////////////////

  handleConnect(socket, serializer) {
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

  handleMessage(socket, serializer) {
    const requestType = serializer.readByte();

    logger.client(`Received Message! Request Type: ${requestType}`);
    
    const handler = this.getHandler(requestType);
    if (handler) {
        handler(socket, serializer);
    } else {
        logger.error(`Unknown request type: ${requestType}`);
    }
  }


  ////////////////////

  writeClientInfo(response, steamID) {

    response.writeByte(2); // PermissionLevel
    response.writeByte(10); // Rank
    response.writeInt32(4); // XP
    response.writeInt32(100); // KillCount
    response.writeInt32(50); // DeathCount
    response.writeInt32(10); // WinCount
    response.writeInt32(5); // LostCount
    response.writeInt32(20); // FriendlyShots 
    response.writeInt32(2); // FriendlyKills
    response.writeBool(false); // isBanned
    response.writeString("skibidi"); // Clan



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
    response.writeInt32(server.currentPlayers || 2); // CurrentCount
    response.writeBool(server.isProtected); // isProtected
    response.writeString(server.serverSteamID || "02"); // Server Steam ID, if available
    response.writeByte(0) // Region :	US (0:EU,1:US,2:AS)
  }
  /////////////

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

  // Additional client-specific methods
}

module.exports = ClientMessageHandlers;
