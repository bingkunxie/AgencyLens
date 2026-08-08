# AgencyLens

AgencyLens is a static HCI research instrument for studying how explanation interfaces shape human agency and reliance in AI-assisted decisions.

Open `index.html` in a browser. No server, build step, login, or network connection is required.

## What It Builds

The app runs synthetic review-triage tasks with known ground truth and intentionally imperfect AI recommendations. Each participant trial is assigned to one of three explanation conditions:

- Advice only: AI recommendation and confidence.
- Rationale: recommendation, confidence, evidence snippets, and feature trace.
- Counterfactual trace: rationale plus sliders for inspecting how feature changes would alter the AI recommendation.

The participant flow captures initial decision, final decision, confidence, perceived agency, trust, effort, elapsed time, and condition. The researcher console summarizes logs and exports JSON or CSV.

## Research Framing

Candidate research question:

> How does explanation interface structure affect appropriate reliance and perceived agency in AI-assisted decision tasks?

Possible hypotheses:

- H1: Counterfactual trace interfaces reduce over-reliance on wrong AI recommendations compared with advice-only interfaces.
- H2: Counterfactual trace interfaces increase perceived agency without reducing appropriate reliance on correct AI recommendations.
- H3: Rationale-only interfaces increase AI agreement, but not necessarily final accuracy, when the AI is overconfident.

Contribution framing:

- Interface technique: counterfactual trace lens for AI-assisted decisions.
- Artifact: a reproducible local-first study platform for controlled human-AI reliance studies.
- Empirical study: a controlled comparison of advice-only, rationale, and counterfactual explanation interfaces.

## Suggested Study Design

Use a within-subjects design when participant count is limited and a between-subjects design when carryover effects are a major concern. Use the seed field to produce deterministic condition orders. The current synthetic cases include clear includes, clear excludes, near-threshold cases, overconfident AI cases, and cases where the correct action is "Needs Review."

Primary dependent variables:

- Final accuracy
- AI agreement rate
- Over-reliance rate
- Appropriate reliance rate
- Perceived agency
- Trust
- Effort
- Confidence
- Elapsed time

The app does not replace consent, compensation, accessibility review, or IRB/ethics review for human-subjects research.

## Exported Fields

CSV and JSON exports include:

- `sessionId`
- `participantId`
- `timestamp`
- `caseId`
- `condition`
- `initialDecision`
- `finalDecision`
- `aiDecision`
- `groundTruth`
- `finalCorrect`
- `aiAgreement`
- `overReliance`
- `appropriateReliance`
- `confidence`
- `agency`
- `trust`
- `effort`
- `elapsedMs`
- `counterfactual`

## File Map

- `index.html`: app shell
- `styles.css`: responsive visual system
- `logic.js`: deterministic study logic and metrics
- `app.js`: browser interactions, local storage, exports
- `tests/logic.test.js`: Node tests for the logic layer

## Run Tests

From the workspace root:

```powershell
node --test outputs/agency-lens/tests/logic.test.js
```

## Next Extensions

- Replace synthetic cases with domain-specific cases from your own study.
- Add a consent and demographics page for deployment.
- Add remote data collection with a small backend or survey platform integration.
- Add screen recording or event-level trace logging for richer interaction analysis.
- Add paper-ready analysis scripts for mixed-effects models.
