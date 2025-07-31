exports.handler = async (event, context) => {
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
    
    // Hent miljøvariablar frå Netlify
    const username = process.env.OPENSKY_USERNAME;
    const password = process.env.OPENSKY_PASSWORD;
    
    console.log('Username:', username ? 'Found' : 'Missing');
    console.log('Password:', password ? 'Found' : 'Missing');
    
    // Bygg OpenSky API URL
    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lamax=${lamax}&lomin=${lomin}&lomax=${lomax}`;
    console.log('Calling URL:', url);
    
    const fetchOptions = {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'flytrafikk-display/1.0'
      }
    };
    
    // Legg til Basic Auth hvis credentials finnes
    if (username && password) {
      const auth = Buffer.from(`${username}:${password}`).toString('base64');
      fetchOptions.headers['Authorization'] = `Basic ${auth}`;
      console.log('Using authenticated API (4000/day)');
    } else {
      console.log('Using unauthenticated API (100/day)');
    }
    
    const response = await fetch(url, fetchOptions);
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`OpenSky API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Data received, states count:', data.states ? data.states.length : 0);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };
    
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
