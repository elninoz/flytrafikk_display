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

exports.handler = async (event, context) => {
    // Set function timeout
    context.callbackWaitsForEmptyEventLoop = false;

    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const { lamin, lamax, lomin, lomax } = event.queryStringParameters || {};

        if (!lamin || !lamax || !lomin || !lomax) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required parameters' })
            };
        }

        // Hent OAuth2 credentials frå Netlify (nye variablar)
        const clientId = process.env.OPENSKY_CLIENT_ID;
        const clientSecret = process.env.OPENSKY_CLIENT_SECRET;

        // Fallback til gamle Basic Auth credentials
        const username = process.env.OPENSKY_USERNAME;
        const password = process.env.OPENSKY_PASSWORD;

        console.log('OAuth2 Client ID:', clientId ? 'Found' : 'Missing');
        console.log('OAuth2 Client Secret:', clientSecret ? 'Found' : 'Missing');
        console.log('Legacy Username:', username ? 'Found' : 'Missing');
        console.log('Legacy Password:', password ? 'Found' : 'Missing');

        // Bygg OpenSky API URL
        const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lamax=${lamax}&lomin=${lomin}&lomax=${lomax}`;
        console.log('Calling URL:', url);

        let authToken = null;
        let authMethod = 'unauthenticated';

        // Prøv først OAuth2 (for nye kontoar)
        if (clientId && clientSecret) {
            try {
                authToken = await getOAuth2Token(clientId, clientSecret);
                authMethod = 'oauth2';
                console.log('Using OAuth2 authentication (4000/day)');
            } catch (oauthError) {
                console.log('OAuth2 failed, falling back to Basic Auth:', oauthError.message);

                // Fallback til Basic Auth (for eldre kontoar)
                if (username && password) {
                    const auth = Buffer.from(`${username}:${password}`).toString('base64');
                    authToken = `Basic ${auth}`;
                    authMethod = 'basic';
                    console.log('Using Basic Auth authentication (4000/day)');
                }
            }
        } else if (username && password) {
            // Direkte Basic Auth hvis OAuth2 credentials ikkje finnes
            const auth = Buffer.from(`${username}:${password}`).toString('base64');
            authToken = `Basic ${auth}`;
            authMethod = 'basic';
            console.log('Using Basic Auth authentication (4000/day)');
        }

        if (!authToken) {
            console.log('No authentication available, using anonymous API (100/day)');
        }

        // Bruk Node.js https modul i staden for fetch
        const makeRequest = () => {
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
                    timeout: 10000
                };

                // Legg til autentisering basert på metode
                if (authToken) {
                    if (authMethod === 'oauth2') {
                        options.headers['Authorization'] = `Bearer ${authToken}`;
                    } else if (authMethod === 'basic') {
                        options.headers['Authorization'] = authToken;
                    }
                }

                const req = https.request(options, (res) => {
                    console.log('Response status:', res.statusCode);

                    let data = '';
                    res.on('data', (chunk) => {
                        data += chunk;
                    });

                    res.on('end', () => {
                        try {
                            const jsonData = JSON.parse(data);
                            console.log('Data received, states count:', jsonData.states ? jsonData.states.length : 0);
                            resolve(jsonData);
                        } catch (parseError) {
                            reject(new Error(`JSON parse error: ${parseError.message}`));
                        }
                    });
                });

                req.on('error', (error) => {
                    console.error('Request error:', error);
                    reject(error);
                });

                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Request timeout'));
                });

                req.end();
            });
        };

        try {
            const data = await makeRequest();

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(data)
            };
        } catch (requestError) {
            console.error('Request failed:', requestError.message);
            throw new Error(`Network request failed: ${requestError.message}`);
        }

    } catch (error) {
        console.error('Function error:', error.message);
        console.error('Error stack:', error.stack);
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
