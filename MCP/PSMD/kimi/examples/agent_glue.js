// examples/agent_glue.js
const { spawn } = require('child_process');
const { JSONRPCClient, JSONRPCServer } = require('json-rpc-2.0');

// This is a simplified example of how an agent might interact with the MCP.
// In a real scenario, the agent would be a separate process managing the MCP child process.

// For this example, we'll simulate the interaction within the same Node.js process.
// We'll create a mock LLM call function.
async function callLLM(prompt) {
    // In a real implementation, this would call an actual LLM API.
    // For simulation, we'll return a fixed response based on the prompt.
    console.log(`[LLM Call] Prompt: ${prompt}`);
    
    // Simple simulation logic for test cases
    if (prompt.includes("术后第几天")) {
        return JSON.stringify({ postop_day: 7 });
    } else if (prompt.includes("排气排便")) {
        return JSON.stringify({ flatus: true });
    } else if (prompt.includes("口服进食")) {
        return JSON.stringify({ oral_intake: "rice_water" });
    }
    
    // Default response
    return JSON.stringify({});
}

// Simulate a conversation with the MCP
async function simulateConversation() {
    // In a real agent, this would be the actual MCP process
    // const mcpProcess = spawn('node', ['index.js'], { stdio: ['pipe', 'pipe', 'inherit'] });
    
    // For this example, we'll directly use the server logic
    // In a real scenario, the client would communicate with the MCP process via stdio
    
    // Mock session data
    const sessionId = 'test-session-id';
    const history = [];
    
    // Round 1
    console.log("--- Round 1 ---");
    const userInput1 = "我刚做完手术";
    console.log(`User Input: ${userInput1}`);
    
    const prompt1 = `
对话历史：${JSON.stringify(history)}
用户最新输入：${userInput1}
请提取 JSON 格式的事实对象，键名必须与 MCP 文档一致，无值则省略。
`;
    const extracted_facts1 = JSON.parse(await callLLM(prompt1));
    console.log(`Extracted Facts: ${JSON.stringify(extracted_facts1)}`);
    
    // In a real agent, this would be sent to the MCP process
    // For this example, we'll directly call the method
    // const res1 = await jsonrpc.call(mcpProcess, 'industry_qa', {
    //     session_id: sessionId,
    //     turn: history.length + 1,
    //     user_nl: userInput1,
    //     extracted_facts: extracted_facts1
    // });
    
    // Simulate MCP response for round 1 (T1)
    const res1 = {
        protocol_version: "1.0",
        session_id: sessionId,
        turn: 1,
        answer_nl: "",
        state: "waiting_for_postop_day",
        next_needed: ["postop_day"],
        prompt_to_user: "请问是术后第几天了？",
        done: false
    };
    
    console.log(`MCP Response: ${JSON.stringify(res1, null, 2)}`);
    console.log(`Prompt to User: ${res1.prompt_to_user}\n`);
    
    // Round 2
    console.log("--- Round 2 ---");
    const userInput2 = "术后第7天";
    console.log(`User Input: ${userInput2}`);
    
    history.push({ user: userInput1, mcp_prompt: res1.prompt_to_user, mcp_response: res1 });
    
    const prompt2 = `
对话历史：${JSON.stringify(history)}
用户最新输入：${userInput2}
请提取 JSON 格式的事实对象，键名必须与 MCP 文档一致，无值则省略。
`;
    const extracted_facts2 = JSON.parse(await callLLM(prompt2));
    console.log(`Extracted Facts: ${JSON.stringify(extracted_facts2)}`);
    
    // Simulate MCP response for round 2 (T2)
    const res2 = {
        protocol_version: "1.0",
        session_id: sessionId,
        turn: 2,
        answer_nl: "",
        state: "waiting_for_flatus",
        next_needed: ["flatus"],
        prompt_to_user: "请问您是否已经排气排便了？",
        done: false
    };
    
    console.log(`MCP Response: ${JSON.stringify(res2, null, 2)}`);
    console.log(`Prompt to User: ${res2.prompt_to_user}\n`);
    
    // Round 3
    console.log("--- Round 3 ---");
    const userInput3 = "已经排气排便了";
    console.log(`User Input: ${userInput3}`);
    
    history.push({ user: userInput2, mcp_prompt: res2.prompt_to_user, mcp_response: res2 });
    
    const prompt3 = `
对话历史：${JSON.stringify(history)}
用户最新输入：${userInput3}
请提取 JSON 格式的事实对象，键名必须与 MCP 文档一致，无值则省略。
`;
    const extracted_facts3 = JSON.parse(await callLLM(prompt3));
    console.log(`Extracted Facts: ${JSON.stringify(extracted_facts3)}`);
    
    // Simulate MCP response for round 3 (T3)
    const res3 = {
        protocol_version: "1.0",
        session_id: sessionId,
        turn: 3,
        answer_nl: "术后第7天，已排气排便，可以开始尝试米汤。请少量多餐，观察身体反应。",
        state: "completed",
        next_needed: [],
        prompt_to_user: "",
        done: true
    };
    
    console.log(`MCP Response: ${JSON.stringify(res3, null, 2)}`);
    console.log(`Final Answer: ${res3.answer_nl}\n`);
    
    console.log("Conversation completed.");
}

// Run the simulation
simulateConversation().catch(console.error);