const mongoose = require('mongoose');

const measurementSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        required: true,
        index: true
    },
    field1: {
        type: Number,
        required: true
    },
    field2: {
        type: Number,
        required: true
    },
    field3: {
        type: Number,
        required: true
    }
}, {
    collection: 'measurements'
});

module.exports = mongoose.model('Measurement', measurementSchema);
