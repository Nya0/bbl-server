const BitSerializer = require('../BitSerializer');

class Format { // 5 am code forgive me
  static writeLengthPrefixed(serializer, writerCallback) {
    const tempSerializer = new BitSerializer();
    writerCallback(tempSerializer);
    const data = tempSerializer.Data;
    serializer.WriteBytes(data);
  }

  static readLengthPrefixed(data) {
    if (!data || !data.length) {
      return null;
    }
    return new BitSerializer(data);
  }

  static writeWeaponKills(weaponKills, serializer) {
    Format.writeLengthPrefixed(serializer, (tempSerializer) => {
      tempSerializer.WriteInt16(weaponKills.size);
      for (const [weaponId, kills] of weaponKills) {
        tempSerializer.WriteInt16(weaponId);
        tempSerializer.WriteInt32(kills);
      }
    });
  }

  static parseWeaponKills(killsData) {
    const serializer = Format.readLengthPrefixed(killsData);
    if (!serializer) {
      return new Map();
    }

    const weaponKills = new Map();
    const count = serializer.ReadInt16();
    
    for (let i = 0; i < count; i++) {
      const weaponId = serializer.ReadInt16();
      const kills = serializer.ReadInt32();
      weaponKills.set(weaponId, kills);
    }

    return weaponKills;
  }

  static writePlayerData(response, player) {
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
    response.WriteString(player.clan || "None");
    response.WriteInt16(0); // No preferences for now

    Format.writeWeaponKills(player.weaponKills, response);
  }
}

module.exports = Format;