#!/bin/bash

APP_NAME="lottery-bot"

echo "Starting Lottery Bot Setup..."
echo "=============================="

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Create ticket template if it doesn't exist
if [ ! -f "assets/Black Minimalist Music Festival Ticket.png" ]; then
    echo "Creating ticket template..."
    npm run create-template
fi

# Build TypeScript files
echo "Building TypeScript files..."
npm run build

# Check if pm2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "pm2 not found. Installing pm2 globally..."
    npm install -g pm2
fi

echo "=============================="

# Check if the app is already running in pm2
if pm2 describe "$APP_NAME" &> /dev/null; then
    echo "Restarting $APP_NAME..."
    pm2 restart "$APP_NAME"
else
    echo "Starting $APP_NAME with pm2..."
    pm2 start dist/index.js --name "$APP_NAME"
    pm2 save
fi

echo "=============================="
pm2 status "$APP_NAME"
