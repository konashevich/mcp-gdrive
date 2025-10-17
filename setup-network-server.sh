#!/bin/bash

# MCP Google Drive Network Server Setup Script
# This script helps set up the MCP Google Drive server for network access

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo "MCP Google Drive Network Server Setup"
echo "========================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from template..."
    cp .env.example .env
    echo "✅ Created .env file"
    echo ""
    echo "⚠️  IMPORTANT: You must edit .env and configure:"
    echo "   - GDRIVE_CREDS_DIR (directory for OAuth tokens)"
    echo "   - CLIENT_ID (from Google Cloud Console)"
    echo "   - CLIENT_SECRET (from Google Cloud Console)"
    echo "   - MCP_API_KEY (generate with: openssl rand -hex 32)"
    echo ""
    read -p "Press Enter to open .env in your default editor..."
    ${EDITOR:-nano} .env
else
    echo "✅ .env file exists"
fi

echo ""
echo "Checking configuration..."

# Source .env
source .env

# Check required variables
MISSING_VARS=()

if [ -z "$GDRIVE_CREDS_DIR" ] || [ "$GDRIVE_CREDS_DIR" = "/home/YOUR_USERNAME/.config/mcp-gdrive" ]; then
    MISSING_VARS+=("GDRIVE_CREDS_DIR")
fi

if [ -z "$CLIENT_ID" ] || [ "$CLIENT_ID" = "your-client-id-here.apps.googleusercontent.com" ]; then
    MISSING_VARS+=("CLIENT_ID")
fi

if [ -z "$CLIENT_SECRET" ] || [ "$CLIENT_SECRET" = "your-client-secret-here" ]; then
    MISSING_VARS+=("CLIENT_SECRET")
fi

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo ""
    echo "❌ The following required variables are not configured in .env:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Please edit .env and run this script again."
    exit 1
fi

# Check/create credentials directory
if [ ! -d "$GDRIVE_CREDS_DIR" ]; then
    echo "Creating credentials directory: $GDRIVE_CREDS_DIR"
    mkdir -p "$GDRIVE_CREDS_DIR"
    echo "✅ Created credentials directory"
else
    echo "✅ Credentials directory exists"
fi

# Check for OAuth keys file
OAUTH_KEYS="$GDRIVE_CREDS_DIR/gcp-oauth.keys.json"
if [ ! -f "$OAUTH_KEYS" ]; then
    echo ""
    echo "⚠️  OAuth keys file not found: $OAUTH_KEYS"
    echo "   You need to download your OAuth client credentials from Google Cloud Console"
    echo "   and save them as: $OAUTH_KEYS"
    echo ""
    read -p "Press Enter when you have placed the file, or Ctrl+C to exit..."
    
    if [ ! -f "$OAUTH_KEYS" ]; then
        echo "❌ OAuth keys file still not found. Exiting."
        exit 1
    fi
fi

echo "✅ OAuth keys file exists"

# Generate API key if not set or is default
if [ -z "$MCP_API_KEY" ] || [ "$MCP_API_KEY" = "your-secure-random-api-key-here" ]; then
    echo ""
    echo "⚠️  No MCP_API_KEY configured. Generating one..."
    
    if command -v openssl &> /dev/null; then
        NEW_API_KEY=$(openssl rand -hex 32)
        echo "MCP_API_KEY=$NEW_API_KEY" >> .env
        sed -i "s/MCP_API_KEY=.*/MCP_API_KEY=$NEW_API_KEY/" .env
        echo "✅ Generated and saved MCP_API_KEY"
        echo "   Your API key: $NEW_API_KEY"
        echo "   (This has been saved to .env)"
    else
        echo "⚠️  openssl not found. Please manually set MCP_API_KEY in .env"
    fi
else
    echo "✅ MCP_API_KEY is configured"
fi

# Check if already authenticated
TOKEN_FILE="$GDRIVE_CREDS_DIR/token.json"
if [ -f "$TOKEN_FILE" ]; then
    echo "✅ Already authenticated (token.json exists)"
    NEED_AUTH=false
else
    echo "⚠️  Not yet authenticated with Google"
    NEED_AUTH=true
