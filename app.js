const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();

// Set the view engine to EJS for rendering HTML templates
app.set('view engine', 'ejs');

// Middleware to parse incoming requests and serve static files
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve static files from the public directory

// Function to find the running Flask API port specifically at 11400
async function findFlaskPort() {
  console.log('Attempting to connect to Flask API on port 11400...');

  try {
    // Attempt to connect to the Flask API endpoint on port 11400
    const response = await axios.post(
      'http://localhost:11400/ollama',
      {
        prompt: 'test', // Adjust if needed
        message: 'testing connection',
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 500000, // Increased timeout to 10 seconds
      }
    );

    if (response.status === 200) {
      console.log(`Flask API found at port 11400`);
      return 11400;
    }
  } catch (error) {
    console.error(`Error connecting to Flask on port 11400:`, error.message);
    // Log more details about the error
    if (error.response) {
      console.error('Error response data:', error.response.data);
    } else if (error.request) {
      console.error('Error request details:', error.request);
    } else {
      console.error('Error message:', error.message);
    }
  }

  throw new Error('No available Flask API found at port 11400.');
}

// Render the main page
app.get('/', (req, res) => {
  res.render('index', { fields: [], data: {} }); // Render the main page with empty fields and data
});

// Handle scraping request when the user submits the form
app.post('/scrape', async (req, res) => {
  const { model, url, fields } = req.body;

  // Convert fields to an array by splitting the input string
  const fieldsArray = fields.split(',').map((field) => field.trim());

  try {
    // Find the Flask API port dynamically
    const flaskPort = await findFlaskPort();

    // Launch Puppeteer to scrape the web page
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);

    // Extract data from the page based on user-defined fields
    const extractedData = await page.evaluate((fields) => {
      const results = {};
      fields.forEach((field) => {
        results[field] = document.querySelector(field)?.innerText || 'Not found';
      });
      return results;
    }, fieldsArray);

    await browser.close();

    // Ensure the data matches what Flask expects
    const response = await axios.post(`http://localhost:${flaskPort}/ollama`, {
      message: JSON.stringify(extractedData), // Make sure the format matches the expectation
    }, {
      headers: { 'Content-Type': 'application/json' },
    });

    // Log the response data from Flask API to the console
    console.log('Response from Flask API:', response.data);

    // Check if the response from the Flask API is successful
    if (response.data && response.data.response) {
      const formattedData = response.data.response; // Use the formatted response from the Flask API
      res.render('index', { fields: fieldsArray, data: formattedData });
    } else {
      res.status(500).send('Failed to process data with Ollama.');
    }
  } catch (error) {
    console.error('Error during scraping:', error);
    res.status(500).send('An error occurred during scraping.');
  }
});

// Endpoint to download extracted data as a CSV file
app.get('/download', (req, res) => {
  const csvData = req.query.csvData;
  const filePath = path.join(__dirname, 'results.csv');

  // Write the CSV data to a file and prompt the user to download it
  fs.writeFileSync(filePath, csvData);

  res.download(filePath, 'results.csv', (err) => {
    if (err) {
      console.error('Error downloading the CSV file:', err);
      res.status(500).send('Failed to download CSV.');
    }
  });
});

module.exports = app; // Export the app module for use in server.js
