const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const Message = require('../models/Message');

function createClient(userId, clients) {

  return new Promise((resolve, reject) => {
      const client = new Client({
          authStrategy: new LocalAuth({ clientId: userId }),
          puppeteer: {
              headless: true,
              args: ['--no-sandbox', '--disable-setuid-sandbox'],
          }
        });

      const state = { client, qr: null, isAuthenticated: false };
      clients.set(userId, state);

      client.on('qr', async (qr) => {
          console.log(`QR for ${userId}`);
          try {
              state.qr = await QRCode.toDataURL(qr);
              resolve(state.qr); // resolve once QR is ready
          } catch (err) {
              reject('QR Code generation failed');
          }
      });

      client.on('authenticated', () => {
          console.log(`Authenticated: ${userId}`);
          state.isAuthenticated = true;
          state.qr = null;
        });

      client.on('ready', () => {
          console.log(`WhatsApp client ready: ${userId}`);
      });

      client.on('message_create', async (message) => {
          const { from, fromMe, body, timestamp } = message;
          const messageData = {
              userId,
              chatId: from,
              sender: fromMe ? 'me' : from,
              message: body,
              timestamp: new Date(timestamp * 1000).toLocaleString(),
              createdAt: new Date(timestamp * 1000),
          };
          try {
              const res = await Message.create(messageData);
              console.log('Message saved:', res);
          } catch (err) {
              console.error('Error saving message:', err);
          }
      });

      client.initialize();
  });
}

module.exports = {
  createClient,
};