# MANUAL OAUTH2 TEST
# Bytt ut med dine faktiske credentials:

$CLIENT_ID = "eldar_r@hotmail.com-api-client"
$CLIENT_SECRET = "cu5etDikxagvmUPl1Q84375EzqgE6mOO"

# Test OAuth2
Write-Host "Testing OAuth2 with your credentials..." -ForegroundColor Cyan

$body = "grant_type=client_credentials&client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET"

try {
    $response = Invoke-WebRequest -Uri "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token" `
                                 -Method POST `
                                 -ContentType "application/x-www-form-urlencoded" `
                                 -Body $body

    $tokenData = $response.Content | ConvertFrom-Json
    
    if ($tokenData.access_token) {
        Write-Host "✅ SUCCESS! OAuth2 fungerer!" -ForegroundColor Green
        Write-Host "Access Token: $($tokenData.access_token.Substring(0,20))..." -ForegroundColor Yellow
        
        # Test API
        $headers = @{ "Authorization" = "Bearer $($tokenData.access_token)" }
        $apiResponse = Invoke-RestMethod -Uri "https://opensky-network.org/api/states/all?lamin=60&lamax=61&lomin=5&lomax=6" -Headers $headers
        
        Write-Host "🎉 API Test: $($apiResponse.states.Count) aircraft found!" -ForegroundColor Green
        
    } else {
        Write-Host "❌ No access token received" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}
