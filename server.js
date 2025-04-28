// server.js
const express = require('express');
const bodyParser = require('body-parser');
 const routes = require('./routes'); // Import routes from controller.js
require('dotenv').config();
const cors = require("cors");
const path = require('path');

 const port = process.env.PORT || 3000;


const app = express();

const corsOptions = {
  origin: '*',  // Allow all origins, or specify a domain here
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

const uploadsDir = path.join('D:', 'erpx-TMS', 'backend', 'uploads');  // The absolute path to the uploads folder

app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res, path) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // allow from all origins
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
  }
}));
// Middleware to parse JSON bodies
app.use(bodyParser.json());
app.use(express.json()); 

// Use the routes defined in routes.js
app.use('/api', routes); 

// Start the server

// const port = 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${port}`);
});
