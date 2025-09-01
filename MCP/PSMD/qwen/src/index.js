const { createMessageConnection, StreamMessageReader, StreamMessageWriter } = require('vscode-jsonrpc');
const fs = require('fs');
const path = require('path');

// Create a log file name with timestamp
const logFileName = `mcp_log_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
const logFilePath = path.join(__dirname, '..', logFileName);

// Function to log messages to file
function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFilePath, logMessage);
}

// Create a message connection using stdio
const connection = createMessageConnection(
    new StreamMessageReader(process.stdin),
    new StreamMessageWriter(process.stdout)
);

// Handle the 'initialize' request as per MCP specification
connection.onRequest('initialize', (params) => {
    console.error('Received initialize request.');
    logToFile(`REQUEST: initialize ${JSON.stringify(params)}`);
    // A real implementation would inspect and respond with server capabilities
    // For this prototype, we'll just return a basic response
    const response = {
        protocolVersion: '2024-01-01',
        capabilities: {
            // Indicate that we support our custom 'analyzeBylaws' method
            // The method name is arbitrary for this example.
            tools: {
                listChanged: true // Indicate we can list tools
            }
        }
    };
    logToFile(`RESPONSE: ${JSON.stringify(response)}`);
    return response;
});

// Handle the 'ping' request as per MCP specification
connection.onRequest('ping', () => {
    console.error('Received ping request.');
    logToFile(`REQUEST: ping {}`);
    const response = {};
    logToFile(`RESPONSE: ${JSON.stringify(response)}`);
    return response;
});

// Handle the 'shutdown' request as per MCP specification
connection.onRequest('shutdown', () => {
    console.error('Received shutdown request.');
    logToFile(`REQUEST: shutdown {}`);
    // In a real implementation, this might trigger cleanup.
    // For now, we just acknowledge.
    const response = {};
    logToFile(`RESPONSE: ${JSON.stringify(response)}`);
    return response;
});

// Handle a custom request for bylaw analysis
connection.onRequest('analyzeBylaws', (params) => {
    console.error('Received analyzeBylaws request.');
    logToFile(`REQUEST: analyzeBylaws ${JSON.stringify(params)}`);
    
    try {
        // Validate input params (which are inside the 'params' property of the request)
        if (!params || typeof params !== 'object') {
            throw new Error('Invalid parameters: Expected an object.');
        }

        // The input is expected to be an object with decision/nonDecision/independent arrays
        if (!(Array.isArray(params.decision) || Array.isArray(params.nonDecision) || Array.isArray(params.independent))) {
             throw new Error('Invalid input data format. Expected an object with decision/nonDecision/independent arrays.');
        }
        
        // Import the analyzer function (assuming it's in the same directory)
        // We need to use a synchronous require here because the analyzer logic is in another file
        const analyzeBylaws = require('./analyzer');
        
        // Flatten the input for our analyzer
        const allClauses = [...(params.decision || []), ...(params.nonDecision || []), ...(params.independent || [])];
        const analysisResults = analyzeBylaws(allClauses);
        
        logToFile(`RESPONSE: ${JSON.stringify(analysisResults)}`);
        return analysisResults;
    } catch (err) {
        console.error('Error processing analyzeBylaws request:', err.message);
        logToFile(`ERROR: ${err.message}`);
        throw new Error(`Failed to process bylaw analysis: ${err.message}`);
    }
});

connection.onError((err) => {
    console.error('JSON-RPC Connection Error:', err);
    logToFile(`CONNECTION ERROR: ${err}`);
});

connection.onClose(() => {
    console.error('JSON-RPC Connection Closed.');
    logToFile('JSON-RPC Connection Closed.');
    process.exit(0);
});

// Handle process signals for graceful shutdown
process.on('SIGTERM', () => {
    console.error('Received SIGTERM. Shutting down gracefully.');
    logToFile('Received SIGTERM. Shutting down gracefully.');
    connection.end();
});

process.on('SIGINT', () => {
    console.error('Received SIGINT. Shutting down gracefully.');
    logToFile('Received SIGINT. Shutting down gracefully.');
    connection.end();
});

// Start listening
console.error('PSMD.MCP (MCP-compliant version with vscode-jsonrpc) started. Ready to receive JSON-RPC requests.');
logToFile('PSMD.MCP (MCP-compliant version with vscode-jsonrpc) started. Ready to receive JSON-RPC requests.');
connection.listen();