# Pizza Day & Night — database backup.
#
# Dumps the MySQL/MariaDB database named in DATABASE_URL to a timestamped .sql
# file and prunes backups older than -KeepDays. Read-only: it connects to the
# already-running MySQL (start XAMPP's MySQL first), it never starts a server.
#
#   powershell -ExecutionPolicy Bypass -File scripts\backup-db.ps1
#   ...\backup-db.ps1 -OutDir D:\backups -KeepDays 30
#
# Schedule it once a day, just before the archive job (see DEPLOY.md).

param(
  # Where to read DATABASE_URL from; defaults to the project's .env.local.
  [string]$EnvFile,
  # Folder for the .sql files; defaults to <project>\backups.
  [string]$OutDir,
  # Delete dumps older than this many days.
  [int]$KeepDays = 14,
  # Path to mysqldump.exe; auto-detected from XAMPP / PATH when omitted.
  [string]$MysqldumpPath
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path $PSScriptRoot -Parent
if (-not $EnvFile) { $EnvFile = Join-Path $projectRoot ".env.local" }
if (-not $OutDir)  { $OutDir  = Join-Path $projectRoot "backups" }

# ── Read DATABASE_URL from the env file ──────────────────────────────────────
if (-not (Test-Path $EnvFile)) { Write-Error "Env file not found: $EnvFile"; exit 1 }

$dbLine = Select-String -Path $EnvFile -Pattern '^\s*DATABASE_URL\s*=' |
  Select-Object -First 1
if (-not $dbLine) { Write-Error "DATABASE_URL not set in $EnvFile"; exit 1 }

$dbUrl = ($dbLine.Line -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")

# mysql://user[:pass]@host[:port]/database[?params]
if ($dbUrl -notmatch '^mysql://([^:@/]+)(?::([^@/]*))?@([^:/]+)(?::(\d+))?/([^?]+)') {
  Write-Error "DATABASE_URL is not a mysql:// URL: $dbUrl"; exit 1
}
$dbUser = $matches[1]
$dbPass = $matches[2]
$dbHost = $matches[3]
$dbPort = if ($matches[4]) { $matches[4] } else { "3306" }
$dbName = $matches[5]

# ── Locate mysqldump ─────────────────────────────────────────────────────────
if (-not $MysqldumpPath) {
  foreach ($p in @("D:\xampp\mysql\bin\mysqldump.exe", "C:\xampp\mysql\bin\mysqldump.exe")) {
    if (Test-Path $p) { $MysqldumpPath = $p; break }
  }
  if (-not $MysqldumpPath) {
    $cmd = Get-Command mysqldump -ErrorAction SilentlyContinue
    if ($cmd) { $MysqldumpPath = $cmd.Source }
  }
}
if (-not $MysqldumpPath -or -not (Test-Path $MysqldumpPath)) {
  Write-Error "mysqldump not found. Pass -MysqldumpPath 'D:\xampp\mysql\bin\mysqldump.exe'."
  exit 1
}

# ── Dump ─────────────────────────────────────────────────────────────────────
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }
$stamp   = Get-Date -Format "yyyyMMdd-HHmmss"
$outFile = Join-Path $OutDir "pdn-$dbName-$stamp.sql"

# Credentials go through a temporary defaults file, so the password never shows
# up in the process list / argv.
$cnf = New-TemporaryFile
@"
[client]
user=$dbUser
password=$dbPass
host=$dbHost
port=$dbPort
"@ | Set-Content -Path $cnf -Encoding ascii

try {
  & $MysqldumpPath "--defaults-extra-file=$($cnf.FullName)" `
    --single-transaction --quick --routines --events `
    --result-file="$outFile" $dbName
  if ($LASTEXITCODE -ne 0) { Write-Error "mysqldump exited with code $LASTEXITCODE"; exit 1 }
}
finally {
  Remove-Item $cnf -Force -ErrorAction SilentlyContinue
}

$sizeKb = [math]::Round((Get-Item $outFile).Length / 1KB, 1)
Write-Host "OK  backup written: $outFile ($sizeKb KB)"

# ── Prune old dumps ──────────────────────────────────────────────────────────
$cutoff = (Get-Date).AddDays(-$KeepDays)
$old = Get-ChildItem -Path $OutDir -Filter "pdn-*.sql" |
  Where-Object { $_.LastWriteTime -lt $cutoff }
foreach ($f in $old) {
  Remove-Item $f.FullName -Force
  Write-Host "     pruned old backup: $($f.Name)"
}
Write-Host "OK  retention: kept last $KeepDays day(s)."
