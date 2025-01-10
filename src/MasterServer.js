const net = require('net');
const express = require('express');
const ClientHandler = require('./handlers/client');
const ServerHandler = require('./handlers/server');
const BitSerializer = require('./BitSerializer');
const logger = require('./utils/logger');


function bufferToHexView(buffer) {
    const hex = buffer.toString('hex').match(/.{1,2}/g) || [];
    const decimal = [...buffer];
    
    let output = '\nHEX VIEW:\n';
    for (let i = 0; i < hex.length; i += 16) {
        const chunk = hex.slice(i, i + 16);
        // Offset
        output += `${i.toString(16).padStart(8, '0')}  `;
        // Hex values
        output += chunk.map(byte => byte).join(' ').padEnd(48, ' ');
        output += ' |';
        // Decimal values
        output += decimal.slice(i, i + 16).map(byte => 
            byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.'
        ).join('');
        output += '|\n';
    }

    return output;
}

class MasterServer {
  constructor(clientPort, serverPort, httpPort, playerService, gameServerService) {
    this.clientPort = clientPort;
    this.serverPort = serverPort;
    this.httpPort = httpPort;
    
    // Initialize handlers with services
    this.clientHandler = new ClientHandler(this, playerService, gameServerService);
    this.serverHandler = new ServerHandler(this, gameServerService, playerService);

    // Active connections
    this.servers = new Map();
    this.clients = new Map();
  }

  start() {
    this.startClientServer();
    this.startServerServer();
    this.startHttpServer();
  }

  shutdown() {
    for (const [, socket] of this.clients) {
      socket.destroy();
    }
    
    for (const [, socket] of this.servers) {
      socket.destroy();
    }
  }

  startClientServer() {
    const clientServer = net.createServer((socket) => this.handleClientConnection(socket));

    clientServer.on('error', (err) => {
      logger.error(`Client server error: ${err.message}`);
    });

    clientServer.listen(this.clientPort, () => {
      logger.info(`Client server listening on port ${this.clientPort}`);
    });
  }

  startServerServer() {
    const serverServer = net.createServer((socket) => this.handleServerConnection(socket));

    serverServer.on('error', (err) => {
      logger.error(`Server server error: ${err.message}`);
    });

    serverServer.listen(this.serverPort, () => {
      logger.info(`Server server listening on port ${this.serverPort}`);
    });
  }

  startHttpServer() {
    const app = express();

    app.get('/game/server/list', async (req, res) => {
      try {
        const servers = await this.serverHandler.gameServerService.getActiveServers();
        const serverList = servers.map(server => ({
          ip_address: server.ip,
          port: server.port
        }));
        res.json({ data: serverList });
      } catch (error) {
        logger.error(`Error serving room list: ${error.message}`);
        res.status(500).send('Internal Server Error');
      }
    });

    app.listen(this.httpPort, () => {
      logger.info(`HTTP server listening on port ${this.httpPort}`);
    });
  }

  handleClientConnection(socket) {
    socket.type = 'client';
    socket.initialized = false;
    logger.client(`New client connection from ${socket.remoteAddress}`);
    this.setupSocket(socket);
  }

  handleServerConnection(socket) {
    socket.type = 'server';
    socket.initialized = false;
    logger.server(`New server connection from ${socket.remoteAddress}`);
    this.setupSocket(socket);
  }

  handleDisconnect(socket) {
    logger.info(`Connection closed: ${socket.remoteAddress}`);
    if (socket.type === 'server' && socket.serverKey) {
      this.serverHandler.gameServerService.removeServer(socket.serverKey)
        .catch(err => logger.error(`Error removing server: ${err.message}`));
    }
  }

  processBuffer(socket, buffer) {
    const maxBufferSize = parseInt(process.env.MAX_BUFFER_SIZE);
    
    if (buffer.length > maxBufferSize) {
        logger.error(`Buffer overflow attempt from ${socket.remoteAddress}`);
        logger.error(bufferToHexView(buffer));
        this.handleDisconnect(socket);
        return Buffer.alloc(0);
    }

    while (buffer.length >= 4) {
        const messageLength = buffer.readInt32LE(0);
        
        if (messageLength > maxBufferSize - 4) {
            logger.error(`Message too large (${messageLength} bytes) from ${socket.remoteAddress}`);
            logger.error(bufferToHexView(buffer));
            this.handleDisconnect(socket);
            return Buffer.alloc(0);
        }
    
        if (buffer.length >= messageLength + 4) {
            const messageData = buffer.slice(4, messageLength + 4);
            buffer = buffer.slice(messageLength + 4);
          
            if (messageLength >= 5) {
              logger.info(`Received packet from ${socket.type} (${socket.remoteAddress})`);
              logger.info(`Packet length: ${messageLength} bytes`);
              logger.info(bufferToHexView(messageData));
            }
    
            try {
                const serializer = new BitSerializer(messageData);
                if (!socket.initialized) {
                    if (socket.type === 'client') {
                        this.clientHandler.handleConnect(socket, serializer);
                    } else {
                        this.serverHandler.handleConnect(socket, serializer);
                    }
                    socket.initialized = true;
                } else {
                    if (socket.type === 'client') {
                        this.clientHandler.handleMessage(socket, serializer);
                    } else {
                        this.serverHandler.handleMessage(socket, serializer);
                    }
                }
            } catch (error) {
                logger.error(`Error processing message: ${error.message}`);
                logger.error(error.stack);
            }
        } else {
            break;
        }
    }
    return buffer;
}

sendMessage(socket, data) {
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeInt32LE(data.length);
    const fullPacket = Buffer.concat([lengthBuffer, data]);
    
    logger.info(`Sending packet to ${socket.type} (${socket.remoteAddress})`);
    logger.info(`Packet length: ${data.length} bytes`);
    logger.info(bufferToHexView(fullPacket));

    socket.write(fullPacket, (err) => {
        if (err) {
            logger.error(`Error sending message: ${err.message}`);
            logger.error(err.stack);
            this.handleDisconnect(socket);
        }
    });
}

setupSocket(socket) {
    let buffer = Buffer.alloc(0);
    socket.setTimeout(parseInt(process.env.KEEPALIVE_TIMEOUT)); 
    socket.setKeepAlive(true, parseInt(process.env.KEEPALIVE_INTERVAL));
    
    socket.on('timeout', () => {
        logger[socket.type](`${socket.type} connection timed out`);
        this.handleDisconnect(socket);
    });

    socket.on('data', (data) => {
        logger.debug(`Received raw data from ${socket.type}:`);
        logger.debug(bufferToHexView(data));
        buffer = Buffer.concat([buffer, data]);
        buffer = this.processBuffer(socket, buffer);
    });

    socket.on('end', () => {
        logger.info(`Connection ended: ${socket.remoteAddress}`);
        this.handleDisconnect(socket);
    });

    socket.on('error', (err) => {
        logger[socket.type](`${socket.type} socket error: ${err.message}`);
        logger.error(err.stack);
        this.handleDisconnect(socket);
    });

    socket.on('connect', () => {
        logger[socket.type](`${socket.type} connected: ${socket.remoteAddress}`);
    });

    socket.on('close', (hadError) => {
        logger[socket.type](`${socket.type} connection closed (hadError: ${hadError}): ${socket.remoteAddress}`);
    });
}

  
}

module.exports = MasterServer;