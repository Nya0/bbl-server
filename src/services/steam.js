const axios = require('axios');
const logger = require('../utils/logger');

class SteamService {
  constructor() {
    this.apiKey = process.env.STEAM_API_KEY;
    this.baseUrl = 'https://api.steampowered.com';
  }

  async getUserInfo(steamId) {
    try {
      const response = await axios.get(`${this.baseUrl}/ISteamUser/GetPlayerSummaries/v2/`, {
        params: {
          key: this.apiKey,
          steamids: steamId
        }
      });

      const player = response.data.response.players[0];
      if (!player) {
        throw new Error('Player not found');
      }

      return {
        name: player.personaname,
        avatarUrl: player.avatarfull
      };
    } catch (error) {
      logger.error(`Steam API error: ${error.message}`);
      // default values if steam fails
      return {
        name: `Player_${steamId.slice(-4)}`,
        avatarUrl: process.env.DEFAULT_AVATAR_URL
      };
    }
  }
}

module.exports = SteamService;
