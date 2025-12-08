export function calculateYesPrice(
  yesShares: bigint,
  noShares: bigint,
  liquidityB: bigint = BigInt(100e18)
): bigint {
  // Convert to numbers for calculation (safe for shares < 2^53)
  const yes = Number(yesShares) / 1e18;
  const no = Number(noShares) / 1e18;
  const b = Number(liquidityB) / 1e18;

  // LMSR price calculation
  const expYes = Math.exp(yes / b);
  const expNo = Math.exp(no / b);
  const price = expYes / (expYes + expNo);

  // Convert to percentage with 16 decimals (0.5 = 50%)
  return BigInt(Math.floor(price * 100 * 1e16));
}

export function calculateNoPrice(
  yesShares: bigint,
  noShares: bigint,
  liquidityB: bigint = BigInt(100e18)
): bigint {
  const yesPrice = calculateYesPrice(yesShares, noShares, liquidityB);
  // NO price is complement of YES price
  return BigInt(100 * 1e16) - yesPrice;
}

export function calculateExpectedShares(
  amount: bigint,
  currentPrice: bigint
): bigint {
  // Simple approximation: shares ≈ amount / price
  // More accurate calculation would use LMSR cost function
  if (currentPrice === 0n) return 0n;
  return (amount * BigInt(100 * 1e16)) / currentPrice;
}

export function calculateCost(
  sharesToBuy: bigint,
  yesShares: bigint,
  noShares: bigint,
  buyingYes: boolean,
  liquidityB: bigint = BigInt(100e18)
): bigint {
  const b = Number(liquidityB) / 1e18;
  const yes = Number(yesShares) / 1e18;
  const no = Number(noShares) / 1e18;
  const shares = Number(sharesToBuy) / 1e18;

  // LMSR cost function: C(q) = b * ln(exp(q_yes/b) + exp(q_no/b))
  const costBefore = b * Math.log(Math.exp(yes / b) + Math.exp(no / b));
  
  let costAfter: number;
  if (buyingYes) {
    costAfter = b * Math.log(Math.exp((yes + shares) / b) + Math.exp(no / b));
  } else {
    costAfter = b * Math.log(Math.exp(yes / b) + Math.exp((no + shares) / b));
  }

  const cost = costAfter - costBefore;
  return BigInt(Math.floor(cost * 1e18));
}

export function formatPrice(price: bigint, decimals: number = 1): string {
  const percent = Number(price) / 1e16;
  return `${percent.toFixed(decimals)}%`;
}



