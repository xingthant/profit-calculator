const test = require('node:test');
const assert = require('node:assert/strict');
const {
    calculateDepositStages,
    calculateConversion,
    calculateForecast,
    buildScenarioCsv
} = require('./calculations.js');

const exampleStages = [
    { clients: 10, amount: 50 },
    { clients: 5, amount: 30 },
    { clients: 3, amount: 20 },
    { clients: 3, amount: 20 },
    { clients: 3, amount: 20 },
    { clients: 3, amount: 20 },
    { clients: 3, amount: 20 }
];

test('calculates each deposit stage and cohort total', () => {
    assert.deepEqual(calculateDepositStages(exampleStages), {
        stageTotals: [500, 150, 60, 60, 60, 60, 60],
        totalTransactions: 30,
        cohortTotalMxn: 950,
        retentionPercentages: [null, 50, 60, 100, 100, 100, 100]
    });
});

test('rejects a later stage with more clients than the previous stage', () => {
    const stages = [...exampleStages];
    stages[3] = { clients: 4, amount: 20 };
    assert.throws(() => calculateDepositStages(stages), /Stage 4 cannot have more clients/);
});

test('rejects negative deposits and non-integer client counts', () => {
    assert.throws(() => calculateDepositStages([{ clients: 1, amount: -1 }]), /non-negative deposit amount/);
    assert.throws(() => calculateDepositStages([{ clients: 1.5, amount: 10 }]), /whole number of clients/);
});

test('calculates FX fee, net MXN, USDT and THB in the right sequence', () => {
    const result = calculateConversion(950, 4, 18.25, 33.58);
    assert.equal(result.feeMxn, 38);
    assert.equal(result.netMxn, 912);
    assert.equal(result.usdt, 912 / 18.25);
    assert.ok(Math.abs(result.thb - 1678.08) < 1e-10);
});

test('rejects invalid exchange rates and fees', () => {
    assert.throws(() => calculateConversion(100, 4, 0, 33.58), /rates must be positive/);
    assert.throws(() => calculateConversion(100, 101, 18.25, 33.58), /fee must be between/);
});

test('forecasts one-time cohort deposits once in the 30-day period', () => {
    assert.deepEqual(calculateForecast(950, 'one-time'), {
        mode: 'one-time',
        dailyMultiplier: 1,
        projectedMxn: 950
    });
});

test('forecasts a daily repeating cohort 30 times', () => {
    assert.deepEqual(calculateForecast(950, 'repeat-daily'), {
        mode: 'repeat-daily',
        dailyMultiplier: 30,
        projectedMxn: 28500
    });
});

test('applies the fee and exchange rates consistently to the 30-day forecast', () => {
    const oneTime = calculateConversion(calculateForecast(950, 'one-time').projectedMxn, 4, 18.25, 33.58);
    const repeating = calculateConversion(calculateForecast(950, 'repeat-daily').projectedMxn, 4, 18.25, 33.58);
    assert.equal(oneTime.thb, 1678.08);
    assert.ok(Math.abs(repeating.thb - 50342.4) < 1e-9);
});

test('rejects unsupported forecast assumptions', () => {
    assert.throws(() => calculateForecast(950, 'weekly'), /supported forecast assumption/);
});

test('exports scenario names safely and includes each deposit stage in CSV', () => {
    const scenario = {
        name: '=SUM(1,1)',
        savedAt: '2026-10-13T12:00:00.000Z',
        forecastMode: 'one-time',
        exchange: { feePct: 4, usdtMxn: 18.25, usdtThb: 33.58 },
        stages: exampleStages,
        results: {
            totalTransactions: 30,
            cohortTotalMxn: 950,
            stageTotals: [500, 150, 60, 60, 60, 60, 60],
            cohortConversion: { feeMxn: 38, netMxn: 912, usdt: 912 / 18.25, thb: 1678.08 },
            forecast: { projectedMxn: 950 },
            forecastConversion: { thb: 1678.08 }
        }
    };
    const csv = buildScenarioCsv([scenario], ['1st', '2nd']);
    const [headers, data] = csv.split('\r\n');
    assert.match(data, /^"'=SUM\(1,1\)"/);
    assert.match(headers, /"1st clients","1st amount MXN","1st total MXN","2nd clients"/);
    assert.equal(csv.split('\r\n').length, 2);
});
