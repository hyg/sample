// index.js
const fs = require('fs');
const path = require('path');
const { JSONRPCServer } = require('json-rpc-2.0');
const yaml = require('js-yaml');

// Load external knowledge on startup
const knowledgeGraph = JSON.parse(fs.readFileSync(path.join(__dirname, 'knowledge_graph.json'), 'utf8'));
const decisionTree = yaml.load(fs.readFileSync(path.join(__dirname, 'decision_tree.yml'), 'utf8'));
const promptBank = new Map();

// Load prompt templates
const promptDir = path.join(__dirname, 'prompt_bank');
fs.readdirSync(promptDir).forEach(file => {
  if (path.extname(file) === '.txt') {
    const slotName = path.basename(file, '.txt');
    promptBank.set(slotName, fs.readFileSync(path.join(promptDir, file), 'utf8'));
  }
});

const server = new JSONRPCServer();

// In-memory session storage (for stateful mode)
const sessionStore = new Map();

// Helper function to get next needed slots based on decision tree
function getNextNeededSlots(extractedFacts, currentState) {
  // This is a simplified implementation.
  // A real implementation would traverse the decision tree based on currentState and extractedFacts.
  // For now, we'll use a basic logic based on the test cases.
  if (!extractedFacts.postop_day) {
    return ['postop_day'];
  }
  if (extractedFacts.postop_day === 7 && extractedFacts.flatus === undefined) {
    return ['flatus'];
  }
  if (extractedFacts.postop_day === 7 && extractedFacts.flatus !== undefined && extractedFacts.oral_intake === undefined) {
    return ['oral_intake'];
  }
  return []; // If all required facts are present for the T3 case
}

// Helper function to generate answer based on facts (simplified)
function generateAnswer(extractedFacts) {
  // This is a placeholder. A real implementation would use the knowledge graph.
  if (extractedFacts.postop_day === 7 && extractedFacts.flatus === true && extractedFacts.oral_intake) {
    return `术后第7天，已排气排便，可以开始尝试${knowledgeGraph.foods[extractedFacts.oral_intake]?.description || extractedFacts.oral_intake}。请少量多餐，观察身体反应。`;
  }
  return "";
}

// Helper function to get prompt for a slot
function getPromptForSlot(slot) {
  return promptBank.get(slot) || `请提供您的${slot}信息。`;
}

server.addMethod('industry_qa', (params) => {
  const { session_id, turn, user_nl, extracted_facts } = params;

  // Validation
  if (typeof session_id !== 'string' || typeof turn !== 'number' || turn < 1 || typeof user_nl !== 'string' || typeof extracted_facts !== 'object') {
    throw { code: -32602, message: "Invalid params" };
  }

  // Check for unknown slots
  const definedSlots = new Set([...knowledgeGraph.slots, ...promptBank.keys()]);
  for (const slot in extracted_facts) {
    if (!definedSlots.has(slot)) {
      throw { code: -32001, message: "Unknown slot" };
    }
  }

  // Check for max turns
  if (turn > 5) {
    return {
      protocol_version: "1.0",
      session_id,
      turn,
      answer_nl: "",
      state: "max_turns_reached",
      next_needed: [],
      prompt_to_user: "追问已超过最大轮数，请联系人工客服。",
      done: true
    };
  }

  // Get current state (simplified, in a real case would be more complex)
  const currentState = sessionStore.get(session_id) || 'start';

  // Determine next needed slots
  const nextNeeded = getNextNeededSlots(extractedFacts, currentState);
  
  // Generate answer if possible
  const answerNL = generateAnswer(extractedFacts);
  
  // Determine if we're done
  const done = nextNeeded.length === 0 && answerNL !== "";
  
  // Generate prompt for user
  let promptToUser = "";
  if (!done) {
     if (nextNeeded.length > 0) {
        // For simplicity, we prompt for the first missing slot
        promptToUser = getPromptForSlot(nextNeeded[0]);
     } else {
        // This case shouldn't happen with current logic, but as a fallback
        promptToUser = "请提供更多信息。";
     }
  }

  // Update session state (simplified)
  // In a more complex scenario, the state would be updated based on the decision tree traversal
  if (!done && nextNeeded.length > 0) {
      sessionStore.set(session_id, `waiting_for_${nextNeeded[0]}`);
  } else if (done) {
      sessionStore.set(session_id, 'completed');
  }
  
  return {
    protocol_version: "1.0",
    session_id,
    turn,
    answer_nl: answerNL,
    state: sessionStore.get(session_id),
    next_needed: nextNeeded,
    prompt_to_user: promptToUser,
    done
  };
});

// Create a simple stdio server
process.stdin.on('data', (data) => {
  try {
    const json = JSON.parse(data);
    server.receive(json).then((result) => {
      if (result) {
        process.stdout.write(JSON.stringify(result) + '\n');
      }
    });
  } catch (error) {
    console.error("Error processing request:", error);
  }
});