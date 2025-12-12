import axios from 'axios';

/**
 * M-Pesa OAuth Token Response Interface
 */
interface MpesaTokenResponse {
  access_token: string;
  expires_in: string;
}

/**
 * Generate M-Pesa Access Token
 * Uses Consumer Key and Consumer Secret to get OAuth token
 */
export async function generateMpesaAccessToken(): Promise<string> {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const environment = process.env.MPESA_ENVIRONMENT || 'sandbox'; // 'sandbox' or 'production'

  if (!consumerKey || !consumerSecret) {
    throw new Error('M-Pesa Consumer Key and Secret must be set in environment variables');
  }

  // Base64 encode consumer key and secret
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  // Determine API URL based on environment
  const baseUrl = environment === 'production' 
    ? 'https://api.safaricom.co.ke' 
    : 'https://sandbox.safaricom.co.ke';

  try {
    const response = await axios.get<MpesaTokenResponse>(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      }
    );

    if (response.data && response.data.access_token) {
      return response.data.access_token;
    } else {
      throw new Error('Failed to get access token from M-Pesa API');
    }
  } catch (error: any) {
    console.error('Error generating M-Pesa access token:', error.response?.data || error.message);
    throw new Error(`Failed to generate M-Pesa access token: ${error.message}`);
  }
}

/**
 * Get M-Pesa API Base URL based on environment
 */
export function getMpesaBaseUrl(): string {
  const environment = process.env.MPESA_ENVIRONMENT || 'sandbox';
  return environment === 'production' 
    ? 'https://api.safaricom.co.ke' 
    : 'https://sandbox.safaricom.co.ke';
}

