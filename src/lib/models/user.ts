// src/lib/models/user.ts

import mongoose, { Schema, Document, models } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  image?: string;
  bio?: string;
  description?: string;
  baseCurrency: string;
  defaultRiskPercent: number;
  defaultAccountBalance: number;
  defaultContractSize: number;
  plan: string;
  tier: "free" | "vip" | "vvip";
  planExpiry: Date | null;
  tradesUsed: number;
  tradesLimit: number;
  emailVerified?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      minlength: [8, "Password must be at least 8 characters"],
    },
    image: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    baseCurrency: {
      type: String,
      default: "USD",
    },
    defaultRiskPercent: {
      type: Number,
      default: 2,
    },
    defaultAccountBalance: {
      type: Number,
      default: 10000,
    },
    defaultContractSize: {
      type: Number,
      default: 100000,
    },
    plan: {
      type: String,
      default: "Free Trial",
    },
    tier: {
      type: String,
      enum: ["free", "vip", "vvip"],
      default: "free",
    },
    planExpiry: {
      type: Date,
      default: null,
    },
    tradesUsed: {
      type: Number,
      default: 0,
    },
    tradesLimit: {
      type: Number,
      default: 50,
    },
    emailVerified: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const User = models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
