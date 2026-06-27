"use strict";

const DEFAULT_ASSUMPTIONS = {
  startYear: 2026,
  horizonYears: 20,
  annualKm: 2500,
  currentAge: 47,
  drivingYearsRemaining: 25,
  cycleHorizonYears: 25,
  discountRate: 0.02,
  inflationRate: 0,
  currentVehicle: {
    name: "トヨタ ノア HEV Welcab",
    purchaseYear: 2022,
    ageAtStart: 4,
    nextInspectionYear: 2027,
    appraisal: 3014000,
    loanBalance: 1491000,
    loanMonthly: 27800,
    loanEndYear: 2027,
    loanFinal: 1304600
  },
  newVehicle: {
    estimateTotal: 4276000,
    tradeIn: 3014000,
    loanMonthly: 43047.333333333336,
    bonusPerPayment: 0,
    bonusPaymentsPerYear: 0,
    loanYears: 5,
    loanFinal: 1599000,
    interestRate: 0.061
  },
  annualCosts: {
    autoTax: 0,
    insurance: 80000,
    fuel: 30000,
    maintenance: 30000,
    inspection: 160000,
    inspectionCycleYears: 2,
    welcabExtraRepair: 15000
  },
  repairExpected: {
    through5Years: 10000,
    years6to10: 35000,
    years11to15: 70000,
    after16Years: 120000
  },
  depreciation: {
    currentVehicleRetentionByYearsFromStart: {
      0: 1,
      1: 0.82,
      2: 0.6724,
      3: 0.551368,
      4: 0.452122,
      5: 0.37074,
      6: 0.304007,
      7: 0.249285,
      8: 0.204414,
      9: 0.16762,
      10: 0.137448,
      11: 0.112707,
      12: 0.09242,
      13: 0.075784,
      14: 0.062143,
      15: 0.050957,
      16: 0.041785,
      17: 0.034264,
      18: 0.028096,
      19: 0.023039,
      20: 0.018892
    },
    newVehicleRetentionByAge: {
      1: 1,
      2: 0.78,
      3: 0.6084,
      4: 0.474552,
      5: 0.370151,
      6: 0.288717,
      7: 0.2252,
      8: 0.175656,
      9: 0.137011,
      10: 0.106869,
      11: 0.083358,
      12: 0.065019,
      13: 0.050715,
      14: 0.039558,
      15: 0.030855,
      16: 0.03,
      17: 0.03,
      18: 0.03,
      19: 0.03,
      20: 0.03
    },
    minimumValueRate: 0.03
  },
  scenarios: [
    { id: "before_inspection_5", name: "5年目車検前", replacementBeforeInspectionYear: 5 },
    { id: "before_inspection_7", name: "7年目車検前", replacementBeforeInspectionYear: 7 },
    { id: "before_inspection_9", name: "9年目車検前", replacementBeforeInspectionYear: 9 },
    { id: "before_inspection_11", name: "11年目車検前", replacementBeforeInspectionYear: 11 },
    { id: "before_inspection_13", name: "13年目車検前", replacementBeforeInspectionYear: 13 },
    { id: "replace_before_15th_inspection", name: "15年目車検前", replacementBeforeInspectionYear: 15 }
  ]
};

const DEFAULT_MAINTENANCE_EVENTS = {
  events: [
    { id: "tires", name: "タイヤ交換", amount: 120000, startVehicleAge: 8, repeatEveryYears: 8, probability: 1 },
    { id: "aux_battery", name: "補機バッテリー", amount: 50000, startVehicleAge: 7, repeatEveryYears: 7, probability: 1 },
    { id: "air_conditioner", name: "エアコン修理", amount: 150000, startVehicleAge: 15, repeatEveryYears: null, probability: 1 },
    { id: "suspension", name: "足回り修理", amount: 150000, startVehicleAge: 15, repeatEveryYears: null, probability: 1 },
    { id: "hv_battery", name: "HVバッテリー", amount: 300000, startVehicleAge: 18, repeatEveryYears: null, probability: 0.3 },
    { id: "welcab_major", name: "Welcab大型修理", amount: 200000, startVehicleAge: 15, repeatEveryYears: null, probability: 0.3 }
  ]
};

const state = {
  assumptions: structuredClone(DEFAULT_ASSUMPTIONS),
  maintenanceEvents: structuredClone(DEFAULT_MAINTENANCE_EVENTS),
  results: [],
  selectedScenarioId: "before_inspection_5"
};

