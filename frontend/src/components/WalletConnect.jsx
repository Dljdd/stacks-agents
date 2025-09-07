import React, { useState, useEffect } from 'react';
import { getUserSession, isSignedIn, connectWithLeatherFirst, getAgentAddress } from '../utils/walletSession';

const WalletConnect = ({ onWalletConnected, onWalletDisconnected }) => {
  const [userData, setUserData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const us = getUserSession();
    if (us.isSignInPending()) {
      us.handlePendingSignIn().then((ud) => {
        setUserData(ud);
        setIsConnected(true);
        onWalletConnected && onWalletConnected(ud);
      });
    } else if (isSignedIn()) {
      const ud = us.loadUserData();
      setUserData(ud);
      setIsConnected(true);
      onWalletConnected && onWalletConnected(ud);
    }
  }, [onWalletConnected]);

  const handleConnect = async () => {
    const result = await connectWithLeatherFirst({ network: 'testnet' });
    const us = getUserSession();
    const ud = us.loadUserData?.() || null;
    setUserData(ud);
    setIsConnected(Boolean(result.ok || ud));
    if (result.ok || ud) onWalletConnected && onWalletConnected(ud || { address: result.address });
  };

  const disconnectWallet = () => {
    const us = getUserSession();
    us.signUserOut('/');
    setUserData(null);
    setIsConnected(false);
    onWalletDisconnected();
  };

  const getShortAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="wallet-connect">
      {!isConnected ? (
        <button onClick={handleConnect} className="btn btn-primary wallet-btn">
          🔗 Connect Leather Wallet
        </button>
      ) : (
        <div className="wallet-connected">
          <div className="wallet-info">
            <span className="wallet-address">
              🟢 {getShortAddress(getAgentAddress({ network: 'testnet' }))}
            </span>
            <button onClick={disconnectWallet} className="btn btn-secondary btn-sm">
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletConnect;
