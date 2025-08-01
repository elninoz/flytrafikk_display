# TEST OAUTH2 CREDENTIALS (PowerShell versjon)
# Legg inn dine faktiske credentials her:

$CLIENT_ID = "your_client_id_here"
$CLIENT_SECRET = "your_client_secret_here"

Write-Host "=== Testing OAuth2 Token ===" -ForegroundColor Cyan
Write-Host "Client ID: $CLIENT_ID"
Write-Host "Client Secret: [HIDDEN]"
Write-Host ""

# Hent OAuth2 token
Write-Host "Getting OAuth2 token..." -ForegroundColor Yellow

$body = @{
    grant_type = "client_credentials"
    client_id = $CLIENT_ID
    client_secret = $CLIENT_SECRET
}

try {
    $tokenResponse = Invoke-RestMethod -Uri "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token" `
                                      -Method Post `
                                      -ContentType "application/x-www-form-urlencoded" `
                                      -Body $body

    if ($tokenResponse.access_token) {
        $token = $tokenResponse.access_token
        Write-Host "✅ Token received: $($token.Substring(0, 20))..." -ForegroundColor Green
        Write-Host ""
        
        # Test API med token
        Write-Host "Testing API with OAuth2 token..." -ForegroundColor Yellow
        
        $headers = @{
            "Authorization" = "Bearer $token"
            "Accept" = "application/json"
        }
        
        $apiResponse = Invoke-RestMethod -Uri "https://opensky-network.org/api/states/all?lamin=60&lamax=61&lomin=5&lomax=6" `
                                        -Headers $headers
        
        Write-Host "🎉 SUCCESS! Aircraft found: $($apiResponse.states.Count)" -ForegroundColor Green
        
    } else {
        Write-Host "❌ No access token in response" -ForegroundColor Red
        Write-Host "Response: $($tokenResponse | ConvertTo-Json)"
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}
