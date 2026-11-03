function Get-ProjectDevServer {
    param([string]$ProjectRoot)

    $listeners = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
    foreach ($listener in $listeners) {
        $current = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
        for ($depth = 0; $null -ne $current -and $depth -lt 8; $depth++) {
            $commandLine = [string]$current.CommandLine
            if ($current.Name -ieq 'node.exe' -and
                $commandLine.IndexOf($ProjectRoot, [StringComparison]::OrdinalIgnoreCase) -ge 0 -and
                $commandLine -match 'next[\\/]+dist[\\/]+bin[\\/]+next["\s]+dev(?:\s|$)') {
                return $current
            }
            if ($current.ParentProcessId -eq 0) { break }
            $current = Get-CimInstance Win32_Process -Filter "ProcessId = $($current.ParentProcessId)"
        }
    }
    return $null
}
