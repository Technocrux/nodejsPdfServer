const express = require('express');
const puppeteer = require('puppeteer');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const CHROME_PATH = process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/google-chrome';

// Initialize SQLite database
const dbPath = path.join(__dirname, 'jobs.db');
const db = new Database(dbPath);

// Create jobs table if it doesn't exist
db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'Waiting',
        requestedAt TEXT NOT NULL,
        startedAt TEXT,
        finishedAt TEXT
    )
`);

// Middleware
app.use(cors()); // Enable CORS for all endpoints
app.use(express.json()); // Parse JSON bodies

// Background worker state
let isProcessing = false;

/**
 * Background worker to process jobs sequentially
 */
async function processNextJob() {
    if (isProcessing) {
        return; // Already processing a job
    }

    // Get the next waiting job
    const job = db.prepare('SELECT * FROM jobs WHERE state = ? ORDER BY id ASC LIMIT 1')
        .get('Waiting');

    if (!job) {
        // No jobs waiting, check again later
        setTimeout(processNextJob, 1000);
        return;
    }

    isProcessing = true;
    const jobId = job.id;
    const url = job.url;

    // Update job state to Running
    const startedAt = new Date().toISOString();
    db.prepare('UPDATE jobs SET state = ?, startedAt = ? WHERE id = ?')
        .run('Running', startedAt, jobId);

    console.log(`[Worker] Processing job ${jobId}: ${url}`);

    let browser = null;

    try {
        // Launch Puppeteer browser
        browser = await puppeteer.launch({
            headless: true,
            executablePath: CHROME_PATH,
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

        console.log(`[Worker] Navigating to URL: ${url}`);

        // Navigate to the URL and wait for network to be idle
        await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: 60000
        });

        console.log('[Worker] Page loaded, waiting for any async operations...');

        // Wait a bit more to ensure any async operations complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log(`[Worker] Job ${jobId} completed successfully`);

        // Close browser
        await browser.close();
        browser = null;

        // Update job state to Executed
        const finishedAt = new Date().toISOString();
        db.prepare('UPDATE jobs SET state = ?, finishedAt = ? WHERE id = ?')
            .run('Executed', finishedAt, jobId);

    } catch (error) {
        console.error(`[Worker] Error processing job ${jobId}:`, error);

        // Close browser if it's still open
        if (browser) {
            try {
                await browser.close();
            } catch (closeError) {
                console.error('[Worker] Error closing browser:', closeError);
            }
        }

        // Mark job as failed but keep it as Executed with error note
        const finishedAt = new Date().toISOString();
        db.prepare('UPDATE jobs SET state = ?, finishedAt = ? WHERE id = ?')
            .run('Executed', finishedAt, jobId);
    } finally {
        isProcessing = false;
        // Process next job
        setImmediate(processNextJob);
    }
}

// Start the background worker
processNextJob();

/**
 * POST /runPdf
 * Accepts a URL and adds it to the job queue
 * 
 * Request body: { "url": "http://example.com" }
 * Response: { "success": true, "jobId": 123, "message": "Job added to queue" }
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

    try {
        // Add job to queue
        const requestedAt = new Date().toISOString();
        const result = db.prepare('INSERT INTO jobs (url, state, requestedAt) VALUES (?, ?, ?)')
            .run(url, 'Waiting', requestedAt);

        console.log(`Job ${result.lastInsertRowid} added to queue: ${url}`);

        // Trigger worker to check for new jobs
        setImmediate(processNextJob);

        // Send success response
        res.json({
            success: true,
            jobId: result.lastInsertRowid,
            message: 'Job added to queue',
            url: url
        });

    } catch (error) {
        console.error('Error adding job to queue:', error);

        res.status(500).json({
            success: false,
            error: 'Failed to add job to queue',
            details: error.message
        });
    }
});

/**
 * GET /queue
 * Returns all jobs with their states and timestamps
 */
app.get('/queue', (req, res) => {
    try {
        const jobs = db.prepare('SELECT * FROM jobs ORDER BY id DESC').all();
        res.json({
            success: true,
            jobs: jobs
        });
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch jobs',
            details: error.message
        });
    }
});

/**
 * GET /queue-view
 * Returns an HTML page visualizing the queue
 */
app.get('/queue-view', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Job Queue Viewer</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            color: white;
            text-align: center;
            margin-bottom: 10px;
            font-size: 2.5em;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .subtitle {
            color: rgba(255,255,255,0.9);
            text-align: center;
            margin-bottom: 30px;
            font-size: 1.1em;
        }
        .stats {
            display: flex;
            gap: 15px;
            margin-bottom: 30px;
            flex-wrap: wrap;
            justify-content: center;
        }
        .stat-card {
            background: white;
            padding: 20px 30px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            text-align: center;
            min-width: 150px;
        }
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .stat-label {
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
        }
        .jobs-container {
            background: white;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        .job-header {
            background: #4a5568;
            color: white;
            padding: 20px;
            display: grid;
            grid-template-columns: 80px 1fr 120px 180px 180px 180px;
            gap: 15px;
            font-weight: bold;
            font-size: 0.9em;
            text-transform: uppercase;
        }
        .job {
            padding: 20px;
            display: grid;
            grid-template-columns: 80px 1fr 120px 180px 180px 180px;
            gap: 15px;
            border-bottom: 1px solid #e2e8f0;
            align-items: center;
            transition: background-color 0.2s;
        }
        .job:hover {
            background-color: #f7fafc;
        }
        .job:last-child {
            border-bottom: none;
        }
        .job-id {
            font-weight: bold;
            color: #4a5568;
        }
        .job-url {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #2d3748;
        }
        .job-state {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: bold;
            text-align: center;
            text-transform: uppercase;
        }
        .state-waiting {
            background-color: #fef3c7;
            color: #92400e;
        }
        .state-running {
            background-color: #dbeafe;
            color: #1e40af;
            animation: pulse 2s ease-in-out infinite;
        }
        .state-executed {
            background-color: #d1fae5;
            color: #065f46;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
        }
        .job-timestamp {
            font-size: 0.85em;
            color: #64748b;
        }
        .empty-state {
            padding: 60px 20px;
            text-align: center;
            color: #64748b;
        }
        .empty-state-icon {
            font-size: 4em;
            margin-bottom: 20px;
            opacity: 0.3;
        }
        .refresh-info {
            text-align: center;
            color: white;
            margin-top: 20px;
            font-size: 0.9em;
            opacity: 0.8;
        }
        @media (max-width: 768px) {
            .job-header, .job {
                grid-template-columns: 1fr;
                gap: 10px;
            }
            .job-header {
                display: none;
            }
            .job {
                padding: 15px;
            }
            .stat-card {
                min-width: 120px;
                padding: 15px 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📋 Job Queue Viewer</h1>
        <p class="subtitle">Real-time monitoring of PDF generation jobs</p>
        
        <div class="stats" id="stats">
            <div class="stat-card">
                <div class="stat-value" id="total-jobs">0</div>
                <div class="stat-label">Total Jobs</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="waiting-jobs" style="color: #d97706;">0</div>
                <div class="stat-label">Waiting</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="running-jobs" style="color: #2563eb;">0</div>
                <div class="stat-label">Running</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="executed-jobs" style="color: #059669;">0</div>
                <div class="stat-label">Executed</div>
            </div>
        </div>
        
        <div class="jobs-container">
            <div class="job-header">
                <div>ID</div>
                <div>URL</div>
                <div>State</div>
                <div>Requested At</div>
                <div>Started At</div>
                <div>Finished At</div>
            </div>
            <div id="jobs-list">
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <p>No jobs in queue</p>
                </div>
            </div>
        </div>
        
        <p class="refresh-info">⟳ Auto-refreshing every 2 seconds</p>
    </div>
    
    <script>
        function formatTimestamp(timestamp) {
            if (!timestamp) return '-';
            const date = new Date(timestamp);
            return date.toLocaleString();
        }
        
        function updateQueue() {
            fetch('/queue')
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.jobs) {
                        const jobs = data.jobs;
                        
                        // Update stats
                        const waitingCount = jobs.filter(j => j.state === 'Waiting').length;
                        const runningCount = jobs.filter(j => j.state === 'Running').length;
                        const executedCount = jobs.filter(j => j.state === 'Executed').length;
                        
                        document.getElementById('total-jobs').textContent = jobs.length;
                        document.getElementById('waiting-jobs').textContent = waitingCount;
                        document.getElementById('running-jobs').textContent = runningCount;
                        document.getElementById('executed-jobs').textContent = executedCount;
                        
                        // Update jobs list
                        const jobsList = document.getElementById('jobs-list');
                        if (jobs.length === 0) {
                            jobsList.innerHTML = \`
                                <div class="empty-state">
                                    <div class="empty-state-icon">📭</div>
                                    <p>No jobs in queue</p>
                                </div>
                            \`;
                        } else {
                            jobsList.innerHTML = jobs.map(job => \`
                                <div class="job">
                                    <div class="job-id">#\${job.id}</div>
                                    <div class="job-url" title="\${job.url}">\${job.url}</div>
                                    <div class="job-state state-\${job.state.toLowerCase()}">\${job.state}</div>
                                    <div class="job-timestamp">\${formatTimestamp(job.requestedAt)}</div>
                                    <div class="job-timestamp">\${formatTimestamp(job.startedAt)}</div>
                                    <div class="job-timestamp">\${formatTimestamp(job.finishedAt)}</div>
                                </div>
                            \`).join('');
                        }
                    }
                })
                .catch(error => {
                    console.error('Error fetching queue:', error);
                });
        }
        
        // Initial load
        updateQueue();
        
        // Auto-refresh every 2 seconds
        setInterval(updateQueue, 2000);
    </script>
</body>
</html>
    `);
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Root endpoint with API information
app.get('/', (req, res) => {
    res.json({
        name: 'Node.js PDF Server with Queue System',
        version: '2.0.0',
        endpoints: {
            'POST /runPdf': 'Add a URL to the job queue. Body: { "url": "http://example.com" }',
            'GET /queue': 'Get all jobs with their states and timestamps',
            'GET /queue-view': 'View a visual representation of the job queue (HTML)',
            'GET /health': 'Health check endpoint'
        }
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`POST endpoint available at: http://localhost:${PORT}/runPdf`);
});
