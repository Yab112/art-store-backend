export interface PaymentInitializeResponse {
  success: boolean;
  message: string;
  data: {
    checkoutUrl: string;
    txRef: string;
    provider: string;
  };
}

export interface PaymentVerifyResponse {
  success: boolean;
  message: string;
  data: {
    status: string;
    amount: number;
    currency: string;
    txRef: string;
    provider: string;
    userId?: string; // User ID of the authenticated user who made the order
    chargeResponseMessage?: string;
    customerEmail?: string;
    customerName?: string;
    originalTxRef?: string; // For PayPal: original TX-{orderId}-{timestamp} format
  };
}

export interface ChapaInitializeResponse {
  status: string;
  message: string;
  data: {
    checkout_url: string;
  };
}

export interface ChapaVerifyResponse {
  message: string;
  status: string;
  data: {
    first_name: string;
    last_name: string;
    email: string;
    currency: string;
    amount: string;
    charge: string;
    mode: string;
    method: string;
    type: string;
    status: string;
    reference: string;
    tx_ref: string;
    customization: {
      title: string;
      description: string;
    };
    meta: null;
    created_at: string;
    updated_at: string;
  };
}
