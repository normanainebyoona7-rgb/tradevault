#!/usr/bin/env python3
"""TradeVault -> MetaTrader 5 (Exness) signal executor.

Runs on a Windows machine/VPS that has the MT5 terminal installed.
The TradeVault admin panel (Admin -> Broker) decides whether the executor
is enabled and whether it runs in paper or live mode; this process only
follows those settings.

TradeVault server env vars:
  EXECUTOR_SECRET        long random shared secret (same value as here)
  BROKER_ENCRYPTION_KEY  (or NEXTAUTH_SECRET) used to encrypt the MT5 password

Local env vars:
  TRADEVAULT_URL         e.g. https://tradevault.vercel.app
  EXECUTOR_SECRET        same value as the server
  POLL_SECONDS           default 20
  PAPER_BALANCE          balance used for paper lot sizing, default 10000
  STATE_FILE             default executor_state.json

Usage:
  pip install MetaTrader5          # Windows only
  python executor.py               # run forever
  python executor.py --once        # one poll cycle
  python executor.py --force-paper # never place real orders, regardless of server mode
"""

import argparse
import json
import math
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

try:
    import MetaTrader5 as mt5
except ImportError:  # paper mode still works without the package
    mt5 = None

URL = os.getenv("TRADEVAULT_URL", "").rstrip("/")
SECRET = os.getenv("EXECUTOR_SECRET", "")
POLL_SECONDS = max(5, int(os.getenv("POLL_SECONDS", "20")))
PAPER_BALANCE = float(os.getenv("PAPER_BALANCE", "10000"))
STATE_FILE = os.getenv("STATE_FILE", "executor_state.json")
MAGIC = 20261120

_mt5_login = None


# ===== HTTP =====

def api_get(path):
    req = urllib.request.Request(
        URL + path,
        headers={"Authorization": f"Bearer {SECRET}"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read().decode("utf-8"))


def api_post(path, payload):
    req = urllib.request.Request(
        URL + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {SECRET}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read().decode("utf-8"))


# ===== STATE =====

def load_state():
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {"processed": []}


def save_state(state):
    state["processed"] = state["processed"][-500:]
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f)
    except OSError as e:
        print(f"[state] could not save: {e}", flush=True)


# ===== LOT SIZING (paper) =====

def pip_size(pair):
    if pair.startswith("XAU"):
        return 0.1
    if pair.startswith("XAG"):
        return 0.01
    if pair.startswith(("BTC", "ETH")):
        return 1.0
    if pair.endswith("/JPY"):
        return 0.01
    return 0.0001


def pip_value_per_lot(pair):
    if pair.startswith("XAU"):
        return 10.0
    if pair.startswith("XAG"):
        return 50.0
    if pair.startswith(("BTC", "ETH")):
        return 1.0
    if pair.endswith("/JPY"):
        return 9.5
    return 10.0


def estimate_lots(pair, entry, stop_loss, risk_usd, max_lot):
    distance = abs(entry - stop_loss)
    if distance <= 0:
        return 0.0
    pips = distance / pip_size(pair)
    if pips <= 0:
        return 0.0
    lots = risk_usd / (pips * pip_value_per_lot(pair))
    lots = math.floor(lots * 100) / 100
    return min(max(lots, 0.01), max_lot)


# ===== MT5 (live) =====

def ensure_mt5(account):
    global _mt5_login
    if mt5 is None:
        return False, "MetaTrader5 package not installed (Windows only)"

    login = int(account["login"])
    if _mt5_login == login and mt5.terminal_info() is not None:
        info = mt5.account_info()
        if info is not None and info.login == login:
            return True, ""

    if _mt5_login is not None:
        mt5.shutdown()
        _mt5_login = None

    ok = mt5.initialize(
        login=login,
        password=account["password"],
        server=account["server"],
        timeout=30000,
    )
    if not ok:
        return False, f"MT5 initialize failed: {mt5.last_error()}"

    info = mt5.account_info()
    if info is None or info.login != login:
        mt5.shutdown()
        return False, f"MT5 logged in as a different account ({info.login if info else 'none'})"

    _mt5_login = login
    print(f"[mt5] connected to {info.server} account {login}", flush=True)
    return True, ""


def shutdown_mt5():
    global _mt5_login
    if mt5 is not None and _mt5_login is not None:
        mt5.shutdown()
        _mt5_login = None


def mt5_symbol(pair, suffix):
    name = pair.replace("/", "") + (suffix or "")
    info = mt5.symbol_info(name)
    if info is None:
        mt5.symbol_select(name, True)
        info = mt5.symbol_info(name)
    return name, info


