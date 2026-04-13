# Pure Perpetual Epistemic Staking (PPES)

A perpetual prediction and belief-staking system with no oracle and no resolution. Prices represent collective belief strength and run indefinitely.

![Main Dashboard](https://github.com/user-attachments/assets/b6efad6e-c9d2-4852-af9d-2460610d08c4)

## Overview

PPES implements a logarithmic market scoring rule (LMSR) variant based on the cost function:

```
C(y, n) = log₂(2ʸ + 2ⁿ) − 1
```

Where:
- `y` = total YES stake on a claim
- `n` = total NO stake on a claim

**Marginal prices** reflect collective belief strength:

```
P_YES = 2ʸ / (2ʸ + 2ⁿ)
P_NO  = 2ⁿ / (2ʸ + 2ⁿ)
```

At `y = n = 0`, both prices start at exactly **0.5**.

## Features

- **Perpetual markets** — no resolution, no expiration
- **Zero-sum** — balance changes according to cost function differences
- **Every user starts with 1 unit** of balance
- **Buy / Sell** YES or NO shares on any claim
- **Price history chart** for each claim
- **Full transaction log** — auditable, deterministic state
- **Numerically stable** — uses log-sum-exp technique to avoid overflow

## Setup Screen

![Setup Screen](https://github.com/user-attachments/assets/563c966f-2b34-436d-af1e-f21de1cb4a6f)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), enter your name, and start staking.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm test` | Run math unit tests (31 tests) |
| `npm run preview` | Preview production build |

## Math

The cost to add `Δy` YES shares is:

```
Cost(Δy) = C(y + Δy, n) − C(y, n)
```

Selling `Δy` shares returns:

```
Receive(Δy) = C(y, n) − C(y − Δy, n)
```

This system is zero-sum relative to the cost function — what one user spends to push prices, they can recover by selling. No value is created or destroyed outside the cost function.

## Philosophy

This is a **pure epistemic staking system**:
- No oracle
- No objective resolution
- Prices represent collective belief strength
- The system runs indefinitely
