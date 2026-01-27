const mongoose = require('mongoose');
const Measurement = require('../models/Measurement');
const dotenv = require('dotenv');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/analytics_db';

async function seedData() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB for seeding...');

        await Measurement.deleteMany({});
        console.log('Cleared existing measurements.');

        const measurements = [];
        const now = new Date();

        for (let i = 30; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(now.getDate() - i);
            date.setHours(0, 0, 0, 0);

            measurements.push({
                timestamp: date,
                field1: Math.floor(Math.random() * 100) + 50,
                field2: Math.floor(Math.random() * 200) + 100,
                field3: Math.floor(Math.random() * 50) + 10
            });
        }

        await Measurement.insertMany(measurements);
        console.log(`Successfully seeded ${measurements.length} measurements.`);

        process.exit(0);
    } catch (err) {
        console.error('Seeding error:', err);
        process.exit(1);
    }
}

seedData();
