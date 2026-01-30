const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

if (!MONGODB_URI) {
    console.error('MONGODB_URI is not set. Check your .env file.');
} else {
    mongoose.connect(MONGODB_URI)
        .then(() => {
            console.log('Connected to MongoDB');
            app.listen(PORT, () => {
                console.log(`Server running on port ${PORT}`);
            });
        })
        .catch(err => console.error('MongoDB connection error:', err));
}
