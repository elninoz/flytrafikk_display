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

// AeroDataBox API helper
async function getFlightRoute(callsign) {
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (!rapidApiKey || !callsign) {
        console.log(`Skipping AeroDataBox lookup - Key: ${!!rapidApiKey}, Callsign: ${callsign}`);
        return null;
    }

    try {
        // Clean callsign (remove spaces and make uppercase)
        const cleanCallsign = callsign.trim().toUpperCase();
        console.log(`Looking up route for: ${cleanCallsign}`);

        // Try to get flight data from AeroDataBox
        const url = `https://aerodatabox.p.rapidapi.com/flights/number/${cleanCallsign}`;

        const headers = {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com'
        };

        const data = await makeRequest(url, headers);
        console.log(`AeroDataBox response for ${cleanCallsign}:`, JSON.stringify(data, null, 2));

        // Extract enhanced flight information from the response
        if (data && data.length > 0) {
            const flight = data[0]; // Get the most recent flight

            let flightInfo = {};

            // Route information
            if (flight.departure && flight.arrival) {
                const from = flight.departure.airport?.name || flight.departure.airport?.iata || 'Ukjent';
                const to = flight.arrival.airport?.name || flight.arrival.airport?.iata || 'Ukjent';
                flightInfo.route = `${from} → ${to}`;
            }

            // Aircraft type
            if (flight.aircraft?.model) {
                flightInfo.aircraftType = flight.aircraft.model;
            }

            // Flight duration and remaining time
            if (flight.departure?.scheduledTimeLocal && flight.arrival?.scheduledTimeLocal) {
                const depTime = new Date(flight.departure.scheduledTimeLocal);
                const arrTime = new Date(flight.arrival.scheduledTimeLocal);
                const currentTime = new Date();

                // Total flight duration in minutes
                const totalDuration = Math.round((arrTime - depTime) / (1000 * 60));
                flightInfo.totalDuration = totalDuration;

                // Remaining time
                if (currentTime < arrTime) {
                    const remainingTime = Math.round((arrTime - currentTime) / (1000 * 60));
                    flightInfo.remainingTime = remainingTime;
                } else {
                    flightInfo.remainingTime = 0; // Flight has arrived
                }

                // Elapsed time
                if (currentTime > depTime) {
                    const elapsedTime = Math.round((currentTime - depTime) / (1000 * 60));
                    flightInfo.elapsedTime = elapsedTime;
                } else {
                    flightInfo.elapsedTime = 0; // Flight hasn't departed yet
                }
            }

            console.log(`Found flight info for ${cleanCallsign}:`, flightInfo);
            return flightInfo;
        }

        console.log(`No flight data found for ${cleanCallsign}`);
        return null;
    } catch (error) {
        console.log(`AeroDataBox lookup failed for ${callsign}:`, error.message);
        return null;
    }
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

// Enhanced OpenSky states with AeroDataBox route lookup
async function handleStatesRequest(lamin, lamax, lomin, lomax, headers) {
    const auth = getOpenSkyAuth();
    const authHeaders = auth ? { 'Authorization': auth } : {};

    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lamax=${lamax}&lomin=${lomin}&lomax=${lomax}`;

    try {
        const data = await makeRequest(url, authHeaders);

        // Enhanced route lookup with AeroDataBox
        if (data.states) {
            const enhancedStates = [];
            let aeroDataBoxSuccess = 0;
            let aeroDataBoxTotal = 0;

            for (const state of data.states) {
                const icao24 = state[0];
                const callsign = state[1]?.trim();

                // Add enhanced route info to state array
                const enhancedState = [...state];
                let routeInfo = null;

                if (callsign) {
                    aeroDataBoxTotal++;
                    
                    // Try to get detailed flight info from AeroDataBox first
                    const flightInfo = await getFlightRoute(callsign);

                    if (flightInfo && typeof flightInfo === 'object') {
                        aeroDataBoxSuccess++;
                        // Use detailed flight information
                        routeInfo = flightInfo.route || null;

                        // Add additional flight details to state array
                        enhancedState[18] = flightInfo.aircraftType || null; // Aircraft type
                        enhancedState[19] = flightInfo.totalDuration || null; // Total duration in minutes
                        enhancedState[20] = flightInfo.remainingTime || null; // Remaining time in minutes
                        enhancedState[21] = flightInfo.elapsedTime || null; // Elapsed time in minutes
                    } else if (typeof flightInfo === 'string') {
                        aeroDataBoxSuccess++;
                        // Backward compatibility - just route string
                        routeInfo = flightInfo;
                    }

                    // Fallback to basic airline detection if AeroDataBox fails
                    if (!routeInfo) {
                        if (callsign.startsWith('SAS') || callsign.startsWith('SK')) {
                            routeInfo = 'SAS Domestic/European';
                        } else if (callsign.startsWith('DY') || callsign.startsWith('NAX')) {
                            routeInfo = 'Norwegian Route';
                        } else if (callsign.startsWith('WF')) {
                            routeInfo = 'Widerøe Regional';
                        }
                    }
                }

                enhancedState[17] = routeInfo; // Route information
                enhancedStates.push(enhancedState);
            }

            data.states = enhancedStates;
            
            // Add status information
            data.apiStatus = {
                aeroDataBoxWorking: aeroDataBoxTotal > 0 ? (aeroDataBoxSuccess / aeroDataBoxTotal) : 0,
                totalFlights: aeroDataBoxTotal,
                successfulLookups: aeroDataBoxSuccess,
                hasRapidApiKey: !!process.env.RAPIDAPI_KEY
            };
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