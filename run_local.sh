#!/bin/bash

# Navigate to script directory
cd "$(dirname "$0")"

echo "Installing dependencies..."
npm install

echo "Starting development server in local test mode..."
export VITE_TEST_MODE=true
npm run dev
