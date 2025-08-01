const https = require('https');

// Test Basic Auth direkte
function testBasicAuth() {
    const username = 'eldar_r@hotmail.com-api-client';
    const password = '7joEe2As1LnvOh68nfGRevKiaejNyiIG';
    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    const options = {
        hostname: 'opensky-network.org',
        port: 443,
        path: '/api/states/all?lamin=60&lamax=61&lomin=5&lomax=6',
        method: 'GET',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
            'User-Agent': 'flytrafikk-display/1.0'
        },
        timeout: 10000
    };

    console.log('Testing Basic Auth...');

    const req = https.request(options, (res) => {
        console.log('Status Code:', res.statusCode);
        console.log('Headers:', res.headers);

        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            if (res.statusCode === 200) {
                try {
                    const json = JSON.parse(data);
                    console.log('SUCCESS! Data received:', json.states ? json.states.length + ' aircraft' : 'No states');
                } catch (e) {
                    console.log('Response:', data.substring(0, 500));
                }
            } else {
                console.log('ERROR Response:', data);
            }
        });
    });

    req.on('error', (error) => {
        console.error('Request failed:', error.message);
    });

    req.on('timeout', () => {
        console.log('Request timeout');
        req.destroy();
    });

    req.end();
}

testBasicAuth();
