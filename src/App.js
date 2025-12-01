import React, { useState, useEffect } from "react";
import "./styles.css";

// Environment Config
const SHEET_ID = process.env.REACT_APP_SHEET_ID;
const USERS_SHEET = process.env.REACT_APP_USERS_SHEET;
const PAYMENTS_SHEET = process.env.REACT_APP_PAYMENTS_SHEET;
const TRIP_SHEET = process.env.REACT_APP_TRIP_SHEET;

// Fetch helper
const fetchSheet = async (sheet) => {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheet}`;
    const res = await fetch(url);
    const raw = await res.text();

    // Google gives junk before JSON, so trim it out
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("tripUser");
    if (saved) {
      setLoggedInUser(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [uSheet, pSheet, tSheet] = await Promise.all([
          fetchSheet(USERS_SHEET),
          fetchSheet(PAYMENTS_SHEET),
          fetchSheet(TRIP_SHEET),
        ]);

        if (!uSheet || !pSheet || !tSheet) {
          console.error("One or more sheets failed to load");
          setLoading(false);
          return;
        }

        // Users
        const userList = uSheet.rows.slice(1).map((r) => ({
          name: r.c[0]?.v,
          password: r.c[1]?.v,
          role: r.c[2]?.v,
        }));
        setUsers(userList);

        // Payments
        const paymentList = pSheet.rows.map((r) => ({
          name: r.c[0]?.v,
          paid: parseFloat(r.c[1]?.v) || 0,
        }));
        setPayments(paymentList);

        // Trip info (key → value)
        const tInfo = {};
        tSheet.rows.forEach((row) => {
          const key = row.c[0]?.v;
          const val = row.c[1]?.f || row.c[1]?.v;
          tInfo[key] = isNaN(val) ? val : parseFloat(val);
        });
        setTripInfo(tInfo);
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
    } else {
      alert("Invalid login credentials.");
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

  return (
    <div className="page-container">
      {loading && (
        <div className="center-screen">
          <div className="loading-spinner" />
          <p>Fetching data…</p>
        </div>
      )}

      {!loading && !loggedInUser && (
        <LoginScreen login={login} users={users} />
      )}

      {!loading && loggedInUser && (
        <Dashboard
          user={loggedInUser}
          payments={payments}
          trip={tripInfo}
          myPayment={myPaid}
          perHeadCost={perHead}
          paymentStatus={status}
          daysLeft={tripInfo.days}
          logout={logout}
        />
      )}
    </div>
  );
}

// Login screen
function LoginScreen({ login, users }) {
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");

  const submit = (e) => {
    e.preventDefault();
    login(name, pass);
  };

  return (
    <div className="login-wrapper">
      <form className="login-card" onSubmit={submit}>
        <div className="logo-placeholder">🏔️</div>
        <h2>Trip Dashboard</h2>

        <input
          className="auth-input"
          placeholder="Select Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          list="usernames"
          required
        />

        <datalist id="usernames">
          {users.map((u) => (
            <option key={u.name} value={u.name} />
          ))}
        </datalist>

        <input
          type="password"
          className="auth-input"
          placeholder="Password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          required
        />

        <button className="login-btn">Enter 🚀</button>
      </form>
    </div>
  );
}

// Dashboard
function Dashboard({
  user,
  payments,
  trip,
  myPayment,
  perHeadCost,
  paymentStatus,
  daysLeft,
  logout,
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
    Pending: "❌",
  };

  return (
    <div className="dashboard-layout">
      <header className="main-header">
        <div className="header-title">
          🗺️ {trip.trip_name || "Chikmagalur"} Trip Tracker
        </div>

        <div className="user-profile">
          <span>
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
            <div className="stat-label">Total Cost</div>
            <div className="stat-number">
              {money(parseFloat(trip.total_cost) || 0)}
            </div>
            <div className="card-icon">💰</div>
          </div>

          <div className="stat-card secondary-card">
            <div className="stat-label">Per Head</div>
            <div className="stat-number">{money(perHeadCost)}</div>
            <div className="card-icon">🧑‍🤝‍🧑</div>
          </div>

          <div className="stat-card tertiary-card">
            <div className="stat-label">Starts In</div>
            <div className="stat-number days-left">{daysLeft}</div>
            <div className="small-label-text">Days</div>
            <div className="card-icon">⏳</div>
          </div>
        </div>
      </section>

      <section className="payment-summary">
        <h2 className="section-title">Your Contribution</h2>

        <div className={`my-payment-card ${styles[paymentStatus]}`}>
          <div className="payment-amount">{money(myPayment)}</div>

          <div className="payment-status">
            {icons[paymentStatus]} {paymentStatus}
            {paymentStatus !== "Paid" && (
              <span className="due-info">
                {" "}
                (Due: {money(Math.max(0, perHeadCost - myPayment))})
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="member-list">
        <h2 className="section-title">All Members</h2>

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
                  className={`member-card ${p.name === user.name ? "current-user-highlight" : ""
                    }`}
                  key={p.name}
                >
                  <div className="member-name">
                    {p.name}{" "}
                    {p.name === user.name && (
                      <span className="you-tag">(You)</span>
                    )}
                  </div>

                  <div className={`member-payment-status ${styles[st]}`}>
                    <span className="status-dot" />
                    {money(p.paid)}
                  </div>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}

export default App;
