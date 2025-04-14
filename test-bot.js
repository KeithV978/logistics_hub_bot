require('dotenv').config();
const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Disable proxy for local testing
process.env.NO_PROXY = '*';

const token = process.env.BOT_TOKEN;
const url = `https://api.telegram.org/bot${token}/getMe`;
const TIMEOUT = 30000; // Match the timeout in main app

console.log('Testing bot token...');
console.log(`Bot Token: ${token}`);
console.log(`Timeout set to: ${TIMEOUT}ms`);

// Check for proxy in environment
const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const options = {
    timeout: TIMEOUT
};

if (proxy) {
    console.log(`Using proxy: ${proxy}`);
    options.agent = new HttpsProxyAgent(proxy);
}

console.log('Making request to Telegram API...');

const req = https.get(url, options, (resp) => {
    let data = '';
    
    console.log('Response headers:', resp.headers);
    console.log('Response status:', resp.statusCode);
    
    resp.on('data', (chunk) => { 
        data += chunk; 
    });
    
    resp.on('end', () => {
        console.log('Response body:', data);
    });
});

req.on("error", (err) => {
    console.log("Error details:", {
        message: err.message,
        code: err.code,
        stack: err.stack
    });
});

// Set a timeout
req.setTimeout(TIMEOUT, () => {
    console.log(`Request timed out after ${TIMEOUT}ms`);
    req.destroy();
});