from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Any, Literal, Optional
import logging

from optimizer.byog_engine import CalculationClass
from optimizer.byog_optimizer import OptimizerService
from optimizer.solver import run_optimization

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="PowerCouple Optimization API",
    description="MILP-based hybrid solar+storage optimization for gas plant co-location",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class OptimizeRequest(BaseModel):
    plant_id: str
    target_load_mw: float
    max_gas_backup_pct: float = Field(default=0.05, ge=0.0, le=1.0)
    commissioning_year: int = Field(default=2028, ge=2024, le=2040)
    cost_scenario: str = Field(default="base")
    conflict_pct: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    solar_profile: Optional[list[float]] = None
    latitude: Optional[float] = None
    gas_heat_rate_btu_kwh: Optional[float] = Field(default=None, gt=0)
    gas_capacity_factor: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    solar_cf_hint: Optional[float] = Field(default=None, ge=0.0)
    max_solar_mw: Optional[float] = Field(default=None, ge=0.0)


class DispatchHourResponse(BaseModel):
    hour: int
    solar_mw: float
    battery_mw: float
    gas_mw: float
    load_mw: float
    soc: float


class LcoeBreakdownResponse(BaseModel):
    solar_cost: float
    battery_cost: float
    gas_cost: float
    excess_solar_revenue: float
    total: float


class OptimizeResponse(BaseModel):
    solar_capacity_mw: float
    battery_power_mw: float
    battery_energy_mwh: float
    net_lcoe: float
    lcoe_gas_only: float
    gas_backup_actual: float
    emissions_factor: Optional[float] = None
    excess_solar_mwh: Optional[float] = None
    solar_to_load_ratio: Optional[float] = None
    conflict_hours: Optional[int] = None
    solver_status: str
    lcoe_breakdown: Optional[LcoeBreakdownResponse] = None
    hourly_dispatch: Optional[list[DispatchHourResponse]] = None


class RequestMeta(BaseModel):
    scenario_id: Optional[str] = None
    job_type: Literal["simulate", "optimize", "sensitivity"] = "simulate"


class SiteContext(BaseModel):
    facility_peak_load_kw: float = Field(gt=0)
    annual_energy_consumption_kwh: Optional[float] = Field(default=None, ge=0)
    current_utility_rate_usd_kwh: float = Field(gt=0)
    utility_escalation_rate_pct: float = Field(default=2.0, ge=0, le=15)


class AssetParameters(BaseModel):
    technology_type: Literal["reciprocating_engine", "turbine", "fuel_cell"] = "reciprocating_engine"
    nameplate_capacity_kw: float = Field(gt=0)
    turnkey_capex_usd_per_kw: float = Field(default=0, ge=0)
    soft_costs_usd: float = Field(default=0, ge=0)
    fuel_type: Literal["natural_gas", "diesel", "hydrogen", "propane"] = "natural_gas"
    fuel_price_usd_per_mmbtu: float = Field(gt=0)
    fuel_escalator_pct: float = Field(default=2.0, ge=0, le=25)
    heat_rate_btu_kwh: float = Field(gt=0)
    fixed_om_usd_year: float = Field(default=0, ge=0)
    variable_om_usd_kwh: float = Field(default=0, ge=0)
    availability_factor: float = Field(default=0.95, gt=0, le=1)


class FinancialAssumptions(BaseModel):
    federal_tax_rate_pct: float = Field(default=21.0, ge=0, le=100)
    discount_rate_pct: float = Field(default=8.0, ge=0, le=100)
    debt_equity_ratio_pct: float = Field(default=0.0, ge=0, le=100)
    loan_interest_rate_pct: float = Field(default=6.5, ge=0, le=100)
    loan_term_years: int = Field(default=10, ge=1, le=30)
    itc_rate_pct: float = Field(default=0.0, ge=0, le=100)
    inflation_rate_pct: float = Field(default=2.5, ge=0, le=100)


class BYOGScenarioRequest(BaseModel):
    request_meta: Optional[RequestMeta] = None
    site_context: SiteContext
    asset_parameters: AssetParameters
    financial_assumptions: Optional[FinancialAssumptions] = None
    byoc_inputs: Optional[dict[str, Any]] = None