const form = document.querySelector("#assumptionForm");
const scenarioTableBody = document.querySelector("#scenarioTableBody");
const annualScenarioComparisonTableHead = document.querySelector("#annualScenarioComparisonTableHead");
const annualScenarioComparisonTableBody = document.querySelector("#annualScenarioComparisonTableBody");
const cashflowTableBody = document.querySelector("#cashflowTableBody");
const costRulesContent = document.querySelector("#costRulesContent");
const yenFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0
});
const numberFormatter = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 });

document.addEventListener("DOMContentLoaded", init);

async function init() {
  await loadJsonDefaults();
  populateForm();
  bindEvents();
  recalculate();
}

async function loadJsonDefaults() {
  if (location.protocol === "file:") {
    setStatus("ローカル直接起動: 内蔵初期値で計算");
    return;
  }

  try {
    const [assumptionsResponse, eventsResponse] = await Promise.all([
      fetch("./assumptions.json", { cache: "no-store" }),
      fetch("./maintenance-events.json", { cache: "no-store" })
    ]);
    if (!assumptionsResponse.ok) throw new Error(`assumptions HTTP ${assumptionsResponse.status}`);
    if (!eventsResponse.ok) throw new Error(`maintenance-events HTTP ${eventsResponse.status}`);
    state.assumptions = await assumptionsResponse.json();
    state.maintenanceEvents = await eventsResponse.json();
    setStatus("assumptions.json / maintenance-events.json を読み込み済み");
  } catch (error) {
    setStatus("JSON読込失敗: 内蔵初期値で計算");
  }
}

function bindEvents() {
  form.addEventListener("input", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    setByPath(state.assumptions, input.name, parseInputValue(input));
    recalculate();
  });

  const headerActions = document.querySelector(".header-actions");
  headerActions.addEventListener("pointerdown", (event) => {
    const button = event.target.closest("[data-action='copy-json']");
    if (!button) return;
    copyJson();
  });
  headerActions.addEventListener("keydown", (event) => {
    const button = event.target.closest("[data-action='copy-json']");
    if (!button || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    copyJson();
  });
  headerActions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "download-json") {
      downloadFile("car-cost-assumptions.json", JSON.stringify(state.assumptions, null, 2), "application/json");
    }
    if (button.dataset.action === "download-csv") {
      downloadFile("car-cost-scenarios.csv", buildComparisonCsv(state.results), "text/csv;charset=utf-8");
    }
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action='download-cashflow-csv']");
    if (!button) return;
    const selected = getSelectedResult();
    downloadFile(`car-cost-cashflow-${selected.scenario.id}.csv`, buildCashflowCsv(selected), "text/csv;charset=utf-8");
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action='download-annual-comparison-csv']");
    if (!button) return;
    downloadFile("car-cost-annual-scenario-comparison.csv", buildAnnualScenarioComparisonCsv(state.results), "text/csv;charset=utf-8");
  });
}

function populateForm() {
  for (const input of form.elements) {
    if (!(input instanceof HTMLInputElement) || !input.name) continue;
    const value = getByPath(state.assumptions, input.name);
    input.value = value ?? "";
  }
}

function recalculate() {
  state.results = state.assumptions.scenarios.map((scenario) => calculateScenario(state.assumptions, state.maintenanceEvents, scenario));
  renderDashboard();
  renderScenarioTable();
  renderCostRules();
  renderAnnualScenarioComparisonTable();
  renderCashflowTable();
}

