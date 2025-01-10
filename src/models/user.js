const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  steamId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  name: String,
  avatarUrl: String,
  permissionLevel: { 
    type: Number, 
    default: 0 
  },
  rank: { 
    type: Number, 
    default: 1 
  },
  xp: { 
    type: Number, 
    default: 0 
  },
  stats: {
    kills: { type: Number, default: 0 },
    deaths: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    friendlyShots: { type: Number, default: 0 },
    friendlyKills: { type: Number, default: 0 }
  },
  weaponKills: {
    type: Map,
    of: Number,
    default: () => new Map()
  },
  isPatreonBacker: { 
    type: Boolean, 
    default: false 
  },
  isClanOwner: { 
    type: Boolean, 
    default: false 
  },
  isBanned: { 
    type: Boolean, 
    default: false 
  },
  clan: String,
  lastSeen: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('User', userSchema);