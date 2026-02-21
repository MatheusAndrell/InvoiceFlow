import axios from 'axios';

const PREFEITURA_URL = process.env.PREFEITURA_URL || 'http://prefeitura-mock:3001';
const MAX_RETRIES = 3;

interface PrefeituraResult {
  success: boolean;
  protocol?: string;
  error?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callPrefeitura(signedXml: string, saleId: string): Promise<PrefeituraResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(
        `${PREFEITURA_URL}/nfse/emitir`,
        { xml: signedXml, saleId },
        { timeout: 10000 },
      );

      return response.data as PrefeituraResult;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      if (axios.isAxiosError(err) && err.response) {
        // Server returned an error response - don't retry
        const data = err.response.data as { success: boolean; error?: string };
        return { success: false, error: data.error || 'Prefeitura returned error' };
      }

      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000; // exponential backoff
        console.warn(`Prefeitura call attempt ${attempt} failed, retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Prefeitura unreachable after retries',
  };
}
