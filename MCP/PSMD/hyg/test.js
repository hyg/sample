import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs';

// 创建日志函数
function logToFile(message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync('mcp-server.log', `${timestamp}: ${message}\n`);
}

// 创建 MCP 服务器
const server = new McpServer({
  name: 'PSMD Server',
  version: '1.0.0',
});

// 处理初始化请求
server.onInitialize((params) => {
  try {
    logToFile('初始化开始');
    logToFile(`客户端能力: ${JSON.stringify(params.capabilities)}`);
    
    const capabilities = params.capabilities || {};
    
    // 检查功能支持
    const supportsSampling = Boolean(
      capabilities.sampling ||
      capabilities['com.example.sampling'] ||
      capabilities['mcp-sampling']
    );
    
    const supportsResources = Boolean(capabilities.resources);
    const supportsPrompts = Boolean(capabilities.prompts);
    const supportsTools = Boolean(capabilities.tools);
    
    logToFile(`功能支持 - Sampling: ${supportsSampling}, Resources: ${supportsResources}, Prompts: ${supportsPrompts}, Tools: ${supportsTools}`);
    
    // 构建服务器能力响应
    const serverCapabilities = {};
    
    if (supportsSampling) {
      serverCapabilities.sampling = {};
    }
    
    if (supportsResources) {
      serverCapabilities.resources = {};
    }
    
    if (supportsPrompts) {
      serverCapabilities.prompts = {};
    }
    
    if (supportsTools) {
      serverCapabilities.tools = {};
    }
    
    logToFile(`返回的服务器能力: ${JSON.stringify(serverCapabilities)}`);
    
    return {
      capabilities: serverCapabilities,
      serverInfo: {
        name: 'PSMD Server',
        version: '1.0.0'
      }
    };
  } catch (error) {
    logToFile(`初始化错误: ${error.message}`);
    logToFile(`错误堆栈: ${error.stack}`);
    throw error; // 重新抛出错误以确保客户端收到错误响应
  }
});

// 添加一个简单的工具
server.tool(
  'test_tool',
  { 
    param: z.string().describe('测试参数') 
  },
  async ({ param }) => {
    logToFile(`工具调用: test_tool, 参数: ${param}`);
    return {
      content: [
        {
          type: 'text',
          text: `收到的参数: ${param}`
        }
      ]
    };
  }
);

// 启动服务器
async function main() {
  try {
    logToFile('服务器启动');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logToFile('服务器连接成功');
  } catch (error) {
    logToFile(`服务器错误: ${error.message}`);
    logToFile(`错误堆栈: ${error.stack}`);
    process.exit(1);
  }
}

// 全局错误处理
process.on('uncaughtException', (error) => {
  logToFile(`未捕获异常: ${error.message}`);
  logToFile(`错误堆栈: ${error.stack}`);
});

process.on('unhandledRejection', (reason, promise) => {
  logToFile(`未处理的 Promise 拒绝: ${reason}`);
});

// 启动服务器
main().catch((error) => {
  logToFile(`启动错误: ${error.message}`);
  logToFile(`错误堆栈: ${error.stack}`);
  process.exit(1);
});