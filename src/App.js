import React, { useState, useEffect } from "react";

const SHEET_ID = process.env.REACT_APP_SHEET_ID;
const USERS_SHEET = process.env.REACT_APP_USERS_SHEET;
const PAYMENTS_SHEET = process.env.REACT_APP_PAYMENTS_SHEET;
const TRIP_SHEET = process.env.REACT_APP_TRIP_SHEET;
const EXPENSES_SHEET = process.env.REACT_APP_EXPENSES_SHEET;

const formatTime = (value) => String(Math.max(0, value)).padStart(2, '0');

function CountdownTimer({ startDate }) {
  const [timeLeft, setTimeLeft] = useState({});
  const tripStart = new Date("2025-12-25 14:00").getTime();

  useEffect(() => {
    if (!startDate || isNaN(tripStart)) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const distance = tripStart - now;

      if (distance < 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true });
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, isPast: false });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [startDate, tripStart]);

  if (Object.keys(timeLeft).length === 0) {
    return <div className="countdown-card loading">Calculating countdown...</div>;
  }

  if (timeLeft.isPast) {
    return (
      <div className="countdown-card past">
        <div className="countdown-status">Trip is Underway! 🥳</div>
        <div className="countdown-message">The adventure has begun.</div>
      </div>
    );
  }

  return (
    <div className="countdown-card">
      <div className="countdown-label">Trip Starts In:</div>
      <div className="countdown-grid">
        <div className="time-unit">
          <span className="time-value">{formatTime(timeLeft.days)}</span>
          <span className="unit-label">Days</span>
        </div>
        <div className="time-unit">
          <span className="time-value">{formatTime(timeLeft.hours)}</span>
          <span className="unit-label">Hours</span>
        </div>
        <div className="time-unit">
          <span className="time-value">{formatTime(timeLeft.minutes)}</span>
          <span className="unit-label">Mins</span>
        </div>
        <div className="time-unit">
          <span className="time-value">{formatTime(timeLeft.seconds)}</span>
          <span className="unit-label">Secs</span>
        </div>
      </div>
    </div>
  );
}

