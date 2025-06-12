const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const WhatsAppClient = require("./models/WhatsAppClient");

const Message = require("./models/Message");
const { createClient } = require("./helpers/create-client-helper");
const { Client } = require("whatsapp-web.js");

require("dotenv").config();

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const app = express();
app.use(cors());
app.use(express.json());

// In-memory storage for active WhatsApp clients
const clients = new Map();

// Restore clients from MongoDB
async function restoreSessions() {
  try{
    const sessions = await WhatsAppClient.find({isAuthenticated: true});

    if (sessions.length === 0) {
      console.log("No authenticated sessions found to restore.");
      return;
    }else{
      for(const session of sessions){
        console.log(`Restoring session for ${session.userId}`);
        try{
          await createClient(session.userId);
        }catch(error){
          console.error(`Failed to restore session for ${session.userId}:`, error.message);
          
          // Update the session as not authenticated if restoration fails
          await WhatsAppClient.findOneAndUpdate(
            { userId: session.userId },
            { 
              isAuthenticated: false,
              updatedAt: new Date()
            }
          );
        }
      }
    }
  } catch(error){
    console.error("Error restoring sessions:", error.message);
  }
}

restoreSessions();

// === API ROUTES ===
app.post("/connect", async (req, res) => {
  const { userId } = req.body;

  if (!userId) return res.status(400).json({ error: "userId is required" });

  let state = await WhatsAppClient.findOne({ userId });

  if (state) {
    if (state.isAuthenticated) {
      return res.json({ status: "authenticated" });
    }
    if (state.qr) {
      return res.json({ status: "pending", qr: state.qr });
    }
  }
  // Create new client & get QR directly
  try {
    const qr = await createClient(userId);
    return res.json({ status: "pending", qr });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to generate QR" });
  }
});

// Get recent messages of a user
app.get("/messages/:userId", async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }
  const { client, qr, isAuthenticated } = await WhatsAppClient.findOne({ userId });
  console.log("Messages for userId:", userId);
  try {
    const messages = await Message.find({userId}).sort({ createdAt: -1 }).limit(40);
    console.log("message count:",messages.length);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

app.post("/messages/send", async (req, res) => {
  const { userId, number, message, sender } = req.body;

  if (!userId || !number || !message || !sender) {
    return res
      .status(400)
      .json({ error: "userID, number, message, and sender are required" });
  }

  const state = await WhatsAppClient.findOne({ userId });
  console.log("state:", state.isAuthenticated);

  if (!state || !state.isAuthenticated) {
    return res
      .status(400)
      .json({ error: "WhatsApp client not ready or not authenticated" });
  }

  try {
    const chatId = number.replace("+", "") + "@c.us";

    await state.client.sendMessage(chatId, message);

    const newMessage = new Message({
      userId,
      chatId,
      sender,
      message,
      timestamp: new Date().toISOString(),
    });

    await newMessage.save();

    return res.status(200).json({
      success: true,
      msg: "Message sent and saved",
      data: newMessage,
    });
  } catch (err) {
    console.error("Error sending message:", err);
    return res.status(500).json({ error: "Failed to send WhatsApp message" });
  }
});

app.listen(5000, () => {
  console.log("Server running at http://localhost:5000");
});
