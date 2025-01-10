// handlers/client.js
const BitSerializer = require('../BitSerializer');
const logger = require('../utils/logger');

class ClientMessageHandler {
  constructor(masterServer, playerService, gameServerService) {
    this.masterServer = masterServer;
    this.playerService = playerService;
    this.gameServerService = gameServerService;
    this.handlers = new Map();
    this.initializeHandlers();
  }

  initializeHandlers() {
    // this.handlers.set(0, this.handleKeepAlive.bind(this));
    this.handlers.set(1, this.handleRequestRoomList.bind(this));
  }

  async handleConnect(socket, serializer) {
    logger.client('Handling client connect');
    const steamID = serializer.ReadInt64().toString();
    logger.client(`Steam ID: ${steamID}`);

    try {
      const player = await this.playerService.getOrCreatePlayer(steamID);
      socket.isServer = false;
      socket.steamID = steamID;
      socket.player = player;

      const response = new BitSerializer();
      response.WriteBool(true);
      await this.writePlayerData(response, player);
      this.masterServer.sendMessage(socket, response.Data);
    } catch (error) {
      logger.error(`Connect error: ${error.message}`);
      const response = new BitSerializer();
      response.WriteBool(false);
      this.masterServer.sendMessage(socket, response.Data);
    }
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

  async writePlayerData(response, player) {
    response.WriteInt64(BigInt(player.steamId));
    response.WriteString(player.name);
    response.WriteString(player.avatarUrl);
    response.WriteByte(player.permissionLevel || 0);
    response.WriteByte(player.rank || 1);
    response.WriteInt32(player.xp || 0);
    response.WriteInt32(player.stats.kills || 0);
    response.WriteInt32(player.stats.deaths || 0);
    response.WriteInt32(player.stats.wins || 0);
    response.WriteInt32(player.stats.losses || 0);
    response.WriteInt32(player.stats.friendlyShots || 0);
    response.WriteInt32(player.stats.friendlyKills || 0);
    response.WriteBool(player.isPatreonBacker || false);
    response.WriteBool(player.isClanOwner || false);
    response.WriteBool(player.isBanned || false);
    response.WriteString(player.clan || "");
    response.WriteInt16(0); // No preferences for now

    // Write weapon kills
    const weaponKills = player.weaponKills || new Map();
    response.WriteInt16(weaponKills.size);
    for (const [weaponId, kills] of weaponKills) {
      response.WriteInt16(parseInt(weaponId));
      response.WriteInt32(kills);
    }
  }

  async handleRequestRoomList(socket) {
    try {
      const servers = await this.gameServerService.getActiveServers();
      
      const response = new BitSerializer();
      response.WriteByte(1);
      response.WriteInt16(servers.length);
      
      for (const server of servers) {
        this.writeServerInfo(response, server);
      }

      this.masterServer.sendMessage(socket, response.Data);
      logger.info('Room list response sent');
    } catch (error) {
      logger.error(`Room list error: ${error.message}`);
    }
  }

  writeServerInfo(response, server) {
    response.WriteString(server.serverName);
    response.WriteString(server.ip);
    response.WriteInt32(server.port);
    response.WriteString(server.gameMap);
    response.WriteString(server.gameMode);
    response.WriteString(server.extraInfo);
    response.WriteInt32(server.maxPlayers);
    response.WriteInt32(server.currentPlayers || 0);
    response.WriteBool(server.isProtected);
    response.WriteString(server.serverSteamId || "");
    response.WriteByte(server.region);
  }

  async handleKeepAlive(socket) {
    if (!socket.steamID) {
      return false;
    }

    logger.debug(`Keepalive from client: ${socket.steamID}`);
    try {
      await this.playerService.updateLastSeen(socket.steamID.toString());
    } catch (error) {
      logger.error(`Error updating client last seen: ${error.message}`);
    }
    return true;
  }

  getHandler(messageType) {
    return this.handlers.get(messageType);
  }
}

module.exports = ClientMessageHandler;