class OptimizationConstraint(BaseModel):
    metric: str
    operator: Literal["less_than", "less_than_equal", "greater_than", "greater_than_equal", "equal"]
    value: float


class DecisionVariableRange(BaseModel):
    min: float
    max: float
    step: float = Field(gt=0)
    path: Optional[str] = None


class SingleVariableGoalSeek(BaseModel):
    mode: Literal["single_variable_goal_seek"]
    target_variable: str
    target_value: float
    decision_variable: dict[str, Any]


class MultiVariableOptimization(BaseModel):
    mode: Literal["multi_variable"]
    target_variable: str
    goal: Literal["maximize", "minimize"] = "maximize"
    constraints: list[OptimizationConstraint] = Field(default_factory=list)
    decision_variables: dict[str, DecisionVariableRange]


class SensitivityAxis(BaseModel):
    path: str
    min: float
    max: float
    step: float = Field(gt=0)


class SensitivityHeatmapJob(BaseModel):
    mode: Literal["sensitivity_heatmap"]
    x_axis: SensitivityAxis
    y_axis: SensitivityAxis
    z_metric: str


class BYOGOptimizeRequest(BaseModel):
    request_meta: Optional[RequestMeta] = None
    site_context: SiteContext
    asset_parameters: AssetParameters
    financial_assumptions: Optional[FinancialAssumptions] = None
    byoc_inputs: Optional[dict[str, Any]] = None
    optimization_job: dict[str, Any]


# ---------------------------------------------------------------------------
# Cost scenario definitions
# ---------------------------------------------------------------------------