function calculateScenario(assumptions, maintenanceEvents, scenario) {
  const rows = [];
  const horizonYears = getCycleHorizonYears(assumptions);
  const replacementYears = buildReplacementYears(scenario, horizonYears, assumptions);
  let activeReplacementIndex = null;
  let cumulativeCost = 0;

  for (let index = 0; index < horizonYears; index += 1) {
    const year = assumptions.startYear + index;
    const replacementEvent = replacementYears.includes(index);
    if (replacementEvent) activeReplacementIndex = index;

    const hasNewVehicle = activeReplacementIndex !== null;
    const vehicleAge = hasNewVehicle ? index - activeReplacementIndex + 1 : getCurrentVehicleAgeAtIndex(assumptions, index);
    const vehicleLabel = hasNewVehicle ? `買替車 ${replacementYears.indexOf(activeReplacementIndex) + 1}` : "現車";
    const driverAge = assumptions.currentAge + index;
    const inflation = Math.pow(1 + safeRate(assumptions.inflationRate), index);
    const loan = calculateLoanCost(assumptions, year, index, activeReplacementIndex);
    const running = calculateRunningCost(assumptions, vehicleAge, inflation);
    const repair = calculateRepairCost(assumptions, vehicleAge, inflation);
    const inspection = needsInspection(assumptions, year, vehicleAge, hasNewVehicle)
      ? assumptions.annualCosts.inspection * inflation
      : 0;
    const majorEvents = calculateMajorEvents(maintenanceEvents, vehicleAge, inflation);
    const eventCost = sum(majorEvents.map((event) => event.expectedCost));
    const vehicleValue = estimateVehicleValueAtIndex(assumptions, index, hasNewVehicle, vehicleAge);
    const netAsset = estimateNetAssetAtIndex(assumptions, year, index, activeReplacementIndex, hasNewVehicle, vehicleAge);
    const finalSaleAmount = index === horizonYears - 1 ? vehicleValue : 0;
    const total = loan + running + repair + inspection + eventCost;
    const loanMonthlyEquivalent = loan / 12;
    const annualMonthly = total / 12;
    cumulativeCost += total;
    const cumulativeAverageMonthly = cumulativeCost / ((index + 1) * 12);
    const events = [];
    if (replacementEvent) events.push("買替");
    if (inspection > 0) events.push("車検");
    if (finalSaleAmount > 0) events.push("最終売却");

    rows.push({
      year,
      driverAge,
      vehicleAge,
      vehicleLabel,
      event: events.join(" / ") || "-",
      loan,
      loanMonthlyEquivalent,
      running,
      repair,
      inspection,
      majorEvents,
      eventCost,
      vehicleValue,
      netAsset,
      finalSaleAmount,
      total,
      annualMonthly,
      cumulativeCost,
      cumulativeAverageMonthly
    });
  }

  const totalCost = sum(rows.map((row) => row.total));
  const eventCostTotal = sum(rows.map((row) => row.eventCost));
  const npv = sum(rows.map((row, index) => row.total / Math.pow(1 + safeRate(assumptions.discountRate), index)));
  const finalRow = rows[rows.length - 1];
  const finalSaleAmount = finalRow?.finalSaleAmount ?? 0;
  const effectiveCostAfterSale = totalCost - finalSaleAmount;
  const months = rows.length * 12;
  const totalKm = assumptions.annualKm * rows.length;

  return {
    scenario,
    rows,
    horizonYears: rows.length,
    endAge: assumptions.currentAge + rows.length,
    replacementCount: replacementYears.length,
    inspectionCount: rows.filter((row) => row.inspection > 0).length,
    eventCostTotal,
    totalCost,
    averageMonthly: months > 0 ? totalCost / months : 0,
    npv,
    finalVehicleValue: finalRow?.vehicleValue ?? 0,
    finalSaleAmount,
    effectiveCostAfterSale,
    averageMonthlyAfterSale: months > 0 ? effectiveCostAfterSale / months : 0,
    yenPerKm: totalKm > 0 ? effectiveCostAfterSale / totalKm : 0,
    endNetAsset: finalRow?.netAsset ?? 0
  };
}

function getCycleHorizonYears(assumptions) {
  return Math.max(1, Number(assumptions.cycleHorizonYears || assumptions.drivingYearsRemaining || assumptions.horizonYears) || 25);
}

function buildReplacementYears(scenario, horizonYears, assumptions) {
  const years = [];
  if (scenario.keepOnly === true) return years;

  const replacementInterval = getReplacementBeforeInspectionInterval(scenario.replacementBeforeInspectionYear);
  if (!Number.isFinite(replacementInterval) || replacementInterval <= 0) return years;

  let nextReplacement = getCurrentVehicleFirstReplacementIndex(scenario, assumptions);
  if (!Number.isFinite(nextReplacement) || nextReplacement >= horizonYears - 1) return years;

  while (nextReplacement < horizonYears - 1) {
    years.push(nextReplacement);
    nextReplacement += replacementInterval;
  }
  return years;
}

function getCurrentVehicleFirstReplacementIndex(scenario, assumptions) {
  const inspectionYear = Number(scenario.replacementBeforeInspectionYear);
  const currentAgeAtStart = Number(assumptions.currentVehicle?.ageAtStart);
  if (!Number.isFinite(inspectionYear) || !Number.isFinite(currentAgeAtStart)) return NaN;
  return Math.max(0, inspectionYear - currentAgeAtStart - 1);
}

function getReplacementBeforeInspectionInterval(inspectionYear) {
  const year = Number(inspectionYear);
  if (!Number.isFinite(year) || year <= 1) return NaN;
  return year - 1;
}

function calculateLoanCost(assumptions, year, index, activeReplacementIndex) {
  const current = assumptions.currentVehicle;
  const next = assumptions.newVehicle;

  if (activeReplacementIndex === null) {
    let cost = year <= current.loanEndYear ? current.loanMonthly * 12 : 0;
    if (year === current.loanEndYear) cost += current.loanFinal;
    return cost;
  }

  const loanYearIndex = index - activeReplacementIndex;
  if (loanYearIndex >= next.loanYears) return 0;

  let cost = next.loanMonthly * 12 + next.bonusPerPayment * next.bonusPaymentsPerYear;
  if (loanYearIndex === next.loanYears - 1) cost += next.loanFinal;
  return cost;
}

