const mongoose = require('mongoose');

const gameServerSchema = new mongoose.Schema({
  serverKey: {
    type: String,
    required: true,
    unique: true
  },
  ip: String,
  port: Number,
  region: Number,
  serverName: String,
  gameMap: String,
  gameMode: String,
  extraInfo: String,
  maxPlayers: Number,
  currentPlayers: {
    type: Number,
    default: 0
  },
  isProtected: Boolean,
  serverSteamId: String,
  lastSeen: Date
});

module.exports = mongoose.model('GameServer', gameServerSchema);