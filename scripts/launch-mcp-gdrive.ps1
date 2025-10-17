param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$RemainingArgs
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot ".env"

if (-not (Test-Path $envPath)) {
    Write-Error "Missing .env at $envPath"
    exit 1
}

Get-Content -Path $envPath | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#")) {
        $parts = $line -split "=", 2
        if ($parts.Count -eq 2) {
            $name = $parts[0].Trim()
            $value = $parts[1].Trim()
            if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            [Environment]::SetEnvironmentVariable($name, $value)
        }
    }
}

$entryPoint = Join-Path $repoRoot "dist/index.js"
if (-not (Test-Path $entryPoint)) {
    Write-Host "dist/index.js not found. Running npm run build..."
    Push-Location $repoRoot
    try {
        & npm run build
    } finally {
        Pop-Location
    }
}

if (-not (Test-Path $entryPoint)) {
    Write-Error "Server entry point not found at $entryPoint"
    exit 1
}

Write-Host "Launching MCP GDrive server..."
& node $entryPoint @RemainingArgs
exit $LASTEXITCODE
