// Example usage of the runPdf endpoint
// This demonstrates how to call the API from Node.js

const axios = require('axios'); // or use fetch in Node.js 18+

async function runPdf(url) {
    try {
        const response = await axios.post('http://localhost:3000/runPdf', {
            url: url
        });
        
        console.log('Success:', response.data);
        return response.data;
    } catch (error) {
        if (error.response) {
            console.error('Error:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
        throw error;
    }
}

// Example usage
runPdf('https://example.com')
    .then(result => console.log('Page executed:', result))
    .catch(error => console.error('Failed to execute page'));