function calculateRunningCost(assumptions, vehicleAge, inflation) {
  const costs = assumptions.annualCosts;
  return (costs.autoTax + costs.insurance + costs.fuel + costs.maintenance) * inflation;
}

function calculateRepairCost(assumptions, vehicleAge, inflation) {
  const repair = assumptions.repairExpected;
  let base = repair.after16Years;
  if (vehicleAge <= 5) base = repair.through5Years;
  else if (vehicleAge <= 10) base = repair.years6to10;
  else if (vehicleAge <= 15) base = repair.years11to15;
  return (base + assumptions.annualCosts.welcabExtraRepair) * inflation;
}

function calculateMajorEvents(maintenanceEvents, vehicleAge, inflation) {
  return (maintenanceEvents.events || [])
    .filter((event) => matchesMaintenanceEvent(event, vehicleAge))
    .map((event) => {
      const probability = Number.isFinite(Number(event.probability)) ? Number(event.probability) : 1;
      const expectedCost = Number(event.amount || 0) * probability * inflation;
      return {
        ...event,
        probability,
        expectedCost
      };
    });
}

function matchesMaintenanceEvent(event, vehicleAge) {
  const startAge = Number(event.startVehicleAge);
  if (!Number.isFinite(startAge) || vehicleAge < startAge) return false;

  const interval = Number(event.repeatEveryYears);
  if (!Number.isFinite(interval) || interval <= 0) return vehicleAge === startAge;
  return (vehicleAge - startAge) % interval === 0;
}

function needsInspection(assumptions, year, vehicleAge, hasNewVehicle) {
  const cycle = Math.max(1, Number(assumptions.annualCosts.inspectionCycleYears) || 2);
  const nextInspectionYear = Number(assumptions.currentVehicle.nextInspectionYear);
  if (!hasNewVehicle && Number.isFinite(nextInspectionYear)) {
    return year >= nextInspectionYear && (year - nextInspectionYear) % cycle === 0;
  }
  return vehicleAge >= 3 && (vehicleAge - 3) % cycle === 0;
}

function getCurrentVehicleAgeAtIndex(assumptions, index) {
  const ageAtStart = Number(assumptions.currentVehicle.ageAtStart);
  if (Number.isFinite(ageAtStart) && ageAtStart > 0) return ageAtStart + index;
  return assumptions.startYear + index - assumptions.currentVehicle.purchaseYear;
}

function estimateCurrentVehicleValue(assumptions, yearsFromStart) {
  const retention = lookupRetention(
    assumptions.depreciation?.currentVehicleRetentionByYearsFromStart,
    yearsFromStart,
    0.82
  );
  return assumptions.currentVehicle.appraisal * retention;
}

function estimateNewVehicleValue(assumptions, age) {
  const minimumRate = assumptions.depreciation?.minimumValueRate ?? 0.03;
  const retention = lookupRetention(
    assumptions.depreciation?.newVehicleRetentionByAge,
    age,
    0.78,
    1
  );
  const value = assumptions.newVehicle.estimateTotal * retention;
  return Math.max(value, assumptions.newVehicle.estimateTotal * minimumRate);
}

function lookupRetention(table, key, fallbackAnnualRate, exponentOffset = 0) {
  if (table && Number.isFinite(Number(table[key]))) return Number(table[key]);
  return Math.pow(fallbackAnnualRate, Math.max(0, key - exponentOffset));
}

function estimateVehicleValueAtIndex(assumptions, index, hasNewVehicle, vehicleAge) {
  if (hasNewVehicle) return estimateNewVehicleValue(assumptions, vehicleAge);
  return estimateCurrentVehicleValue(assumptions, index);
}

function estimateNetAssetAtIndex(assumptions, year, index, activeReplacementIndex, hasNewVehicle, vehicleAge) {
  if (!hasNewVehicle || activeReplacementIndex === null) {
    return estimateCurrentVehicleValue(assumptions, index) - estimateCurrentLoanBalance(assumptions, year);
  }
  const yearInNewLoan = index - activeReplacementIndex;
  return estimateNewVehicleValue(assumptions, vehicleAge) - estimateNewLoanBalance(assumptions, yearInNewLoan);
}

function estimateCurrentLoanBalance(assumptions, year) {
  if (year > assumptions.currentVehicle.loanEndYear) return 0;
  if (year === assumptions.currentVehicle.loanEndYear) return assumptions.currentVehicle.loanFinal;
  return assumptions.currentVehicle.loanBalance;
}

