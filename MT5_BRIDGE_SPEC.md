# Namello MT5 Bridge — v1

Namello 1.0.26 can poll an HTTPS endpoint and automatically attach MT5 OHLC to journal trades.

## Flow

1. Install/run an MT5 EA or bridge that collects closed/open trades and OHLC bars.
2. The bridge publishes JSON at an HTTPS `GET` endpoint.
3. In Namello: Settings → MT5 · دریافت خودکار OHLC و MFE/MAE → enable → enter the endpoint.
4. Namello polls every 5–300 seconds (default 15 s).
5. Trades are matched by `ticket`, then by symbol/side/entry proximity.
6. MFE, MAE, Best Exit and Exit Efficiency are calculated from the supplied High/Low path.

## Response

```json
{
  "trades": [
    {
      "ticket": 12345678,
      "pair": "XAUUSD",
      "direction": "buy",
      "lot": 0.10,
      "entry": 2650.20,
      "exit": 2657.40,
      "pnl": 72.00,
      "status": "closed",
      "closedDate": "2026-10-02",
      "closedTime": "10:42",
      "ohlc": [
        {"time":"10:01","open":2650.2,"high":2653.1,"low":2649.7,"close":2652.4},
        {"time":"10:02","open":2652.4,"high":2658.0,"low":2651.9,"close":2657.4}
      ]
    }
  ]
}
```

The endpoint must allow CORS for the Namello origin and should use HTTPS. Do not expose MT5 account passwords or broker credentials to the browser.

## Security

Use an authenticated endpoint (for example a short-lived bearer token or signed request) and return only the minimum trade/OHLC fields. Never put a broker password in `index.html`, `localStorage`, or a public GitHub repository.
