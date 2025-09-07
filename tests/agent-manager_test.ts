import { Clarinet, Tx, Chain, Account, types } from "clarinet";
import { assertEquals, assertNotEquals } from "https://deno.land/std@0.90.0/testing/asserts.ts";

Clarinet.test({
  name: "init-contract: sets admin once and prevents re-init",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    let block = chain.mineBlock([
      Tx.contractCall("agent-manager", "init-contract", [types.principal(deployer.address)], deployer.address),
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    // second init should fail
    block = chain.mineBlock([
      Tx.contractCall("agent-manager", "init-contract", [types.principal(wallet1.address)], wallet1.address),
    ]);
    block.receipts[0].result.expectErr().expectUint(101);
  },
});

Clarinet.test({
  name: "register-agent: owner set, permissions stored, duplicate prevented",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    chain.mineBlock([
      Tx.contractCall("agent-manager", "init-contract", [types.principal(deployer.address)], deployer.address),
    ]);

    const perms = types.list([types.ascii("pay"), types.ascii("read")]);

    let block = chain.mineBlock([
      Tx.contractCall("agent-manager", "register-agent", [types.principal(wallet1.address), perms], wallet1.address),
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    // verify get-agent-info
    const info = chain.callReadOnlyFn("agent-manager", "get-agent-info", [types.principal(wallet1.address)], wallet1.address);
    const opt = info.result.expectSome();
    opt.expectTuple()["owner"].expectPrincipal(wallet1.address);
    opt.expectTuple()["permissions"].expectList().length === 2;
    opt.expectTuple()["authorized"].expectBool(false);
    opt.expectTuple()["active"].expectBool(true);

    // duplicate registration
    block = chain.mineBlock([
      Tx.contractCall("agent-manager", "register-agent", [types.principal(wallet1.address), perms], wallet1.address),
    ]);
    block.receipts[0].result.expectErr().expectUint(103);
  },
});

Clarinet.test({
  name: "authorize/deauthorize: only admin or owner, toggles flag",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;
    const wallet2 = accounts.get("wallet_2")!;

    chain.mineBlock([
      Tx.contractCall("agent-manager", "init-contract", [types.principal(deployer.address)], deployer.address),
      Tx.contractCall("agent-manager", "register-agent", [types.principal(wallet1.address), types.list([types.ascii("pay")])], wallet1.address),
    ]);

    // unauthorized caller cannot authorize
    let block = chain.mineBlock([
      Tx.contractCall("agent-manager", "authorize-agent", [types.principal(wallet1.address)], wallet2.address),
    ]);
    block.receipts[0].result.expectErr().expectUint(102);

    // owner authorizes
    block = chain.mineBlock([
      Tx.contractCall("agent-manager", "authorize-agent", [types.principal(wallet1.address)], wallet1.address),
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    // check flag
    let auth = chain.callReadOnlyFn("agent-manager", "is-agent-authorized", [types.principal(wallet1.address)], wallet1.address);
    auth.result.expectBool(true);

    // admin deauthorizes
    block = chain.mineBlock([
      Tx.contractCall("agent-manager", "deauthorize-agent", [types.principal(wallet1.address)], deployer.address),
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    auth = chain.callReadOnlyFn("agent-manager", "is-agent-authorized", [types.principal(wallet1.address)], wallet1.address);
    auth.result.expectBool(false);
  },
});

Clarinet.test({
  name: "update-permissions: admin or owner, bounds enforced",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    chain.mineBlock([
      Tx.contractCall("agent-manager", "init-contract", [types.principal(deployer.address)], deployer.address),
      Tx.contractCall("agent-manager", "register-agent", [types.principal(wallet1.address), types.list([types.ascii("a")])], wallet1.address),
    ]);

    // too many permissions (11)
    const tooMany = types.list([
      types.ascii("1"), types.ascii("2"), types.ascii("3"), types.ascii("4"), types.ascii("5"),
      types.ascii("6"), types.ascii("7"), types.ascii("8"), types.ascii("9"), types.ascii("10"), types.ascii("11"),
    ]);

    let block = chain.mineBlock([
      Tx.contractCall("agent-manager", "update-permissions", [types.principal(wallet1.address), tooMany], wallet1.address),
    ]);
    block.receipts[0].result.expectErr().expectUint(105);

    // valid update by admin
    const newPerms = types.list([types.ascii("pay"), types.ascii("read")]);
    block = chain.mineBlock([
      Tx.contractCall("agent-manager", "update-permissions", [types.principal(wallet1.address), newPerms], deployer.address),
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    const info = chain.callReadOnlyFn("agent-manager", "get-agent-info", [types.principal(wallet1.address)], wallet1.address);
    const tuple = info.result.expectSome().expectTuple();
    tuple["permissions"].expectList().length === 2;
  },
});

Clarinet.test({
  name: "set-spending-limit: enforces monthly >= daily, updates values",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    chain.mineBlock([
      Tx.contractCall("agent-manager", "init-contract", [types.principal(deployer.address)], deployer.address),
      Tx.contractCall("agent-manager", "register-agent", [types.principal(wallet1.address), types.list([types.ascii("pay")])], wallet1.address),
    ]);

    // invalid: monthly < daily
    let block = chain.mineBlock([
      Tx.contractCall("agent-manager", "set-spending-limit", [types.principal(wallet1.address), types.uint(200), types.uint(100)], wallet1.address),
    ]);
    block.receipts[0].result.expectErr().expectUint(105);

    // valid set by owner
    block = chain.mineBlock([
      Tx.contractCall("agent-manager", "set-spending-limit", [types.principal(wallet1.address), types.uint(100), types.uint(1000)], wallet1.address),
    ]);
    block.receipts[0].result.expectOk().expectBool(true);

    const info = chain.callReadOnlyFn("agent-manager", "get-agent-info", [types.principal(wallet1.address)], wallet1.address);
    const tuple = info.result.expectSome().expectTuple();
    tuple["daily-limit"].expectUint(100);
    tuple["monthly-limit"].expectUint(1000);
  },
});

Clarinet.test({
  name: "access control: non-owner non-admin cannot mutate",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const owner = accounts.get("wallet_1")!;
    const stranger = accounts.get("wallet_2")!;

    chain.mineBlock([
      Tx.contractCall("agent-manager", "init-contract", [types.principal(deployer.address)], deployer.address),
      Tx.contractCall("agent-manager", "register-agent", [types.principal(owner.address), types.list([types.ascii("p")])], owner.address),
    ]);

    let block = chain.mineBlock([
      Tx.contractCall("agent-manager", "set-spending-limit", [types.principal(owner.address), types.uint(1), types.uint(2)], stranger.address),
    ]);
    block.receipts[0].result.expectErr().expectUint(102);

    block = chain.mineBlock([
      Tx.contractCall("agent-manager", "update-permissions", [types.principal(owner.address), types.list([types.ascii("x")])], stranger.address),
    ]);
    block.receipts[0].result.expectErr().expectUint(102);
  },
});
