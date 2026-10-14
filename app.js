const depositDefaults = [
    { clients: 10, amount: 50 },
    { clients: 5, amount: 30 },
    { clients: 3, amount: 20 },
    { clients: 3, amount: 20 },
    { clients: 3, amount: 20 },
    { clients: 3, amount: 20 },
    { clients: 3, amount: 20 }
];
const depositStageNames = ['1st deposit', '2nd deposit', '3rd deposit', '4th deposit', '5th deposit', 'Tax deposit', 'Final deposit'];

const depositForecastMode = document.getElementById('depositForecastMode');
const depositGrandTotal = document.getElementById('depositGrandTotal');
const depositDayThb = document.getElementById('depositDayThb');
const deposit30DayMxn = document.getElementById('deposit30DayMxn');
const deposit30DayThb = document.getElementById('deposit30DayThb');
const depositForecastLabel = document.getElementById('depositForecastLabel');
const depositTransactionCount = document.getElementById('depositTransactionCount');
const depositCalculatorError = document.getElementById('depositCalculatorError');
const depositFxNote = document.getElementById('depositFxNote');
const depositFeeMxn = document.getElementById('depositFeeMxn');
const depositNetMxn = document.getElementById('depositNetMxn');
const depositUsdt = document.getElementById('depositUsdt');
const depositFxRates = document.getElementById('depositFxRates');
const scenarioNameInput = document.getElementById('scenarioName');
const scenarioMessage = document.getElementById('scenarioMessage');
const scenarioBody = document.getElementById('scenarioBody');
const emptyScenarios = document.getElementById('emptyScenarios');
let currentDepositCalculation = null;

function formatCurrency(value, currency = 'MXN') {
    return `${Number(value).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })} ${currency}`;
}

