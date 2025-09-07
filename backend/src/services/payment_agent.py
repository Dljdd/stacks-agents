"""
 payment_agent.py
 Mirror module for payment-agent.py enabling Pythonic imports (hyphen not allowed in module names).
 See payment-agent.py for the CLI entrypoint. Both files contain identical implementations.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import requests
from pydantic import BaseModel, Field, ValidationError, conint, constr
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

try:
    import websockets  # type: ignore
except Exception:  # pragma: no cover
    websockets = None

try:
    import openai  # type: ignore
except Exception:  # pragma: no cover
    openai = None

logger = logging.getLogger("payment-agent")
logger.setLevel(logging.INFO)
_handler = logging.StreamHandler()
_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
logger.addHandler(_handler)


class PaymentIntent(BaseModel):
    action: constr(strip_whitespace=True) = Field(...)
    amount: conint(ge=0) = Field(...)
    currency: constr(strip_whitespace=True) = Field("uSTX")
    recipient: constr(strip_whitespace=True) = Field(...)
    memo: Optional[str] = Field(None, max_length=200)


class DecisionOutcome(BaseModel):
    authorize: bool
    reason: str
    risk_score: int = 0
    action: str = "allow"


class NLPProcessor:
    def __init__(self, model: str = "gpt-4o-mini") -> None:
        self.model = model
        if openai and os.getenv("OPENAI_API_KEY"):
            openai.api_key = os.getenv("OPENAI_API_KEY")

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=0.5, min=0.5, max=4))
    def parse_instruction(self, text: str) -> PaymentIntent:
        text = text.strip()
        if openai and os.getenv("OPENAI_API_KEY"):
            try:
                prompt = (
                    "Extract a structured payment intent as JSON with keys: action, amount, currency, recipient, memo. "
                    "Only output JSON.\n"
                    f"Instruction: {text}"
                )
                resp = openai.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.2,
                )
                content = resp.choices[0].message.content  # type: ignore
                data = json.loads(content)
                return PaymentIntent(**data)
            except Exception as e:
                logger.warning("LLM parse failed, using heuristics", extra={"error": str(e)})
        amt_micro = 0
        m = re.search(r"(\d+\.\d+|\d+)\s*(stx|ustx)?", text, flags=re.I)
        if m:
            val = float(m.group(1))
            unit = (m.group(2) or "stx").lower()
            amt_micro = int(round(val * 1_000_000)) if unit == "stx" else int(round(val))
        rec = None
        # Accept realistic principals and shorter dummy ones used in tests
        rm = re.search(r"(S[PQ][0-9A-Z]{6,})", text)
        if rm:
            rec = rm.group(1)
        memo = None
        mm = re.search(r"(?:for|because|memo)\s*[:\-]?\s*(.{3,200})", text, flags=re.I)
        if mm:
            memo = mm.group(1).strip()
        return PaymentIntent(action="pay", amount=max(amt_micro, 0), currency="uSTX", recipient=rec or "unknown", memo=memo)


class RiskAssessor:
    def __init__(self, risk_api_base: Optional[str] = None) -> None:
        self.risk_api_base = risk_api_base

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=0.5, min=0.5, max=4))
    def assess(self, agent_id: str, intent: PaymentIntent, history: List[Dict[str, Any]]) -> Dict[str, Any]:
        score = 0
        reasons: List[str] = []
        vals = [h.get("amount", 0) for h in history if isinstance(h.get("amount", 0), (int, float))]
        avg = (sum(vals) / len(vals)) if vals else 0
        if avg and intent.amount > 3 * avg:
            score += 30
            reasons.append("amount_spike")
        if not any(h.get("recipient") == intent.recipient for h in history):
            score += 10
            reasons.append("new_recipient")
        if intent.amount > 10_000_000_000:
            score += 20
            reasons.append("large_amount")
        if self.risk_api_base:
            try:
                r = requests.post(f"{self.risk_api_base}/risk", json={"agentId": agent_id, "recipient": intent.recipient, "amount": intent.amount}, timeout=5)
                if r.ok and isinstance(r.json().get("riskScore"), (int, float)):
                    score += int(r.json()["riskScore"])  # type: ignore
                    reasons.append("external_risk")
            except Exception as e:
                logger.warning("external risk failed", extra={"error": str(e)})
        return {"score": score, "reasons": reasons, "block": score >= 70}


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
        r = requests.post(f"{self.api_base}/rules/test", json={"agentId": agent_id, "paymentData": {"amount": amount}}, timeout=8)
        if not r.ok:
            logger.info("rules test endpoint not available; assuming allow")
            return {"action": "allow"}
        return r.json()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=0.5, min=0.5, max=4), reraise=True)
    def enqueue_payment(self, agent_id: str, recipient: str, amount: int, memo: Optional[str] = None) -> Dict[str, Any]:
        r = requests.post(f"{self.api_base}/payments", json={"token": "", "agentId": agent_id, "recipient": recipient, "amount": amount, "memo": memo or ""}, timeout=8)
        r.raise_for_status()
        return r.json()


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


class DecisionEngine:
    def __init__(self, connector: BlockchainConnector) -> None:
        self.connector = connector

    def decide(self, agent_id: str, intent: 'PaymentIntent', risk: Dict[str, Any]) -> DecisionOutcome:
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
        try:
            res = self.initiate_payment(agent_id, intent)
            self.context.record_payment({"ts": int(time.time() * 1000), "agentId": agent_id, "recipient": intent.recipient, "amount": intent.amount, "jobId": res.get("jobId")})
            return {"ok": True, "authorized": True, "jobId": res.get("jobId"), "queued": res.get("queued", False)}
        except Exception as e:
            logger.error("enqueue failed", extra={"error": str(e)})
            return {"ok": False, "error": "enqueue_failed", "details": str(e)}