const fetchSheet = async (sheet) => {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheet}`;
    let response = null;
    let delay = 1000;

    for (let i = 0; i < 3; i++) {
      response = await fetch(url);
      if (response.ok) break;
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }

    if (!response || !response.ok) {
      throw new Error(`Failed to fetch sheet ${sheet}`);
    }

    const raw = await response.text();

    return JSON.parse(raw.substring(47, raw.length - 2)).table;
  } catch (err) {
    console.error("Sheet fetch failed:", sheet, err);
    return null;
  }
};

function App() {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [tripInfo, setTripInfo] = useState({});
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("tripUser");
    if (saved) {
      setLoggedInUser(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [uSheet, pSheet, tSheet, eSheet] = await Promise.all([

          fetchSheet(USERS_SHEET),
          fetchSheet(PAYMENTS_SHEET),
          fetchSheet(TRIP_SHEET),
          fetchSheet(EXPENSES_SHEET),
        ]);
        console.log("EXPENSE SHEET ROWS:", eSheet.rows);

        if (!uSheet || !pSheet || !tSheet || !eSheet) {
          console.error("One or more sheets failed to load");
          setLoading(false);
          return;
        }

        const userList = uSheet.rows.slice(1).map((r) => ({
          name: r.c[0]?.v,
          password: r.c[1]?.v,
          role: r.c[2]?.v,
        }));
        setUsers(userList);

        const paymentList = pSheet.rows.map((r) => ({
          name: r.c[0]?.v,
          paid: parseFloat(r.c[1]?.v) || 0,
        }));
        setPayments(paymentList);

        const tInfo = {};
        tSheet.rows.forEach((row) => {
          const key = row.c[0]?.v;
          const val = row.c[1]?.f || row.c[1]?.v;
          tInfo[key] = isNaN(val) ? val : parseFloat(val);
        });

        if (!tInfo.start_date) {
          tInfo.start_date = '2025-12-25';
        }

        setTripInfo(tInfo);

        const expenseList = eSheet.rows
          .map((r) => ({
            category: r.c[0]?.v,
            cost: parseFloat(r.c[1]?.v) || 0,
            date: r.c[2]?.f || r.c[2]?.v || "",
            notes: r.c[3]?.v || "No notes",
          }))
          .filter((e) => e.category && !isNaN(e.cost));


        setExpenses(
          expenseList.filter(e =>
            e.category &&
            !isNaN(e.cost) &&
            e.cost > 0
          )
        );
      } catch (err) {
        console.error("Load error:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const login = (name, pass) => {
    const user = users.find((u) => u.name === name && u.password === pass);

    if (user) {
      setLoggedInUser(user);
      localStorage.setItem("tripUser", JSON.stringify(user));
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  };


  const logout = () => {
    setLoggedInUser(null);
    localStorage.removeItem("tripUser");
  };

  const perHead = parseFloat(tripInfo.per_head) || 0;
  const myPaid =
    loggedInUser?.name &&
    (payments.find((p) => p.name === loggedInUser.name)?.paid || 0);

  const status =
    myPaid >= perHead ? "Paid" : myPaid > 0 ? "Partial" : "Pending";

  const memberCount = users.length;

  const appStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');

    /* BASE STYLES */
    .page-container {
        font-family: 'Inter', sans-serif;
        background-color: #f4f7fa;
        min-height: 100vh;
        padding: 0;
        margin: 0;
        color: #333;
    }
    
    .dashboard-layout {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
    }
    
    /* UTILITIES */
    .center-screen {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        text-align: center;
    }
    
    .loading-spinner {
        border: 4px solid rgba(0, 0, 0, 0.1);
        border-top: 4px solid #10b981; /* Green color */
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin-bottom: 10px;
    }
    
    .loading-text {
        font-size: 1.1rem;
        color: #555;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .section-title {
        font-size: 1.8rem;
        font-weight: 800;
        color: #1f2937;
        margin-bottom: 20px;
        border-left: 5px solid #10b981;
        padding-left: 10px;
        line-height: 1.2;
    }

    .summary-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: #374151;
        margin-top: 30px;
        margin-bottom: 15px;
    }
    
    .divider {
        border: 0;
        height: 1px;
        background-color: #e5e7eb;
        margin: 40px 0;
    }
    
    /* HEADER & USER PROFILE */
    .main-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 0;
        margin-bottom: 30px;
        border-bottom: 3px solid #10b981;
    }

    .header-title {
        font-size: 1.8rem;
        font-weight: 800;
        color: #1f2937;
    }

    .trip-name {
        color: #059669;
    }
    
    .user-profile {
        display: flex;
        align-items: center;
        gap: 15px;
    }
    
    .welcome-text {
        font-weight: 600;
        color: #4b5563;
        font-size: 0.95rem;
    }
    
    .logout-btn {
        background-color: #ef4444;
        color: white;
        border: none;
        padding: 8px 15px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        transition: background-color 0.2s ease;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    
    .logout-btn:hover {
        background-color: #dc2626;
    }
    
    /* STAT CARDS */
    .grid-cards-3 {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 25px;
    }
    
    .stat-card, .countdown-card {
        background: white;
        border-radius: 12px;
        padding: 25px;
        box-shadow: 0 10px 15px rgba(0, 0, 0, 0.05);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 130px;
        transition: transform 0.2s;
    }
    
    .stat-card:hover {
        transform: translateY(-3px);
    }

    .stat-card.primary-card {
        border-bottom: 5px solid #3b82f6;
    }
    
    .stat-card.secondary-card {
        border-bottom: 5px solid #f59e0b;
    }

    .stat-label {
        font-size: 1rem;
        color: #6b7280;
        font-weight: 600;
        margin-bottom: 5px;
    }
    
    .stat-number {
        font-size: 2.5rem;
        font-weight: 800;
        color: #1f2937;
    }

    .stat-card {
        position: relative;
        overflow: hidden;
    }

    .card-icon {
        position: absolute;
        top: 15px;
        right: 15px;
        font-size: 3rem;
        opacity: 0.1;
    }
    
    /* COUNTDOWN TIMER STYLES */
    .countdown-card {
        border-bottom: 5px solid #10b981;
        background-color: #f0fdf4;
    }

    .countdown-card.past {
        background-color: #fee2e2;
        border-bottom: 5px solid #ef4444;
        color: #ef4444;
        text-align: center;
    }

    .countdown-status {
        font-size: 1.5rem;
        font-weight: 700;
        margin-bottom: 5px;
    }

    .countdown-message {
        font-size: 1rem;
        font-weight: 400;
    }
    
    .countdown-label {
        font-size: 1rem;
        color: #059669;
        font-weight: 700;
        margin-bottom: 10px;
    }
    
    .countdown-grid {
        display: flex;
        justify-content: space-between;
        gap: 10px;
    }
    
    .time-unit {
        flex: 1;
        text-align: center;
        padding: 10px 0;
        border-radius: 8px;
        background-color: #d1fae5;
        border: 1px solid #a7f3d0;
    }
    
    .time-value {
        display: block;
        font-size: 1.8rem;
        font-weight: 800;
        color: #065f46;
        line-height: 1;
    }
    
    .unit-label {
        display: block;
        font-size: 0.75rem;
        color: #065f46;
        font-weight: 600;
        text-transform: uppercase;
        margin-top: 2px;
    }

    /* MY PAYMENT STATUS */
    .my-payment-card {
        background-color: white;
        border-radius: 12px;
        padding: 30px;
        box-shadow: 0 10px 15px rgba(0, 0, 0, 0.05);
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        border-top: 5px solid;
    }
    
    .my-payment-card.status-paid {
        border-color: #10b981;
        background-color: #f0fdf4;
    }
    .my-payment-card.status-partial {
        border-color: #f59e0b;
        background-color: #fffbeb;
    }
    .my-payment-card.status-pending {
        border-color: #ef4444;
        background-color: #fef2f2;
    }
    
    .payment-amount {
        font-size: 3rem;
        font-weight: 800;
        color: #1f2937;
        line-height: 1;
    }
    
    .payment-amount-label {
        font-size: 1rem;
        color: #6b7280;
        font-weight: 600;
        margin-bottom: 15px;
    }
    
    .payment-status {
        font-size: 1.2rem;
        font-weight: 700;
        color: #1f2937;
    }
    
    .due-info {
        font-size: 0.9rem;
        font-weight: 600;
        color: #ef4444;
        margin-left: 10px;
    }

    /* MEMBER LIST */
    .members-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 15px;
        margin-top: 20px;
    }

    .member-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        border: 1px solid #e5e7eb;
    }

    .member-card.current-user-highlight {
        border: 2px solid #3b82f6;
        box-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
    }
    
    .member-name {
        font-weight: 600;
        color: #1f2937;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .you-tag {
        background-color: #3b82f6;
        color: white;
        font-size: 0.7rem;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 700;
    }
    
    .member-payment-status {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
    }

    .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
    }

    .member-payment-status.status-paid .status-dot { background-color: #10b981; }
    .member-payment-status.status-partial .status-dot { background-color: #f59e0b; }
    .member-payment-status.status-pending .status-dot { background-color: #ef4444; }

    .paid-amount-value {
        color: #4b5563;
        font-size: 1rem;
    }
    
    /* LOGIN SCREEN */
    .login-wrapper {
        min-height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: #e0f2f1; /* Light teal background */
    }

    .login-card {
        background: white;
        padding: 40px;
        border-radius: 15px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        text-align: center;
        width: 100%;
        max-width: 380px;
    }

    .logo-placeholder {
        font-size: 3rem;
        margin-bottom: 10px;
    }

    .login-card h2 {
        font-size: 1.8rem;
        color: #065f46;
        margin-bottom: 25px;
        font-weight: 800;
    }

    .auth-input {
        width: 100%;
        padding: 12px;
        margin-bottom: 15px;
        border: 2px solid #d1fae5;
        border-radius: 8px;
        font-size: 1rem;
        box-sizing: border-box;
        transition: border-color 0.3s;
    }

    .auth-input:focus {
        border-color: #10b981;
        outline: none;
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
    }

    .login-btn {
        width: 100%;
        background-color: #10b981;
        color: white;
        border: none;
        padding: 12px;
        border-radius: 8px;
        font-size: 1.1rem;
        font-weight: 700;
        cursor: pointer;
        transition: background-color 0.2s, transform 0.1s;
        box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);
    }

    .login-btn:hover {
        background-color: #059669;
        transform: translateY(-1px);
    }

    .login-error-message {
        color: #ef4444;
        font-size: 0.9rem;
        margin-top: -5px;
        margin-bottom: 15px;
    }


    /* EXPENSE TRACKER */
    .expense-split-section {
        margin-top: 40px;
        padding: 20px;
        background-color: white;
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    }

    .expense-container {
        overflow-x: auto;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
    }

    .expense-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 600px; /* Ensure table is readable on small screens */
    }

    .expense-table th {
        background-color: #f9fafb;
        color: #4b5563;
        font-weight: 700;
        text-align: left;
        padding: 12px 15px;
        border-bottom: 2px solid #e5e7eb;
        text-transform: uppercase;
        font-size: 0.85rem;
    }

    .expense-table td {
        padding: 12px 15px;
        border-bottom: 1px solid #f3f4f6;
        color: #374151;
        font-size: 0.95rem;
        vertical-align: top;
    }

    .expense-table tbody tr:last-child td {
        border-bottom: none;
    }

    .expense-table tbody tr:hover {
        background-color: #fefcff;
    }

    .right-align {
        text-align: right;
        font-weight: 600;
    }

    .text-wrap {
        white-space: normal;
    }

    .expense-category {
        font-weight: 600;
        color: #1f2937;
    }
    
    .expense-date {
        font-style: italic;
        color: #6b7280;
    }
.expense-table th,
.expense-table td {
    white-space: nowrap;
}

.expense-table th:nth-child(1),
.expense-table td:nth-child(1) {
    width: 25%;
}

.expense-table th:nth-child(2),
.expense-table td:nth-child(2) {
    width: 15%;
    text-align: right;
}

.expense-table th:nth-child(3),
.expense-table td:nth-child(3) {
    width: 20%;
}

.expense-table th:nth-child(4),
.expense-table td:nth-child(4) {
    width: 40%;
}

    .expense-summary-grid {
        display: flex;
        gap: 20px;
        margin-top: 20px;
        flex-wrap: wrap;
    }

    .summary-card {
        flex: 1;
        min-width: 250px;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
    }

    .summary-card.total {
        background-color: #eff6ff;
        border: 2px solid #3b82f6;
    }

    .summary-card.per-member {
        background-color: #f0fdf4;
        border: 2px solid #10b981;
    }

    .summary-label {
        font-size: 0.9rem;
        font-weight: 600;
        color: #4b5563;
        margin-bottom: 5px;
    }

    .summary-value {
        font-size: 1.8rem;
        font-weight: 800;
        color: #1f2937;
    }

    .expense-warning {
        background-color: #fefcbf;
        color: #854d0e;
        padding: 15px;
        border-radius: 8px;
        margin-top: 20px;
        font-weight: 600;
        border-left: 5px solid #fbbf24;
    }
        

    /* RESPONSIVENESS */
    @media (max-width: 768px) {
        .main-header {
            flex-direction: column;
            gap: 15px;
            text-align: center;
        }

        .user-profile {
            flex-direction: column;
            gap: 10px;
        }

        .header-title {
            font-size: 1.5rem;
        }

        .dashboard-layout {
            padding: 10px;
        }

        .grid-cards-3 {
            grid-template-columns: 1fr;
        }

        .stat-card, .countdown-card {
            min-height: auto;
        }

        .countdown-grid {
            flex-wrap: wrap;
        }

        .time-unit {
            flex-basis: 48%; /* Two columns on mobile */
            padding: 8px 0;
        }

        .time-value {
            font-size: 1.5rem;
        }

        .member-card {
            padding: 12px;
        }
        
        .member-card.current-user-highlight {
            order: -1; /* Move current user to top */
        }
    }
  `;

  return (
    <React.Fragment>
      <style dangerouslySetInnerHTML={{ __html: appStyles }} />
      <div className="page-container">
        {loading && (
          <div className="center-screen">
            <div className="loading-spinner" />
            <p className="loading-text">Fetching data…</p>
          </div>
        )}

        {!loading && !loggedInUser && (
          <LoginScreen
            login={login}
            users={users}
            loginError={loginError}
            setLoginError={setLoginError}
          />
        )}

        {!loading && loggedInUser && (
          <Dashboard
            user={loggedInUser}
            payments={payments}
            trip={tripInfo}
            myPayment={myPaid}
            perHeadCost={perHead}
            paymentStatus={status}
            logout={logout}
            expenses={expenses}
            memberCount={memberCount}
          />
        )}
      </div>
    </React.Fragment>
  );
}