function calculateDeposits() {
    const clearIncomeResults = () => {
        depositGrandTotal.innerText = '— MXN';
        depositDayThb.innerText = '— THB';
        deposit30DayMxn.innerText = '— MXN';
        deposit30DayThb.innerText = '— THB';
        depositTransactionCount.innerText = '—';
        depositFeeMxn.innerText = '— MXN';
        depositNetMxn.innerText = '— MXN';
        depositUsdt.innerText = '— USDT';
        depositFxRates.innerText = '—';
    };

    const stages = depositDefaults.map((_, index) => {
        const clientsInput = document.querySelector(`[data-deposit-clients="${index}"]`);
        const amountInput = document.querySelector(`[data-deposit-amount="${index}"]`);
        return { clients: clientsInput.valueAsNumber, amount: amountInput.valueAsNumber };
    });

    depositDefaults.forEach((_, index) => {
        const clientsInput = document.querySelector(`[data-deposit-clients="${index}"]`);
        const previousClients = index > 0 ? stages[index - 1].clients : null;
        if (index > 0 && Number.isSafeInteger(previousClients) && previousClients >= 0) {
            clientsInput.max = previousClients;
        } else if (index > 0) {
            clientsInput.removeAttribute('max');
        }
    });

    let cohortResult;
    try {
        cohortResult = FinancialCalculations.calculateDepositStages(stages);
    } catch (error) {
        depositDefaults.forEach((_, index) => {
            document.getElementById(`depositStageTotal${index}`).innerText = '— MXN';
            document.getElementById(`depositRetention${index}`).innerText = '—';
        });
        currentDepositCalculation = null;
        clearIncomeResults();
        depositCalculatorError.innerText = error.message;
        return;
    }

    cohortResult.stageTotals.forEach((total, index) => {
        document.getElementById(`depositStageTotal${index}`).innerText = formatCurrency(total);
        document.getElementById(`depositRetention${index}`).innerText = index === 0
            ? 'Starting group'
            : cohortResult.retentionPercentages[index] === null
                ? '—'
                : `${cohortResult.retentionPercentages[index].toFixed(1)}%`;
    });
    depositGrandTotal.innerText = formatCurrency(cohortResult.cohortTotalMxn);
    depositTransactionCount.innerText = cohortResult.totalTransactions.toLocaleString('en-US');
    depositCalculatorError.innerText = '';

    let cohortConversion;
    let forecast;
    let forecastConversion;
    try {
        cohortConversion = FinancialCalculations.calculateConversion(
            cohortResult.cohortTotalMxn,
            inputFee.valueAsNumber,
            rateUsdtMxn.valueAsNumber,
            rateUsdtThb.valueAsNumber
        );
        forecast = FinancialCalculations.calculateForecast(cohortResult.cohortTotalMxn, depositForecastMode.value);
        forecastConversion = FinancialCalculations.calculateConversion(
            forecast.projectedMxn,
            inputFee.valueAsNumber,
            rateUsdtMxn.valueAsNumber,
            rateUsdtThb.valueAsNumber
        );
    } catch (error) {
        depositDayThb.innerText = '— THB';
        deposit30DayThb.innerText = '— THB';
        depositFeeMxn.innerText = '— MXN';
        depositNetMxn.innerText = '— MXN';
        depositUsdt.innerText = '— USDT';
        depositFxRates.innerText = '—';
        depositCalculatorError.innerText = error.message;
        depositFxNote.innerText = 'Enter valid rates and fee in the currency calculator to calculate THB estimates.';
        currentDepositCalculation = { ...cohortResult, stages, cohortConversion: null, forecast: null, forecastConversion: null };
        depositForecastLabel.innerText = depositForecastMode.value === 'repeat-daily'
            ? '30-day forecast · repeats daily'
            : '30-day forecast · one-time';
        deposit30DayMxn.innerText = formatCurrency(cohortResult.cohortTotalMxn);
        return currentDepositCalculation;
    }

    depositForecastLabel.innerText = depositForecastMode.value === 'repeat-daily'
        ? '30-day forecast · repeats daily'
        : '30-day forecast · one-time';
    deposit30DayMxn.innerText = formatCurrency(forecast.projectedMxn);
    depositDayThb.innerText = formatCurrency(cohortConversion.thb, 'THB');
    deposit30DayThb.innerText = formatCurrency(forecastConversion.thb, 'THB');
    depositFeeMxn.innerText = `-${formatCurrency(cohortConversion.feeMxn)}`;
    depositNetMxn.innerText = formatCurrency(cohortConversion.netMxn);
    depositUsdt.innerText = formatCurrency(cohortConversion.usdt, 'USDT');
    depositFxRates.innerText = `${formatCurrency(cohortConversion.usdtMxn)} / USDT · ${formatCurrency(cohortConversion.usdtThb, 'THB')} / USDT · ${cohortConversion.feePct.toFixed(1)}% fee`;
    depositFxNote.innerText = depositForecastMode.value === 'repeat-daily'
        ? 'The 30-day forecast repeats this cohort once per day. THB estimates apply the current exchange rates and fee to each deposit total.'
        : 'The 30-day forecast counts this cohort once. THB estimates apply the current exchange rates and fee; no deposits are assumed on other days.';
    currentDepositCalculation = { ...cohortResult, stages, cohortConversion, forecast, forecastConversion };
    return currentDepositCalculation;
}

function resetDeposits() {
    depositDefaults.forEach((stage, index) => {
        document.querySelector(`[data-deposit-clients="${index}"]`).value = stage.clients;
        document.querySelector(`[data-deposit-amount="${index}"]`).value = stage.amount;
    });
    depositForecastMode.value = 'one-time';
    calculateDeposits();
}

let transactionHistory = [];
try {
    const storedHistory = JSON.parse(localStorage.getItem('apex_fx_ledger') || '[]');
    if (Array.isArray(storedHistory)) {
        transactionHistory = storedHistory;
    }
} catch (error) {
    console.error('Could not read the saved conversion ledger.', error);
}

let savedScenarios = [];
try {
    const storedScenarios = JSON.parse(localStorage.getItem('apex_fx_deposit_scenarios') || '[]');
    if (Array.isArray(storedScenarios)) {
        savedScenarios = storedScenarios.filter(scenario => scenario
            && typeof scenario.id === 'string'
            && typeof scenario.name === 'string'
            && Array.isArray(scenario.stages)
            && scenario.stages.length === depositDefaults.length
            && scenario.exchange
            && scenario.results
            && scenario.results.forecast
            && scenario.results.cohortConversion
            && scenario.results.forecastConversion
            && Array.isArray(scenario.results.stageTotals));
    }
} catch (error) {
    console.error('Could not read saved deposit scenarios.', error);
}

