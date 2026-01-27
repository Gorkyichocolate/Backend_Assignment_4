const express = require('express');
const router = express.Router();
const Measurement = require('../models/Measurement');
const moment = require('moment');
const axios = require('axios');

const isValidField = (field) => ['field1', 'field2', 'field3'].includes(field);

router.get('/measurements', async (req, res) => {
    try {
        const { field, start_date, end_date, page, limit } = req.query;

        if (!field || !isValidField(field)) {
            return res.status(400).json({ error: 'Invalid or missing field name (field1, field2, field3)' });
        }

        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'start_date and end_date are required' });
        }

        const start = moment(start_date, 'YYYY-MM-DD', true).startOf('day');
        const end = moment(end_date, 'YYYY-MM-DD', true).endOf('day');

        if (!start.isValid() || !end.isValid()) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        }

        if (start.isAfter(end)) {
            return res.status(400).json({ error: 'start_date must be earlier than or equal to end_date' });
        }

        const query = {
            timestamp: {
                $gte: start.toDate(),
                $lte: end.toDate()
            }
        };

        const pageNum = Number.parseInt(page, 10);
        const limitNum = Number.parseInt(limit, 10);
        const usePagination = Number.isFinite(pageNum) || Number.isFinite(limitNum);
        const safePage = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;
        const safeLimit = Number.isFinite(limitNum) && limitNum > 0 ? Math.min(limitNum, 500) : 100;

        const baseQuery = Measurement.find(query)
            .select(`timestamp ${field} -_id`)
            .sort({ timestamp: 1 });

        let data = [];
        let total = 0;

        if (usePagination) {
            total = await Measurement.countDocuments(query);
            data = await baseQuery
                .skip((safePage - 1) * safeLimit)
                .limit(safeLimit);
        } else {
            data = await baseQuery;
        }

        if (data.length === 0) {
            return res.json([]);
        }

        if (usePagination) {
            return res.json({
                data,
                pagination: {
                    page: safePage,
                    limit: safeLimit,
                    total
                }
            });
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

router.post('/measurements/weather', async (req, res) => {
    try {
        const { city, start_date, end_date } = req.body;
        if (!city) {
            return res.status(400).json({ error: 'City name is required' });
        }

        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'start_date and end_date are required' });
        }

        const start = moment(start_date, 'YYYY-MM-DD', true).startOf('day');
        const end = moment(end_date, 'YYYY-MM-DD', true).endOf('day');

        if (!start.isValid() || !end.isValid()) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        }

        if (start.isAfter(end)) {
            return res.status(400).json({ error: 'start_date must be earlier than or equal to end_date' });
        }

        const maxDays = 30;
        const daysCount = Math.min(end.diff(start, 'days') + 1, maxDays);
        const dates = [];
        for (let i = 0; i < daysCount; i++) {
            dates.push(moment(start).add(i, 'days').format('YYYY-MM-DD'));
        }

        const measurements = [];

        for (const date of dates) {
            const url = `http://api.weatherapi.com/v1/history.json?key=${WEATHER_API_KEY}&q=${city}&dt=${date}`;
            const response = await axios.get(url);
            const history = response.data?.forecast?.forecastday?.[0];

            if (!history || !history.hour || history.hour.length === 0) {
                continue;
            }

            const hourData = history.hour[12] || history.hour[0];
            measurements.push({
                timestamp: new Date(hourData.time_epoch * 1000),
                field1: hourData.temp_c,
                field2: hourData.humidity,
                field3: hourData.pressure_mb
            });
        }

        if (measurements.length === 0) {
            return res.status(404).json({ error: 'No historical data returned' });
        }

        await Measurement.insertMany(measurements);

        res.json({
            message: 'Weather history recorded successfully',
            data: {
                city,
                days: measurements.length
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch or save weather data', details: err.message });
    }
});

router.get('/measurements/metrics', async (req, res) => {
    try {
        const { field, start_date, end_date } = req.query;

        if (!field || !isValidField(field)) {
            return res.status(400).json({ error: 'Invalid or missing field name (field1, field2, field3)' });
        }

        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'start_date and end_date are required' });
        }

        const start = moment(start_date, 'YYYY-MM-DD', true).startOf('day');
        const end = moment(end_date, 'YYYY-MM-DD', true).endOf('day');

        if (!start.isValid() || !end.isValid()) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        }

        if (start.isAfter(end)) {
            return res.status(400).json({ error: 'start_date must be earlier than or equal to end_date' });
        }

        const matchStage = {
            $match: {
                timestamp: {
                    $gte: start.toDate(),
                    $lte: end.toDate()
                }
            }
        };

        const aggregate = await Measurement.aggregate([
            matchStage,
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
            return res.json({
                data: {
                    average: 0,
                    min: 0,
                    max: 0,
                    stdDev: 0
                }
            });
        }

        const result = aggregate[0];

        res.json({
            data: {
                average: parseFloat((result.avg || 0).toFixed(2)),
                min: parseFloat((result.min || 0).toFixed(2)),
                max: parseFloat((result.max || 0).toFixed(2)),
                stdDev: parseFloat((result.stdDev || 0).toFixed(2))
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

module.exports = router;
