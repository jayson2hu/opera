$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $repoRoot 'opera-server-py'
$envFile = Join-Path $backendDir '.env'
$envExampleFile = Join-Path $backendDir '.env.example'

if (-not (Test-Path $backendDir)) {
    Write-Error "FastAPI backend directory not found: $backendDir"
}

if (-not (Test-Path $envFile)) {
    Write-Host "Missing $envFile" -ForegroundColor Yellow
    Write-Host "Create it from $envExampleFile and fill in your provider API keys before starting the default backend." -ForegroundColor Yellow
    exit 1
}

$pythonCommand = $null
$pythonArgs = @()

function Test-PythonCandidate {
    param(
        [string]$Command,
        [string[]]$Args = @()
    )

    & $Command @($Args + @('-c', 'import fastapi, uvicorn, httpx, pydantic_settings')) *> $null
    return $LASTEXITCODE -eq 0
}

$candidates = @()
if ($env:PYTHON_EXE -and (Test-Path $env:PYTHON_EXE)) {
    $candidates += @{ Command = $env:PYTHON_EXE; Args = @() }
}
foreach ($cmd in Get-Command python -All -ErrorAction SilentlyContinue) {
    if ($cmd.Source) {
        $candidates += @{ Command = $cmd.Source; Args = @() }
    }
}
foreach ($cmd in Get-Command py -All -ErrorAction SilentlyContinue) {
    if ($cmd.Source) {
        $candidates += @{ Command = $cmd.Source; Args = @('-3') }
    }
}

$seenCandidates = @{}
foreach ($candidate in $candidates) {
    $key = "$($candidate.Command)|$($candidate.Args -join ' ')"
    if ($seenCandidates.ContainsKey($key)) {
        continue
    }
    $seenCandidates[$key] = $true

    if (Test-PythonCandidate -Command $candidate.Command -Args $candidate.Args) {
        $pythonCommand = $candidate.Command
        $pythonArgs = $candidate.Args
        break
    }
}

if (-not $pythonCommand) {
    Write-Host 'No usable Python 3 environment with FastAPI backend dependencies was found.' -ForegroundColor Red
    Write-Host 'Set PYTHON_EXE to a working interpreter or install dependencies with:' -ForegroundColor Yellow
    Write-Host "  Set-Location '$backendDir'" -ForegroundColor Yellow
    Write-Host '  <your-python> -m pip install -e ".[dev]"' -ForegroundColor Yellow
    exit 1
}


$bindHost = if ($env:HOST) { $env:HOST } else { '127.0.0.1' }
$bindPort = if ($env:PORT) { $env:PORT } else { '3001' }

Write-Host "Starting default backend: opera-server-py (FastAPI) on $bindHost`:$bindPort" -ForegroundColor Green
Write-Host "Python interpreter: $pythonCommand $($pythonArgs -join ' ')" -ForegroundColor DarkGray
Write-Host 'Node backend runtime is disabled; opera-server/ is kept as source reference only.' -ForegroundColor DarkYellow
Write-Host 'Linux/macOS local entry: ./start-backend.sh | Docker: docker compose up --build' -ForegroundColor Cyan


Set-Location $backendDir
& $pythonCommand @($pythonArgs + @('-m', 'uvicorn', 'app.main:app', '--host', $bindHost, '--port', $bindPort))


exit $LASTEXITCODE
