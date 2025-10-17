# MCP Google Drive Network Server Setup

## Overview
This guide explains how to run the MCP Google Drive server as a network-accessible service on your home network.

## Prerequisites
1. Complete the initial Google OAuth setup as described in the main README.md
2. Ensure you have authenticated at least once by running `node dist/index.js`

## Configuration

### 1. Environment Variables
Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your values:
- `GDRIVE_CREDS_DIR`: Directory for OAuth tokens (e.g., `/home/username/.config/mcp-gdrive`)
- `CLIENT_ID`: Your Google OAuth Client ID
- `CLIENT_SECRET`: Your Google OAuth Client Secret
- `MCP_PORT`: Port to run the server on (default: 3000)
- `MCP_HOST`: Host to bind to (use `0.0.0.0` for all network interfaces)
- `MCP_API_KEY`: A secure random string for API authentication (optional but recommended)
- `CORS_ORIGIN`: Allowed CORS origins (use `*` for all, or comma-separated list)

### 2. Generate a Secure API Key
```bash
# Generate a random API key
openssl rand -hex 32
```

Add this to your `.env` file as `MCP_API_KEY`.

## Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Build the Project
```bash
npm run build
```

### 3. Initial Authentication
Run the server once to complete OAuth authentication:
```bash
npm run start:http
```

Follow the browser prompt to authenticate. After successful authentication, press Ctrl+C to stop the server.

## Running as a Service

### Manual Start
```bash
npm run start:http
```

The server will be available at `http://YOUR_IP:3000`

### Systemd Service (Recommended for Always-On)

1. **Edit the service file** (`mcp-gdrive.service`):
   - Replace `YOUR_USERNAME` with your actual username
   - Verify paths are correct

2. **Install the service**:
   ```bash
   sudo cp mcp-gdrive.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable mcp-gdrive
   sudo systemctl start mcp-gdrive
   ```

3. **Check service status**:
   ```bash
   sudo systemctl status mcp-gdrive
   ```

4. **View logs**:
   ```bash
   sudo journalctl -u mcp-gdrive -f
   ```

## Accessing the Server

### From Other Machines on Your Network

The server exposes an SSE (Server-Sent Events) endpoint:

**Base URL**: `http://YOUR_SERVER_IP:3000`

**Endpoints**:
- Health check: `GET http://YOUR_SERVER_IP:3000/health`
- SSE connection: `GET http://YOUR_SERVER_IP:3000/sse`

### Using with MCP Clients

When configuring MCP clients on other machines, use the SSE transport:

```json
{
  "mcpServers": {
    "gdrive": {
      "url": "http://YOUR_SERVER_IP:3000/sse",
      "transport": "sse",
      "headers": {
        "X-API-Key": "your-api-key-here"
      }
    }
  }
}
```

### Test the Connection

```bash
# Health check
curl http://YOUR_SERVER_IP:3000/health

# With API key
curl -H "X-API-Key: your-api-key-here" http://YOUR_SERVER_IP:3000/health
```

## Security Considerations

### 1. API Key Authentication
Always set `MCP_API_KEY` in production. Clients must include this in requests:
- Header: `X-API-Key: your-api-key`
- Query param: `?api_key=your-api-key`

### 2. Firewall Configuration
If you want to restrict access to your local network only:

```bash
# Allow only from local network (example: 192.168.1.0/24)
sudo ufw allow from 192.168.1.0/24 to any port 3000
sudo ufw enable
```

### 3. CORS Configuration
Restrict `CORS_ORIGIN` to specific domains instead of `*` for production use.

### 4. HTTPS (Optional)
For additional security, consider setting up a reverse proxy with HTTPS:

```nginx
# Nginx example
server {
    listen 443 ssl;
    server_name mcp-gdrive.local;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Troubleshooting

### Service Won't Start
```bash
# Check logs
sudo journalctl -u mcp-gdrive -n 50

# Test manually
cd /mnt/merged_ssd/mcp-gdrive
node dist/server.js
```

### Authentication Issues
```bash
# Re-authenticate
rm -rf $GDRIVE_CREDS_DIR/token.json
node dist/server.js
```

### Port Already in Use
```bash
# Find what's using the port
sudo lsof -i :3000

# Change port in .env
MCP_PORT=3001
```

### Network Access Issues
```bash
# Check if server is listening on all interfaces
sudo netstat -tulpn | grep 3000

# Test from server itself
curl http://localhost:3000/health

# Test from another machine on network
curl http://SERVER_IP:3000/health
```

## Monitoring

### Resource Usage
```bash
# CPU and memory usage
ps aux | grep "node.*server.js"

# Detailed stats
top -p $(pgrep -f "node.*server.js")
```

### Active Connections
```bash
# See active connections
sudo netstat -an | grep :3000
```

## Updating

```bash
cd /mnt/merged_ssd/mcp-gdrive
git pull  # if using git
npm install
npm run build
sudo systemctl restart mcp-gdrive
```

## Differences from Stdio Mode

### Stdio Mode (Original)
- Used for local client-server communication
- Communicates via stdin/stdout
- Started on-demand by MCP clients
- Single client at a time

### Network Mode (New)
- Accessible over HTTP/SSE
- Multiple clients can connect simultaneously
- Runs as a persistent service
- Requires API key authentication
- Can be accessed from any machine on the network

Both modes are available:
- `npm run start:stdio` - Local stdio mode
- `npm run start:http` - Network HTTP/SSE mode
