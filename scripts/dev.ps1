$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$stateDir = Join-Path $root '.stack'
$stateFile = Join-Path $stateDir 'dev-process.json'
. (Join-Path $PSScriptRoot 'stack-common.ps1')
Set-Location $root

function Test-DevProcess {
    if (-not (Test-Path -LiteralPath $stateFile)) { return $false }
    try {
        $state = Get-Content -Raw -LiteralPath $stateFile | ConvertFrom-Json
        $process = Get-Process -Id $state.pid -ErrorAction Stop
        return $process.StartTime.ToUniversalTime().Ticks -eq [long]$state.startTicks
    } catch { return $false }
}

function Test-Port {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $client.Connect('127.0.0.1', 3000)
        return $true
    } catch { return $false } finally { $client.Dispose() }
}

try {
    if (-not (Test-Path -LiteralPath (Join-Path $root '.env.local'))) {
        throw 'Missing .env.local. Copy .env.examples to .env.local and configure the credentials.'
    }

    & cmd.exe /c 'docker info --format "{{.ServerVersion}}" 2>nul' | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Starting Docker Desktop...'
        & docker desktop start --timeout 180
        if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop failed to start.' }
        $deadline = (Get-Date).AddSeconds(180)
        do {
            & cmd.exe /c 'docker info --format "{{.ServerVersion}}" 2>nul' | Out-Null
            if ($LASTEXITCODE -eq 0) { break }
            Start-Sleep -Seconds 2
        } while ((Get-Date) -lt $deadline)
        if ($LASTEXITCODE -ne 0) { throw 'Timed out waiting for the Docker engine.' }
        Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue |
            Where-Object { $_.MainWindowTitle -match 'Docker Desktop' } |
            ForEach-Object { [void]$_.CloseMainWindow() }
    } else { Write-Host 'Docker engine is already running.' }

    Write-Host 'Starting MongoDB if needed...'
    & docker compose --env-file .env.local up -d mongodb
    if ($LASTEXITCODE -ne 0) { throw 'MongoDB failed to start.' }

    Write-Host 'Installing npm dependencies...'
    & npm.cmd install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }

    if ((Test-DevProcess) -and $null -ne (Get-ProjectDevServer -ProjectRoot $root)) {
        Write-Host 'This project dev server is already running.'
        exit 0
    }
    if (Test-Port) {
        if ($null -ne (Get-ProjectDevServer -ProjectRoot $root)) {
            Write-Host 'This project dev server is already running at http://localhost:3000.'
            exit 0
        }
        throw 'Port 3000 is already in use by another process. Stop it before starting this project.'
    }

    New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
    $next = Join-Path $root 'node_modules\next\dist\bin\next'
    $process = Start-Process -FilePath 'node.exe' -ArgumentList @("`"$next`"", 'dev', '--port', '3000') -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $stateDir 'dev.log') -RedirectStandardError (Join-Path $stateDir 'dev-error.log')
    @{ pid = $process.Id; startTicks = $process.StartTime.ToUniversalTime().Ticks } | ConvertTo-Json | Set-Content -Encoding ASCII $stateFile
    $deadline = (Get-Date).AddSeconds(90)
    do {
        Start-Sleep -Seconds 1
        if (-not (Test-DevProcess)) { throw 'The dev server exited. Check .stack/dev-error.log and .stack/dev.log.' }
        if ((Test-Port) -and $null -ne (Get-ProjectDevServer -ProjectRoot $root)) {
            Write-Host 'Dev server is running at http://localhost:3000'
            exit 0
        }
    } while ((Get-Date) -lt $deadline)
    if (Test-DevProcess) { & taskkill.exe /PID $process.Id /T /F | Out-Null }
    throw 'Timed out waiting for the dev server. Check .stack/dev-error.log and .stack/dev.log.'
} catch {
    Write-Error $_
    exit 1
}