const inputMxn = document.getElementById('inputMxn');
const inputFee = document.getElementById('inputFee');
const feeDisplay = document.getElementById('feeDisplay');
const rateUsdtMxn = document.getElementById('rateUsdtMxn');
const rateUsdtThb = document.getElementById('rateUsdtThb');
const fxInputError = document.getElementById('fxInputError');
const saveTransactionButton = document.getElementById('saveTransactionButton');
const monthlyIncomeInput = document.getElementById('monthlyIncome');
const workingDaysInput = document.getElementById('workingDays');
const workdaysPerWeekInput = document.getElementById('workdaysPerWeek');
const hoursPerDayInput = document.getElementById('hoursPerDay');
const incomeTaxInput = document.getElementById('incomeTax');
const incomeTaxDisplay = document.getElementById('incomeTaxDisplay');
const incomeEstimateError = document.getElementById('incomeEstimateError');

const resThb = document.getElementById('resThb');
const resEffectiveRate = document.getElementById('resEffectiveRate');
const resInitialMxn = document.getElementById('resInitialMxn');
const resFeeMxn = document.getElementById('resFeeMxn');
const resFeePctText = document.getElementById('resFeePctText');
const resNetMxn = document.getElementById('resNetMxn');
const resUsdt = document.getElementById('resUsdt');
const tableFeeLabel = document.getElementById('tableFeeLabel');
const ledgerBody = document.getElementById('ledgerBody');
const emptyLedger = document.getElementById('emptyLedger');

const formatMxn = value => formatCurrency(value);
const formatUsdt = value => formatCurrency(value, 'USDT');

function updateIncomeEstimate() {
    const monthlyIncome = monthlyIncomeInput.valueAsNumber;
    const workingDays = workingDaysInput.valueAsNumber;
    const workdaysPerWeek = workdaysPerWeekInput.valueAsNumber;
    const hoursPerDay = hoursPerDayInput.valueAsNumber;
    const taxPct = incomeTaxInput.valueAsNumber;
    incomeTaxDisplay.innerText = `${taxPct}%`;

    const validIncome = monthlyIncomeInput.value.trim() !== ''
        && Number.isFinite(monthlyIncome) && monthlyIncome >= 0;
    const validWorkingDays = Number.isInteger(workingDays) && workingDays >= 1 && workingDays <= 31;
    const validWorkdaysPerWeek = Number.isInteger(workdaysPerWeek) && workdaysPerWeek >= 1 && workdaysPerWeek <= 7;
    const validHoursPerDay = Number.isFinite(hoursPerDay) && hoursPerDay >= 0.5 && hoursPerDay <= 24;
    const validTax = Number.isFinite(taxPct) && taxPct >= 0 && taxPct <= 60;

    if (!validIncome || !validWorkingDays || !validWorkdaysPerWeek || !validHoursPerDay || !validTax) {
        ['hourlyGross', 'dailyGross', 'weeklyGross', 'monthlyGross'].forEach(id => {
            document.getElementById(id).innerText = 'Gross: —';
        });
        ['hourlyNet', 'dailyNet', 'weeklyNet', 'monthlyNet'].forEach(id => {
            document.getElementById(id).innerText = 'After deductions: —';
        });
        incomeEstimateError.innerText = 'Enter a non-negative monthly income, 1–31 workdays per month, 1–7 workdays per week, and 0.5–24 hours per workday.';
        return;
    }

    const dailyGross = monthlyIncome / workingDays;
    const estimates = {
        hourly: dailyGross / hoursPerDay,
        daily: dailyGross,
        weekly: dailyGross * workdaysPerWeek,
        monthly: monthlyIncome
    };
    const afterDeductions = 1 - (taxPct / 100);
    ['hourly', 'daily', 'weekly', 'monthly'].forEach(period => {
        document.getElementById(`${period}Gross`).innerText = `Gross: ${formatMxn(estimates[period])}`;
        document.getElementById(`${period}Net`).innerText = `After deductions: ${formatMxn(estimates[period] * afterDeductions)}`;
    });
    incomeEstimateError.innerText = '';
}

