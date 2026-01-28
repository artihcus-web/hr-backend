@echo off
REM Batch script to start SSH tunnel for MongoDB
REM This forwards local port 27017 to remote MongoDB on 97.77.20.150

echo 🔌 Starting SSH tunnel for MongoDB...
echo    Local port: 27017 -^> Remote: root@97.77.20.150:27017
echo.
echo ⚠️  This will prompt for your SSH password
echo 💡 To avoid password prompts, set up SSH key authentication:
echo    ssh-keygen -t rsa -b 4096
echo    ssh-copy-id root@97.77.20.150
echo.

REM Start SSH tunnel (runs in foreground - use Ctrl+C to stop)
ssh -L 27017:localhost:27017 root@97.77.20.150 -N

