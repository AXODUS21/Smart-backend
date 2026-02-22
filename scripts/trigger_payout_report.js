const fs = require('fs');
const path = require('path');
const http = require('http');

// Simple .env parser to get CRON_SECRET
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  console.log('Loading .env.local from:', envPath);
  if (fs.existsSync(envPath)) {
      const envFile = fs.readFileSync(envPath, 'utf8');
      envFile.split('\n').forEach(line => {
        // Skip comments
        if (line.trim().startsWith('#')) return;
        
        const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          process.env[key] = value;
        }
      });
  } else {
      console.log('.env.local file not found at:', envPath);
  }
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