function LoginScreen({ login, users, loginError, setLoginError }) {
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");

  const submit = (e) => {
    e.preventDefault();
    setLoginError(false);
    login(name, pass);
  };

  return (
    <div className="login-wrapper">
      <form className="login-card" onSubmit={submit}>
        <div className="logo-placeholder">🗺️</div>
        <h2>Trip Dashboard</h2>

        <select
          className="auth-input select-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        >
          <option value="" disabled>Select Name</option>
          {users.map((u) => (
            <option key={u.name} value={u.name}>
              {u.name}
            </option>
          ))}
        </select>



        <input
          type="password"
          className="auth-input"
          placeholder="Password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          required
        />

        {loginError && (
          <p className="login-error-message">Invalid name or password. Please try again.</p>
        )}

        <button className="login-btn">Enter 🚀</button>
      </form>
    </div>
  );
}

function ExpenseSplit({ expenses, moneyFormatter, totalCost, memberCount }) {
  const totalCalculated = expenses.reduce((sum, item) => sum + item.cost, 0);
  const effectiveMemberCount = memberCount > 0 ? memberCount : 1;

  const totalPerMember = totalCalculated / effectiveMemberCount;

  return (
    <section className="expense-split-section">
      <h2 className="section-title">Detailed Expense Tracker</h2>
      <div className="expense-container">
        <table className="expense-table">
          <thead>
            <tr>
              <th style={{ width: '20%' }}>Category</th>
              <th className="left-align" style={{ width: '15%' }}>Amount</th>
              <th style={{ width: '20%' }}>Date</th>
              <th style={{ width: '45%' }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense, index) => (
              <tr key={index}>
                <td className="expense-category">{expense.category}</td>
                <td className="expense-cost right-align">{moneyFormatter(expense.cost)}</td>
                <td className="expense-date">{expense.date}</td>
                <td className="expense-notes text-wrap">{expense.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="summary-title">Expense Summary</h3>
      <div className="expense-summary-grid">
        <div className="summary-card total">
          <div className="summary-label">Total Spent (Breakdown)</div>
          <div className="summary-value">{moneyFormatter(totalCalculated)}</div>
        </div>
        <div className="summary-card per-member">
          <div className="summary-label">Per Member Split ({memberCount} )</div>
          <div className="summary-value">{moneyFormatter(totalPerMember)}</div>
        </div>
      </div>

      {/* Show a warning if the calculated sum doesn't match the trip's defined total_cost */}
      {/* {totalCalculated !== totalCost && (
        <div className="expense-warning">
          ⚠️ Warning: Breakdown total ({moneyFormatter(totalCalculated)}) does not match trip's planned total ({moneyFormatter(totalCost)}).
        </div>
      )} */}
    </section>
  );
}

function Dashboard({
  user,
  payments,
  trip,
  myPayment,
  perHeadCost,
  paymentStatus,
  logout,
  expenses,
  memberCount,
}) {
  const money = (amt) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amt);

  const styles = {
    Paid: "status-paid",
    Partial: "status-partial",
    Pending: "status-pending",
  };

  const icons = {
    Paid: "✅",
    Partial: "🟡",
    Pending: "🔴",
  };

  return (
    <div className="dashboard-layout">
      <header className="main-header">
        <div className="header-title">
          🗺️ <span className="trip-name">{trip.trip_name || "Chikmagalur"}</span> Trip Tracker
        </div>

        <div className="user-profile">
          <span className="welcome-text">
            Welcome, {user.name} ({user.role})
          </span>
          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <section className="stat-summary">
        <h2 className="section-title">Trip Overview</h2>

        <div className="grid-cards-3">
          <div className="stat-card primary-card">
            <div className="stat-label">Total Planned Cost</div>
            <div className="stat-number">
              {money(parseFloat(trip.total_cost) || 0)}
            </div>
            <div className="card-icon">💰</div>
          </div>

          <div className="stat-card secondary-card">
            <div className="stat-label">Per Head Contribution</div>
            <div className="stat-number">{money(perHeadCost)}</div>
            <div className="card-icon">🧑‍🤝‍🧑</div>
          </div>

          {/* Replaced Days Left card with the detailed CountdownTimer */}
          <CountdownTimer startDate={trip.start_date} />
        </div>
      </section>

      <hr className="divider" />

      {expenses.length > 0 ? (
        <ExpenseSplit
          expenses={expenses}
          moneyFormatter={money}
          totalCost={parseFloat(trip.total_cost) || 0}
          memberCount={memberCount}
        />
      ) : (
        <div className="expense-warning">
          No expense records found. Please update the expense sheet.
        </div>
      )}

      <hr className="divider" />

      {user.role === "admin" && (
        <section className="member-list">
          <h2 className="section-title">Member Payment Tracker</h2>

          <div className="members-grid">
            {payments
              .sort((a, b) => (a.name === user.name ? -1 : 1))
              .map((p) => {
                const st =
                  p.paid >= perHeadCost
                    ? "Paid"
                    : p.paid > 0
                      ? "Partial"
                      : "Pending";

                return (
                  <div
                    className={`member-card ${p.name === user.name ? "current-user-highlight" : ""}`}
                    key={p.name}
                  >
                    <div className="member-name">
                      {p.name}
                      {p.name === user.name && <span className="you-tag">You</span>}
                    </div>

                    <div className={`member-payment-status ${styles[st]}`}>
                      <span className="status-dot" />
                      <span className="paid-amount-value">{money(p.paid)}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

    </div>
  );
}

export default App;