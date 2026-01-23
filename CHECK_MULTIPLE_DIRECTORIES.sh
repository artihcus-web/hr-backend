#!/bin/bash
# Check for multiple backend directories

echo "🔍 Checking for multiple /data/backend directories..."
echo ""

# Check main location
echo "=== /data/backend ==="
if [ -d /data/backend ]; then
  echo "✅ Exists"
  echo "Owner: $(stat -c '%U:%G' /data/backend 2>/dev/null || echo 'unknown')"
  echo "Size: $(du -sh /data/backend 2>/dev/null | cut -f1)"
  echo "Git repo: $([ -d /data/backend/.git ] && echo 'YES' || echo 'NO')"
  if [ -d /data/backend/.git ]; then
    echo "Latest commit: $(cd /data/backend && git log -1 --oneline 2>/dev/null || echo 'N/A')"
  fi
  echo "Files count: $(find /data/backend -maxdepth 1 -type f | wc -l)"
else
  echo "❌ Does not exist"
fi
echo ""

# Check for other backend directories
echo "=== Searching for other 'backend' directories ==="
find /data -type d -name "backend" 2>/dev/null | while read dir; do
  echo "Found: $dir"
  echo "  Owner: $(stat -c '%U:%G' "$dir" 2>/dev/null || echo 'unknown')"
  echo "  Size: $(du -sh "$dir" 2>/dev/null | cut -f1)"
  echo "  Git repo: $([ -d "$dir/.git" ] && echo 'YES' || echo 'NO')"
  if [ -d "$dir/.git" ]; then
    echo "  Latest commit: $(cd "$dir" && git log -1 --oneline 2>/dev/null || echo 'N/A')"
  fi
  echo "  Files: $(find "$dir" -maxdepth 1 -type f | wc -l)"
  echo ""
done

# Check /data directory structure
echo "=== /data directory structure ==="
ls -la /data/ 2>/dev/null | head -20
echo ""

# Check for runner user directories
echo "=== Checking for 'runner' user directories ==="
if id runner >/dev/null 2>&1; then
  echo "Runner user exists"
  RUNNER_HOME=$(getent passwd runner | cut -d: -f6)
  echo "Runner home: $RUNNER_HOME"
  if [ -d "$RUNNER_HOME" ]; then
    find "$RUNNER_HOME" -type d -name "backend" 2>/dev/null | head -5
  fi
else
  echo "Runner user does not exist"
fi
echo ""

# Check processes and mounts
echo "=== Docker containers using /data/backend ==="
docker ps --format "{{.Names}}: {{.Mounts}}" | grep -i backend || echo "No backend containers with mounts"
echo ""

echo "✅ Check complete!"

