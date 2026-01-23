# PowerShell script to stop SSH tunnel for MongoDB

Write-Host "🛑 Stopping SSH tunnel for MongoDB..." -ForegroundColor Cyan

# Find and stop SSH processes that are forwarding port 27017
$sshProcesses = Get-Process ssh -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*27017*" -or $_.CommandLine -like "*97.77.20.150*"
}

if ($sshProcesses) {
    $sshProcesses | Stop-Process -Force
    Write-Host "✅ Stopped $($sshProcesses.Count) SSH tunnel process(es)" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No SSH tunnel processes found" -ForegroundColor Yellow
}

