// src/components/settings/manual-payment-modal.tsx

"use client";

import { useState } from "react";
import { X, Phone, Copy, CheckCircle2, Wallet } from "lucide-react";

interface ManualPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  priceUGX: number;
}

export function ManualPaymentModal({
  isOpen,
  onClose,
  planName,
  priceUGX,
}: ManualPaymentModalProps) {
  const [copied, setCopied] = useState<string | null>(null);

  if (!isOpen) return null;

  const phoneNumbers = [
    { label: "Airtel Money", number: "0701179229", color: "text-red-600" },
    { label: "MTN MoMo", number: "0783362906", color: "text-yellow-600" },
  ];

  const handleCopy = (number: string) => {
    navigator.clipboard.writeText(number);
    setCopied(number);
    setTimeout(() => setCopied(null), 3000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Manual Payment
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="text-center mb-6">
            <Wallet className="w-12 h-12 text-blue-600 mx-auto mb-3" />
            <p className="text-gray-700 dark:text-gray-300">
              Pay for <span className="font-bold">{planName}</span>
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
              UGX {priceUGX.toLocaleString()}
            </p>
          </div>

          <div className="space-y-3 mb-6">
            {phoneNumbers.map((phone) => (
              <div
                key={phone.number}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-3">
                  <Phone className={`w-5 h-5 ${phone.color}`} />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {phone.label}
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {phone.number}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleCopy(phone.number)}
                  className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                  title="Copy number"
                >
                  {copied === phone.number ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>
            ))}
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
              Steps to Activate:
            </p>
            <ol className="text-xs text-yellow-700 dark:text-yellow-300 mt-2 space-y-1 list-decimal list-inside">
              <li>Send UGX {priceUGX.toLocaleString()} to any number above</li>
              <li>Copy the transaction ID from your phone</li>
              <li>Contact admin to activate your account</li>
            </ol>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            I&apos;ve Sent Payment
          </button>
        </div>
      </div>
    </div>
  );
}
