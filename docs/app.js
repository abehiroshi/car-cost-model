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
    loanMonthly: 37064,
    bonusPerPayment: 35900,
    bonusPaymentsPerYear: 2,
    loanYears: 5,
    loanFinal: 1599000,
    interestRate: 0.061
  },
  annualCosts: {
    autoTax: 45000,
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
    { id: "now_cycle_5", name: "今買替・5年サイクル", initialKeepYears: 0, cycleYears: 5 },
    { id: "now_cycle_7", name: "今買替・7年サイクル", initialKeepYears: 0, cycleYears: 7 },
    { id: "now_cycle_10", name: "今買替・10年サイクル", initialKeepYears: 0, cycleYears: 10 },
    { id: "keep_5_then_10", name: "現車をあと5年維持・以後10年サイクル", initialKeepYears: 5, cycleYears: 10 },
    { id: "keep_10_then_15", name: "現車をあと10年維持・以後15年または最後まで", initialKeepYears: 10, cycleYears: 15 },
    { id: "keep_20_then_last_car", name: "現車を20年維持・最後に1回買替", initialKeepYears: 20, cycleYears: null },
    { id: "keep_current_until_exit", name: "現車を最後まで維持・最終売却", initialKeepYears: null, cycleYears: null, keepOnly: true }
  ]
};

const state = {
  assumptions: structuredClone(DEFAULT_ASSUMPTIONS),
  results: [],
  selectedScenarioId: "now_cycle_5"
};

const form = document.querySelector("#assumptionForm");
const scenarioTableBody = document.querySelector("#scenarioTableBody");
const cashflowTableBody = document.querySelector("#cashflowTableBody");
const yenFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0
});
const numberFormatter = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });

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
    const response = await fetch("./assumptions.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.assumptions = await response.json();
    setStatus("assumptions.json を読み込み済み");
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
}

function populateForm() {
  for (const input of form.elements) {
    if (!(input instanceof HTMLInputElement) || !input.name) continue;
    const value = getByPath(state.assumptions, input.name);
    input.value = value ?? "";
  }
}

function recalculate() {
  state.results = state.assumptions.scenarios.map((scenario) => calculateScenario(state.assumptions, scenario));
  renderDashboard();
  renderScenarioTable();
  renderCashflowTable();
}

function calculateScenario(assumptions, scenario) {
  const rows = [];
  const horizonYears = getCycleHorizonYears(assumptions);
  const replacementYears = buildReplacementYears(scenario, horizonYears);
  let activeReplacementIndex = null;

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
    const vehicleValue = estimateVehicleValueAtIndex(assumptions, index, hasNewVehicle, vehicleAge);
    const netAsset = estimateNetAssetAtIndex(assumptions, year, index, activeReplacementIndex, hasNewVehicle, vehicleAge);
    const finalSaleAmount = index === horizonYears - 1 ? vehicleValue : 0;
    const total = loan + running + repair + inspection;
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
      running,
      repair,
      inspection,
      vehicleValue,
      netAsset,
      finalSaleAmount,
      total
    });
  }

  const totalCost = sum(rows.map((row) => row.total));
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

function buildReplacementYears(scenario, horizonYears) {
  const years = [];
  if (scenario.keepOnly === true || scenario.initialKeepYears === null) return years;

  const firstReplacement = Number(scenario.initialKeepYears);
  if (!Number.isFinite(firstReplacement) || firstReplacement < 0 || firstReplacement >= horizonYears - 1) return years;

  years.push(firstReplacement);
  const cycleYears = Number(scenario.cycleYears);
  if (!Number.isFinite(cycleYears) || cycleYears <= 0) return years;

  let nextReplacement = firstReplacement + cycleYears;
  while (nextReplacement < horizonYears - 1) {
    years.push(nextReplacement);
    nextReplacement += cycleYears;
  }
  return years;
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
    });
    scenarioTableBody.appendChild(row);
  }
}

function renderCashflowTable() {
  const selected = state.results.find((result) => result.scenario.id === state.selectedScenarioId) || state.results[0];
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
      <td>${formatYen(item.running)}</td>
      <td>${formatYen(item.repair)}</td>
      <td>${formatYen(item.inspection)}</td>
      <td>${formatYen(item.vehicleValue)}</td>
      <td>${formatYen(item.netAsset)}</td>
      <td>${formatYen(item.finalSaleAmount)}</td>
      <td>${formatYen(item.total)}</td>
    `;
    cashflowTableBody.appendChild(row);
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

function csvCell(value) {
  const stringValue = String(value);
  return /[",\n]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue;
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
