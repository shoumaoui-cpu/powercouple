# BYOC Data Center Financial Model — Revised Specification v2

## 1. PRODUCT DEFINITION

### 1.1 Core Question the Model Answers

**"At what point does the revenue lost from curtailing tenant load exceed the annualized capital cost of building additional physical generation and storage capacity?"**

The model finds the economically efficient point on the curtailment-vs-overbuild frontier. Curtailment and physical capacity are substitutes: curtailment avoids capital expenditure but destroys revenue; overbuild preserves revenue but requires capital. The optimizer walks up the curtailment cost curve — tier by tier — until the marginal cost of the next megawatt-hour of curtailment exceeds the marginal cost of the next megawatt of physical capacity. That crossing point defines the optimal resource portfolio.

### 1.2 User

The primary user is the **developer of colocated load and generation capacity** — someone who understands both data center economics and power system fundamentals, runs scenarios iteratively, and needs to see the math behind every number.

### 1.3 Deployment

Single-page React web application. No export requirements. The application must feel native to users accustomed to Excel-based financial models: tabbed sheets, cell-level auditability, and transparent calculation logic.

### 1.4 Scope Boundaries — What This Model Is NOT

- **Not levered.** This version is 100% equity, unlevered analysis only. No debt sizing, no DSCR, no debt service waterfall. Leverage can be added in a future version.
- **Not a tax equity model.** No ITC, PTC, MACRS, partnership flip, or tax credit logic.
- **Not a demand response model.** Curtailment is purely revenue destruction — the facility sheds load and loses the associated revenue. There are no demand response payments, capacity payments, or curtailment revenues of any kind.
- **No geothermal resource.** Excluded from this version.
- **No combined cycle vs. peaker distinction.** Gas is modeled as a single dispatchable thermal resource type.

---

## 2. APPLICATION ARCHITECTURE

### 2.1 Technology Stack

- **Framework:** React with functional components and hooks
- **Visualization:** Recharts
- **Styling:** Tailwind CSS
- **State Management:** Zustand (recommended). A single centralized store holds all model state organized into three slices:
  - `inputs` slice: all user-editable assumptions (Sheet 1)
  - `calculations` slice: all derived values, dispatch results, optimization outputs (Sheet 2)
  - `ui` slice: active sheet tab, formula audit mode toggle, override mode, loading states
- **Computation:** Web Workers for the dispatch simulation and optimization engine. The main thread never runs the 8,760-hour loop. All heavy computation is dispatched to a worker, which posts results back to the store.
- **Recalculation Strategy:** Debounced. Input changes trigger recalculation after a 500ms pause in user input (not on every keystroke). A loading indicator displays while computation is in progress. Intermediate results (capital costs, revenue projections) that don't depend on the dispatch simulation update immediately; dispatch-dependent results update when the worker completes.

### 2.2 Sheet Structure

Seven sheets accessed via tabs styled as Excel-like sheet tabs fixed to the bottom of the viewport:

| Sheet | Name | Purpose |
|-------|------|---------|
| 1 | Inputs | All user assumptions. No calculations. |
| 2 | Calculations | All intermediate calculations, optimization engine, dispatch results. |
| 3 | Sources & Uses | Capital cost breakdown and funding (100% equity). |
| 4 | Cash Flow Schedule | 30-year annual waterfall. |
| 5 | Returns | IRR, NPV, multiples, payback, cost metrics. |
| 6 | Sensitivity | 2D matrix exploring curtailment vs. overbuild frontier. |
| 7 | Charts | All visualizations. |

### 2.3 Formula Audit Mode

