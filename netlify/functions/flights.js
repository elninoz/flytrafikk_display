const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// Load airline database
let airlineDatabase = null;

function loadAirlineDatabase() {
    if (airlineDatabase) return airlineDatabase;

    try {
        // Try multiple possible paths for the airline database
        const possiblePaths = [
            path.join(__dirname, '../../airline-database.txt'),    // Local development
            path.join(process.cwd(), 'airline-database.txt'),      // Netlify root
            '/opt/build/repo/airline-database.txt',                // Netlify build path
            '/var/task/airline-database.txt',                      // Lambda path
            './airline-database.txt',                              // Same directory
            path.resolve('./airline-database.txt'),               // Resolved path
            path.resolve(__dirname, '../../airline-database.txt') // Resolved relative path
        ];

        let content = null;
        let usedPath = null;

        // Debug current working directory and __dirname
        console.log(`Current working directory: ${process.cwd()}`);
        console.log(`__dirname: ${__dirname}`);
        console.log(`Trying ${possiblePaths.length} possible paths for airline database`);

        for (const dbPath of possiblePaths) {
            try {
                content = fs.readFileSync(dbPath, 'utf8');
                usedPath = dbPath;
                console.log(`✅ Successfully loaded airline database from: ${dbPath}`);
                break;
            } catch (err) {
                console.log(`❌ Failed to load from ${dbPath}: ${err.message}`);
                continue;
            }
        }

        if (!content) {
            console.error('⚠️ Could not find airline database in any expected location');
            console.log('📂 Available files in current directory:');
            try {
                const files = fs.readdirSync(process.cwd());
                console.log(files.filter(f => f.includes('airline') || f.endsWith('.txt')));
            } catch (e) {
                console.log('Could not list directory contents');
            }

            // Return empty database but don't crash
            airlineDatabase = {};
            return airlineDatabase;
        }

        airlineDatabase = {};
        const lines = content.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.length < 10) continue;

            // Parse format: "Airline Name    IATA / ICAO    Aircraft count"
            const match = trimmed.match(/^(.+?)\s+([A-Z0-9]{1,3})\s*\/\s*([A-Z0-9]{2,4})\s+\d+\s+aircraft/);
            if (match) {
                const [, airlineName, iata, icao] = match;

                // Store by both IATA and ICAO codes
                if (iata && iata.length >= 1) {
                    airlineDatabase[iata.toUpperCase()] = airlineName.trim();
                }
                if (icao && icao.length >= 2) {
                    airlineDatabase[icao.toUpperCase()] = airlineName.trim();
                }
            }
        }

        console.log(`Loaded ${Object.keys(airlineDatabase).length} airline codes from database (${usedPath})`);
        return airlineDatabase;
    } catch (error) {
        console.error('Failed to load airline database:', error.message);
        return {};
    }
}

