import { Clarinet, Tx, Chain, Account, types } from "clarinet";

Clarinet.test({
  name: "setup: init contracts, register agent, set limits and rules",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const agent = accounts.get("wallet_1")!;
    const recipient = accounts.get("wallet_2")!;

    // init contracts
    let block = chain.mineBlock([
      Tx.contractCall("agent-manager", "init-contract", [types.principal(deployer.address)], deployer.address),
      Tx.contractCall("payment-processor", "init-contract", [types.principal(deployer.address)], deployer.address),
    ]);
    block.receipts[0].result.expectOk();
    block.receipts[1].result.expectOk();

    // register agent and limits
    block = chain.mineBlock([
      Tx.contractCall(
        "agent-manager",
        "register-agent",
        [types.principal(agent.address), types.list([types.ascii("pay")])],
        agent.address
      ),
      Tx.contractCall(
        "agent-manager",
        "set-spending-limit",
        [types.principal(agent.address), types.uint(200), types.uint(1000)],
        agent.address
      ),
    ]);
    block.receipts[0].result.expectOk();
    block.receipts[1].result.expectOk();

    // update rules with whitelist and max-amount 150
    block = chain.mineBlock([
      Tx.contractCall(
        "payment-processor",
        "update-payment-rules",
        [types.principal(agent.address), types.uint(150), types.list([types.principal(recipient.address)])],
        deployer.address
      ),
    ]);
    block.receipts[0].result.expectOk();

    // authorize agent
    block = chain.mineBlock([
      Tx.contractCall("agent-manager", "authorize-agent", [types.principal(agent.address)], agent.address),
    ]);
    block.receipts[0].result.expectOk();

    // happy path payment: from agent to recipient 100 uSTX
    block = chain.mineBlock([
      Tx.contractCall(
        "payment-processor",
        "execute-payment",
        [types.principal(agent.address), types.principal(recipient.address), types.uint(100), types.some(types.ascii("inv#1"))],
        agent.address
      ),
    ]);
    block.receipts[0].result.expectOk();

    // rate limit: immediate second transfer should fail due to RATE-LIMIT-BLOCKS
    block = chain.mineBlock([
      Tx.contractCall(
        "payment-processor",
        "execute-payment",
        [types.principal(agent.address), types.principal(recipient.address), types.uint(10), types.none()],
        agent.address
      ),
    ]);
    block.receipts[0].result.expectErr().expectUint(210);
  },
});

Clarinet.test({
  name: "limits: daily/monthly enforced; whitelist and max-amount (multisig gate)",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const agent = accounts.get("wallet_3")!;
    const allow = accounts.get("wallet_4")!;
    const deny = accounts.get("wallet_5")!;

    chain.mineBlock([
      Tx.contractCall("agent-manager", "init-contract", [types.principal(deployer.address)], deployer.address),
      Tx.contractCall("payment-processor", "init-contract", [types.principal(deployer.address)], deployer.address),
    ]);

    chain.mineBlock([
      Tx.contractCall("agent-manager", "register-agent", [types.principal(agent.address), types.list([types.ascii("pay")])], agent.address),
      Tx.contractCall("agent-manager", "authorize-agent", [types.principal(agent.address)], agent.address),
      Tx.contractCall("agent-manager", "set-spending-limit", [types.principal(agent.address), types.uint(120), types.uint(150)], agent.address),
      Tx.contractCall("payment-processor", "update-payment-rules", [types.principal(agent.address), types.uint(60), types.list([types.principal(allow.address)])], deployer.address),
    ]);

    // over max-amount triggers multisig-required
    let block = chain.mineBlock([
      Tx.contractCall("payment-processor", "execute-payment", [types.principal(agent.address), types.principal(allow.address), types.uint(70), types.none()], agent.address),
    ]);
    block.receipts[0].result.expectErr().expectUint(211);

    // recipient not in whitelist
    block = chain.mineBlock([
      Tx.contractCall("payment-processor", "execute-payment", [types.principal(agent.address), types.principal(deny.address), types.uint(10), types.none()], agent.address),
    ]);
    block.receipts[0].result.expectErr().expectUint(207);

    // wait a few blocks to bypass rate limit and spend up to daily limit
    chain.mineEmptyBlock(6);

    block = chain.mineBlock([
      Tx.contractCall("payment-processor", "execute-payment", [types.principal(agent.address), types.principal(allow.address), types.uint(60), types.none()], agent.address),
    ]);
    block.receipts[0].result.expectOk();

    // Same day would exceed daily 120 if we try another 70 (exceeds 120)
    chain.mineEmptyBlock(6);
    block = chain.mineBlock([
      Tx.contractCall("payment-processor", "execute-payment", [types.principal(agent.address), types.principal(allow.address), types.uint(70), types.none()], agent.address),
    ]);
    block.receipts[0].result.expectErr().expectUint(208);
  },
});

Clarinet.test({
  name: "halting and history: emergency halt blocks, resume allows; history lists entries",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const agent = accounts.get("wallet_6")!;
    const r1 = accounts.get("wallet_7")!;

    chain.mineBlock([
      Tx.contractCall("agent-manager", "init-contract", [types.principal(deployer.address)], deployer.address),
      Tx.contractCall("payment-processor", "init-contract", [types.principal(deployer.address)], deployer.address),
      Tx.contractCall("agent-manager", "register-agent", [types.principal(agent.address), types.list([types.ascii("pay")])], agent.address),
      Tx.contractCall("agent-manager", "authorize-agent", [types.principal(agent.address)], agent.address),
      Tx.contractCall("agent-manager", "set-spending-limit", [types.principal(agent.address), types.uint(1_000), types.uint(10_000)], agent.address),
      Tx.contractCall("payment-processor", "update-payment-rules", [types.principal(agent.address), types.uint(1_000), types.list([types.principal(r1.address)])], deployer.address),
    ]);

    // halt
    let block = chain.mineBlock([
      Tx.contractCall("payment-processor", "emergency-halt-payments", [types.principal(agent.address)], deployer.address),
    ]);
    block.receipts[0].result.expectOk();

    // attempt during halt
    block = chain.mineBlock([
      Tx.contractCall("payment-processor", "execute-payment", [types.principal(agent.address), types.principal(r1.address), types.uint(10), types.none()], agent.address),
    ]);
    block.receipts[0].result.expectErr().expectUint(204);

    // resume
    block = chain.mineBlock([
      Tx.contractCall("payment-processor", "resume-payments", [types.principal(agent.address)], deployer.address),
    ]);
    block.receipts[0].result.expectOk();

    // wait to bypass rate limit and pay
    chain.mineEmptyBlock(6);
    block = chain.mineBlock([
      Tx.contractCall("payment-processor", "execute-payment", [types.principal(agent.address), types.principal(r1.address), types.uint(10), types.some(types.ascii("ok"))], agent.address),
    ]);
    block.receipts[0].result.expectOk();

    // history (request up to 5)
    const hist = chain.callReadOnlyFn("payment-processor", "get-payment-history", [types.principal(agent.address), types.uint(5)], agent.address);
    hist.result.expectList();
  },
});
