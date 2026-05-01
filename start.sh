#!/bin/bash

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
    echo ""
    echo "Stopping..."
    kill $(jobs -p) 2>/dev/null
    exit 0
}
trap cleanup INT TERM

echo "Starting backend..."
(cd "$ROOT_DIR/backend" && uv run python src/api.py) &
BACKEND_PID=$!

echo "Starting frontend..."
(cd "$ROOT_DIR/frontend" && bun run dev) &
FRONTEND_PID=$!

echo ""
echo "LifeInk AI is running:"
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:8000"
echo "  API Docs:  http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop."

wait
