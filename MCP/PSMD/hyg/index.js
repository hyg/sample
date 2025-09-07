import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import nlp from 'wink-nlp-utils';
import crypto from 'crypto';
import fs from 'fs';

// 创建日志函数
function logToFile(message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync('mcp-server.log', `${timestamp}: ${message}\n`);
}

// Create an MCP server
const server = new McpServer({
  name: "PSMD",
  version: "0.0.1"
});

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
      var ret = nlp.string.tokenize(context, true);
      return { content: [{ type: "text", text: JSON.stringify(ret) }] };
    } catch (error) {
      console.error("NRE error: " + error.message);
      throw error;
    }
  }
);

server.registerTool(
  "hash",
  {
    title: "取sha256哈希码",
    description: "对内容取哈希码，种类是sha256，返回哈希码。",
    inputSchema: { context: z.string() }
  },
  async ({ context }) => {
    try {
      const hash = crypto.createHash('sha256').update(context).digest('hex');
      return { hash: hash};
    } catch (error) {
      console.error("hash error: " + error.message);
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

server.registerPrompt(
  "top-clause",
  {
    title: "识别顶端条款",
    description: "追溯修订链的顶端：自修订条款和不可修订条款。",
    argsSchema: { file: z.string() }
  },
  ({ file }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `
1. 你是一名资深董事，同时也拥有律师资质。以思维严谨、文风简练著称。
2. 基础定义：规章条款的上下级关系，根据制定、修订权定义。
  2.1. 一个条款可以修订自己，称为“自修订条款”；
    2.1.2. “规章条款”不按文件编排，而是以修订关系的最小单元为准。比如某公司章程有：“...股东会三分之二表决权通过可以修订章程。...”这句作为一个规章条款，这个条款本身就在章程里面，所以也能修订自己。（比如修改为：股东会四分之三表决权通过可以修订章程。）这个条款就比章程的其它条款都高一级，无论怎么组合编集，都不影响这种层级关系。它的前句、后句层级较低，即使文本中何为一条，在分析时也应拆分为不同条款。
  2.2. 没有修订安排的条款，称为“不可修订条款”；
    2.2.1. 上位法规在一份规章中视为不可修订条款；
3. 自修订条款、不可修订条例，共同构成规章修订链的顶端条款。
条款范例：“十四、 社员会议是本合作社的最高权力机构，由全体社员组成。社员会议行使以下权利：
        （一） 选举和罢免召集人、管理员、监事；
        （二） 修改本章程及管理制度；
        （三） 决定临时的分配；
        （四） 批准所有对外合同；
        （五） 对本合作社的独立、解散、清算作出决议。”
从中提取部分内容作为自修订条款：“十四、（二）社员会议行使以下权利：修改本章程及管理制度；”
剩余内容作为第二级的条款：“十四、 社员会议是本合作社的最高权力机构，由全体社员组成。社员会议行使以下权利：
        （一） 选举和罢免召集人、管理员、监事；
        （三） 决定临时的分配；
        （四） 批准所有对外合同；
        （五） 对本合作社的独立、解散、清算作出决议。”
精读以下文件，按以上定义分析条款的修订关系，追溯出顶端条款:\n\n${file}
每个顶级条款以yaml格式写入以下路径：.psmd/terms/
文件名：term.{id}.yaml
其中{id}是文件中id字段内容。
文件格式：
id: z.string()
name: z.string()
text: z.string()
upgradeby: z.string()
其中id是text的sha256哈希码的前八位；name是条款简称；text是条款全文；upgradeby是上级条款的id，自修订条款则是自己id，不可修订条款没有这个字段。
`
      }
    }]
  })
);

// Tool that uses LLM sampling to summarize any text
server.registerTool(
  "summarize",
  {
    title: "总结",
    description: "Summarize any text using an LLM",
    inputSchema: {
      text: z.string().describe("Text to summarize"),
    },
  },
  async ({ text }) => {
    // Call the LLM through MCP sampling
    const response = await server.server.createMessage({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please summarize the following text concisely:\n\n${text}`,
          },
        },
      ],
      maxTokens: 500,
    });

    return {
      content: [
        {
          type: "text",
          text: response.content.type === "text" ? response.content.text : "Unable to generate summary",
        },
      ],
    };
  }
);

server.registerTool(
  "extract",
  {
    title: "提取条款",
    description: "从规章中提取条款内容，格式化为标准数据结构。",
    inputSchema: { file: z.string() }
  },
  async ({ file }) => {
    // Call the LLM through MCP sampling
    const response = await server.server.createMessage({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `
1. 你是一名经验丰富的律师，工作风格严谨、精确。
2. 把规章整理为一个yaml文件，保存为 .psmd/terms.{title}.yaml 。其中{title}为这份文档的名称。
3. yaml的格式为：
title: z.string()
id: z.string()
term:
  - title: z.string()
    prefix: z.string()
    content: z.string()
其中title是规章名称；id是全文的sha256哈希码的前八位；term.title是条款的简短名称；term.perfix是原文中的编号，同一编号下拆分的可以在编号后续一位递增编号；content是条款的内容（不含编号）。
条款范例：“十四、 社员会议是本合作社的最高权力机构，由全体社员组成。社员会议行使以下权利：
        （一） 选举和罢免召集人、管理员、监事；
        （二） 修改本章程及管理制度；
        （三） 决定临时的分配；
        （四） 批准所有对外合同；
        （五） 对本合作社的独立、解散、清算作出决议。”
整理为term字段下的记录：
term:
  - title: 社员会议组成
    prefix: 十四、
    content: 社员会议是本合作社的最高权力机构，由全体社员组成。
  - title: 社员会议权利一
    prefix: 十四、（一）
    content: 社员会议行使以下权利：选举和罢免召集人、管理员、监事；
  - title: 社员会议权利二
    prefix: 十四、（二）
    content: 社员会议行使以下权利：修改本章程及管理制度；
  - title: 社员会议权利三
    prefix: 十四、（三）
    content: 社员会议行使以下权利：决定临时的分配；
  - title: 社员会议权利四
    prefix: 十四、（四）
    content: 社员会议行使以下权利：批准所有对外合同；
  - title: 社员会议权利五
    prefix: 十四、（五）
    content: 社员会议行使以下权利：对本合作社的独立、解散、清算作出决议。
精读以下文件，按以上工作要求提取条款:\n${file}`
          },
        },
      ]
    });

    return {
      content: [
        {
          type: "text",
          text: response.content.type === "text" ? response.content.text : "Unable to generate format",
        },
      ],
    };
  }
);

// Handle server errors
server.onerror = (error) => {
  console.error("Server error:", error);
};

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[PSMD] Server connected, waiting for handshake...');
}
//main().catch(console.error);
// 启动服务器
main().catch((error) => {
  logToFile(`启动错误: ${error.message}`);
  logToFile(`错误堆栈: ${error.stack}`);
  process.exit(1);
});

/* 
// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
transport.onerror = (error) => {
  console.error("Transport error:", error);
};

await server.connect(transport);
//console.log('MCP 服务器在 Stdio 上运行...'); */