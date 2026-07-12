#!/bin/bash
# HotAI Integration Test Runner
# Usage: ./run.sh              # run all integration tests
#        ./run.sh -v           # verbose output
#        ./run.sh -run Routing  # run only routing tests

set -e
cd "$(dirname "$0")/../.."

ARGS="$@"
if [ -z "$ARGS" ]; then
    ARGS="-count=1 -timeout=120s"
fi

echo "=== HotAI Integration Tests ==="
echo "Package: tests/integration/"
echo "Args: $ARGS"
echo ""

go test ./tests/integration/ $ARGS
