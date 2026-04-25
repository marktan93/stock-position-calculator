import { useState, useMemo, useEffect, useCallback } from 'react';
import contracts from './data/contracts';
import './App.css';

const STORAGE_KEY = 'futures-calc-state';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

function App() {
  const saved = loadState();

  const [selectedContractId, setSelectedContractId] = useState(saved.selectedContractId ?? 'MNQ');
  const [budget, setBudget] = useState(saved.budget ?? '');
  const [stopLossValue, setStopLossValue] = useState(saved.stopLossValue ?? '');
  const [stopLossUnit, setStopLossUnit] = useState(saved.stopLossUnit ?? 'ticks'); // 'ticks' | 'points' | 'prices'
  const [entryPrice, setEntryPrice] = useState(saved.entryPrice ?? '');
  const [stopPrice, setStopPrice] = useState(saved.stopPrice ?? '');
  const [riskValue, setRiskValue] = useState(saved.riskValue ?? '2');
  const [riskUnit, setRiskUnit] = useState(saved.riskUnit ?? 'percent'); // 'percent' | 'usd'
  const [mode, setMode] = useState(saved.mode ?? 'risk');

  const contract = contracts.find((c) => c.id === selectedContractId);
  const categories = [...new Set(contracts.map((c) => c.category))];

  // Persist to localStorage on every change
  const saveState = useCallback(() => {
    const state = { selectedContractId, budget, stopLossValue, stopLossUnit, entryPrice, stopPrice, riskValue, riskUnit, mode };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [selectedContractId, budget, stopLossValue, stopLossUnit, entryPrice, stopPrice, riskValue, riskUnit, mode]);

  useEffect(() => { saveState(); }, [saveState]);

  // Compute points distance from prices
  const priceDistance = useMemo(() => {
    const entry = parseFloat(entryPrice);
    const stop = parseFloat(stopPrice);
    if (!entry || !stop) return 0;
    return Math.abs(entry - stop);
  }, [entryPrice, stopPrice]);

  // Convert stop-loss input to ticks regardless of unit
  const stopLossTicks = useMemo(() => {
    if (!contract) return 0;
    if (stopLossUnit === 'prices') {
      if (!priceDistance) return 0;
      return priceDistance / contract.tickSize;
    }
    const val = parseFloat(stopLossValue);
    if (!val || val <= 0) return 0;
    if (stopLossUnit === 'points') {
      return val / contract.tickSize;
    }
    return val;
  }, [stopLossValue, stopLossUnit, contract, priceDistance]);

  // Convert risk input to a dollar amount
  const riskAmount = useMemo(() => {
    const val = parseFloat(riskValue);
    const budgetNum = parseFloat(budget);
    if (!val || val <= 0) return 0;
    if (riskUnit === 'usd') return val;
    if (!budgetNum || budgetNum <= 0) return 0;
    return budgetNum * (val / 100);
  }, [riskValue, riskUnit, budget]);

  const results = useMemo(() => {
    const budgetNum = parseFloat(budget);

    if (!contract || !budgetNum || budgetNum <= 0) return null;

    if (mode === 'margin') {
      const maxContracts = Math.floor(budgetNum / contract.margin);
      return {
        maxContracts,
        totalMargin: maxContracts * contract.margin,
        remainingBudget: budgetNum - maxContracts * contract.margin,
        mode: 'margin',
      };
    }

    if (!stopLossTicks || stopLossTicks <= 0 || !riskAmount || riskAmount <= 0) return null;

    const riskPerContract = stopLossTicks * contract.tickValue;
    const maxContracts = Math.floor(riskAmount / riskPerContract);
    const actualRisk = maxContracts * riskPerContract;
    const actualRiskPercent = (actualRisk / budgetNum) * 100;
    const pointsRisk = stopLossTicks * contract.tickSize;

    return {
      maxContracts,
      riskAmount,
      riskPerContract,
      actualRisk,
      actualRiskPercent,
      pointsRisk,
      stopLossTicks,
      totalMarginRequired: maxContracts * contract.margin,
      marginExceedsBudget: maxContracts * contract.margin > budgetNum,
      mode: 'risk',
    };
  }, [budget, stopLossTicks, riskAmount, contract, mode]);

  return (
    <div className="app">
      <header className="header">
        <img src="/logo.png" alt="Trading Chick" className="header-logo" />
        <h1>Futures Position Calculator</h1>
        <p className="subtitle">
          Calculate how many contracts to trade based on your budget, risk
          tolerance, and stop-loss distance.
        </p>
      </header>

      <div className="layout">
        {/* Left panel – inputs */}
        <div className="panel input-panel">
          <h2>Configuration</h2>

          <div className="field">
            <label>Calculation Mode</label>
            <div className="toggle-group">
              <button
                className={`toggle-btn ${mode === 'risk' ? 'active' : ''}`}
                onClick={() => setMode('risk')}
              >
                Risk-Based
              </button>
              <button
                className={`toggle-btn ${mode === 'margin' ? 'active' : ''}`}
                onClick={() => setMode('margin')}
              >
                Margin-Based
              </button>
            </div>
          </div>

          <div className="field">
            <label htmlFor="contract">Futures Contract</label>
            <select
              id="contract"
              value={selectedContractId}
              onChange={(e) => setSelectedContractId(e.target.value)}
            >
              {categories.map((cat) => (
                <optgroup key={cat} label={cat}>
                  {contracts
                    .filter((c) => c.category === cat)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.symbol} – {c.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>

          {contract && (
            <div className="contract-specs">
              <div className="spec">
                <span className="spec-label">Tick Size</span>
                <span className="spec-value">{contract.tickSize}</span>
              </div>
              <div className="spec">
                <span className="spec-label">Tick Value</span>
                <span className="spec-value">
                  {formatCurrency(contract.tickValue)}
                </span>
              </div>
              <div className="spec">
                <span className="spec-label">Point Value</span>
                <span className="spec-value">
                  {formatCurrency(contract.pointValue)}
                </span>
              </div>
              <div className="spec">
                <span className="spec-label">Init. Margin</span>
                <span className="spec-value">
                  {formatCurrency(contract.margin)}
                </span>
              </div>
            </div>
          )}

          <div className="field">
            <label htmlFor="budget">Account Budget (USD)</label>
            <input
              id="budget"
              type="number"
              min="0"
              step="100"
              placeholder="e.g. 25000"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>

          {mode === 'risk' && (
            <>
              <div className="field">
                <label htmlFor="riskValue">Risk per Trade</label>
                <div className="input-with-toggle">
                  <input
                    id="riskValue"
                    type="number"
                    min="0"
                    step={riskUnit === 'percent' ? '0.5' : '50'}
                    placeholder={riskUnit === 'percent' ? 'e.g. 2' : 'e.g. 500'}
                    value={riskValue}
                    onChange={(e) => setRiskValue(e.target.value)}
                  />
                  <div className="unit-toggle">
                    <button
                      className={`unit-btn ${riskUnit === 'percent' ? 'active' : ''}`}
                      onClick={() => setRiskUnit('percent')}
                    >
                      %
                    </button>
                    <button
                      className={`unit-btn ${riskUnit === 'usd' ? 'active' : ''}`}
                      onClick={() => setRiskUnit('usd')}
                    >
                      USD
                    </button>
                  </div>
                </div>
                {riskUnit === 'percent' && budget && riskValue && (
                  <span className="hint">
                    = {formatCurrency(parseFloat(budget) * (parseFloat(riskValue) / 100))}
                  </span>
                )}
              </div>

              <div className="field">
                <label>Stop-Loss Distance</label>
                <div className="toggle-group triple">
                  <button
                    className={`toggle-btn ${stopLossUnit === 'ticks' ? 'active' : ''}`}
                    onClick={() => setStopLossUnit('ticks')}
                  >
                    Ticks
                  </button>
                  <button
                    className={`toggle-btn ${stopLossUnit === 'points' ? 'active' : ''}`}
                    onClick={() => setStopLossUnit('points')}
                  >
                    Points
                  </button>
                  <button
                    className={`toggle-btn ${stopLossUnit === 'prices' ? 'active' : ''}`}
                    onClick={() => setStopLossUnit('prices')}
                  >
                    Prices
                  </button>
                </div>

                {stopLossUnit === 'prices' ? (
                  <div className="price-inputs">
                    <div className="price-field">
                      <label htmlFor="entryPrice">Entry Price</label>
                      <input
                        id="entryPrice"
                        type="number"
                        min="0"
                        step="0.25"
                        placeholder="e.g. 21500"
                        value={entryPrice}
                        onChange={(e) => setEntryPrice(e.target.value)}
                      />
                    </div>
                    <div className="price-field">
                      <label htmlFor="stopPrice">Stop-Loss Price</label>
                      <input
                        id="stopPrice"
                        type="number"
                        min="0"
                        step="0.25"
                        placeholder="e.g. 21495"
                        value={stopPrice}
                        onChange={(e) => setStopPrice(e.target.value)}
                      />
                    </div>
                    {contract && priceDistance > 0 && (
                      <span className="hint">
                        Distance: {priceDistance.toFixed(4)} points = {(priceDistance / contract.tickSize).toFixed(1)} ticks
                      </span>
                    )}
                  </div>
                ) : (
                  <>
                    <input
                      id="stopLoss"
                      type="number"
                      min="0"
                      step={stopLossUnit === 'ticks' ? '1' : '0.25'}
                      placeholder={stopLossUnit === 'ticks' ? 'e.g. 20' : 'e.g. 5'}
                      value={stopLossValue}
                      onChange={(e) => setStopLossValue(e.target.value)}
                    />
                    {contract && stopLossValue && (
                      <span className="hint">
                        {stopLossUnit === 'ticks'
                          ? `= ${(parseFloat(stopLossValue) * contract.tickSize).toFixed(4)} points`
                          : `= ${(parseFloat(stopLossValue) / contract.tickSize).toFixed(1)} ticks`}
                      </span>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right panel – results */}
        <div className="panel results-panel">
          <h2>Results</h2>

          {!results ? (
            <p className="placeholder-text">
              Fill in the fields on the left to see your position sizing.
            </p>
          ) : results.mode === 'margin' ? (
            <div className="results">
              <div className="result-hero">
                <span className="result-label">Max Contracts</span>
                <span className="result-number">{results.maxContracts}</span>
              </div>
              <div className="result-details">
                <div className="detail-row">
                  <span>Total Margin Required</span>
                  <span>{formatCurrency(results.totalMargin)}</span>
                </div>
                <div className="detail-row">
                  <span>Remaining Budget</span>
                  <span>{formatCurrency(results.remainingBudget)}</span>
                </div>
                <div className="detail-row">
                  <span>Budget</span>
                  <span>{formatCurrency(parseFloat(budget))}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="results">
              <div className="result-hero">
                <span className="result-label">Contracts to Trade</span>
                <span className="result-number">{results.maxContracts}</span>
              </div>

              {results.maxContracts === 0 && (
                <div className="warning">
                  Your risk budget ({formatCurrency(results.riskAmount)}) is
                  smaller than the risk per single contract (
                  {formatCurrency(results.riskPerContract)}). Reduce your
                  stop-loss distance or increase your budget / risk %.
                </div>
              )}

              {results.marginExceedsBudget && results.maxContracts > 0 && (
                <div className="warning">
                  Margin required ({formatCurrency(results.totalMarginRequired)})
                  exceeds your budget. You may need additional funds for initial
                  margin.
                </div>
              )}

              <div className="result-details">
                <div className="detail-row">
                  <span>Max Risk Amount{riskUnit === 'percent' ? ` (${riskValue}%)` : ''}</span>
                  <span>{formatCurrency(results.riskAmount)}</span>
                </div>
                <div className="detail-row">
                  <span>Risk per Contract ({results.stopLossTicks.toFixed(1)} ticks)</span>
                  <span>{formatCurrency(results.riskPerContract)}</span>
                </div>
                <div className="detail-row">
                  <span>Actual Risk ({results.maxContracts} contracts)</span>
                  <span>
                    {formatCurrency(results.actualRisk)} (
                    {results.actualRiskPercent.toFixed(2)}%)
                  </span>
                </div>
                <div className="detail-row">
                  <span>Stop-Loss in Points</span>
                  <span>{results.pointsRisk.toFixed(4)}</span>
                </div>
                <div className="detail-row">
                  <span>Margin Required</span>
                  <span>{formatCurrency(results.totalMarginRequired)}</span>
                </div>
              </div>

              <h3>Contract Comparison</h3>
              <div className="comparison-table-wrapper">
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th>Contract</th>
                      <th>Tick Value</th>
                      <th>Risk / Contract</th>
                      <th>Max Contracts</th>
                      <th>Margin Req.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.map((c) => {
                      const riskAmt = riskAmount;
                      const rpc = stopLossTicks * c.tickValue;
                      const maxC = rpc > 0 ? Math.floor(riskAmt / rpc) : 0;
                      const isSelected = c.id === selectedContractId;
                      return (
                        <tr
                          key={c.id}
                          className={isSelected ? 'row-selected' : ''}
                        >
                          <td>
                            <strong>{c.symbol}</strong>{' '}
                            <span className="muted">{c.name}</span>
                          </td>
                          <td>{formatCurrency(c.tickValue)}</td>
                          <td>{formatCurrency(rpc)}</td>
                          <td>{maxC}</td>
                          <td>{formatCurrency(maxC * c.margin)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="footer">
        <p>
          Values are approximate. Always confirm contract specs with your broker
          before trading.
        </p>
      </footer>
    </div>
  );
}

export default App;
