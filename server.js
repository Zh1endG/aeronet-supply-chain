const express = require('express');
const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// =========================================================================
// ⚠️ ACTION REQUIRED: PASTE YOUR CLOUD CONNECTION STRINGS HERE
// =========================================================================

// 1. Cloud PostgreSQL Connection (Neon)
const pgPool = new Pool({
    connectionString: 'PASTE_YOUR_NEON_CONNECTION_STRING_HERE',
    ssl: { rejectUnauthorized: false } // Required for cloud databases
});

// 2. Cloud MongoDB Connection (Atlas)
const mongoUrl = 'PASTE_YOUR_MONGODB_DRIVERS_STRING_HERE'; 
const mongoClient = new MongoClient(mongoUrl);
const dbName = 'AeroNet_Docs';

// =========================================================================
// API ENDPOINTS (Keep these intact!)
// =========================================================================

// GET: Fetch Personnel from PostgreSQL Cloud
app.get('/api/users', async (req, res) => {
    try {
        const result = await pgPool.query('SELECT * FROM users ORDER BY empid ASC;');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET: Fetch IoT Stream from MongoDB Cloud
app.get('/api/telemetry', async (req, res) => {
    try {
        await mongoClient.connect();
        const db = mongoClient.db(dbName);
        const data = await db.collection('iot_telemetry').find({}).toArray();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST: Add Certification Sign-off & Log Action
app.post('/api/certify', async (req, res) => {
    const { itemID, empID, status } = req.body;
    try {
        // A. Write permanent certification entry to MongoDB
        await mongoClient.connect();
        const db = mongoClient.db(dbName);
        await db.collection('certifications').insertOne({
            itemID, empID, status, signedAt: new Date()
        });

        // B. Write immutable audit log event to PostgreSQL Cloud
        const logAction = `Certified Item ${itemID} as ${status}`;
        await pgPool.query('INSERT INTO audit_logs (empid, action) VALUES ($1, $2);', [empID, logAction]);

        console.log(`[AUDIT LOGGED] User ${empID} executed sign-off.`);
        res.json({ message: "Successfully Certified and Cloud Logged!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Server Node
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Brain is active on port ${PORT}`);
});