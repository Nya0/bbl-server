const net = require('net');
const BitSerializer = require('./BitSerializer');
const MessageHandlers = require('./MessageHandlers');
const { MessageID, MessageType } = require('./utils/MessageID');
const logger = require('./utils/logger');

class MasterServer {
    constructor() {
        this.servers = new Map();
        this.clients = new Map();
        this.messageHandlers = new MessageHandlers(this);
        this.waitingRequests = new Map();
    }

    start(port) {
        const server = net.createServer((socket) => {
            console.log("bruhh!!!")
            logger.info(`New connection from ${socket.remoteAddress}`);
            let buffer = Buffer.alloc(0);

            socket.on('data', (data) => {
                logger.info(`Received data, length: ${data.length}`);
                buffer = Buffer.concat([buffer, data]);
                buffer = this.processBuffer(socket, buffer);
            });

            socket.on('end', () => {
                this.handleDisconnect(socket);
            });

            socket.on('error', (err) => {
                logger.error(`Socket error: ${err.message}`);
                this.handleDisconnect(socket);
            });

            socket.setTimeout(300000); // 5 minutes
            socket.on('timeout', () => {
                logger.info(`Connection timed out: ${socket.remoteAddress}`);
                this.handleDisconnect(socket);
                socket.end();
            });
        });

        server.on('error', (err) => {
            logger.error(`Server error: ${err.message}`);
        });

        server.listen(port, () => {
            logger.info(`BattleBit Emulated Master Server listening on port ${port}`);
        });
    }

    handleDisconnect(socket) {
        logger.info(`Connection closed: ${socket.remoteAddress}`);
        if (socket.isServer && socket.serverKey) {
            this.servers.delete(socket.serverKey);
            logger.info(`Server removed: ${socket.serverKey}`);
        }
    }

    processBuffer(socket, buffer) {
        while (buffer.length >= 4) {
            const messageLength = buffer.readInt32LE(0);
            logger.info(`Message length: ${messageLength}`);

            if (buffer.length >= messageLength + 4) {
                const messageData = buffer.slice(4, messageLength + 4);
                buffer = buffer.slice(messageLength + 4);

                logger.info(`Message data: ${messageData.toString('hex')}`);

                try {
                    const serializer = new BitSerializer(messageData);

                    if (!socket.isServer && !socket.steamID) {
                        this.handleInitialConnection(socket, serializer);
                    } else {
                        const msgID = MessageID.create(serializer)
                        const requestType = serializer.readByte()
                        logger.info(`Message ID: ${msgID.ID}, Message Type: ${msgID.TYPE}, Request Type: ${requestType}`);

                        const handler = this.messageHandlers.get(requestType);
                        if (handler) {
                            handler(socket, serializer, msgID);
                        } else {
                            logger.error(`Unknown request type: ${requestType}`);
                        }
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

    handleInitialConnection(socket, serializer) {
        const isServer = serializer.readBool();
        if (isServer) {
            this.messageHandlers.handleServerConnect(socket, serializer);
        } else {
            this.messageHandlers.handleClientConnect(socket, serializer);
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