def live_lots(symbol_info, stop_distance, risk_usd, max_lot):
    tick_size = symbol_info.trade_tick_size or symbol_info.point
    tick_value = symbol_info.trade_tick_value
    if not tick_size or not tick_value:
        return None, "broker did not expose tick value for this symbol"
    loss_per_lot = (stop_distance / tick_size) * tick_value
    if loss_per_lot <= 0:
        return None, "invalid stop distance"
    lots = risk_usd / loss_per_lot
    step = symbol_info.volume_step or 0.01
    lots = math.floor(lots / step) * step
    lots = round(lots, 8)
    lots = min(lots, float(symbol_info.volume_max or max_lot), max_lot)
    if lots < float(symbol_info.volume_min or 0.01):
        return None, (
            f"calculated {lots} lots is below broker minimum "
            f"{symbol_info.volume_min} for {symbol_info.name}"
        )
    return lots, ""


def daily_realized_pnl():
    now = datetime.now(timezone.utc)
    start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    deals = mt5.history_deals_get(start, now)
    if not deals:
        return 0.0
    return sum(
        float(d.profit) + float(d.swap) + float(d.commission)
        for d in deals
        if d.entry == mt5.DEAL_ENTRY_OUT
    )


def place_order(signal, symbol, symbol_info, lots, tp_level):
    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        return None, f"no tick data for {symbol}"

    order_type = (signal.get("orderType") or "MARKET").upper()
    is_limit = "LIMIT" in order_type

    if is_limit:
        price = float(signal["entry"])
        if signal["direction"] == "long":
            if price >= tick.ask:
                return None, "buy limit price is not below market ask"
            action = mt5.TRADE_ACTION_PENDING
            trade_type = mt5.ORDER_TYPE_BUY_LIMIT
        else:
            if price <= tick.bid:
                return None, "sell limit price is not above market bid"
            action = mt5.TRADE_ACTION_PENDING
            trade_type = mt5.ORDER_TYPE_SELL_LIMIT
    else:
        price = tick.ask if signal["direction"] == "long" else tick.bid
        action = mt5.TRADE_ACTION_DEAL
        trade_type = (
            mt5.ORDER_TYPE_BUY if signal["direction"] == "long" else mt5.ORDER_TYPE_SELL
        )

    take_profit = signal.get(f"takeProfit{tp_level}") or signal.get("takeProfit1")
    request = {
        "action": action,
        "symbol": symbol,
        "volume": float(lots),
        "type": trade_type,
        "price": float(price),
        "sl": float(signal["stopLoss"]),
        "tp": float(take_profit) if take_profit else 0.0,
        "deviation": 20,
        "magic": MAGIC,
        "comment": "TradeVault",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }

    result = mt5.order_send(request)
    if result is None:
        return None, f"order_send returned None: {mt5.last_error()}"
    if result.retcode == getattr(mt5, "TRADE_RETCODE_INVALID_FILL", 10030):
        request["type_filling"] = mt5.ORDER_FILLING_FOK
        result = mt5.order_send(request)
        if result is None:
            return None, f"order_send returned None: {mt5.last_error()}"

    if result.retcode != mt5.TRADE_RETCODE_DONE:
        return None, f"{result.retcode}: {result.comment}"
    return result.order, ""


# ===== CYCLE =====

def report(executions, error=None, heartbeat=None):
    try:
        api_post(
            "/api/executor/report",
            {"executions": executions, "error": error, "heartbeat": heartbeat},
        )
    except (urllib.error.URLError, OSError) as e:
        print(f"[report] failed: {e}", flush=True)


