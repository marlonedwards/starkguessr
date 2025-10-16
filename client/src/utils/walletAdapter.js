/**
 * Wallet Adapter for starknetkit v3
 * Creates a proper Account-like object that uses the wallet's request method
 */

export class WalletAdapter {
  constructor(wallet, address, provider) {
    this.wallet = wallet;
    this.address = address;
    this.provider = provider;
  }

  async execute(calls) {
    // Normalize to array
    const callsArray = Array.isArray(calls) ? calls : [calls];

    // Use wallet's request method to execute the transaction
    // This will trigger the wallet UI and use V3 transactions
    const result = await this.wallet.request({
      type: 'wallet_addInvokeTransaction',
      params: {
        calls: callsArray.map(call => ({
          contract_address: call.contractAddress,
          entry_point: call.entrypoint,
          calldata: call.calldata
        }))
      }
    });

    return {
      transaction_hash: result.transaction_hash
    };
  }

  async waitForTransaction(txHash) {
    // Poll for transaction status
    let receipt = null;
    let attempts = 0;
    const maxAttempts = 60; // 60 attempts * 5 seconds = 5 minutes max

    while (!receipt && attempts < maxAttempts) {
      try {
        receipt = await this.provider.getTransactionReceipt(txHash);
        if (receipt) {
          return receipt;
        }
      } catch (error) {
        // Transaction not found yet, continue polling
      }

      // Wait 5 seconds before next attempt
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }

    if (!receipt) {
      throw new Error('Transaction confirmation timeout');
    }

    return receipt;
  }

  // Read-only contract call
  async callContract(call, blockIdentifier = 'pending') {
    return this.provider.callContract(call, blockIdentifier);
  }

  // Get nonce
  async getNonce(blockIdentifier) {
    return this.provider.getNonceForAddress(this.address, blockIdentifier);
  }

  // Get chain ID
  async getChainId() {
    return this.provider.getChainId();
  }
}
