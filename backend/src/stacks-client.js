import {
  callReadOnlyFunction,
  cvToJSON,
  standardPrincipalCV,
  uintCV,
} from '@stacks/transactions';
import { StacksTestnet, StacksMainnet } from '@stacks/network';

export class StacksClient {
  constructor(config) {
    this.network = config.network === 'mainnet' 
      ? new StacksMainnet({ url: config.apiUrl })
      : new StacksTestnet({ url: config.apiUrl });
    
    this.agentManagerContract = config.agentManagerContract; // e.g., ST...agent-manager2
    this.rulesEngineContract = config.rulesEngineContract;   // e.g., ST...rules-engine
    this.paymentProcessorContract = config.paymentProcessorContract; // e.g., ST...payment-processor
    this.readOnlySender = config.readOnlySender || 'ST000000000000000000002AMW42H';
  }

  async getPaymentDetails(paymentId) {
    try {
      const { contractAddress, contractName } = this.parseContractId(this.paymentProcessorContract);
      const result = await callReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'get-payment-details',
        functionArgs: [uintCV(paymentId)],
        network: this.network,
        senderAddress: this.readOnlySender,
      });

      const json = cvToJSON(result);
      return json.value || null;
    } catch (error) {
      console.error('Error getting payment details:', error);
      return null;
    }
  }

  parseContractId(contractId) {
    const [contractAddress, contractName] = contractId.split('.');
    return { contractAddress, contractName };
  }

  // NOTE: All mutating transactions must be signed client-side.
  // This backend only provides read-only helpers and payload builders if needed.

  async getAgentInfo(agentId) {
    try {
      const { contractAddress, contractName } = this.parseContractId(this.agentManagerContract);
      const result = await callReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'get-agent-info',
        functionArgs: [standardPrincipalCV(agentId)],
        network: this.network,
        senderAddress: this.readOnlySender,
      });

      const jsonResult = cvToJSON(result);
      return jsonResult.value ? {
        owner: jsonResult.value.owner.value,
        permissions: jsonResult.value.permissions.value.map(p => p.value),
        dailyLimit: parseInt(jsonResult.value['daily-limit'].value),
        monthlyLimit: parseInt(jsonResult.value['monthly-limit'].value),
        active: jsonResult.value.active.value,
        authorized: jsonResult.value.authorized.value
      } : null;
    } catch (error) {
      console.error('Error getting agent info:', error);
      return null;
    }
  }

  async updatePermissions(agentId, permissions, limits) {
    throw new Error('updatePermissions must be executed client-side via wallet signing');
  }

  async updatePaymentRules(agentId, maxAmount, allowedRecipients) {
    throw new Error('updatePaymentRules must be executed client-side via wallet signing');
  }

  async executePayment(agentId, recipient, amount, memo) {
    throw new Error('executePayment must be executed client-side via wallet signing');
  }

  async getPaymentHistory(agentId, limit = 20) {
    try {
      const { contractAddress, contractName } = this.parseContractId(this.paymentProcessorContract);
      // Try get-payment-history-flat(agent) first; fallback to get-payment-history(agent, limit)
      let result;
      try {
        result = await callReadOnlyFunction({
          contractAddress,
          contractName,
          functionName: 'get-payment-history-flat',
          functionArgs: [standardPrincipalCV(agentId)],
          network: this.network,
          senderAddress: this.readOnlySender,
        });
        const jsonFlat = cvToJSON(result);
        // Expect a list of uint IDs
        if (Array.isArray(jsonFlat.value)) {
          return jsonFlat.value.map(v => parseInt(v.value));
        }
      } catch (_) {}

      result = await callReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'get-payment-history',
        functionArgs: [standardPrincipalCV(agentId), uintCV(limit)],
        network: this.network,
        senderAddress: this.readOnlySender,
      });

      const jsonResult = cvToJSON(result);
      return jsonResult.value.map(item => ({
        recipient: item.value.recipient.value,
        amount: parseInt(item.value.amount.value),
        success: item.value.success.value,
        block: parseInt(item.value.block.value),
        memo: item.value.memo.value ? item.value.memo.value.value : null
      }));
    } catch (error) {
      console.error('Error getting payment history:', error);
      return [];
    }
  }

  async validatePaymentRules(agentId, amount) {
    try {
      const { contractAddress, contractName } = this.parseContractId(this.rulesEngineContract || this.paymentProcessorContract);
      // Prefer rules engine validate-payment if available; fallback not attempted here
      const result = await callReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'validate-payment',
        functionArgs: [standardPrincipalCV(agentId), standardPrincipalCV(agentId), uintCV(amount)],
        network: this.network,
        senderAddress: this.readOnlySender,
      });

      const jsonResult = cvToJSON(result);
      return jsonResult.success;
    } catch (error) {
      console.error('Error validating payment rules:', error);
      return false;
    }
  }

  async isAgentAuthorized(agentId) {
    try {
      const { contractAddress, contractName } = this.parseContractId(this.agentManagerContract);
      const result = await callReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'is-agent-authorized',
        functionArgs: [standardPrincipalCV(agentId)],
        network: this.network,
        senderAddress: this.readOnlySender,
      });

      const jsonResult = cvToJSON(result);
      return jsonResult.value;
    } catch (error) {
      console.error('Error checking agent authorization:', error);
      return false;
    }
  }
}
