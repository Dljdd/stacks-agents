"""
 payment-agent.py
 Python-based AI payment agent that understands natural language instructions,
 evaluates risk and rules, and initiates payments through the backend/Stacks.

 Classes:
 - NLPProcessor: Parse instructions to structured intents using OpenAI (or fallback)
 - RiskAssessor: Score risk based on heuristics and external APIs
 - DecisionEngine: Decide to authorize/deny based on rules + risk + context
 - BlockchainConnector: Integrates with backend REST API that proxies Stacks
 - ContextManager: Maintains recent context and learning artifacts
 - PaymentAgent: Orchestrates the full flow with retries, logging, and validation

 Requirements (install in backend/ env):
   pip install openai requests pydantic tenacity websockets

 Env:
 - OPENAI_API_KEY (if using OpenAI)
 - API_BASE (backend base URL, e.g. http://localhost:3000/api)
 - RISK_API_BASE (optional risk API)
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import requests
from pydantic import BaseModel, Field, ValidationError, conint, constr
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

# Optional: ws-based live status (if backend emits job events). Not required for core flow.
try:
    import websockets  # type: ignore
except Exception:  # pragma: no cover
    websockets = None

# Optional: OpenAI
try:
    import openai  # type: ignore
except Exception:  # pragma: no cover
    openai = None


logger = logging.getLogger("payment-agent")
logger.setLevel(logging.INFO)
_handler = logging.StreamHandler()
_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
logger.addHandler(_handler)


# ---------------- Schemas ----------------
class PaymentIntent(BaseModel):
    action: constr(strip_whitespace=True) = Field(..., description="pay|transfer|send|quote|simulate")
    amount: conint(ge=0) = Field(..., description="amount in uSTX unless currency specified")
    currency: constr(strip_whitespace=True) = Field("uSTX", description="uSTX|STX|sBTC|SIP-010 symbol")
    recipient: constr(strip_whitespace=True) = Field(..., description="Stacks principal or alias")
    memo: Optional[str] = Field(None, max_length=200)


class DecisionOutcome(BaseModel):
    authorize: bool
    reason: str
    risk_score: int = 0
    action: str = "allow"


# ---------------- NLP ----------------
class NLPProcessor:
    def __init__(self, model: str = "gpt-4o-mini") -> None:
        self.model = model
        if openai and os.getenv("OPENAI_API_KEY"):
            openai.api_key = os.getenv("OPENAI_API_KEY")

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=0.5, min=0.5, max=4))
    def parse_instruction(self, text: str) -> PaymentIntent:
        """Parse free-text into a PaymentIntent. Falls back to regex heuristics if LLM unavailable."""
        text = text.strip()
        if openai and os.getenv("OPENAI_API_KEY"):
            try:
                prompt = (
                    "Extract a structured payment intent as JSON with keys: action, amount, currency, recipient, memo. "
                    "- action: one of [pay, transfer, send, quote, simulate]\n"
                    "- amount: integer micro-units when currency=uSTX (1 STX = 1_000_000 uSTX).\n"
                    "- currency: uSTX by default unless sBTC/STX indicated.\n"
                    "- recipient: Stacks principal like SP.. or name as-is.\n"
                    "- memo: optional reason under 200 chars. Only output JSON.\n"
                    f"Instruction: {text}"
                )
                # Use Chat Completions (OpenAI SDK v1 pattern)
                resp = openai.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.2,
                )
                content = resp.choices[0].message.content  # type: ignore
                data = json.loads(content)
                return PaymentIntent(**data)
            except Exception as e:  # fall through to heuristics
                logger.warning("LLM parse failed, using heuristics", extra={"error": str(e)})

        # Heuristic parsing
        # amount detection: handle '1 stx', '0.5 stx', or raw micros like '100000 uSTX'
        amt_micro = 0
        m = re.search(r"(\d+\.\d+|\d+)\s*(stx|ustx|us\s*tx)?", text, flags=re.I)
        if m:
            val = float(m.group(1))
            unit = (m.group(2) or "stx").lower().replace(" ", "")
            if unit in ("stx",):
                amt_micro = int(round(val * 1_000_000))
            else:
                amt_micro = int(round(val))
        rec = None
        rm = re.search(r"(SP[0-9A-Z]{38,41}[0-9A-Z]*)", text)
        if rm:
            rec = rm.group(1)
        memo = None
        mm = re.search(r"(?:for|because|memo)\s*[:\-]?\s*(.{3,200})", text, flags=re.I)
        if mm:
            memo = mm.group(1).strip()
        intent = PaymentIntent(action="pay", amount=max(amt_micro, 0), currency="uSTX", recipient=rec or "unknown", memo=memo)
        return intent


# ---------------- Risk ----------------
class RiskAssessor:
    def __init__(self, risk_api_base: Optional[str] = None) -> None:
        self.risk_api_base = risk_api_base

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=0.5, min=0.5, max=4))
    def assess(self, agent_id: str, intent: PaymentIntent, history: List[Dict[str, Any]]) -> Dict[str, Any]:
        score = 0
        reasons: List[str] = []
        # Simple heuristics
        avg = 0
        vals = [h.get("amount", 0) for h in history if isinstance(h.get("amount", 0), (int, float))]
        if vals:
            avg = sum(vals) / len(vals)
        if avg and intent.amount > 3 * avg:
            score += 30; reasons.append("amount_spike")
        if not any(h.get("recipient") == intent.recipient for h in history):
            score += 10; reasons.append("new_recipient")
        if intent.amount > 10_000_000_000:  # >10 STX in micros
            score += 20; reasons.append("large_amount")

        # External risk
        if self.risk_api_base:
            try:
                r = requests.post(f"{self.risk_api_base}/risk", json={
                    "agentId": agent_id,
                    "recipient": intent.recipient,
                    "amount": intent.amount,
                }, timeout=5)
                if r.ok and isinstance(r.json().get("riskScore"), (int, float)):
                    score += int(r.json()["riskScore"])  # type: ignore
                    reasons.append("external_risk")
            except Exception as e:
                logger.warning("external risk failed", extra={"error": str(e)})
        block = score >= 70
        return {"score": score, "reasons": reasons, "block": block}


# ---------------- Backend/Blockchain connector ----------------
class BlockchainConnector:
    def __init__(self, api_base: str) -> None:
        self.api_base = api_base.rstrip("/")

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=0.5, min=0.5, max=4), reraise=True)
    def get_agents(self, owner: str) -> List[Dict[str, Any]]:
        r = requests.get(f"{self.api_base}/agents", params={"owner": owner}, timeout=8)
        r.raise_for_status()
        return r.json().get("agents", [])

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=0.5, min=0.5, max=4), reraise=True)
    def recent_payments(self, owner: str, agent_id: Optional[str] = None) -> List[Dict[str, Any]]:
        params: Dict[str, Any] = {"owner": owner}
        if agent_id:
            params["agentId"] = agent_id
        r = requests.get(f"{self.api_base}/payments/recent", params=params, timeout=8)
        r.raise_for_status()
        return r.json().get("items", [])

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=0.5, min=0.5, max=4), reraise=True)
    def validate_rules(self, agent_id: str, amount: int) -> Dict[str, Any]:
        # Proxies payment-processor read-only and optional rules-engine
        r = requests.post(f"{self.api_base}/rules/test", json={"agentId": agent_id, "paymentData": {"amount": amount}}, timeout=8)
        # If backend not implemented, treat as allow
        if not r.ok:
            logger.info("rules test endpoint not available; assuming allow")
            return {"action": "allow"}
        return r.json()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=0.5, min=0.5, max=4), reraise=True)
    def enqueue_payment(self, agent_id: str, recipient: str, amount: int, memo: Optional[str] = None) -> Dict[str, Any]:
        r = requests.post(f"{self.api_base}/payments", json={
            "token": "",  # TODO: inject JWT/API key
            "agentId": agent_id,
            "recipient": recipient,
            "amount": amount,
            "memo": memo or "",
        }, timeout=8)
        r.raise_for_status()
        return r.json()


# ---------------- Context ----------------
@dataclass
class ContextManager:
    owner: str
    path: str = ".agent_context.json"
    state: Dict[str, Any] = field(default_factory=dict)

    def load(self) -> None:
        try:
            if os.path.exists(self.path):
                with open(self.path, "r", encoding="utf-8") as f:
                    self.state = json.load(f)
        except Exception as e:
            logger.warning("failed to load context", extra={"error": str(e)})
            self.state = {}

    def save(self) -> None:
        try:
            with open(self.path, "w", encoding="utf-8") as f:
                json.dump(self.state, f, indent=2)
        except Exception as e:
            logger.warning("failed to save context", extra={"error": str(e)})

    def record_payment(self, item: Dict[str, Any]) -> None:
        self.state.setdefault("payments", []).insert(0, item)
        self.state["payments"] = self.state["payments"][:200]
        self.save()


# ---------------- Decision ----------------
class DecisionEngine:
    def __init__(self, connector: BlockchainConnector) -> None:
        self.connector = connector

    def decide(self, agent_id: str, intent: PaymentIntent, risk: Dict[str, Any]) -> DecisionOutcome:
        # Rules evaluation (backend)
        try:
            res = self.connector.validate_rules(agent_id, intent.amount)
            action = res.get("action", "allow")
        except Exception as e:
            logger.warning("rule validation failed; default allow", extra={"error": str(e)})
            action = "allow"

        if action != "allow":
            return DecisionOutcome(authorize=False, reason=f"rules:{action}", risk_score=risk.get("score", 0), action=action)

        if risk.get("block"):
            return DecisionOutcome(authorize=False, reason="risk_block", risk_score=risk.get("score", 0), action="block")

        return DecisionOutcome(authorize=True, reason="ok", risk_score=risk.get("score", 0), action="allow")


# ---------------- Agent ----------------
class PaymentAgent:
    def __init__(self, owner: str, api_base: Optional[str] = None, risk_api_base: Optional[str] = None) -> None:
        self.owner = owner
        self.api_base = api_base or os.getenv("API_BASE", "http://localhost:3000/api")
        self.connector = BlockchainConnector(self.api_base)
        self.nlp = NLPProcessor()
        self.risk = RiskAssessor(risk_api_base or os.getenv("RISK_API_BASE"))
        self.decision = DecisionEngine(self.connector)
        self.context = ContextManager(owner=owner)
        self.context.load()

    def _history(self, agent_id: Optional[str] = None) -> List[Dict[str, Any]]:
        try:
            return self.connector.recent_payments(owner=self.owner, agent_id=agent_id)
        except Exception:
            return self.context.state.get("payments", [])

    def _resolve_agent(self) -> str:
        """Resolve an agent to use for payments; defaults to owner principal for this prototype."""
        return self.owner

    def understand(self, text: str) -> PaymentIntent:
        return self.nlp.parse_instruction(text)

    def assess_risk(self, agent_id: str, intent: PaymentIntent) -> Dict[str, Any]:
        history = self._history(agent_id)
        return self.risk.assess(agent_id, intent, history)

    def decide(self, agent_id: str, intent: PaymentIntent, risk: Dict[str, Any]) -> DecisionOutcome:
        return self.decision.decide(agent_id, intent, risk)

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=0.5, min=0.5, max=4), reraise=True,
           retry=retry_if_exception_type((requests.RequestException,)))
    def initiate_payment(self, agent_id: str, intent: PaymentIntent) -> Dict[str, Any]:
        return self.connector.enqueue_payment(agent_id, intent.recipient, intent.amount, intent.memo)

    def process_instruction(self, text: str) -> Dict[str, Any]:
        """End-to-end processing of a user/agent NL instruction."""
        logger.info("processing instruction", extra={"text": text[:80]})
        try:
            intent = self.understand(text)
        except ValidationError as e:
            logger.error("intent validation error", extra={"error": str(e)})
            return {"ok": False, "error": "intent_invalid", "details": e.errors()}

        agent_id = self._resolve_agent()
        risk = self.assess_risk(agent_id, intent)
        decision = self.decide(agent_id, intent, risk)

        if not decision.authorize:
            logger.info("payment denied", extra={"reason": decision.reason, "risk": decision.risk_score})
            return {"ok": False, "authorized": False, "reason": decision.reason, "risk": decision.risk_score}

        # Execute
        try:
            res = self.initiate_payment(agent_id, intent)
            # Record locally for learning/context
            self.context.record_payment({
                "ts": int(time.time() * 1000),
                "agentId": agent_id,
                "recipient": intent.recipient,
                "amount": intent.amount,
                "jobId": res.get("jobId"),
            })
            return {"ok": True, "authorized": True, "jobId": res.get("jobId"), "queued": res.get("queued", False)}
        except Exception as e:
            logger.error("enqueue failed", extra={"error": str(e)})
            return {"ok": False, "error": "enqueue_failed", "details": str(e)}


# -------------- Simple CLI --------------
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="AI Payment Agent")
    parser.add_argument("instruction", help="Natural language instruction, e.g., 'Send 1 STX to SP... for hosting' ")
    parser.add_argument("--owner", required=True, help="Owner principal/address")
    parser.add_argument("--api", default=os.getenv("API_BASE", "http://localhost:3000/api"), help="Backend API base URL")
    args = parser.parse_args()

    agent = PaymentAgent(owner=args.owner, api_base=args.api)
    out = agent.process_instruction(args.instruction)
    print(json.dumps(out, indent=2))
