const https = require('https');
const querystring = require('querystring');

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    try {
        const { lamin, lamax, lomin, lomax } = event.queryStringParameters;
        
        if (!lamin || !lamax || !lomin || !lomax) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Mangler koordinatar' })
            };
        }

        // Steg 1: Hent OAuth2 token
        const token = await getOAuth2Token();
        
        // Steg 2: Bruk token til å hente flydata
        const flightData = await fetchFlightsWithToken(token, lamin, lamax, lomin, lomax);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(flightData)
        };

    } catch (error) {
        console.error('OAuth2 feil:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

function getOAuth2Token() {
    return new Promise((resolve, reject) => {
        const postData = querystring.stringify({
            grant_type: 'client_credentials',
            client_id: process.env.OPENSKY_CLIENT_ID,
            client_secret: process.env.OPENSKY_CLIENT_SECRET
        });

        const options = {
            hostname: 'auth.opensky-network.org',
            port: 443,
            path: '/auth/realms/opensky-network/protocol/openid-connect/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 10000
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const tokenData = JSON.parse(data);
                        resolve(tokenData.access_token);
                    } catch (e) {
                        reject(new Error('Kunne ikkje parse token response'));
                    }
                } else {
                    reject(new Error(`Token request failed: ${res.statusCode} - ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Token request timeout'));
        });

        req.write(postData);
        req.end();
    });
}

function fetchFlightsWithToken(token, lamin, lamax, lomin, lomax) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'opensky-network.org',
            port: 443,
            path: `/api/states/all?lamin=${lamin}&lamax=${lamax}&lomin=${lomin}&lomax=${lomax}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'User-Agent': 'flytrafikk-display-oauth/1.0'
            },
            timeout: 15000
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('Kunne ikkje parse flight data'));
                    }
                } else {
                    reject(new Error(`API request failed: ${res.statusCode}`));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Flight data request timeout'));
        });

        req.end();
    });
}