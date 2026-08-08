(function initAgencyLens(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AgencyLensLogic = factory();
  }
})(typeof self !== 'undefined' ? self : this, function createAgencyLensLogic() {
  const DECISIONS = ['Include', 'Needs Review', 'Exclude'];

  const CONDITIONS = [
    {
      id: 'advice',
      label: 'Advice only',
      shortLabel: 'Advice',
      description: 'Participant sees only the AI recommendation and confidence.',
    },
    {
      id: 'rationale',
      label: 'Rationale',
      shortLabel: 'Rationale',
      description: 'Participant sees AI recommendation, confidence, evidence, and feature weights.',
    },
    {
      id: 'counterfactual',
      label: 'Counterfactual trace',
      shortLabel: 'Counterfactual',
      description: 'Participant can adjust evidence features and inspect how the recommendation changes.',
    },
  ];

  const FEATURE_LABELS = {
    methodFit: 'Method fit',
    evidenceStrength: 'Evidence strength',
    novelty: 'Novelty',
    sampleClarity: 'Sample clarity',
    risk: 'Validity risk',
  };

  const FEATURE_WEIGHTS = {
    methodFit: 0.24,
    evidenceStrength: 0.26,
    novelty: 0.18,
    sampleClarity: 0.16,
    risk: -0.2,
  };

  const CASES = [
    {
      id: 'case-near-threshold',
      title: 'Adaptive note-taking tool for seminar discussions',
      domain: 'Learning and collaboration',
      groundTruth: 'Include',
      summary:
        'A lab study compares an adaptive note-taking interface with a static outline during small-group seminar discussions.',
      features: {
        methodFit: 70,
        evidenceStrength: 58,
        novelty: 64,
        sampleClarity: 62,
        risk: 48,
      },
      aiBias: -4,
      evidence: [
        'Within-subject comparison with counterbalanced tool order.',
        'Reported themes align with collaboration outcomes but the statistical section is thin.',
        'Participants were recruited from one graduate course.',
      ],
      caveat: 'The case sits near the inclusion boundary; stronger evidence would change the AI recommendation.',
    },
    {
      id: 'case-overconfident-ai',
      title: 'Emotion dashboard for remote software teams',
      domain: 'Workplace AI',
      groundTruth: 'Exclude',
      summary:
        'A dashboard infers team sentiment from chat logs and recommends interventions to engineering managers.',
      features: {
        methodFit: 44,
        evidenceStrength: 38,
        novelty: 76,
        sampleClarity: 41,
        risk: 82,
      },
      aiBias: 14,
      evidence: [
        'The system is novel, but the evaluation uses unvalidated sentiment labels.',
        'Workers could not contest the inferred emotional states.',
        'The analysis reports engagement, not decision quality or worker agency.',
      ],
      caveat: 'The AI overvalues novelty and undervalues validity risk in this case.',
    },
    {
      id: 'case-strong-include',
      title: 'Tactile map authoring for blind transit riders',
      domain: 'Accessibility',
      groundTruth: 'Include',
      summary:
        'A mixed-methods study evaluates a tactile map authoring interface with blind transit riders and orientation specialists.',
      features: {
        methodFit: 88,
        evidenceStrength: 86,
        novelty: 72,
        sampleClarity: 82,
        risk: 18,
      },
      aiBias: 1,
      evidence: [
        'Evaluation includes both realistic route-planning tasks and interviews.',
        'Participant recruitment and accessibility accommodations are described clearly.',
        'The contribution is a concrete interface technique with reusable design implications.',
      ],
      caveat: 'The evidence is strong across both interface novelty and study validity.',
    },
    {
      id: 'case-strong-exclude',
      title: 'Gamified hydration reminder for office workers',
      domain: 'Persuasive technology',
      groundTruth: 'Exclude',
      summary:
        'A mobile reminder app uses points and streaks to encourage hydration during working hours.',
      features: {
        methodFit: 31,
        evidenceStrength: 28,
        novelty: 26,
        sampleClarity: 55,
        risk: 64,
      },
      aiBias: 0,
      evidence: [
        'The interface is a conventional reminder and badge system.',
        'The outcome measure is self-reported app satisfaction after one day.',
        'The manuscript does not connect the design to HCI theory or method.',
      ],
      caveat: 'Low novelty and weak evaluation make this a clear exclusion.',
    },
    {
      id: 'case-hidden-risk',
      title: 'Generative critique partner for early-stage design studios',
      domain: 'Creativity support',
      groundTruth: 'Needs Review',
      summary:
        'A critique partner generates alternative framings for student design concepts during studio sessions.',
      features: {
        methodFit: 68,
        evidenceStrength: 67,
        novelty: 82,
        sampleClarity: 49,
        risk: 70,
      },
      aiBias: 2,
      evidence: [
        'The interface is promising and grounded in studio critique practice.',
        'The sample mixes novice and expert designers without stratified analysis.',
        'The paper reports creative breadth but not ownership or agency outcomes.',
      ],
      caveat: 'The correct action is to inspect more closely rather than accept or reject immediately.',
    },
    {
      id: 'case-appropriate-ai',
      title: 'Privacy nutrition labels for smart speakers',
      domain: 'Privacy UX',
      groundTruth: 'Include',
      summary:
        'An experiment compares layered privacy labels with plain-language notices for smart speaker setup.',
      features: {
        methodFit: 77,
        evidenceStrength: 79,
        novelty: 61,
        sampleClarity: 73,
        risk: 24,
      },
      aiBias: 5,
      evidence: [
        'The study includes comprehension, recall, and choice measures.',
        'The design is deployable in real onboarding flows.',
        'The paper clearly separates privacy attitudes from actual understanding.',
      ],
      caveat: 'This is a case where relying on correct AI advice can improve the final decision.',
    },
  ];

  const CSV_COLUMNS = [
    'sessionId',
    'participantId',
    'timestamp',
    'caseId',
    'condition',
    'initialDecision',
    'finalDecision',
    'aiDecision',
    'groundTruth',
    'finalCorrect',
    'aiAgreement',
    'overReliance',
    'appropriateReliance',
    'confidence',
    'agency',
    'trust',
    'effort',
    'elapsedMs',
    'counterfactual',
  ];

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function round(value, digits) {
    const scale = 10 ** digits;
    return Math.round((value + Number.EPSILON) * scale) / scale;
  }

  function hashSeed(seed) {
    const text = String(seed || 'AGENCY-LENS');
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed) {
    let state = hashSeed(seed);
    return function nextRandom() {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffleIds(ids, seed) {
    const random = seededRandom(seed);
    const shuffled = ids.slice();
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      const current = shuffled[index];
      shuffled[index] = shuffled[swapIndex];
      shuffled[swapIndex] = current;
    }
    return shuffled;
  }

  function getConditionOrder(seed, count) {
    const desiredCount = Math.max(0, Number(count) || 0);
    const baseOrder = shuffleIds(
      CONDITIONS.map((condition) => condition.id),
      seed || 'AGENCY-LENS',
    );
    const order = [];
    for (let index = 0; index < desiredCount; index += 1) {
      order.push(baseOrder[index % baseOrder.length]);
    }
    return order;
  }

  function normalizeFeatures(caseItem, overrides) {
    const source = caseItem && caseItem.features ? caseItem.features : {};
    const merged = Object.assign({}, source, overrides || {});
    const normalized = {};
    for (const key of Object.keys(FEATURE_WEIGHTS)) {
      normalized[key] = clamp(Number(merged[key] ?? 0), 0, 100);
    }
    return normalized;
  }

  function decisionForScore(score) {
    if (score >= 68) return 'Include';
    if (score <= 48) return 'Exclude';
    return 'Needs Review';
  }

  function confidenceForScore(score, decision) {
    let margin = 0;
    if (decision === 'Include') {
      margin = score - 68;
    } else if (decision === 'Exclude') {
      margin = 48 - score;
    } else {
      margin = Math.min(score - 48, 68 - score);
    }
    return Math.round(clamp(52 + margin * 2.1, 52, 96));
  }

  function makeAiAssessment(caseItem, overrides) {
    if (!caseItem) {
      throw new Error('makeAiAssessment requires a case item');
    }
    const features = normalizeFeatures(caseItem, overrides);
    let score = 26 + (caseItem.aiBias || 0);
    for (const [feature, weight] of Object.entries(FEATURE_WEIGHTS)) {
      score += features[feature] * weight;
    }
    const roundedScore = round(clamp(score, 0, 100), 1);
    const decision = decisionForScore(roundedScore);

    return {
      decision,
      confidence: confidenceForScore(roundedScore, decision),
      score: roundedScore,
      features,
      weights: Object.assign({}, FEATURE_WEIGHTS),
    };
  }

  function evaluateTrial(trial) {
    const finalCorrect = trial.finalDecision === trial.groundTruth;
    const initialCorrect = trial.initialDecision === trial.groundTruth;
    const aiCorrect = trial.aiDecision === trial.groundTruth;
    const aiAgreement = trial.finalDecision === trial.aiDecision;
    const changedTowardAi =
      trial.initialDecision !== trial.aiDecision && trial.finalDecision === trial.aiDecision;

    return {
      initialCorrect,
      finalCorrect,
      aiCorrect,
      aiAgreement,
      overReliance: changedTowardAi && !aiCorrect,
      appropriateReliance: changedTowardAi && aiCorrect && finalCorrect,
      productiveResistance:
        trial.finalDecision === trial.groundTruth && trial.aiDecision !== trial.groundTruth,
    };
  }

  function mean(items, field) {
    if (!items.length) return 0;
    const values = items
      .map((item) => Number(item[field]))
      .filter((value) => Number.isFinite(value));
    if (!values.length) return 0;
    return round(
      values.reduce((sum, value) => sum + value, 0) / values.length,
      3,
    );
  }

  function rate(items, predicate) {
    if (!items.length) return 0;
    const count = items.filter(predicate).length;
    return round(count / items.length, 3);
  }

  function summarize(items) {
    return {
      trials: items.length,
      accuracy: rate(items, (item) => Boolean(item.finalCorrect)),
      aiAgreementRate: rate(items, (item) => Boolean(item.aiAgreement)),
      overRelianceRate: rate(items, (item) => Boolean(item.overReliance)),
      appropriateRelianceRate: rate(items, (item) => Boolean(item.appropriateReliance)),
      meanConfidence: mean(items, 'confidence'),
      meanAgency: mean(items, 'agency'),
      meanTrust: mean(items, 'trust'),
      meanEffort: mean(items, 'effort'),
    };
  }

  function aggregateMetrics(logs) {
    const entries = Array.isArray(logs) ? logs : [];
    const byCondition = {};
    for (const condition of CONDITIONS) {
      byCondition[condition.id] = summarize(
        entries.filter((entry) => entry.condition === condition.id),
      );
    }

    return {
      overall: summarize(entries),
      byCondition,
    };
  }

  function csvEscape(value) {
    let text = '';
    if (value === null || value === undefined) {
      text = '';
    } else if (typeof value === 'object') {
      text = JSON.stringify(value);
    } else {
      text = String(value);
    }

    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  function toCsv(logs) {
    const entries = Array.isArray(logs) ? logs : [];
    const rows = [CSV_COLUMNS.join(',')];
    for (const entry of entries) {
      rows.push(CSV_COLUMNS.map((column) => csvEscape(entry[column])).join(','));
    }
    return rows.join('\n');
  }

  function createSessionId(now) {
    const timestamp = now instanceof Date ? now : new Date();
    return `AL-${timestamp.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
  }

  return {
    CONDITIONS,
    CASES,
    DECISIONS,
    FEATURE_LABELS,
    FEATURE_WEIGHTS,
    CSV_COLUMNS,
    getConditionOrder,
    makeAiAssessment,
    evaluateTrial,
    aggregateMetrics,
    toCsv,
    createSessionId,
  };
});
