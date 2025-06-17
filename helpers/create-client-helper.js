const axios = require("axios");
const fs = require("fs");
const path = require("path");
const qrcode = require("qrcode-terminal");
const QRCode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");

const Message = require("../models/Message");
const WhatsAppClient = require("../models/WhatsAppClient");

exports.createClient = async function (userId) {
  return new Promise(async (resolve, reject) => {
    const client = new Client({
      authStrategy: new LocalAuth({ clientId: userId }),
      puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
    });

    const state = { client, qr: null, isAuthenticated: false };
    console.log(
      `Creating client for userId: ${userId}`,
      !(await WhatsAppClient.findOne({ userId }))
    );
    if (!(await WhatsAppClient.findOne({ userId }))) {
      console.log(`Inserting new client for userId: ${userId}`);
      await WhatsAppClient.insertOne({ userId }, state);
    }
    console.log(`Client created for userId: ${userId}`);

    client.on("qr", async (qr) => {
      qrcode.generate(qr, { small: true }); // TODO: Will remove this line later (Used for getting QR code in terminal)
      try {
        state.qr = await QRCode.toDataURL(qr);
        await WhatsAppClient.findOneAndUpdate({ userId }, { qr: state.qr });
        resolve(state.qr);
      } catch (err) {
        reject("QR Code generation failed");
      }
    });

    client.on("authenticated", async () => {
      console.log(`Authenticated: ${userId}`);
      try {
        await axios.post(
          "http://localhost:8888/client/personal-whatsapps/notify.json",
          {
            userId,
            status: "success",
          }
        );
      } catch (err) {
        console.log("Error while sending notification", err.message);
      }

      try {
        //Store or update in MongoDB using Mongoose
        await WhatsAppClient.findOneAndUpdate(
          { userId },
          {
            isAuthenticated: true,
            qr: null, // Clear QR code after authentication
            updatedAt: new Date(),
          },
          {
            new: true, // Return updated document
          }
        );
      } catch (error) {
        console.log("Error during authentication:", error.message);
      }
    });

    client.on("loading_screen", async () => {
      console.log(`Loading screen for ${userId}`);
      try {
        await axios.post(
          "http://localhost:8888/client/personal-whatsapps/notify.json",
          {
            userId,
            status: "loading",
          }
        );
      } catch (error) {
        console.log("Error during loading screen:", error.message);
      }
    });

    client.on("auth_failure", async (message) => {
      console.log(`Authentication failure for ${userId}: ${message}`);
      try {
        axios.post(
          "http://localhost:8888/client/personal-whatsapps/notify.json",
          {
            userId,
            status: "failed",
            message: "Failed to authenticate, Please try again",
          }
        );
      } catch (error) {
        console.error("Error during auth failure notification:", error.message);
      }

      state.isAuthenticated = false;
      state.qr = null;

      // Update DB on failure
      try {
        await WhatsAppClient.findOneAndUpdate(
          { userId },
          {
            isAuthenticated: false,
            updatedAt: new Date(),
          }
        );
      } catch (error) {
        console.log("Error updating mongoDB on auth failure", error.message);
      }
    });

    client.on("message_create", async (message) => {
      const { from, fromMe, body, timestamp } = message;
      console.log(message);
      const messageData = {
        userId,
        chatId: from,
        sender: fromMe ? "me" : from,
        message: body,
        timestamp: new Date(timestamp * 1000).toLocaleString(),
        createdAt: new Date(timestamp * 1000),
      };
      try {
        const res = await Message.create(messageData);
        console.log("Message saved:", res);
      } catch (err) {
        console.error("Error saving message:", err);
      }
    });

    client.on("disconnected", async (reason) => {
      console.log(`Client: ${userId} disconnected`, reason);
      try {
        axios.post(
          "http://localhost:8888/client/personal-whatsapps/notify.json",
          {
            userId,
            status: "disconnect",
            message: "Disconnected",
          }
        );
      } catch (error) {
        console.error("Error during auth failure notification:", error.message);
      }

      try {
        await client.destroy();
        console.log(`Client destroying for user: ${userId}`);
        const authDir = path.join(".wwebjs_auth", `session-${userId}`);
        if (fs.existsSync(authDir)) {
          fs.rmSync(authDir, { recursive: true, force: true });
        }
        WhatsAppClient.deleteOne({ userId });

        //Update DB on disconnect
        await WhatsAppClient.findOneAndUpdate(
          { userId },
          {
            isAuthenticated: false,
            updatedAt: new Date(),
          }
        );

        console.log(
          `Whasapp Client state updated in mongoDb for disconnect user: ${userId}`
        );
      } catch (error) {
        console.error(
          "Error cleaning up auth directory or destroying the client session:",
          error.message
        );
      }
    });

    client.initialize();
  });
};

exports.restoreSessions = async function () {
  try {
    const sessions = await WhatsAppClient.find({ isAuthenticated: true });

    for (const session of sessions) {
      try {
        console.log(`Restoring session for ${session.userId}`);
        await createClient(session.userId);
      } catch (error) {
        console.error(
          `Failed to restore session for ${session.userId}:`,
          error.message
        );
        await WhatsAppClient.findOneAndUpdate(
          { userId: session.userId },
          { isAuthenticated: false, updatedAt: new Date() }
        );
      }
    }
  } catch (error) {
    console.error("Error restoring sessions:", error.message);
  }
};
