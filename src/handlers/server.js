const BitSerializer = require('../BitSerializer');
const logger = require('../utils/logger');

class ServerMessageHandler {
  constructor(masterServer, gameServerService, playerService) {
    this.masterServer = masterServer;
    this.gameServerService = gameServerService;
    this.playerService = playerService;
    this.handlers = new Map();
    this.initializeHandlers();
  }

  initializeHandlers() {
    this.handlers.set(0, this.handleKeepAlive.bind(this));
    this.handlers.set(1, this.handleValidateAccount.bind(this));
    this.handlers.set(2, this.handlePlayerDisconnected.bind(this));
    this.handlers.set(3, this.handleServerClosing.bind(this));
    this.handlers.set(4, this.handlePlayerUpdateStats.bind(this));
  }

  async handleConnect(socket, serializer) {
    logger.info('Handling server connect');
    try {
      const serverInfo = this.parseServerInfo(serializer);
      serverInfo.ip = socket.remoteAddress.split('::ffff:')[1];
      
      const serverKey = await this.gameServerService.registerServer({
        ...serverInfo,
        lastSeen: new Date()
      });

      socket.isServer = true;
      socket.serverKey = serverKey;

      this.sendAcknowledgement(socket, true);
      logger.info(`Server connection acknowledged: ${serverKey}`);
    } catch (error) {
      logger.error('Error in handleServerConnect:', error);
      this.sendAcknowledgement(socket, false);
    }
  }

  handleMessage(socket, serializer) {
    const requestType = serializer.ReadByte();
        
    if (requestType === 0) {
      return this.handleKeepAlive(socket);
    }

    logger.server(`Received Message! Request Type: ${requestType}`);

    const handler = this.getHandler(requestType);
    if (handler) {
      handler(socket, serializer);
    } else {
      logger.error(`Unknown request type: ${requestType}`);
    }
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
      currentPlayers: 0,
      serverSteamId: ""
    };
  }

  parsePlayerStats(serializer) {
    const stats = {
      steamId: serializer.ReadInt64(),
			name: serializer.ReadString(),
			avatarURL: serializer.ReadString(),
			permissionLevel: serializer.ReadByte(),
			rank: serializer.ReadByte(),
			xp: serializer.ReadInt32(),
      stats: {
        kills: serializer.ReadInt32(),
        deaths: serializer.ReadInt32(),
        wins: serializer.ReadInt32(),
        losses: serializer.ReadInt32(),
        friendlyShots: serializer.ReadInt32(),
        friendlyKills: serializer.ReadInt32(),
      },
			isPatreonBacker: serializer.ReadBool(),
			isClanOwner: serializer.ReadBool(),
			isBanned: serializer.ReadBool(),
			clan: serializer.ReadString(),
			prefs: serializer.ReadBytes(),
			weaponKills: this.parseWeaponKills(serializer.ReadBytes())
    };


    return stats;
  }

  parseWeaponKills(killsData) {
    if (!killsData || !killsData.length) {
      return new Map();
    }
  
    const weaponKills = new Map();
    const killsSerializer = new BitSerializer(killsData);
    const count = killsSerializer.ReadInt16();
    
    for (let i = 0; i < count; i++) {
      const weaponId = killsSerializer.ReadInt16();
      const kills = killsSerializer.ReadInt32();
      weaponKills.set(weaponId, kills);
    }
  
    return weaponKills;
  }

  sendAcknowledgement(socket, status) {
    try {
      const response = new BitSerializer();
      response.WriteBool(status);
      logger.info(`Sending acknowledgement (status: ${status})`);
      this.masterServer.sendMessage(socket, response.Data);
    } catch (error) {
      logger.error('Error sending acknowledgement:', error);
      throw error;
    }
  }

  async handleKeepAlive(socket) {
    if (!socket.serverKey) {
      return false;
    }

    logger.debug(`Keepalive from server: ${socket.serverKey}`);
    try {
      await this.gameServerService.updateLastSeen(socket.serverKey);
    } catch (error) {
      logger.error(`Error updating server last seen: ${error.message}`);
    }
    return true;
  }

  async handleValidateAccount(socket, serializer) {
    logger.server("Got request for account validation");
    const steamId = serializer.ReadInt64().toString();
    logger.client(`Steam ID: ${steamId}`);
    
    try {
      const player = await this.playerService.getOrCreatePlayer(steamId);
      const response = new BitSerializer();
      await this.writePlayerData(response, player);
      this.masterServer.sendMessage(socket, response.Data);
    } catch (error) {
      logger.error(`Account validation error: ${error.message}`);
    }
  }

  async handlePlayerDisconnected(socket, serializer) {
    if (!socket.isServer) return;

    const steamId = serializer.ReadInt64().toString()
    const playerStats = this.parsePlayerStats(serializer);

    try {
      await this.playerService.updateFullStats(steamId, playerStats);
      logger.info(`Updated stats for disconnected player ${steamId}`);
    } catch (error) {
      logger.error(`Error updating disconnected player stats: ${error.message}`);
    }
  }

  async handlePlayerUpdateStats(socket, serializer) {
    if (!socket.isServer) return;

    const steamId = serializer.ReadInt64().toString()
    const playerStats = this.parsePlayerStats(serializer);

    try {
      await this.playerService.updateFullStats(steamId, playerStats);
      logger.info(`Updated stats for player ${steamId}`);
    } catch (error) {
      logger.error(`Error updating player stats: ${error.message}`);
    }
  }

  async handleServerClosing(socket, serializer) {
    if (!socket.isServer) return;

    const playerCount = serializer.ReadByte();
    
    try {
      // Process stats for each player
      for (let i = 0; i < playerCount; i++) {
        const steamId = serializer.ReadInt64().toString()
        const playerStats = this.parsePlayerStats(serializer);
        await this.playerService.updateFullStats(steamId, playerStats);
      }

      logger.info(`Processed closing stats for ${playerCount} players`);
      
      // Update server status
      if (socket.serverKey) {
        await this.gameServerService.removeServer(socket.serverKey);
      }
    } catch (error) {
      logger.error(`Error processing server closing: ${error.message}`);
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

  getHandler(messageType) {
    return this.handlers.get(messageType);
  }
}

module.exports = ServerMessageHandler;