// Get airline name from callsign using database
function getAirlineFromCallsign(callsign) {
    if (!callsign) return 'Ukjent flyselskap';

    const airlines = loadAirlineDatabase();
    const cleanCallsign = callsign.trim().toUpperCase();

    // Try exact matches with different lengths (4, 3, 2 characters)
    for (let i = Math.min(4, cleanCallsign.length); i >= 2; i--) {
        const code = cleanCallsign.substring(0, i);
        if (airlines[code]) {
            return airlines[code];
        }
    }

    return 'Ukjent flyselskap';
}

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

        // Handle empty or invalid responses
        if (!data || !Array.isArray(data) || data.length === 0) {
            console.log(`No flight data found for ${cleanCallsign} (empty or invalid response)`);
            return null;
        }

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
            if (flight.departure?.scheduledTime?.utc && flight.arrival?.scheduledTime?.utc) {
                const depTime = new Date(flight.departure.scheduledTime.utc);
                const arrTime = new Date(flight.arrival.scheduledTime.utc);
                const currentTime = new Date();

                // Total flight duration in minutes
                const totalDuration = Math.round((arrTime - depTime) / (1000 * 60));
                flightInfo.totalDuration = totalDuration;

                // Remaining time
                if (currentTime < arrTime && flight.status !== 'Arrived') {
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
            } else if (flight.departure?.scheduledTimeLocal && flight.arrival?.scheduledTimeLocal) {
                // Fallback to local times if UTC not available
                const depTime = new Date(flight.departure.scheduledTimeLocal);
                const arrTime = new Date(flight.arrival.scheduledTimeLocal);
                const currentTime = new Date();

                const totalDuration = Math.round((arrTime - depTime) / (1000 * 60));
                flightInfo.totalDuration = totalDuration;

                if (currentTime < arrTime && flight.status !== 'Arrived') {
                    const remainingTime = Math.round((arrTime - currentTime) / (1000 * 60));
                    flightInfo.remainingTime = remainingTime;
                } else {
                    flightInfo.remainingTime = 0;
                }

                if (currentTime > depTime) {
                    const elapsedTime = Math.round((currentTime - depTime) / (1000 * 60));
                    flightInfo.elapsedTime = elapsedTime;
                } else {
                    flightInfo.elapsedTime = 0;
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

// HTTP request helper with retry logic
async function makeRequest(url, headers = {}, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            console.log(`Making request to ${url} (attempt ${attempt + 1}/${retries + 1})`);

            const result = await new Promise((resolve, reject) => {
                const urlObj = new URL(url);

                // Adjust timeout based on the API - OpenSky can be slow
                const isOpenSky = urlObj.hostname.includes('opensky');
                const baseTimeout = isOpenSky ? 8000 : 6000; // Even shorter for OpenSky
                const maxTimeout = isOpenSky ? 12000 : 10000; // Max timeout cap

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
                    timeout: attempt === 0 ? baseTimeout : Math.min(baseTimeout + (attempt * 2000), maxTimeout)
                };

                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => data += chunk);

                    res.on('end', () => {
                        if (res.statusCode === 429) {
                            reject(new Error('Rate limited - too many requests'));
                            return;
                        }

                        if (res.statusCode >= 400) {
                            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                            return;
                        }

                        if (data.trim().startsWith('<')) {
                            reject(new Error('HTML error page received'));
                            return;
                        }

                        try {
                            // Handle empty responses gracefully
                            if (!data || data.trim() === '') {
                                console.log('Received empty response from API');
                                resolve([]);
                                return;
                            }

                            const parsed = JSON.parse(data);
                            resolve(parsed);
                        } catch (error) {
                            console.log(`Raw response data: "${data}"`);
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

            console.log(`Request successful on attempt ${attempt + 1}`);
            return result;

        } catch (error) {
            console.log(`Request failed on attempt ${attempt + 1}: ${error.message}`);

            if (attempt === retries) {
                throw error; // Final attempt failed
            }

            // Wait before retrying (exponential backoff)
            const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...
            console.log(`Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

// Enhanced OpenSky states with AeroDataBox route lookup
async function handleStatesRequest(lamin, lamax, lomin, lomax, headers) {
    const auth = getOpenSkyAuth();
    const authHeaders = auth ? { 'Authorization': auth } : {};

    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lamax=${lamax}&lomin=${lomin}&lomax=${lomax}`;

    try {
        console.log(`Fetching OpenSky data from: ${url}`);
        const startTime = Date.now();

        const data = await makeRequest(url, authHeaders);

        const openSkyTime = Date.now() - startTime;
        console.log(`OpenSky request completed in ${openSkyTime}ms`);

        // Enhanced route lookup with AeroDataBox (limit concurrent requests)
        if (data.states) {
            const enhancedStates = [];
            let aeroDataBoxSuccess = 0;
            let aeroDataBoxTotal = 0;

            // Process flights in batches to avoid overwhelming APIs
            const batchSize = 3; // Max 3 concurrent AeroDataBox requests
            for (let i = 0; i < data.states.length; i += batchSize) {
                const batch = data.states.slice(i, i + batchSize);

                const batchPromises = batch.map(async (state) => {
                    const icao24 = state[0];
                    const callsign = state[1]?.trim();

                    // Add enhanced route info to state array
                    const enhancedState = [...state];
                    let routeInfo = null;

                    if (callsign) {
                        aeroDataBoxTotal++;

                        // Try to get detailed flight info from AeroDataBox first
                        try {
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
                        } catch (error) {
                            console.log(`AeroDataBox lookup failed for ${callsign}: ${error.message}`);
                        }

                        // Fallback to basic airline detection if AeroDataBox fails
                        if (!routeInfo) {
                            const airlineName = getAirlineFromCallsign(callsign);
                            if (airlineName !== 'Ukjent flyselskap') {
                                // Use airline name with generic route info
                                if (callsign.startsWith('SAS') || callsign.startsWith('SK')) {
                                    routeInfo = 'SAS Domestic/European';
                                } else if (callsign.startsWith('DY') || callsign.startsWith('NOZ')) {
                                    routeInfo = 'Norwegian Route';
                                } else if (callsign.startsWith('WF')) {
                                    routeInfo = 'Widerøe Regional';
                                } else if (callsign.startsWith('ICE') || callsign.startsWith('FI')) {
                                    routeInfo = 'Icelandair Route';
                                } else if (callsign.startsWith('AFR')) {
                                    routeInfo = 'Air France Route';
                                } else if (callsign.startsWith('KLM')) {
                                    routeInfo = 'KLM Route';
                                } else if (callsign.startsWith('LH')) {
                                    routeInfo = 'Lufthansa Route';
                                } else if (callsign.startsWith('WIF')) {
                                    routeInfo = 'Widerøe Route';
                                } else {
                                    routeInfo = `${airlineName} Route`;
                                }
                            } else {
                                // Final fallback - use callsign pattern matching
                                if (callsign.match(/^[A-Z]{2,3}\d/)) {
                                    routeInfo = `${callsign.substring(0, 3)} Flight`;
                                } else {
                                    routeInfo = 'Commercial Flight';
                                }
                            }
                        }
                    }

                    enhancedState[17] = routeInfo; // Route information
                    return enhancedState;
                });

                // Wait for this batch to complete before starting next batch
                const batchResults = await Promise.all(batchPromises);
                enhancedStates.push(...batchResults);

                // Small delay between batches to be nice to APIs
                if (i + batchSize < data.states.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            data.states = enhancedStates;

            // Add status information
            data.apiStatus = {
                aeroDataBoxWorking: aeroDataBoxTotal > 0 ? (aeroDataBoxSuccess / aeroDataBoxTotal) : 0,
                totalFlights: aeroDataBoxTotal,
                successfulLookups: aeroDataBoxSuccess,
                hasRapidApiKey: !!process.env.RAPIDAPI_KEY,
                openSkyResponseTime: openSkyTime
            };
        }

        const totalTime = Date.now() - startTime;
        console.log(`Total request completed in ${totalTime}ms`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error('OpenSky request failed:', error.message);

        // Provide helpful error message for different failure types
        let errorMessage = 'OpenSky API problem';
        if (error.message.includes('timeout')) {
            errorMessage = 'OpenSky API timeout - prøv igjen';
        } else if (error.message.includes('ENOTFOUND')) {
            errorMessage = 'Nettverksproblem - sjekk tilkopling';
        }

        // Return basic error response with fallback data
        return {
            statusCode: 200, // Don't fail completely
            headers,
            body: JSON.stringify({
                states: [],
                time: Math.floor(Date.now() / 1000),
                error: errorMessage,
                apiStatus: {
                    aeroDataBoxWorking: 0,
                    totalFlights: 0,
                    successfulLookups: 0,
                    hasRapidApiKey: !!process.env.RAPIDAPI_KEY,
                    openSkyError: error.message
                }
            })
        };
    }
} exports.handler = async (event, context) => {
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