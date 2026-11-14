import assert from 'node:assert/strict';

const required = [
  'buildPassed', 'typecheckPassed', 'databaseMigrationsPassed', 'apiE2ePassed',
  'browserE2ePassed', 'securityApproved', 'legalApproved', 'providerCertificationsPassed',
  'restoreDrillPassed', 'pilotAccepted', 'supportReady', 'rollbackTested'
];

function evaluate(evidence) {
  const blockers = required.filter((key) => evidence[key] !== true);
  return { decision: blockers.length === 0 ? 'APPROVE' : 'HOLD', blockers, productionReady: blockers.length === 0 };
}

const allPassed = Object.fromEntries(required.map((key) => [key, true]));
assert.deepEqual(evaluate(allPassed), { decision: 'APPROVE', blockers: [], productionReady: true });
const incomplete = { ...allPassed, legalApproved: false, databaseMigrationsPassed: false };
const result = evaluate(incomplete);
assert.equal(result.decision, 'HOLD');
assert.deepEqual(result.blockers.sort(), ['databaseMigrationsPassed', 'legalApproved'].sort());
assert.equal(result.productionReady, false);
console.log('Release gate policy checks passed: 2/2');
