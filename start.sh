#!/usr/bin/env bash
set -e

URL="http://localhost:80"

echo "Starting Docker services..."
docker-compose up --build -d

echo "Waiting for frontend to be ready..."
until docker inspect --format='{{.State.Health.Status}}' prioritai-frontend 2>/dev/null | grep -q "healthy"; do
  sleep 2
  echo "  still waiting..."
done

echo "Frontend is ready! Opening $URL ..."
# Works on Windows (Git Bash / WSL), macOS, and Linux
if command -v powershell.exe &>/dev/null; then
  powershell.exe Start-Process "$URL"
elif command -v xdg-open &>/dev/null; then
  xdg-open "$URL"
elif command -v open &>/dev/null; then
  open "$URL"
fi

echo ""
echo "Following logs (Ctrl+C to stop)..."
docker-compose logs -f