def run_cycle(state, force_paper):
    try:
        data = api_get("/api/executor/pending")
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = e.read().decode("utf-8")[:200]
        except OSError:
            pass
        print(f"[poll] HTTP {e.code} {detail}", flush=True)
        return
    except (urllib.error.URLError, OSError) as e:
        print(f"[poll] cannot reach TradeVault: {e}", flush=True)
        return

    if not data.get("enabled"):
        print(f"[poll] idle: {data.get('reason', 'executor disabled')}", flush=True)
        report([], None, {"connected": _mt5_login is not None})
        return

    mode = "paper" if force_paper else data.get("mode", "paper")
    risk_percent = float(data.get("riskPercent") or 1)
    max_lot = float(data.get("maxLot") or 0.1)
    max_daily_loss = float(data.get("maxDailyLossUsd") or 0)
    tp_level = int(data.get("tpLevel") or 1)
    suffix = data.get("symbolSuffix") or ""
    signals = [s for s in data.get("signals", []) if s.get("id")]

    balance = PAPER_BALANCE
    live_ready = False

    if mode == "live":
        account = data.get("account")
        if not account:
            report([], "Server did not provide MT5 credentials")
            print("[mt5] no account credentials returned", flush=True)
            return
        live_ready, reason = ensure_mt5(account)
        if not live_ready:
            report([], reason)
            print(f"[mt5] {reason}", flush=True)
            return
        info = mt5.account_info()
        balance = float(info.balance)

        if max_daily_loss > 0:
            pnl = daily_realized_pnl()
            if pnl <= -max_daily_loss:
                msg = (
                    f"Daily loss limit reached ({pnl:.2f} <= -{max_daily_loss:.2f}); "
                    "no new trades today"
                )
                report([], msg, {"connected": True, "balance": balance, "equity": float(info.equity)})
                print(f"[guard] {msg}", flush=True)
                return

    executions = []
    processed = set(state.get("processed", []))
    risk_usd = balance * risk_percent / 100.0

    for signal in signals:
        signal_id = signal["id"]
        if signal_id in processed:
            continue
        processed.add(signal_id)

        pair = signal["pair"]
        direction = signal["direction"]
        entry = float(signal["entry"])
        stop_loss = float(signal["stopLoss"])
        stop_distance = abs(entry - stop_loss)

        if mode == "paper":
            lots = estimate_lots(pair, entry, stop_loss, risk_usd, max_lot)
            if lots <= 0:
                executions.append(_exec(signal, 0, None, "skipped", mode, "invalid stop distance", tp_level))
                continue
            executions.append(
                _exec(
                    signal,
                    lots,
                    None,
                    "paper",
                    mode,
                    f"paper trade: {direction} {lots} lots, SL {stop_loss}, TP level {tp_level}",
                    tp_level,
                )
            )
            continue

        symbol, info = mt5_symbol(pair, suffix)
        if info is None:
            executions.append(
                _exec(signal, 0, None, "skipped", mode, f"symbol {symbol} not found on this broker", tp_level)
            )
            continue

        lots, reason = live_lots(info, stop_distance, risk_usd, max_lot)
        if lots is None:
            executions.append(_exec(signal, 0, None, "skipped", mode, reason, tp_level))
            continue

        ticket, reason = place_order(signal, symbol, info, lots, tp_level)
        if ticket is None:
            executions.append(_exec(signal, lots, None, "error", mode, reason, tp_level))
        else:
            executions.append(
                _exec(signal, lots, ticket, "placed", mode, f"order sent ({ticket})", tp_level)
            )
        print(f"[live] {direction} {symbol} {lots} lots -> {ticket} {reason}", flush=True)

    state["processed"] = list(processed)
    save_state(state)

    heartbeat = {"connected": live_ready or mode == "paper", "balance": balance}
    if live_ready and mt5 is not None:
        info = mt5.account_info()
        if info is not None:
            heartbeat["equity"] = float(info.equity)
    report(executions, None, heartbeat)

    if executions:
        for e in executions:
            print(f"[{e['mode']}] {e['status']}: {e['pair']} {e['direction']} {e['lots']} - {e['message']}", flush=True)
    else:
        print(f"[poll] {mode} mode, no new signals", flush=True)


def _exec(signal, lots, ticket, status, mode, message, tp_level=1):
    return {
        "signalId": signal["id"],
        "pair": signal["pair"],
        "direction": signal["direction"],
        "lots": lots,
        "entry": float(signal["entry"]),
        "stopLoss": float(signal["stopLoss"]),
        "takeProfit": float(
            signal.get(f"takeProfit{tp_level}") or signal.get("takeProfit1") or 0
        ),
        "ticket": ticket,
        "status": status,
        "mode": mode,
        "message": message,
    }


def main():
    parser = argparse.ArgumentParser(description="TradeVault MT5 executor")
    parser.add_argument("--once", action="store_true", help="run a single cycle")
    parser.add_argument("--force-paper", action="store_true", help="never place real orders")
    args = parser.parse_args()

    if not URL or not SECRET:
        print("TRADEVAULT_URL and EXECUTOR_SECRET must be set", file=sys.stderr)
        return 1

    state = load_state()
    print(f"TradeVault executor -> {URL} (poll {POLL_SECONDS}s)", flush=True)
    if args.force_paper:
        print("Force paper mode is ON", flush=True)

    try:
        while True:
            run_cycle(state, args.force_paper)
            if args.once:
                break
            time.sleep(POLL_SECONDS)
    except KeyboardInterrupt:
        print("stopping...", flush=True)
    finally:
        shutdown_mt5()
    return 0


if __name__ == "__main__":
    sys.exit(main())
