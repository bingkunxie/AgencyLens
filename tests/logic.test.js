const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CONDITIONS,
  CASES,
  getConditionOrder,
  makeAiAssessment,
  evaluateTrial,
  aggregateMetrics,
  toCsv,
} = require('../logic');

test('condition order is deterministic and cycles through all conditions', () => {
  const first = getConditionOrder('CHI-2027', 7);
  const second = getConditionOrder('CHI-2027', 7);

  assert.deepEqual(first, second);
  assert.equal(first.length, 7);
  for (const condition of CONDITIONS) {
    assert.ok(first.includes(condition.id));
  }
});

test('counterfactual feature changes can move an AI recommendation', () => {
  const baseCase = CASES.find((item) => item.id === 'case-near-threshold');
  const base = makeAiAssessment(baseCase);
  const strongerEvidence = makeAiAssessment(baseCase, {
    evidenceStrength: 96,
    methodFit: 92,
    risk: 10,
  });

  assert.equal(base.decision, 'Needs Review');
  assert.equal(strongerEvidence.decision, 'Include');
  assert.ok(strongerEvidence.score > base.score);
});

test('trial evaluation distinguishes over-reliance from appropriate reliance', () => {
  const overReliance = evaluateTrial({
    initialDecision: 'Exclude',
    finalDecision: 'Include',
    aiDecision: 'Include',
    groundTruth: 'Exclude',
  });
  const appropriateReliance = evaluateTrial({
    initialDecision: 'Exclude',
    finalDecision: 'Include',
    aiDecision: 'Include',
    groundTruth: 'Include',
  });

  assert.equal(overReliance.finalCorrect, false);
  assert.equal(overReliance.overReliance, true);
  assert.equal(overReliance.appropriateReliance, false);
  assert.equal(appropriateReliance.finalCorrect, true);
  assert.equal(appropriateReliance.overReliance, false);
  assert.equal(appropriateReliance.appropriateReliance, true);
});

test('aggregate metrics summarize trial logs by condition', () => {
  const logs = [
    {
      condition: 'advice',
      finalCorrect: true,
      aiAgreement: true,
      overReliance: false,
      appropriateReliance: true,
      confidence: 6,
      agency: 5,
      trust: 4,
      effort: 3,
    },
    {
      condition: 'advice',
      finalCorrect: false,
      aiAgreement: true,
      overReliance: true,
      appropriateReliance: false,
      confidence: 3,
      agency: 2,
      trust: 6,
      effort: 5,
    },
    {
      condition: 'counterfactual',
      finalCorrect: true,
      aiAgreement: false,
      overReliance: false,
      appropriateReliance: false,
      confidence: 7,
      agency: 7,
      trust: 3,
      effort: 4,
    },
  ];

  const metrics = aggregateMetrics(logs);

  assert.equal(metrics.overall.trials, 3);
  assert.equal(metrics.overall.accuracy, 0.667);
  assert.equal(metrics.byCondition.advice.trials, 2);
  assert.equal(metrics.byCondition.advice.overRelianceRate, 0.5);
  assert.equal(metrics.byCondition.counterfactual.meanAgency, 7);
});

test('CSV export includes headers and escapes commas and quotes', () => {
  const csv = toCsv([
    {
      sessionId: 's1',
      participantId: 'P, "One"',
      timestamp: '2026-06-18T00:00:00.000Z',
      caseId: 'case-a',
      condition: 'advice',
      initialDecision: 'Exclude',
      finalDecision: 'Include',
      aiDecision: 'Include',
      groundTruth: 'Exclude',
      finalCorrect: false,
      aiAgreement: true,
      overReliance: true,
      appropriateReliance: false,
      confidence: 4,
      agency: 3,
      trust: 6,
      effort: 5,
      elapsedMs: 1234,
      counterfactual: { evidenceStrength: 96 },
    },
  ]);

  assert.match(csv, /^sessionId,participantId,timestamp/);
  assert.match(csv, /"P, ""One"""/);
  assert.match(csv, /"{""evidenceStrength"":96}"/);
});
