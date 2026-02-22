const fs = require('fs');
const path = require('path');
const http = require('http');

const cronSecret = process.env.CRON_SECRET;

if (!cronSecret) {
    console.error('CRON_SECRET not found in .env.local');
    process.exit(1);
}

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/cron/process-payouts?force=true&dryRun=true',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${cronSecret}`,
    'Content-Type': 'application/json'
  }
};

console.log('Triggering Payout Dry Run...');

const req = http.request(options, (res) => {
  let data = '';

  console.log(`Status Code: ${res.statusCode}`);

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
        const json = JSON.parse(data);
        console.log('Response Summary:');
        console.log(`Processed: ${json.results.processed}`);
        console.log(`Total PHP: ${json.results.totalAmountPHP}`);
        console.log(`Total USD: ${json.results.totalAmountUSD}`);
        console.log('Withdrawals Sample:');
        json.results.withdrawals.slice(0, 5).forEach(w => {
            console.log(`- ${w.tutor_email} (${w.pricing_region}): ${w.amount} ${w.currency}`);
        });
    } catch (e) {
        console.log('Response (raw):', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();
