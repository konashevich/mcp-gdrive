# MCP Google Drive - Network Installation Summary

## What Has Been Set Up

Your MCP Google Drive server has been configured for network access across your home network. Here's what's been added:

### New Files Created

1. **`server.ts`** - Network-enabled MCP server with HTTP/SSE transport
   - Exposes MCP via HTTP Server-Sent Events
   - Supports API key authentication
   - Allows multiple simultaneous clients
   - CORS enabled for cross-origin access

2. **`.env.example`** - Environment configuration template
   - Google OAuth settings
   - Network server configuration
   - Security settings

3. **`mcp-gdrive.service`** - Systemd service file
   - Enables automatic startup on boot
   - Service management (start/stop/restart)
   - System integration

4. **`setup-network-server.sh`** - Automated setup script
   - Interactive configuration
   - OAuth authentication helper
   - Service installation wizard

5. **`NETWORK_SETUP.md`** - Comprehensive setup guide
   - Detailed configuration instructions
   - Security best practices
   - Troubleshooting guide

6. **`QUICKSTART_NETWORK.md`** - Quick start guide
   - Fast setup instructions
   - Common use cases
   - Quick troubleshooting

### Package Updates

Updated `package.json` with:
- `express` - HTTP server framework
- `cors` - Cross-Origin Resource Sharing
- Type definitions for TypeScript

### New NPM Scripts

- `npm run start:stdio` - Original stdio mode (local)
- `npm run start:http` - Network HTTP/SSE mode (new)

## Architecture

### Original (Stdio Mode)
```
MCP Client <--stdin/stdout--> MCP Server <--> Google Drive API
```
- Local communication only
- Single client
- Started on-demand

### New (Network Mode)
```
MCP Client 1 --|
MCP Client 2 --|--> HTTP/SSE --> MCP Server <--> Google Drive API
MCP Client 3 --|
```
- Network communication
- Multiple simultaneous clients
- Persistent service
- API key authentication

## How to Get Started

### Option 1: Automated Setup (Recommended)
```bash
cd /mnt/merged_ssd/mcp-gdrive
./setup-network-server.sh
```

### Option 2: Manual Setup
See `QUICKSTART_NETWORK.md` for step-by-step instructions.

## Network Access

Once running, the server is accessible at:

**From the server machine:**
- `http://localhost:3000`

**From other devices on your network:**
- `http://YOUR_SERVER_IP:3000`

### Endpoints

- **Health Check**: `GET /health`
  - Returns: `{"status":"ok","service":"mcp-gdrive"}`
  
- **SSE Connection**: `GET /sse`
  - MCP Server-Sent Events endpoint
  - Requires `X-API-Key` header

### Example Usage

```bash
# Test connection
curl -H "X-API-Key: YOUR_API_KEY" http://YOUR_SERVER_IP:3000/health

# Connect MCP client
# Configure client to use: http://YOUR_SERVER_IP:3000/sse
# With header: X-API-Key: YOUR_API_KEY
```

## Security Features

1. **API Key Authentication**
   - Required for all requests
   - Configured in `.env` as `MCP_API_KEY`
   - Sent via `X-API-Key` header or `api_key` query param

2. **CORS Configuration**
   - Configurable allowed origins
   - Prevents unauthorized cross-origin access

3. **Firewall Integration**
   - Can restrict to local network only
   - Port-based access control

4. **OAuth Tokens**
   - Stored securely in `GDRIVE_CREDS_DIR`
   - Automatic refresh
   - Never exposed over network

## Service Management

### Start/Stop/Restart
```bash
sudo systemctl start mcp-gdrive
sudo systemctl stop mcp-gdrive
sudo systemctl restart mcp-gdrive
```

### Enable/Disable Auto-start
```bash
sudo systemctl enable mcp-gdrive   # Start on boot
sudo systemctl disable mcp-gdrive  # Don't start on boot
```

