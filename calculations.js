(function (root, factory) {
    const calculations = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = calculations;
    } else {
        root.FinancialCalculations = calculations;
    }
}(globalThis, function () {
    function calculateDepositStages(stages) {
        if (!Array.isArray(stages) || stages.length === 0) {
            throw new TypeError('At least one deposit stage is required.');
        }

        let previousClients = null;
        let totalTransactions = 0;
        const stageTotals = stages.map((stage, index) => {
            if (!Number.isSafeInteger(stage.clients) || stage.clients < 0) {
                throw new RangeError(`Stage ${index + 1} must have a non-negative whole number of clients.`);
            }
            if (!Number.isFinite(stage.amount) || stage.amount < 0) {
                throw new RangeError(`Stage ${index + 1} must have a non-negative deposit amount.`);
            }
            if (previousClients !== null && stage.clients > previousClients) {
                throw new RangeError(`Stage ${index + 1} cannot have more clients than the preceding stage.`);
            }

            const stageTotal = stage.clients * stage.amount;
            totalTransactions += stage.clients;
            previousClients = stage.clients;
            if (!Number.isFinite(stageTotal) || !Number.isSafeInteger(totalTransactions)) {
                throw new RangeError('Deposit totals exceed the supported calculation range.');
            }
            return stageTotal;
        });

        const cohortTotalMxn = stageTotals.reduce((total, stageTotal) => total + stageTotal, 0);
        if (!Number.isFinite(cohortTotalMxn)) {
            throw new RangeError('Deposit totals exceed the supported calculation range.');
        }

        const retentionPercentages = stages.map((stage, index) => {
            if (index === 0 || stages[index - 1].clients === 0) return null;
            return (stage.clients / stages[index - 1].clients) * 100;
        });

        return { stageTotals, totalTransactions, cohortTotalMxn, retentionPercentages };
    }

    function calculateConversion(amountMxn, feePct, usdtMxn, usdtThb) {
        if (!Number.isFinite(amountMxn) || amountMxn < 0) {
            throw new RangeError('The MXN amount must be non-negative.');
        }
        if (!Number.isFinite(feePct) || feePct < 0 || feePct > 100) {
            throw new RangeError('The exchange fee must be between 0% and 100%.');
        }
        if (!Number.isFinite(usdtMxn) || usdtMxn <= 0 || !Number.isFinite(usdtThb) || usdtThb <= 0) {
            throw new RangeError('Both exchange rates must be positive numbers.');
        }

        const feeMxn = amountMxn * (feePct / 100);
        const netMxn = amountMxn - feeMxn;
        const usdt = netMxn / usdtMxn;
        const thb = usdt * usdtThb;
        const effectiveRate = amountMxn > 0 ? thb / amountMxn : 0;
        if (![feeMxn, netMxn, usdt, thb, effectiveRate].every(Number.isFinite)) {
            throw new RangeError('The conversion exceeds the supported calculation range.');
        }
        return { amountMxn, feePct, feeMxn, netMxn, usdtMxn, usdtThb, usdt, thb, effectiveRate };
    }

    function calculateForecast(cohortMxn, mode) {
        if (!Number.isFinite(cohortMxn) || cohortMxn < 0) {
            throw new RangeError('The cohort total must be non-negative.');
        }
        if (mode !== 'one-time' && mode !== 'repeat-daily') {
            throw new RangeError('Choose a supported forecast assumption.');
        }

        const dailyMultiplier = mode === 'repeat-daily' ? 30 : 1;
        const projectedMxn = cohortMxn * dailyMultiplier;
        if (!Number.isFinite(projectedMxn)) {
            throw new RangeError('The forecast exceeds the supported calculation range.');
        }
        return { mode, dailyMultiplier, projectedMxn };
    }

    function csvField(value) {
        const text = String(value ?? '');
        const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
        return `"${safeText.replaceAll('"', '""')}"`;
    }

    function buildScenarioCsv(scenarios, stageNames) {
        if (!Array.isArray(scenarios) || !Array.isArray(stageNames)) {
            throw new TypeError('Scenarios and stage names must be arrays.');
        }
        const stageColumns = stageNames.flatMap(name => [
            `${name} clients`,
            `${name} amount MXN`,
            `${name} total MXN`
        ]);
        const headers = [
            'Scenario',
            'Saved at',
            'Forecast assumption',
            'Deposit transactions per cohort',
            'Cohort gross MXN',
            'Cohort FX fee MXN',
            'Cohort net MXN',
            'Cohort USDT',
            'Cohort payout THB',
            '30-day gross MXN',
            '30-day payout THB',
            'Fee percent',
            'USDT per MXN',
            'THB per USDT',
            ...stageColumns
        ];
        const rows = scenarios.map(scenario => {
            const conversion = scenario.results.cohortConversion;
            const forecastConversion = scenario.results.forecastConversion;
            return [
                scenario.name,
                scenario.savedAt,
                scenario.forecastMode,
                scenario.results.totalTransactions,
                scenario.results.cohortTotalMxn,
                conversion.feeMxn,
                conversion.netMxn,
                conversion.usdt,
                conversion.thb,
                scenario.results.forecast.projectedMxn,
                forecastConversion.thb,
                scenario.exchange.feePct,
                scenario.exchange.usdtMxn,
                scenario.exchange.usdtThb,
                ...scenario.stages.flatMap((stage, index) => [
                    stage.clients,
                    stage.amount,
                    scenario.results.stageTotals[index]
                ])
            ];
        });
        return [headers, ...rows].map(row => row.map(csvField).join(',')).join('\r\n');
    }

    return { calculateDepositStages, calculateConversion, calculateForecast, buildScenarioCsv };
}));
