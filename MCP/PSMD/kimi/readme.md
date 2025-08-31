# Industry Knowledge MCP

This MCP provides multi-turn Q&A capabilities based on industry knowledge for third-party agents like Claude Code, Qwen Code, and Gemini CLI.

## Installation

```bash
npm install
```

## Usage

To start the MCP server:

```bash
npm start
```

This will start the MCP server, listening for JSON-RPC requests over stdio.

## Integration with Agents

Agents can integrate with this MCP by spawning the Node.js process and communicating via stdio using JSON-RPC 2.0 protocol.

See `examples/agent_glue.js` for a sample integration.

## Data Files

- `knowledge_graph.json`: Contains the domain knowledge graph.
- `decision_tree.yml`: Defines the decision tree for question flow.
- `prompt_bank/`: Directory containing prompt templates for questions.

## Protocol

The MCP communicates with agents using JSON-RPC 2.0 over stdio.

### Request (Agent → MCP)

```json
{
  "jsonrpc": "2.0",
  "method": "industry_qa",
  "params": {
    "session_id": "<uuid>",
    "turn": <int>,
    "user_nl": "<string>",
    "extracted_facts": {
      "<slot1>": <value>,
      "<slot2>": <value>
    }
  },
  "id": <int>
}
```

### Response (MCP → Agent)

```json
{
  "jsonrpc": "2.0",
  "result": {
    "protocol_version": "1.0",
    "session_id": "<uuid>",
    "turn": <int>,
    "answer_nl": "<string>",
    "state": "<string>",
    "next_needed": ["<slotA>", "<slotB>"],
    "prompt_to_user": "<string>",
    "done": <bool>
  },
  "id": <int>
}
```

### Error Codes

- `-32602`: Invalid params
- `-32001`: Unknown slot