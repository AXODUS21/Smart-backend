export const CREDIT_TO_PHP_RATE = 90;
export const CREDIT_TO_USD_RATE = 1.5;

/**
 * Formats a currency value based on region
 * @param {number} amount - The numeric value to format
 * @param {string} region - 'PH' or 'US'
 * @returns {string} - Formatted currency string
 */
export function formatCurrency(amount, region) {
  const isPH = region === 'PH';
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: isPH ? 'PHP' : 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).replace('PHP', '₱');
}

/**
 * Converts credits to monetary value and formats it
 * @param {number} credits - Number of credits
 * @param {string} region - 'PH' or 'US'
 * @returns {string} - Formatted currency string
 */
export function formatCreditsAsCurrency(credits, region) {
  const rate = region === 'PH' ? CREDIT_TO_PHP_RATE : CREDIT_TO_USD_RATE;
  const amount = credits * rate;
  return formatCurrency(amount, region);
}

/**
 * Gets the currency symbol for a region
 * @param {string} region - 'PH' or 'US'
 * @returns {string} - '₱' or '$'
 */
export function getCurrencySymbol(region) {
  return region === 'PH' ? '₱' : '$';
}
