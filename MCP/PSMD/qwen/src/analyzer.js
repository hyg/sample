const commonClauses = require('./db');

/**
 * Analyzes bylaw clauses and categorizes them.
 * @param {Array} inputClauses - Array of clause objects from the LLM.
 * @returns {Object} - Analysis results with categorized clauses and missing items.
 */
function analyzeBylaws(inputClauses) {
  // Ensure inputClauses is an array
  if (!Array.isArray(inputClauses)) {
    console.error('analyzeBylaws: inputClauses is not an array. Received:', typeof inputClauses);
    inputClauses = []; // Default to empty array
  }

  const results = {
    decision: [],
    nonDecision: [],
    independent: [],
    missing: {
      decision: [],
      nonDecision: [],
      independent: []
    }
  };

  // Categorize input clauses
  inputClauses.forEach(clause => {
    // Ensure clause is an object
    if (typeof clause !== 'object' || clause === null) {
      console.warn('Skipping invalid clause:', clause);
      return;
    }

    if (clause.canAmendOthers || clause.canAppointDismiss) {
      results.decision.push(clause);
    } else if (!clause.selfAmendmentProcedure || 
               clause.selfAmendmentProcedure === 'Unclear' || 
               clause.selfAmendmentProcedure === 'unclear') {
      results.independent.push(clause);
    } else {
      results.nonDecision.push(clause);
    }
  });

  // Ensure commonClauses arrays exist before iterating
  const commonDecision = Array.isArray(commonClauses.decision) ? commonClauses.decision : [];
  const commonNonDecision = Array.isArray(commonClauses.nonDecision) ? commonClauses.nonDecision : [];
  const commonIndependent = Array.isArray(commonClauses.independent) ? commonClauses.independent : [];

  // Identify missing common clauses (simplified logic for prototype)
  // In a full implementation, this would be more sophisticated.
  commonDecision.forEach(commonClause => {
    // Ensure commonClause is an object and has an id
    if (typeof commonClause !== 'object' || commonClause === null || !commonClause.id) {
      console.warn('Skipping invalid common decision clause:', commonClause);
      return;
    }
    const found = results.decision.some(c => c.id === commonClause.id);
    if (!found) {
      results.missing.decision.push(commonClause);
    }
  });

  commonNonDecision.forEach(commonClause => {
    // Ensure commonClause is an object and has an id
    if (typeof commonClause !== 'object' || commonClause === null || !commonClause.id) {
      console.warn('Skipping invalid common non-decision clause:', commonClause);
      return;
    }
    const found = results.nonDecision.some(c => c.id === commonClause.id);
    if (!found) {
      results.missing.nonDecision.push(commonClause);
    }
  });

  commonIndependent.forEach(commonClause => {
    // Ensure commonClause is an object and has an id
    if (typeof commonClause !== 'object' || commonClause === null || !commonClause.id) {
      console.warn('Skipping invalid common independent clause:', commonClause);
      return;
    }
    const found = results.independent.some(c => c.id === commonClause.id);
    if (!found) {
      results.missing.independent.push(commonClause);
    }
  });

  return results;
}

module.exports = analyzeBylaws;