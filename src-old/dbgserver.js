const net = require('net');
const logger = require('./utils/logger');

// Configuration
const PORT = 29997;
const HOST = '0.0.0.0'; // Listens on all network interfaces

// Create a TCP server
const server = net.createServer((socket) => {
    logger.info('Client connected');

    // Handle incoming data
    socket.on('data', (data) => {
        logger.info(`Received data from client: ${data.toString('hex')}`); // Log data in hex format
    });

    // Handle client disconnection
    socket.on('end', () => {
        logger.info('Client disconnected');
    });

    // Handle errors
    socket.on('error', (err) => {
        logger.error(`Socket error:\n${err.stack}`);
    });
});

// Start listening for connections
server.listen(PORT, HOST, () => {
    logger.info(`Server listening on ${HOST}:${PORT}`);
});

// Handle server errors
server.on('error', (err) => {
    logger.error(`Server error:\n${err.stack}`);
});
