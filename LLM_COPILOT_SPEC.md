# Namello 1.0.26 — Strategic LLM Copilot

## Architecture
The LLM is deliberately downstream of the statistical / rule-based engine.

`Trades + OHLC/MT5 -> Statistical Core -> Regime/Transition/Risk/Strategy/Psychology -> Structured JSON -> LLM interpretation`

The LLM does not calculate core performance metrics and does not become the source of truth.

## Privacy
- By default the LLM receives a structured strategic payload, not raw trade rows.
- Account names, free-form journal notes and raw trade history are not included in the payload.
- The user must manually run the LLM analysis.
- Backend mode is recommended because the provider API key stays on the backend.
- Direct mode stores the API key in browser localStorage and is therefore optional / lower-security.

## Backend configuration
Set these environment variables in the backend:

- `NAMELLO_LLM_API_URL` — an OpenAI-compatible Chat Completions endpoint.
- `NAMELLO_LLM_API_KEY` — provider secret.
- `NAMELLO_LLM_MODEL` — default model identifier.

The authenticated endpoint is `POST /v1/llm/strategic`.

## Output contract
The prompt asks for JSON:

- `summary`
- `regime`
- `edge`
- `risk`
- `strategy`
- `psychology`
- `actions[]`
- `warnings[]`
- `confidence`
- `rationale[]`

If the LLM returns unsupported or invented information, the UI should not treat it as a calculated fact. The source of truth remains the structured engine output shown elsewhere in the Strategic Engine panel.
