#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
backend_dir="$repo_root/opera-server-py"
env_file="$backend_dir/.env"
env_example_file="$backend_dir/.env.example"
host="${HOST:-127.0.0.1}"
port="${PORT:-3001}"

if [ ! -d "$backend_dir" ]; then
  echo "FastAPI backend directory not found: $backend_dir" >&2
  exit 1
fi

if [ ! -f "$env_file" ]; then
  echo "Missing $env_file"
  echo "Create it from $env_example_file and fill in your provider API keys before starting the default backend."
  exit 1
fi

python_command=""

test_python_candidate() {
  "$1" -c "import fastapi, uvicorn, httpx, pydantic_settings" >/dev/null 2>&1
}

if [ -n "${PYTHON_EXE:-}" ] && [ -x "$PYTHON_EXE" ] && test_python_candidate "$PYTHON_EXE"; then
  python_command="$PYTHON_EXE"
elif command -v python3 >/dev/null 2>&1 && test_python_candidate python3; then
  python_command="python3"
elif command -v python >/dev/null 2>&1 && test_python_candidate python; then
  python_command="python"
else
  echo "No usable Python 3 environment with FastAPI backend dependencies was found." >&2
  echo "Set PYTHON_EXE to a working interpreter or install dependencies with:" >&2
  echo "  cd '$backend_dir' && <your-python> -m pip install -e '.[dev]'" >&2
  exit 1
fi

echo "Starting default backend: opera-server-py (FastAPI) on $host:$port"
echo "Python interpreter: $python_command"
echo "Node backend runtime is disabled; opera-server/ is kept as source reference only."

cd "$backend_dir"
exec "$python_command" -m uvicorn app.main:app --host "$host" --port "$port"
