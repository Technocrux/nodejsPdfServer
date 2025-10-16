# nodejsPdfServer

A Node.js server that provides a POST endpoint to execute web pages using Puppeteer. This server opens URLs, runs all scripts and CSS as a normal browser would, and waits for full page execution.

## Features

- **POST /runPdf**: Execute a URL with Puppeteer, waiting for all resources to load and scripts to execute
- Full browser simulation with Puppeteer
- Waits for network idle to ensure complete page execution
- Proper error handling and validation

## Installation

```bash
npm install
```

## Usage

### Start the Server

```bash
npm start
```

The server will start on port 3000 by default (or the PORT environment variable if set).

### API Endpoints

#### POST /runPdf

Execute a URL with Puppeteer. The server will:
1. Open the URL in a headless browser
2. Wait for all resources (scripts, CSS, images) to load
3. Wait for network to be idle (networkidle0)
4. Allow additional time for async operations
5. Close the page and return the result

**Request:**

```bash
curl -X POST http://localhost:3000/runPdf \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

**Request Body:**
```json
{
  "url": "https://example.com"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Page executed successfully",
  "url": "https://example.com"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message",
  "details": "Detailed error information"
}
```

#### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

#### GET /

Returns API information and available endpoints.

## Environment Variables

- `PORT`: Server port (default: 3000)

## Use Case

This server is designed for scenarios where you need to:
- Execute web pages that load data and run JavaScript
- Wait for pages that make API calls after loading
- Handle pages that auto-close after completing their operations
- Simulate a real browser environment for testing or automation

## Requirements

- Node.js (v14 or higher recommended)
- Chrome/Chromium (automatically managed by Puppeteer)

## License

ISC

