"use strict";

const DEFAULT_ASSUMPTIONS = {
  startYear: 2026,
  horizonYears: 20,
  annualKm: 2500,
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
    { id: "replace_now", name: "今買替", replaceAfterYears: 0, keepOnly: false },
    { id: "replace_after_2", name: "2年後買替", replaceAfterYears: 2, keepOnly: false },
    { id: "replace_after_4", name: "4年後買替", replaceAfterYears: 4, keepOnly: false },
    { id: "replace_after_6", name: "6年後買替", replaceAfterYears: 6, keepOnly: false },
    { id: "keep_until_15", name: "20年維持", replaceAfterYears: null, keepOnly: true }
  ]
};

const state = {
  assumptions: structuredClone(DEFAULT_ASSUMPTIONS),
  results: [],
  selectedScenarioId: "replace_now"
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

  document.querySelector("#copyJsonButton").addEventListener("click", copyJson);
  document.querySelector("#downloadJsonButton").addEventListener("click", () => {
    downloadFile("car-cost-assumptions.json", JSON.stringify(state.assumptions, null, 2), "application/json");
  });
  document.querySelector("#downloadCsvButton").addEventListener("click", () => {
    downloadFile("car-cost-scenarios.csv", buildComparisonCsv(state.results), "text/csv;charset=utf-8");
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
  const replacementIndex = scenario.keepOnly ? null : Number(scenario.replaceAfterYears);
  let hasNewVehicle = replacementIndex === 0;
  let newVehicleStartYear = hasNewVehicle ? assumptions.startYear : null;

  for (let index = 0; index < assumptions.horizonYears; index += 1) {
    const year = assumptions.startYear + index;
    if (replacementIndex !== null && index >= replacementIndex) {
      hasNewVehicle = true;
      newVehicleStartYear = assumptions.startYear + replacementIndex;
    }

    const vehicleAge = hasNewVehicle
      ? year - newVehicleStartYear + 1
      : getCurrentVehicleAgeAtIndex(assumptions, index);
    const inflation = Math.pow(1 + safeRate(assumptions.inflationRate), index);
    const loan = calculateLoanCost(assumptions, year, index, replacementIndex);
    const running = calculateRunningCost(assumptions, vehicleAge, inflation);
    const repair = calculateRepairCost(assumptions, vehicleAge, inflation);
    const inspection = needsInspection(assumptions, year, vehicleAge, hasNewVehicle)
      ? assumptions.annualCosts.inspection * inflation
      : 0;
    const vehicleValue = estimateVehicleValueAtIndex(assumptions, index, replacementIndex, hasNewVehicle, vehicleAge);
    const netAsset = estimateNetAssetAtIndex(assumptions, year, index, replacementIndex, hasNewVehicle, vehicleAge);
    const total = loan + running + repair + inspection;

    rows.push({
      year,
      vehicleAge,
      loan,
      running,
      repair,
      inspection,
      vehicleValue,
      netAsset,
      total
    });
  }

  const total7 = sum(rows.slice(0, Math.min(7, rows.length)).map((row) => row.total));
  const total20 = sum(rows.map((row) => row.total));
  const npv = sum(rows.map((row, index) => row.total / Math.pow(1 + safeRate(assumptions.discountRate), index)));
  const totalKm = assumptions.annualKm * rows.length;
  const finalRow = rows[rows.length - 1];
  const netAsset2032 = estimateNetAssetAtYear(assumptions, scenario, 2032);

  return {
    scenario,
    rows,
    averageMonthly7: total7 / Math.min(7, rows.length) / 12,
    averageMonthly20: total20 / rows.length / 12,
    npv,
    totalCost20: total20,
    vehicleValueEnd: finalRow?.vehicleValue ?? 0,
    yenPerKm: totalKm > 0 ? total20 / totalKm : 0,
    netAsset2032
  };
}

function calculateLoanCost(assumptions, year, index, replacementIndex) {
  const current = assumptions.currentVehicle;
  const next = assumptions.newVehicle;

  if (replacementIndex === null || index < replacementIndex) {
    let cost = year <= current.loanEndYear ? current.loanMonthly * 12 : 0;
    if (year === current.loanEndYear) cost += current.loanFinal;
    return cost;
  }

  const loanYearIndex = index - replacementIndex;
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

function estimateVehicleValueAtIndex(assumptions, index, replacementIndex, hasNewVehicle, vehicleAge) {
  if (hasNewVehicle && replacementIndex !== null) return estimateNewVehicleValue(assumptions, vehicleAge);
  return estimateCurrentVehicleValue(assumptions, index);
}

function estimateNetAssetAtYear(assumptions, scenario, targetYear) {
  const index = targetYear - assumptions.startYear;
  if (index < 0) return 0;

  const replacementIndex = scenario.keepOnly ? null : Number(scenario.replaceAfterYears);
  const ownsNew = replacementIndex !== null && index >= replacementIndex;
  if (!ownsNew) {
    return estimateCurrentVehicleValue(assumptions, index) - estimateCurrentLoanBalance(assumptions, targetYear);
  }

  const newAge = index - replacementIndex + 1;
  const yearInNewLoan = index - replacementIndex;
  return estimateNewVehicleValue(assumptions, newAge) - estimateNewLoanBalance(assumptions, yearInNewLoan);
}

function estimateNetAssetAtIndex(assumptions, year, index, replacementIndex, hasNewVehicle, vehicleAge) {
  if (!hasNewVehicle || replacementIndex === null) {
    return estimateCurrentVehicleValue(assumptions, index) - estimateCurrentLoanBalance(assumptions, year);
  }
  const yearInNewLoan = index - replacementIndex;
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
  const cheapest = [...state.results].sort((a, b) => a.averageMonthly7 - b.averageMonthly7)[0];
  const replaceNow = state.results.find((result) => result.scenario.id === "replace_now");
  const keepCandidates = state.results.filter((result) => result.scenario.id !== "replace_now");
  const keepMin = [...keepCandidates].sort((a, b) => a.averageMonthly7 - b.averageMonthly7)[0];
  const diff = replaceNow.averageMonthly7 - keepMin.averageMonthly7;
  const decisionCard = document.querySelector(".metric-card.decision");

  document.querySelector("#cheapestScenario").textContent = cheapest.scenario.name;
  document.querySelector("#cheapestAmount").textContent = `${formatYen(cheapest.averageMonthly7)} / 月`;
  document.querySelector("#replaceNowMonthly").textContent = formatYen(replaceNow.averageMonthly7);
  document.querySelector("#keepMonthly").textContent = formatYen(keepMin.averageMonthly7);

  if (diff <= 0) {
    document.querySelector("#decisionText").textContent = "今買替も候補";
    document.querySelector("#decisionDetail").textContent = `維持系最小より月 ${formatYen(Math.abs(diff))} 有利`;
    decisionCard.classList.add("is-good");
  } else {
    document.querySelector("#decisionText").textContent = "維持優先";
    document.querySelector("#decisionDetail").textContent = `今買替は月 ${formatYen(diff)} 高い`;
    decisionCard.classList.remove("is-good");
  }
}

function renderScenarioTable() {
  scenarioTableBody.innerHTML = "";
  for (const result of state.results) {
    const row = document.createElement("tr");
    row.className = result.scenario.id === state.selectedScenarioId ? "is-selected" : "";
    row.innerHTML = `
      <td>${escapeHtml(result.scenario.name)}</td>
      <td>${formatYen(result.averageMonthly7)}</td>
      <td>${formatYen(result.averageMonthly20)}</td>
      <td>${formatYen(result.npv)}</td>
      <td>${formatYen(result.totalCost20)}</td>
      <td>${formatYen(result.vehicleValueEnd)}</td>
      <td>${formatYen(result.yenPerKm)}</td>
      <td>${formatYen(result.netAsset2032)}</td>
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
      <td>${numberFormatter.format(item.vehicleAge)}年</td>
      <td>${formatYen(item.loan)}</td>
      <td>${formatYen(item.running)}</td>
      <td>${formatYen(item.repair)}</td>
      <td>${formatYen(item.inspection)}</td>
      <td>${formatYen(item.vehicleValue)}</td>
      <td>${formatYen(item.netAsset)}</td>
      <td>${formatYen(item.total)}</td>
    `;
    cashflowTableBody.appendChild(row);
  }
}

async function copyJson() {
  const text = JSON.stringify(state.assumptions, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    setStatus("現在条件をJSONコピーしました");
  } catch (error) {
    window.prompt("コピーできない場合は選択してコピーしてください", text);
    setStatus("クリップボード非対応: 手動コピーを表示");
  }
}

function buildComparisonCsv(results) {
  const headers = ["scenario", "averageMonthly7", "averageMonthly20", "npv20", "totalCost20", "vehicleValueEnd", "yenPerKm", "netAsset2032"];
  const lines = [headers.join(",")];
  for (const result of results) {
    lines.push([
      result.scenario.name,
      Math.round(result.averageMonthly7),
      Math.round(result.averageMonthly20),
      Math.round(result.npv),
      Math.round(result.totalCost20),
      Math.round(result.vehicleValueEnd),
      Math.round(result.yenPerKm),
      Math.round(result.netAsset2032)
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
