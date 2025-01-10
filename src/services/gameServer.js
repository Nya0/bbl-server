const GameServer = require('../models/gameServer');
const logger = require('../utils/logger');

class GameServerService {
  async registerServer(serverInfo) {
    const serverKey = `${serverInfo.ip}:${serverInfo.port}`;

    try {
      await GameServer.findOneAndUpdate(
        { serverKey },
        { 
          ...serverInfo,
          lastSeen: new Date()
        },
        { upsert: true }
      );

      return serverKey;
    } catch (error) {
      logger.error(`Game server registration error: ${error.message}`);
      throw error;
    }
  }

  async getActiveServers() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return GameServer.find({ 
      lastSeen: { $gte: fiveMinutesAgo } 
    });
  }

  async updateServerStats(serverKey, stats) {
    try {
      await GameServer.updateOne(
        { serverKey },
        {
          $set: {
            ...stats,
            lastSeen: new Date()
          }
        }
      );
    } catch (error) {
      logger.error(`Server stats update error: ${error.message}`);
      throw error;
    }
  }

  async updateLastSeen(serverKey) {
    try {
      await GameServer.updateOne(
        { serverKey },
        { $set: { lastSeen: new Date() } }
      );
    } catch (error) {
      logger.error(`Error updating server last seen: ${error.message}`);
      throw error;
    }
  }

  async removeServer(serverKey) {
    try {
      await GameServer.deleteOne({ serverKey });
      logger.info(`Removed server: ${serverKey}`);
    } catch (error) {
      logger.error(`Server removal error: ${error.message}`);
      throw error;
    }
  }
}


module.exports = GameServerService;