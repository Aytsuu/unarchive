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

function Test-LocalPortListening {
    param([int]$Port)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $result = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $result.AsyncWaitHandle.WaitOne(200)) { return $false }
        $client.EndConnect($result)
        return $true
    } catch { return $false } finally { $client.Dispose() }
}

function Test-LinkedGitWorktree {
    param([string]$Root)
    $gitDir = & git -C $Root rev-parse --git-dir 2>$null
    if ($LASTEXITCODE -ne 0) { return $false }
    return (($gitDir -replace '\\', '/') -match '/worktrees/')
}

function Get-StableMongoPort {
    param([string]$Root)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Root.TrimEnd('\').ToLowerInvariant()))
    } finally { $sha.Dispose() }
    return 27200 + ([BitConverter]::ToUInt32($bytes, 0) % 800)
}

function Test-MongoPortOwnedByProject {
    param([string]$Root, [int]$Port)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $published = & docker compose --env-file (Join-Path $Root '.env.local') --project-directory $Root port mongodb 27017 2>$null
        if ($LASTEXITCODE -ne 0) { return $false }
        return ([string]$published).Trim() -match (':{0}$' -f $Port)
    } finally { $ErrorActionPreference = $previous }
}

function Test-MongoPortUsable {
    param([string]$Root, [int]$Port)
    if (-not (Test-LocalPortListening $Port)) { return $true }
    return (Test-MongoPortOwnedByProject $Root $Port)
}

function Resolve-WorktreeMongoPort {
    param([string]$Root)
    if (-not (Test-LinkedGitWorktree $Root)) { return 27017 }
    $text = [IO.File]::ReadAllText((Join-Path $Root '.env.local'))
    $existing = $null
    if ($text -match '(?m)^\s*MONGODB_PORT\s*=\s*(\d+)\s*$') { $existing = [int]$Matches[1] }
    if ($existing -ge 27200 -and $existing -le 27999 -and (Test-MongoPortUsable $Root $existing)) { return $existing }
    $start = Get-StableMongoPort $Root
    for ($offset = 0; $offset -lt 800; $offset++) {
        $candidate = 27200 + (($start - 27200 + $offset) % 800)
        if (Test-MongoPortUsable $Root $candidate) { return $candidate }
    }
    throw 'No free MongoDB port is available in 27200-27999.'
}

function ConvertTo-WorktreeMongoUri {
    param([string]$Uri, [int]$Port)
    $updated = [regex]::Replace($Uri, '(mongodb://[^@]+@[^:/]+):\d+', '${1}:' + $Port)
    if ($updated -notmatch 'mongodb://[^@]+@[^:/]+:\d+') {
        $updated = [regex]::Replace($updated, '(mongodb://[^@]+@[^:/?]+)', '${1}:' + $Port)
    }
    if ($updated -match '[?&]directConnection=') {
        return [regex]::Replace($updated, '([?&])directConnection=(?:true|false)', '${1}directConnection=true')
    }
    if ($updated.Contains('?')) { return $updated + '&directConnection=true' }
    return $updated + '?directConnection=true'
}

function Write-WorktreeMongoEnv {
    param([string]$Root, [int]$Port)
    $path = Join-Path $Root '.env.local'
    $text = [IO.File]::ReadAllText($path)
    $newline = if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }
    $endsWithNewline = $text.EndsWith("`n")
    $lines = [regex]::Split($text, "`r?`n")
    if ($endsWithNewline -and $lines.Length -gt 0 -and $lines[-1] -eq '') { $lines = $lines[0..($lines.Length - 2)] }
    $hasPort = $false
    $hasUri = $false
    $rewritten = foreach ($line in $lines) {
        if ($line -match '^\s*MONGODB_PORT\s*=') {
            $hasPort = $true
            "MONGODB_PORT=$Port"
        } elseif ($line -match '^\s*MONGODB_URI\s*=\s*(.*)$') {
            $hasUri = $true
            'MONGODB_URI=' + (ConvertTo-WorktreeMongoUri $Matches[1].Trim() $Port)
        } else { $line }
    }
    if (-not $hasUri) { throw 'MONGODB_URI is missing from .env.local.' }
    $list = [System.Collections.Generic.List[string]]::new()
    foreach ($line in @($rewritten)) { $list.Add([string]$line) }
    if (-not $hasPort) {
        $index = 0
        for ($i = 0; $i -lt $list.Count; $i++) { if ($list[$i] -match '^\s*MONGODB_URI\s*=') { $index = $i; break } }
        $list.Insert($index, "MONGODB_PORT=$Port")
    }
    $output = ($list -join $newline) + $(if ($endsWithNewline) { $newline } else { '' })
    [IO.File]::WriteAllText($path, $output)
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

    $mongoPort = Resolve-WorktreeMongoPort $root
    Write-WorktreeMongoEnv $root $mongoPort
    Write-Host "Using MongoDB on 127.0.0.1:$mongoPort"

    Write-Host 'Starting MongoDB if needed...'
    & docker compose --env-file .env.local up -d mongodb
    if ($LASTEXITCODE -ne 0) { throw 'MongoDB failed to start.' }

    Write-Host 'Initializing MongoDB replica set if needed...'
    $deadline = (Get-Date).AddSeconds(90)
    do {
        & cmd.exe /c 'docker compose --env-file .env.local exec -T mongodb mongosh --quiet --host 127.0.0.1 --file /opt/unarchive/mongo-init-replica.js 2>nul'
        if ($LASTEXITCODE -eq 0) { break }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    if ($LASTEXITCODE -ne 0) { throw 'MongoDB replica set did not become ready. Check MongoDB logs and the configured root credentials.' }

    Write-Host 'Installing npm dependencies...'
    & npm.cmd install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }

    $existing = Get-ProjectDevServer -ProjectRoot $root
    if ($null -ne $existing) {
        Write-Host "This project dev server is already running at http://localhost:$($existing.Port)."
        exit 0
    }
    if (Test-Port) {
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