function calculate() {
    const initialMxn = inputMxn.valueAsNumber;
    const feePct = inputFee.valueAsNumber;
    const usdtMxn = rateUsdtMxn.valueAsNumber;
    const usdtThb = rateUsdtThb.valueAsNumber;

    feeDisplay.innerText = Number.isFinite(feePct) ? `${feePct.toFixed(1)}%` : '—';
    resFeePctText.innerText = feeDisplay.innerText;
    tableFeeLabel.innerText = feeDisplay.innerText;

    const validAmount = inputMxn.value.trim() !== '' && Number.isFinite(initialMxn) && initialMxn >= 100;
    const validFee = Number.isFinite(feePct) && feePct >= 0 && feePct <= 10;
    const validRates = Number.isFinite(usdtMxn) && usdtMxn > 0
        && Number.isFinite(usdtThb) && usdtThb > 0;
    if (!validAmount || !validFee || !validRates) {
        fxInputError.innerText = !validAmount
            ? 'Enter an amount of at least 100 MXN.'
            : !validRates
                ? 'Enter positive values for both exchange rates.'
                : 'Enter an exchange fee between 0% and 10%.';
        resThb.innerText = '— THB';
        resEffectiveRate.innerText = 'Rate unavailable';
        resInitialMxn.innerText = '— MXN';
        resFeeMxn.innerText = '— MXN';
        resNetMxn.innerText = '— MXN';
        resUsdt.innerText = '— USDT';
        saveTransactionButton.disabled = true;
        calculateDeposits();
        return null;
    }

    const feeAmountMxn = initialMxn * (feePct / 100);
    const netMxn = initialMxn - feeAmountMxn;
    const usdtReceived = netMxn / usdtMxn;
    const thbReceived = usdtReceived * usdtThb;
    const effectiveRate = thbReceived / initialMxn;

    resThb.innerHTML = `${thbReceived.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span class="text-base text-emerald-500 font-semibold">THB</span>`;
    resEffectiveRate.innerText = `1 MXN = ${effectiveRate.toFixed(4)} THB`;
    resInitialMxn.innerText = formatMxn(initialMxn);
    resFeeMxn.innerText = `-${formatMxn(feeAmountMxn)}`;
    resNetMxn.innerText = formatMxn(netMxn);
    resUsdt.innerText = formatUsdt(usdtReceived);
    fxInputError.innerText = '';
    saveTransactionButton.disabled = false;
    calculateDeposits();

    return {
        initialMxn,
        feePct,
        feeAmountMxn,
        netMxn,
        usdtReceived,
        thbReceived,
        effectiveRate,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
}

function setMxnPreset(amount) {
    inputMxn.value = amount;
    calculate();
}

function resetDefaults() {
    inputMxn.value = 10000;
    inputFee.value = 4.0;
    rateUsdtMxn.value = 18.25;
    rateUsdtThb.value = 33.58;
    calculate();
}

function persistLedger() {
    try {
        localStorage.setItem('apex_fx_ledger', JSON.stringify(transactionHistory));
    } catch (error) {
        console.error('Could not save the conversion ledger.', error);
        fxInputError.innerText = 'The calculation worked, but the ledger could not be saved in this browser.';
    }
}

function saveTransaction() {
    const currentCalc = calculate();
    if (!currentCalc) return;
    transactionHistory.unshift(currentCalc);
    if (transactionHistory.length > 25) transactionHistory.pop();
    persistLedger();
    renderLedger();
}

function deleteTransaction(index) {
    transactionHistory.splice(index, 1);
    persistLedger();
    renderLedger();
}

function clearLedger() {
    transactionHistory = [];
    try {
        localStorage.removeItem('apex_fx_ledger');
    } catch (error) {
        console.error('Could not clear the saved conversion ledger.', error);
        fxInputError.innerText = 'The ledger could not be cleared in this browser.';
    }
    renderLedger();
}

function persistScenarios(nextScenarios) {
    try {
        localStorage.setItem('apex_fx_deposit_scenarios', JSON.stringify(nextScenarios));
        savedScenarios = nextScenarios;
        renderScenarios();
        return true;
    } catch (error) {
        console.error('Could not save deposit scenarios.', error);
        setScenarioMessage('Could not save scenarios in this browser. Check browser storage availability.', 'error');
        return false;
    }
}

function setScenarioMessage(message, tone = 'error') {
    scenarioMessage.classList.toggle('text-rose-400', tone === 'error');
    scenarioMessage.classList.toggle('text-emerald-400', tone === 'success');
    scenarioMessage.innerText = message;
}

function saveScenario() {
    const name = scenarioNameInput.value.trim();
    if (!name) {
        setScenarioMessage('Enter a name for this scenario before saving.');
        scenarioNameInput.focus();
        return;
    }

    const calculation = calculateDeposits();
    if (!calculation || !calculation.cohortConversion || !calculation.forecastConversion) {
        setScenarioMessage('Fix the deposit stages and currency rates before saving this scenario.');
        return;
    }

    const scenario = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name,
        savedAt: new Date().toISOString(),
        stages: calculation.stages.map(stage => ({ ...stage })),
        forecastMode: depositForecastMode.value,
        exchange: {
            feePct: inputFee.valueAsNumber,
            usdtMxn: rateUsdtMxn.valueAsNumber,
            usdtThb: rateUsdtThb.valueAsNumber
        },
        results: {
            totalTransactions: calculation.totalTransactions,
            cohortTotalMxn: calculation.cohortTotalMxn,
            stageTotals: calculation.stageTotals,
            retentionPercentages: calculation.retentionPercentages,
            cohortConversion: calculation.cohortConversion,
            forecast: calculation.forecast,
            forecastConversion: calculation.forecastConversion
        }
    };

    if (persistScenarios([scenario, ...savedScenarios].slice(0, 50))) {
        scenarioNameInput.value = '';
        setScenarioMessage('Scenario saved.', 'success');
    }
}

