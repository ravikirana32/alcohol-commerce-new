$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker Desktop is required.' }
docker compose version | Out-Null
if (-not (Test-Path '.env')) {
  function New-CryptoHex([int]$bytes) {
    $buffer = New-Object byte[] $bytes
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($buffer) } finally { $rng.Dispose() }
    return [Convert]::ToHexString($buffer).ToLowerInvariant()
  }
  $db = New-CryptoHex 24
  $jwt = New-CryptoHex 32
  $bootstrap = New-CryptoHex 32
  (Get-Content '.env.docker.example' -Raw).Replace('replace_me_with_hex_secret',$db).Replace('replace_me_with_at_least_32_random_bytes',$jwt).Replace('replace_me_with_one_time_random_secret',$bootstrap) | Set-Content '.env' -NoNewline
  Write-Host 'Created .env with cryptographically random local development secrets.'
}
$envLines = Get-Content '.env'
foreach ($key in @('POSTGRES_PASSWORD','JWT_SECRET','BOOTSTRAP_SECRET')) {
  $line = $envLines | Where-Object { $_ -match "^$key=" } | Select-Object -Last 1
  if (-not $line -or $line -match 'replace_me_|replace-with') { throw "Invalid or placeholder $key in .env. Set a strong unique value or remove .env and rerun to generate local secrets." }
}
function Get-DotEnvValue([string]$key, [string]$fallback) {
  $line = $envLines | Where-Object { $_ -match "^$key=" } | Select-Object -Last 1
  if ($line) { return $line.Substring($key.Length + 1) }
  return $fallback
}
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { docker compose logs --tail=120; throw 'Docker Compose startup failed.' }
$apiPort = Get-DotEnvValue 'API_PORT' '8080'
$webPort = Get-DotEnvValue 'WEB_PORT' '5173'
$healthy = $false
for ($i=0; $i -lt 60; $i++) {
  try {
    $null = Invoke-RestMethod "http://localhost:$apiPort/api/health/ready" -TimeoutSec 3
    $null = Invoke-WebRequest "http://localhost:$webPort/" -TimeoutSec 3
    $healthy = $true; break
  } catch { Start-Sleep -Seconds 3 }
}
if (-not $healthy) { docker compose ps; docker compose logs --tail=120; throw 'Services did not become healthy within 3 minutes.' }
Write-Host "Web: http://localhost:$webPort"
Write-Host "API: http://localhost:$apiPort"
Write-Host "API readiness: http://localhost:$apiPort/api/health/ready"
Write-Host 'Review docs/DOCKER-QUICKSTART.md for first-time bootstrap.'
