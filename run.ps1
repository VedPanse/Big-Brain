# Windows launcher for dev + agent (mirrors run.sh).
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $root

$processes = @()

function Start-Background {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $logPath = Join-Path $env:TEMP ("bigbrain-{0}.log" -f $Label)
    $process = Start-Process -FilePath $FilePath -ArgumentList $Arguments `
        -RedirectStandardOutput $logPath -RedirectStandardError $logPath `
        -PassThru -WindowStyle Hidden

    $global:processes += $process
    Write-Host "$Label -> $logPath"
}

function Cleanup {
    foreach ($p in $processes) {
        if ($p -and -not $p.HasExited) {
            try {
                Stop-Process -Id $p.Id -ErrorAction SilentlyContinue
            } catch {
                # Ignore shutdown errors.
            }
        }
    }
}

try {
    Start-Background -Label "agent" -FilePath "npm" -Arguments @("run", "agent:dev")
    Start-Background -Label "dev" -FilePath "npm" -Arguments @("run", "dev")

    Write-Host "http://localhost:5173/"

    if ($processes.Count -gt 0) {
        Wait-Process -Id ($processes | Select-Object -ExpandProperty Id)
    }
} finally {
    Cleanup
}
