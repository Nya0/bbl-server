const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoose = require('mongoose');
const MasterServer = require('./MasterServer');
const SteamService = require('./services/steam');
const PlayerService = require('./services/player');
const GameServerService = require('./services/gameServer');
const logger = require('./utils/logger');

const requiredEnvVars = [
  'MONGODB_URI',
  'CLIENT_PORT',
  'SERVER_PORT',
  'HTTP_PORT',
  'STEAM_API_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

async function startServer() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');

    // Initialize services
    const steamService = new SteamService();
    const playerService = new PlayerService(steamService);
    const gameServerService = new GameServerService();

    // Create and start master server
    const server = new MasterServer(
      parseInt(process.env.CLIENT_PORT),
      parseInt(process.env.SERVER_PORT),
      parseInt(process.env.HTTP_PORT),
      playerService,
      gameServerService
    );

    server.start();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down...');
      server.shutdown();
      await mongoose.connection.close();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Server startup error:', error.message);
    process.exit(1);
  }
}

startServer();