import React, { useState } from 'react';
import { openContractCall } from '@stacks/connect';
import { StacksTestnet } from '@stacks/network';
import { 
  standardPrincipalCV, 
  stringAsciiCV, 
  listCV,
  PostConditionMode 
} from '@stacks/transactions';

const network = new StacksTestnet();

const WalletTransactions = ({ userSession, contractAddress }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastTxId, setLastTxId] = useState(null);

  const registerAgent = async (agentId, permissions = ['stx:transfer']) => {
    if (!userSession?.isUserSignedIn()) {
      alert('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    try {
      const functionArgs = [
        standardPrincipalCV(agentId)
      ];

      await openContractCall({
        network,
        contractAddress: contractAddress.split('.')[0],
        contractName: contractAddress.split('.')[1],
        functionName: 'register-agent',
        functionArgs,
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          console.log('Transaction submitted:', data.txId);
          setLastTxId(data.txId);
          setIsLoading(false);
        },
        onCancel: () => {
          console.log('Transaction cancelled');
          setIsLoading(false);
        },
      });
    } catch (error) {
      console.error('Transaction failed:', error);
      setIsLoading(false);
    }
  };

  const authorizeAgent = async (agentId) => {
    if (!userSession?.isUserSignedIn()) {
      alert('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    try {
      const functionArgs = [
        standardPrincipalCV(agentId)
      ];

      await openContractCall({
        network,
        contractAddress: contractAddress.split('.')[0],
        contractName: contractAddress.split('.')[1],
        functionName: 'authorize-agent',
        functionArgs,
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          console.log('Authorization submitted:', data.txId);
          setLastTxId(data.txId);
          setIsLoading(false);
        },
        onCancel: () => {
          console.log('Authorization cancelled');
          setIsLoading(false);
        },
      });
    } catch (error) {
      console.error('Authorization failed:', error);
      setIsLoading(false);
    }
  };

  const initializeContract = async (ownerAddress) => {
    if (!userSession?.isUserSignedIn()) {
      alert('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    try {
      const functionArgs = [
        standardPrincipalCV(ownerAddress)
      ];

      await openContractCall({
        network,
        contractAddress: contractAddress.split('.')[0],
        contractName: contractAddress.split('.')[1],
        functionName: 'init-contract',
        functionArgs,
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          console.log('Contract initialized:', data.txId);
          setLastTxId(data.txId);
          setIsLoading(false);
        },
        onCancel: () => {
          console.log('Initialization cancelled');
          setIsLoading(false);
        },
      });
    } catch (error) {
      console.error('Initialization failed:', error);
      setIsLoading(false);
    }
  };

  return {
    registerAgent,
    authorizeAgent,
    initializeContract,
    isLoading,
    lastTxId
  };
};

export default WalletTransactions;
