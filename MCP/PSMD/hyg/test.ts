// test.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { InitializeRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import fs from 'fs';

// 创建日志函数
function logToFile(message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync('mcp-server.log', `${timestamp}: ${message}\n`);
}

/* ---------- 1. 工具列表 ---------- */
const ToolsListSchema = z.object({
    method: z.literal('tools/list'),
    params: z.object({}).optional(),
});
type ToolsList = z.infer<typeof ToolsListSchema>;

/* ---------- 2. 工具调用 ---------- */
const ToolsCallSchema = z.object({
    method: z.literal('tools/call'),
    params: z.object({
        name: z.string(),
        arguments: z.record(z.any()).optional(),
    }),
});
type ToolsCall = z.infer<typeof ToolsCallSchema>;

/* ---------- 3. 创建 Server ---------- */
const server = new Server(
    { name: 'psmd-server', version: '1.0.0' },
    { capabilities: { tools: { listChanged: true } } }
);

/* ---------- 4. 握手 ---------- */
server.setRequestHandler(InitializeRequestSchema, async ({ params }) => {
    console.error("params:", params);
    logToFile(`params: ${JSON.stringify(params)}`);
    logToFile(`客户端能力: ${JSON.stringify(params.capabilities)}`);
    return ({
        protocolVersion: params.protocolVersion,
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: 'psmd-server', version: '1.0.0' },
    })
});

/* ---------- 5. 工具列表 ---------- */
server.setRequestHandler(ToolsListSchema, async () => ({
    tools: [
        {
            name: 'demo',
            description: 'A demo tool to make server discoverable',
            inputSchema: {
                type: 'object',
                properties: { name: { type: 'string' } },
                additionalProperties: false,
            },
        },
    ],
}));

/* ---------- 6. 工具调用 ---------- */
server.setRequestHandler(ToolsCallSchema, async (req) => ({
    content: [
        { type: 'text', text: `Hello ${req.params.arguments?.name ?? 'world'}!` },
    ],
}));

/* ---------- 7. 启动 + 可见日志 ---------- */
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[PSMD] Server connected, waiting for handshake...');
}
main().catch(console.error);