function estimateNewLoanBalance(assumptions, yearInLoan) {
  const loanYears = assumptions.newVehicle.loanYears;
  if (yearInLoan >= loanYears) return 0;
  const yearsLeftRatio = (loanYears - yearInLoan) / loanYears;
  return assumptions.newVehicle.loanFinal + Math.max(0, assumptions.newVehicle.estimateTotal - assumptions.newVehicle.tradeIn - assumptions.newVehicle.loanFinal) * yearsLeftRatio;
}

function renderDashboard() {
  const cheapest = [...state.results].sort((a, b) => a.averageMonthlyAfterSale - b.averageMonthlyAfterSale)[0];
  const highest = [...state.results].sort((a, b) => b.averageMonthlyAfterSale - a.averageMonthlyAfterSale)[0];
  const diff = highest.averageMonthlyAfterSale - cheapest.averageMonthlyAfterSale;
  const decisionCard = document.querySelector(".metric-card.decision");

  document.querySelector("#cheapestScenario").textContent = cheapest.scenario.name;
  document.querySelector("#cheapestAmount").textContent = `${formatYen(cheapest.averageMonthlyAfterSale)} / 月`;
  document.querySelector("#totalCost25").textContent = formatYen(cheapest.totalCost);
  document.querySelector("#netCostAfterSale").textContent = formatYen(cheapest.effectiveCostAfterSale);
  document.querySelector("#averageMonthly25").textContent = formatYen(cheapest.averageMonthly);
  document.querySelector("#averageMonthlyAfterSale").textContent = formatYen(cheapest.averageMonthlyAfterSale);
  document.querySelector("#replacementCount").textContent = `${numberFormatter.format(cheapest.replacementCount)}回`;
  document.querySelector("#inspectionCount").textContent = `${numberFormatter.format(cheapest.inspectionCount)}回`;
  document.querySelector("#decisionText").textContent = "売却後実質コスト重視";
  document.querySelector("#decisionDetail").textContent = `最安平均との差は最大で月 ${formatYen(diff)}`;
  decisionCard.classList.add("is-good");
  renderUpcomingEvents();
}

function renderScenarioTable() {
  scenarioTableBody.innerHTML = "";
  for (const result of state.results) {
    const row = document.createElement("tr");
    row.className = result.scenario.id === state.selectedScenarioId ? "is-selected" : "";
    row.innerHTML = `
      <td>${escapeHtml(result.scenario.name)}</td>
      <td>${numberFormatter.format(result.endAge)}歳</td>
      <td>${numberFormatter.format(result.replacementCount)}回</td>
      <td>${numberFormatter.format(result.inspectionCount)}回</td>
      <td>${formatYen(result.eventCostTotal)}</td>
      <td>${formatYen(result.totalCost)}</td>
      <td>${formatYen(result.averageMonthly)}</td>
      <td>${formatYen(result.finalVehicleValue)}</td>
      <td>${formatYen(result.finalSaleAmount)}</td>
      <td>${formatYen(result.effectiveCostAfterSale)}</td>
      <td>${formatYen(result.averageMonthlyAfterSale)}</td>
      <td>${formatYen(result.npv)}</td>
      <td>${formatYen(result.yenPerKm)}</td>
      <td>${formatYen(result.endNetAsset)}</td>
    `;
    row.addEventListener("click", () => {
      state.selectedScenarioId = result.scenario.id;
      renderScenarioTable();
      renderCashflowTable();
      renderUpcomingEvents();
    });
    scenarioTableBody.appendChild(row);
  }
}