function loadScenario(id) {
    const scenario = savedScenarios.find(item => item.id === id);
    if (!scenario) return;
    if (scenario.stages.length !== depositDefaults.length
        || !scenario.exchange
        || !scenario.results
        || !['one-time', 'repeat-daily'].includes(scenario.forecastMode)) {
        setScenarioMessage('This saved scenario is incomplete and cannot be loaded.');
        return;
    }

    scenario.stages.forEach((stage, index) => {
        document.querySelector(`[data-deposit-clients="${index}"]`).value = stage.clients;
        document.querySelector(`[data-deposit-amount="${index}"]`).value = stage.amount;
    });
    inputFee.value = scenario.exchange.feePct;
    rateUsdtMxn.value = scenario.exchange.usdtMxn;
    rateUsdtThb.value = scenario.exchange.usdtThb;
    depositForecastMode.value = scenario.forecastMode;
    calculate();
    setScenarioMessage(`Loaded "${scenario.name}".`, 'success');
}

function deleteScenario(id) {
    if (persistScenarios(savedScenarios.filter(scenario => scenario.id !== id))) {
        setScenarioMessage('Scenario deleted.', 'success');
    }
}

function exportScenarios() {
    if (savedScenarios.length === 0) {
        setScenarioMessage('Save a scenario before exporting the CSV.');
        return;
    }

    const csv = FinancialCalculations.buildScenarioCsv(savedScenarios, depositStageNames);
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'deposit-scenarios.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setScenarioMessage(`Exported ${savedScenarios.length} scenario${savedScenarios.length === 1 ? '' : 's'} to CSV.`, 'success');
}

