// src/app/(auth)/journal/[id]/page.tsx

import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { dbConnect } from "@/lib/db/mongodb";
import Trade from "@/lib/models/trade";
import mongoose from "mongoose";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  MinusCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TradeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  await dbConnect();
  const userId = new mongoose.Types.ObjectId(session.id);

  let trade;
  try {
    trade = await Trade.findOne({
      _id: new mongoose.Types.ObjectId(params.id),
      userId,
    }).lean();
  } catch (error) {
    trade = null;
  }

  if (!trade) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Trade not found.
        </p>
        <Link href="/journal" className="text-blue-600 hover:underline">
          Back to Journal
        </Link>
      </div>
    );
  }

  const isWin = trade.status === "win";
  const isLoss = trade.status === "loss";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back Button */}
      <Link
        href="/journal"
        className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to Journal
      </Link>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span
              className={`w-3 h-3 rounded-full ${
                isWin
                  ? "bg-green-500"
                  : isLoss
                    ? "bg-red-500"
                    : trade.status === "breakeven"
                      ? "bg-gray-500"
                      : "bg-blue-500"
              }`}
            />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {trade.pair}{" "}
              <span
                className={`text-sm px-3 py-1 rounded-full ml-2 ${trade.direction === "long" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}
              >
                {trade.direction.toUpperCase()}
              </span>
            </h1>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/journal/${trade._id.toString()}/edit`}
              className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </Link>
            <button className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">PnL</p>
            <p
              className={`text-2xl font-bold ${isWin ? "text-green-600 dark:text-green-400" : isLoss ? "text-red-600 dark:text-red-400" : "text-gray-600"}`}
            >
              {(trade.pnl || 0) > 0 ? "+" : ""}$
              {trade.pnl?.toFixed(2) || "0.00"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              R-Multiple
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {trade.rMultiple?.toFixed(2)}R
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
            <p
              className={`text-2xl font-bold capitalize ${isWin ? "text-green-600" : isLoss ? "text-red-600" : "text-gray-600"}`}
            >
              {trade.status}
            </p>
          </div>
        </div>
      </div>

      {/* Entry/Exit Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Entry Details
          </h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Entry Price</dt>
              <dd className="text-sm font-medium text-gray-900 dark:text-white">
                {trade.entryPrice}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Stop Loss</dt>
              <dd className="text-sm font-medium text-red-600">
                {trade.stopLoss}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Take Profit</dt>
              <dd className="text-sm font-medium text-green-600">
                {trade.takeProfit}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Position Size</dt>
              <dd className="text-sm font-medium text-gray-900 dark:text-white">
                {trade.positionSize} lots
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Entry Date</dt>
              <dd className="text-sm font-medium text-gray-900 dark:text-white">
                {new Date(trade.entryDate).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Exit Details
          </h2>
          {trade.exitPrice ? (
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Exit Price</dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-white">
                  {trade.exitPrice}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Exit Date</dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-white">
                  {trade.exitDate
                    ? new Date(trade.exitDate).toLocaleString()
                    : "N/A"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Risk Amount</dt>
                <dd className="text-sm font-medium text-red-600">
                  ${trade.riskAmount?.toFixed(2)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Reward Amount</dt>
                <dd className="text-sm font-medium text-green-600">
                  ${trade.rewardAmount?.toFixed(2)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Trade still open — no exit details yet.
            </p>
          )}
        </div>
      </div>

      {/* Categorization */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Categorization
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Session</p>
            <p className="font-medium text-gray-900 dark:text-white capitalize">
              {trade.session?.replace("_", " ")}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Strategy</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {trade.strategy || "N/A"}
            </p>
          </div>
        </div>

        {trade.tags && trade.tags.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-500 mb-2">Tags</p>
            <div className="flex flex-wrap gap-2">
              {trade.tags.map((tag: string, index: number) => (
                <span
                  key={index}
                  className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {trade.mistakes && trade.mistakes.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-500 mb-2">Mistakes</p>
            <div className="flex flex-wrap gap-2">
              {trade.mistakes.map((mistake: string, index: number) => (
                <span
                  key={index}
                  className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded capitalize"
                >
                  {mistake.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      {trade.notes && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Notes
          </h2>
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {trade.notes}
          </p>
        </div>
      )}
    </div>
  );
}