fi

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')
MCP_PORT=${MCP_PORT:-3000}

echo ""
echo "========================================"
echo "Configuration Summary"
echo "========================================"
echo "Credentials Directory: $GDRIVE_CREDS_DIR"
echo "Server IP: $SERVER_IP"
echo "Server Port: $MCP_PORT"
echo "API Key: ${MCP_API_KEY:0:8}... (hidden)"
echo ""

if [ "$NEED_AUTH" = true ]; then
    echo "========================================"
    echo "Initial Authentication Required"
    echo "========================================"
    echo ""
    echo "You need to authenticate with Google once."
    echo "This will open a browser window for OAuth authentication."
    echo ""
    read -p "Press Enter to start authentication process..."
    
    echo ""
    echo "Starting server for authentication..."
    npm run start:http &
    SERVER_PID=$!
    
    echo "Waiting for authentication..."
    echo "Please follow the browser prompts to authenticate."
    echo ""
    echo "Press Ctrl+C when authentication is complete (after you see 'Authentication successful' in the browser)"
    
    wait $SERVER_PID || true
    
    if [ -f "$TOKEN_FILE" ]; then
        echo ""
        echo "✅ Authentication successful!"
    else
        echo ""
        echo "⚠️  Token file not created. You may need to authenticate manually."
    fi
fi

echo ""
echo "========================================"
echo "Installation Options"
echo "========================================"
echo ""
echo "Choose how to run the server:"
echo ""
echo "1) Manual start (for testing)"
echo "2) Install as systemd service (recommended for always-on)"
echo "3) Exit (I'll do it manually)"
echo ""
read -p "Enter choice [1-3]: " choice

case $choice in
    1)
        echo ""
        echo "Starting server manually..."
        echo "Press Ctrl+C to stop"
        echo ""
        echo "Server will be available at:"
        echo "  - Health: http://$SERVER_IP:$MCP_PORT/health"
        echo "  - SSE: http://$SERVER_IP:$MCP_PORT/sse"
        echo ""
        npm run start:http
        ;;
    2)
        echo ""
        echo "Installing systemd service..."
        
        # Update service file with current user and paths
        CURRENT_USER=$(whoami)
        TEMP_SERVICE=$(mktemp)
        
        sed "s|YOUR_USERNAME|$CURRENT_USER|g" mcp-gdrive.service > "$TEMP_SERVICE"
        sed -i "s|/mnt/merged_ssd/mcp-gdrive|$SCRIPT_DIR|g" "$TEMP_SERVICE"
        
        sudo cp "$TEMP_SERVICE" /etc/systemd/system/mcp-gdrive.service
        rm "$TEMP_SERVICE"
        
        sudo systemctl daemon-reload
        sudo systemctl enable mcp-gdrive
        sudo systemctl start mcp-gdrive
        
        echo "✅ Service installed and started"
        echo ""
        echo "Service commands:"
        echo "  - Status: sudo systemctl status mcp-gdrive"
        echo "  - Logs:   sudo journalctl -u mcp-gdrive -f"
        echo "  - Stop:   sudo systemctl stop mcp-gdrive"
        echo "  - Start:  sudo systemctl start mcp-gdrive"
        echo ""
        
        sleep 2
        sudo systemctl status mcp-gdrive --no-pager
        ;;
    3)
        echo "Exiting. You can start the server manually with: npm run start:http"
        exit 0
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "Your MCP Google Drive server is now accessible on your network at:"
echo ""
echo "  Base URL: http://$SERVER_IP:$MCP_PORT"
echo "  Health Check: http://$SERVER_IP:$MCP_PORT/health"
echo "  SSE Endpoint: http://$SERVER_IP:$MCP_PORT/sse"
echo ""
echo "To connect from other machines, use this API key:"
echo "  $MCP_API_KEY"
echo ""
echo "Example curl command to test:"
echo "  curl -H \"X-API-Key: $MCP_API_KEY\" http://$SERVER_IP:$MCP_PORT/health"
echo ""
echo "For detailed usage instructions, see: NETWORK_SETUP.md"
echo ""
