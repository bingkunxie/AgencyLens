(function bootAgencyLens() {
  const Logic = window.AgencyLensLogic;
  const STORAGE_KEY = 'agencyLens.logs.v1';
  const DEFAULT_SEED = 'AGENCY-LENS';

  const state = {
    sessionId: '',
    participantId: '',
    seed: DEFAULT_SEED,
    conditionOrder: [],
    caseIndex: 0,
    trialStart: 0,
    initialDecision: '',
    finalDecision: '',
    aiVisible: false,
    ratings: {
      confidence: 4,
      agency: 4,
      trust: 4,
      effort: 4,
    },
    counterfactual: {},
    logs: loadLogs(),
  };

  const els = {
    tabs: Array.from(document.querySelectorAll('.tab-button')),
    studyView: document.getElementById('study-view'),
    consoleView: document.getElementById('console-view'),
    participantId: document.getElementById('participant-id'),
    studySeed: document.getElementById('study-seed'),
    startSession: document.getElementById('start-session'),
    resetSession: document.getElementById('reset-session'),
    progressFill: document.getElementById('progress-fill'),
    progressCopy: document.getElementById('progress-copy'),
    conditionStack: document.getElementById('condition-stack'),
    statusLine: document.getElementById('status-line'),
    casePanel: document.getElementById('case-panel'),
    consoleSeed: document.getElementById('console-seed'),
    previewOrder: document.getElementById('preview-order'),
    orderPreview: document.getElementById('order-preview'),
    logCount: document.getElementById('log-count'),
    exportJson: document.getElementById('export-json'),
    exportCsv: document.getElementById('export-csv'),
    clearLogs: document.getElementById('clear-logs'),
    metricsGrid: document.getElementById('metrics-grid'),
    protocolCard: document.getElementById('protocol-card'),
    copyProtocol: document.getElementById('copy-protocol'),
  };

  const protocolText = [
    'AgencyLens protocol sketch',
    '',
    'Research question: How does explanation interface structure affect agency and appropriate reliance in AI-assisted triage decisions?',
    'Independent variable: AI explanation condition with three levels: advice only, rationale, counterfactual trace.',
    'Primary dependent variables: final accuracy, over-reliance rate, appropriate reliance rate, perceived agency, trust, effort, and decision time.',
    'Suggested design: within-subjects, counterbalanced by seeded condition order, with synthetic cases containing known ground truth and intentionally imperfect AI advice.',
    'Hypothesis H1: Counterfactual trace interfaces reduce over-reliance on wrong AI recommendations compared with advice-only interfaces.',
    'Hypothesis H2: Counterfactual trace interfaces increase perceived agency without lowering appropriate reliance on correct AI recommendations.',
  ].join('\n');

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function conditionById(id) {
    return Logic.CONDITIONS.find((condition) => condition.id === id) || Logic.CONDITIONS[0];
  }

  function percent(value) {
    return `${Math.round(Number(value || 0) * 100)}%`;
  }

  function formatNumber(value) {
    if (!Number.isFinite(Number(value))) return '0';
    return String(Number(value));
  }

  function loadLogs() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      return [];
    }
  }

  function saveLogs() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.logs));
    } catch (error) {
      setStatus('Local storage is unavailable; export data before closing this file.');
    }
  }

  function setStatus(message) {
    els.statusLine.textContent = message;
  }

  function resetTrialState() {
    state.trialStart = Date.now();
    state.initialDecision = '';
    state.finalDecision = '';
    state.aiVisible = false;
    state.ratings = {
      confidence: 4,
      agency: 4,
      trust: 4,
      effort: 4,
    };
    state.counterfactual = {};
  }

  function startSession() {
    const now = new Date();
    state.sessionId = Logic.createSessionId(now);
    state.seed = els.studySeed.value.trim() || DEFAULT_SEED;
    state.participantId =
      els.participantId.value.trim() || `ANON-${state.sessionId.slice(-6)}`;
    state.conditionOrder = Logic.getConditionOrder(
      `${state.seed}:${state.participantId}`,
      Logic.CASES.length,
    );
    state.caseIndex = 0;
    resetTrialState();
    setStatus(`Session ${state.sessionId} started for ${state.participantId}.`);
    renderAll();
  }

  function resetSession() {
    state.sessionId = '';
    state.participantId = '';
    state.conditionOrder = [];
    state.caseIndex = 0;
    resetTrialState();
    setStatus('Session reset. Start a session to begin the study flow.');
    renderAll();
  }

  function switchTab(tab) {
    const showConsole = tab === 'console';
    els.studyView.classList.toggle('active', !showConsole);
    els.consoleView.classList.toggle('active', showConsole);
    for (const button of els.tabs) {
      button.classList.toggle('active', button.dataset.tab === tab);
    }
    if (showConsole) {
      renderConsole();
    }
  }

  function currentCase() {
    return Logic.CASES[state.caseIndex] || null;
  }

  function currentCondition() {
    return conditionById(state.conditionOrder[state.caseIndex]);
  }

  function renderAll() {
    renderProgress();
    renderConditionStack();
    renderCase();
    renderConsole();
  }

  function renderProgress() {
    if (!state.sessionId) {
      els.progressFill.style.width = '0%';
      els.progressCopy.textContent = 'No active session';
      return;
    }

    const complete = Math.min(state.caseIndex, Logic.CASES.length);
    const progress = Logic.CASES.length ? complete / Logic.CASES.length : 0;
    els.progressFill.style.width = `${Math.round(progress * 100)}%`;
    if (state.caseIndex >= Logic.CASES.length) {
      els.progressCopy.textContent = `${Logic.CASES.length} of ${Logic.CASES.length} cases complete`;
    } else {
      els.progressCopy.textContent = `Case ${state.caseIndex + 1} of ${Logic.CASES.length}`;
    }
  }

  function renderConditionStack() {
    if (!state.sessionId) {
      els.conditionStack.innerHTML = '';
      return;
    }

    els.conditionStack.innerHTML = state.conditionOrder
      .map((conditionId, index) => {
        const condition = conditionById(conditionId);
        const current = index === state.caseIndex ? ' current' : '';
        return `
          <div class="condition-pill${current}">
            <span>Case ${index + 1}</span>
            <strong>${escapeHtml(condition.shortLabel)}</strong>
          </div>
        `;
      })
      .join('');
  }

  function renderCase() {
    if (!state.sessionId) {
      els.casePanel.innerHTML = `
        <div class="empty-state">
          <h2>Ready for a controlled reliance study</h2>
          <p>Use the session panel to start a participant run. Trial logs remain local until exported from the console.</p>
        </div>
      `;
      return;
    }

    if (state.caseIndex >= Logic.CASES.length) {
      els.casePanel.innerHTML = `
        <div class="complete-state">
          <h2>Session complete</h2>
          <p>${escapeHtml(state.participantId)} completed ${Logic.CASES.length} trials in session ${escapeHtml(state.sessionId)}.</p>
          <div class="button-row">
            <button class="primary-button" type="button" data-open-console="true">Open Research Console</button>
            <button class="secondary-button" type="button" data-new-session="true">New Session</button>
          </div>
        </div>
      `;
      return;
    }

    const item = currentCase();
    const condition = currentCondition();

    els.casePanel.innerHTML = `
      <header class="case-header">
        <div>
          <p class="case-kicker">${escapeHtml(item.domain)}</p>
          <h2 class="case-title">${escapeHtml(item.title)}</h2>
          <p class="case-summary">${escapeHtml(item.summary)}</p>
        </div>
        <div class="condition-badge">${escapeHtml(condition.label)}</div>
      </header>

      <div class="case-body">
        <section class="decision-panel">
          <div class="step-block">
            <p class="step-label">Initial judgment</p>
            ${renderDecisionChoices('initialDecision', state.initialDecision, state.aiVisible)}
            <div class="button-row">
              <button class="primary-button" type="button" data-reveal-ai="true" ${state.initialDecision && !state.aiVisible ? '' : 'disabled'}>Reveal AI</button>
            </div>
          </div>

          <div class="step-block ${state.aiVisible ? '' : 'hidden'}">
            <p class="step-label">Final judgment</p>
            ${renderDecisionChoices('finalDecision', state.finalDecision, false)}
          </div>

          <div class="step-block ${state.aiVisible ? '' : 'hidden'}">
            <p class="step-label">Post-task ratings</p>
            ${renderRatings()}
            <div class="button-row">
              <button class="primary-button" type="button" data-submit-trial="true">Submit Trial</button>
            </div>
          </div>
        </section>

        <section class="ai-panel" id="ai-panel">
          ${state.aiVisible ? renderAiPanel(item, condition) : renderAiPlaceholder()}
        </section>
      </div>
    `;
  }

  function renderDecisionChoices(target, selected, disabled) {
    return `
      <div class="choice-grid" role="group" aria-label="${target === 'initialDecision' ? 'Initial decision' : 'Final decision'}">
        ${Logic.DECISIONS.map((decision) => {
          const active = selected === decision ? ' selected' : '';
          return `
            <button class="choice-button${active}" type="button" data-choice-target="${target}" data-choice-value="${escapeHtml(decision)}" ${disabled ? 'disabled' : ''}>
              <span>${escapeHtml(decision)}</span>
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderRatings() {
    const labels = {
      confidence: 'Confidence',
      agency: 'Agency',
      trust: 'Trust',
      effort: 'Effort',
    };

    return `
      <div class="rating-grid">
        ${Object.entries(labels)
          .map(
            ([key, label]) => `
              <div class="rating-row">
                <label for="rating-${key}">${label}</label>
                <input id="rating-${key}" type="range" min="1" max="7" value="${state.ratings[key]}" data-rating="${key}">
                <span class="rating-value" id="rating-value-${key}">${state.ratings[key]}</span>
              </div>
            `,
          )
          .join('')}
      </div>
    `;
  }

  function renderAiPlaceholder() {
    return `
      <div class="ai-empty">
        <p>AI panel is hidden until the initial judgment is locked.</p>
      </div>
    `;
  }

  function renderAiPanel(item, condition) {
    const base = Logic.makeAiAssessment(item);
    const showRationale = condition.id === 'rationale' || condition.id === 'counterfactual';
    const showCounterfactual = condition.id === 'counterfactual';

    return `
      <div class="ai-card">
        ${renderRecommendation(base, 'AI recommendation')}
        ${showRationale ? renderEvidence(item) : ''}
        ${showRationale ? renderFeatureList(base) : ''}
        ${showCounterfactual ? renderCounterfactual(item) : ''}
      </div>
    `;
  }

  function renderRecommendation(assessment, label) {
    return `
      <section class="recommendation">
        <div>
          <span class="step-label">${escapeHtml(label)}</span>
          <strong>${escapeHtml(assessment.decision)}</strong>
          <span>Model score ${assessment.score}</span>
        </div>
        <div class="confidence-meter" aria-label="AI confidence">
          <div class="meter-track">
            <div class="meter-fill" style="width: ${assessment.confidence}%"></div>
          </div>
          <div class="meter-copy">${assessment.confidence}% confidence</div>
        </div>
      </section>
    `;
  }

  function renderEvidence(item) {
    return `
      <section>
        <p class="step-label">Evidence read by the AI</p>
        <ul class="evidence-list">
          ${item.evidence.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
        </ul>
      </section>
    `;
  }

  function renderFeatureList(assessment) {
    return `
      <section>
        <p class="step-label">Feature trace</p>
        <div class="feature-list">
          ${Object.keys(Logic.FEATURE_WEIGHTS)
            .map((key) => {
              const value = assessment.features[key];
              const negative = Logic.FEATURE_WEIGHTS[key] < 0 ? ' negative' : '';
              const sign = Logic.FEATURE_WEIGHTS[key] > 0 ? '+' : '';
              return `
                <div class="feature-row${negative}">
                  <span>${escapeHtml(Logic.FEATURE_LABELS[key])}</span>
                  <div class="feature-bar"><span style="width: ${value}%"></span></div>
                  <strong>${value} ${sign}${Logic.FEATURE_WEIGHTS[key]}</strong>
                </div>
              `;
            })
            .join('')}
        </div>
      </section>
    `;
  }

  function renderCounterfactual(item) {
    const values = Object.assign({}, item.features, state.counterfactual);
    const preview = Logic.makeAiAssessment(item, values);

    return `
      <section>
        <p class="step-label">Counterfactual trace lens</p>
        <div class="counterfactual-grid">
          ${Object.keys(Logic.FEATURE_WEIGHTS)
            .map((key) => {
              const value = values[key];
              return `
                <div class="slider-row">
                  <label for="cf-${key}">${escapeHtml(Logic.FEATURE_LABELS[key])}</label>
                  <input id="cf-${key}" type="range" min="0" max="100" value="${value}" data-counterfactual="${key}">
                  <strong id="cf-value-${key}">${value}</strong>
                </div>
              `;
            })
            .join('')}
        </div>
        <div class="preview-panel" id="counterfactual-preview">
          ${renderPreviewItems(preview)}
        </div>
      </section>
    `;
  }

  function renderPreviewItems(assessment) {
    return `
      <div class="preview-item">
        <span>Preview decision</span>
        <strong id="preview-decision">${escapeHtml(assessment.decision)}</strong>
      </div>
      <div class="preview-item">
        <span>Preview score</span>
        <strong id="preview-score">${assessment.score}</strong>
      </div>
      <div class="preview-item">
        <span>Preview confidence</span>
        <strong id="preview-confidence">${assessment.confidence}%</strong>
      </div>
    `;
  }

  function handleCaseClick(event) {
    const choice = event.target.closest('[data-choice-target]');
    if (choice && !choice.disabled) {
      const target = choice.dataset.choiceTarget;
      state[target] = choice.dataset.choiceValue;
      renderCase();
      return;
    }

    if (event.target.closest('[data-reveal-ai]')) {
      if (!state.initialDecision) {
        setStatus('Choose an initial judgment before revealing the AI panel.');
        return;
      }
      state.aiVisible = true;
      setStatus(`AI panel revealed under ${currentCondition().label}.`);
      renderCase();
      return;
    }

    if (event.target.closest('[data-submit-trial]')) {
      submitTrial();
      return;
    }

    if (event.target.closest('[data-open-console]')) {
      switchTab('console');
      return;
    }

    if (event.target.closest('[data-new-session]')) {
      startSession();
    }
  }

  function handleCaseInput(event) {
    const rating = event.target.dataset.rating;
    if (rating) {
      state.ratings[rating] = Number(event.target.value);
      const valueEl = document.getElementById(`rating-value-${rating}`);
      if (valueEl) valueEl.textContent = event.target.value;
      return;
    }

    const counterfactualKey = event.target.dataset.counterfactual;
    if (counterfactualKey) {
      state.counterfactual[counterfactualKey] = Number(event.target.value);
      const valueEl = document.getElementById(`cf-value-${counterfactualKey}`);
      if (valueEl) valueEl.textContent = event.target.value;
      updateCounterfactualPreview();
    }
  }

  function updateCounterfactualPreview() {
    const item = currentCase();
    if (!item) return;
    const preview = Logic.makeAiAssessment(item, state.counterfactual);
    const decision = document.getElementById('preview-decision');
    const score = document.getElementById('preview-score');
    const confidence = document.getElementById('preview-confidence');
    if (decision) decision.textContent = preview.decision;
    if (score) score.textContent = preview.score;
    if (confidence) confidence.textContent = `${preview.confidence}%`;
  }

  function submitTrial() {
    const item = currentCase();
    const condition = currentCondition();
    if (!item) return;

    if (!state.initialDecision || !state.finalDecision) {
      setStatus('Both initial and final judgments are required before submitting.');
      return;
    }

    const assessment = Logic.makeAiAssessment(item);
    const evaluation = Logic.evaluateTrial({
      initialDecision: state.initialDecision,
      finalDecision: state.finalDecision,
      aiDecision: assessment.decision,
      groundTruth: item.groundTruth,
    });
    const counterfactual =
      condition.id === 'counterfactual' ? Object.assign({}, state.counterfactual) : {};

    const entry = Object.assign(
      {
        sessionId: state.sessionId,
        participantId: state.participantId,
        timestamp: new Date().toISOString(),
        caseId: item.id,
        condition: condition.id,
        initialDecision: state.initialDecision,
        finalDecision: state.finalDecision,
        aiDecision: assessment.decision,
        groundTruth: item.groundTruth,
        confidence: state.ratings.confidence,
        agency: state.ratings.agency,
        trust: state.ratings.trust,
        effort: state.ratings.effort,
        elapsedMs: Date.now() - state.trialStart,
        counterfactual,
      },
      evaluation,
    );

    state.logs.push(entry);
    saveLogs();
    state.caseIndex += 1;
    resetTrialState();

    if (state.caseIndex >= Logic.CASES.length) {
      setStatus(`Session ${state.sessionId} complete. Export data from the Research Console.`);
    } else {
      setStatus(`Trial saved. Continue to case ${state.caseIndex + 1}.`);
    }

    renderAll();
  }

  function renderConsole() {
    renderOrderPreview();
    renderMetrics();
    renderProtocol();
  }

  function renderOrderPreview() {
    const seed = els.consoleSeed.value.trim() || DEFAULT_SEED;
    const order = Logic.getConditionOrder(seed, Logic.CASES.length);
    els.orderPreview.innerHTML = order
      .map((id, index) => {
        const condition = conditionById(id);
        return `<span class="order-token">${index + 1}. ${escapeHtml(condition.shortLabel)}</span>`;
      })
      .join('');
  }

  function renderMetrics() {
    const metrics = Logic.aggregateMetrics(state.logs);
    els.logCount.textContent = `${state.logs.length} ${state.logs.length === 1 ? 'trial' : 'trials'}`;

    const cards = [
      metricCard('Trials', metrics.overall.trials, 'overall'),
      metricCard('Accuracy', percent(metrics.overall.accuracy), 'overall'),
      metricCard('AI agreement', percent(metrics.overall.aiAgreementRate), 'overall'),
      metricCard('Over-reliance', percent(metrics.overall.overRelianceRate), 'risk'),
      metricCard('Appropriate reliance', percent(metrics.overall.appropriateRelianceRate), 'overall'),
      metricCard('Mean agency', formatNumber(metrics.overall.meanAgency), 'overall'),
      metricCard('Mean trust', formatNumber(metrics.overall.meanTrust), 'overall'),
      metricCard('Mean effort', formatNumber(metrics.overall.meanEffort), 'warning'),
    ];

    for (const condition of Logic.CONDITIONS) {
      const summary = metrics.byCondition[condition.id];
      cards.push(
        metricCard(`${condition.shortLabel} trials`, summary.trials, 'overall'),
        metricCard(`${condition.shortLabel} accuracy`, percent(summary.accuracy), 'overall'),
        metricCard(`${condition.shortLabel} over-reliance`, percent(summary.overRelianceRate), 'risk'),
        metricCard(`${condition.shortLabel} agency`, formatNumber(summary.meanAgency), 'overall'),
      );
    }

    els.metricsGrid.innerHTML = cards.join('');
  }

  function metricCard(label, value, tone) {
    const className = tone === 'risk' || tone === 'warning' ? ` ${tone}` : '';
    return `
      <div class="metric-card${className}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `;
  }

  function renderProtocol() {
    els.protocolCard.innerHTML = `
      <section>
        <h3>Research Question</h3>
        <p>How does explanation interface structure affect agency and appropriate reliance in AI-assisted triage decisions?</p>
      </section>
      <section>
        <h3>Independent Variable</h3>
        <ul>
          <li>Advice only</li>
          <li>Rationale</li>
          <li>Counterfactual trace</li>
        </ul>
      </section>
      <section>
        <h3>Dependent Variables</h3>
        <ul>
          <li>Final accuracy</li>
          <li>Over-reliance and appropriate reliance</li>
          <li>Agency, trust, effort, confidence</li>
          <li>Decision time</li>
        </ul>
      </section>
      <section>
        <h3>Study Design</h3>
        <p>Within-subjects or between-subjects with seeded counterbalancing and synthetic cases with known ground truth.</p>
      </section>
    `;
  }

  function exportJson() {
    downloadFile(
      `agency-lens-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(state.logs, null, 2),
      'application/json',
    );
  }

  function exportCsv() {
    downloadFile(
      `agency-lens-${new Date().toISOString().slice(0, 10)}.csv`,
      Logic.toCsv(state.logs),
      'text/csv',
    );
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function clearLogs() {
    if (!window.confirm('Clear all locally stored AgencyLens logs?')) {
      return;
    }
    state.logs = [];
    saveLogs();
    renderConsole();
    setStatus('Stored logs cleared.');
  }

  function copyProtocol() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(protocolText)
        .then(() => setStatus('Protocol copied to clipboard.'))
        .catch(copyProtocolFallback);
      return;
    }
    copyProtocolFallback();
  }

  function copyProtocolFallback() {
    const area = document.createElement('textarea');
    area.value = protocolText;
    area.setAttribute('readonly', 'true');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
      setStatus('Protocol copied to clipboard.');
    } catch (error) {
      setStatus('Clipboard is unavailable; use the README protocol text.');
    }
    area.remove();
  }

  function bindEvents() {
    els.tabs.forEach((button) => {
      button.addEventListener('click', () => switchTab(button.dataset.tab));
    });
    els.startSession.addEventListener('click', startSession);
    els.resetSession.addEventListener('click', resetSession);
    els.casePanel.addEventListener('click', handleCaseClick);
    els.casePanel.addEventListener('input', handleCaseInput);
    els.previewOrder.addEventListener('click', renderOrderPreview);
    els.consoleSeed.addEventListener('input', renderOrderPreview);
    els.exportJson.addEventListener('click', exportJson);
    els.exportCsv.addEventListener('click', exportCsv);
    els.clearLogs.addEventListener('click', clearLogs);
    els.copyProtocol.addEventListener('click', copyProtocol);
  }

  bindEvents();
  renderAll();
})();
