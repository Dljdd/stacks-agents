import json
import types
import unittest
from unittest.mock import patch

from payment_agent import NLPProcessor, PaymentAgent, PaymentIntent, DecisionEngine, RiskAssessor, BlockchainConnector


class FakeConnector(BlockchainConnector):
    def __init__(self):
        super().__init__(api_base="http://example.com/api")
        self.enqueued = []

    def recent_payments(self, owner: str, agent_id=None):
        return [
            {"amount": 500000, "recipient": "SP2C2K8T3Z7XXYYZZ", "ts": 1},
            {"amount": 600000, "recipient": "SP2C2K8T3Z7XXYYZZ", "ts": 2},
        ]

    def validate_rules(self, agent_id: str, amount: int):
        return {"action": "allow"}

    def enqueue_payment(self, agent_id: str, recipient: str, amount: int, memo=None):
        self.enqueued.append({"agentId": agent_id, "recipient": recipient, "amount": amount, "memo": memo})
        return {"queued": True, "jobId": "job-123"}


class TestNLP(unittest.TestCase):
    def test_heuristic_parse(self):
        nlp = NLPProcessor()
        intent = nlp.parse_instruction("Send 1.5 STX to SP2C2K8T3Z7XXYYZZ for hosting")
        self.assertIsInstance(intent, PaymentIntent)
        self.assertEqual(intent.amount, 1500000)
        self.assertEqual(intent.recipient[:2], "SP")
        self.assertIn("hosting", intent.memo or "")


class TestDecision(unittest.TestCase):
    def test_decision_allows_when_low_risk(self):
        conn = FakeConnector()
        engine = DecisionEngine(connector=conn)
        risk = {"score": 10, "block": False}
        intent = PaymentIntent(action="pay", amount=100000, currency="uSTX", recipient="SP2C2K8T3Z7XXYYZZ")
        out = engine.decide("AG1", intent, risk)
        self.assertTrue(out.authorize)

    def test_decision_blocks_when_rules(self):
        class BlockConn(FakeConnector):
            def validate_rules(self, agent_id, amount):
                return {"action": "block"}
        engine = DecisionEngine(connector=BlockConn())
        risk = {"score": 0, "block": False}
        intent = PaymentIntent(action="pay", amount=100000, currency="uSTX", recipient="SP2C2K8T3Z7XXYYZZ")
        out = engine.decide("AG1", intent, risk)
        self.assertFalse(out.authorize)
        self.assertEqual(out.action, "block")


class TestAgentFlow(unittest.TestCase):
    def test_end_to_end_enqueue(self):
        agent = PaymentAgent(owner="SPOWNER")
        # Inject fake connector
        agent.connector = FakeConnector()
        agent.decision = DecisionEngine(agent.connector)
        agent.risk = RiskAssessor()
        # ensure stable risk assessment
        agent.risk.assess = lambda agent_id, intent, history: {"score": 0, "block": False}

        out = agent.process_instruction("Send 0.2 STX to SP2C2K8T3Z7XXYYZZ for test")
        self.assertTrue(out.get("ok"))
        self.assertTrue(out.get("authorized"))
        self.assertEqual(out.get("jobId"), "job-123")

    def test_memo_length_validation(self):
        agent = PaymentAgent(owner="SPOWNER")
        agent.connector = FakeConnector()
        agent.decision = DecisionEngine(agent.connector)
        agent.risk = RiskAssessor()
        long_memo = "x" * 500
        intent = agent.nlp.parse_instruction(f"Send 1 STX to SP2C2K8T3Z7XXYYZZ for {long_memo}")
        # Pydantic will allow memo but we can truncate before enqueue if needed; ensure enqueue still works
        out = agent.process_instruction(f"Send 1 STX to SP2C2K8T3Z7XXYYZZ for {long_memo}")
        self.assertTrue(out.get("ok"))


if __name__ == "__main__":
    unittest.main()
