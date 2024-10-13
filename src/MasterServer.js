const net = require('net');
const express = require('express');

const BitSerializer = require('./BitSerializer');
const ServerHandler = require('./handlers/server');
const ClienteHandler = require('./handlers/client');

const logger = require('./utils/logger');


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
                    ip_address: server,
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
        while (buffer.length >= 4) {
            const messageLength = buffer.readInt32LE(0);

            if (buffer.length >= messageLength + 4) {
                const messageData = buffer.slice(4, messageLength + 4);
                buffer = buffer.slice(messageLength + 4);

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
        socket.write(Buffer.concat([lengthBuffer, data]), (err) => {
            if (err) {
                logger.error(`Error sending message: ${err.message}`);
                this.handleDisconnect(socket);
            } else {
                logger.info(`Sent message, length: ${data.length}`);
            }
        });
    }
}

module.exports = MasterServer;
