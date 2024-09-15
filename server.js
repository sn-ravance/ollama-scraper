const app = require('./app');
const net = require('net');

// Define the port range to check
const startPort = 3000;
const endPort = 3999;

// Function to find the first available port in the range
const findAvailablePort = (port) => {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    // Attempt to listen on the given port
    server.listen(port, () => {
      server.close(() => resolve(port)); // If successful, resolve with the port
    });

    // If the port is in use, move to the next port
    server.on('error', () => {
      if (port < endPort) {
        resolve(findAvailablePort(port + 1)); // Recursively check the next port
      } else {
        reject(new Error('No available ports found in the range 3000-3999'));
      }
    });
  });
};

// Find the first available port and start the server
findAvailablePort(startPort)
  .then((port) => {
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error(err.message);
  });
