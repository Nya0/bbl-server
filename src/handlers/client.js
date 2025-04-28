const BitSerializer = require('../BitSerializer');
const Format = require('../utils/format');
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
    this.handlers.set(0, this.handleKeepAlive.bind(this));
    // this.handlers.set(1, this.handleRequestRoomList.bind(this));
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
      Format.writePlayerData(response, player)
      
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