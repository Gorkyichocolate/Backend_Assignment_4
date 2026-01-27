const express = require('express');
const router = express.Router();
const Measurement = require('../models/Measurement');
const moment = require('moment');
const axios = require('axios');

const isValidField = (field) => ['field1', 'field2', 'field3'].includes(field);

router.get('/measurements', async (req, res) => {
    try {
        const { field, start_date, end_date } = req.query;

        if (!field || !isValidField(field)) {
            return res.status(400).json({ error: 'Invalid or missing field name (field1, field2, field3)' });
        }

        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'start_date and end_date are required' });
        }

        const start = moment(start_date, 'YYYY-MM-DD', true);
        const end = moment(end_date, 'YYYY-MM-DD', true);

        if (!start.isValid() || !end.isValid()) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        }

        const query = {
            timestamp: {
                $gte: start.toDate(),
                $lte: end.toDate()
            }
        };

        const data = await Measurement.find(query)
            .select(`timestamp ${field} -_id`)
            .sort({ timestamp: 1 });

        if (data.length === 0) {
            return res.status(404).json({ error: 'No data found for the selected range' });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

router.post('/measurements/weather', async (req, res) => {
    try {
        const { city } = req.body;
        if (!city) {
            return res.status(400).json({ error: 'City name is required' });
        }

        const url = `http://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${city}`;
        const response = await axios.get(url);
        const { temp_c, humidity, pressure_mb } = response.data.current;

        const newMeasurement = new Measurement({
            timestamp: new Date(),
            field1: temp_c,
            field2: humidity,
            field3: pressure_mb
        });

        await newMeasurement.save();

        res.json({
            message: 'Weather data recorded successfully',
            data: {
                city: response.data.location.name,
                temp: temp_c,
                humidity,
                pressure: pressure_mb
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch or save weather data', details: err.message });
    }
});

router.get('/measurements/metrics', async (req, res) => {
    try {
        const { field } = req.query;

        if (!field || !isValidField(field)) {
            return res.status(400).json({ error: 'Invalid or missing field name (field1, field2, field3)' });
        }

        const aggregate = await Measurement.aggregate([
            {
                $group: {
                    _id: null,
                    avg: { $avg: `$${field}` },
                    min: { $min: `$${field}` },
                    max: { $max: `$${field}` },
                    stdDev: { $stdDevPop: `$${field}` }
                }
            }
        ]);

        if (aggregate.length === 0) {
            return res.status(404).json({ error: 'No data available to calculate metrics' });
        }

        const result = aggregate[0];
        delete result._id;

        res.json({
            field,
            metrics: {
                average: result.avg.toFixed(2),
                min: result.min,
                max: result.max,
                stdDev: result.stdDev.toFixed(2)
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

module.exports = router;
