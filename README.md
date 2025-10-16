# nodejsPdfServer

A Node.js server that provides a robust queue system for executing web pages using Puppeteer. Jobs are queued in a SQLite database and processed sequentially by a background worker. This server opens URLs, runs all scripts and CSS as a normal browser would, and waits for full page execution.

## Features

- **Queue System**: Jobs are queued in SQLite for persistence and processed sequentially
- **POST /runPdf**: Add a URL to the job queue for execution with Puppeteer
- **GET /queue**: Retrieve all jobs with their states and timestamps
- **GET /queue-view**: Visual HTML dashboard to monitor the queue in real-time
- **CORS Enabled**: All endpoints support Cross-Origin Resource Sharing
- **Full browser simulation** with Puppeteer
- **Waits for network idle** to ensure complete page execution
- **Proper error handling** and validation
- **Azure App Service compatible** with local SQLite persistence

## Installation

```bash
npm install
```

## Job States

Jobs in the queue go through the following states:

- **Waiting**: Job has been added to the queue and is waiting to be processed
- **Running**: Job is currently being processed by the background worker
- **Executed**: Job has completed processing (successfully or with errors)

## Database

The application uses SQLite for job persistence. The database file (`jobs.db`) is created automatically in the application directory. This file stores:

- Job ID (auto-incremented)
- URL to process
- Current state (Waiting, Running, Executed)
- Timestamp when job was requested
- Timestamp when job started processing
- Timestamp when job finished processing

The SQLite database is compatible with Azure App Service and other hosting environments.

## Usage

### Start the Server

```bash
npm start
```

The server will start on port 3000 by default (or the PORT environment variable if set).

### API Endpoints

#### POST /runPdf

Add a URL to the job queue for execution with Puppeteer. The job will be processed asynchronously by a background worker. Jobs are processed sequentially in the order they are received.

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
  "jobId": 1,
  "message": "Job added to queue",
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

#### GET /queue

Retrieve all jobs with their current states and timestamps. This endpoint returns the complete job history.

**Request:**

```bash
curl http://localhost:3000/queue
```

**Success Response:**
```json
{
  "success": true,
  "jobs": [
    {
      "id": 1,
      "url": "https://example.com",
      "state": "Executed",
      "requestedAt": "2025-10-16T13:00:00.000Z",
      "startedAt": "2025-10-16T13:00:01.000Z",
      "finishedAt": "2025-10-16T13:00:15.000Z"
    },
    {
      "id": 2,
      "url": "https://google.com",
      "state": "Running",
      "requestedAt": "2025-10-16T13:01:00.000Z",
      "startedAt": "2025-10-16T13:01:05.000Z",
      "finishedAt": null
    },
    {
      "id": 3,
      "url": "https://github.com",
      "state": "Waiting",
      "requestedAt": "2025-10-16T13:02:00.000Z",
      "startedAt": null,
      "finishedAt": null
    }
  ]
}
```

#### GET /queue-view

Serves an HTML page that visualizes the job queue with:
- Real-time statistics (total, waiting, running, executed jobs)
- Color-coded job states
- Auto-refresh every 2 seconds
- Responsive design

Simply open `http://localhost:3000/queue-view` in your browser to view the queue dashboard.

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

**Response:**
```json
{
  "name": "Node.js PDF Server with Queue System",
  "version": "2.0.0",
  "endpoints": {
    "POST /runPdf": "Add a URL to the job queue. Body: { \"url\": \"http://example.com\" }",
    "GET /queue": "Get all jobs with their states and timestamps",
    "GET /queue-view": "View a visual representation of the job queue (HTML)",
    "GET /health": "Health check endpoint"
  }
}
```

## Background Worker

The server includes a background worker that:
- Processes jobs sequentially from the queue
- Updates job states (Waiting → Running → Executed)
- Records timestamps for each state transition
- Automatically processes the next job after completing the current one
- Handles errors gracefully and continues processing

## Environment Variables

- `PORT`: Server port (default: 3000)
- `CHROME_EXECUTABLE_PATH`: Path to Chrome/Chromium executable (default: /usr/bin/google-chrome)

## Use Case

This server is designed for scenarios where you need to:
- Queue and process multiple web page executions sequentially
- Execute web pages that load data and run JavaScript
- Wait for pages that make API calls after loading
- Handle pages that auto-close after completing their operations
- Simulate a real browser environment for testing or automation
- Monitor job progress through a visual dashboard
- Ensure job persistence across server restarts (via SQLite)

## Deployment

### Azure App Service

This application is compatible with Azure App Service:
1. The SQLite database file is created locally in the application directory
2. CORS is enabled for cross-origin requests
3. All dependencies are included in package.json
4. The PORT environment variable is respected

### Local Development

```bash
# Install dependencies
npm install

# Start the server
npm start

# Access the queue viewer
open http://localhost:3000/queue-view
```

## Requirements

- Node.js (v14 or higher recommended)
- Chrome/Chromium (automatically managed by Puppeteer)

## License

ISC

