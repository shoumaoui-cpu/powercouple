"""Optimization service for BYOG simulation engine.

Implements:
- OPT-01 single-variable goal seek
- OPT-02 multi-variable optimization
- OPT-03 dynamic sensitivity heatmap
"""

from __future__ import annotations

import copy
from dataclasses import dataclass
from typing import Any

from optimizer.byog_engine import CalculationClass


@dataclass
class Candidate:
    objective_value: float
    payload: dict[str, Any]
    simulation: dict[str, Any]


class OptimizerService:
    def __init__(self, base_payload: dict[str, Any]) -> None:
        self.base_payload = base_payload

    @staticmethod
    def _set_nested(payload: dict[str, Any], path: str, value: float) -> None:
        keys = path.split(".")
        current = payload
        for key in keys[:-1]:
            if key not in current or not isinstance(current[key], dict):
                current[key] = {}
            current = current[key]
        current[keys[-1]] = value

    @staticmethod
    def _get_kpi(simulation: dict[str, Any], metric: str) -> float | None:
        return simulation.get("simulation_results", {}).get("summary_kpis", {}).get(metric)

    @staticmethod
    def _constraint_passes(simulation: dict[str, Any], constraint: dict[str, Any]) -> bool:
        metric = constraint["metric"]
        op = constraint["operator"]
        target = float(constraint["value"])
        value = simulation.get("simulation_results", {}).get("summary_kpis", {}).get(metric)
        if value is None:
            return False

        if op == "less_than":
            return value < target
        if op == "less_than_equal":
            return value <= target
        if op == "greater_than":
            return value > target
        if op == "greater_than_equal":
            return value >= target
        if op == "equal":
            return abs(value - target) <= 1e-6
        raise ValueError(f"Unsupported constraint operator '{op}'")

    def _evaluate(self, payload: dict[str, Any]) -> dict[str, Any]:
        return CalculationClass(payload).run()

    def _all_constraints_pass(self, simulation: dict[str, Any], constraints: list[dict[str, Any]]) -> bool:
        return all(self._constraint_passes(simulation, c) for c in constraints)

    def single_variable_goal_seek(self, job: dict[str, Any]) -> dict[str, Any]:
        """OPT-01 bisection goal seek.

        Expects:
          {
            "target_variable": "project_irr_levered_pct",
            "target_value": 15.0,
            "decision_variable": {
                "path": "asset_parameters.turnkey_capex_usd_per_kw",
                "min": 500,
                "max": 3000,
                "tolerance": 0.01
            }
          }
        """
        target_metric = job["target_variable"]
        target_value = float(job["target_value"])
        decision_var = job["decision_variable"]
        path = decision_var["path"]
        lo = float(decision_var["min"])
        hi = float(decision_var["max"])
        tol = float(decision_var.get("tolerance", 0.01))
        max_iter = int(decision_var.get("max_iterations", 50))

        best: tuple[float, float, dict[str, Any], dict[str, Any]] | None = None

        for _ in range(max_iter):
            mid = (lo + hi) / 2
            candidate_payload = copy.deepcopy(self.base_payload)
            self._set_nested(candidate_payload, path, mid)
            sim = self._evaluate(candidate_payload)
            kpi = self._get_kpi(sim, target_metric)
            if kpi is None:
                raise ValueError(f"KPI '{target_metric}' not found in simulation output")

            err = abs(kpi - target_value)
            if best is None or err < best[0]:
                best = (err, mid, candidate_payload, sim)

            if err <= tol:
                break

            # assumes monotonic relationship for bisection use-cases
            if kpi > target_value:
                lo = mid
            else:
                hi = mid

        if best is None:
            raise ValueError("Goal seek failed to find a candidate")

        _, solved_value, solved_payload, solved_sim = best
        return {
            "optimization_job": {
                "mode": "single_variable_goal_seek",
                "target_variable": target_metric,
                "target_value": target_value,
                "decision_variable": path,
                "solved_value": solved_value,
            },
            "simulation_results": solved_sim["simulation_results"],
            "resolved_payload": solved_payload,
        }

    def multi_variable_optimize(self, job: dict[str, Any]) -> dict[str, Any]:
        """OPT-02 multi-variable grid search with constraints."""
        target_metric = job["target_variable"]
        goal = job.get("goal", "maximize")
        constraints = job.get("constraints", [])
        decision_variables = job["decision_variables"]

        var_names = list(decision_variables.keys())
        if len(var_names) == 0:
            raise ValueError("No decision variables provided")

        grids: list[list[float]] = []
        for key in var_names:
            spec = decision_variables[key]
            start = float(spec["min"])
            stop = float(spec["max"])
            step = float(spec["step"])
            values: list[float] = []
            v = start
            while v <= stop + 1e-9:
                values.append(round(v, 6))
                v += step
            grids.append(values)

        best: Candidate | None = None
        tested = 0
        feasible = 0

        def visit(idx: int, payload: dict[str, Any]) -> None:
            nonlocal tested, feasible, best
            if idx == len(var_names):
                tested += 1
                simulation = self._evaluate(payload)
                if not self._all_constraints_pass(simulation, constraints):
                    return
                feasible += 1
                metric_value = self._get_kpi(simulation, target_metric)
                if metric_value is None:
                    return

                if best is None:
                    best = Candidate(metric_value, copy.deepcopy(payload), simulation)
                    return

                if goal == "maximize" and metric_value > best.objective_value:
                    best = Candidate(metric_value, copy.deepcopy(payload), simulation)
                elif goal == "minimize" and metric_value < best.objective_value:
                    best = Candidate(metric_value, copy.deepcopy(payload), simulation)
                return

            key = var_names[idx]
            for v in grids[idx]:
                path = (
                    key
                    if "." in key
                    else (
                        f"asset_parameters.{key}"
                        if key in payload.get("asset_parameters", {})
                        else f"financial_assumptions.{key}"
                    )
                )
                candidate = copy.deepcopy(payload)
                self._set_nested(candidate, path, v)
                visit(idx + 1, candidate)

        visit(0, copy.deepcopy(self.base_payload))

        if best is None:
            raise ValueError("No feasible solution found for optimization job")

        return {
            "optimization_job": {
                "mode": "multi_variable",
                "target_variable": target_metric,
                "goal": goal,
                "tested_scenarios": tested,
                "feasible_scenarios": feasible,
                "objective_value": best.objective_value,
            },
            "best_configuration": {
                "asset_parameters": best.payload.get("asset_parameters", {}),
                "financial_assumptions": best.payload.get("financial_assumptions", {}),
            },
            "simulation_results": best.simulation["simulation_results"],
        }

    def dynamic_sensitivity_heatmap(self, heatmap: dict[str, Any]) -> dict[str, Any]:
        """OPT-03 heatmap generation across 2 dimensions."""
        x_spec = heatmap["x_axis"]
        y_spec = heatmap["y_axis"]
        z_metric = heatmap["z_metric"]

        def build_values(spec: dict[str, Any]) -> list[float]:
            start = float(spec["min"])
            stop = float(spec["max"])
            step = float(spec["step"])
            out: list[float] = []
            v = start
            while v <= stop + 1e-9:
                out.append(round(v, 6))
                v += step
            return out

        x_values = build_values(x_spec)
        y_values = build_values(y_spec)

        matrix: list[dict[str, float | None]] = []

        for y in y_values:
            for x in x_values:
                payload = copy.deepcopy(self.base_payload)
                self._set_nested(payload, x_spec["path"], x)
                self._set_nested(payload, y_spec["path"], y)
                simulation = self._evaluate(payload)
                z = self._get_kpi(simulation, z_metric)
                matrix.append({
                    "x": x,
                    "y": y,
                    "z": z,
                })

        return {
            "optimization_job": {
                "mode": "sensitivity_heatmap",
                "x_axis": x_spec,
                "y_axis": y_spec,
                "z_metric": z_metric,
            },
            "points": matrix,
        }
