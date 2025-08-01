# TEST OAUTH2 CREDENTIALS
# Legg inn dine faktiske credentials her:

CLIENT_ID="your_client_id_here"
CLIENT_SECRET="your_client_secret_here"

echo "=== Testing OAuth2 Token ==="
echo "Client ID: $CLIENT_ID"
echo "Client Secret: [HIDDEN]"
echo ""

# Hent OAuth2 token
echo "Getting OAuth2 token..."
TOKEN_RESPONSE=$(curl -s -X POST "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET")

echo "Token response: $TOKEN_RESPONSE"
echo ""

# Parse token (PowerShell-vennleg)
TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Failed to get token"
    exit 1
else
    echo "✅ Token received: ${TOKEN:0:20}..."
    echo ""
    
    # Test API med token
    echo "Testing API with OAuth2 token..."
    curl -H "Authorization: Bearer $TOKEN" \
         -H "Accept: application/json" \
         "https://opensky-network.org/api/states/all?lamin=60&lamax=61&lomin=5&lomax=6"
fi
