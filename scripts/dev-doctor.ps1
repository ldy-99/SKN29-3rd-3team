# Local development environment checker only.
# This script is not a production health check or deployment gate.

$ErrorActionPreference = "Continue"

function Write-Check {
    param(
        [string] $Name,
        [bool] $Ok,
        [string] $Detail = ""
    )

    $status = if ($Ok) { "OK" } else { "CHECK" }
    $message = "[$status] $Name"
    if ($Detail) {
        $message = "$message - $Detail"
    }
    Write-Host $message
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "Development environment doctor"
Write-Host "Project: $projectRoot"
Write-Host ""

$pythonPath = Join-Path $projectRoot ".venv\Scripts\python.exe"
$pythonReady = $false

if (Test-Path $pythonPath) {
    $pythonVersion = & $pythonPath --version 2>&1
    $pythonReady = $LASTEXITCODE -eq 0
    Write-Check ".venv python" $pythonReady $pythonPath
    if ($pythonVersion) {
        Write-Host "  $pythonVersion"
    }
} else {
    Write-Check ".venv python" $false $pythonPath
    Write-Host "  Create it with: py -3.10 -m venv .venv"
}

Write-Check "root .env" (Test-Path (Join-Path $projectRoot ".env")) ".env is local and must not be committed"
Write-Check "frontend .env.local" (Test-Path (Join-Path $projectRoot "frontend-react\.env.local")) "Vite reads this file"

$chromaSqlite = Join-Path $projectRoot "Backend\src\preprocessing\chroma_db\chroma.sqlite3"
Write-Check "ChromaDB sqlite file" (Test-Path $chromaSqlite) $chromaSqlite

if ($pythonReady) {
    Write-Host ""
    Write-Host "Django check:"
    & $pythonPath "django_backend\manage.py" check

    Write-Host ""
    Write-Host "FastAPI import:"
    & $pythonPath -c "import sys; sys.path.insert(0, 'Backend'); from main import app; print(app.title)"

    Write-Host ""
    Write-Host "ChromaDB collections:"
    # Count check is intentionally read-only. Query checks need OpenAI embeddings and may cost API usage.
    & $pythonPath -c "import chromadb; expected={'faq_chunks','guide_chunks','law_chunks','lh_guide_chunks','manual_chunks','web_faq_chunks'}; c=chromadb.PersistentClient(path='Backend/src/preprocessing/chroma_db'); cols=sorted((x.name, x.count()) for x in c.list_collections()); print(cols); names={x[0] for x in cols}; raise SystemExit(0 if names == expected else 1)"
    Write-Check "ChromaDB expected collections" ($LASTEXITCODE -eq 0) "run build_all.py and confirm faq/guide/law/lh_guide/manual/web_faq chunks"
}

Write-Host ""
Write-Host "React package check:"
Push-Location "frontend-react"
try {
    if (Test-Path "node_modules\.bin\vite.CMD") {
        Write-Check "frontend node_modules" $true "vite is installed"
    } else {
        Write-Check "frontend node_modules" $false "run: pnpm.cmd install --frozen-lockfile"
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Done. This script checks local development readiness only."
