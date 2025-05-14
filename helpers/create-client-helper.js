const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const Message = require('../models/Message');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

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

      // client.on('sendSeen', () => {
      //     console.log('Message seen:');
      // });

      client.on('qr', async (qr) => {
          console.log(`QR for ${userId}`);
          qrcode.generate(qr, { small: true });
          try {
              state.qr = await QRCode.toDataURL(qr);
              // await axios.post("selldo api",{
              //   userId: userId,
              //   qrCode: state.qr
              // },{
              //   headers: {
              //     'Authorization': 'Bearer Token',
              //     'Content-Type': 'application/json'
              //   }
              // });
              resolve(state.qr);
          } catch (err) {
              reject('QR Code generation failed');
          }
      });

      client.on('authenticated', () => {
        console.log(`Authenticated: ${userId}`);
        // axios.post('http://localhost:8888/client/personal-whatsapps/connection_status', {
        //   userId,
        //   status: 'success',
        // })
        state.isAuthenticated = true;
        state.qr = null;
      });

      client.on('loading_screen', () => {
        console.log(`Loading screen for ${userId}`);
        // axios.post('http://localhost:8888/client/personal-whatsapps/connection_status', {
        //   userId,
        //   status: 'loading',
        // })
      });

      client.on('auth_failure', async (message) => {
        console.log(`Authentication failure for ${userId}: ${message}`);
        // axios.post('http://localhost:8888/client/personal-whatsapps/connection_status', {
        //   userId,
        //   status: 'failed',
        //   message: 'Failed to authenticate, Please try again'
        // })
        state.isAuthenticated = false;
        state.qr = null;
      });

      

      client.on('ready',()=>{
        console.log('Client is ready!');
        // const number = "+918169582186";
        // const text = "Test Message 2";
        // Getting chatId from the number.
        // we have to delete "+" from the beginning and add "@c.us" at the end of the number.
        // const chatId = number.substring(1) + "@c.us";
        // // Sending message.
        // client.sendMessage(chatId, text);
      })

      client.on('message_create', async (message) => {
        const { from, fromMe, body, timestamp } = message;
        console.log(message);
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


      client.on('disconnected', async (reason) => {
          console.log(`Client: ${userId} disconnected`, reason);

          console.log("1. ", this.clientSessionStore[userId]);
          try {
              // Destroy Puppeteer instance
              if (this.clientSessionStore[userId]) {
                  await this.clientSessionStore[userId].destroy();
                  this.removeClientSession(userId);
              }
          } catch (error) {
              console.error(
                  'Error destroying client session:',
                  error.message,
              );
          }

          try {
              // Clean up the local auth directory
              const authDir = path.join('.wwebjs_auth', 'session-', userId);
              if (fs.existsSync(authDir)) {
                  fs.rmSync(authDir, { recursive: true, force: true });
              }
          } catch (error) {
              console.error(
                  'Error cleaning up auth directory:',
                  error.message,
              );
          }
      });

      client.initialize();
  });
}

module.exports = {
  createClient,
};