Activated via a toggle button in the application header (labeled "Show Formulas" with a keyboard shortcut `Ctrl+`` mirroring Excel). When active:

- Every calculated value in the UI displays a tooltip on hover showing:
  - The formula in human-readable notation (e.g., `= Peak Load × (1 + Reserve Margin) × Firm Requirement %`)
  - The resolved values (e.g., `= 100 MW × 1.15 × 0.85 = 97.75 MW`)
  - The source sheet and input name for each referenced value
- Calculated cells receive a dotted blue underline to indicate they are inspectable.
- Input cells receive a dotted yellow underline to indicate they are user-editable source values.
- A sidebar panel can optionally display the full dependency chain for any selected value (what depends on this value, and what this value depends on).

This replaces Excel's native formula bar and Ctrl+` mode with a richer, more readable implementation suited to a web application.

### 2.4 Color Coding (FAST Standard Adapted for Web)

| Background Color | Meaning | Usage |
|-----------------|---------|-------|
| Light yellow (`#FFFDE7`) | User input | All editable input fields |
| Light blue (`#E3F2FD`) | Calculated value | All derived/computed values |
| White / light gray (`#F5F5F5`) | Label / header | Section headers, row labels |
| Light green (`#E8F5E9`) | Positive / favorable | Positive cash flows, metrics above targets |
| Light red / pink (`#FFEBEE`) | Negative / warning | Negative cash flows, metrics below thresholds |
| Gray (`#E0E0E0`) | Disabled / not applicable | Unused inputs, locked fields |

Bold borders around subtotals and key summary metrics. Headers in bold weight. Input values in regular weight on yellow background. Calculated values in regular weight on blue background.

---

## 3. SHEET 1 — INPUTS

All values on this sheet are raw user inputs. No formulas, no calculations, no derived values. Every input has:
- A descriptive label
- Units clearly displayed (MW, $/kW, %, years, etc.)
- A rational bound (min/max) enforced by the UI with validation messages
- A default value representing a reasonable base case
- Yellow background per FAST color coding

### 3.1 Input Validation Philosophy

Use **rational physical and financial limiters**. The UI prevents logically impossible inputs at entry time. Examples:
- Curtailable load cannot exceed peak load
- Minimum operating load cannot exceed peak load
- Capacity factors must be between 0% and 100%
- Battery duration must be > 0 if battery is included in the resource mix
- Costs cannot be negative
- Percentages that represent physical quantities (degradation, efficiency) are bounded by physical reality
- The loan-to-cost field does not exist in this version (unlevered only)

When an input violates a bound, the field border turns red, a validation message appears below the field, and the invalid value is not propagated to calculations.

**Cross-input validation:** Some constraints involve relationships between inputs. These are checked when recalculation is triggered:
- Minimum operating load < Peak load
- Curtailable load ≤ Peak load − Minimum operating load
- Leasable IT capacity ≤ Total IT capacity
- Peak IT load ≤ Total IT capacity
- Construction sub-periods should sum logically to total construction period

Cross-validation failures display as warning banners at the top of the Inputs sheet, listing all conflicts.

---

### Section A — Site & Land

| Input | Units | Default | Bounds | Notes |
|-------|-------|---------|--------|-------|
| Site location / region | Text | — | — | Reference only, for documentation |
| Land parcel size | Acres | 100 | 1 – 10,000 | |
| Land cost per acre | $/acre | 25,000 | 0 – 1,000,000 | |

---

### Section B — Pre-Construction Development Costs

These represent the full "shovel-ready" cost stack — everything required before breaking ground.

| Input | Units | Default | Bounds |
|-------|-------|---------|--------|
| Permitting & regulatory approvals | $ | 500,000 | 0 – 50M |
| Environmental studies (Phase I/II/III) | $ | 300,000 | 0 – 20M |
| Geotechnical & engineering studies | $ | 200,000 | 0 – 10M |
| Interconnection application & studies | $ | 1,000,000 | 0 – 50M |
| Legal fees (land, easements, permitting) | $ | 400,000 | 0 – 20M |
| Title & property insurance during development | $ | 150,000 | 0 – 10M |
| Development management fees | $ | 500,000 | 0 – 20M |
| Site preparation (clearing, grading, roads) | $ | 2,000,000 | 0 – 100M |
| Utility coordination & preliminary infrastructure | $ | 300,000 | 0 – 20M |
| Financing fees (bridge loan, commitment, closing) | $ | 250,000 | 0 – 20M |
| Pre-construction contingency | % of above subtotal | 7.5% | 0% – 25% |

---

### Section C — Data Center Capital Costs

| Input | Units | Default | Bounds |
|-------|-------|---------|--------|
| Total IT load capacity | MW | 100 | 1 – 5,000 |
| Peak IT load (day-1 utilization) | MW | 85 | 1 – Total IT capacity |
| Power Usage Effectiveness (PUE) | Ratio | 1.25 | 1.0 – 3.0 |
| Data center build cost | $/kW-IT | 8,000 | 1,000 – 30,000 |

**Derived display (informational, not input):**
- Peak site load = Peak IT load × PUE
- Day-1 total facility electrical demand

---

### Section D — Revenue Assumptions

| Input | Units | Default | Bounds |
|-------|-------|---------|--------|
| Leasable IT capacity | MW | 100 | 0 – Total IT capacity |
| Retail colocation rate (day-1) | $/kW-IT/month | 150 | 0 – 1,000 |
| Annual rate escalator | % | 2.5 | 0 – 10 |
| Target utilization ramp (year 1) | % | 70 | 0 – 100 |
| Target utilization ramp (year 2) | % | 85 | 0 – 100 |
| Target utilization ramp (year 3+) | % | 95 | 0 – 100 |

---

### Section E — Curtailment Assumptions

These define how much load can be curtailed, in what tiers, and at what regulatory or contract cost. Curtailment is pure revenue destruction — no curtailment payments or credits are received.

| Input | Units | Default | Bounds |
|-------|-------|---------|--------|
| Curtailable load (max shed) | MW | 15 | 0 – Peak load |
| Minimum operating load | MW | 70 | 0 – Peak load |
| Maximum annual curtailment hours | hrs/yr | 300 | 0 – 8,760 |
| Maximum single-event duration | hrs | 8 | 1 – 720 |
| SLA penalty rate | $/MWh curtailed | 150 | 0 – 10,000 |

**Curtailment Tiers (3 tiers minimum):**

| Tier | Load Shed (MW) | Hourly Revenue Loss ($/MWh) |
|------|---------------|----------------------------|
| Tier 1 | First 5 MW | Base rate equivalent |
| Tier 2 | Next 5 MW | 1.5× base rate |
| Tier 3 | Next 5 MW | 2.5× base rate + SLA penalty |

Users can modify the number of tiers, the MW depth of each tier, and the cost multiplier for each tier. The UI should support between 1 and 10 tiers with an "Add Tier / Remove Tier" button.

---

### Section F — Generation Capital Costs

#### Solar

| Input | Units | Default | Bounds |
|-------|-------|---------|--------|
| Include solar? | Toggle (Y/N) | Yes | — |
| Nameplate capacity (DC) | MW-DC | 150 | 0 – 10,000 |
| DC:AC ratio | Ratio | 1.30 | 1.0 – 2.0 |
| Capital cost (all-in installed) | $/W-DC | 0.95 | 0.10 – 5.00 |
| Annual degradation | % | 0.5 | 0 – 5 |
| Economic life | Years | 35 | 1 – 50 |
| Fixed O&M | $/kW-DC/yr | 8.00 | 0 – 100 |

#### Wind

| Input | Units | Default | Bounds |
|-------|-------|---------|--------|
| Include wind? | Toggle (Y/N) | No | — |
| Nameplate capacity (AC) | MW-AC | 0 | 0 – 10,000 |
| Capital cost (all-in installed) | $/kW | 1,300 | 100 – 10,000 |
| Annual degradation | % | 0.5 | 0 – 5 |
| Economic life | Years | 30 | 1 – 50 |
| Fixed O&M | $/kW/yr | 25.00 | 0 – 200 |

#### Battery Energy Storage (BESS)

| Input | Units | Default | Bounds |
|-------|-------|---------|--------|
| Include battery? | Toggle (Y/N) | Yes | — |
| Power capacity | MW | 50 | 0 – 10,000 |
| Duration | Hours | 4 | 0.5 – 24 |
| Round-trip efficiency | % | 87 | 50 – 100 |
| Capital cost | $/kWh | 250 | 10 – 2,000 |
| Annual augmentation cost | $/kWh-nameplate/yr | 5.00 | 0 – 100 |
| Cycle degradation | Cycles to 80% | 6,000 | 500 – 50,000 |
| Economic life | Years | 20 | 1 – 50 |

#### Natural Gas

| Input | Units | Default | Bounds |
|-------|-------|---------|--------|
| Include gas? | Toggle (Y/N) | Yes | — |
| Nameplate capacity | MW | 40 | 0 – 5,000 |
| Heat rate | BTU/kWh | 7,500 | 5,000 – 15,000 |
| Gas price | $/MMBtu | 3.50 | 0 – 50 |
| Annual gas escalator | % | 2.0 | 0 – 15 |
| Capital cost (all-in installed) | $/kW | 800 | 100 – 5,000 |
| Variable O&M | $/MWh | 5.00 | 0 – 100 |
| Fixed O&M | $/kW/yr | 12.00 | 0 – 200 |
| CO₂ emissions rate | tons CO₂/MWh | 0.40 | 0 – 2 |
| CO₂ cost (carbon tax / offset) | $/ton | 0.00 | 0 – 500 |

---

### Section G — Operating Expenses (non-fuel)

| Input | Units | Default | Bounds |
|-------|-------|---------|--------|
| Data center O&M | $/kW-IT/yr | 150 | 0 – 1,000 |
| Property taxes | % of total capital | 1.5 | 0 – 5 |
| Insurance | % of total capital | 0.5 | 0 – 5 |
| General & Administrative | $/yr | 2,000,000 | 0 – 50M |
| Management fee | % of revenue | 3 | 0 – 20 |
| Ground lease (if applicable) | $/yr | 0 | 0 – 10M |
| Annual OpEx escalator | % | 2.5 | 0 – 10 |

---

### Section H — Financial Assumptions

| Input | Units | Default | Bounds |
|-------|-------|---------|--------|
| Discount rate (WACC or equity return target) | % | 10 | 0 – 30 |
| Analysis period | Years | 30 | 1 – 50 |
| Construction period | Months | 24 | 1 – 120 |
| Construction period — DC portion | Months | 18 | 1 – construction period |
| Construction period — Gen portion | Months | 15 | 1 – construction period |
| Federal Income tax rate | % | 21 | 0 – 50 |
| State Income tax rate | % | 5 | 0 – 15 |
| Depreciation method | Dropdown | MACRS 5yr | MACRS 5/7/15/20, SL 5–40 |
| Terminal value method | Dropdown | Exit multiple | Exit multiple / Gordon growth / Zero |
| Terminal cap rate or exit multiple | x or % | 10x | 0 – 50 |
| Working capital reserve | % of year-1 OpEx | 5 | 0 – 25 |

---

### Section I — Hourly Generation Profiles

| Input | Format | Default | Notes |
|-------|--------|---------|-------|
| Solar hourly capacity factors | CSV upload or manual (8,760 values) | NREL SAM typical year (West Texas) | Each value 0.0–1.0 |
| Wind hourly capacity factors | CSV upload or manual (8,760 values) | Zeros (wind off by default) | Each value 0.0–1.0 |
| Load profile (hourly) | CSV upload or manual (8,760 values) | Flat at peak load | Each value ≥ minimum operating load |

The UI provides:
- A "paste from clipboard" option for each profile
- A "file upload" button accepting CSV
- A sparkline preview showing the uploaded or default profile
- An average / max / min / CF summary row beneath each profile input

---

## 4. SHEET 2 — CALCULATIONS

This sheet is entirely computed. No user inputs appear here. Values are read-only, displayed on light blue backgrounds per FAST convention. Every value supports formula audit mode tooltip inspection.

### 4.1 Capital Cost Roll-Up

Aggregate all resource capital expenditures:

```
Solar CapEx = Solar nameplate (MW-DC) × Solar cost ($/W-DC) × 1,000,000
Wind CapEx  = Wind nameplate (MW-AC) × Wind cost ($/kW) × 1,000
BESS CapEx  = BESS power (MW) × BESS duration (hrs) × BESS cost ($/kWh) × 1,000
Gas CapEx   = Gas nameplate (MW) × Gas cost ($/kW) × 1,000
DC CapEx    = Total IT capacity (MW) × DC build cost ($/kW-IT) × 1,000
Land CapEx  = Land size (acres) × Land cost ($/acre)
Pre-Con     = Sum of all development costs × (1 + contingency %)
```

### 4.2 Total Development Budget
```
Total CapEx = Solar CapEx + Wind CapEx + BESS CapEx + Gas CapEx + DC CapEx + Land CapEx + Pre-Con
```

### 4.3 Revenue Calculations
```
Monthly Revenue = Leasable IT capacity (kW) × Utilization % × Colocation rate ($/kW/month)
Annual Revenue  = Monthly Revenue × 12
Year-N Revenue  = Year-(N-1) Revenue × (1 + escalator)
```

Utilization follows the ramp schedule: Year 1 → input %, Year 2 → input %, Year 3+ → input %.

### 4.4 Dispatch Simulation Engine (Web Worker)

The dispatch engine operates on an 8,760-hour loop for each year of the analysis period. It runs in a dedicated Web Worker thread.

**Dispatch Order (simplified priority stack):**

1. **Solar** generates per hourly capacity factor × nameplate (DC) / DC:AC ratio, subject to annual degradation.
2. **Wind** generates per hourly capacity factor × nameplate, subject to annual degradation.
3. **Battery** charges from any surplus renewable generation (generation > load) and discharges when generation < load, subject to:
   - State of charge limits (0% to 100%)
   - Round-trip efficiency applied symmetrically (√RTE on charge, √RTE on discharge)
   - Power capacity limits (MW)
   - Energy capacity limits (MWh)
   - Degradation modeled as capacity fade proportional to cumulative throughput relative to cycle life
4. **Gas** dispatches to fill remaining deficit (load − renewable − battery discharge), up to nameplate capacity.
5. **Curtailment** is invoked only when gas is fully dispatched AND there is still a generation shortfall. Curtailment is applied tier by tier, cheapest first, up to the maximum curtailable load and maximum hourly limits.

**Hourly outputs stored in memory (per hour):**
- Solar generation (MWh)
- Wind generation (MWh)
- Battery charge (MWh), discharge (MWh), state of charge (MWh)
- Gas generation (MWh), fuel consumed (MMBtu)
- Curtailed load (MWh), by tier
- Unserved energy (MWh) — any remaining shortfall after all resources and all curtailment tiers are exhausted

**Annual summary outputs (aggregated from hourly):**
- Total generation by source (MWh)
- Capacity factors realized (%)
- Total curtailment (MWh, hours, events)
- Total gas fuel consumed (MMBtu) and cost ($)
- Total CO₂ emissions (tons) and cost ($)
- Battery cycles completed, remaining capacity (%)
- Unserved energy total (MWh)

### 4.5 Curtailment Cost Calculation
```
Curtailment Cost (annual) = Σ over all curtailment hours [
  Tier 1 MWh × Tier 1 cost
  + Tier 2 MWh × Tier 2 cost
  + Tier 3 MWh × Tier 3 cost
  + ... (for all active tiers)
]
```

This is the revenue permanently destroyed by curtailment. No offsetting revenue is received.

### 4.6 Optimization Engine

The optimization engine finds the minimum-cost resource portfolio that satisfies the reliability constraint while minimizing total system cost (capital + operating + curtailment). It adjusts:

- Solar nameplate
- Battery power and duration
- Gas nameplate
- Curtailment tier utilization

**Constraint:** Unserved energy = 0 MWh/year (all load must be served or explicitly curtailed within tier limits).

**Objective function:**
```
Minimize: Annualized CapEx + Annual OpEx + Annual Fuel Cost + Annual Curtailment Cost
```

Annualized CapEx uses the discount rate as the annuity rate over the analysis period.

The optimizer uses a bounded grid search with refinement:
1. Coarse grid: sweep solar (50–300% of load), battery (0–12h), gas (0–100% of load) in 10% steps
2. Fine grid: refine around the best point from step 1 in 2% steps
3. Report the optimal portfolio and the marginal cost curves for each resource

**Output:** The optimal resource mix is displayed as a recommended portfolio alongside the user's manually entered portfolio, allowing comparison.

### 4.7 Depreciation Schedule

Based on the selected depreciation method, generate a year-by-year depreciation table for each asset class:
- Solar, Wind, BESS, Gas, Data Center, Land (land is not depreciated)

The depreciation feeds into the tax calculation in the cash flow sheet.

---

## 5. SHEET 3 — SOURCES & USES

Standard two-column capital budget table:

### Uses of Funds

| Line Item | Amount ($) |
|-----------|------------|
| Land acquisition | = Land CapEx |
| Pre-construction & development | = Pre-Con total |
| Data center construction | = DC CapEx |
| Solar generation | = Solar CapEx |
| Wind generation | = Wind CapEx |
| Battery storage | = BESS CapEx |
| Gas generation | = Gas CapEx |
| Working capital reserve | = WC % × Year-1 OpEx |
| **Total Uses** | **= Sum** |

### Sources of Funds

| Source | Amount ($) |
|--------|------------|
| Equity (100%) | = Total Uses |
| Debt | $0 (unlevered) |
| **Total Sources** | **= Total Uses** |

---

## 6. SHEET 4 — CASH FLOW SCHEDULE

30-year annual waterfall (or user-defined analysis period). Each column is one year. Year 0 is the construction/investment period.

### Row Structure

```
Revenue
  Colocation revenue (before curtailment)
  Less: curtailment revenue loss
  Net Revenue

Operating Expenses
  Data center O&M
  Generation fixed O&M (solar + wind + BESS + gas)
  Gas fuel cost
  CO₂ cost
  Battery augmentation cost
  Property taxes
  Insurance
  G&A
  Management fee
  Ground lease
  Total OpEx

EBITDA = Net Revenue − Total OpEx

Depreciation (from depreciation schedule)
EBT = EBITDA − Depreciation
Taxes = EBT × (Federal rate + State rate × (1 − Federal rate))
  (Taxes floored at 0 — no tax credit carryforward in this version)
Net Income = EBT − Taxes
  
Add back: Depreciation (non-cash)
Less: Working capital changes (year 1 only)
Unlevered Free Cash Flow = Net Income + Depreciation − ΔWC

Terminal Value (final year only, per method selected)

Total Cash Flow = UFCF + Terminal Value (if applicable)
```

**Year 0 row:** Single outflow equal to Total Uses from Sources & Uses.

---

## 7. SHEET 5 — RETURNS

### Key Metrics

| Metric | Formula |
|--------|---------|
| Project IRR (unlevered) | IRR of Year 0 through Year N cash flows |
| Project NPV at WACC | NPV of cash flows discounted at the discount rate |
| Equity Multiple (MOIC) | Total undiscounted cash inflows / Total equity invested |
| Simple Payback | First year where cumulative undiscounted UFCF ≥ 0 |
| Discounted Payback | First year where cumulative discounted UFCF ≥ 0 |
| LCOE — Total system | Total lifetime cost / Total lifetime generation ($/MWh) |
| LCOE — Solar only | Solar lifetime cost / Solar lifetime generation |
| LCOE — Storage-adjusted | (Solar + BESS cost) / Load served by (solar + BESS) |
| Curtailment cost per MWh avoided overbuild | Total curtailment cost / Curtailment MWh |
| Overbuild cost per MWh additional capacity | Marginal CapEx / Additional MWh generated |
| Firm capacity cost | Total CapEx / Peak firm load served ($/kW) |

### Visualization
- **NPV tornado:** Horizontal bar chart showing sensitivity of NPV to ±10% change in each input
- **IRR vs. curtailment depth:** Line chart showing how project IRR changes as maximum curtailment increases from 0 to 100% of peak load

---

## 8. SHEET 6 — SENSITIVITY

### 8.1 Two-Dimensional Sensitivity Matrix

**X-axis (columns):** Maximum curtailment depth — from 0 MW (no curtailment, full overbuild) to the user-defined maximum curtailable load, in equal steps (e.g., 0, 3, 6, 9, 12, 15 MW for a 15 MW max).

**Y-axis (rows):** Solar overbuild ratio — from 100% (nameplate = peak load) to 300% (nameplate = 3× peak load), in 25% steps.

**Cell values:** Project IRR at each combination. Cells are color-coded on a green → yellow → red gradient:
- Green (≥ hurdle rate + 2%)
- Yellow (within ±2% of hurdle rate)
- Red (< hurdle rate − 2%)

### 8.2 Optimal Frontier Highlight

The optimizer traces the minimum-cost frontier across the matrix and highlights those cells with a bold border. This shows the user the efficient tradeoff curve between curtailment and overbuild.

### 8.3 Additional Sensitivities

Below the main matrix, display one-way sensitivity tables for:
- Colocation rate (±30% in 10% steps)
- Gas price (±50% in 10% steps)
- Battery cost (±40% in 10% steps)
- Discount rate (6% to 14% in 1% steps)

Each table shows the resulting Project IRR and NPV.

---

## 9. SHEET 7 — CHARTS

All visualizations on a dedicated sheet. Charts should be interactive (hover tooltips, zoom).

### 9.1 Generation Stack (Area Chart)
- X-axis: Hour of year (1–8,760) or Month (aggregated)
- Y-axis: MW
- Stacked areas: Solar, Wind, Battery Discharge, Gas
- Overlay line: Total load (before curtailment)
- Overlay line: Served load (after curtailment)
- Below-axis area (inverted): Battery Charging
- Toggle between hourly and monthly aggregation

### 9.2 Duration Curve
- X-axis: Hours (sorted, 1–8,760)
- Y-axis: MW
- Line 1: Load duration curve
- Line 2: Net load after renewables
- Line 3: Residual load after battery
- Shaded area: Gas dispatch
- Shaded area: Curtailment

### 9.3 Curtailment Analysis
- **Curtailment frequency histogram:** X = curtailment depth (MW), Y = hours at that depth
- **Monthly curtailment heatmap:** Rows = months, Columns = hours of day, Color = curtailment frequency/depth
- **Curtailment cost curve:** X = curtailable MW (cumulative), Y = marginal cost ($/MWh), showing tier steps

### 9.4 Cash Flow Waterfall
- Standard waterfall chart: Year 0 negative bar (investment), positive bars (UFCF), with cumulative line overlay
- Color-coded by positive/negative

### 9.5 Returns Sensitivity Spider Chart
- Center: base case IRR
- Axes: 5 key inputs (colocation rate, solar cost, battery cost, gas price, discount rate)
- Lines trace IRR impact of ±20% variation in each input

### 9.6 Resource Mix Comparison
- Side-by-side bar chart: User-defined portfolio vs. Optimizer-recommended portfolio
- Bars for each resource type (Solar, Wind, BESS, Gas)
- Annotation: total cost and IRR for each portfolio

---

## 10. ADDITIONAL BEHAVIORAL REQUIREMENTS

### 10.1 Recalculation Flow
1. User modifies an input on Sheet 1.
2. After 500ms debounce, the store dispatches recalculation.
3. Capital costs, revenue projections, and other non-dispatch calculations update immediately (~5ms).
4. The dispatch simulation is sent to the Web Worker. A loading spinner appears on dispatch-dependent outputs (Sheets 2, 4, 5, 6, 7).
5. When the worker completes, results are posted back to the store and all dependent views update.
6. If the user modifies another input while computation is in progress, the in-flight worker is terminated and a new computation is queued (debounced).

### 10.2 Number Formatting
- Currency: $X,XXX,XXX (no cents for amounts > $1,000; two decimal places for unit costs < $100)
- Percentages: X.X% (one decimal)
- Energy: X,XXX MWh or X.X GWh for values > 10,000 MWh
- Power: X.X MW
- Capacity factors: XX.X%

### 10.3 Responsive Behavior
Designed for desktop screens (1440px+). At narrower widths, the sheet tabs collapse into a dropdown menu. Charts maintain aspect ratios. Tables become horizontally scrollable.

### 10.4 Error States
- Division by zero: Display "—" (em dash)
- Negative IRR scenarios: Display "< 0%" with red background
- Invalid inputs: Prevent propagation; show validation error
- Worker timeout (> 30 seconds): Cancel and display timeout message with option to retry with simplified dispatch (monthly instead of hourly)
