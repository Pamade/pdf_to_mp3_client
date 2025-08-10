import { instance } from '../utils/axiosInstance';

interface CheckoutRequest {
  priceId: string;
  quantity: number;
}

export const createCheckoutSession = async (data: CheckoutRequest) => {
  try {
    const response = await instance.post('/stripe/create-checkout', data);
    return response.data.checkoutUrl;
  } catch (error) {
    throw error;
  }
}; 