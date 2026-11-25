#!/bin/bash
set -e

echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

echo "🔨 Building React frontend..."
cd sn1perb0t111-main

# Install Node.js dependencies
echo "📥 Installing Node.js dependencies..."
npm ci --prefer-offline --no-audit

# Build the frontend
echo "🏗️ Building frontend for production..."
npm run build

echo "✅ Build completed successfully!"
