# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Gmail MCP (Model Context Protocol) HTTP Server that provides multi-tenant SaaS integration with the Gmail API. It operates in two modes:

1. **Stateless HTTP Server** (`src/http-server.ts`) - Multi-tenant mode where each request includes user OAuth tokens
2. **Legacy Stdio Mode** - Single-user mode with local credential storage

The HTTP server is the primary production mode, designed for integration into SaaS applications like n8n where multiple users need Gmail access.

## Essential Commands

### Development
```bash
npm run dev          # Run HTTP server in development mode with tsx
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled HTTP server
npm run test         # Run test suite against HTTP server
```

### Docker
```bash
docker build -t mcp/gmail .
docker run -p 3001:3001 mcp/gmail
```

## Architecture

### Core Components

1. **HTTP Server (`src/http-server.ts`)** - Express server that:
   - Accepts JSON-RPC requests at POST `/mcp`
   - Extracts user OAuth tokens from headers (`X-Google-Access-Token`, `X-Google-Refresh-Token`) or `Authorization: Bearer`
   - Creates per-request OAuth2Client and Gmail API instances
   - Uses StreamableHTTPServerTransport in stateless mode (no session tracking)
   - Returns JSON-RPC responses

2. **Gmail Tools (`src/gmail-tools.ts`)** - MCP tool implementations:
   - All tools are Zod schemas converted to JSON Schema
   - `getToolDefinitions()` returns tool list for MCP
   - `createToolHandler()` returns async function that routes tool calls
   - Handles email operations (send, draft, read, search, modify, delete)
   - Manages attachments (send, receive, download)
   - Batch operations for efficiency

3. **Label Manager (`src/label-manager.ts`)** - Gmail label CRUD:
   - `createLabel()`, `updateLabel()`, `deleteLabel()`
   - `listLabels()`, `findLabelByName()`
   - `getOrCreateLabel()` - idempotent label creation

4. **Filter Manager (`src/filter-manager.ts`)** - Gmail filter management:
   - `createFilter()`, `listFilters()`, `getFilter()`, `deleteFilter()`
   - `filterTemplates` - pre-built templates (fromSender, withSubject, etc.)
   - Criteria-based matching with action execution

5. **Utilities (`src/utl.ts`)** - Email formatting:
   - `createEmailMessage()` - builds raw RFC822 messages
   - `createEmailWithNodemailer()` - handles attachments via nodemailer
   - `encodeEmailHeader()` - RFC 2047 MIME encoding for international chars

### Request Flow

```
HTTP POST /mcp
  → Extract OAuth tokens from headers/body
  → Create OAuth2Client with user tokens
  → Create gmail API instance
  → Create MCP server with gmail instance
  → Create StreamableHTTPServerTransport (stateless)
  → server.connect(transport)
  → transport.handleRequest(req, res, body)
  → Tool handler routes to appropriate function
  → Return JSON-RPC response
```

### Authentication Model

**HTTP Server (Multi-tenant)**:
- Each request MUST include user's Google OAuth tokens
- No persistent session state
- OAuth2Client created per-request with user tokens
- Headers: `X-Google-Access-Token` (required), `X-Google-Refresh-Token` (optional)
- Alternative: `Authorization: Bearer <access_token>`

**Legacy Stdio Mode** (not in HTTP server):
- Credentials stored in `~/.gmail-mcp/credentials.json`
- Single user authentication
- Browser-based OAuth flow during initial auth

## Key Implementation Details

### Email Content Extraction
The `extractEmailContent()` function recursively processes MIME message parts to handle:
- Nested multipart structures
- Plain text vs HTML preference
- Attachment metadata (filename, mimeType, size, attachmentId)

### Attachment Handling
- **Sending**: Uses nodemailer to create proper MIME multipart/mixed messages
- **Downloading**: Two-step process - get attachment metadata from message, then download by attachmentId
- **Display**: Enhanced read_email shows attachment details with download IDs

### Batch Operations
Gmail API has rate limits, so batch operations:
- Default batch size: 50 messages
- Process in chunks to avoid API quota errors
- Individual error handling with detailed reporting
- Used by `batch_modify_emails` and `batch_delete_emails`

### Zod Schema Pattern
All tools follow this pattern:
```typescript
export const ToolNameSchema = z.object({...}).describe("...");

// In getToolDefinitions():
{
  name: "tool_name",
  description: "...",
  inputSchema: zodToJsonSchema(ToolNameSchema)
}

// In createToolHandler():
case "tool_name":
  const validated = ToolNameSchema.parse(args);
  // implementation
```

## Environment Variables

- `PORT` - HTTP server port (default: 3001)
- `ALLOWED_ORIGINS` - CORS origins, comma-separated (default: '*')
- `NODE_ENV` - Environment (production/development)

## Important Constraints

1. **No Session State**: HTTP server is stateless - each request is independent
2. **Token Required**: Every /mcp request must include valid Google OAuth tokens
3. **Gmail API Limits**: Respect batch sizes and rate limits
4. **MIME Encoding**: Always use proper RFC 2047 encoding for non-ASCII headers
5. **Attachment Size**: Gmail has 25MB per-email limit

## Testing

The `test-http-server.ts` file demonstrates:
- How to authenticate and get OAuth tokens
- Sending requests to /mcp endpoint with proper headers
- JSON-RPC request format
- Tool invocation examples

## Common Pitfalls

1. **Missing OAuth Tokens**: Requests without `X-Google-Access-Token` fail with 401
2. **Session State Confusion**: Don't expect session persistence - pass tokens on every request
3. **Attachment Paths**: Must be absolute and readable by server process
4. **Label IDs vs Names**: Gmail uses IDs (e.g., "Label_123") not names in most operations
5. **Filter Templates**: Must provide all required parameters for chosen template

## File Structure

```
src/
  http-server.ts      # Express HTTP server (main entry point)
  gmail-tools.ts      # MCP tool definitions and handlers
  label-manager.ts    # Label CRUD operations
  filter-manager.ts   # Filter management with templates
  utl.ts             # Email message utilities
dist/                 # Compiled JavaScript output
```
