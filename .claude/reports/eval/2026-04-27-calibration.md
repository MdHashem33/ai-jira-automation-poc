# Dispatcher confidence calibration — 2026-04-27

Fixtures: **120**
Expected Calibration Error (ECE): **0.017** — lower is better; under 0.05 is well-calibrated.

## Reliability table

| Confidence bucket | Count | Mean confidence | Accuracy | |conf − acc| |
|---|---|---|---|---|
| [0.00, 0.50) | 0 | — | — | — |
| [0.50, 0.70) | 0 | — | — | — |
| [0.70, 0.85) | 2 | 0.840 | 1.000 | 0.160 |
| [0.85, 0.95) | 4 | 0.895 | 0.750 | 0.145 |
| [0.95, 1.00] | 114 | 0.972 | 0.982 | 0.010 |

## Recommended human-review threshold

Auto-demote any classification below confidence `0.95` to `escalate`. Above this threshold the dispatcher is sufficiently calibrated for downstream specialists to act on the category without an additional human-review gate.