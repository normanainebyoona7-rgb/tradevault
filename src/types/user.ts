// src/types/user.ts

export interface UserSettings {
  baseCurrency: string;
  defaultRiskPercent: number;
  defaultAccountBalance: number;
  defaultContractSize: number;
}

export interface UserSubscription {
  plan: "free" | "pro";
  tradesUsed: number;
  tradesLimit: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  image: string | null;
  settings: UserSettings;
  subscription: UserSubscription;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
