#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { getToolDefinitions, createToolHandler } from "./gmail-tools.js";

const app = express();

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
app.use(cors({
    origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Google-Access-Token',
        'X-Google-Refresh-Token',
        'mcp-session-id',
    ],
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create MCP server instance with a Gmail client
function createMcpServer(gmail: ReturnType<typeof google.gmail>) {
    const server = new Server({
        name: "gmail",
        version: "1.0.0",
    }, {
        capabilities: {
            tools: {},
        },
    });

    // Register tool list handler
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: getToolDefinitions(),
    }));

    // Register tool call handler
    const handleToolCall = createToolHandler(gmail);
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        return await handleToolCall(name, args);
    });

    return server;
}

// Extract Google tokens from request
function extractTokens(req: Request): { accessToken: string | null; refreshToken: string | null } {
    // Try headers first (preferred)
    let accessToken = req.headers['x-google-access-token'] as string | undefined;
    let refreshToken = req.headers['x-google-refresh-token'] as string | undefined;

    // Fall back to Authorization header (Bearer token)
    if (!accessToken && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
            accessToken = authHeader.substring(7);
        }
    }

    // Fall back to request body
    if (!accessToken && req.body?.credentials) {
        accessToken = req.body.credentials.access_token;
        refreshToken = req.body.credentials.refresh_token;
    }

    return {
        accessToken: accessToken || null,
        refreshToken: refreshToken || null,
    };
}

// MCP endpoint - handles JSON-RPC requests
app.post('/mcp', async (req: Request, res: Response) => {
    try {
        // Extract tokens from request
        const { accessToken, refreshToken } = extractTokens(req);

        if (!accessToken) {
            res.status(401).json({
                jsonrpc: '2.0',
                error: {
                    code: -32001,
                    message: 'Missing Google access token. Provide via X-Google-Access-Token header or Authorization: Bearer header.',
                },
                id: req.body?.id || null,
            });
            return;
        }

        // Create per-request OAuth2Client with user's tokens
        const oauth2Client = new OAuth2Client();
        oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken || undefined,
        });

        // Create Gmail API client with user's auth
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Create MCP server instance with this gmail client
        const server = createMcpServer(gmail);

        // Create stateless transport (no session tracking)
        // Per MCP SDK docs: sessionIdGenerator: undefined disables session management
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
        });

        // Clean up transport when response closes
        res.on('close', () => {
            transport.close();
        });

        // Connect server to transport
        await server.connect(transport);

        // Handle the request
        await transport.handleRequest(req, res, req.body);
    } catch (error: any) {
        console.error('MCP request error:', error);

        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: `Internal error: ${error.message}`,
                },
                id: req.body?.id || null,
            });
        }
    }
});

// Handle GET requests for SSE streams (if needed)
app.get('/mcp', async (req: Request, res: Response) => {
    res.status(405).json({
        jsonrpc: '2.0',
        error: {
            code: -32000,
            message: 'SSE streams not supported in stateless mode. Use POST requests.',
        },
        id: null,
    });
});

// Handle DELETE for session termination (not needed in stateless mode)
app.delete('/mcp', async (req: Request, res: Response) => {
    res.status(200).json({
        jsonrpc: '2.0',
        result: { message: 'Stateless mode - no session to terminate' },
        id: req.body?.id || null,
    });
});

// Start server
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`Gmail MCP HTTP Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
    console.log('');
    console.log('Required headers for requests:');
    console.log('  X-Google-Access-Token: <user\'s Google access token>');
    console.log('  X-Google-Refresh-Token: <user\'s Google refresh token> (optional)');
    console.log('');
    console.log('Or use Authorization: Bearer <access_token>');
});
