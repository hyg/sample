// src/mcp-stdio.js
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const readline = require('readline');

// In-memory session store (for demonstration; consider using a database in production)
const sessions = {};

// Load knowledge base
let knowledgeBase;

// Utility to get node data from knowledge base
function getNodeData(nodeId) {
  if (!knowledgeBase || !knowledgeBase.nodes) {
    throw new Error('Knowledge base not loaded or invalid structure.');
  }
  const node = knowledgeBase.nodes[nodeId];
  if (!node) {
    throw new Error(`Node with ID '${nodeId}' not found in knowledge base.`);
  }
  return node;
}

// Utility to format response for the Agent
function formatSessionState(sessionId, nodeData, isComplete = false) {
  return {
    session_id: sessionId,
    response: nodeData.response,
    current_step: nodeData.id || 'unknown', // Assuming node object has an 'id' for step name
    options: nodeData.options || [],
    is_complete: isComplete
  };
}

// 4.1. initiate_session - Initializes a new session
async function initiateSession(user_query) {
  try {
    if (!user_query) {
      throw new Error('Missing user_query in request body.');
    }

    // 1. Parse user_query to find the initial node (placeholder logic)
    // For simplicity, we'll start at the 'root' node.
    // A real implementation might use NLP or keyword matching here.
    const initialNodeId = 'root';
    const initialNodeData = getNodeData(initialNodeId);

    // 2. Generate a unique session_id
    const sessionId = uuidv4();

    // 3. Save session state
    sessions[sessionId] = {
      current_node_id: initialNodeId
    };

    // 4. Format and send response
    return formatSessionState(sessionId, initialNodeData);
  } catch (error) {
    console.error('Error in initiate_session:', error.message);
    throw error;
  }
}

// 4.2. navigate_session - Navigates the session based on user choice
async function navigateSession(session_id, selected_option_id, user_input) {
  try {
    if (!session_id || !selected_option_id) {
      throw new Error('Missing session_id or selected_option_id in request body.');
    }

    // 1. Find session state
    const session = sessions[session_id];
    if (!session) {
      throw new Error('Session not found.');
    }

    // 2. Get current node data
    const currentNodeData = getNodeData(session.current_node_id);

    // 3. Find the selected option and next node
    const selectedOption = currentNodeData.options.find(opt => opt.id === selected_option_id);
    if (!selectedOption) {
      throw new Error('Selected option ID not found for the current node.');
    }

    const nextNodeId = selectedOption.next_node;

    // 4. Check if session is complete (reached a leaf node or explicit end)
    if (!nextNodeId) {
      // Reached a terminal node. Send final response.
      const finalNodeData = currentNodeData; // The current node is the final one
      const sessionState = formatSessionState(session_id, finalNodeData, true);
      // Clear session as it's complete
      delete sessions[session_id];
      return sessionState;
    }

    // 5. Navigate to the next node
    const nextNodeData = getNodeData(nextNodeId);

    // 6. Update session state
    session.current_node_id = nextNodeId;

    // 7. Format and send response
    return formatSessionState(session_id, nextNodeData);
  } catch (error) {
    console.error('Error in navigate_session:', error.message);
    throw error;
  }
}

async function main() {
  try {
    const data = await fs.readFile('./knowledge-base.json', 'utf8');
    knowledgeBase = JSON.parse(data);
    console.log('Knowledge base loaded.');
  } catch (err) {
    console.error('Failed to load knowledge base:', err);
    process.exit(1); // Exit if knowledge base cannot be loaded
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log("MCP Server (STDIO mode) started. Type 'quit' to exit.");

  let currentSessionId = null;

  const askQuestion = () => {
    rl.question('User Query or Option ID: ', async (input) => {
      if (input.toLowerCase() === 'quit') {
        rl.close();
        return;
      }

      try {
        let result;
        if (!currentSessionId) {
          // Initiate new session
          result = await initiateSession(input);
          currentSessionId = result.session_id;
        } else {
          // Navigate existing session
          result = await navigateSession(currentSessionId, input, "");
        }

        console.log("MCP Response:");
        console.log(JSON.stringify(result, null, 2));

        if (result.is_complete) {
          currentSessionId = null;
          console.log("\n--- Session Completed ---\n");
        }

      } catch (error) {
        console.error("MCP Error:", error.message);
      }

      askQuestion(); // Ask for next input
    });
  };

  askQuestion();
}

main();