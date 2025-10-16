const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

/**
 * POST /runPdf
 * Accepts a URL and opens it using Puppeteer, waits for full page execution
 * 
 * Request body: { "url": "http://example.com" }
 * Response: { "success": true, "message": "Page executed successfully", "url": "..." }
 */
app.post('/runPdf', async (req, res) => {
    const { url } = req.body;

    // Validate URL parameter
    if (!url) {
        return res.status(400).json({
            success: false,
            error: 'URL parameter is required'
        });
    }

    // Validate URL format
    try {
        new URL(url);
    } catch (error) {
        return res.status(400).json({
            success: false,
            error: 'Invalid URL format'
        });
    }

    let browser = null;

    try {
        console.log(`Starting to process URL: ${url}`);

        // Launch Puppeteer browser
        browser = await puppeteer.launch({
            headless: true,
            executablePath: '/usr/bin/google-chrome',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();

        // Set a reasonable viewport
        await page.setViewport({
            width: 1280,
            height: 720
        });

        console.log(`Navigating to URL: ${url}`);

        // Navigate to the URL and wait for network to be idle
        // This ensures all resources (scripts, CSS, etc.) are loaded
        await page.goto(url, {
            waitUntil: 'networkidle0', // Wait until network is idle (no more than 0 connections for at least 500ms)
            timeout: 60000 // 60 second timeout
        });

        console.log('Page loaded, waiting for any async operations...');

        // Wait a bit more to ensure any async operations complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('Page execution completed successfully');

        // Close browser
        await browser.close();
        browser = null;

        // Send success response
        res.json({
            success: true,
            message: 'Page executed successfully',
            url: url
        });

    } catch (error) {
        console.error('Error processing URL:', error);

        // Close browser if it's still open
        if (browser) {
            try {
                await browser.close();
            } catch (closeError) {
                console.error('Error closing browser:', closeError);
            }
        }

        // Send error response
        res.status(500).json({
            success: false,
            error: 'Failed to process URL',
            details: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Root endpoint with API information
app.get('/', (req, res) => {
    res.json({
        name: 'Node.js PDF Server',
        version: '1.0.0',
        endpoints: {
            'POST /runPdf': 'Execute a URL with Puppeteer. Body: { "url": "http://example.com" }',
            'GET /health': 'Health check endpoint'
        }
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`POST endpoint available at: http://localhost:${PORT}/runPdf`);
});
