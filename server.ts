#!/usr/bin/env node
import 'dotenv/config';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import cors from "cors";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";
import {
  getValidCredentials,
  setupTokenRefresh,
  loadCredentialsQuietly,
} from "./auth.js";
import { tools } from "./tools/index.js";
import { InternalToolResponse } from "./tools/types.js";

const drive = google.drive("v3");

// Configuration
const PORT = parseInt(process.env.MCP_PORT || "3000");
const HOST = process.env.MCP_HOST || "0.0.0.0"; // Bind to all interfaces
const API_KEY = process.env.MCP_API_KEY; // Optional API key for basic auth

const server = new Server(
  {
    name: "example-servers/gdrive",
    version: "0.2.0",
  },
  {
    capabilities: {
      resources: {
        schemes: ["gdrive"],
        listable: true,
        readable: true,
      },
      tools: {},
    },
  },
);

// Ensure we have valid credentials before making API calls
async function ensureAuth() {
  const auth = await getValidCredentials();
  google.options({ auth });
  return auth;
}

async function ensureAuthQuietly() {
  const auth = await loadCredentialsQuietly();
  if (auth) {
    google.options({ auth });
  }
  return auth;
}

server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
  await ensureAuthQuietly();
  const pageSize = 10;
  const params: any = {
    pageSize,
    fields: "nextPageToken, files(id, name, mimeType)",
  };

  if (request.params?.cursor) {
    params.pageToken = request.params.cursor;
  }

  const res = await drive.files.list(params);
  const files = res.data.files!;

  return {
    resources: files.map((file) => ({
      uri: `gdrive:///${file.id}`,
      mimeType: file.mimeType,
      name: file.name,
    })),
    nextCursor: res.data.nextPageToken,
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  await ensureAuthQuietly();
  const fileId = request.params.uri.replace("gdrive:///", "");
  const readFileTool = tools[1]; // gdrive_read_file is the second tool
  const result = await readFileTool.handler({ fileId });

  // Extract the file contents from the tool response
  const fileContents = result.content[0].text.split("\n\n")[1]; // Skip the "Contents of file:" prefix

  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: "text/plain",
        text: fileContents,
      },
    ],
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    })),
  };
});

// Helper function to convert internal tool response to SDK format
function convertToolResponse(response: InternalToolResponse) {
  return {
    _meta: {},
    content: response.content,
    isError: response.isError,
  };
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  await ensureAuth();
  const tool = tools.find((t) => t.name === request.params.name);
  if (!tool) {
    throw new Error("Tool not found");
  }

  const result = await tool.handler(request.params.arguments as any);
  return convertToolResponse(result);
});

async function startServer() {
  try {
    console.error("Initializing MCP Google Drive server...");
    // Don't block server startup on auth; set creds quietly if available
    await ensureAuthQuietly();
    
    // Create Express app
    const app = express();
    // Active SSE transports keyed by sessionId
    const transports = new Map<string, SSEServerTransport>();
    
    // Enable CORS for all origins (restrict in production)
    app.use(cors({
      origin: process.env.CORS_ORIGIN || "*",
      credentials: true,
    }));
    
    // API Key middleware (if configured)
    if (API_KEY) {
      app.use((req, res, next) => {
        const providedKey = req.headers['x-api-key'] || req.query.api_key;
        if (providedKey !== API_KEY) {
          return res.status(401).json({ error: "Unauthorized: Invalid API key" });
        }
        next();
      });
    }
    
    // Health check endpoint
    app.get("/health", (req, res) => {
      res.json({ status: "ok", service: "mcp-gdrive" });
    });
    
    // SSE endpoint for MCP (establishes the SSE stream)
    app.get("/sse", async (_req, res) => {
      console.error("New SSE connection established");
      const transport = new SSEServerTransport("/message", res);
      await server.connect(transport);
      // Register transport for routing POST messages
      transports.set(transport.sessionId, transport);
      transport.onclose = () => {
        transports.delete(transport.sessionId);
        console.error(`SSE session closed: ${transport.sessionId}`);
      };
      transport.onerror = (err) => {
        console.error("SSE transport error:", err);
      };
    });
    
    // Helper to route POST messages to the correct transport by sessionId
    const routePostMessage = async (req: express.Request, res: express.Response) => {
      // Accept sessionId from query, headers, or body for broader client compatibility
      const headerSessionId =
        (req.headers['x-session-id'] as string) ||
        (req.headers['x-sse-session-id'] as string) ||
        (req.headers['x-mcp-session-id'] as string) ||
        (req.headers['x-client-session-id'] as string);
      const bodySessionId = (req.body as any)?.sessionId;
      const sessionId = (req.query.sessionId as string) || headerSessionId || bodySessionId || "";
      if (!sessionId) {
        res.status(400).end("Missing sessionId");
        return;
      }
      const transport = transports.get(sessionId);
      if (!transport) {
        res.status(404).end("Unknown sessionId");
        return;
      }
      await transport.handlePostMessage(req, res);
    };
    
    // Message endpoint for SSE (new transport protocol)
    app.post("/message", routePostMessage);
    // Legacy fallback: some clients may POST to /sse
    app.post("/sse", routePostMessage);
    
    // Start HTTP server
    app.listen(PORT, HOST, () => {
      console.error(`MCP Google Drive server running on http://${HOST}:${PORT}`);
      console.error(`SSE endpoint: http://${HOST}:${PORT}/sse`);
      console.error(`Health check: http://${HOST}:${PORT}/health`);
      if (API_KEY) {
        console.error("API key authentication enabled");
      } else {
        console.error("WARNING: No API key configured. Set MCP_API_KEY for security.");
      }
    });
    
    // Set up periodic token refresh
    setupTokenRefresh();
    
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

// Start server
startServer().catch(console.error);
