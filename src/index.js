const MasterServer = require('./MasterServer');
const config = require('./config');
const logger = require('./utils/logger');

function startServer() {
  const server = new MasterServer(config.ClientPORT, config.ServerPORT, config.HttpPORT);
  server.start();

  process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Starting graceful shutdown...');
    server.shutdown();
    process.exit(0);
  });

  process.on('SIGINT', () => {
      console.log('Received SIGINT. Starting graceful shutdown...');
      server.shutdown();
      process.exit(0);
  });

  process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      server.shutdown();
      process.exit(1);
  });
}


startServer();


