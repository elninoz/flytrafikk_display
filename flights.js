// Netlify Function for OpenSky Network API proxy
exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: '',
        };
    }

    try {
        // Get query parameters from the request
        const { lamin, lamax, lomin, lomax } = event.queryStringParameters || {};

        if (!lamin || !lamax || !lomin || !lomax) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required parameters: lamin, lamax, lomin, lomax' }),
            };
        }

        // OpenSky Network credentials (set these as environment variables in Netlify)
        const clientId = process.env.OPENSKY_USERNAME;
        const clientSecret = process.env.OPENSKY_PASSWORD;

        if (!clientId || !clientSecret) {
            console.log('No credentials found, using unauthenticated API');
        }

        // Build OpenSky API URL
        const apiUrl = `https://opensky-network.org/api/states/all?lamin=${lamin}&lamax=${lamax}&lomin=${lomin}&lomax=${lomax}`;

        // Prepare fetch options
        const fetchOptions = {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        };

        // Add authentication if credentials are available
        if (clientId && clientSecret) {
            const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
            fetchOptions.headers['Authorization'] = `Basic ${auth}`;
            console.log('Using authenticated API (4000/day)');
        } else {
            console.log('Using unauthenticated API (100/day)');
        }

        // Make the API call
        const response = await fetch(apiUrl, fetchOptions);

        if (!response.ok) {
            throw new Error(`OpenSky API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data),
        };

    } catch (error) {
        console.error('API Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Failed to fetch flight data',
                details: error.message
            }),
        };
    }
};
