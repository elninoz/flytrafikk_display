const https = require('https');
const { URL } = require('url');

// Function to get OAuth2 token
async function getOAuth2Token(clientId, clientSecret) {
    return new Promise((resolve, reject) => {
        const postData = `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`;

        const options = {
            hostname: 'auth.opensky-network.org',
            port: 443,
            path: '/auth/realms/opensky-network/protocol/openid-connect/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 5000
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.access_token) {
                        resolve(response.access_token);
                    } else {
                        reject(new Error('No access token received'));
                    }
                } catch (parseError) {
                    reject(new Error(`Token parse error: ${parseError.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Token request timeout'));
        });

        req.write(postData);
        req.end();
    });
}

// Get authentication token (OAuth2 or Basic Auth)
async function getAuthToken() {
    const clientId = process.env.OPENSKY_CLIENT_ID;
    const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
    const username = process.env.OPENSKY_USERNAME;
    const password = process.env.OPENSKY_PASSWORD;

    // Prøv OAuth2 først
    if (clientId && clientSecret) {
        try {
            const token = await getOAuth2Token(clientId, clientSecret);
            return { token: `Bearer ${token}`, method: 'oauth2' };
        } catch (error) {
            console.log('OAuth2 failed, trying Basic Auth:', error.message);
        }
    }

    // Fallback til Basic Auth
    if (username && password) {
        const auth = Buffer.from(`${username}:${password}`).toString('base64');
        return { token: `Basic ${auth}`, method: 'basic' };
    }

    return null;
}

// Make authenticated request to OpenSky API
async function makeAuthenticatedRequest(url, authInfo) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);

        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'flytrafikk-display/1.0'
            },
            timeout: 15000
        };

        if (authInfo && authInfo.token) {
            options.headers['Authorization'] = authInfo.token;
        }

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                // Sjekk om responsen er HTML (feilside) i stad for JSON
                if (data.trim().startsWith('<') || data.includes('You can on')) {
                    reject(new Error(`API returned HTML error page: ${data.substring(0, 100)}...`));
                    return;
                }

                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (parseError) {
                    reject(new Error(`JSON parse error: ${parseError.message}. Response: ${data.substring(0, 100)}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

// Handle track requests (live trajectory)
async function handleTrackRequest(icao24, headers) {
    console.log(`🛩️ Track request for aircraft: ${icao24}`);

    const authInfo = await getAuthToken();
    if (!authInfo) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Authentication required for track data' })
        };
    }

    const url = `https://opensky-network.org/api/tracks?icao24=${icao24.toLowerCase()}&time=0`;

    try {
        const data = await makeAuthenticatedRequest(url, authInfo);
        console.log(`✅ Track data received for ${icao24}`);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error('Track request failed:', error.message);
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'No track data available', message: error.message })
        };
    }
}

// Handle flights requests (flight history with routes)
async function handleFlightsRequest(icao24, headers) {
    console.log(`✈️ Flights request for aircraft: ${icao24}`);

    const authInfo = await getAuthToken();
    if (!authInfo) {
        console.log('❌ No authentication available for flights request');
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Authentication required for flight data' })
        };
    }

    console.log(`🔑 Using ${authInfo.method} authentication for flights`);

    // Søk etter flighter siste dag (OpenSky safe: same partition)
    const now = new Date();
    const endTime = Math.floor(now.getTime() / 1000);

    // Start frå same dag kl 00:00 for å unngå partition-spill
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const beginTime = Math.floor(startOfToday.getTime() / 1000);

    const url = `https://opensky-network.org/api/flights/aircraft?icao24=${icao24.toLowerCase()}&begin=${beginTime}&end=${endTime}`;
    console.log(`📡 Flights URL: ${url}`);

    try {
        const data = await makeAuthenticatedRequest(url, authInfo);
        console.log(`✅ Flight history received for ${icao24}:`, Array.isArray(data) ? data.length : 0, 'flights');
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error('❌ Flights request failed:', error.message);
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'No flight history available', message: error.message })
        };
    }
}

// Handle standard states requests
async function handleStatesRequest(lamin, lamax, lomin, lomax, headers) {
    const authInfo = await getAuthToken();
    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lamax=${lamax}&lomin=${lomin}&lomax=${lomax}`;

    console.log('States request URL:', url);
    console.log('Auth method:', authInfo ? authInfo.method : 'anonymous');

    try {
        const data = await makeAuthenticatedRequest(url, authInfo);
        console.log('States data received, aircraft count:', data.states ? data.states.length : 0);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error('States request failed:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to fetch states', message: error.message })
        };
    }
}

// Handle AeroDataBox requests (premium route data)
async function handleAeroDataBoxRequest(icao24, headers) {
    console.log(`🛩️ AeroDataBox request for aircraft: ${icao24}`);

    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (!rapidApiKey) {
        console.log('❌ No RapidAPI key available');
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'RapidAPI key required for AeroDataBox' })
        };
    }

    console.log(`🔑 Using RapidAPI key for AeroDataBox`);

    const url = `https://aerodatabox.p.rapidapi.com/flights/aircraft/${icao24}`;

    return new Promise((resolve) => {
        const urlObj = new URL(url);

        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-RapidAPI-Key': rapidApiKey,
                'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com'
            },
            timeout: 10000
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    console.log(`✅ AeroDataBox data received for ${icao24}`);
                    resolve({
                        statusCode: 200,
                        headers,
                        body: JSON.stringify(jsonData)
                    });
                } catch (parseError) {
                    console.error('AeroDataBox JSON parse error:', parseError.message);
                    resolve({
                        statusCode: 500,
                        headers,
                        body: JSON.stringify({ error: 'Invalid response from AeroDataBox' })
                    });
                }
            });
        });

        req.on('error', (error) => {
            console.error('AeroDataBox request failed:', error.message);
            resolve({
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'AeroDataBox request failed', message: error.message })
            });
        });

        req.on('timeout', () => {
            req.destroy();
            console.error('AeroDataBox request timeout');
            resolve({
                statusCode: 408,
                headers,
                body: JSON.stringify({ error: 'AeroDataBox request timeout' })
            });
        });

        req.end();
    });
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
        const {
            lamin, lamax, lomin, lomax,
            icao24, track, flights, aero
        } = event.queryStringParameters || {};

        // Sjekk kva type forespørsel dette er
        if (aero === 'true' && icao24) {
            return await handleAeroDataBoxRequest(icao24, headers);
        } else if (track === 'true' && icao24) {
            return await handleTrackRequest(icao24, headers);
        } else if (flights === 'true' && icao24) {
            return await handleFlightsRequest(icao24, headers);
        } else if (lamin && lamax && lomin && lomax) {
            return await handleStatesRequest(lamin, lamax, lomin, lomax, headers);
        } else {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Missing required parameters',
                    usage: 'Use ?lamin=&lamax=&lomin=&lomax= for states, ?icao24=xxx&track=true for tracks, ?icao24=xxx&flights=true for flight history, ?icao24=xxx&aero=true for AeroDataBox'
                })
            };
        }
    } catch (error) {
        console.error('Function error:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};
