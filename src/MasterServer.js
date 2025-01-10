const net = require('net');
const express = require('express');

const BitSerializer = require('./BitSerializer');
const ServerHandler = require('./handlers/server');
const ClienteHandler = require('./handlers/client');

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
    constructor(clientPort, serverPort, httpPort) {
        this.servers = new Map();
        this.clients = new Map();
        
        this.serverHandler = new ServerHandler(this);
        this.clientHandler = new ClienteHandler(this);

        this.waitingRequests = new Map();
        this.clientPort = clientPort;
        this.serverPort = serverPort;
        this.httpPort = httpPort;
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
            logger.client(`Client server listening on port ${this.clientPort}`);
        });
    }

    startServerServer() {
        const serverServer = net.createServer((socket) => this.handleServerConnection(socket));

        serverServer.on('error', (err) => {
            logger.error(`Server server error: ${err.message}`);
        });

        serverServer.listen(this.serverPort, () => {
            logger.server(`Server server listening on port ${this.serverPort}`);
        });
    }

    startHttpServer() {
        const app = express();

        app.get('/game/server/list', (req, res) => {
            logger.server(`Got a room list request`);
            try {
                const roomDetails = Array.from(this.servers.values()).map(server => ({
                    ip_address: server.ip,
                    port: server.port
                }));
                res.json({ data: roomDetails });
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

    setupSocket(socket) {
        let buffer = Buffer.alloc(0);
        socket.setTimeout(30000); 
        socket.setKeepAlive(true, 10000);
        
        socket.on('timeout', () => {
            logger[socket.type](`${socket.type} connection timed out`);
            this.handleDisconnect(socket);
        });

        socket.on('data', (data) => {
            buffer = Buffer.concat([buffer, data]);
            buffer = this.processBuffer(socket, buffer);
        });

        socket.on('end', () => {
            this.handleDisconnect(socket);
        });

        socket.on('error', (err) => {
            logger[socket.type](`${socket.type} socket error: ${err.message}`);
            this.handleDisconnect(socket);
        });
    }

    handleDisconnect(socket) {
        logger.info(`Connection closed: ${socket.remoteAddress}`);
        if (socket.type === 'server' && socket.serverKey) {
            this.servers.delete(socket.serverKey);
            logger.server(`Server removed: ${socket.serverKey}`);
        }
    }

    processBuffer(socket, buffer) {
        const MAX_BUFFER_SIZE = 1024 * 16; // 16KB
        if (buffer.length > MAX_BUFFER_SIZE) {
            logger.error(`Buffer overflow attempt from ${socket.remoteAddress}`);
            this.handleDisconnect(socket);
            return Buffer.alloc(0);
        }

        while (buffer.length >= 4) {
            const messageLength = buffer.readInt32LE(0);
            
            if (messageLength > MAX_BUFFER_SIZE - 4) {
                logger.error(`Message too large (${messageLength} bytes) from ${socket.remoteAddress}`);
                this.handleDisconnect(socket);
                return Buffer.alloc(0);
            }
    
            if (buffer.length >= messageLength + 4) {
                const messageData = buffer.slice(4, messageLength + 4);
                buffer = buffer.slice(messageLength + 4);
    
                // Log received packet
                logger.info(`Received packet from ${socket.type} (${socket.remoteAddress})`);
                logger.info(`Packet length: ${messageLength} bytes`);
                logger.info(bufferToHexView(messageData));
    
                try {
                    const serializer = new BitSerializer(messageData);
    
                    if (!socket.initialized) {
                        this.initializeConnection(socket, serializer);
                        socket.initialized = true;
                    } else {
                        this.handleMessage(socket, serializer);
                    }
                } catch (error) {
                    logger.error(`Error processing message: ${error.message}`);
                }
            } else {
                break;
            }
        }
        return buffer;
    }

    initializeConnection(socket, serializer) {
        if (socket.type === 'client') {
            this.clientHandler.handleConnect(socket, serializer);
        } else if (socket.type === 'server') {
            this.serverHandler.handleConnect(socket, serializer);
        }
    }

    handleMessage(socket, serializer) {
        if (socket.type === 'client') {
            this.clientHandler.handleMessage(socket, serializer);
        } else if (socket.type === 'server') {
            this.serverHandler.handleMessage(socket, serializer);
        }
    }

    sendMessage(socket, data) {
        const lengthBuffer = Buffer.alloc(4);
        lengthBuffer.writeInt32LE(data.length);
        const fullPacket = Buffer.concat([lengthBuffer, data]);
        logger.info(`Sending packet to ${socket.type} (${socket.remoteAddress})`);
        logger.info(`Packet length: ${data.length} bytes`);
        logger.info(bufferToHexView(data));

        socket.write(fullPacket, (err) => {
            if (err) {
                logger.error(`Error sending message: ${err.message}`);
                this.handleDisconnect(socket);
            }
        });
    }
}

module.exports = MasterServer;
