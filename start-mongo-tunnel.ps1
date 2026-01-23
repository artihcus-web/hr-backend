# PowerShell script to start SSH tunnel for MongoDB
# This forwards local port 27017 to remote MongoDB on 97.77.20.150

$remoteHost = "root@97.77.20.150"
$localPort = "27017"
$remotePort = "27017"

Write-Host "🔌 Starting SSH tunnel for MongoDB..." -ForegroundColor Cyan
Write-Host "   Local port: $localPort -> Remote: $remoteHost:$remotePort" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  This will prompt for your SSH password" -ForegroundColor Yellow
Write-Host "💡 To avoid password prompts, set up SSH key authentication:" -ForegroundColor Yellow
Write-Host "   ssh-keygen -t rsa -b 4096" -ForegroundColor Gray
Write-Host "   ssh-copy-id $remoteHost" -ForegroundColor Gray
Write-Host ""

# Start SSH tunnel in background
Start-Process ssh -ArgumentList "-L", "${localPort}:localhost:${remotePort}", $remoteHost, "-N" -WindowStyle Hidden

Write-Host "✅ SSH tunnel started in background" -ForegroundColor Green
Write-Host "📍 MongoDB should now be accessible at localhost:$localPort" -ForegroundColor Green
Write-Host ""
Write-Host "To stop the tunnel, run:" -ForegroundColor Yellow
Write-Host "   Get-Process ssh | Where-Object {`$_.CommandLine -like '*27017*' } | Stop-Process" -ForegroundColor Gray

