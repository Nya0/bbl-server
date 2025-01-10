// services/player.js
const User = require('../models/user');
const logger = require('../utils/logger');

class PlayerService {
  constructor(steamService) {
    this.steamService = steamService;
  }

  async getOrCreatePlayer(steamId) {
    try {
      let player = await User.findOne({ steamId });
      
      if (!player) {
        const steamInfo = await this.steamService.getUserInfo(steamId);
        player = await User.create({
          steamId,
          name: steamInfo.name,
          avatarUrl: steamInfo.avatarUrl
        });
        logger.info(`Created new player: ${steamId}`);
      }

      return player;
    } catch (error) {
      logger.error(`Error in getOrCreatePlayer: ${error.message}`);
      throw error;
    }
  }

  async updateFullStats(steamId, playerStats) {
    try {
      // Convert weaponKills Map to Object for MongoDB
      const weaponKillsObj = {};
      for (const [weaponId, kills] of playerStats.weaponKills) {
        weaponKillsObj[weaponId] = kills;
      }

      await User.findOneAndUpdate(
        { steamId },
        {
          $set: {
            stats: playerStats.stats,
            weaponKills: weaponKillsObj,
            lastSeen: new Date()
          }
        },
        { upsert: true }
      );

      logger.info(`Updated stats for player ${steamId}`);
    } catch (error) {
      logger.error(`Error updating player stats: ${error.message}`);
      throw error;
    }
  }

  async updateLastSeen(steamId) {
    try {
      await User.updateOne(
        { steamId },
        { $set: { lastSeen: new Date() } }
      );
    } catch (error) {
      logger.error(`Error updating player last seen: ${error.message}`);
      throw error;
    }
  }

  async refreshSteamInfo(steamId) {
    try {
      const steamInfo = await this.steamService.getUserInfo(steamId);
      await User.updateOne(
        { steamId },
        {
          $set: {
            name: steamInfo.name,
            avatarUrl: steamInfo.avatarUrl,
            lastSeen: new Date()
          }
        }
      );
    } catch (error) {
      logger.error(`Error refreshing Steam info: ${error.message}`);
      throw error;
    }
  }
}

module.exports = PlayerService;