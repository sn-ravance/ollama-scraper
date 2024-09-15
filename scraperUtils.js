const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');
const redis = require('redis');
require('dotenv').config();

// Set up Redis connection using environment variables
const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

// Function to fetch and clean HTML using Puppeteer and Cheerio
async function fetchHTML(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });
  const content = await page.content();
  await browser.close();

  // Use Cheerio to parse and clean the HTML
  const $ = cheerio.load(content);

  // Remove unnecessary elements to reduce size
  $('script').remove();
  $('style').remove();
  $('meta').remove();
  $('link').remove();
  $('comment').remove();

  // Extract the main content and limit the length to avoid exceeding token limits
  const mainContent = $('body').text().substring(0, 5000); // Adjust size as needed

  return mainContent;
}

// Function to save raw HTML data to Redis instead of a file
async function saveRawDataToRedis(key, data) {
  try {
    await redisClient.connect();
    await redisClient.set(key, data);
    console.log(`Raw data saved in Redis with key: ${key}`);
  } catch (error) {
    console.error('Error saving data to Redis:', error);
  } finally {
    await redisClient.disconnect();
  }
}

// Function to retrieve raw HTML data from Redis
async function getRawDataFromRedis(key) {
  try {
    await redisClient.connect();
    const data = await redisClient.get(key);
    console.log(`Raw data retrieved from Redis with key: ${key}`);
    return data;
  } catch (error) {
    console.error('Error retrieving data from Redis:', error);
    return null;
  } finally {
    await redisClient.disconnect();
  }
}

// Function to extract data using the Ollama model via the Flask API
async function extractDataWithOllama(htmlContent, fields, model = 'llama3.1') {
  const flaskApiUrl = 'http://localhost:11400/ollama';

  // Create the payload to send to the Flask API
  const payload = {
    html: htmlContent,
    message: `Extract fields: ${fields.join(', ')}`,
    model,
  };

  try {
    // Send the data to the Flask API and let the model process it
    const response = await axios.post(flaskApiUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000000,
    });

    // Parse the response from the Flask API
    if (response.data && response.data.response) {
      let rawContent = response.data.response.trim();

      // Log the raw response for debugging
      console.log('Raw response from Ollama:', rawContent);

      // Clean up the response by adding quotes around keys to make it valid JSON
      rawContent = rawContent.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');

      // Attempt to parse the cleaned response as JSON
      try {
        const extractedData = JSON.parse(rawContent);
        console.log('Extracted Data:', extractedData); // Log the data to verify its structure
        return extractedData;
      } catch (jsonError) {
        console.error('Unexpected response format after cleanup:', rawContent);
        throw new Error('Failed to parse JSON response from Ollama model.');
      }
    } else {
      console.error('Unexpected response format from Ollama model:', response.data);
      throw new Error('Failed to extract data using the Ollama model.');
    }
  } catch (error) {
    console.error('Error communicating with the Ollama model:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    } else {
      console.error('Request error:', error.message);
    }
    throw new Error('Error communicating with the Ollama model.');
  }
}

// Save formatted data to Redis
async function saveFormattedDataToRedis(key, data) {
  try {
    await redisClient.connect();
    await redisClient.set(key, JSON.stringify(data));
    console.log(`Formatted data saved in Redis with key: ${key}`);
  } catch (error) {
    console.error('Error saving formatted data to Redis:', error);
    throw error;
  } finally {
    await redisClient.disconnect();
  }
}

// Function to retrieve formatted data from Redis
async function getFormattedDataFromRedis(key) {
  try {
    await redisClient.connect();
    const data = await redisClient.get(key);
    console.log(`Formatted data retrieved from Redis with key: ${key}`);
    return JSON.parse(data);
  } catch (error) {
    console.error('Error retrieving formatted data from Redis:', error);
    throw error;
  } finally {
    await redisClient.disconnect();
  }
}

module.exports = {
  fetchHTML,
  extractDataWithOllama,
  saveRawDataToRedis,
  getRawDataFromRedis,
  saveFormattedDataToRedis,
  getFormattedDataFromRedis,
};
