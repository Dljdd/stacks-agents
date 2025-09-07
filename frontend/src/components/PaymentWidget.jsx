import React, { useState } from 'react';
import { showConnect, openContractCall } from '@stacks/connect';
import { principalCV, uintCV, stringAsciiCV } from '@stacks/transactions';

// NOTE: We intentionally avoid importing StacksTestnet due to previous bundling issues.
// Using a plain network object is broadly compatible with Leather/Hiro.
const NETWORK = { coreApiUrl: 'https://api.testnet.hiro.so' };

// Default contract values; will be overridden if provided via props
const DEFAULT_CONTRACT_ADDRESS = 'ST23Z1N1XD66CM151FM7NFPJ1VXPE6RT51XH4CG7';
const DEFAULT_CONTRACT_NAME = 'payment-processor-1';

export default function PaymentWidget({
  contractAddress = DEFAULT_CONTRACT_ADDRESS,
  contractName = DEFAULT_CONTRACT_NAME,
  appName = 'StacksPay',
}) {
  const [walletConnected, setWalletConnected] = useState(false);
  const [stxAddress, setStxAddress] = useState('');
  const [amount, setAmount] = useState(''); // microSTX
  const [recipient, setRecipient] = useState('');
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);

  const extractAddr = (res) => (
    res?.addresses?.stacks?.testnet?.[0]?.address ||
    res?.addresses?.stacks?.mainnet?.[0]?.address ||
    res?.stacks?.testnet?.[0]?.address ||
    res?.stacks?.mainnet?.[0]?.address ||
    res?.addresses?.[0]?.address || ''
  );

  // Try Leather RPC, fallback to showConnect
  const connectWallet = async () => {
    const provider = typeof window !== 'undefined' && (window.LeatherProvider || window.StacksProvider);
    if (provider?.request) {
      try {
        const res = await provider.request('getAddresses');
        const addr = extractAddr(res);
        if (addr && addr.startsWith('S')) {
          setStxAddress(addr);
          setWalletConnected(true);
          return;
        }
      } catch (e) {
        // fall through to showConnect
      }
    }
    showConnect({
      appDetails: { name: appName, icon: '/logo.png' },
      redirectTo: window.location.href,
      onFinish: () => window.location.reload(),
      onCancel: () => {},
    });
  };

  // Payment: call contract using wallet
  const handlePayment = async () => {
    // basic validation
    const amountNum = Number(amount);
    if (!walletConnected) {
      alert('Please connect wallet first.');
      return;
    }
    if (!recipient || !recipient.startsWith('ST')) {
      alert('Enter a valid recipient STX address.');
      return;
    }
    if (!Number.isInteger(amountNum) || amountNum <= 0) {
      alert('Amount must be a positive integer in microSTX (no decimals).');
      return;
    }

    setLoading(true);
    await openContractCall({
      contractAddress,
      contractName,
      functionName: 'execute-payment',
      functionArgs: [
        principalCV(stxAddress),
        principalCV(recipient),
        uintCV(amountNum),
        memo ? stringAsciiCV(memo) : stringAsciiCV(''),
      ],
      network: NETWORK,
      appDetails: { name: appName, icon: '/logo.png' },
      onFinish: (payload) => {
        alert('Payment submitted! TXID: ' + payload?.txId);
        setLoading(false);
      },
      onCancel: () => {
        alert('Transaction cancelled.');
        setLoading(false);
      },
    });
  };

  return (
    <div style={{maxWidth: 480, margin: '24px auto', padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 12, background: '#fff'}}>
      <h3 style={{ marginTop: 0 }}>Quick Payment</h3>
      <button onClick={connectWallet} disabled={walletConnected} style={{marginBottom: 12}}>
        {walletConnected ? `Wallet: ${stxAddress.slice(0, 8)}...` : 'Connect Wallet'}
      </button>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handlePayment();
        }}
        style={{display: 'flex', flexDirection: 'column', gap: 12}}
      >
        <input
          type="number"
          placeholder="Amount (microSTX)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="1"
          required
        />
        <input
          type="text"
          placeholder="Recipient Address"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Memo (optional)"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading || !walletConnected}
          style={{background: '#635bff', color: '#fff', padding: 10, border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer'}}
        >
          {loading ? 'Processing...' : 'Process Payment'}
        </button>
      </form>
    </div>
  );
}
