/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Treasury() {
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("cashapp");
  const [payoutDest, setPayoutDest] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositPlatform, setDepositPlatform] = useState("GoFundMe");
  const [depositUser, setDepositUser] = useState("user1");
  const [showResult, setShowResult] = useState<any>(null);

  const balances = useQuery(api.treasury.aggregateBalances, {});
  const feeCalc = useQuery(api.treasury.calculatePayout, {
    amount: parseFloat(payoutAmount) || 0,
  });
  const requestPayout = useMutation(api.treasury.requestPayout);
  const createDeposit = useMutation(api.treasury.createDeposit);

  if (!balances) {
    return <div className="text-center text-ifmuted py-20">Loading treasury...</div>;
  }

  const handlePayout = async () => {
    try {
      const result = await requestPayout({
        userId: depositUser,
        payoutMethod,
        payoutDestination: payoutDest,
      });
      setShowResult(result);
    } catch (e: any) {
      setShowResult({ error: e.message });
    }
  };

  const handleDeposit = async () => {
    try {
      const result = await createDeposit({
        userId: depositUser,
        amount: parseFloat(depositAmount) || 0,
        sourcePlatform: depositPlatform,
      });
      setShowResult(result);
    } catch (e: any) {
      setShowResult({ error: e.message });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="page-title">Treasury</h2>
        <p className="page-subtitle">Holding accounts · Fee calculation · Payouts</p>
      </div>

      {/* Holding Account Summary */}
      <div className="card">
        <h3 className="text-sm font-semibold text-iftext mb-3">Holding Account</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-ifdark rounded-xl p-3">
            <p className="text-xs text-ifmuted">Available Balance</p>
            <p className="text-2xl font-bold text-ifgreen mt-1">
              ${balances.holdingAccounts.totalHeld.toLocaleString()}
            </p>
            <p className="text-[10px] text-ifmuted mt-0.5">Before fees</p>
          </div>
          <div className="bg-ifdark rounded-xl p-3">
            <p className="text-xs text-ifmuted">You'd Receive</p>
            <p className="text-2xl font-bold text-ifaccent mt-1">
              ${((balances.holdingAccounts.totalHeld || 0) * 0.921).toFixed(2)}
            </p>
            <p className="text-[10px] text-ifmuted mt-0.5">After 5% + 2.9% fees</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-ifborder space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-ifmuted">Total Paid Out</span>
            <span className="text-ifamber">${balances.holdingAccounts.totalPaidOut.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-ifmuted">Total Fees Collected</span>
            <span className="text-ifcyan">${balances.holdingAccounts.totalFees.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Fee Calculator */}
      <div className="card">
        <h3 className="text-sm font-semibold text-iftext mb-3">Fee Calculator</h3>
        <input
          type="number"
          placeholder="Enter amount to calculate"
          value={payoutAmount}
          onChange={(e) => setPayoutAmount(e.target.value)}
          className="input"
        />
        {payoutAmount && feeCalc && parseFloat(payoutAmount) > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-ifmuted">Available Balance</span>
              <span className="text-ifgreen font-semibold">{feeCalc.display.availableBalance}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-ifmuted">Platform Fee (5%)</span>
              <span className="text-ifred">${feeCalc.feeBreakdown.platformFee.amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-ifmuted">Processing (2.9% + $0.30)</span>
              <span className="text-ifred">${feeCalc.feeBreakdown.processingFee.amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-ifborder">
              <span className="text-iftext font-semibold">You Receive</span>
              <span className="text-ifaccent font-bold text-lg">{feeCalc.display.youReceive}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-ifmuted">Our Fee</span>
              <span className="text-ifamber">{feeCalc.display.ourFee}</span>
            </div>
          </div>
        )}
      </div>

      {/* Deposit / Migrate Funds */}
      <div className="card">
        <h3 className="text-sm font-semibold text-iftext mb-3">Deposit Funds (Migrate)</h3>
        <input
          type="text"
          placeholder="User ID"
          value={depositUser}
          onChange={(e) => setDepositUser(e.target.value)}
          className="input mb-2"
        />
        <input
          type="number"
          placeholder="Amount ($)"
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value)}
          className="input mb-2"
        />
        <select
          value={depositPlatform}
          onChange={(e) => setDepositPlatform(e.target.value)}
          className="input mb-3"
        >
          <option value="GoFundMe">GoFundMe</option>
          <option value="Kickstarter">Kickstarter</option>
          <option value="Facebook">Facebook Fundraisers</option>
          <option value="Manual">Manual Entry</option>
        </select>
        <button
          onClick={handleDeposit}
          disabled={!depositAmount || !depositUser}
          className="btn-secondary"
        >
          Deposit to Holding Account
        </button>
      </div>

      {/* Request Payout */}
      <div className="card">
        <h3 className="text-sm font-semibold text-iftext mb-3">Request Payout (Cash Out)</h3>
        <input
          type="text"
          placeholder="User ID"
          value={depositUser}
          onChange={(e) => setDepositUser(e.target.value)}
          className="input mb-2"
        />
        <div className="grid grid-cols-3 gap-2 mb-2">
          <button
            onClick={() => setPayoutMethod("cashapp")}
            className={`py-2 rounded-xl text-xs font-medium ${payoutMethod === "cashapp" ? "bg-ifgreen text-white" : "bg-ifdark text-ifmuted"}`}
          >
            CashApp
          </button>
          <button
            onClick={() => setPayoutMethod("bitcoin")}
            className={`py-2 rounded-xl text-xs font-medium ${payoutMethod === "bitcoin" ? "bg-ifamber text-white" : "bg-ifdark text-ifmuted"}`}
          >
            Bitcoin
          </button>
          <button
            onClick={() => setPayoutMethod("paypal")}
            className={`py-2 rounded-xl text-xs font-medium ${payoutMethod === "paypal" ? "bg-ifcyan text-white" : "bg-ifdark text-ifmuted"}`}
          >
            PayPal
          </button>
        </div>
        <input
          type="text"
          placeholder={payoutMethod === "cashapp" ? "$Cashtag" : payoutMethod === "bitcoin" ? "Wallet Address" : "PayPal Email"}
          value={payoutDest}
          onChange={(e) => setPayoutDest(e.target.value)}
          className="input mb-3"
        />
        <button
          onClick={handlePayout}
          disabled={!payoutDest || !depositUser}
          className="btn-primary"
        >
          Request Payout
        </button>
      </div>

      {/* Result */}
      {showResult && (
        <div className="card">
          {showResult.error ? (
            <p className="text-sm text-ifred">Error: {showResult.error}</p>
          ) : showResult.summary ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-ifgreen">Payout Requested ✓</p>
              <div className="flex justify-between text-xs">
                <span className="text-ifmuted">Available</span>
                <span className="text-iftext">{showResult.summary.availableBalance}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-ifmuted">You Receive</span>
                <span className="text-ifaccent font-bold">{showResult.summary.youReceive}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-ifmuted">Our Fee</span>
                <span className="text-ifamber">{showResult.summary.ourFee}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-ifmuted">Method</span>
                <span className="text-iftext">{showResult.summary.method} → {showResult.summary.destination}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-ifgreen">Deposited ✓</p>
              <p className="text-xs text-ifmuted">
                ${showResult.depositedAmount.toLocaleString()} from {showResult.transactionId ? "external" : "manual"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
