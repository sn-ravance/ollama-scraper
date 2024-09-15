const axios = require('axios');

(async () => {
  try {
    console.log('Testing connection to Flask API on port 11400...');
    const response = await axios.post(
      'http://localhost:11400/ollama',
      {
        prompt: 'test',
        message: 'testing connection',
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000, // Set a longer timeout to test connection stability
      }
    );

    console.log('Response from Flask:', response.data);
  } catch (error) {
    console.error('Error during connection test:', error.message);
    if (error.response) {
      console.error('Error response data:', error.response.data);
    } else if (error.request) {
      console.error('Error request details:', error.request);
    } else {
      console.error('Error message:', error.message);
    }
  }
})();
