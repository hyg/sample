## PSMD.MCP

This project implements a Model Context Protocol (MCP) server designed to analyze company bylaws and categorize their clauses.

### Functionality

1.  **Clause Categorization**: It receives JSON data representing bylaw clauses and classifies them into three categories:
    *   **Decision Clauses**: Clauses that can amend other clauses or appoint/dismiss personnel.
    *   **Non-Decision Clauses**: Clauses that cannot amend other clauses or appoint/dismiss personnel.
    *   **Independent Clauses**: Clauses whose self-amendment procedure is unclear or not defined.
2.  **Missing Clause Identification**: It compares the received clauses against an internal database of common clauses and identifies any missing ones in each category.
3.  **Stdio Communication**: The server communicates with the calling agent via standard input (stdin) and standard output (stdout), making it suitable for integration with coding agents like Claude Code or Qwen Code.

### How to Use

1.  **Installation**:
    *   Ensure you have Node.js installed.
    *   Run `npm install` in the project root directory to install dependencies.

2.  **Running the Server**:
    *   Use `npm start` or `node src/index.js` to start the server.
    *   The server will print `PSMD.MCP started. Ready to receive JSON data.` and wait for input.

3.  **Sending Data**:
    *   The server expects JSON input via stdin. The JSON should represent the bylaw clauses.
    *   The expected input format is an object containing three arrays: `decision`, `nonDecision`, and `independent`. Each array should contain objects representing the clauses in that category.
    *   Example input structure:
        ```json
        {
          "decision": [
            {
              "id": "user_dc_1",
              "title": "股东会决议条款",
              "description": "...",
              "canAmendOthers": true,
              "canAppointDismiss": true,
              "selfAmendmentProcedure": "..."
            }
          ],
          "nonDecision": [...],
          "independent": [...]
        }
        ```
    *   You can pipe a file containing this JSON structure to the server: `node -e "console.log(JSON.stringify(require('./your_input_file.json')))" | node src/index.js`

4.  **Receiving Results**:
    *   The server will output the analysis results as a JSON object to stdout.
    *   The output will contain the original categorized clauses and a `missing` section listing any clauses from the internal database that were not present in the input.
    *   If the input format is invalid, an error message will be sent to stdout.

### File Structure

*   `package.json`: Project metadata and dependencies.
*   `src/index.js`: Main entry point. Handles stdio communication and calls the analyzer.
*   `src/analyzer.js`: Contains the logic for categorizing clauses and identifying missing ones.
*   `src/db.js`: Internal database of common bylaw clauses used for comparison.
*   `test_input*.json`: Example input files for testing.

### Testing

*   Example test files are provided (`test_input.json`, `test_input_missing.json`, `test_input_missing_dc.json`, `test_input_empty.json`).
*   Run a test using: `node -e "console.log(JSON.stringify(require('./test_input.json')))" | node src/index.js`