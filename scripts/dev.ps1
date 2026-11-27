$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$stateDir = Join-Path $root '.stack'
$stateFile = Join-Path $stateDir 'dev-process.json'
. (Join-Path $PSScriptRoot 'stack-common.ps1')
Set-Location $root

function Test-TrackedProcess {
    param([int]$ProcessId, [long]$StartTicks)
    try {
        $process = Get-Process -Id $ProcessId -ErrorAction Stop
        return $process.StartTime.ToUniversalTime().Ticks -eq $StartTicks
    } catch { return $false }
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

function Resolve-FreePort {
    param([int]$Start, [int]$End)
    for ($port = $Start; $port -le $End; $port++) {
        if (-not (Test-LocalPortListening $port)) { return $port }
    }
    throw "No free dev server port is available in ${Start}-${End}."
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

    foreach ($line in [IO.File]::ReadAllLines((Join-Path $root '.env.local'))) {
        if ($line -match '^\s*#' -or $line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') { continue }
        $name = $Matches[1]
        $value = $Matches[2]
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        Set-Item -Path "Env:$name" -Value $value
    }

    $running = @(Get-ProjectDevServers -ProjectRoot $root)
    $web = $running | Where-Object { $_.Port -ge 3000 -and $_.Port -le 3099 } | Select-Object -First 1
    $moderator = $running | Where-Object { $_.Port -ge 3100 -and $_.Port -le 3199 } | Select-Object -First 1
    $webPort = if ($web) { [int]$web.Port } else { Resolve-FreePort 3000 3099 }
    $moderatorPort = if ($moderator) { [int]$moderator.Port } else { Resolve-FreePort 3100 3199 }

    New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
    @{ web = $webPort; moderator = $moderatorPort } | ConvertTo-Json | Set-Content -Encoding ASCII (Join-Path $stateDir 'ports.json')
    $env:WEB_APP_URL = "http://localhost:$webPort"
    $env:MODERATOR_APP_URL = "http://localhost:$moderatorPort"
    $env:BETTER_AUTH_URL = "http://localhost:$webPort"
    $next = Join-Path $root 'node_modules\next\dist\bin\next'
    $started = @()

    function Start-StackDevServer {
        param([string]$Name, [int]$Port, [string]$WorkingDirectory)
        Write-Host "Starting the $Name dev server..."
        $process = Start-Process -FilePath 'node.exe' -ArgumentList @("`"$next`"", 'dev', '--port', "$Port") -WorkingDirectory $WorkingDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $stateDir "$Name.log") -RedirectStandardError (Join-Path $stateDir "$Name-error.log")
        return [pscustomobject]@{ name = $Name; pid = $process.Id; startTicks = $process.StartTime.ToUniversalTime().Ticks; port = $Port }
    }

    if ($web) { Write-Host "Web dev server is already running at http://localhost:$webPort." }
    else { $started += Start-StackDevServer -Name 'web' -Port $webPort -WorkingDirectory (Join-Path $root 'apps\web') }
    if ($moderator) { Write-Host "Moderator dev server is already running at http://localhost:$moderatorPort." }
    else { $started += Start-StackDevServer -Name 'moderator' -Port $moderatorPort -WorkingDirectory (Join-Path $root 'apps\moderator') }

    $previousState = $null
    if (Test-Path -LiteralPath $stateFile) {
        try { $previousState = Get-Content -Raw -LiteralPath $stateFile | ConvertFrom-Json } catch { $previousState = $null }
    }

    function Get-RecordedWorker {
        param([string]$Name)
        if (-not $previousState) { return $null }
        foreach ($recorded in @($previousState.servers)) {
            if ($recorded.name -ne $Name) { continue }
            if (Test-TrackedProcess -ProcessId ([int]$recorded.pid) -StartTicks ([long]$recorded.startTicks)) {
                return [pscustomobject]@{ name = $Name; pid = [int]$recorded.pid; startTicks = [long]$recorded.startTicks; started = $false }
            }
        }
        return $null
    }

    function Start-StackWorker {
        param([string]$Name, [string]$Label, [string]$FilePath, [string[]]$ArgumentList)
        $existing = Get-RecordedWorker -Name $Name
        if ($existing) {
            Write-Host "$Label is already running."
            return $existing
        }
        Write-Host "Starting the $Label..."
        $process = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $stateDir "$Name.log") -RedirectStandardError (Join-Path $stateDir "$Name-error.log")
        return [pscustomobject]@{ name = $Name; pid = $process.Id; startTicks = $process.StartTime.ToUniversalTime().Ticks; started = $true; label = $Label }
    }

    $env:NODE_ENV = 'development'
    $webhookScript = Join-Path $root 'scripts\process-publish-webhooks.mjs'
    $npm = (Get-Command npm.cmd).Source
    $workers = @(
        (Start-StackWorker -Name 'publish-webhook' -Label 'publication webhook worker' -FilePath 'node.exe' -ArgumentList @('--experimental-strip-types', '--env-file=.env.local', "`"$webhookScript`"", '--watch'))
        (Start-StackWorker -Name 'notifications' -Label 'notification worker' -FilePath $npm -ArgumentList @('run', 'notifications:work', '--', '--watch'))
    )

    $records = @()
    foreach ($server in @($web, $moderator)) {
        if (-not $server) { continue }
        $current = Get-Process -Id $server.ProcessId
        $records += [pscustomobject]@{ name = $server.Name; pid = $server.ProcessId; startTicks = $current.StartTime.ToUniversalTime().Ticks; port = [int]$server.Port }
    }
    foreach ($server in @($started)) {
        $records += [pscustomobject]@{ name = $server.name; pid = $server.pid; startTicks = $server.startTicks; port = $server.port }
    }
    foreach ($worker in @($workers)) {
        $records += [pscustomobject]@{ name = $worker.name; pid = $worker.pid; startTicks = $worker.startTicks }
    }
    @{ servers = @($records) } | ConvertTo-Json -Depth 4 | Set-Content -Encoding ASCII $stateFile

    function Test-StackWorkers {
        foreach ($worker in @($workers)) {
            if (-not $worker.started) { continue }
            if (-not (Test-TrackedProcess -ProcessId $worker.pid -StartTicks $worker.startTicks)) {
                throw "The $($worker.label) exited. Check .stack/$($worker.name)-error.log and .stack/$($worker.name).log."
            }
        }
    }

    if (@($started).Count -eq 0) {
        if (@($workers | Where-Object { $_.started }).Count -gt 0) {
            $workerDeadline = (Get-Date).AddSeconds(5)
            do {
                Test-StackWorkers
                if ((Get-Date) -ge $workerDeadline) { break }
                Start-Sleep -Milliseconds 500
            } while ($true)
        }
        Write-Host "Web app is running at http://localhost:$webPort"
        Write-Host "Moderator app is running at http://localhost:$moderatorPort"
        exit 0
    }

    $deadline = (Get-Date).AddSeconds(180)
    do {
        Start-Sleep -Seconds 1
        $ready = $true
        Test-StackWorkers
        foreach ($server in @($started)) {
            if (-not (Test-TrackedProcess -ProcessId $server.pid -StartTicks $server.startTicks)) {
                throw "The $($server.name) dev server exited. Check .stack/$($server.name)-error.log and .stack/$($server.name).log."
            }
            if (-not (Test-LocalPortListening $server.port)) { $ready = $false }
        }
        if ($ready) {
            Write-Host "Web app is running at http://localhost:$webPort"
            Write-Host "Moderator app is running at http://localhost:$moderatorPort"
            exit 0
        }
    } while ((Get-Date) -lt $deadline)
    foreach ($server in @($started)) {
        if (Test-TrackedProcess -ProcessId $server.pid -StartTicks $server.startTicks) { & taskkill.exe /PID $server.pid /T /F | Out-Null }
    }
    foreach ($worker in @($workers)) {
        if ($worker.started -and (Test-TrackedProcess -ProcessId $worker.pid -StartTicks $worker.startTicks)) { & taskkill.exe /PID $worker.pid /T /F | Out-Null }
    }
    throw 'Timed out waiting for the dev servers. Check .stack/web-error.log and .stack/moderator-error.log.'
} catch {
    Write-Error $_
    exit 1
}
