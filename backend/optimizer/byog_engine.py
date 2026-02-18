"""Core BYOG/BYOC financial simulation engine.

Implements:
- Capital stack roll-up (land, precon, power infra, DC, BYOC assets)
- Deterministic portfolio sizing (ESA -> Solar -> Battery -> Gas -> Curtailment)
- Unlevered annual cash flow projection
- Return metrics (IRR, NPV, MOIC, payback, LCOE proxy)
"""

from __future__ import annotations

from typing import Any

import numpy as np

HOURS_PER_YEAR = 8760
EPSILON = 1e-9


DEFAULT_BYOC_INPUTS: dict[str, Any] = {
    "site_land": {
        "land_parcel_size_acres": 100.0,
        "land_cost_per_acre_usd": 25_000.0,
    },
    "preconstruction": {
        "permitting_regulatory_usd": 500_000.0,
        "environmental_studies_usd": 300_000.0,
        "geotech_engineering_usd": 200_000.0,
        "interconnection_studies_usd": 1_000_000.0,
        "legal_fees_usd": 400_000.0,
        "title_insurance_usd": 150_000.0,
        "development_mgmt_usd": 500_000.0,
        "site_preparation_usd": 2_000_000.0,
        "utility_coordination_usd": 300_000.0,
        "financing_fees_usd": 250_000.0,
        "contingency_pct": 7.5,
    },
    "power_infrastructure": {
        "substation_capacity_mva": 150.0,
        "substation_cost_per_mva_usd": 40_000.0,
        "transmission_distance_miles": 2.0,
        "transmission_cost_per_mile_usd": 2_000_000.0,
        "network_upgrades_usd": 5_000_000.0,
        "distribution_infra_usd": 3_000_000.0,
        "contingency_pct": 10.0,
    },
    "data_center": {
        "total_it_capacity_mw": 100.0,
        "construction_cost_per_kw_usd": 8_000.0,
        "ffe_usd": 2_000_000.0,
        "owners_costs_usd": 5_000_000.0,
        "contingency_pct": 10.0,
    },
    "load_profile": {
        "peak_it_load_mw": 90.0,
        "min_operating_load_mw": 30.0,
        "load_factor": 0.85,
    },
    "curtailment": {
        "tiers": [
            {"name": "tier4", "mw": 20.0, "max_event_hours": 8.0, "max_events": 50.0, "revenue_loss_per_mwh": 50.0},
            {"name": "tier3", "mw": 20.0, "max_event_hours": 4.0, "max_events": 30.0, "revenue_loss_per_mwh": 120.0},
            {"name": "tier2", "mw": 15.0, "max_event_hours": 2.0, "max_events": 15.0, "revenue_loss_per_mwh": 250.0},
            {"name": "tier1", "mw": 35.0, "max_event_hours": 0.0, "max_events": 0.0, "revenue_loss_per_mwh": 0.0},
        ]
    },
    "firmness": {
        "base_firm_generation_requirement_pct": 85.0,
        "planning_reserve_margin_pct": 15.0,
    },
    "resource_costs": {
        "solar": {
            "capacity_factor_pct": 25.0,
            "capital_cost_per_kw_usd": 1_200.0,
            "fixed_om_per_kw_year_usd": 15.0,
            "useful_life_years": 30,
            "degradation_pct": 0.5,
            "land_requirement_acres_per_mw": 7.0,
            "elcc": 0.30,
        },
        "wind": {
            "capacity_factor_pct": 35.0,
            "capital_cost_per_kw_usd": 1_400.0,
            "fixed_om_per_kw_year_usd": 25.0,
            "useful_life_years": 25,
            "elcc": 0.40,
        },
        "battery": {
            "duration_hours": 4.0,
            "power_cost_per_kw_usd": 250.0,
            "energy_cost_per_kwh_usd": 200.0,
            "fixed_om_per_kw_year_usd": 10.0,
            "variable_om_per_mwh_usd": 3.0,
            "round_trip_efficiency_pct": 87.0,
            "useful_life_years": 15,
            "elcc": 0.90,
        },
        "natural_gas": {
            "capital_cost_per_kw_usd": 800.0,
            "fixed_om_per_kw_year_usd": 12.0,
            "variable_om_per_mwh_usd": 5.0,
            "heat_rate_mmbtu_per_mwh": 9.5,
            "fuel_cost_usd_per_mmbtu": 4.0,
            "fuel_price_escalation_pct": 2.5,
            "useful_life_years": 30,
            "elcc": 0.92,
        },
        "esa_grid": {
            "available": True,
            "max_capacity_mw": 50.0,
            "energy_rate_usd_per_mwh": 65.0,
            "energy_escalation_pct": 2.0,
            "demand_charge_usd_per_mw_month": 15_000.0,
            "transmission_import_limit_mw": 50.0,
            "elcc": 1.0,
        },
    },
    "revenue": {
        "leasable_it_capacity_mw": 90.0,
        "revenue_model_type": "wholesale",
        "base_lease_rate_wholesale_usd_per_mw_month": 120_000.0,
        "base_lease_rate_colo_usd_per_kw_month": 150.0,
        "contract_escalation_rate_pct": 2.5,
        "absorption_period_years": 2.0,
        "stabilized_occupancy_pct": 95.0,
        "dynamic_lease_pricing_enabled": True,
        "target_irr_buffer_pct": 1.0,
        "max_lease_rate_usd_per_mw_month": 600_000.0,
    },
    "opex": {
        "base_facility_ops_usd_per_mw_year": 50_000.0,
        "property_tax_rate_pct": 1.0,
        "insurance_usd_per_mw_year": 8_000.0,
        "asset_mgmt_fee_pct": 2.0,
        "other_ga_usd_per_year": 500_000.0,
        "opex_escalation_rate_pct": 2.5,
    },
    "analysis": {
        "required_equity_return_pct": 12.0,
        "discount_rate_pct": 10.0,
        "analysis_period_years": 25,
        "general_inflation_rate_pct": 2.5,
    },
}