function renderCostRules() {
  const assumptions = state.assumptions;
  const current = assumptions.currentVehicle;
  const next = assumptions.newVehicle;
  const annual = assumptions.annualCosts;
  const repair = assumptions.repairExpected;
  const newLoanTotalRepayment = calculateNewLoanTotalRepayment(next);

  costRulesContent.innerHTML = `
    <div class="rule-grid">
      ${renderRuleGroup("基本前提", [
        ["開始年", `${numberFormatter.format(assumptions.startYear)}年`],
        ["現在年齢", `${numberFormatter.format(assumptions.currentAge)}歳`],
        ["利用予定年数", `${numberFormatter.format(getCycleHorizonYears(assumptions))}年`],
        ["年間走行距離", `${numberFormatter.format(assumptions.annualKm)}km`],
        ["割引率", formatPercent(assumptions.discountRate)],
        ["物価上昇率", formatPercent(assumptions.inflationRate)]
      ])}
      ${renderRuleGroup("現在車両", [
        ["車名", current.name],
        ["購入年", `${numberFormatter.format(current.purchaseYear)}年`],
        ["開始時車齢", `${numberFormatter.format(current.ageAtStart)}年`],
        ["現在査定額", formatYen(current.appraisal)],
        ["ローン残債", formatYen(current.loanBalance)],
        ["月額", formatYen(current.loanMonthly)],
        ["ローン終了年", `${numberFormatter.format(current.loanEndYear)}年`],
        ["最終回", formatYen(current.loanFinal)]
      ])}
      ${renderRuleGroup("新車・買替", [
        ["新車見積総額", formatYen(next.estimateTotal)],
        ["下取り額", formatYen(next.tradeIn)],
        ["新ローン月額", formatYen(next.loanMonthly)],
        ["ボーナス払い", formatYen(next.bonusPerPayment)],
        ["ボーナス回数", `${numberFormatter.format(next.bonusPaymentsPerYear)}回`],
        ["月額の扱い", "ボーナス払い分を均等化した月額"],
        ["ローン年数", `${numberFormatter.format(next.loanYears)}年`],
        ["最終回", formatYen(next.loanFinal)],
        ["総返済額", formatYen(newLoanTotalRepayment)],
        ["金利", formatPercent(next.interestRate)]
      ])}
      ${renderRuleGroup("年間維持費", [
        ["自動車税", `${formatYen(annual.autoTax)}（障害者減免を反映）`],
        ["任意保険", formatYen(annual.insurance)],
        ["燃料", formatYen(annual.fuel)],
        ["通常メンテ", formatYen(annual.maintenance)],
        ["Welcab追加修理期待値", `${formatYen(annual.welcabExtraRepair)} / 年`],
        ["車検費用", formatYen(annual.inspection)],
        ["車検周期", `${numberFormatter.format(annual.inspectionCycleYears)}年ごと`]
      ])}
      ${renderRuleGroup("修理期待値", [
        ["5年まで", `${formatYen(repair.through5Years)} / 年`],
        ["6〜10年", `${formatYen(repair.years6to10)} / 年`],
        ["11〜15年", `${formatYen(repair.years11to15)} / 年`],
        ["16年以降", `${formatYen(repair.after16Years)} / 年`],
        ["計算への組み込み", "毎年の期待値として年合計に加算"]
      ])}
    </div>

    <section class="rule-block">
      <h3>高額イベント</h3>
      <p>タイヤ、補機バッテリー等は該当車齢の年にイベント費用として年合計へ加算します。確率があるイベントは 金額 × 確率 を期待値として加算します。比較対象は5/7/9/11/13/15年目車検前で、短期買替では車齢到達前に買替されるため発生しにくくなります。</p>
      <div class="table-wrap compact-table-wrap">
        <table class="rules-table">
          <thead>
            <tr>
              <th>イベント名</th>
              <th>発生車齢</th>
              <th>繰り返し周期</th>
              <th>金額</th>
              <th>確率</th>
              <th>期待値</th>
              <th>年合計に入るか</th>
            </tr>
          </thead>
          <tbody>
            ${renderMaintenanceEventRows()}
          </tbody>
        </table>
      </div>
    </section>

    <div class="rule-grid rule-grid-narrow">
      ${renderRuleGroup("資産価値・売却額", [
        ["現車の価値", "現在査定額 × 現車残価率"],
        ["新車の価値", "新車見積総額 × 新車残価率"],
        ["最終売却額", "最終年の車両価値"],
        ["年合計への扱い", "最終売却額は年合計には混ぜない"],
        ["売却後実質コスト", "支出合計 - 最終売却額"]
      ])}
      ${renderRuleGroup("年合計の式", [
        ["年合計", "ローン + 年間維持費 + 修理期待値 + 車検 + 高額イベント費用"],
        ["除外するもの", "最終売却額は年合計に含めない"]
      ])}
      ${renderRuleGroup("月額の式", [
        ["ローン月額換算", "ローン年額 / 12"],
        ["その年の必要月額", "年合計 / 12"],
        ["累計平均月額", "累計支出 / 経過月数"],
        ["売却後平均月額", "(支出合計 - 最終売却額) / 利用月数"]
      ])}
    </div>
  `;
}

function calculateNewLoanTotalRepayment(newVehicle) {
  return (
    newVehicle.loanMonthly * newVehicle.loanYears * 12
    + newVehicle.bonusPerPayment * newVehicle.bonusPaymentsPerYear * newVehicle.loanYears
    + newVehicle.loanFinal
  );
}

function renderRuleGroup(title, rows) {
  return `
    <section class="rule-block">
      <h3>${escapeHtml(title)}</h3>
      <dl class="rule-list">
        ${rows.map(([label, value]) => `
          <div>
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(value)}</dd>
          </div>
        `).join("")}
      </dl>
    </section>
  `;
}

