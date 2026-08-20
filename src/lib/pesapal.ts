// src/lib/pesapal.ts

import axios from "axios";

const PESAPAL_URL =
  process.env.PESAPAL_ENVIRONMENT === "live"
    ? "https://pay.pesapal.com/v3"
    : "https://cybqa.pesapal.com/v3";

const CONSUMER_KEY = process.env.PESAPAL_CONSUMER_KEY || "";
const CONSUMER_SECRET = process.env.PESAPAL_CONSUMER_SECRET || "";

// Get OAuth token from Pesapal
export async function getPesapalToken(): Promise<string> {
  try {
    const response = await axios.post(
      `${PESAPAL_URL}/api/Auth/RequestToken`,
      {
        consumer_key: CONSUMER_KEY,
        consumer_secret: CONSUMER_SECRET,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 10000,
      },
    );

    console.log("✅ Pesapal token obtained");
    return response.data.token;
  } catch (error: any) {
    console.error("Pesapal auth error:", error.response?.data || error.message);
    throw new Error("Failed to authenticate with Pesapal");
  }
}

// Submit order to Pesapal
export async function submitOrder(
  token: string,
  orderData: {
    id: string;
    amount: number;
    currency: string;
    description: string;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
  },
): Promise<string> {
  try {
    const response = await axios.post(
      `${PESAPAL_URL}/api/Transactions/SubmitOrderRequest`,
      {
        id: orderData.id,
        currency: orderData.currency,
        amount: orderData.amount,
        description: orderData.description,
        callback_url: `http://192.168.1.4:3000/api/payment/callback`,
        redirect_mode: "TOP_WINDOW",
        billing_address: {
          email_address: orderData.email,
          phone_number: orderData.phoneNumber,
          first_name: orderData.firstName,
          last_name: orderData.lastName,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      },
    );

    console.log("✅ Pesapal order submitted");
    return response.data.redirect_url;
  } catch (error: any) {
    console.error("Submit order error:", error.response?.data || error.message);
    throw new Error("Failed to submit order to Pesapal");
  }
}
