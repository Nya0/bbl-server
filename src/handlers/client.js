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
    this.handlers.set(2, this.handleKeepAlive.bind(this));
    // Add other client-specific handlers
  }

  getHandler(messageType) {
    return this.handlers.get(messageType);
  }

  ///////////////////

  handleConnect(socket, serializer) {
    logger.client('Handling client connect');
    const steamID = serializer.ReadInt64();
    logger.client(`Steam ID: ${steamID}`);

    socket.isServer = false;
    socket.steamID = steamID;

    const response = new BitSerializer();
    response.WriteBool(true); // success

    this.WriteClientInfo(response, steamID);
    this.masterServer.sendMessage(socket, response.Data);
  }

  handleMessage(socket, serializer) {
    const requestType = serializer.ReadByte();

    logger.client(`Received Message! Request Type: ${requestType}`);
    
    const handler = this.getHandler(requestType);
    if (handler) {
        handler(socket, serializer);
    } else {
        logger.error(`Unknown request type: ${requestType}`);
    }
  }


  ////////////////////

  WriteClientInfo(response, steamID) {
    response.WriteInt64(steamID); // SteamID
    response.WriteString(`amogus-${steamID}`); // Name
    response.WriteString("https://media.discordapp.net/attachments/1270930588861206569/1326696841147846766/H3VR_.jpeg?ex=67805e37&is=677f0cb7&hm=7790ef5657e3fa22a60078aebba7ae7270991582b1fcf7983bb97b91115e9a85&=&width=764&height=764"); // AvatarURL
    response.WriteByte(2); // PermissionLevel
    response.WriteByte(120); // Rank
    response.WriteInt32(1000); // XP
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

  WriteServerInfo(response, server, key) {
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

    response.WriteString(server.serverName); // RoomName
    response.WriteString(ip); // IP
    response.WriteInt32(parseInt(port)); // Port
    response.WriteString(server.gameMap); // GameMap
    response.WriteString(server.gameMode); // GameMode
    response.WriteString(server.extraInfo); // ExtraInfo
    response.WriteInt32(server.maxPlayers); // MaxCount
    response.WriteInt32(server.currentPlayers || 2); // CurrentCount
    response.WriteBool(server.isProtected); // isProtected
    response.WriteString(server.serverSteamID || "02"); // Server Steam ID, if available
    response.WriteByte(0) // Region :	US (0:EU,1:US,2:AS)
  }
  /////////////

  handleRequestRoomList(socket) {
    logger.info('Handling request room list');
    const response = new BitSerializer();

    response.WriteByte(1);
    response.WriteInt16(this.masterServer.servers.size);
    
    logger.info(`Number of servers: ${this.masterServer.servers.size}`);
    this.masterServer.servers.forEach((server, key) => {
      this.WriteServerInfo(response, server, key);
    });

    this.masterServer.sendMessage(socket, response.Data);
    logger.info('Room list response sent');
  }

  handleKeepAlive(socket) {
    logger.debug(`Received keepalive from ${socket.steamID}`);
    return true;
  }

  // Additional client-specific methods
}

module.exports = ClientMessageHandlers;