COST_SCENARIOS = {
    "base": {
        "solar_capex_per_kw": 950,
        "battery_energy_capex_per_kwh": 250,
        "battery_power_capex_per_kw": 150,
        "solar_om_per_kw_year": 12.0,
        "battery_om_per_kw_year": 8.0,
        "inverter_efficiency": 0.97,
        "battery_rte": 0.87,
        "wacc": 0.06,
        "solar_life_years": 30,
        "battery_life_years": 20,
        "gas_price_per_mmbtu": 3.50,
        "description": "Base case: mid-range 2028 cost assumptions",
    },
    "low": {
        "solar_capex_per_kw": 750,
        "battery_energy_capex_per_kwh": 180,
        "battery_power_capex_per_kw": 120,
        "solar_om_per_kw_year": 10.0,
        "battery_om_per_kw_year": 6.0,
        "inverter_efficiency": 0.97,
        "battery_rte": 0.90,
        "wacc": 0.05,
        "solar_life_years": 30,
        "battery_life_years": 20,
        "gas_price_per_mmbtu": 3.50,
        "description": "Optimistic: aggressive cost declines for solar+storage",
    },
    "high": {
        "solar_capex_per_kw": 1200,
        "battery_energy_capex_per_kwh": 320,
        "battery_power_capex_per_kw": 200,
        "solar_om_per_kw_year": 15.0,
        "battery_om_per_kw_year": 10.0,
        "inverter_efficiency": 0.96,
        "battery_rte": 0.85,
        "wacc": 0.08,
        "solar_life_years": 30,
        "battery_life_years": 20,
        "gas_price_per_mmbtu": 5.00,
        "description": "Conservative: higher costs and gas price sensitivity",
    },
    "high_gas": {
        "solar_capex_per_kw": 950,
        "battery_energy_capex_per_kwh": 250,
        "battery_power_capex_per_kw": 150,
        "solar_om_per_kw_year": 12.0,
        "battery_om_per_kw_year": 8.0,
        "inverter_efficiency": 0.97,
        "battery_rte": 0.87,
        "wacc": 0.06,
        "solar_life_years": 30,
        "battery_life_years": 20,
        "gas_price_per_mmbtu": 6.00,
        "description": "Base renewables costs with elevated natural gas prices",
    },
}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/optimize", response_model=OptimizeResponse)
async def optimize(request: OptimizeRequest):
    """Run the MILP optimization for a hybrid solar+storage configuration."""
    logger.info(
        "Optimization request: plant_id=%s target_load=%.1f MW gas_backup_max=%.1f%% scenario=%s",
        request.plant_id,
        request.target_load_mw,
        request.max_gas_backup_pct * 100,
        request.cost_scenario,
    )

    if request.cost_scenario not in COST_SCENARIOS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown cost scenario '{request.cost_scenario}'. "
                   f"Available: {list(COST_SCENARIOS.keys())}",
        )

    if request.target_load_mw <= 0:
        raise HTTPException(
            status_code=400,
            detail="target_load_mw must be positive",
        )

    if request.solar_profile is not None and len(request.solar_profile) not in (288, 8760):
        raise HTTPException(
            status_code=400,
            detail="solar_profile must have 288 (representative days) or 8760 (full year) entries",
        )

    cost_params = COST_SCENARIOS[request.cost_scenario]

    try:
        result = run_optimization(
            plant_id=request.plant_id,
            target_load_mw=request.target_load_mw,
            max_gas_backup_pct=request.max_gas_backup_pct,
            commissioning_year=request.commissioning_year,
            cost_params=cost_params,
            conflict_pct=request.conflict_pct,
            solar_profile=request.solar_profile,
            latitude=request.latitude,
            gas_heat_rate_btu_kwh=request.gas_heat_rate_btu_kwh,
            gas_capacity_factor=request.gas_capacity_factor,
            solar_cf_hint=request.solar_cf_hint,
            max_solar_mw=request.max_solar_mw,
        )
    except ValueError as exc:
        logger.error("Validation error during optimization: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Optimization failed unexpectedly")
        raise HTTPException(
            status_code=500,
            detail=f"Optimization failed: {exc}",
        )

    logger.info(
        "Optimization complete: solar=%.1f MW  battery=%.1f MW/%.1f MWh  LCOE=%.2f $/MWh  status=%s",
        result["solar_capacity_mw"],
        result["battery_power_mw"],
        result["battery_energy_mwh"],
        result["net_lcoe"],
        result["solver_status"],
    )

    return OptimizeResponse(**result)


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/cost-scenarios")
async def get_cost_scenarios():
    """Return available cost scenarios with their parameters."""
    return {
        name: {
            "description": params["description"],
            "solar_capex_per_kw": params["solar_capex_per_kw"],
            "battery_energy_capex_per_kwh": params["battery_energy_capex_per_kwh"],
            "battery_power_capex_per_kw": params["battery_power_capex_per_kw"],
            "solar_om_per_kw_year": params["solar_om_per_kw_year"],
            "battery_om_per_kw_year": params["battery_om_per_kw_year"],
            "inverter_efficiency": params["inverter_efficiency"],
            "battery_rte": params["battery_rte"],
            "wacc": params["wacc"],
            "gas_price_per_mmbtu": params["gas_price_per_mmbtu"],
        }
        for name, params in COST_SCENARIOS.items()
    }


@app.post("/simulate")
async def simulate(request: BYOGScenarioRequest):
    payload = request.model_dump(exclude_none=True)
    try:
        return CalculationClass(payload).run()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Simulation failed")
        raise HTTPException(status_code=500, detail=f"Simulation failed: {exc}")


@app.post("/optimize/byog")
async def optimize_byog(request: BYOGOptimizeRequest):
    payload = request.model_dump(exclude_none=True)
    try:
        service = OptimizerService(payload)
        job = payload["optimization_job"]
        mode = job.get("mode")

        if mode == "single_variable_goal_seek":
            return service.single_variable_goal_seek(job)
        if mode == "multi_variable":
            return service.multi_variable_optimize(job)
        if mode == "sensitivity_heatmap":
            return service.dynamic_sensitivity_heatmap(job)

        raise HTTPException(
            status_code=400,
            detail="optimization_job.mode must be one of: single_variable_goal_seek, multi_variable, sensitivity_heatmap",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("BYOG optimization failed")
        raise HTTPException(status_code=500, detail=f"Optimization failed: {exc}")
