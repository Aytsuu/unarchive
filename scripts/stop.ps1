param([Parameter(ValueFromRemainingArguments = $true)][string[]]$RemainingArguments)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$stateFile = Join-Path $root '.stack\dev-process.json'
. (Join-Path $PSScriptRoot 'stack-common.ps1')
$quitDocker = ($RemainingArguments -contains '--docker-quit') -or ($env:npm_config_docker_quit -eq 'true')
Set-Location $root

function Get-RunningStackServers {
    if (Get-Command Get-ProjectDevServers -ErrorAction SilentlyContinue) {
        return @(Get-ProjectDevServers -ProjectRoot $root)
    }
    $projectServer = Get-ProjectDevServer -ProjectRoot $root
    if ($null -eq $projectServer) { return @() }
    return @($projectServer)
}

try {
    $killed = @{}
    function Stop-DevPid {
        param([int]$ProcessId, [string]$Label)
        if ($killed.ContainsKey("$ProcessId")) { return }
        $alive = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
        if ($null -eq $alive) { return }
        Write-Host "Stopping the $Label dev server..."
        & taskkill.exe /PID $ProcessId /T /F | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Failed to stop the $Label dev server." }
        $killed["$ProcessId"] = $true
    }

    if (Test-Path -LiteralPath $stateFile) {
        $state = Get-Content -Raw -LiteralPath $stateFile | ConvertFrom-Json
        $recorded = @()
        if ($state.servers) { $recorded = @($state.servers) }
        elseif ($state.pid) { $recorded = @([pscustomobject]@{ name = 'web'; pid = $state.pid; startTicks = $state.startTicks }) }
        foreach ($server in $recorded) {
            $alive = Get-Process -Id $server.pid -ErrorAction SilentlyContinue
            if ($null -ne $alive -and $alive.StartTime.ToUniversalTime().Ticks -eq [long]$server.startTicks) {
                $label = if ($server.name) { [string]$server.name } else { 'web' }
                Stop-DevPid -ProcessId ([int]$server.pid) -Label $label
            }
        }
        Remove-Item -LiteralPath $stateFile -Force
    }

    foreach ($server in @(Get-RunningStackServers)) {
        $label = if ($server.Name) { [string]$server.Name } else { 'web' }
        Stop-DevPid -ProcessId ([int]$server.ProcessId) -Label $label
    }
    if ($killed.Count -eq 0) { Write-Host 'The web and moderator dev servers are not running.' }
    $portsFile = Join-Path $root '.stack\ports.json'
    if (Test-Path -LiteralPath $portsFile) { Remove-Item -LiteralPath $portsFile -Force }

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
