const fs = require('fs');
const path = require('path');
const http = require('http');

// Simple .env parser to get CRON_SECRET
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = value;
    }
  });
} catch (e) {
  console.log('Could not load .env.local', e.message);
}

const cronSecret = process.env.CRON_SECRET;

if (!cronSecret) {
    console.error('CRON_SECRET not found in .env.local');
    process.exit(1);
}

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/cron/process-payouts?force=true',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${cronSecret}`,
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';

  console.log(`Status Code: ${res.statusCode}`);

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
        const json = JSON.parse(data);
        console.log('Response:', JSON.stringify(json, null, 2));
    } catch (e) {
        console.log('Response (raw):', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();
