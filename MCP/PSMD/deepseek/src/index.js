// src/index.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory session store (for demonstration; consider using a database in production)
const sessions = {};

// Load knowledge base
let knowledgeBase;
fs.readFile('./knowledge-base.json', 'utf8')
  .then(data => {
    knowledgeBase = JSON.parse(data);
    console.log('Knowledge base loaded.');
  })
  .catch(err => {
    console.error('Failed to load knowledge base:', err);
    process.exit(1); // Exit if knowledge base cannot be loaded
  });

app.use(express.json());

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
app.post('/initiate_session', async (req, res) => {
  try {
    const { user_query } = req.body;

    if (!user_query) {
      return res.status(400).json({ error: 'Missing user_query in request body.' });
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
    const sessionState = formatSessionState(sessionId, initialNodeData);
    res.json(sessionState);

  } catch (error) {
    console.error('Error in /initiate_session:', error.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// 4.2. navigate_session - Navigates the session based on user choice
app.post('/navigate_session', (req, res) => {
  try {
    const { session_id, selected_option_id, user_input } = req.body;

    if (!session_id || !selected_option_id) {
      return res.status(400).json({ error: 'Missing session_id or selected_option_id in request body.' });
    }

    // 1. Find session state
    const session = sessions[session_id];
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    // 2. Get current node data
    const currentNodeData = getNodeData(session.current_node_id);

    // 3. Find the selected option and next node
    const selectedOption = currentNodeData.options.find(opt => opt.id === selected_option_id);
    if (!selectedOption) {
      return res.status(400).json({ error: 'Selected option ID not found for the current node.' });
    }

    const nextNodeId = selectedOption.next_node;

    // 4. Check if session is complete (reached a leaf node or explicit end)
    if (!nextNodeId) {
      // Reached a terminal node. Send final response.
      const finalNodeData = currentNodeData; // The current node is the final one
      const sessionState = formatSessionState(session_id, finalNodeData, true);
      // Clear session as it's complete
      delete sessions[session_id];
      return res.json(sessionState);
    }

    // 5. Navigate to the next node
    const nextNodeData = getNodeData(nextNodeId);

    // 6. Update session state
    session.current_node_id = nextNodeId;

    // 7. Format and send response
    const sessionState = formatSessionState(session_id, nextNodeData);
    res.json(sessionState);

  } catch (error) {
    console.error('Error in /navigate_session:', error.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.listen(PORT, () => {
  console.log(`MCP Server listening on port ${PORT}`);
});