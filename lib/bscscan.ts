import { validateTxHash } from './quant-rules';

// Official Binance-Peg BSC-USD (USDT BEP20) contract
const USDT_BEP20_CONTRACT = '0x55d398326f99059ff775485246999027b3197955';
// ERC20/BEP20 Transfer(address,address,uint256) event topic0
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export interface BscVerificationResult {
  verifiedOnChain: boolean;
  status: 'ON_CHAIN_VERIFIED' | 'NOT_FOUND_OR_PENDING' | 'MISMATCH' | 'RPC_UNAVAILABLE';
  summary: string;
  matchedAmountUsdt?: number;
  matchedRecipient?: string;
}

export async function verifyBep20UsdtTx(params: {
  txHash: string;
  expectedRecipient: string;
  expectedAmount: number;
}): Promise<BscVerificationResult> {
  const { txHash, expectedRecipient, expectedAmount } = params;
  if (!validateTxHash(txHash)) {
    return {
      verifiedOnChain: false,
      status: 'MISMATCH',
      summary: 'Invalid BEP20 TXID format (expected 0x + 64 hex characters).',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    // Public BSC JSON-RPC receipt check (does not require paid API key; uses BSCSCAN_API_KEY fallback if set)
    const rpcUrl = 'https://bsc-dataseed.binance.org/';
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [txHash.trim()],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return {
        verifiedOnChain: false,
        status: 'RPC_UNAVAILABLE',
        summary: `BSC RPC returned HTTP ${res.status}. Verify manually on BscScan.`,
      };
    }

    const json = (await res.json()) as {
      result?: {
        status?: string;
        logs?: Array<{
          address?: string;
          topics?: string[];
          data?: string;
        }>;
      } | null;
    };

    if (!json.result) {
      return {
        verifiedOnChain: false,
        status: 'NOT_FOUND_OR_PENDING',
        summary: 'Transaction not found on BSC Mainnet yet (may be pending or test TXID).',
      };
    }

    if (json.result.status !== '0x1') {
      return {
        verifiedOnChain: false,
        status: 'MISMATCH',
        summary: 'On-chain transaction status failed / reverted.',
      };
    }

    const expectedToLower = expectedRecipient.trim().toLowerCase();
    const logs = json.result.logs || [];

    for (const log of logs) {
      const contract = (log.address || '').toLowerCase();
      const topics = log.topics || [];
      if (
        contract === USDT_BEP20_CONTRACT &&
        topics[0]?.toLowerCase() === TRANSFER_TOPIC &&
        topics[2]
      ) {
        const recipientAddr = '0x' + topics[2].slice(-40).toLowerCase();
        const rawAmount = BigInt(log.data || '0x0');
        // USDT BEP20 uses 18 decimals
        const amountUsdt = Number(rawAmount) / 1e18;
        if (recipientAddr === expectedToLower) {
          const matchesAmount = Math.abs(amountUsdt - expectedAmount) < 0.5;
          return {
            verifiedOnChain: matchesAmount,
            status: matchesAmount ? 'ON_CHAIN_VERIFIED' : 'MISMATCH',
            matchedAmountUsdt: amountUsdt,
            matchedRecipient: recipientAddr,
            summary: matchesAmount
              ? `Verified on BSC Mainnet: ${amountUsdt.toFixed(2)} USDT sent to Treasury.`
              : `Amount mismatch on BSC: found ${amountUsdt.toFixed(2)} USDT vs submitted $${expectedAmount}.`,
          };
        }
      }
    }

    return {
      verifiedOnChain: false,
      status: 'MISMATCH',
      summary: 'No BEP20 USDT Transfer matching treasury wallet found in this TXID.',
    };
  } catch {
    return {
      verifiedOnChain: false,
      status: 'RPC_UNAVAILABLE',
      summary: 'BSC RPC unreachable in current network; verify TXID manually on BscScan.',
    };
  } finally {
    clearTimeout(timeout);
  }
}