function renderMaintenanceEventRows() {
  return (state.maintenanceEvents.events || []).map((event) => {
    const amount = Number(event.amount || 0);
    const probability = Number.isFinite(Number(event.probability)) ? Number(event.probability) : 1;
    return `
      <tr>
        <td>${escapeHtml(event.name)}</td>
        <td>${numberFormatter.format(event.startVehicleAge)}年目</td>
        <td>${formatRepeatCycle(event.repeatEveryYears)}</td>
        <td>${formatYen(amount)}</td>
        <td>${formatPercent(probability)}</td>
        <td>${formatYen(amount * probability)}</td>
        <td>入る（該当車齢年）</td>
      </tr>
    `;
  }).join("");
}

function formatRepeatCycle(value) {
  const years = Number(value);
  if (!Number.isFinite(years) || years <= 0) return "単発";
  return `${numberFormatter.format(years)}年ごと`;
}

function renderAnnualScenarioComparisonTable() {
  annualScenarioComparisonTableHead.innerHTML = `
    <tr>
      <th>年</th>
      ${state.results.map((result) => `<th>${escapeHtml(result.scenario.name)}</th>`).join("")}
    </tr>
  `;
  annualScenarioComparisonTableBody.innerHTML = "";

  for (const comparisonRow of buildAnnualScenarioComparisonRows(state.results)) {
    const row = document.createElement("tr");
    const cells = comparisonRow.values.map((value) => {
      if (!value) return "<td>-</td>";
      return `<td title="年合計 ${escapeHtml(formatYen(value.total))}">${formatYenPerMonth(value.annualMonthly)}</td>`;
    });
    row.innerHTML = `
      <td>${comparisonRow.year}</td>
      ${cells.join("")}
    `;
    annualScenarioComparisonTableBody.appendChild(row);
  }
}

