const WhatsAppClient = require("../models/WhatsAppClient");
const { createClient } = require("../helpers/create-client-helper");

exports.connectSession = async (req, res) => {
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

  try {
    const qr = await createClient(userId);
    return res.json({ status: "pending", qr });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to generate QR" });
  }
};
