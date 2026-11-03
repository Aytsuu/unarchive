param([Parameter(ValueFromRemainingArguments = $true)][string[]]$RemainingArguments)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$stateFile = Join-Path $root '.stack\dev-process.json'
. (Join-Path $PSScriptRoot 'stack-common.ps1')
$quitDocker = ($RemainingArguments -contains '--docker-quit') -or ($env:npm_config_docker_quit -eq 'true')
Set-Location $root

try {
    $stoppedServer = $false
    if (Test-Path -LiteralPath $stateFile) {
        $state = Get-Content -Raw -LiteralPath $stateFile | ConvertFrom-Json
        $process = Get-Process -Id $state.pid -ErrorAction SilentlyContinue
        if ($null -ne $process -and $process.StartTime.ToUniversalTime().Ticks -eq [long]$state.startTicks) {
            Write-Host 'Stopping this project dev server...'
            & taskkill.exe /PID $process.Id /T /F | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'Failed to stop the dev server process tree.' }
            $stoppedServer = $true
        } else { Write-Host 'This project dev server is not running.' }
        Remove-Item -LiteralPath $stateFile -Force
    }
    if (-not $stoppedServer) {
        $projectServer = Get-ProjectDevServer -ProjectRoot $root
        if ($null -ne $projectServer) {
            Write-Host 'Stopping this project dev server...'
            & taskkill.exe /PID $projectServer.ProcessId /T /F | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'Failed to stop the dev server process tree.' }
        } else { Write-Host 'This project dev server is not running.' }
    }

    & cmd.exe /c 'docker info --format "{{.ServerVersion}}" 2>nul' | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host 'Stopping MongoDB...'
        & docker compose --env-file .env.local stop mongodb
        if ($LASTEXITCODE -ne 0) { throw 'Failed to stop MongoDB.' }
        if ($quitDocker) {
            Write-Host 'Quitting Docker Desktop...'
            & docker desktop stop --timeout 180
            if ($LASTEXITCODE -ne 0) { throw 'Failed to quit Docker Desktop.' }
        }
    } else { Write-Host 'Docker engine is already stopped.' }
} catch {
    Write-Error $_
    exit 1
}