function renderCashflowTable() {
  const selected = getSelectedResult();
  document.querySelector("#cashflowScenarioName").textContent = selected.scenario.name;
  cashflowTableBody.innerHTML = "";

  for (const item of selected.rows) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.year}</td>
      <td>${numberFormatter.format(item.driverAge)}歳</td>
      <td>${numberFormatter.format(item.vehicleAge)}年</td>
      <td>${escapeHtml(item.vehicleLabel)}</td>
      <td>${escapeHtml(item.event)}</td>
      <td>${formatYen(item.loan)}</td>
      <td>${formatYen(item.loanMonthlyEquivalent)}</td>
      <td>${formatYen(item.running)}</td>
      <td>${formatYen(item.repair)}</td>
      <td>${formatYen(item.inspection)}</td>
      <td>${escapeHtml(formatMajorEventNames(item.majorEvents))}</td>
      <td>${formatYen(item.eventCost)}</td>
      <td>${formatYen(item.vehicleValue)}</td>
      <td>${formatYen(item.netAsset)}</td>
      <td>${formatYen(item.finalSaleAmount)}</td>
      <td>${formatYen(item.total)}</td>
      <td>${formatYen(item.annualMonthly)}</td>
      <td>${formatYen(item.cumulativeCost)}</td>
      <td>${formatYen(item.cumulativeAverageMonthly)}</td>
    `;
    cashflowTableBody.appendChild(row);
  }
}

function renderUpcomingEvents() {
  const selected = state.results.find((result) => result.scenario.id === state.selectedScenarioId) || state.results[0];
  const list = document.querySelector("#upcomingEventsList");
  document.querySelector("#upcomingEventsScenario").textContent = selected.scenario.name;
  list.innerHTML = "";

  const upcoming = selected.rows
    .flatMap((row) => row.majorEvents.map((event) => ({ row, event })))
    .slice(0, 5);

  if (upcoming.length === 0) {
    const item = document.createElement("li");
    item.textContent = "期間内の高額イベントはありません";
    list.appendChild(item);
    return;
  }

  for (const { row, event } of upcoming) {
    const item = document.createElement("li");
    item.textContent = `${row.year}年 / 車齢${row.vehicleAge}年 / ${event.name}: ${formatYen(event.expectedCost)}`;
    list.appendChild(item);
  }
}

async function copyJson() {
  const text = JSON.stringify(state.assumptions, null, 2);
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API is unavailable");
    await Promise.race([
      navigator.clipboard.writeText(text),
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error("Clipboard write timed out")), 1200);
      })
    ]);
    setStatus("現在条件をJSONコピーしました");
  } catch (error) {
    window.prompt("コピーできない場合は選択してコピーしてください", text);
    setStatus("クリップボード非対応: 手動コピーを表示");
  }
}

function buildComparisonCsv(results) {
  const headers = [
    "scenario",
    "endAge",
    "replacementCount",
    "inspectionCount",
    "eventCostTotal",
    "totalCost",
    "averageMonthly",
    "finalVehicleValue",
    "finalSaleAmount",
    "effectiveCostAfterSale",
    "averageMonthlyAfterSale",
    "npv",
    "yenPerKm",
    "endNetAsset"
  ];
  const lines = [headers.join(",")];
  for (const result of results) {
    lines.push([
      result.scenario.name,
      result.endAge,
      result.replacementCount,
      result.inspectionCount,
      Math.round(result.eventCostTotal),
      Math.round(result.totalCost),
      Math.round(result.averageMonthly),
      Math.round(result.finalVehicleValue),
      Math.round(result.finalSaleAmount),
      Math.round(result.effectiveCostAfterSale),
      Math.round(result.averageMonthlyAfterSale),
      Math.round(result.npv),
      Math.round(result.yenPerKm),
      Math.round(result.endNetAsset)
    ].map(csvCell).join(","));
  }
  return `\uFEFF${lines.join("\n")}`;
}

function buildAnnualScenarioComparisonRows(results) {
  const rowCount = Math.max(0, ...results.map((result) => result.rows.length));
  const rows = [];
  for (let index = 0; index < rowCount; index += 1) {
    const baseRow = results.find((result) => result.rows[index])?.rows[index];
    rows.push({
      year: baseRow?.year ?? "-",
      values: results.map((result) => {
        const row = result.rows[index];
        if (!row) return null;
        return {
          total: row.total,
          annualMonthly: row.total / 12
        };
      })
    });
  }
  return rows;
}

function buildAnnualScenarioComparisonCsv(results) {
  const headers = [
    "year",
    ...results.flatMap((result) => [
      `${result.scenario.name} annualMonthly`,
      `${result.scenario.name} total`
    ])
  ];
  const lines = [headers.map(csvCell).join(",")];
  for (const row of buildAnnualScenarioComparisonRows(results)) {
    const values = [row.year];
    for (const value of row.values) {
      values.push(value ? Math.round(value.annualMonthly) : "-", value ? Math.round(value.total) : "-");
    }
    lines.push(values.map(csvCell).join(","));
  }
  return `\uFEFF${lines.join("\n")}`;
}

function buildCashflowCsv(result) {
  const headers = [
    "scenario",
    "year",
    "driverAge",
    "vehicleAge",
    "vehicleLabel",
    "event",
    "loan",
    "loanMonthlyEquivalent",
    "running",
    "repair",
    "inspection",
    "majorEvents",
    "eventCost",
    "vehicleValue",
    "netAsset",
    "finalSaleAmount",
    "total",
    "annualMonthly",
    "cumulativeCost",
    "cumulativeAverageMonthly"
  ];
  const lines = [headers.join(",")];
  for (const item of result.rows) {
    lines.push([
      result.scenario.name,
      item.year,
      item.driverAge,
      item.vehicleAge,
      item.vehicleLabel,
      item.event,
      Math.round(item.loan),
      Math.round(item.loanMonthlyEquivalent),
      Math.round(item.running),
      Math.round(item.repair),
      Math.round(item.inspection),
      formatMajorEventNames(item.majorEvents),
      Math.round(item.eventCost),
      Math.round(item.vehicleValue),
      Math.round(item.netAsset),
      Math.round(item.finalSaleAmount),
      Math.round(item.total),
      Math.round(item.annualMonthly),
      Math.round(item.cumulativeCost),
      Math.round(item.cumulativeAverageMonthly)
    ].map(csvCell).join(","));
  }
  return `\uFEFF${lines.join("\n")}`;
}

function getSelectedResult() {
  return state.results.find((result) => result.scenario.id === state.selectedScenarioId) || state.results[0];
}

function csvCell(value) {
  const stringValue = String(value);
  return /[",\n]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue;
}

function formatMajorEventNames(events) {
  if (!events.length) return "-";
  return events.map((event) => event.name).join(" / ");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus(`${filename} を保存しました`);
}

function parseInputValue(input) {
  if (input.type === "number") return Number(input.value || 0);
  return input.value;
}

function getByPath(object, path) {
  return path.split(".").reduce((current, key) => current?.[key], object);
}

function setByPath(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((current, key) => current[key], object);
  target[last] = value;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function safeRate(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function formatYen(value) {
  return yenFormatter.format(Math.round(value || 0));
}

function formatYenPerMonth(value) {
  return `${formatYen(value)} /月`;
}

function formatPercent(value) {
  return `${percentFormatter.format(safeRate(value) * 100)}%`;
}

function setStatus(message) {
  document.querySelector("#modelStatus").textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
