import dotenv from 'dotenv';
import app from './server/index.js';
import client from './bot/index.js';

dotenv.config();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1'; // Listen on localhost/127.0.0.1 by default for security

// Start server
app.listen(PORT, HOST, () => {
  console.log(`[Server] Le serveur Express écoute sur http://${HOST}:${PORT}`);
});
