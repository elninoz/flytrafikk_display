const https = require('https');
const { URL } = require('url');

// Basic auth for OpenSky
function getOpenSkyAuth() {
    const username = process.env.OPENSKY_USERNAME;
    const password = process.env.OPENSKY_PASSWORD;

    if (username && password) {
        const auth = Buffer.from(`${username}:${password}`).toString('base64');
        return `Basic ${auth}`;
    }
    return null;
}

// HTTP request helper
async function makeRequest(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);

        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'flytrafikk-display/1.0',
                ...headers
            },
            timeout: 10000
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);

            res.on('end', () => {
                if (data.trim().startsWith('<')) {
                    reject(new Error('HTML error page received'));
                    return;
                }

                try {
                    resolve(JSON.parse(data));
                } catch (error) {
                    reject(new Error(`JSON parse error: ${error.message}`));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

// Enhanced OpenSky states with basic route guessing
async function handleStatesRequest(lamin, lamax, lomin, lomax, headers) {
    const auth = getOpenSkyAuth();
    const authHeaders = auth ? { 'Authorization': auth } : {};

    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lamax=${lamax}&lomin=${lomin}&lomax=${lomax}`;

    try {
        const data = await makeRequest(url, authHeaders);

        // Add basic route guessing for Norwegian flights
        if (data.states) {
            data.states = data.states.map(state => {
                const icao24 = state[0];
                const callsign = state[1]?.trim();

                // Add route guess for Norwegian flights
                let routeGuess = null;
                if (callsign) {
                    if (callsign.startsWith('SAS') || callsign.startsWith('SK')) {
                        routeGuess = 'SAS Domestic/European';
                    } else if (callsign.startsWith('DY') || callsign.startsWith('NAX')) {
                        routeGuess = 'Norwegian Route';
                    } else if (callsign.startsWith('WF')) {
                        routeGuess = 'Widerøe Regional';
                    }
                }

                // Add to state array (custom field)
                const enhancedState = [...state];
                enhancedState[17] = routeGuess; // Route guess

                return enhancedState;
            });
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error('OpenSky request failed:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
}

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const params = event.queryStringParameters || {};
        const { lamin, lamax, lomin, lomax } = params;

        if (lamin && lamax && lomin && lomax) {
            return await handleStatesRequest(lamin, lamax, lomin, lomax, headers);
        } else {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Missing parameters',
                    usage: 'Use ?lamin=&lamax=&lomin=&lomax= for aircraft positions'
                })
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};