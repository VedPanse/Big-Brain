#!/bin/bash

# Quick start script for Big-Brain Quiz backend
# This script starts the FastAPI backend server

cd "$(dirname "$0")"

echo "🧠 Starting Big-Brain Quiz Backend..."
echo "Server will run at: http://localhost:8000"
echo "API documentation: http://localhost:8000/docs"
echo ""

# Check if virtual environment exists
if [ ! -d "../.venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "Please run: python -m venv .venv"
    echo "Then: source .venv/bin/activate"
    echo "Finally: pip install -r requirements.txt"
    exit 1
fi

# Activate virtual environment and run server
source ../.venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
