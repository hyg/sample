// @ts-ignore
import { Server } from '@modelcontextprotocol/sdk';

interface EchoInput {
  text: string;
}

interface SummarizeInput {
  text: string;
}

interface SampleLLMInput {
  prompt: string;
  n?: number;
}

const server = new Server({
  name: 'My MCP Server',
  version: '1.0.0',
});

// 注册Echo工具
server.resources.registerTool({
  name: 'echo',
  description: '回显输入的文本',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string' }
    },
    required: ['text']
  }
}, async (input: EchoInput) => {
  return { content: [{ type: 'text', text: input.text }] };
});

// 注册Prompt资源
server.resources.registerPrompt({
  name: 'summarize',
  description: '总结文本内容',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string' }
    },
    required: ['text']
  }
}, async (input: SummarizeInput) => {
  return `请总结以下文本:\n\n${input.text}`;
});

// 注册使用Sampling方式调用LLM的工具
server.resources.registerTool({
  name: 'sample-llm',
  description: '使用Sampling方式调用LLM生成文本',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string' },
      n: { type: 'integer', minimum: 1, maximum: 10, default: 1 }
    },
    required: ['prompt']
  }
}, async (input: SampleLLMInput) => {
  // 这里应该实现实际的LLM调用逻辑
  // 为了演示，我们返回模拟的采样结果
  const samples = [];
  const n = input.n || 1;
  
  for (let i = 0; i < n; i++) {
    samples.push(`这是第${i+1}个采样结果，基于提示: "${input.prompt}"`);
  }
  
  return { 
    content: [{
      type: 'text', 
      text: `生成的文本选项:\n${samples.map((sample, i) => `${i+1}. ${sample}`).join('\n')}`
    }] 
  };
});

// 启动服务器
server.listen(() => {
  console.log('MCP Server started');
});