### View Logs
```bash
sudo journalctl -u mcp-gdrive -f         # Follow logs
sudo journalctl -u mcp-gdrive -n 100     # Last 100 lines
```

### Check Status
```bash
sudo systemctl status mcp-gdrive
```

## Configuration Files

### `.env` (You need to create this)
```bash
GDRIVE_CREDS_DIR=/home/yourusername/.config/mcp-gdrive
CLIENT_ID=your-client-id.apps.googleusercontent.com
CLIENT_SECRET=your-client-secret
MCP_PORT=3000
MCP_HOST=0.0.0.0
MCP_API_KEY=your-generated-api-key
CORS_ORIGIN=*
```

### OAuth Credentials File
Place at: `$GDRIVE_CREDS_DIR/gcp-oauth.keys.json`

Download from: Google Cloud Console > APIs & Services > Credentials

## Find Your Server IP

```bash
# On Linux
hostname -I | awk '{print $1}'

# Or
ip addr show | grep "inet " | grep -v 127.0.0.1
```

## Firewall Configuration

### Allow from local network only
```bash
# Example for 192.168.1.0/24 network
sudo ufw allow from 192.168.1.0/24 to any port 3000
sudo ufw enable
```

### Allow from anywhere (not recommended)
```bash
sudo ufw allow 3000/tcp
```

## Troubleshooting

### Port already in use
```bash
# Find what's using port 3000
sudo lsof -i :3000

# Change port in .env
MCP_PORT=3001
```

### Can't connect from other devices
1. Check firewall settings
2. Verify server is listening on `0.0.0.0` not `127.0.0.1`
3. Check `MCP_HOST` in `.env`
4. Ping server from client device

### Authentication failed
```bash
# Remove token and re-authenticate
rm $GDRIVE_CREDS_DIR/token.json
npm run start:http
# Follow browser prompts
```

### Service won't start
```bash
# Check logs for errors
sudo journalctl -u mcp-gdrive -n 50

# Test manually
cd /mnt/merged_ssd/mcp-gdrive
npm run start:http
```

## Client Configuration Examples

### Claude Desktop (MCP Client)
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

### Custom MCP Client
```javascript
const client = new MCPClient({
  transport: {
    type: 'sse',
    url: 'http://YOUR_SERVER_IP:3000/sse',
    headers: {
      'X-API-Key': 'your-api-key-here'
    }
  }
});
```

## Performance Notes

- Multiple clients can connect simultaneously
- Each client connection uses minimal resources
- Server persists between client connections
- OAuth token refreshed automatically
- No re-authentication needed for subsequent connections

## What Remains the Same

The following work exactly as before:
- Google Drive authentication flow
- All MCP tools (gdrive_search, gdrive_read_file, etc.)
- Resource access (gdrive:/// URIs)
- OAuth scopes and permissions
- Credentials storage

## Next Steps

1. **Run the setup script**:
   ```bash
   ./setup-network-server.sh
   ```

2. **Configure your clients** on other devices to connect to:
   ```
   http://YOUR_SERVER_IP:3000/sse
   ```

3. **Secure your setup**:
   - Set a strong API key
   - Configure firewall rules
   - Consider HTTPS with reverse proxy

4. **Monitor the service**:
   ```bash
   sudo journalctl -u mcp-gdrive -f
   ```

## Need Help?

- **Quick Start**: See `QUICKSTART_NETWORK.md`
- **Detailed Setup**: See `NETWORK_SETUP.md`
- **Original README**: See `README.md`
- **Issues**: Check service logs with `journalctl`

## Differences Summary

| Feature | Stdio Mode (Original) | Network Mode (New) |
|---------|----------------------|-------------------|
| Access | Local only | Network-wide |
| Transport | stdin/stdout | HTTP/SSE |
| Clients | Single | Multiple |
| Runtime | On-demand | Persistent service |
| Auth | None | API key |
| Startup | Manual/by client | Automatic (systemd) |

Both modes are available and can be used based on your needs!
