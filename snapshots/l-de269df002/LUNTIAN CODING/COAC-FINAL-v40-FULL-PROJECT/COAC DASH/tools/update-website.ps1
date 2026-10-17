param(
  [string]$ProjectRoot = "D:\COAC"
)

$ErrorActionPreference = "Stop"

try {
  # COAC Tool Aid's permanent home on this computer.
  # A manual -ProjectRoot value may still be supplied when needed.
  $ProjectRoot = $ProjectRoot.Trim().Trim('"')
  $ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
  $downloads = Join-Path $env:USERPROFILE "Downloads"

  if (-not (Test-Path "D:\")) {
    throw "Drive D: was not found. Connect or enable the D: drive, then try again."
  }

  if (-not (Test-Path $downloads)) {
    throw "Your Downloads folder could not be found at $downloads"
  }

  New-Item -ItemType Directory -Path $ProjectRoot -Force | Out-Null

  Write-Host ""
  Write-Host "Permanent project folder:" $ProjectRoot -ForegroundColor Cyan
  Write-Host "Searching Downloads for the newest complete COAC Tool Aid ZIP..." -ForegroundColor Gray

  $candidates = Get-ChildItem -Path $downloads -Filter "COAC-Tool-Aid*.zip" -File |
    Sort-Object LastWriteTime -Descending

  if (-not $candidates) {
    throw "No COAC-Tool-Aid update ZIP was found in $downloads"
  }

  $updateZip = $null
  $temporary = $null
  $source = $null

  # Ignore repair-only or incomplete ZIPs and use the newest complete project ZIP.
  foreach ($candidate in $candidates) {
    $candidateTemp = Join-Path $env:TEMP ("coac-tool-aid-update-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $candidateTemp | Out-Null

    try {
      Expand-Archive -LiteralPath $candidate.FullName -DestinationPath $candidateTemp -Force

      $candidateSource = $candidateTemp
      if (-not (Test-Path (Join-Path $candidateSource "package.json"))) {
        $candidateSource = Get-ChildItem -Path $candidateTemp -Directory |
          Where-Object { Test-Path (Join-Path $_.FullName "package.json") } |
          Select-Object -First 1 -ExpandProperty FullName
      }

      if ($candidateSource -and (Test-Path (Join-Path $candidateSource "package.json"))) {
        $updateZip = $candidate
        $temporary = $candidateTemp
        $source = $candidateSource
        break
      }
    }
    catch {
      # Continue checking older matching ZIPs.
    }

    if (Test-Path $candidateTemp) {
      Remove-Item -Path $candidateTemp -Recurse -Force -ErrorAction SilentlyContinue
    }
  }

  if (-not $updateZip -or -not $source) {
    throw "No complete COAC Tool Aid project ZIP was found in $downloads. Download the full project ZIP, not the repair-only ZIP."
  }

  try {
    Write-Host "Using update:" $updateZip.Name -ForegroundColor Cyan

    $oldLockHash = $null
    $currentLock = Join-Path $ProjectRoot "package-lock.json"
    if (Test-Path $currentLock) {
      $oldLockHash = (Get-FileHash -Algorithm SHA256 $currentLock).Hash
    }

    # Back up an existing installation. A first-time install has nothing to back up.
    if (Test-Path (Join-Path $ProjectRoot "package.json")) {
      $backupRoot = Join-Path $ProjectRoot ".coac-backups"
      $backup = Join-Path $backupRoot (Get-Date -Format "yyyyMMdd-HHmmss")
      New-Item -ItemType Directory -Path $backup -Force | Out-Null

      foreach ($item in @("app", "public", "tools", "package.json", "package-lock.json", "START-WEBSITE.bat", "UPDATE-WEBSITE.bat")) {
        $path = Join-Path $ProjectRoot $item
        if (Test-Path $path) {
          Copy-Item -Path $path -Destination $backup -Recurse -Force
        }
      }
    }

    $excludedDirectories = @(
      "node_modules", ".git", ".sites-runtime", "dist", ".next",
      ".wrangler", ".coac-backups"
    )
    $robocopyArguments = @(
      $source, $ProjectRoot, "/E", "/R:2", "/W:1", "/NFL", "/NDL", "/NJH", "/NJS",
      "/XD"
    ) + $excludedDirectories + @("/XF", "*.zip")

    & robocopy @robocopyArguments | Out-Null
    if ($LASTEXITCODE -gt 7) {
      throw "Windows could not copy the update files into $ProjectRoot"
    }

    $newLockHash = $null
    if (Test-Path $currentLock) {
      $newLockHash = (Get-FileHash -Algorithm SHA256 $currentLock).Hash
    }

    if ($oldLockHash -ne $newLockHash -or -not (Test-Path (Join-Path $ProjectRoot "node_modules"))) {
      Write-Host "Installing updated website components..." -ForegroundColor Yellow
      Push-Location $ProjectRoot
      try {
        & npm.cmd install
        if ($LASTEXITCODE -ne 0) {
          throw "npm install failed."
        }
      }
      finally {
        Pop-Location
      }
    }

    Write-Host ""
    Write-Host "COAC Tool Aid was updated successfully." -ForegroundColor Green
    Write-Host "Installed at: $ProjectRoot" -ForegroundColor Green
    Write-Host "Future updates should be run from D:\COAC\UPDATE-WEBSITE.bat" -ForegroundColor Yellow
  }
  finally {
    if ($temporary -and (Test-Path $temporary)) {
      Remove-Item -Path $temporary -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}
catch {
  Write-Host ""
  Write-Host "Update failed:" $_.Exception.Message -ForegroundColor Red
  exit 1
}
