import { openContractCall } from '@stacks/connect';
import { uintCV, principalCV, someCV, noneCV, stringAsciiCV } from '@stacks/transactions';

function parseContractId(contractId) {
  const [contractAddress, contractName] = contractId.split('.');
  return { contractAddress, contractName };
}

export async function signExecutePayment(signingPayload, { onFinish, onCancel } = {}) {
  if (!signingPayload || !signingPayload.contractId || !Array.isArray(signingPayload.args)) {
    throw new Error('Invalid signing payload');
  }
  const { contractAddress, contractName } = parseContractId(signingPayload.contractId);
  const [agent, recipient, amount, memo] = signingPayload.args;

  await openContractCall({
    contractAddress,
    contractName,
    functionName: 'execute-payment',
    functionArgs: [
      principalCV(agent),
      principalCV(recipient),
      uintCV(Number(amount)),
      memo ? someCV(stringAsciiCV(String(memo))) : noneCV(),
    ],
    // Use simple network object for compatibility across wallet versions
    network: { coreApiUrl: 'https://api.testnet.hiro.so' },
    appDetails: { name: 'Stacks AI Payment Agents' },
    onFinish: (data) => {
      if (onFinish) onFinish(data);
    },
    onCancel: () => {
      if (onCancel) onCancel();
    },
  });
}
