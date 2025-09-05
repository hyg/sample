import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import nlp from 'wink-nlp-utils';
//console.log("nlp:",nlp);

// Create an MCP server
const server = new McpServer({
  name: "PSMD",
  version: "1.0.0"
});

// Add an addition tool
// Add an addition tool
server.registerTool(
  "NRE",
  {
    title: "命名实体识别 (NER)工具",
    description: "对内容进行命名实体识别 (NER)，返回实体清单。",
    inputSchema: { context: z.string() }
  },
  async ({ context }) => {
      try {
          console.error("NRE input: " + context);
          var ret = nlp.string.tokenize(context, true);
          console.error("NRE output: " + JSON.stringify(ret));
          return { content: [{ type: "text", text: JSON.stringify(ret) }] };
      } catch (error) {
          console.error("NRE error: " + error.message);
          throw error;
      }
  }
);

server.registerTool(
  "mask",
  {
    title: "脱敏工具",
    description: "自动识别脱敏",
    inputSchema: { a: z.number(), b: z.number() }
  },
  async ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }]
  })
);

// Add a dynamic greeting resource
server.registerResource(
  "greeting",
  { 
    title: "Greeting Resource",      // Display name for UI
    description: "Dynamic greeting generator"
  },
  new ResourceTemplate("greeting://{name}", { list: undefined }),
  async (uri, { name }) => ({
    contents: [{
      uri: uri.href,
      text: `Hello, ${name}!`
    }]
  })
);

// Handle server errors
server.onerror = (error) => {
  console.error("Server error:", error);
};

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
transport.onerror = (error) => {
  console.error("Transport error:", error);
};

await server.connect(transport);
//console.log('MCP 服务器在 Stdio 上运行...');