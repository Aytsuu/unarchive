function Get-ProcessListenPort {
    param([uint32]$ProcessId, [int]$PreferredPort = 0)

    $ports = @(Get-NetTCPConnection -OwningProcess $ProcessId -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalPort -gt 0 } |
        Select-Object -ExpandProperty LocalPort -Unique)
    if ($PreferredPort -gt 0 -and $ports -contains $PreferredPort) { return $PreferredPort }
    $devPort = $ports | Where-Object { $_ -ge 3000 -and $_ -le 3999 } | Sort-Object | Select-Object -First 1
    if ($devPort) { return [int]$devPort }
    $first = $ports | Sort-Object | Select-Object -First 1
    if ($first) { return [int]$first }
    return $null
}

function Get-ProjectDevServer {
    param([string]$ProjectRoot)

    $processes = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue)
    foreach ($current in $processes) {
        $commandLine = [string]$current.CommandLine
        if ($commandLine.IndexOf($ProjectRoot, [StringComparison]::OrdinalIgnoreCase) -lt 0) { continue }
        if ($commandLine -notmatch 'next[\\/]+dist[\\/]+bin[\\/]+next["\s]+dev(?:\s|$)') { continue }
        $preferred = 0
        if ($commandLine -match '(?:^|\s)--port(?:=|\s+)(\d+)') { $preferred = [int]$Matches[1] }
        $port = Get-ProcessListenPort -ProcessId $current.ProcessId -PreferredPort $preferred
        if (-not $port) {
            $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $($current.ProcessId)" -ErrorAction SilentlyContinue)
            foreach ($child in $children) {
                $port = Get-ProcessListenPort -ProcessId $child.ProcessId -PreferredPort $preferred
                if ($port) { break }
            }
        }
        if (-not $port) { $port = $(if ($preferred -gt 0) { $preferred } else { 3000 }) }
        return [pscustomobject]@{ ProcessId = $current.ProcessId; Port = [int]$port }
    }
    return $null
}
