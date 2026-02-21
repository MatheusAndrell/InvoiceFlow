param(
  [string]$ApiBaseUrl = "http://localhost:3000",
  [string]$Email = "admin@demo.com",
  [string]$Password = "admin",
  [string]$CertificatePath = "",
  [string]$CertificatePassword = "",
  [int]$PollSeconds = 2,
  [int]$TimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"

function Read-ErrorResponse {
  param([Parameter(Mandatory = $true)]$Exception)

  if ($Exception.Exception -and $Exception.Exception.Response) {
    $response = $Exception.Exception.Response
    $stream = $response.GetResponseStream()
    if ($stream) {
      $reader = New-Object System.IO.StreamReader($stream)
      return $reader.ReadToEnd()
    }
  }

  if ($Exception.ErrorDetails -and $Exception.ErrorDetails.Message) {
    return $Exception.ErrorDetails.Message
  }

  return ($Exception | Out-String)
}

function Invoke-ApiJson {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Url,
    [object]$Body,
    [string]$Token = ""
  )

  $headers = @{}
  if ($Token) {
    $headers["Authorization"] = "Bearer $Token"
  }

  $bodyText = $null
  if ($null -ne $Body) {
    $headers["Content-Type"] = "application/json"
    $bodyText = $Body | ConvertTo-Json -Depth 8
  }

  try {
    $response = Invoke-WebRequest -Method $Method -Uri $Url -Headers $headers -Body $bodyText -UseBasicParsing
    $parsed = $null
    if ($response.Content) {
      $parsed = $response.Content | ConvertFrom-Json
    }

    return @{
      StatusCode = [int]$response.StatusCode
      Body = $parsed
    }
  } catch {
    $msg = Read-ErrorResponse -Exception $_
    throw "HTTP $Method $Url failed: $msg"
  }
}

function Upload-Certificate {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$Token,
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string]$CertPassword
  )

  if (-not (Test-Path $FilePath)) {
    throw "Certificate file not found: $FilePath"
  }

  Add-Type -AssemblyName System.Net.Http

  $client = New-Object System.Net.Http.HttpClient
  try {
    $client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", $Token)

    $content = New-Object System.Net.Http.MultipartFormDataContent

    $fileStream = [System.IO.File]::OpenRead($FilePath)
    try {
      $fileContent = New-Object System.Net.Http.StreamContent($fileStream)
      $fileContent.Headers.ContentType = New-Object System.Net.Http.Headers.MediaTypeHeaderValue("application/x-pkcs12")
      $content.Add($fileContent, "certificate", [System.IO.Path]::GetFileName($FilePath))

      $passContent = New-Object System.Net.Http.StringContent($CertPassword)
      $content.Add($passContent, "password")

      $result = $client.PostAsync($Url, $content).GetAwaiter().GetResult()
      $responseText = $result.Content.ReadAsStringAsync().GetAwaiter().GetResult()

      if (-not $result.IsSuccessStatusCode) {
        throw "Upload failed ($([int]$result.StatusCode)): $responseText"
      }

      if ($responseText) {
        return $responseText | ConvertFrom-Json
      }

      return $null
    } finally {
      $fileStream.Dispose()
      $content.Dispose()
    }
  } finally {
    $client.Dispose()
  }
}

Write-Host "[1/5] Checking API health..."
$health = Invoke-ApiJson -Method "GET" -Url "$ApiBaseUrl/health"
if ($health.StatusCode -ne 200) {
  throw "Healthcheck failed with status $($health.StatusCode)"
}
Write-Host "API is healthy."

Write-Host "[2/5] Logging in..."
$login = Invoke-ApiJson -Method "POST" -Url "$ApiBaseUrl/auth/login" -Body @{ email = $Email; password = $Password }
if ($login.StatusCode -ne 200 -or -not $login.Body.token) {
  throw "Login failed."
}
$token = $login.Body.token
Write-Host "Login OK. UserId: $($login.Body.userId)"

if ($CertificatePath) {
  Write-Host "[3/5] Uploading certificate..."
  if (-not $CertificatePassword) {
    throw "You provided -CertificatePath but not -CertificatePassword."
  }

  $cert = Upload-Certificate -Url "$ApiBaseUrl/certificates" -Token $token -FilePath $CertificatePath -CertPassword $CertificatePassword
  Write-Host "Certificate uploaded: $($cert.filename)"
} else {
  Write-Host "[3/5] Skipping certificate upload (no -CertificatePath provided)."
}

Write-Host "[4/5] Creating sale..."
$amount = [Math]::Round((Get-Random -Minimum 100 -Maximum 5000) + 0.37, 2)
$description = "Smoke test sale $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$created = Invoke-ApiJson -Method "POST" -Url "$ApiBaseUrl/sales" -Token $token -Body @{ amount = $amount; description = $description }
if ($created.StatusCode -ne 202 -or -not $created.Body.id) {
  throw "Sale creation failed or did not return 202. Status: $($created.StatusCode)"
}
$saleId = $created.Body.id
Write-Host "Sale created: $saleId (status: $($created.Body.status))"

Write-Host "[5/5] Polling sale status..."
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$current = $null
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds $PollSeconds
  $currentResp = Invoke-ApiJson -Method "GET" -Url "$ApiBaseUrl/sales/$saleId" -Token $token
  $current = $currentResp.Body

  if ($current.status -ne "PROCESSING") {
    break
  }

  Write-Host "Still PROCESSING..."
}

if (-not $current) {
  throw "Could not fetch sale status."
}

Write-Host "Final status: $($current.status)"
if ($current.protocol) {
  Write-Host "Protocol: $($current.protocol)"
}
if ($current.errorMsg) {
  Write-Host "Error: $($current.errorMsg)"
}

$current | ConvertTo-Json -Depth 8
