#!/usr/bin/env npx tsx

/**
 * Test script for Gmail MCP HTTP Server
 *
 * Usage:
 *   npx tsx test-http-server.ts                          # Basic tests (no token needed)
 *   npx tsx test-http-server.ts <access_token>           # Full tests with Gmail API
 */

const BASE_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001';
const ACCESS_TOKEN = process.argv[2];

interface JsonRpcResponse {
    jsonrpc: string;
    id: number;
    result?: any;
    error?: { code: number; message: string };
}

async function makeRequest(
    method: string,
    params?: any,
    token?: string
): Promise<JsonRpcResponse> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
    };

    if (token) {
        headers['X-Google-Access-Token'] = token;
    }

    const body = {
        jsonrpc: '2.0',
        method,
        ...(params && { params }),
        id: Date.now(),
    };

    const response = await fetch(`${BASE_URL}/mcp`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    return response.json();
}

async function testHealthCheck() {
    console.log('\n📍 Testing health endpoint...');
    try {
        const response = await fetch(`${BASE_URL}/health`);
        const data = await response.json();
        console.log('   ✅ Health check passed:', data);
        return true;
    } catch (error: any) {
        console.log('   ❌ Health check failed:', error.message);
        console.log('   💡 Make sure the server is running: npm run start:http');
        return false;
    }
}

async function testAuthRequired() {
    console.log('\n🔐 Testing auth requirement (no token)...');
    const response = await makeRequest('tools/list');

    if (response.error && response.error.code === -32001) {
        console.log('   ✅ Server correctly requires authentication');
        return true;
    } else {
        console.log('   ⚠️  Unexpected response:', response);
        return false;
    }
}

async function testListTools() {
    console.log('\n🔧 Testing tools/list...');
    const response = await makeRequest('tools/list', undefined, ACCESS_TOKEN);

    if (response.error) {
        console.log('   ❌ Error:', response.error.message);
        return false;
    }

    const tools = response.result?.tools || [];
    console.log(`   ✅ Found ${tools.length} tools:`);
    tools.forEach((tool: any) => {
        console.log(`      - ${tool.name}: ${tool.description}`);
    });
    return true;
}

async function testSearchEmails() {
    console.log('\n📧 Testing search_emails tool...');
    const response = await makeRequest(
        'tools/call',
        {
            name: 'search_emails',
            arguments: { query: 'is:unread', maxResults: 3 },
        },
        ACCESS_TOKEN
    );

    if (response.error) {
        console.log('   ❌ Error:', response.error.message);
        return false;
    }

    const content = response.result?.content?.[0]?.text || '';
    console.log('   ✅ Search results:');
    console.log('   ' + content.split('\n').slice(0, 10).join('\n   '));
    if (content.split('\n').length > 10) {
        console.log('   ... (truncated)');
    }
    return true;
}

async function testListLabels() {
    console.log('\n🏷️  Testing list_email_labels tool...');
    const response = await makeRequest(
        'tools/call',
        {
            name: 'list_email_labels',
            arguments: {},
        },
        ACCESS_TOKEN
    );

    if (response.error) {
        console.log('   ❌ Error:', response.error.message);
        return false;
    }

    const content = response.result?.content?.[0]?.text || '';
    const lines = content.split('\n');
    console.log('   ✅ Labels found:');
    console.log('   ' + lines.slice(0, 8).join('\n   '));
    if (lines.length > 8) {
        console.log('   ... (truncated)');
    }
    return true;
}

async function main() {
    console.log('═══════════════════════════════════════════');
    console.log('  Gmail MCP HTTP Server Test Suite');
    console.log('═══════════════════════════════════════════');
    console.log(`Server URL: ${BASE_URL}`);
    console.log(`Access Token: ${ACCESS_TOKEN ? '✓ Provided' : '✗ Not provided'}`);

    // Test 1: Health check
    const healthOk = await testHealthCheck();
    if (!healthOk) {
        console.log('\n❌ Server not reachable. Exiting.');
        process.exit(1);
    }

    // Test 2: Auth requirement
    await testAuthRequired();

    // Tests requiring a token
    if (ACCESS_TOKEN) {
        console.log('\n─── Running authenticated tests ───');

        await testListTools();
        await testListLabels();
        await testSearchEmails();

        console.log('\n═══════════════════════════════════════════');
        console.log('  ✅ All authenticated tests completed!');
        console.log('═══════════════════════════════════════════');
    } else {
        console.log('\n─── Skipping authenticated tests ───');
        console.log('To run full tests, provide a Google access token:');
        console.log('  npx tsx test-http-server.ts <your_access_token>');
        console.log('\nYou can get a token from your app\'s OAuth flow');
        console.log('or use the Google OAuth Playground:');
        console.log('  https://developers.google.com/oauthplayground/');
        console.log('\n═══════════════════════════════════════════');
        console.log('  ✅ Basic tests completed!');
        console.log('═══════════════════════════════════════════');
    }
}

main().catch(console.error);