function renderScenarios() {
    scenarioBody.replaceChildren();
    emptyScenarios.classList.toggle('hidden', savedScenarios.length > 0);
    savedScenarios.forEach(scenario => {
        const row = document.createElement('tr');
        const savedDate = new Date(scenario.savedAt);
        const cells = [
            scenario.name,
            Number.isNaN(savedDate.getTime()) ? 'Unknown date' : savedDate.toLocaleString(),
            formatCurrency(scenario.results.cohortTotalMxn),
            formatCurrency(scenario.results.forecast.projectedMxn),
            formatCurrency(scenario.results.forecastConversion.thb, 'THB')
        ];
        cells.forEach(value => {
            const cell = document.createElement('td');
            cell.className = 'py-3 px-3 text-slate-300';
            cell.textContent = value;
            row.appendChild(cell);
        });

        const actions = document.createElement('td');
        actions.className = 'py-3 px-3 whitespace-nowrap';
        [['load', 'Load'], ['delete', 'Delete']].forEach(([action, label]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.scenarioAction = action;
            button.dataset.scenarioId = scenario.id;
            button.className = action === 'delete'
                ? 'text-rose-400 hover:text-rose-300 mr-3'
                : 'text-emerald-400 hover:text-emerald-300 mr-3';
            button.textContent = label;
            actions.appendChild(button);
        });
        row.appendChild(actions);
        scenarioBody.appendChild(row);
    });
}

function renderLedger() {
    ledgerBody.innerHTML = '';
    if (transactionHistory.length === 0) {
        emptyLedger.classList.remove('hidden');
        return;
    }
    emptyLedger.classList.add('hidden');

    transactionHistory.forEach((tx, index) => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-800/40 transition-colors text-xs';
        row.innerHTML = `
            <td class="py-3.5 px-4 text-slate-400">${tx.timestamp}</td>
            <td class="py-3.5 px-4 text-white font-medium">${Number(tx.initialMxn).toLocaleString()} MXN</td>
            <td class="py-3.5 px-4 text-amber-400">-${Number(tx.feeAmountMxn).toLocaleString(undefined, { maximumFractionDigits: 2 })} (${tx.feePct}%)</td>
            <td class="py-3.5 px-4 text-slate-300">${Number(tx.netMxn).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
            <td class="py-3.5 px-4 text-cyan-400 font-medium">${Number(tx.usdtReceived).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
            <td class="py-3.5 px-4 text-emerald-400 font-bold">${Number(tx.thbReceived).toLocaleString(undefined, { maximumFractionDigits: 2 })} THB</td>
            <td class="py-3.5 px-4 text-slate-300">1 = ${Number(tx.effectiveRate).toFixed(4)}</td>
            <td class="py-3.5 px-4 text-center">
                <button type="button" data-delete-transaction="${index}" class="text-slate-500 hover:text-rose-400 transition-colors p-1" title="Delete Entry" aria-label="Delete ledger entry">
                    <i class="fa-solid fa-xmark text-sm"></i>
                </button>
            </td>
        `;
        ledgerBody.appendChild(row);
    });
}

document.querySelectorAll('[data-deposit-clients], [data-deposit-amount]').forEach(input => {
    input.addEventListener('input', calculateDeposits);
});
document.getElementById('resetDeposits').addEventListener('click', resetDeposits);
depositForecastMode.addEventListener('change', calculateDeposits);
document.getElementById('saveScenario').addEventListener('click', saveScenario);
document.getElementById('exportScenarios').addEventListener('click', exportScenarios);
scenarioBody.addEventListener('click', event => {
    const button = event.target.closest('[data-scenario-action]');
    if (!button) return;
    if (button.dataset.scenarioAction === 'load') {
        loadScenario(button.dataset.scenarioId);
    } else if (button.dataset.scenarioAction === 'delete') {
        deleteScenario(button.dataset.scenarioId);
    }
});
ledgerBody.addEventListener('click', event => {
    const button = event.target.closest('[data-delete-transaction]');
    if (button) deleteTransaction(Number(button.dataset.deleteTransaction));
});

[inputMxn, inputFee, rateUsdtMxn, rateUsdtThb].forEach(input => {
    input.addEventListener('input', calculate);
});
[monthlyIncomeInput, workingDaysInput, workdaysPerWeekInput, hoursPerDayInput, incomeTaxInput].forEach(input => {
    input.addEventListener('input', updateIncomeEstimate);
});

document.getElementById('resetLedger').addEventListener('click', clearLedger);

calculateDeposits();
calculate();
updateIncomeEstimate();
renderLedger();
renderScenarios();
