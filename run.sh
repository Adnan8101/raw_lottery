#!/bin/bash

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

# Start the bot
echo "Starting the bot..."
echo "=============================="
npm start
