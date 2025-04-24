
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const Message = require('./models/Message');
const { createClient } = require('./helpers/create-client-helper');

require('dotenv').config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

const app = express();
app.use(cors());
app.use(express.json());


// TODO: have the permanent storage of authenticated clients
const clients = new Map();



// === API ROUTES ===

app.post('/connect', async (req, res) => {
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ error: 'userId is required' });

    let state = clients.get(userId);

    if (state) {
        if (state.isAuthenticated) {
            return res.json({ status: 'authenticated' });
        }
        if (state.qr) {
            return res.json({ status: 'pending', qr: state.qr });
        }
        return res.json({ status: 'loading' });
    }

    // Create new client & get QR directly
    try {
        const qr = await createClient(userId, clients);
        return res.json({ status: 'pending', qr });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to generate QR' });
    }
});


// Get recent messages of a user
app.get('/messages/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
        const messages = await Message.find({
            userId,
            createdAt: { $gte: twelveHoursAgo }
        }).sort({ createdAt: -1 });

        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

app.listen(5000, () => {
    console.log('Server running at http://localhost:5000');
});
