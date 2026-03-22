import React, { useEffect, useMemo, useState } from "react";

const SHEET_ID = process.env.REACT_APP_SHEET_ID;
const USERS_SHEET = process.env.REACT_APP_USERS_SHEET;
const PAYMENTS_SHEET = process.env.REACT_APP_PAYMENTS_SHEET;
const TRIP_SHEET = process.env.REACT_APP_TRIP_SHEET;
const EXPENSES_SHEET = process.env.REACT_APP_EXPENSES_SHEET;
const TRIP_BRAND = "IV YEAR CSE";
const TRIP_START_AT = "2026-04-09 12:30";
const TRIP_END_AT = "2026-04-13 15:00";
const EXPECTED_MIN_MEMBERS = 40;
const EXPECTED_MAX_MEMBERS = 45;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatTime = (value) => String(Math.max(0, value)).padStart(2, '0');

function CountdownTimer({ startDate }) {
  const [timeLeft, setTimeLeft] = useState({});
  const tripStart = new Date(TRIP_START_AT).getTime();
  const tripEnd = new Date(TRIP_END_AT).getTime();
  const isClose = timeLeft.days <= 5 && !timeLeft.isPast;

  useEffect(() => {
    if (!startDate || isNaN(tripStart)) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const distance = tripStart - now;

      if (distance < 0) {
        if (now < tripEnd) {
          setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false, isLive: true });
          return;
        }
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true });
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, isPast: false, isLive: false });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [startDate, tripStart, tripEnd]);

  if (Object.keys(timeLeft).length === 0) {
    return <div className="countdown-card loading">Calculating countdown...</div>;
  }

  if (timeLeft.isPast) {
    return (
      <div className="countdown-card past" style={{ position: "relative" }}>
        <div className="countdown-status">The Trip🎉</div>
        <div className="countdown-message">
          What a wonderful trip it was. These memories will always stay alive.
          Thank you, everyone ❤️
        </div>

        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "url('https://media.tenor.com/fu7DE5jHcqsAAAAj/confetti-celebrate.gif') center/cover no-repeat",
            opacity: 0.3,
            borderRadius: "12px",
          }}
        />
      </div>
    );
  }

  if (timeLeft.isLive) {
    return (
      <div className="countdown-card">
        <div className="countdown-status">Trip In Progress</div>
        <div className="countdown-message">IV YEAR CSE Kerala trip is live now. Enjoy every moment.</div>
      </div>
    );
  }

  return (
    <div className={`countdown-card ${isClose ? "countdown-urgent" : ""}`}>
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
      await sleep(delay);
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
  const [showWelcome, setShowWelcome] = useState(false);


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
          tInfo.start_date = '2026-04-09';
        }
        if (!tInfo.trip_name) {
          tInfo.trip_name = TRIP_BRAND;
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
      setShowWelcome(true);

      setTimeout(() => {
        setShowWelcome(false);
      }, 1200);
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
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    :root {
      --bg: #f5f9ff;
      --surface: #ffffff;
      --surface-soft: #eef4ff;
      --primary: #2563eb;
      --primary-dark: #1d4ed8;
      --primary-soft: #dbeafe;
      --text: #0f172a;
      --muted: #475569;
      --border: #cbd5e1;
      --danger: #dc2626;
      --warning: #d97706;
      --success: #059669;
      --shadow: 0 10px 30px rgba(37, 99, 235, 0.08);
    }

    .page-container {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: radial-gradient(circle at top right, #e0ecff 0%, #f7faff 50%, #eef4ff 100%);
      min-height: 100vh;
      color: var(--text);
    }

    .dashboard-layout {
      max-width: 1240px;
      margin: 0 auto;
      padding: 20px;
    }

    .center-screen {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      text-align: center;
    }

    .section-title {
      font-size: 1.55rem;
      font-weight: 800;
      color: var(--text);
      margin-bottom: 18px;
      border-left: 6px solid var(--primary);
      padding-left: 10px;
      line-height: 1.2;
    }

    .divider {
      border: 0;
      height: 1px;
      background-color: var(--border);
      margin: 34px 0;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    @keyframes fadeOut {
      0% { opacity: 1; }
      100% { opacity: 0; visibility: hidden; }
    }

    @keyframes pulseGlow {
      0% { box-shadow: 0 0 0 rgba(220, 38, 38, 0.2); }
      100% { box-shadow: 0 0 18px rgba(220, 38, 38, 0.5); }
    }

    .main-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      margin-bottom: 26px;
      border-bottom: 3px solid var(--primary);
      gap: 14px;
      flex-wrap: wrap;
    }

    .header-title {
      font-size: 1.75rem;
      font-weight: 800;
      color: var(--text);
      letter-spacing: 0.01em;
    }

    .trip-name {
      color: var(--primary);
    }

    .user-profile {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .welcome-text {
      font-weight: 600;
      color: var(--muted);
      font-size: 0.95rem;
    }

    .logout-btn {
      background-color: #0f172a;
      color: white;
      border: none;
      padding: 9px 14px;
      border-radius: 9px;
      cursor: pointer;
      font-weight: 600;
      transition: background-color 0.2s ease;
      box-shadow: 0 4px 8px rgba(15, 23, 42, 0.2);
    }

    .logout-btn:hover {
      background-color: #1e293b;
    }

    .grid-cards-3 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 18px;
    }

    .stat-card, .countdown-card {
      background: var(--surface);
      border-radius: 14px;
      padding: 22px;
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 130px;
      border: 1px solid #e2e8f0;
      transition: transform 0.2s ease;
    }

    .stat-card:hover {
      transform: translateY(-3px);
    }

    .stat-card.primary-card {
      border-bottom: 5px solid var(--primary);
    }

    .stat-card.secondary-card {
      border-bottom: 5px solid #0ea5e9;
    }

    .stat-label {
      font-size: 0.95rem;
      color: #334155;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .stat-number {
      font-size: 2.3rem;
      font-weight: 800;
      color: #0f172a;
    }

    .stat-card {
      position: relative;
      overflow: hidden;
    }

    .card-icon {
      position: absolute;
      top: 16px;
      right: 16px;
      font-size: 2.5rem;
      opacity: 0.1;
    }

    .countdown-card {
      border-bottom: 5px solid var(--primary);
      background-color: #eff6ff;
    }

    .countdown-card.past {
      background-color: #fee2e2;
      border-bottom: 5px solid var(--danger);
      color: var(--danger);
      text-align: center;
    }

    .countdown-urgent {
      animation: pulseGlow 1.5s infinite alternate ease-in-out;
      border-bottom: 5px solid var(--danger) !important;
    }

    .countdown-status {
      font-size: 1.5rem;
      font-weight: 800;
      margin-bottom: 8px;
    }

    .countdown-message {
      font-size: 0.95rem;
      font-weight: 500;
    }

    .countdown-label {
      font-size: 0.95rem;
      color: var(--primary-dark);
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
      border-radius: 10px;
      background-color: #dbeafe;
      border: 1px solid #bfdbfe;
    }

    .time-value {
      display: block;
      font-size: 1.7rem;
      font-weight: 800;
      color: #1e3a8a;
      line-height: 1;
    }

    .unit-label {
      display: block;
      font-size: 0.72rem;
      color: #1e3a8a;
      font-weight: 700;
      text-transform: uppercase;
      margin-top: 3px;
    }

    .my-payment-card {
      background-color: var(--surface);
      border-radius: 14px;
      padding: 28px;
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      border-top: 5px solid;
      border-left: 1px solid #e2e8f0;
      border-right: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
    }

    .my-payment-card.status-paid {
      border-color: var(--success);
      background-color: #ecfdf5;
    }

    .my-payment-card.status-partial {
      border-color: var(--warning);
      background-color: #fffbeb;
    }

    .my-payment-card.status-pending {
      border-color: var(--danger);
      background-color: #fef2f2;
    }

    .payment-amount {
      font-size: 2.7rem;
      font-weight: 800;
      color: #0f172a;
      line-height: 1;
    }

    .payment-amount-label {
      font-size: 0.95rem;
      color: var(--muted);
      font-weight: 600;
      margin: 10px 0 15px;
    }

    .payment-status {
      font-size: 1.1rem;
      font-weight: 700;
      color: #0f172a;
    }

    .due-info {
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--danger);
      margin-left: 10px;
    }

    .member-list {
      background: var(--surface);
      border: 1px solid #dbe4f0;
      border-radius: 14px;
      padding: 18px;
      box-shadow: var(--shadow);
    }

    .member-tools {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    .roster-hint {
      color: #334155;
      font-size: 0.9rem;
      font-weight: 600;
      background: var(--primary-soft);
      border: 1px solid #bfdbfe;
      padding: 8px 10px;
      border-radius: 8px;
    }

    .member-search {
      width: 280px;
      max-width: 100%;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 0.92rem;
      background: white;
    }

    .member-search:focus {
      outline: 2px solid #bfdbfe;
      border-color: #93c5fd;
    }

    .members-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 12px;
      margin-top: 10px;
      max-height: 520px;
      overflow-y: auto;
      padding-right: 4px;
    }

    .member-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 13px;
      background-color: white;
      border-radius: 10px;
      border: 1px solid #dbe4f0;
    }

    .member-card.current-user-highlight {
      border: 2px solid var(--primary);
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.12);
    }

    .member-name {
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: 52%;
      word-break: break-word;
    }

    .you-tag {
      background-color: var(--primary);
      color: white;
      font-size: 0.68rem;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 700;
    }

    .member-payment-status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      white-space: nowrap;
    }

    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .member-payment-status.status-paid .status-dot { background-color: var(--success); }
    .member-payment-status.status-partial .status-dot { background-color: var(--warning); }
    .member-payment-status.status-pending .status-dot { background-color: var(--danger); }

    .paid-amount-value {
      color: #334155;
      font-size: 0.95rem;
      font-weight: 700;
    }

    .load-more-btn {
      margin-top: 12px;
      border: 1px solid #93c5fd;
      background: var(--surface-soft);
      color: var(--primary-dark);
      padding: 8px 12px;
      border-radius: 8px;
      font-weight: 700;
      cursor: pointer;
    }

    .login-wrapper {
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      background: radial-gradient(circle at 50% 0%, #dbeafe 0%, #eff6ff 50%, #e8f0ff 100%);
      padding: 20px;
    }

    .login-card {
      background: white;
      padding: 34px;
      border-radius: 16px;
      box-shadow: 0 16px 40px rgba(37, 99, 235, 0.16);
      text-align: center;
      width: 100%;
      max-width: 400px;
      border: 1px solid #dbeafe;
    }

    .logo-placeholder {
      font-size: 2.6rem;
      margin-bottom: 10px;
    }

    .login-card h2 {
      font-size: 1.65rem;
      color: #1e3a8a;
      margin-bottom: 25px;
      font-weight: 800;
    }

    .auth-input {
      width: 100%;
      padding: 12px;
      margin-bottom: 14px;
      border: 1px solid #bfdbfe;
      border-radius: 9px;
      font-size: 1rem;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }

    .auth-input:focus {
      border-color: #60a5fa;
      outline: none;
      box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.24);
    }

    .select-input {
      appearance: none;
      background-image: url("data:image/svg+xml;utf8,<svg fill='%231e40af' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>");
      background-repeat: no-repeat;
      background-position: right 12px center;
      background-size: 18px;
      cursor: pointer;
      background-color: white;
    }

    .login-btn {
      width: 100%;
      background-color: var(--primary);
      color: white;
      border: none;
      padding: 12px;
      border-radius: 9px;
      font-size: 1.02rem;
      font-weight: 700;
      cursor: pointer;
      transition: background-color 0.2s ease, transform 0.1s ease;
      box-shadow: 0 6px 15px rgba(37, 99, 235, 0.28);
    }

    .login-btn:hover {
      background-color: var(--primary-dark);
      transform: translateY(-1px);
    }

    .login-error-message {
      color: var(--danger);
      font-size: 0.9rem;
      margin-top: -4px;
      margin-bottom: 12px;
      font-weight: 600;
    }

    .expense-split-section {
      margin-top: 40px;
      padding: 20px;
      background-color: var(--surface);
      border-radius: 14px;
      box-shadow: var(--shadow);
      border: 1px solid #dbe4f0;
    }

    .expense-container {
      overflow-x: auto;
      border: 1px solid #dbe4f0;
      border-radius: 10px;
    }

    .expense-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 680px;
    }

    .expense-table th {
      background-color: #eff6ff;
      color: #1e3a8a;
      font-weight: 800;
      text-align: left;
      padding: 12px 14px;
      border-bottom: 2px solid #dbe4f0;
      text-transform: uppercase;
      font-size: 0.78rem;
      white-space: nowrap;
    }

    .expense-table td {
      padding: 12px 14px;
      border-bottom: 1px solid #eef2f7;
      color: #334155;
      font-size: 0.93rem;
      vertical-align: top;
    }

    .expense-table tbody tr:last-child td {
      border-bottom: none;
    }

    .expense-table tbody tr:hover {
      background-color: #f8fbff;
    }

    .right-align {
      text-align: right;
      font-weight: 700;
    }

    .text-wrap {
      white-space: normal;
      word-break: break-word;
    }

    .expense-category {
      font-weight: 700;
      color: #0f172a;
    }

    .expense-date {
      color: #64748b;
      white-space: nowrap;
    }

    .expense-summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 14px;
      margin-top: 18px;
    }

    .summary-card {
      min-width: 0;
      padding: 18px;
      border-radius: 12px;
      border: 1px solid #bfdbfe;
      background-color: var(--surface-soft);
    }

    .summary-value.positive {
      color: var(--success);
      font-weight: 800;
    }

    .summary-value.negative {
      color: var(--danger);
      font-weight: 800;
    }

    .summary-label {
      font-size: 0.88rem;
      font-weight: 700;
      color: #334155;
      margin-bottom: 6px;
    }

    .summary-value {
      font-size: 1.8rem;
      font-weight: 800;
      color: #0f172a;
    }

    .expense-warning {
      background-color: #fff7ed;
      color: #9a3412;
      padding: 14px;
      border-radius: 10px;
      margin-top: 18px;
      font-weight: 700;
      border-left: 5px solid #f97316;
    }

    .progress-wrapper {
      margin-top: 10px;
      background: var(--surface);
      padding: 20px;
      border-radius: 12px;
      box-shadow: var(--shadow);
      border: 1px solid #dbe4f0;
    }

    .progress-labels {
      display: flex;
      justify-content: space-between;
      color: #334155;
      font-weight: 700;
      margin-bottom: 10px;
      gap: 10px;
      flex-wrap: wrap;
    }

    .progress-bar {
      width: 100%;
      height: 12px;
      background-color: #dbe4f0;
      border-radius: 10px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #2563eb 0%, #0ea5e9 100%);
      transition: width 0.6s ease-in-out;
      border-radius: 10px;
    }

    .scroll-top-btn {
      position: fixed;
      bottom: 22px;
      right: 22px;
      background: var(--primary);
      color: white;
      border: none;
      width: 45px;
      height: 45px;
      border-radius: 50%;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
      cursor: pointer;
      transition: transform 0.2s ease, background-color 0.2s ease;
      z-index: 999;
    }

    .scroll-top-btn:hover {
      transform: scale(1.08);
      background: var(--primary-dark);
    }

    @media (max-width: 900px) {
      .dashboard-layout {
        padding: 12px;
      }

      .main-header {
        text-align: center;
        justify-content: center;
      }

      .header-title {
        font-size: 1.45rem;
      }

      .grid-cards-3 {
        grid-template-columns: 1fr;
      }

      .countdown-grid {
        flex-wrap: wrap;
      }

      .time-unit {
        flex-basis: calc(50% - 6px);
      }

      .members-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 600px) {
      .stat-number {
        font-size: 1.95rem;
      }

      .payment-amount {
        font-size: 2.1rem;
      }

      .member-tools {
        flex-direction: column;
        align-items: stretch;
      }

      .member-search {
        width: 100%;
      }
    }
  `;

  return (
    <React.Fragment>
      <style dangerouslySetInnerHTML={{ __html: appStyles }} />

      {showWelcome && loggedInUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "white",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "column",
            zIndex: 9999,
            animation: "fadeOut 4s ease forwards",
          }}
        >
          <img
            src="https://media.tenor.com/09xG7FpC18sAAAAj/compass-wander.gif"
            alt="welcome-gif"
            style={{ width: "120px", marginBottom: "20px" }}
          />

          <h1 style={{ fontWeight: "800", color: "#1e3a8a" }}>
            Welcome back, {loggedInUser.name}
          </h1>
        </div>
      )}

      <div className="page-container">
        {loading && (
          <div className="center-screen">
            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                border: "5px solid #bfdbfe",
                borderTop: "5px solid #2563eb",
                animation: "spin 1s linear infinite",
                marginBottom: "20px",
              }}
            />
            <h2 style={{ fontWeight: 700, color: "#1e3a8a" }}>Loading your trip...</h2>
            <p style={{ color: "#334155", fontSize: "0.9rem", marginTop: "6px" }}>
              Please wait a moment
            </p>
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
        <h2>IV YEAR CSE</h2>

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

        <button className="login-btn">Enter</button>
      </form>
    </div>
  );
}


function ExpenseSplit({ expenses, moneyFormatter, user, moneyInHand, memberCount }) {
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

      <div className="expense-summary-grid">
        {/* Total Spent */}
        <div className="summary-card total">
          <div className="summary-label">Total Spent (Breakdown)</div>
          <div className="summary-value">
            {moneyFormatter(totalCalculated)}
          </div>
        </div>

        {user.role === "admin" && (


          <div className="summary-card in-hand">
            <div className="summary-label">Money In Hand</div>
            <div
              className={`summary-value ${moneyInHand >= 10000 ? "positive" : "negative"
                }`}
            >
              {moneyFormatter(moneyInHand)}
            </div>
          </div>

        )}

        {/* Per Member */}
        <div className="summary-card per-member">
          <div className="summary-label">
            Per Member Split ({memberCount})
          </div>
          <div className="summary-value">
            {moneyFormatter(totalPerMember)}
          </div>
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

  const [myProgress, setMyProgress] = React.useState(0);
  const [memberQuery, setMemberQuery] = useState("");
  const [visibleMembers, setVisibleMembers] = useState(24);

  useEffect(() => {
    if (!perHeadCost || perHeadCost <= 0) {
      setMyProgress(0);
      return;
    }

    const percent = Math.min((myPayment / perHeadCost) * 100, 100);

    setTimeout(() => {
      setMyProgress(percent);
    }, 200);
  }, [myPayment, perHeadCost]);

  const [weather, setWeather] = useState(null);

  useEffect(() => {
    const latitude = 10.0889;
    const longitude = 77.0595;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,is_day,precipitation,rain,weather_code&daily=sunrise,sunset,uv_index_max&timezone=auto`;

    fetch(url)
      .then(res => res.json())
      .then(data => setWeather(data))
      .catch(err => console.error("Weather fetch error:", err));
  }, []);


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

  const totalCollected = payments.reduce((sum, p) => sum + p.paid, 0);
  const totalSpent = expenses.reduce((sum, e) => sum + e.cost, 0);
  const moneyInHand = totalCollected - totalSpent;
  const targetMembers = Math.max(memberCount, EXPECTED_MIN_MEMBERS);
  const safeTargetAmount = perHeadCost > 0 ? perHeadCost * targetMembers : 0;
  const groupProgress =
    safeTargetAmount > 0 ? Math.min((totalCollected / safeTargetAmount) * 100, 100) : 0;

  const filteredPayments = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();

    return [...payments]
      .sort((a, b) => {
        if (a.name === user.name) return -1;
        if (b.name === user.name) return 1;
        return (a.name || "").localeCompare(b.name || "");
      })
      .filter((p) => (!q ? true : (p.name || "").toLowerCase().includes(q)));
  }, [payments, memberQuery, user.name]);

  const visiblePaymentRows = filteredPayments.slice(0, visibleMembers);

  useEffect(() => {
    setVisibleMembers(24);
  }, [memberQuery]);



  return (
    <div className="dashboard-layout">
      <header className="main-header">
        <div className="header-title">
          🗺️ <span className="trip-name">{TRIP_BRAND}</span> Kerala Trip Tracker
        </div>

        <div className="user-profile">
          <span className="welcome-text">
            Welcome, {user.name}
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
          memberCount={memberCount}
          moneyInHand={moneyInHand}
          user={user}
        />

      ) : (
        <div className="expense-warning">
          No expense records found. Please update the expense sheet.
        </div>
      )}

      <hr className="divider" />

      <section>
        <h2 className="section-title">Your Contribution</h2>

        <div
          className={`my-payment-card status-${paymentStatus.toLowerCase()}`}
          style={{ marginBottom: "30px" }}
        >
          <div className="payment-amount">{money(myPayment)}</div>
          <div className="payment-amount-label">You Have Paid</div>

          <div className="payment-status">
            Status: {paymentStatus}
            {paymentStatus !== "Paid" && (
              <span className="due-info">
                | Due: {money(perHeadCost - myPayment)}
              </span>
            )}
          </div>


          <div
            style={{
              width: "100%",
              marginTop: "20px",
              background: "#e5e7eb",
              height: "12px",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${myProgress}%`,
                background:
                  paymentStatus === "Paid"
                    ? "#10b981"
                    : paymentStatus === "Partial"
                      ? "#f59e0b"
                      : "#ef4444",
                borderRadius: "8px",
                transition: "width 1.2s cubic-bezier(0.22, 0.61, 0.36, 1)",
              }}
            />
          </div>

        </div>
      </section>

      <hr className="divider" />

      {/* TOTAL COLLECTION PROGRESS */}
      <section style={{ marginTop: "30px" }}>
        <h2 className="section-title">Group Payment Progress</h2>

        <div className="progress-wrapper">
          <div className="progress-labels">
            <span>Collected: {money(totalCollected)}</span>
            <span>Total Target ({targetMembers} members): {money(safeTargetAmount)}</span>
          </div>

          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${groupProgress}%`,
              }}
            />
          </div>
        </div>
      </section>

      {weather && (
        <section style={{ marginBottom: "30px" }}>
          <h2 className="section-title">Current Weather in Kerala</h2>

          <div className="stat-card primary-card" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ fontSize: "2rem", fontWeight: "800" }}>
              {weather.current.temperature_2m}°C
            </div>
            <div style={{ color: "#6b7280", fontWeight: "600" }}>
              Rain: {weather.current.rain || 0} mm
              <br />
              UV Index: {weather.daily.uv_index_max[0]}
            </div>
            <div style={{ fontSize: "0.9rem", marginTop: "5px", opacity: 0.8 }}>
              Sunrise: {weather.daily.sunrise[0].split("T")[1]}
              <br />
              Sunset: {weather.daily.sunset[0].split("T")[1]}
            </div>
            <div className="card-icon">🌤️</div>
          </div>
        </section>
      )}



      {user.role === "admin" && (
        <section className="member-list">
          <h2 className="section-title">Member Payment Tracker</h2>

          <div className="member-tools">
            <div className="roster-hint">
              Optimized roster view for {EXPECTED_MIN_MEMBERS}-{EXPECTED_MAX_MEMBERS} members | Total loaded: {memberCount}
            </div>
            <input
              className="member-search"
              placeholder="Search members by name"
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
            />
          </div>

          <div className="members-grid">
            {visiblePaymentRows.map((p) => {
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

          {visibleMembers < filteredPayments.length && (
            <button
              className="load-more-btn"
              onClick={() => setVisibleMembers((prev) => prev + 24)}
            >
              Load More Members
            </button>
          )}
        </section>
      )}

      <button
        className="scroll-top-btn"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="white"
          viewBox="0 0 24 24"
          width="26"
          height="26"
        >
          <path d="M12 4l-8 8h5v8h6v-8h5z" />
        </svg>
      </button>



    </div>
  );
}

export default App;