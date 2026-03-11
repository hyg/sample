#!/bin/bash

echo "================================================================================"
echo "AWIKI.AI COMMAND-LINE MESSAGING DEMO"
echo "================================================================================"
echo "This script demonstrates the command-line interface for awiki.ai messaging"
echo "================================================================================"
echo ""

# Change to nodejs-client directory
cd nodejs-client

echo "[1] Checking Node.js client status..."
node scripts/check_status.js --credential default
echo ""

echo "[2] Querying database tables..."
node scripts/query_db.js "SELECT name FROM sqlite_master WHERE type='table'"
echo ""

echo "[3] Checking service status..."
node scripts/service_manager.js status
echo ""

echo "================================================================================"
echo "DEMO COMPLETED"
echo "================================================================================"
