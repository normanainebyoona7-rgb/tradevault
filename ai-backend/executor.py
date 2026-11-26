#!/usr/bin/env python3
"""TradeVault -> MetaTrader 5 execution worker.

MongoDB claim tokens and execution states are the only deduplication authority.
An order that might have reached MT5 is never submitted again by this process;
it is recovered through the server's reconcile queue and MT5 history instead.

Usage:
  python executor.py
  python executor.py --once
  python executor.py --force-paper

Required environment:
  TRADEVAULT_URL       TradeVault origin, without a trailing /api path
  EXECUTOR_SECRET      Shared executor secret

Optional environment:
  EXECUTOR_ID          Defaults to the machine hostname
  POLL_SECONDS         Defaults to 2; minimum 1
  PAPER_BALANCE        Paper equity in account currency; defaults to 10000
  HTTP_TIMEOUT_SECONDS Defaults to 10; capped at 15
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_FLOOR, ROUND_HALF_UP
from typing import Any

try:
    import MetaTrader5 as mt5
except ImportError:
    # Paper mode and HTTP diagnostics still work without the Windows package.
    mt5 = None


URL = os.getenv("TRADEVAULT_URL", "").rstrip("/")
SECRET = os.getenv("EXECUTOR_SECRET", "")
EXECUTOR_ID = os.getenv("EXECUTOR_ID") or socket.gethostname() or "tradevault-executor"
POLL_SECONDS = max(1, int(os.getenv("POLL_SECONDS", "2")))
PAPER_BALANCE = float(os.getenv("PAPER_BALANCE", "10000"))
HTTP_TIMEOUT_SECONDS = max(1.0, min(15.0, float(os.getenv("HTTP_TIMEOUT_SECONDS", "10"))))
CLAIM_LEASE_SECONDS = 60
MAX_ORDERS_PER_CYCLE = 3
MAX_TICK_AGE_SECONDS = 120
MAX_CLOCK_SKEW_SECONDS = 5
MAX_HTTP_ERROR_CHARS = 300
MAX_RESPONSE_BYTES = 1024 * 1024
MT5_INITIALIZE_TIMEOUT_MS = 15000
MAGIC = 20261120
UTC = timezone.utc

_SENSITIVE_VALUES: set[str] = {SECRET} if SECRET else set()
_CONNECTED_ACCOUNT: tuple[int, str] | None = None

# MT5 RETURN is not represented by a SYMBOL_FILLING_* flag. FOK/IOC are 1/2.
_FILLING_FOK_FLAG = 1
_FILLING_IOC_FLAG = 2

_ALLOWED_REQUEST_KEYS = {
    "action",
    "symbol",
    "volume",
    "type",
    "price",
    "sl",
    "tp",
    "deviation",
    "magic",
    "comment",
    "type_time",
    "type_filling",
    "expiration",
    "position",
    "order",
    "stoplimit",
    "position_by",
}


class ApiError(Exception):
    """A TradeVault API failure whose message is safe to log."""


class OrderFailure(Exception):
    """A pre-send failure. No order may have been accepted."""

    def __init__(
        self,
        message: str,
        status: str = "skipped",
        lots: float = 0.0,
        request: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.lots = lots
        self.request = request


@dataclass(frozen=True)
class Config:
    risk_percent: float
    max_lot: float
    max_daily_loss_usd: float
    max_floating_loss_usd: float
    max_open_positions: int
    max_trades_per_day: int
    max_spread_pips: float
    tp_level: int
    symbol_suffix: str
    config_version: int

    @classmethod
    def parse(cls, raw: Any) -> "Config":
        if not isinstance(raw, dict):
            raise ValueError("claim response is missing config")
        risk = finite_number(raw.get("riskPercent"), "riskPercent")
        max_lot = finite_number(raw.get("maxLot"), "maxLot")
        max_daily = finite_number(raw.get("maxDailyLossUsd"), "maxDailyLossUsd")
        max_floating = finite_number(raw.get("maxFloatingLossUsd"), "maxFloatingLossUsd")
        max_spread = finite_number(raw.get("maxSpreadPips"), "maxSpreadPips")
        max_positions = integer_number(raw.get("maxOpenPositions"), "maxOpenPositions")
        max_trades = integer_number(raw.get("maxTradesPerDay"), "maxTradesPerDay")
        tp_level = integer_number(raw.get("tpLevel"), "tpLevel")
        version = integer_number(raw.get("configVersion"), "configVersion")
        suffix = raw.get("symbolSuffix")
        if not isinstance(suffix, str):
            raise ValueError("symbolSuffix must be a string")
        if risk <= 0 or max_lot <= 0 or max_spread <= 0:
            raise ValueError("riskPercent, maxLot and maxSpreadPips must be positive")
        if max_daily < 0 or max_floating < 0:
            raise ValueError("loss limits cannot be negative")
        if max_positions < 1 or max_trades < 1:
            raise ValueError("position and trade limits must be at least 1")
        if tp_level not in (1, 2, 3):
            raise ValueError("tpLevel must be 1, 2 or 3")
        if version < 1:
            raise ValueError("configVersion must be at least 1")
        return cls(
            risk,
            max_lot,
            max_daily,
            max_floating,
            max_positions,
            max_trades,
            max_spread,
            tp_level,
            suffix,
            version,
        )


@dataclass(frozen=True)
class PreparedOrder:
    symbol: str
    lots: float
    entry: float
    stop_loss: float
    take_profit: float
    request: dict[str, Any]
    heartbeat: dict[str, Any]


# ===== SAFE OUTPUT AND HTTP =====


def safe_text(value: Any, limit: int = 1000) -> str:
    text = str(value)
    for secret in sorted(_SENSITIVE_VALUES, key=len, reverse=True):
        if secret:
            text = text.replace(secret, "[REDACTED]")
    text = re.sub(
        r"(?i)(\"?(?:password|secret|claimToken|authorization)\"?\s*[:=]\s*)"
        r"(\"(?:\\.|[^\"])*\"|'[^']*'|[^\s,}]+)",
        r"\1[REDACTED]",
        text,
    )
    text = " ".join(text.splitlines())
    return text[:limit]


def log(message: str) -> None:
    stamp = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{stamp}] {safe_text(message)}", flush=True)


def finite_number(value: Any, label: str) -> float:
    if isinstance(value, bool) or value is None:
        raise ValueError(f"{label} must be a finite number")
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label} must be a finite number") from exc
    if not math.isfinite(number):
        raise ValueError(f"{label} must be a finite number")
    return number


def integer_number(value: Any, label: str) -> int:
    number = finite_number(value, label)
    if not number.is_integer():
        raise ValueError(f"{label} must be an integer")
    return int(number)


def optional_positive_int(value: Any) -> int | None:
    try:
        number = integer_number(value, "ticket")
    except ValueError:
        return None
    return number if number > 0 else None


def jsonable(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(item) for item in value]
    if hasattr(value, "_asdict"):
        return jsonable(value._asdict())
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def normalized_request(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    request = {key: jsonable(value[key]) for key in _ALLOWED_REQUEST_KEYS if key in value}
    return request or None


class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Never forward the executor bearer token to a redirect target."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


_HTTP_OPENER = urllib.request.build_opener(NoRedirectHandler())


def http_error_detail(error: urllib.error.HTTPError) -> str:
    try:
        raw = error.read(MAX_HTTP_ERROR_CHARS * 2 + 1)
    except OSError:
        raw = b""
    detail = ""
    if raw:
        try:
            body = json.loads(raw.decode("utf-8", errors="replace"))
        except (ValueError, UnicodeError):
            detail = raw.decode("utf-8", errors="replace")
        else:
            if isinstance(body, dict):
                detail_value = body.get("error") or body.get("message") or ""
                if isinstance(detail_value, (str, int, float)) and not isinstance(detail_value, bool):
                    detail = str(detail_value)
            if not detail:
                detail = "JSON error response"
    return safe_text(detail, MAX_HTTP_ERROR_CHARS)


def api_post(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    if not URL or not SECRET:
        raise ApiError("TRADEVAULT_URL and EXECUTOR_SECRET must be configured")
    try:
        encoded = json.dumps(payload, allow_nan=False, separators=(",", ":")).encode("utf-8")
    except (TypeError, ValueError) as exc:
        raise ApiError(f"cannot encode report: {safe_text(exc)}") from exc
    request = urllib.request.Request(
        URL + path,
        data=encoded,
        headers={
            "Authorization": f"Bearer {SECRET}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "TradeVault-MT5-Executor/2",
        },
        method="POST",
    )
    try:
        with _HTTP_OPENER.open(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
            raw = response.read(MAX_RESPONSE_BYTES + 1)
    except urllib.error.HTTPError as exc:
        detail = http_error_detail(exc)
        suffix = f": {detail}" if detail else ""
        raise ApiError(f"HTTP {exc.code} from {path}{suffix}") from exc
    except (urllib.error.URLError, OSError, TimeoutError) as exc:
        reason = getattr(exc, "reason", exc)
        raise ApiError(f"{path} failed: {safe_text(reason)}") from exc
    if len(raw) > MAX_RESPONSE_BYTES:
        raise ApiError(f"{path} response exceeded the size limit")
    try:
        result = json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeError) as exc:
        raise ApiError(f"{path} returned invalid JSON") from exc
    if not isinstance(result, dict):
        raise ApiError(f"{path} returned a non-object response")
    return result


def claim() -> dict[str, Any]:
    result = api_post(
        "/api/executor/claim",
        {"executorId": EXECUTOR_ID, "leaseSeconds": CLAIM_LEASE_SECONDS},
    )
    if not isinstance(result.get("enabled"), bool):
        raise ApiError("claim response is missing a boolean enabled field")
    if result.get("mode") not in ("paper", "live"):
        raise ApiError("claim response has an invalid mode")
    if not isinstance(result.get("orders", []), list):
        raise ApiError("claim response orders must be an array")
    if not isinstance(result.get("reconcile", []), list):
        raise ApiError("claim response reconcile must be an array")
    return result


def report_response(result: dict[str, Any], require_accepted: bool = False) -> bool:
    if result.get("ok") is not True:
        raise ApiError("report endpoint did not return ok=true")
    accepted = result.get("accepted")
    if not isinstance(accepted, bool):
        raise ApiError("report endpoint did not return a boolean accepted field")
    if "status" in result and not isinstance(result.get("status"), str):
        raise ApiError("report endpoint returned an invalid status")
    if require_accepted and accepted is not True:
        return False
    return True


# ===== CLAIM VALIDATION =====


def required_string(raw: dict[str, Any], key: str) -> str:
    value = raw.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} must be a non-empty string")
    return value.strip()


def parse_expiry(value: Any) -> datetime:
    if not isinstance(value, str) or not value:
        raise ValueError("expiresAt must be an ISO timestamp")
    try:
        expiry = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("expiresAt must be an ISO timestamp") from exc
    if expiry.tzinfo is None:
        raise ValueError("expiresAt must include a timezone")
    return expiry.astimezone(UTC)


def validate_execution(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("execution must be an object")
    direction = required_string(raw, "direction").lower()
    order_type = required_string(raw, "orderType").upper()
    if direction not in ("long", "short"):
        raise ValueError("direction must be long or short")
    if order_type not in ("MARKET", "BUY_LIMIT", "SELL_LIMIT"):
        raise ValueError("unsupported orderType")
    if order_type == "BUY_LIMIT" and direction != "long":
        raise ValueError("BUY_LIMIT requires long direction")
    if order_type == "SELL_LIMIT" and direction != "short":
        raise ValueError("SELL_LIMIT requires short direction")
    entry = finite_number(raw.get("entry"), "entry")
    stop_loss = finite_number(raw.get("stopLoss"), "stopLoss")
    take_profits = [finite_number(raw.get(f"takeProfit{i}"), f"takeProfit{i}") for i in (1, 2, 3)]
    if entry <= 0 or stop_loss <= 0 or any(value < 0 for value in take_profits):
        raise ValueError("entry/stop loss must be positive and take profits non-negative")
    if direction == "long" and stop_loss >= entry:
        raise ValueError("long stop loss must be below entry")
    if direction == "short" and stop_loss <= entry:
        raise ValueError("short stop loss must be above entry")
    mode = required_string(raw, "mode").lower()
    if mode not in ("paper", "live"):
        raise ValueError("execution mode must be paper or live")
    version = integer_number(raw.get("configVersion"), "execution configVersion")
    if version < 1:
        raise ValueError("execution configVersion must be at least 1")
    return {
        "executionId": required_string(raw, "executionId"),
        "claimToken": required_string(raw, "claimToken"),
        "signalId": required_string(raw, "signalId"),
        "pair": required_string(raw, "pair").upper(),
        "direction": direction,
        "orderType": order_type,
        "entry": entry,
        "stopLoss": stop_loss,
        "takeProfit1": take_profits[0],
        "takeProfit2": take_profits[1],
        "takeProfit3": take_profits[2],
        "expiresAt": raw["expiresAt"],
        "expiry": parse_expiry(raw.get("expiresAt")),
        "mode": mode,
        "configVersion": version,
        "request": normalized_request(raw.get("request")),
        "ticket": optional_positive_int(raw.get("ticket")),
        "message": safe_text(raw.get("message") or "", 1000),
    }


def selected_take_profit(order: dict[str, Any], config: Config) -> float:
    return float(order[f"takeProfit{config.tp_level}"])


def deterministic_comment(execution_id: str) -> str:
    return "TV-" + execution_id[-8:]


def paper_balance(data: dict[str, Any]) -> float:
    # PAPER_BALANCE is the configured fallback. Accept a server-provided balance
    # if a later contract adds one, without requiring MT5.
    raw_config = data.get("config")
    value = data.get(
        "paperBalance",
        raw_config.get("paperBalance", PAPER_BALANCE) if isinstance(raw_config, dict) else PAPER_BALANCE,
    )
    balance = finite_number(value, "paperBalance")
    if balance <= 0:
        raise ValueError("paperBalance must be positive")
    return balance


# ===== PAPER SIZING =====


def paper_pip_size(pair: str) -> float:
    normalized = pair.upper().replace("/", "")
    if normalized.startswith("XAU"):
        return 0.1
    if normalized.startswith("XAG"):
        return 0.01
    if normalized.startswith(("BTC", "ETH")):
        return 1.0
    if normalized.endswith("JPY"):
        return 0.01
    return 0.0001


def paper_pip_value(pair: str) -> float:
    normalized = pair.upper().replace("/", "")
    if normalized.startswith("XAU"):
        return 10.0
    if normalized.startswith("XAG"):
        return 50.0
    if normalized.startswith(("BTC", "ETH")):
        return 1.0
    if normalized.endswith("JPY"):
        return 9.5
    return 10.0


def floor_to_step(value: float, step: float) -> float:
    decimal_value = Decimal(str(value))
    decimal_step = Decimal(str(step))
    floored = (decimal_value / decimal_step).to_integral_value(rounding=ROUND_FLOOR) * decimal_step
    return float(floored)


def estimate_paper_lots(order: dict[str, Any], config: Config, balance: float) -> float:
    distance = abs(float(order["entry"]) - float(order["stopLoss"]))
    pip = paper_pip_size(order["pair"])
    if distance <= 0 or pip <= 0:
        return 0.0
    risk_usd = balance * config.risk_percent / 100.0
    loss_per_lot = distance / pip * paper_pip_value(order["pair"])
    if risk_usd <= 0 or loss_per_lot <= 0:
        return 0.0
    step = 0.01
    lots = floor_to_step(min(risk_usd / loss_per_lot, config.max_lot), step)
    return round(lots, 8)


# ===== MT5 CONNECTION AND MARKET DATA =====


def account_credentials(account: Any) -> tuple[int, str, str]:
    if not isinstance(account, dict):
        raise OrderFailure("server did not provide MT5 account credentials", status="error")
    try:
        login = integer_number(account.get("login"), "account login")
        server = required_string(account, "server")
        password = account.get("password")
    except ValueError as exc:
        raise OrderFailure(str(exc), status="error") from exc
    if login <= 0 or not isinstance(password, str) or not password:
        raise OrderFailure("MT5 account credentials are incomplete", status="error")
    if server != server.strip():
        raise OrderFailure("MT5 server name contains surrounding whitespace", status="error")
    return login, server, password


def checked_account_info(account: tuple[Any, ...]) -> Any:
    login, server = account[0], account[1]
    try:
        terminal = mt5.terminal_info()
        info = mt5.account_info()
    except Exception as exc:
        raise OrderFailure(f"MT5 terminal/account query failed: {safe_text(exc)}", status="error") from exc
    if terminal is None or info is None:
        raise OrderFailure("MT5 terminal/account information is unavailable", status="error")
    if not getattr(terminal, "connected", False):
        raise OrderFailure("MT5 terminal is not connected to the trade server", status="error")
    if getattr(terminal, "trade_allowed", True) is False:
        raise OrderFailure("MT5 terminal does not allow automated trading", status="error")
    if getattr(info, "trade_allowed", True) is False or getattr(info, "trade_expert", True) is False:
        raise OrderFailure("MT5 account does not allow automated trading", status="error")
    try:
        actual_login = integer_number(getattr(info, "login", None), "MT5 login")
    except ValueError as exc:
        raise OrderFailure("MT5 account login is unavailable", status="error") from exc
    actual_server = str(getattr(info, "server", ""))
    if actual_login != login or actual_server != server:
        raise OrderFailure(
            f"MT5 identity mismatch (expected login {login} on the configured server)",
            status="error",
        )
    return info


def ensure_mt5(account: Any) -> Any:
    global _CONNECTED_ACCOUNT
    if mt5 is None:
        raise OrderFailure("MetaTrader5 package is not installed", status="error")
    credentials = account_credentials(account)
    login, server, password = credentials
    _SENSITIVE_VALUES.add(password)
    if _CONNECTED_ACCOUNT == credentials[:2]:
        try:
            return checked_account_info(credentials)
        except OrderFailure:
            pass
    shutdown_mt5()
    try:
        initialized = mt5.initialize(
            login=login,
            password=password,
            server=server,
            timeout=MT5_INITIALIZE_TIMEOUT_MS,
        )
    except Exception as exc:
        raise OrderFailure(f"MT5 initialize failed: {safe_text(exc)}", status="error") from exc
    if not initialized:
        raise OrderFailure(f"MT5 initialize failed: {safe_text(mt5.last_error())}", status="error")
    try:
        info = checked_account_info(credentials)
    except Exception:
        shutdown_mt5()
        raise
    _CONNECTED_ACCOUNT = (login, server)
    log(f"MT5 connected to exact configured account {login}")
    return info


def shutdown_mt5() -> None:
    global _CONNECTED_ACCOUNT
    if mt5 is not None and _CONNECTED_ACCOUNT is not None:
        try:
            mt5.shutdown()
        except Exception as exc:
            log(f"MT5 shutdown warning: {safe_text(exc)}")
    _CONNECTED_ACCOUNT = None


def heartbeat(account_info: Any = None, connected: bool = False, balance: float = 0.0) -> dict[str, Any]:
    if connected and account_info is not None:
        try:
            balance = finite_number(account_info.balance, "MT5 balance")
            equity = finite_number(account_info.equity, "MT5 equity")
        except (AttributeError, ValueError):
            connected = False
            balance = 0.0
            equity = 0.0
    else:
        balance = 0.0
        equity = 0.0
    if not math.isfinite(balance) or not math.isfinite(equity):
        connected = False
        balance = 0.0
        equity = 0.0
    return {"connected": connected, "balance": float(balance), "equity": float(equity)}


def paper_heartbeat(balance: float) -> dict[str, Any]:
    return {"connected": True, "balance": float(balance), "equity": float(balance)}


def live_heartbeat(credentials: tuple[Any, ...] | None) -> dict[str, Any]:
    if mt5 is None or credentials is None or _CONNECTED_ACCOUNT != credentials[:2]:
        return heartbeat()
    try:
        info = checked_account_info(credentials)
        return heartbeat(info, connected=True)
    except Exception:
        return heartbeat()


def symbol_name(pair: str, config: Config) -> str:
    name = pair.replace("/", "").replace(" ", "") + config.symbol_suffix
    if not name:
        raise OrderFailure("empty MT5 symbol name", status="error")
    return name


def get_symbol(name: str) -> Any:
    info = mt5.symbol_info(name)
    if info is None or not getattr(info, "visible", True):
        try:
            selected = mt5.symbol_select(name, True)
        except Exception as exc:
            raise OrderFailure(f"cannot select {name}: {safe_text(exc)}", status="error") from exc
        if not selected:
            raise OrderFailure(f"symbol {name} is unavailable on this broker", status="error")
        info = mt5.symbol_info(name)
    if info is None:
        raise OrderFailure(f"symbol {name} is unavailable on this broker", status="error")
    trade_mode = getattr(info, "trade_mode", None)
    if trade_mode is None or trade_mode != getattr(mt5, "SYMBOL_TRADE_MODE_FULL", 4):
        raise OrderFailure(f"symbol {name} does not allow new positions", status="skipped")
    return info


def instrument_pip_size(info: Any) -> float:
    try:
        point = finite_number(getattr(info, "point", None), "symbol point")
        digits = integer_number(getattr(info, "digits", None), "symbol digits")
    except ValueError as exc:
        raise OrderFailure("broker did not expose valid point/digits", status="error") from exc
    if point <= 0 or digits < 0 or digits > 18:
        raise OrderFailure("broker point/digits are invalid", status="error")
    base = str(getattr(info, "currency_base", "") or info.name).upper()
    profit_currency = str(getattr(info, "currency_profit", "") or "").upper()
    if base.startswith(("XAU", "XAG")):
        pip = point * 10.0
    elif base.startswith(("BTC", "ETH")):
        tick_size = finite_number(getattr(info, "trade_tick_size", 0), "tick size")
        pip = max(point * 100.0, tick_size)
    elif profit_currency == "JPY":
        pip = point * 10.0 if digits == 3 else point
    elif digits in (3, 5):
        pip = point * 10.0
    else:
        pip = point
    if pip <= 0 or not math.isfinite(pip):
        raise OrderFailure("could not determine an instrument-aware pip size", status="error")
    return pip


def fresh_tick(name: str) -> Any:
    try:
        tick = mt5.symbol_info_tick(name)
    except Exception as exc:
        raise OrderFailure(f"tick query failed for {name}: {safe_text(exc)}", status="error") from exc
    if tick is None:
        raise OrderFailure(f"no tick data for {name}", status="error")
    try:
        bid = finite_number(tick.bid, "bid")
        ask = finite_number(tick.ask, "ask")
        seconds = float(tick.time)
        milliseconds = float(getattr(tick, "time_msc", 0) or 0)
    except (AttributeError, ValueError) as exc:
        raise OrderFailure(f"invalid tick data for {name}", status="error") from exc
    if bid <= 0 or ask <= 0 or ask < bid:
        raise OrderFailure(f"invalid bid/ask for {name}", status="error")
    tick_time = milliseconds / 1000.0 if milliseconds > 0 else seconds
    age = time.time() - tick_time
    if age > MAX_TICK_AGE_SECONDS or age < -MAX_CLOCK_SKEW_SECONDS:
        raise OrderFailure(f"stale tick for {name} (age {age:.1f}s)", status="skipped")
    return tick


def normalize_price(value: float, digits: int) -> float:
    quantum = Decimal(1).scaleb(-digits)
    return float(Decimal(str(value)).quantize(quantum, rounding=ROUND_HALF_UP))


# ===== ACCOUNT GUARDS AND SIZING =====


def utc_day_range(now: datetime | None = None) -> tuple[datetime, datetime]:
    now = now or datetime.now(UTC)
    start = datetime(now.year, now.month, now.day, tzinfo=UTC)
    return start, now + timedelta(seconds=1)


def deal_pnl(deal: Any) -> float:
    values = [getattr(deal, "profit", 0), getattr(deal, "swap", 0), getattr(deal, "commission", 0)]
    values.append(getattr(deal, "fee", 0))
    return sum(finite_number(value, "deal PnL") for value in values)


def bot_trade_key(record: Any) -> tuple[str, Any] | None:
    try:
        magic = integer_number(getattr(record, "magic", 0), "magic")
    except ValueError:
        magic = 0
    comment = str(getattr(record, "comment", "") or "").strip()
    if comment.startswith("TV-"):
        return ("comment", comment)
    if magic == MAGIC:
        ticket = optional_positive_int(getattr(record, "ticket", None))
        if ticket is None:
            ticket = optional_positive_int(getattr(record, "order", None))
        return ("ticket", ticket if ticket is not None else id(record))
    return None


def account_guard(config: Config, credentials: tuple[int, str, str], cycle_trades: set[tuple[str, Any]]) -> Any:
    info = checked_account_info(credentials)
    try:
        positions = mt5.positions_get()
        start, end = utc_day_range()
        history_orders = mt5.history_orders_get(start, end)
        deals = mt5.history_deals_get(start, end)
    except Exception as exc:
        raise OrderFailure(f"MT5 account guard query failed: {safe_text(exc)}", status="error") from exc
    if positions is None:
        raise OrderFailure("MT5 positions_get returned None", status="error")
    if history_orders is None:
        raise OrderFailure("MT5 history_orders_get returned None", status="error")
    if deals is None:
        raise OrderFailure("MT5 history_deals_get returned None; daily guards are unavailable", status="error")

    if len(positions) >= config.max_open_positions:
        raise OrderFailure(
            f"max open positions reached ({len(positions)}/{config.max_open_positions}, all account positions)",
        )

    floating_loss = 0.0
    for position in positions:
        try:
            profit = finite_number(getattr(position, "profit", None), "position profit")
            swap = finite_number(getattr(position, "swap", 0), "position swap")
        except ValueError as exc:
            raise OrderFailure("invalid MT5 position PnL", status="error") from exc
        floating_loss += min(0.0, profit + swap)
    if config.max_floating_loss_usd > 0 and -floating_loss >= config.max_floating_loss_usd:
        raise OrderFailure(
            f"floating loss limit reached ({-floating_loss:.2f} >= {config.max_floating_loss_usd:.2f})"
        )

    realized_pnl = 0.0
    entry_out = getattr(mt5, "DEAL_ENTRY_OUT", 1)
    entry_inout = getattr(mt5, "DEAL_ENTRY_INOUT", 2)
    for deal in deals:
        if getattr(deal, "entry", None) in (entry_out, entry_inout):
            realized_pnl += deal_pnl(deal)
    if config.max_daily_loss_usd > 0 and realized_pnl <= -config.max_daily_loss_usd:
        raise OrderFailure(
            f"daily realized loss limit reached ({realized_pnl:.2f} <= -{config.max_daily_loss_usd:.2f})"
        )

    trades_today: set[tuple[str, Any]] = set(cycle_trades)
    for record in list(history_orders) + list(positions) + list(deals):
        key = bot_trade_key(record)
        if key is not None:
            trades_today.add(key)
    try:
        active_orders = mt5.orders_get()
    except Exception as exc:
        raise OrderFailure(f"MT5 orders_get failed: {safe_text(exc)}", status="error") from exc
    if active_orders is None:
        raise OrderFailure("MT5 orders_get returned None", status="error")
    for order in active_orders:
        key = bot_trade_key(order)
        if key is not None:
            trades_today.add(key)
    if len(trades_today) >= config.max_trades_per_day:
        raise OrderFailure(
            f"max bot trades/day reached ({len(trades_today)}/{config.max_trades_per_day})"
        )
    try:
        equity = finite_number(info.equity, "MT5 equity")
        free_margin = finite_number(info.margin_free, "MT5 free margin")
    except (AttributeError, ValueError) as exc:
        raise OrderFailure("MT5 equity/free margin is unavailable", status="error") from exc
    if equity <= 0:
        raise OrderFailure("MT5 equity must be positive", status="error")
    if free_margin <= 0:
        raise OrderFailure("MT5 free margin must be positive", status="skipped")
    return info


def calculate_lots(info: Any, symbol_info: Any, price: float, stop_loss: float, config: Config, equity: float) -> float:
    try:
        tick_size = finite_number(symbol_info.trade_tick_size, "broker tick size")
        tick_value = finite_number(
            getattr(symbol_info, "trade_tick_value_loss", 0) or symbol_info.trade_tick_value,
            "broker tick value",
        )
        volume_min = finite_number(symbol_info.volume_min, "broker minimum volume")
        volume_max = finite_number(symbol_info.volume_max, "broker maximum volume")
        volume_step = finite_number(symbol_info.volume_step, "broker volume step")
    except (AttributeError, ValueError) as exc:
        raise OrderFailure("broker tick value/size or volume limits are unavailable", status="error") from exc
    if tick_size <= 0 or tick_value <= 0:
        raise OrderFailure("broker tick value/size must be positive", status="error")
    if volume_min <= 0 or volume_max < volume_min or volume_step <= 0:
        raise OrderFailure("broker volume min/max/step are invalid", status="error")
    stop_distance = abs(price - stop_loss)
    if stop_distance <= 0:
        raise OrderFailure("stop distance must be positive")
    loss_per_lot = stop_distance / tick_size * tick_value
    if loss_per_lot <= 0 or not math.isfinite(loss_per_lot):
        raise OrderFailure("invalid loss per lot", status="error")
    risk_usd = equity * config.risk_percent / 100.0
    if risk_usd <= 0:
        raise OrderFailure("risk amount must be positive", status="error")
    cap = min(volume_max, config.max_lot)
    if cap < volume_min:
        raise OrderFailure(
            f"configured/broker maximum {cap} is below broker minimum {volume_min}",
            status="skipped",
        )
    lots = floor_to_step(min(risk_usd / loss_per_lot, cap), volume_step)
    lots = round(lots, 8)
    if lots < volume_min:
        raise OrderFailure(
            f"calculated {lots} lots is below broker minimum {volume_min} for {symbol_info.name}"
        )
    if lots > cap + 1e-9:
        raise OrderFailure("calculated volume exceeds configured/broker maximum", status="error")
    return lots


def filling_policy(symbol_info: Any, pending: bool, force_fok: bool = False) -> int:
    if force_fok:
        return mt5.ORDER_FILLING_FOK
    if pending:
        # MT5 documentation prescribes RETURN for pending orders.
        return mt5.ORDER_FILLING_RETURN
    execution_mode = getattr(symbol_info, "trade_exemode", None)
    filling_mode = int(getattr(symbol_info, "filling_mode", 0) or 0)
    request_mode = getattr(mt5, "SYMBOL_TRADE_EXECUTION_REQUEST", None)
    instant_mode = getattr(mt5, "SYMBOL_TRADE_EXECUTION_INSTANT", None)
    market_mode = getattr(mt5, "SYMBOL_TRADE_EXECUTION_MARKET", None)
    if execution_mode in (request_mode, instant_mode) or filling_mode & _FILLING_IOC_FLAG:
        return mt5.ORDER_FILLING_IOC
    if filling_mode & _FILLING_FOK_FLAG:
        return mt5.ORDER_FILLING_FOK
    if execution_mode != market_mode:
        return mt5.ORDER_FILLING_RETURN
    raise OrderFailure("broker exposes no supported market filling policy", status="error")


def validate_stops(
    order: dict[str, Any],
    symbol_info: Any,
    tick: Any,
    price: float,
    stop_loss: float,
    take_profit: float,
) -> None:
    point = finite_number(getattr(symbol_info, "point", 0), "symbol point")
    stops_points = finite_number(getattr(symbol_info, "trade_stops_level", 0), "broker stop level")
    if point <= 0 or stops_points < 0:
        raise OrderFailure("broker point/stop level is invalid", status="error")
    minimum_distance = stops_points * point
    pending = order["orderType"] != "MARKET"
    if not pending:
        # Conservative market checks use the side on which SL/TP can trigger.
        if order["direction"] == "long":
            if stop_loss >= price or float(tick.bid) - stop_loss < minimum_distance:
                raise OrderFailure("long stop loss violates broker stop distance/current price")
            if take_profit <= float(tick.ask) or take_profit - float(tick.ask) < minimum_distance:
                raise OrderFailure("long take profit violates broker stop distance/current price")
        else:
            if stop_loss <= price or stop_loss - float(tick.ask) < minimum_distance:
                raise OrderFailure("short stop loss violates broker stop distance/current price")
            if take_profit >= float(tick.bid) or float(tick.bid) - take_profit < minimum_distance:
                raise OrderFailure("short take profit violates broker stop distance/current price")
        return
    if order["direction"] == "long":
        if price >= float(tick.ask):
            raise OrderFailure("buy limit price must be strictly below current ask")
        if stop_loss >= price or price - stop_loss < minimum_distance:
            raise OrderFailure("buy limit stop loss violates broker stop distance")
        if take_profit <= price or take_profit - price < minimum_distance:
            raise OrderFailure("buy limit take profit violates broker stop distance")
    else:
        if price <= float(tick.bid):
            raise OrderFailure("sell limit price must be strictly above current bid")
        if stop_loss <= price or stop_loss - price < minimum_distance:
            raise OrderFailure("sell limit stop loss violates broker stop distance")
        if take_profit >= price or price - take_profit < minimum_distance:
            raise OrderFailure("sell limit take profit violates broker stop distance")


def prepare_live_order(
    order: dict[str, Any],
    config: Config,
    credentials: tuple[int, str, str],
    cycle_trades: set[tuple[str, Any]],
    force_fok: bool = False,
) -> PreparedOrder:
    name = symbol_name(order["pair"], config)
    symbol_info = get_symbol(name)
    tick = fresh_tick(name)
    pip = instrument_pip_size(symbol_info)
    spread_pips = (float(tick.ask) - float(tick.bid)) / pip
    if spread_pips > config.max_spread_pips + 1e-9:
        raise OrderFailure(
            f"spread {spread_pips:.3f} pips exceeds maximum {config.max_spread_pips:.3f} for {name}"
        )
    take_profit = selected_take_profit(order, config)
    if take_profit <= 0:
        raise OrderFailure(f"configured TP{config.tp_level} is missing")
    if order["direction"] == "long" and take_profit <= order["entry"]:
        raise OrderFailure("long take profit must be above signal entry")
    if order["direction"] == "short" and take_profit >= order["entry"]:
        raise OrderFailure("short take profit must be below signal entry")

    account_info = account_guard(config, credentials, cycle_trades)
    pending = order["orderType"] != "MARKET"
    digits = integer_number(symbol_info.digits, "symbol digits")
    if pending:
        price = normalize_price(order["entry"], digits)
        action = mt5.TRADE_ACTION_PENDING
        order_type = (
            mt5.ORDER_TYPE_BUY_LIMIT if order["direction"] == "long" else mt5.ORDER_TYPE_SELL_LIMIT
        )
    else:
        raw_price = float(tick.ask) if order["direction"] == "long" else float(tick.bid)
        price = normalize_price(raw_price, digits)
        action = mt5.TRADE_ACTION_DEAL
        order_type = mt5.ORDER_TYPE_BUY if order["direction"] == "long" else mt5.ORDER_TYPE_SELL
    stop_loss = normalize_price(order["stopLoss"], digits)
    take_profit = normalize_price(take_profit, digits)
    if price <= 0 or stop_loss <= 0 or take_profit <= 0:
        raise OrderFailure("normalized price/stop/take-profit is invalid", status="error")
    validate_stops(order, symbol_info, tick, price, stop_loss, take_profit)
    equity = finite_number(account_info.equity, "MT5 equity")
    lots = calculate_lots(symbol_info, symbol_info, price, stop_loss, config, equity)

    request: dict[str, Any] = {
        "action": int(action),
        "symbol": name,
        "volume": float(lots),
        "type": int(order_type),
        "price": float(price),
        "sl": float(stop_loss),
        "tp": float(take_profit),
        "deviation": 20,
        "magic": MAGIC,
        "comment": deterministic_comment(order["executionId"]),
        "type_time": int(mt5.ORDER_TIME_SPECIFIED if pending else mt5.ORDER_TIME_GTC),
        "type_filling": int(filling_policy(symbol_info, pending, force_fok)),
    }
    if pending:
        request["expiration"] = int(order["expiry"].timestamp())
    try:
        margin = mt5.order_calc_margin(action, name, lots, price)
        check = mt5.order_check(request)
    except Exception as exc:
        raise OrderFailure(
            f"MT5 margin/order check failed: {safe_text(exc)}",
            status="error",
            lots=lots,
            request=request,
        ) from exc
    if margin is None:
        raise OrderFailure(
            "MT5 order_calc_margin returned None",
            status="error",
            lots=lots,
            request=request,
        )
    try:
        margin = finite_number(margin, "calculated margin")
        free_margin = finite_number(account_info.margin_free, "MT5 free margin")
    except ValueError as exc:
        raise OrderFailure("invalid margin data", status="error", lots=lots, request=request) from exc
    if margin <= 0:
        raise OrderFailure("MT5 calculated margin is not positive", status="error", lots=lots, request=request)
    if margin > free_margin + 1e-9:
        raise OrderFailure(
            f"insufficient free margin ({margin:.2f} required, {free_margin:.2f} free)",
            lots=lots,
            request=request,
        )
    if check is None:
        raise OrderFailure("MT5 order_check returned None", status="error", lots=lots, request=request)
    retcode = getattr(check, "retcode", None)
    if retcode != 0:
        raise OrderFailure(
            f"MT5 order_check rejected request ({retcode}: {safe_text(getattr(check, 'comment', ''))})",
            status="error",
            lots=lots,
            request=request,
        )
    try:
        checked_margin = finite_number(getattr(check, "margin", margin), "checked margin")
    except ValueError as exc:
        raise OrderFailure("MT5 order_check returned invalid margin", status="error", lots=lots, request=request) from exc
    if checked_margin <= 0 or checked_margin > free_margin + 1e-9:
        raise OrderFailure(
            f"MT5 order_check margin is invalid/insufficient ({checked_margin:.2f}, free {free_margin:.2f})",
            status="error",
            lots=lots,
            request=request,
        )
    return PreparedOrder(
        symbol=name,
        lots=lots,
        entry=price,
        stop_loss=stop_loss,
        take_profit=take_profit,
        request=request,
        heartbeat=heartbeat(account_info, connected=True),
    )


# ===== REPORTING =====


def execution_report(
    order: dict[str, Any],
    status: str,
    mode: str,
    lots: float,
    ticket: int | None,
    deal_ticket: int | None,
    retcode: int | None,
    entry: float,
    stop_loss: float,
    take_profit: float,
    message: str,
    request: dict[str, Any] | None,
    current_heartbeat: dict[str, Any],
    error: str | None = None,
) -> dict[str, Any]:
    return {
        "executorId": EXECUTOR_ID,
        "executionId": order["executionId"],
        "claimToken": order["claimToken"],
        "status": status,
        "mode": mode,
        "lots": float(lots),
        "ticket": ticket,
        "dealTicket": deal_ticket,
        "retcode": retcode,
        "entry": float(entry),
        "stopLoss": float(stop_loss),
        "takeProfit": float(take_profit),
        "message": safe_text(message, 1000),
        "request": normalized_request(request),
        "heartbeat": current_heartbeat,
        "error": safe_text(error, 1000) if error else None,
    }


def post_execution(payload: dict[str, Any], require_accepted: bool = False) -> bool:
    try:
        result = api_post("/api/executor/report", payload)
        accepted = report_response(result, require_accepted=require_accepted)
    except ApiError as exc:
        log(f"report failed for {payload.get('executionId', 'heartbeat')}: {exc}")
        return False
    if not accepted:
        log(f"report not accepted for {payload.get('executionId', 'heartbeat')} ({payload.get('status')})")
    return accepted


def report_outcome(
    order: dict[str, Any],
    status: str,
    mode: str,
    lots: float,
    ticket: int | None,
    deal_ticket: int | None,
    retcode: int | None,
    entry: float,
    stop_loss: float,
    take_profit: float,
    message: str,
    request: dict[str, Any] | None,
    current_heartbeat: dict[str, Any],
    error: str | None = None,
) -> bool:
    payload = execution_report(
        order,
        status,
        mode,
        lots,
        ticket,
        deal_ticket,
        retcode,
        entry,
        stop_loss,
        take_profit,
        message,
        request,
        current_heartbeat,
        error,
    )
    accepted = post_execution(payload)
    log(
        f"{mode} {status}: {order['pair']} {order['direction']} {lots} lots "
        f"ticket={ticket or '-'} execution={order['executionId'][-8:]} - {safe_text(message)}"
    )
    return accepted


def send_heartbeat(current_heartbeat: dict[str, Any], error: str | None = None) -> None:
    payload = {
        "executorId": EXECUTOR_ID,
        "heartbeat": current_heartbeat,
        "error": safe_text(error, 2000) if error else None,
    }
    post_execution(payload)


def reject_invalid_claim(raw: Any, message: str, current_heartbeat: dict[str, Any]) -> None:
    if not isinstance(raw, dict):
        log(f"invalid claimed execution: {message}")
        return
    execution_id = raw.get("executionId")
    token = raw.get("claimToken")
    if not isinstance(execution_id, str) or not execution_id or not isinstance(token, str) or not token:
        log(f"invalid claimed execution envelope: {message}")
        return
    mode = raw.get("mode") if raw.get("mode") in ("paper", "live") else "live"

    def fallback_number(key: str) -> float:
        try:
            return finite_number(raw.get(key), key)
        except ValueError:
            return 0.0

    order = {
        "executionId": execution_id,
        "claimToken": token,
        "pair": str(raw.get("pair") or "UNKNOWN"),
        "direction": str(raw.get("direction") or "unknown"),
    }
    report_outcome(
        order,
        "error",
        mode,
        0.0,
        None,
        None,
        None,
        fallback_number("entry"),
        fallback_number("stopLoss"),
        fallback_number("takeProfit1"),
        message,
        normalized_request(raw.get("request")),
        current_heartbeat,
        message,
    )


# ===== LIVE EXECUTION =====


def submit_intent(order: dict[str, Any], prepared: PreparedOrder) -> str:
    payload = execution_report(
        order,
        "submitting",
        "live",
        prepared.lots,
        None,
        None,
        None,
        prepared.entry,
        prepared.stop_loss,
        prepared.take_profit,
        "validated MT5 request; awaiting send authorization",
        prepared.request,
        prepared.heartbeat,
    )
    try:
        result = api_post("/api/executor/report", payload)
        accepted = report_response(result, require_accepted=True)
    except ApiError as exc:
        log(f"submitting report failed; order_send aborted for {order['executionId']}: {exc}")
        return "failed"
    if not accepted or result.get("status") != "submitting":
        log(f"submitting report not accepted; order_send aborted for {order['executionId']}")
        return "rejected"
    return "accepted"


def unknown_after_send(
    order: dict[str, Any],
    prepared: PreparedOrder,
    message: str,
    retcode: int | None = None,
    ticket: int | None = None,
    deal_ticket: int | None = None,
    lots: float | None = None,
) -> str:
    report_outcome(
        order,
        "unknown",
        "live",
        prepared.lots if lots is None else lots,
        ticket,
        deal_ticket,
        retcode,
        prepared.entry,
        prepared.stop_loss,
        prepared.take_profit,
        message,
        prepared.request,
        live_heartbeat(_CONNECTED_ACCOUNT),
        message,
    )
    return "unknown"


def send_result_outcome(
    order: dict[str, Any],
    prepared: PreparedOrder,
    result: Any,
    cycle_trades: set[tuple[str, Any]],
) -> str:
    retcode = getattr(result, "retcode", None)
    retcode_int = retcode if isinstance(retcode, int) else None
    ticket = optional_positive_int(getattr(result, "order", None))
    deal_ticket = optional_positive_int(getattr(result, "deal", None))
    try:
        result_volume = finite_number(getattr(result, "volume", 0), "result volume")
        result_price = finite_number(getattr(result, "price", 0), "result price")
    except ValueError:
        result_volume = 0.0
        result_price = 0.0
    lots = result_volume if 0 < result_volume <= prepared.lots + 1e-9 else prepared.lots
    entry = result_price if result_price > 0 else prepared.entry
    comment = safe_text(getattr(result, "comment", "") or "", 500)

    if retcode == getattr(mt5, "TRADE_RETCODE_INVALID_FILL", 10030) and order["orderType"] == "MARKET":
        # This retcode means the request was not accepted. The caller may make
        # exactly one fresh, re-guarded FOK attempt for market orders only.
        return "invalid_fill"
    if retcode in (getattr(mt5, "TRADE_RETCODE_TIMEOUT", 10012), getattr(mt5, "TRADE_RETCODE_CONNECTION", 10031)):
        return unknown_after_send(
            order,
            prepared,
            f"ambiguous MT5 result ({retcode}: {comment}); never retrying",
            retcode_int,
            ticket,
            deal_ticket,
            lots,
        )
    done = getattr(mt5, "TRADE_RETCODE_DONE", 10009)
    done_partial = getattr(mt5, "TRADE_RETCODE_DONE_PARTIAL", 10010)
    placed = getattr(mt5, "TRADE_RETCODE_PLACED", 10008)
    if retcode == done:
        status = "submitted"
        message = f"MT5 market order completed ({comment})"
    elif retcode == done_partial:
        status = "partial"
        message = f"MT5 market order partially filled ({comment})"
    elif retcode == placed:
        if ticket is None:
            return unknown_after_send(
                order,
                prepared,
                "MT5 returned PLACED without an order ticket; manual review required",
                retcode_int,
            )
        status = "submitted"  # PLACED is not a report enum; it is an accepted pending order.
        message = f"MT5 pending order placed ({comment})"
    elif retcode in (None, 0) or retcode_int is None:
        return unknown_after_send(
            order,
            prepared,
            f"unrecognized/ambiguous MT5 retcode {retcode}; never retrying",
            retcode_int,
            ticket,
            deal_ticket,
            lots,
        )
    else:
        report_outcome(
            order,
            "error",
            "live",
            lots,
            ticket,
            deal_ticket,
            retcode_int,
            entry,
            prepared.stop_loss,
            prepared.take_profit,
            f"MT5 rejected request ({retcode}: {comment})",
            prepared.request,
            live_heartbeat(_CONNECTED_ACCOUNT),
            f"MT5 retcode {retcode}: {comment}",
        )
        return "error"

    cycle_trades.add(("comment", deterministic_comment(order["executionId"])))
    report_outcome(
        order,
        status,
        "live",
        lots,
        ticket,
        deal_ticket,
        retcode_int,
        entry,
        prepared.stop_loss,
        prepared.take_profit,
        message,
        prepared.request,
        live_heartbeat(_CONNECTED_ACCOUNT),
    )
    return status


def execute_live_order(
    order: dict[str, Any],
    config: Config,
    credentials: tuple[int, str, str],
    cycle_trades: set[tuple[str, Any]],
    current_heartbeat: dict[str, Any],
    claim_deadline: float | None = None,
) -> str:
    for attempt in range(2):
        try:
            prepared = prepare_live_order(
                order,
                config,
                credentials,
                cycle_trades,
                force_fok=attempt == 1,
            )
        except OrderFailure as exc:
            report_outcome(
                order,
                exc.status,
                "live",
                exc.lots,
                None,
                None,
                None,
                prepared_entry(order, exc.request),
                prepared_stop(order, exc.request),
                selected_take_profit(order, config),
                str(exc),
                exc.request,
                live_heartbeat(credentials),
                str(exc) if exc.status == "error" else None,
            )
            return exc.status
        except Exception as exc:
            message = f"live preparation failed: {safe_text(exc)}"
            report_outcome(
                order,
                "error",
                "live",
                0.0,
                None,
                None,
                None,
                order["entry"],
                order["stopLoss"],
                selected_take_profit(order, config),
                message,
                None,
                live_heartbeat(credentials),
                message,
            )
            return "error"

        if parse_expiry(order["expiresAt"]) <= datetime.now(UTC):
            report_outcome(
                order,
                "skipped",
                "live",
                prepared.lots,
                None,
                None,
                None,
                prepared.entry,
                prepared.stop_loss,
                prepared.take_profit,
                "execution expired before send authorization",
                prepared.request,
                prepared.heartbeat,
            )
            return "skipped"

        if claim_deadline is not None and time.monotonic() >= claim_deadline:
            report_outcome(
                order,
                "skipped",
                "live",
                prepared.lots,
                None,
                None,
                None,
                prepared.entry,
                prepared.stop_loss,
                prepared.take_profit,
                "claim lease safety budget exhausted before send authorization",
                prepared.request,
                prepared.heartbeat,
            )
            return "skipped"

        authorization = submit_intent(order, prepared)
        if authorization == "failed":
            return "unknown"
        if authorization == "rejected":
            report_outcome(
                order,
                "skipped",
                "live",
                prepared.lots,
                None,
                None,
                None,
                prepared.entry,
                prepared.stop_loss,
                prepared.take_profit,
                "server rejected submitting state (kill switch/config changed); order_send aborted",
                prepared.request,
                prepared.heartbeat,
            )
            return "skipped"

        # No guard, HTTP request, logging, or other work belongs between the
        # accepted submitting report and this order_send call.
        try:
            result = mt5.order_send(prepared.request)
        except Exception as exc:
            return unknown_after_send(
                order,
                prepared,
                f"order_send raised after dispatch: {safe_text(exc)}; never retrying",
            )
        if result is None:
            return unknown_after_send(
                order,
                prepared,
                f"order_send returned None: {safe_text(mt5.last_error())}; never retrying",
            )
        try:
            outcome = send_result_outcome(order, prepared, result, cycle_trades)
        except Exception as exc:
            return unknown_after_send(
                order,
                prepared,
                f"could not classify MT5 result: {safe_text(exc)}; left unknown, never retrying",
                getattr(result, "retcode", None) if isinstance(getattr(result, "retcode", None), int) else None,
                optional_positive_int(getattr(result, "order", None)),
                optional_positive_int(getattr(result, "deal", None)),
            )
        if outcome == "invalid_fill" and attempt == 0:
            log(f"INVALID_FILL for {order['executionId']}; making one re-guarded FOK attempt")
            continue
        return outcome
    return "error"


def prepared_entry(order: dict[str, Any], request: dict[str, Any] | None) -> float:
    if request:
        try:
            return finite_number(request.get("price"), "request price")
        except ValueError:
            pass
    return order["entry"]


def prepared_stop(order: dict[str, Any], request: dict[str, Any] | None) -> float:
    if request:
        try:
            return finite_number(request.get("sl"), "request stop loss")
        except ValueError:
            pass
    return order["stopLoss"]


# ===== RECONCILIATION (NEVER PLACES AN ORDER) =====


def matching_record(record: Any, symbol: str, comment: str) -> bool:
    try:
        magic = integer_number(getattr(record, "magic", 0), "record magic")
    except ValueError:
        return False
    return (
        magic == MAGIC
        and str(getattr(record, "symbol", "")) == symbol
        and str(getattr(record, "comment", "")) == comment
    )


def record_number(record: Any, key: str, default: float = 0.0) -> float:
    try:
        return finite_number(getattr(record, key, default), key)
    except ValueError:
        return default


def reconcile_symbol(order: dict[str, Any], config: Config) -> str:
    request = order.get("request")
    if isinstance(request, dict) and isinstance(request.get("symbol"), str) and request["symbol"]:
        return request["symbol"]
    return symbol_name(order["pair"], config)


def reconcile_window(order: dict[str, Any]) -> tuple[datetime, datetime]:
    now = datetime.now(UTC)
    start = min(now - timedelta(days=7), order["expiry"] - timedelta(days=1))
    return start, now + timedelta(days=1)


def aggregate_deals(deals: list[Any]) -> tuple[float, float, int | None]:
    volume = sum(record_number(deal, "volume") for deal in deals)
    if volume <= 0:
        return 0.0, 0.0, None
    weighted_price = sum(record_number(deal, "price") * record_number(deal, "volume") for deal in deals)
    ordered = sorted(deals, key=lambda deal: (record_number(deal, "time"), record_number(deal, "ticket")))
    deal_ticket = optional_positive_int(getattr(ordered[-1], "ticket", None))
    return volume, weighted_price / volume, deal_ticket


def reconciliation_values(
    order: dict[str, Any],
    config: Config,
    record: Any = None,
    lots: float = 0.0,
    entry: float = 0.0,
) -> tuple[float, float, float, float]:
    request = order.get("request") or {}
    initial_lots = lots
    if initial_lots <= 0:
        try:
            initial_lots = finite_number(request.get("volume"), "request volume")
        except ValueError:
            initial_lots = 0.0
    if initial_lots <= 0:
        initial_lots = record_number(record, "volume_initial") if record is not None else 0.0
    if entry <= 0:
        entry = record_number(record, "price_open") if record is not None else 0.0
    if entry <= 0:
        try:
            entry = finite_number(request.get("price"), "request price")
        except ValueError:
            entry = order["entry"]
    stop_loss = record_number(record, "sl") if record is not None else 0.0
    take_profit = record_number(record, "tp") if record is not None else 0.0
    if stop_loss <= 0:
        try:
            stop_loss = finite_number(request.get("sl"), "request stop loss")
        except ValueError:
            stop_loss = order["stopLoss"]
    if take_profit <= 0:
        try:
            take_profit = finite_number(request.get("tp"), "request take profit")
        except ValueError:
            take_profit = selected_take_profit(order, config)
    return initial_lots, entry, stop_loss, take_profit


def reconcile_execution(
    raw: dict[str, Any],
    config: Config,
    credentials: tuple[int, str, str],
    current_heartbeat: dict[str, Any],
) -> bool:
    try:
        order = validate_execution(raw)
    except ValueError as exc:
        log(f"cannot reconcile malformed execution: {exc}")
        return False
    symbol = reconcile_symbol(order, config)
    comment = deterministic_comment(order["executionId"])
    start, end = reconcile_window(order)
    try:
        active_orders = mt5.orders_get()
        history_orders = mt5.history_orders_get(start, end)
        deals = mt5.history_deals_get(start, end)
    except Exception as exc:
        message = f"MT5 reconciliation query failed: {safe_text(exc)}"
        log(message)
        report_unknown_reconciliation(order, config, message, current_heartbeat)
        return False
    if active_orders is None or history_orders is None or deals is None:
        message = "MT5 reconciliation returned None for orders/history/deals; manual review required"
        log(message)
        report_unknown_reconciliation(order, config, message, current_heartbeat)
        return False

    active_matches = [record for record in active_orders if matching_record(record, symbol, comment)]
    history_matches = [record for record in history_orders if matching_record(record, symbol, comment)]
    deal_matches = [record for record in deals if matching_record(record, symbol, comment)]
    orders_by_ticket: dict[int, Any] = {}
    for record in history_matches + active_matches:
        ticket = optional_positive_int(getattr(record, "ticket", None))
        if ticket is not None:
            orders_by_ticket[ticket] = record
    deals_by_order: dict[int, list[Any]] = defaultdict(list)
    for deal in deal_matches:
        if getattr(deal, "entry", None) not in (
            getattr(mt5, "DEAL_ENTRY_IN", 0),
            getattr(mt5, "DEAL_ENTRY_INOUT", 2),
        ):
            continue
        order_ticket = optional_positive_int(getattr(deal, "order", None))
        if order_ticket is not None:
            deals_by_order[order_ticket].append(deal)
    order_tickets = set(orders_by_ticket) | set(deals_by_order)
    if not order_tickets:
        message = "no matching MT5 order/deal found; left unknown for manual review (never resubmitted)"
        report_unknown_reconciliation(order, config, message, current_heartbeat)
        return False
    if len(order_tickets) != 1:
        message = "multiple MT5 records match this execution; left unknown for manual review"
        report_unknown_reconciliation(order, config, message, current_heartbeat)
        return False

    ticket = next(iter(order_tickets))
    record = orders_by_ticket.get(ticket)
    opening_deals = deals_by_order.get(ticket, [])
    if record is not None and not opening_deals and getattr(record, "position_id", 0):
        position_id = optional_positive_int(getattr(record, "position_id", None))
        if position_id is not None:
            opening_deals = [
                deal
                for deal in deal_matches
                if optional_positive_int(getattr(deal, "position_id", None)) == position_id
                and getattr(deal, "entry", None)
                in (getattr(mt5, "DEAL_ENTRY_IN", 0), getattr(mt5, "DEAL_ENTRY_INOUT", 2))
            ]

    lots, entry, deal_ticket = aggregate_deals(opening_deals)
    initial_lots, entry, stop_loss, take_profit = reconciliation_values(
        order, config, record, lots, entry
    )
    state = getattr(record, "state", None) if record is not None else None
    active = any(optional_positive_int(getattr(item, "ticket", None)) == ticket for item in active_matches)
    retcode = None
    try:
        raw_retcode = raw.get("retcode")
        if raw_retcode is not None:
            retcode = integer_number(raw_retcode, "retcode")
    except ValueError:
        retcode = None

    if opening_deals:
        expected = initial_lots if initial_lots > 0 else lots
        partial = lots < expected - 1e-9 or state == getattr(mt5, "ORDER_STATE_PARTIAL", 3)
        status = "partial" if partial else "submitted"
        message = f"reconciled MT5 opening deal(s), volume {lots} ({status})"
    elif active and state in (
        getattr(mt5, "ORDER_STATE_PLACED", 1),
        getattr(mt5, "ORDER_STATE_PARTIAL", 3),
        getattr(mt5, "ORDER_STATE_STARTED", 0),
    ):
        if state == getattr(mt5, "ORDER_STATE_STARTED", 0):
            report_unknown_reconciliation(
                order,
                config,
                "matching MT5 order is still STARTED; left unknown for manual review",
                current_heartbeat,
                ticket=ticket,
            )
            return False
        status = "partial" if state == getattr(mt5, "ORDER_STATE_PARTIAL", 3) else "submitted"
        lots = record_number(record, "volume_current") or initial_lots
        message = f"reconciled active MT5 pending order (state {state})"
    elif state in (
        getattr(mt5, "ORDER_STATE_FILLED", 4),
        getattr(mt5, "ORDER_STATE_PARTIAL", 3),
        getattr(mt5, "ORDER_STATE_PLACED", 1),
    ):
        status = "partial" if state == getattr(mt5, "ORDER_STATE_PARTIAL", 3) else "submitted"
        lots = initial_lots
        message = f"reconciled MT5 historical order (state {state}); deal details unavailable"
    elif state in (
        getattr(mt5, "ORDER_STATE_CANCELED", 2),
        getattr(mt5, "ORDER_STATE_EXPIRED", 6),
        getattr(mt5, "ORDER_STATE_REJECTED", 5),
    ):
        status = "error"
        lots = initial_lots
        message = f"reconciled MT5 order ended without a fill (state {state}); never resubmitted"
    else:
        report_unknown_reconciliation(
            order,
            config,
            f"matching MT5 order has unresolved state {state}; manual review required",
            current_heartbeat,
            ticket=ticket,
        )
        return False

    report_outcome(
        order,
        status,
        "live",
        lots,
        ticket,
        deal_ticket,
        retcode,
        entry,
        stop_loss,
        take_profit,
        message,
        order.get("request"),
        live_heartbeat(credentials),
        message if status == "error" else None,
    )
    return True


def report_unknown_reconciliation(
    order: dict[str, Any],
    config: Config,
    message: str,
    current_heartbeat: dict[str, Any],
    ticket: int | None = None,
) -> None:
    lots, entry, stop_loss, take_profit = reconciliation_values(order, config)
    report_outcome(
        order,
        "unknown",
        "live",
        lots,
        ticket or order.get("ticket"),
        None,
        None,
        entry,
        stop_loss,
        take_profit,
        message,
        order.get("request"),
        current_heartbeat,
        message,
    )


# ===== CYCLE =====


def process_paper_order(
    raw: dict[str, Any],
    config: Config,
    balance: float,
    current_heartbeat: dict[str, Any],
) -> str:
    try:
        order = validate_execution(raw)
    except ValueError as exc:
        reject_invalid_claim(raw, str(exc), current_heartbeat)
        return "error"
    if order["configVersion"] != config.config_version:
        message = "execution configVersion does not match current server config"
        report_outcome(
            order,
            "skipped",
            "paper",
            0.0,
            None,
            None,
            None,
            order["entry"],
            order["stopLoss"],
            selected_take_profit(order, config),
            message,
            None,
            current_heartbeat,
        )
        return "skipped"
    if order["expiry"] <= datetime.now(UTC):
        message = "execution has expired"
        report_outcome(
            order,
            "skipped",
            "paper",
            0.0,
            None,
            None,
            None,
            order["entry"],
            order["stopLoss"],
            selected_take_profit(order, config),
            message,
            None,
            current_heartbeat,
        )
        return "skipped"
    take_profit = selected_take_profit(order, config)
    if take_profit <= 0:
        message = f"configured TP{config.tp_level} is missing"
        report_outcome(
            order,
            "skipped",
            "paper",
            0.0,
            None,
            None,
            None,
            order["entry"],
            order["stopLoss"],
            take_profit,
            message,
            None,
            current_heartbeat,
        )
        return "skipped"
    lots = estimate_paper_lots(order, config, balance)
    if lots < 0.01:
        message = "paper risk estimate is below the 0.01 lot minimum"
        report_outcome(
            order,
            "skipped",
            "paper",
            0.0,
            None,
            None,
            None,
            order["entry"],
            order["stopLoss"],
            take_profit,
            message,
            None,
            current_heartbeat,
        )
        return "skipped"
    message = (
        f"paper trade estimated from signal entry: {order['direction']} {lots} lots, "
        f"SL {order['stopLoss']}, TP{config.tp_level} {take_profit}"
    )
    report_outcome(
        order,
        "paper",
        "paper",
        lots,
        None,
        None,
        None,
        order["entry"],
        order["stopLoss"],
        take_profit,
        message,
        None,
        current_heartbeat,
    )
    return "paper"


def run_cycle(force_paper: bool) -> None:
    warnings: list[str] = []
    try:
        data = claim()
    except ApiError as exc:
        log(f"claim failed: {exc}")
        return

    claim_deadline = time.monotonic() + CLAIM_LEASE_SECONDS - 5

    if not data["enabled"]:
        reason = safe_text(data.get("reason") or "executor disabled", 500)
        log(f"idle: {reason}")
        shutdown_mt5()
        send_heartbeat(heartbeat())
        return

    try:
        config = Config.parse(data.get("config"))
        balance = paper_balance(data)
    except ValueError as exc:
        message = f"invalid server config: {exc}"
        log(message)
        send_heartbeat(heartbeat(), message)
        return

    server_mode = "paper" if force_paper else data["mode"]
    raw_orders = data.get("orders", [])
    raw_reconcile = data.get("reconcile", [])
    has_live_reconcile = any(
        isinstance(item, dict) and item.get("mode") == "live" for item in raw_reconcile
    )
    needs_live_connection = not force_paper and (server_mode == "live" or has_live_reconcile)
    credentials: tuple[int, str, str] | None = None
    account_info = None
    if needs_live_connection:
        try:
            credentials = account_credentials(data.get("account"))
            account_info = ensure_mt5(data.get("account"))
        except OrderFailure as exc:
            message = str(exc)
            log(message)
            warnings.append(message)
            credentials = None
    if force_paper:
        log("force paper mode is active; MT5 login and order_send are disabled")
    current_heartbeat = (
        paper_heartbeat(balance)
        if server_mode == "paper"
        else heartbeat(account_info, connected=credentials is not None)
    )

    halt_new_orders = False
    for raw in raw_reconcile:
        if force_paper:
            warnings.append("live reconciliation skipped because --force-paper forbids MT5 access")
            continue
        if server_mode != "live" and not has_live_reconcile:
            warnings.append("reconciliation unavailable outside live mode")
            continue
        if credentials is None:
            warnings.append("live reconciliation unavailable without an exact MT5 connection")
            continue
        try:
            resolved = reconcile_execution(raw, config, credentials, live_heartbeat(credentials))
        except Exception as exc:
            message = f"reconciliation failed: {safe_text(exc)}"
            log(message)
            warnings.append(message)
            resolved = False
        if not resolved:
            halt_new_orders = True

    cycle_trades: set[tuple[str, Any]] = set()
    for raw in raw_orders[:MAX_ORDERS_PER_CYCLE]:
        if halt_new_orders:
            warnings.append("new orders paused because an earlier submission remains unresolved")
            break
        if time.monotonic() >= claim_deadline:
            warnings.append("new orders paused because the claim lease safety budget was exhausted")
            break
        try:
            order = validate_execution(raw)
        except ValueError as exc:
            reject_invalid_claim(raw, str(exc), current_heartbeat)
            warnings.append(str(exc))
            continue

        if force_paper or order["mode"] == "paper":
            process_paper_order(raw, config, balance, current_heartbeat)
            continue
        if server_mode != "live":
            message = "server changed to paper mode; claimed live order was not sent"
            report_outcome(
                order,
                "skipped",
                "live",
                0.0,
                None,
                None,
                None,
                order["entry"],
                order["stopLoss"],
                selected_take_profit(order, config),
                message,
                None,
                current_heartbeat,
            )
            continue
        if credentials is None:
            message = "live order not sent because an exact MT5 connection is unavailable"
            report_outcome(
                order,
                "error",
                "live",
                0.0,
                None,
                None,
                None,
                order["entry"],
                order["stopLoss"],
                selected_take_profit(order, config),
                message,
                None,
                current_heartbeat,
                message,
            )
            warnings.append(message)
            continue
        if order["configVersion"] != config.config_version:
            message = "execution configVersion does not match current server config"
            report_outcome(
                order,
                "skipped",
                "live",
                0.0,
                None,
                None,
                None,
                order["entry"],
                order["stopLoss"],
                selected_take_profit(order, config),
                message,
                None,
                current_heartbeat,
            )
            continue
        if order["expiry"] <= datetime.now(UTC):
            message = "execution has expired"
            report_outcome(
                order,
                "skipped",
                "live",
                0.0,
                None,
                None,
                None,
                order["entry"],
                order["stopLoss"],
                selected_take_profit(order, config),
                message,
                None,
                current_heartbeat,
            )
            continue
        try:
            outcome = execute_live_order(
                order,
                config,
                credentials,
                cycle_trades,
                current_heartbeat,
                claim_deadline=claim_deadline,
            )
        except Exception as exc:
            message = f"unexpected live execution failure: {safe_text(exc)}"
            log(message)
            warnings.append(message)
            # Once execution has started, only MT5 history can establish the
            # outcome. Leave the server record for reconciliation, never resend.
            outcome = "unknown"
        if outcome == "unknown":
            halt_new_orders = True

    final_heartbeat = (
        paper_heartbeat(balance)
        if server_mode == "paper"
        else live_heartbeat(credentials)
    )
    warning = "; ".join(dict.fromkeys(warnings))[:2000] or None
    send_heartbeat(final_heartbeat, warning)
    if not raw_orders and not raw_reconcile:
        log(f"{server_mode} mode; server returned no work")


# ===== ENTRY POINT =====


def validate_runtime_config() -> None:
    if not URL or not SECRET:
        raise ValueError("TRADEVAULT_URL and EXECUTOR_SECRET must be set")
    parsed = urllib.parse.urlsplit(URL)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("TRADEVAULT_URL must be an absolute http(s) URL")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("TRADEVAULT_URL must not contain credentials, query, or fragment")
    if not EXECUTOR_ID.strip():
        raise ValueError("EXECUTOR_ID must not be empty")
    if not math.isfinite(PAPER_BALANCE) or PAPER_BALANCE <= 0:
        raise ValueError("PAPER_BALANCE must be positive")


def main() -> int:
    parser = argparse.ArgumentParser(description="TradeVault MT5 executor")
    parser.add_argument("--once", action="store_true", help="run a single claim/report cycle")
    parser.add_argument("--force-paper", action="store_true", help="never log into or send to MT5")
    args = parser.parse_args()
    try:
        validate_runtime_config()
    except ValueError as exc:
        log(str(exc))
        return 1

    log(f"TradeVault executor {EXECUTOR_ID} -> {URL} (poll {POLL_SECONDS}s, lease {CLAIM_LEASE_SECONDS}s)")
    if args.force_paper:
        log("Force paper mode is ON")
    try:
        while True:
            run_cycle(args.force_paper)
            if args.once:
                break
            time.sleep(POLL_SECONDS)
    except KeyboardInterrupt:
        log("stopping")
    finally:
        shutdown_mt5()
    return 0


if __name__ == "__main__":
    sys.exit(main())
