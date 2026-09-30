const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/provinces', require('./routes/provinces'));
app.use('/api/cities', require('./routes/cities'));
app.use('/api/places', require('./routes/places'));
app.use('/api/search', require('./routes/search'));
module.exports = app;