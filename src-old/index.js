const MasterServer = require('./MasterServer');
const config = require('./config');
const logger = require('./utils/logger');

function startServer() {
  const server = new MasterServer(config.ClientPORT, config.ServerPORT, config.HttpPORT);
  server.start();
}


startServer();


