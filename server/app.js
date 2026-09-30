const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/provinces', require('./routes/provinces'));
app.use('/api/cities', require('./routes/cities'));
module.exports = app;