class CalculationClass:
    """Financial transfer function used by simulate/optimize workflows."""

    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload
        self.site = payload.get("site_context", {})
        self.asset = payload.get("asset_parameters", {})
        self.fin = payload.get("financial_assumptions", {})
        self.model = self._build_model_inputs()
        self._validate_guardrails()

    def _normalize_pct(self, value: float | None) -> float:
        if value is None:
            return 0.0
        if value >= 1.0:
            return value / 100.0
        return value

    def _deep_merge(self, base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
        merged = dict(base)
        for key, value in override.items():
            if isinstance(value, dict) and isinstance(merged.get(key), dict):
                merged[key] = self._deep_merge(merged[key], value)
            else:
                merged[key] = value
        return merged

    def _build_model_inputs(self) -> dict[str, Any]:
        overrides = self.payload.get("byoc_inputs", {})
        model = self._deep_merge(DEFAULT_BYOC_INPUTS, overrides)

        # Compatibility bridge from existing payload fields.
        if self.site:
            peak_mw = float(self.site.get("facility_peak_load_kw", 0.0)) / 1000.0
            if peak_mw > 0:
                model["load_profile"]["peak_it_load_mw"] = peak_mw
                model["data_center"]["total_it_capacity_mw"] = max(
                    model["data_center"].get("total_it_capacity_mw", peak_mw),
                    peak_mw,
                )

        if self.asset:
            gen_mw = float(self.asset.get("nameplate_capacity_kw", 0.0)) / 1000.0
            if gen_mw > 0:
                model["resource_costs"]["natural_gas"].setdefault("seed_nameplate_mw", gen_mw)
            if self.asset.get("fuel_price_usd_per_mmbtu") is not None:
                model["resource_costs"]["natural_gas"]["fuel_cost_usd_per_mmbtu"] = float(
                    self.asset["fuel_price_usd_per_mmbtu"]
                )
            if self.asset.get("fuel_escalator_pct") is not None:
                model["resource_costs"]["natural_gas"]["fuel_price_escalation_pct"] = float(
                    self.asset["fuel_escalator_pct"]
                )
            if self.asset.get("heat_rate_btu_kwh") is not None:
                model["resource_costs"]["natural_gas"]["heat_rate_mmbtu_per_mwh"] = float(
                    self.asset["heat_rate_btu_kwh"]
                ) / 1000.0

        if self.fin:
            if self.fin.get("discount_rate_pct") is not None:
                model["analysis"]["discount_rate_pct"] = float(self.fin["discount_rate_pct"])
            if self.fin.get("inflation_rate_pct") is not None:
                model["analysis"]["general_inflation_rate_pct"] = float(self.fin["inflation_rate_pct"])

        peak_mw = float(model["load_profile"]["peak_it_load_mw"])
        tiers = model["curtailment"]["tiers"]
        tier_total = sum(float(t.get("mw", 0.0)) for t in tiers)
        if peak_mw > 0 and abs(tier_total - peak_mw) > 1e-3:
            tier1 = next((t for t in tiers if t.get("name") == "tier1"), None)
            if tier1 is not None:
                other_total = sum(float(t.get("mw", 0.0)) for t in tiers if t is not tier1)
                tier1["mw"] = max(peak_mw - other_total, 0.0)

        return model

    def _validate_guardrails(self) -> None:
        m = self.model
        dc = m["data_center"]
        load = m["load_profile"]
        rev = m["revenue"]

        total_it = float(dc["total_it_capacity_mw"])
        peak = float(load["peak_it_load_mw"])
        min_load = float(load["min_operating_load_mw"])
        leasable = float(rev["leasable_it_capacity_mw"])

        if peak > total_it + EPSILON:
            raise ValueError("Validation failed: peak_it_load_mw must be <= total_it_capacity_mw")
        if min_load > peak + EPSILON:
            raise ValueError("Validation failed: min_operating_load_mw must be <= peak_it_load_mw")
        if leasable > total_it + EPSILON:
            raise ValueError("Validation failed: leasable_it_capacity_mw must be <= total_it_capacity_mw")

        tier_mw_sum = sum(float(t.get("mw", 0.0)) for t in m["curtailment"]["tiers"])
        if abs(tier_mw_sum - peak) > 1e-3:
            raise ValueError("Validation failed: curtailment tier MW values must sum to peak_it_load_mw")

        gas_fuel = float(m["resource_costs"]["natural_gas"]["fuel_cost_usd_per_mmbtu"])
        if gas_fuel <= 0:
            raise ValueError("Validation failed: natural gas fuel_cost_usd_per_mmbtu must be > 0")

    @staticmethod
    def _crf(rate: float, years: int) -> float:
        if years <= 0:
            return 0.0
        if abs(rate) < EPSILON:
            return 1.0 / years
        return (rate * (1 + rate) ** years) / ((1 + rate) ** years - 1)

    @staticmethod
    def _irr_bisection(cashflows: list[float], low: float = -0.99, high: float = 3.0, iterations: int = 200) -> float | None:
        def npv(rate: float) -> float:
            return sum(cf / ((1 + rate) ** t) for t, cf in enumerate(cashflows))

        low_npv = npv(low)
        high_npv = npv(high)

        if np.sign(low_npv) == np.sign(high_npv):
            return None

        for _ in range(iterations):
            mid = (low + high) / 2
            mid_npv = npv(mid)
            if abs(mid_npv) <= 1e-7:
                return mid
            if np.sign(mid_npv) == np.sign(low_npv):
                low = mid
                low_npv = mid_npv
            else:
                high = mid
        return (low + high) / 2

    def _weighted_curtailment_cost(self, total_mwh: float, tiers: list[dict[str, Any]]) -> float:
        if total_mwh <= 0:
            return 0.0
        ordered = sorted(
            [t for t in tiers if t.get("name") != "tier1"],
            key=lambda t: float(t.get("revenue_loss_per_mwh", 0.0)),
        )
        remaining = total_mwh
        total_cost = 0.0
        for tier in ordered:
            tier_cap = float(tier.get("mw", 0.0)) * float(tier.get("max_event_hours", 0.0)) * float(tier.get("max_events", 0.0))
            consumed = min(remaining, tier_cap)
            total_cost += consumed * float(tier.get("revenue_loss_per_mwh", 0.0))
            remaining -= consumed
            if remaining <= 0:
                break
        if remaining > 0 and ordered:
            total_cost += remaining * float(ordered[-1].get("revenue_loss_per_mwh", 0.0))
        return total_cost / total_mwh

    def run(self) -> dict[str, Any]:
        m = self.model
        land = m["site_land"]
        pre = m["preconstruction"]
        pwr = m["power_infrastructure"]
        dc = m["data_center"]
        load = m["load_profile"]
        curtail = m["curtailment"]
        firm = m["firmness"]
        rc = m["resource_costs"]
        rev = m["revenue"]
        opx = m["opex"]
        ana = m["analysis"]

        discount = self._normalize_pct(float(ana["discount_rate_pct"]))
        inflation = self._normalize_pct(float(ana["general_inflation_rate_pct"]))
        period_years = int(ana["analysis_period_years"])

        # 3.1 Capital costs
        land_cost = float(land["land_parcel_size_acres"]) * float(land["land_cost_per_acre_usd"])

        pre_items = [
            "permitting_regulatory_usd",
            "environmental_studies_usd",
            "geotech_engineering_usd",
            "interconnection_studies_usd",
            "legal_fees_usd",
            "title_insurance_usd",
            "development_mgmt_usd",
            "site_preparation_usd",
            "utility_coordination_usd",
            "financing_fees_usd",
        ]
        pre_subtotal = sum(float(pre[k]) for k in pre_items)
        pre_cont = pre_subtotal * self._normalize_pct(float(pre["contingency_pct"]))
        total_precon = pre_subtotal + pre_cont

        substation_cost = float(pwr["substation_capacity_mva"]) * float(pwr["substation_cost_per_mva_usd"])
        transmission_cost = float(pwr["transmission_distance_miles"]) * float(pwr["transmission_cost_per_mile_usd"])
        power_subtotal = (
            substation_cost
            + transmission_cost
            + float(pwr["network_upgrades_usd"])
            + float(pwr["distribution_infra_usd"])
        )
        power_cont = power_subtotal * self._normalize_pct(float(pwr["contingency_pct"]))
        total_power_infra = power_subtotal + power_cont
        powered_land_cost = land_cost + total_precon + total_power_infra

        dc_construction = float(dc["total_it_capacity_mw"]) * float(dc["construction_cost_per_kw_usd"]) * 1000.0
        dc_subtotal = dc_construction + float(dc["ffe_usd"]) + float(dc["owners_costs_usd"])
        dc_cont = dc_subtotal * self._normalize_pct(float(dc["contingency_pct"]))
        total_dc_capex = dc_subtotal + dc_cont

        # 3.2 Optimization engine
        peak_mw = float(load["peak_it_load_mw"])
        load_factor = float(load["load_factor"])
        gross_firm_req = peak_mw * self._normalize_pct(float(firm["base_firm_generation_requirement_pct"])) * (
            1 + self._normalize_pct(float(firm["planning_reserve_margin_pct"]))
        )
        annual_energy_demand = peak_mw * load_factor * HOURS_PER_YEAR

        esa = rc["esa_grid"]
        solar = rc["solar"]
        battery = rc["battery"]
        gas = rc["natural_gas"]

        esa_available = bool(esa.get("available", True))
        esa_capacity = (
            min(float(esa["max_capacity_mw"]), float(esa["transmission_import_limit_mw"]), gross_firm_req)
            if esa_available
            else 0.0
        )
        esa_elcc = esa_capacity * float(esa["elcc"])
        remaining_firm = max(gross_firm_req - esa_elcc, 0.0)

        solar_cf = self._normalize_pct(float(solar["capacity_factor_pct"]))
        max_solar_by_land = float(land["land_parcel_size_acres"]) / max(float(solar["land_requirement_acres_per_mw"]), EPSILON)
        max_solar_deployable = max(float(solar.get("max_deployable_mw", max_solar_by_land)), 0.0)
        solar_energy_target = annual_energy_demand / max(solar_cf * HOURS_PER_YEAR, EPSILON)
        optimal_solar_mw = min(max_solar_by_land, max_solar_deployable, solar_energy_target)
        solar_elcc = optimal_solar_mw * float(solar["elcc"])
        solar_annual_generation = optimal_solar_mw * solar_cf * HOURS_PER_YEAR
        remaining_firm = max(remaining_firm - solar_elcc, 0.0)

        max_gas_backup_pct = max(
            0.0,
            min(1.0, self._normalize_pct(float(ana.get("max_gas_backup_pct", 1.0)))),
        )
        max_gas_elcc_allowed = gross_firm_req * max_gas_backup_pct

        gas_elcc = min(remaining_firm, max_gas_elcc_allowed)
        gas_capacity_mw = max(gas_elcc / max(float(gas["elcc"]), EPSILON), 0.0)

        remaining_after_gas = max(remaining_firm - gas_elcc, 0.0)
        battery_elcc = remaining_after_gas
        battery_power_mw = battery_elcc / max(float(battery["elcc"]), EPSILON)
        battery_energy_mwh = battery_power_mw * float(battery["duration_hours"])

        remaining_firm = max(remaining_after_gas - battery_elcc, 0.0)
        esa_annual_import = esa_capacity * HOURS_PER_YEAR * 0.5
        residual_after_solar_esa = max(annual_energy_demand - solar_annual_generation - esa_annual_import, 0.0)
        gas_annual_generation = min(gas_capacity_mw * HOURS_PER_YEAR, residual_after_solar_esa)
        battery_annual_discharge_mwh = max(annual_energy_demand - solar_annual_generation - esa_annual_import - gas_annual_generation, 0.0)

        total_firm_accredited = esa_elcc + solar_elcc + battery_elcc + gas_elcc
        coverage_ratio = total_firm_accredited / max(gross_firm_req, EPSILON)

        estimated_curtailment_mwh = max(
            annual_energy_demand
            - solar_annual_generation
            - esa_annual_import
            - gas_annual_generation,
            0.0,
        ) * 0.05

        weighted_curtail_cost = self._weighted_curtailment_cost(float(estimated_curtailment_mwh), list(curtail["tiers"]))
        annual_revenue_lost = estimated_curtailment_mwh * weighted_curtail_cost

        # 3.3 BYOC capex
        solar_capex = optimal_solar_mw * float(solar["capital_cost_per_kw_usd"]) * 1000.0
        wind_capex = 0.0
        battery_capex = (
            battery_power_mw * float(battery["power_cost_per_kw_usd"])
            + battery_energy_mwh * float(battery["energy_cost_per_kwh_usd"])
        ) * 1000.0
        gas_capex = gas_capacity_mw * float(gas["capital_cost_per_kw_usd"]) * 1000.0
        total_byoc_capex = solar_capex + wind_capex + battery_capex + gas_capex

        total_project_cost = powered_land_cost + total_dc_capex + total_byoc_capex

        # 5 Cash Flow
        stabilized_occ = self._normalize_pct(float(rev["stabilized_occupancy_pct"]))
        absorption = float(rev["absorption_period_years"])
        contract_esc = self._normalize_pct(float(rev["contract_escalation_rate_pct"]))
        opex_esc = self._normalize_pct(float(opx["opex_escalation_rate_pct"]))
        fuel_esc = self._normalize_pct(float(gas["fuel_price_escalation_pct"]))
        esa_esc = self._normalize_pct(float(esa["energy_escalation_pct"]))

        lease_type = str(rev["revenue_model_type"]).lower()
        if lease_type == "colo":
            base_lease_rate = float(rev["base_lease_rate_colo_usd_per_kw_month"]) * 1000.0
        else:
            base_lease_rate = float(rev["base_lease_rate_wholesale_usd_per_mw_month"])

        def build_cashflows(base_rate_per_mw_month: float) -> tuple[list[dict[str, Any]], list[float], float | None, int]:
            rows: list[dict[str, Any]] = []
            series = [-total_project_cost]
            cumulative_local = -total_project_cost
            payback_local: float | None = None
            positive_years = 0

            for year in range(1, period_years + 1):
                occ = stabilized_occ if absorption <= 0 else min(year / absorption, 1.0) * stabilized_occ
                occupied_mw = float(rev["leasable_it_capacity_mw"]) * occ
                lease_rate_y = base_rate_per_mw_month * ((1 + contract_esc) ** (year - 1))
                gross_revenue = occupied_mw * lease_rate_y * 12.0

                inflation_y = (1 + inflation) ** (year - 1)
                solar_om = optimal_solar_mw * float(solar["fixed_om_per_kw_year_usd"]) * 1000.0 * inflation_y
                battery_om = battery_power_mw * float(battery["fixed_om_per_kw_year_usd"]) * 1000.0 * inflation_y

                fuel_price_y = float(gas["fuel_cost_usd_per_mmbtu"]) * ((1 + fuel_esc) ** (year - 1))
                gas_cost = (
                    gas_capacity_mw * float(gas["fixed_om_per_kw_year_usd"]) * 1000.0 * inflation_y
                    + gas_annual_generation
                    * (
                        float(gas["heat_rate_mmbtu_per_mwh"]) * fuel_price_y
                        + float(gas["variable_om_per_mwh_usd"])
                    )
                )

                esa_energy = (
                    esa_capacity
                    * (occ / max(stabilized_occ, EPSILON))
                    * HOURS_PER_YEAR
                    * 0.5
                    * float(esa["energy_rate_usd_per_mwh"])
                    * ((1 + esa_esc) ** (year - 1))
                )
                esa_demand = esa_capacity * float(esa["demand_charge_usd_per_mw_month"]) * 12.0
                total_power_costs = solar_om + battery_om + gas_cost + esa_energy + esa_demand

                curtail_loss = annual_revenue_lost * (occ / max(stabilized_occ, EPSILON))

                facility_ops = (
                    float(opx["base_facility_ops_usd_per_mw_year"]) * occupied_mw * ((1 + opex_esc) ** (year - 1))
                )
                property_taxes = total_project_cost * self._normalize_pct(float(opx["property_tax_rate_pct"]))
                insurance = occupied_mw * float(opx["insurance_usd_per_mw_year"]) * ((1 + opex_esc) ** (year - 1))
                asset_fee = gross_revenue * self._normalize_pct(float(opx["asset_mgmt_fee_pct"]))
                other_ga = float(opx["other_ga_usd_per_year"]) * inflation_y
                total_opex = facility_ops + property_taxes + insurance + asset_fee + other_ga

                ebitda = gross_revenue - total_power_costs - curtail_loss - total_opex
                depreciation = total_project_cost / max(period_years, 1)
                ebit = ebitda - depreciation

                year_fcf = ebitda
                if year_fcf > 0:
                    positive_years += 1
                prior = cumulative_local
                cumulative_local += year_fcf
                series.append(year_fcf)

                if payback_local is None and cumulative_local >= 0:
                    step = max(cumulative_local - prior, EPSILON)
                    payback_local = (year - 1) + max(0.0, min(1.0, -prior / step))

                rows.append(
                    {
                        "year": year,
                        "occupancy_rate": round(occ, 6),
                        "gross_revenue_usd": round(gross_revenue, 2),
                        "total_power_costs_usd": round(total_power_costs, 2),
                        "curtailment_loss_usd": round(curtail_loss, 2),
                        "total_opex_usd": round(total_opex, 2),
                        "ebitda_usd": round(ebitda, 2),
                        "depreciation_usd": round(depreciation, 2),
                        "ebit_usd": round(ebit, 2),
                        "net_free_cash_flow_usd": round(year_fcf, 2),
                        "cumulative_cash_flow_usd": round(cumulative_local, 2),
                    }
                )

            return rows, series, payback_local, positive_years

        dynamic_lease_enabled = bool(rev.get("dynamic_lease_pricing_enabled", True))
        hurdle_irr = self._normalize_pct(float(ana.get("required_equity_return_pct", 12.0)))
        target_buffer = self._normalize_pct(float(rev.get("target_irr_buffer_pct", 1.0)))
        target_irr = max(hurdle_irr + target_buffer, hurdle_irr)

        cash_flow_rows, fcf, payback_year, positive_years = build_cashflows(base_lease_rate)
        irr = self._irr_bisection(fcf)

        applied_lease_rate = base_lease_rate
        calibration_applied = False

        if dynamic_lease_enabled:
            irr_for_check = irr if irr is not None and np.isfinite(irr) else -0.99
            needs_lift = irr_for_check < target_irr or positive_years < max(1, int(period_years * 0.6))
            if needs_lift:
                lo = base_lease_rate
                hi = max(base_lease_rate * 1.25, base_lease_rate + 10_000.0)
                max_lease = float(rev.get("max_lease_rate_usd_per_mw_month", 600_000.0))

                best_rows = cash_flow_rows
                best_series = fcf
                best_payback = payback_year
                best_irr = irr_for_check
                best_positive_years = positive_years
                best_rate = applied_lease_rate

                while hi <= max_lease + EPSILON:
                    rows_h, series_h, payback_h, pos_h = build_cashflows(hi)
                    irr_h = self._irr_bisection(series_h)
                    irr_h_val = irr_h if irr_h is not None and np.isfinite(irr_h) else -0.99

                    if irr_h_val > best_irr:
                        best_rows, best_series, best_payback = rows_h, series_h, payback_h
                        best_irr = irr_h_val
                        best_positive_years = pos_h
                        best_rate = hi

                    if irr_h_val >= target_irr and pos_h >= max(1, int(period_years * 0.6)):
                        break
                    hi *= 1.25

                if hi > max_lease:
                    hi = max_lease

                for _ in range(40):
                    mid = (lo + hi) / 2
                    rows_m, series_m, payback_m, pos_m = build_cashflows(mid)
                    irr_m = self._irr_bisection(series_m)
                    irr_m_val = irr_m if irr_m is not None and np.isfinite(irr_m) else -0.99

                    if irr_m_val >= target_irr and pos_m >= max(1, int(period_years * 0.6)):
                        hi = mid
                        best_rows, best_series, best_payback = rows_m, series_m, payback_m
                        best_irr = irr_m_val
                        best_positive_years = pos_m
                        best_rate = mid
                    else:
                        lo = mid

                if best_rate > applied_lease_rate + EPSILON:
                    applied_lease_rate = best_rate
                    cash_flow_rows, fcf, payback_year = best_rows, best_series, best_payback
                    irr = best_irr
                    positive_years = best_positive_years
                    calibration_applied = True

        irr = self._irr_bisection(fcf) if not isinstance(irr, float) else irr
        irr_pct = float(irr * 100.0) if irr is not None and np.isfinite(irr) else 0.0
        npv = float(sum(cf / ((1 + discount) ** i) for i, cf in enumerate(fcf)))
        moic = float(sum(fcf[1:]) / max(abs(fcf[0]), EPSILON))

        annualized_capex = total_project_cost * self._crf(discount, max(period_years, 1))
        year1_power = cash_flow_rows[0]["total_power_costs_usd"] if cash_flow_rows else 0.0
        lcoe_mwh = (annualized_capex + year1_power) / max(annual_energy_demand, EPSILON)

        summary_kpis = {
            "project_irr_unlevered_pct": round(irr_pct, 3),
            "project_irr_levered_pct": round(irr_pct, 3),  # backward-compatible alias
            "npv_usd": round(npv, 2),
            "moic": round(moic, 4),
            "simple_payback_years": round(payback_year, 3) if payback_year is not None else None,
            "payback_period_years": round(payback_year, 3) if payback_year is not None else None,
            "lcoe_usd_mwh": round(lcoe_mwh, 3),
            "lcoe_usd_kwh": round(lcoe_mwh / 1000.0, 6),
            "annual_revenue_lost_usd": round(annual_revenue_lost, 2),
            "coverage_ratio": round(coverage_ratio, 6),
            "firm_capacity_required_mw": round(gross_firm_req, 6),
            "firm_capacity_available_mw": round(total_firm_accredited, 6),
            "total_project_cost_usd": round(total_project_cost, 2),
            "min_dscr": 999.0,
            "base_lease_rate_usd_per_mw_month": round(base_lease_rate, 2),
            "applied_lease_rate_usd_per_mw_month": round(applied_lease_rate, 2),
            "lease_rate_calibration_applied": calibration_applied,
            "target_irr_pct": round(target_irr * 100.0, 3),
            "hurdle_irr_pct": round(hurdle_irr * 100.0, 3),
            "positive_cashflow_years": int(positive_years),
        }

        return {
            "simulation_results": {
                "summary_kpis": summary_kpis,
                "calculation_breakdown": {
                    "capital_costs": {
                        "land_cost_usd": round(land_cost, 2),
                        "total_preconstruction_usd": round(total_precon, 2),
                        "total_power_infrastructure_usd": round(total_power_infra, 2),
                        "powered_land_cost_usd": round(powered_land_cost, 2),
                        "total_data_center_capex_usd": round(total_dc_capex, 2),
                        "solar_capex_usd": round(solar_capex, 2),
                        "wind_capex_usd": round(wind_capex, 2),
                        "battery_capex_usd": round(battery_capex, 2),
                        "gas_capex_usd": round(gas_capex, 2),
                        "total_byoc_capex_usd": round(total_byoc_capex, 2),
                        "total_project_cost_usd": round(total_project_cost, 2),
                    },
                    "resource_mix": {
                        "solar_mw": round(optimal_solar_mw, 6),
                        "solar_firm_accredited_mw": round(solar_elcc, 6),
                        "annual_solar_generation_mwh": round(solar_annual_generation, 3),
                        "battery_power_mw": round(battery_power_mw, 6),
                        "battery_energy_mwh": round(battery_energy_mwh, 6),
                        "battery_firm_accredited_mw": round(battery_elcc, 6),
                        "annual_battery_discharge_mwh": round(battery_annual_discharge_mwh, 3),
                        "gas_mw": round(gas_capacity_mw, 6),
                        "gas_firm_accredited_mw": round(gas_elcc, 6),
                        "annual_gas_generation_mwh": round(gas_annual_generation, 3),
                        "esa_mw": round(esa_capacity, 6),
                        "esa_firm_accredited_mw": round(esa_elcc, 6),
                        "annual_esa_import_mwh": round(esa_annual_import, 3),
                        "annual_energy_demand_mwh": round(annual_energy_demand, 3),
                        "total_firm_accredited_mw": round(total_firm_accredited, 6),
                        "coverage_ratio": round(coverage_ratio, 6),
                    },
                    "curtailment": {
                        "estimated_annual_curtailment_mwh": round(estimated_curtailment_mwh, 2),
                        "weighted_average_curtailment_cost_usd_per_mwh": round(weighted_curtail_cost, 3),
                        "annual_revenue_lost_usd": round(annual_revenue_lost, 2),
                    },
                    "pricing": {
                        "base_lease_rate_usd_per_mw_month": round(base_lease_rate, 2),
                        "applied_lease_rate_usd_per_mw_month": round(applied_lease_rate, 2),
                        "lease_rate_calibration_applied": calibration_applied,
                        "target_irr_pct": round(target_irr * 100.0, 3),
                        "hurdle_irr_pct": round(hurdle_irr * 100.0, 3),
                        "positive_cashflow_years": int(positive_years),
                    },
                },
                "cash_flow_waterfall": cash_flow_rows,
            }
        }
