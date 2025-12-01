import React, { useState, useEffect } from "react";
import "./styles.css";

// --- Configuration (Keep these as they are) ---
const SHEET_ID = process.env.REACT_APP_SHEET_ID;
const USERS_SHEET = process.env.REACT_APP_USERS_SHEET;
const PAYMENTS_SHEET = process.env.REACT_APP_PAYMENTS_SHEET;
const TRIP_SHEET = process.env.REACT_APP_TRIP_SHEET;

// --- Helper Functions (No change needed for look) ---
const fetchSheet = async (sheet) => {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheet}`;
    const res = await fetch(url);
    const text = await res.text();
    // Adjusted substring logic for robustness if possible, but keeping original for dependency
    const json = JSON.parse(text.substring(47, text.length - 2)); 
    return json.table;
  } catch (e) {
    console.error("Error fetching sheet:", sheet, e);
    return null;
  }
};

// --- App Component (Main Logic) ---
function App() {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [tripInfo, setTripInfo] = useState({});
  const [loading, setLoading] = useState(true);

  // Load sheets (Same logic, slightly cleaner state updates)
  useEffect(() => {
    const load = async () => {
      try {
        const [usersData, payData, tripData] = await Promise.all([
          fetchSheet(USERS_SHEET),
          fetchSheet(PAYMENTS_SHEET),
          fetchSheet(TRIP_SHEET),
        ]);

        if (!usersData || !payData || !tripData) {
          console.error("Failed to load one or more sheets.");
          setLoading(false);
          return;
        }

        // Users sheet
        const u = usersData.rows.slice(1).map((r) => ({
          name: r.c[0]?.v,
          password: r.c[1]?.v,
          role: r.c[2]?.v,
        }));
        setUsers(u);

        // Payments sheet
        const p = payData.rows.map((r) => ({
          name: r.c[0]?.v,
          paid: parseFloat(r.c[1]?.v) ?? 0, // Ensure paid is a number
        }));
        setPayments(p);

        // TripInfo sheet
        const tripObj = {};
        tripData.rows.forEach((row) => {
          const key = row.c[0]?.v;
          const value = row.c[1]?.f || row.c[1]?.v;
          tripObj[key] = isNaN(value) ? value : parseFloat(value);
        });
        setTripInfo(tripObj);
      } catch (error) {
        console.error("An error occurred during data loading:", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // Login handler
  const login = (name, pass) => {
    const user = users.find((u) => u.name === name && u.password === pass);
    if (user) {
      setLoggedInUser(user);
    } else {
      alert("Invalid login credentials.");
    }
  };
  
  const logout = () => {
      setLoggedInUser(null);
  }

  // Derived state
  const daysLeft = tripInfo.days ?? 'N/A';
  const perHeadCost = parseFloat(tripInfo.per_head) || 0;
  const myPayment = loggedInUser
    ? payments.find((p) => p.name === loggedInUser.name)?.paid ?? 0
    : 0;
  const paymentStatus = myPayment >= perHeadCost 
    ? 'Paid' 
    : myPayment > 0 
    ? 'Partial' 
    : 'Pending';

  return (
    <div className="page-container">
      {/* Loading */}
      {loading && (
        <div className="center-screen">
          <div className="loading-spinner"></div>
          <p className="loading-text">Fetching amazing trip data...</p>
        </div>
      )}

      {/* Login Screen */}
      {!loading && !loggedInUser && <LoginScreen login={login} users={users} />}
      
      {/* Dashboard */}
      {!loading && loggedInUser && (
        <Dashboard
          user={loggedInUser}
          payments={payments}
          trip={tripInfo}
          myPayment={myPayment}
          perHeadCost={perHeadCost}
          paymentStatus={paymentStatus}
          daysLeft={daysLeft}
          logout={logout}
        />
      )}
    </div>
  );
}

// --- Login Screen Component ---
function LoginScreen({ login, users }) {
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  
  const handleLogin = (e) => {
      e.preventDefault(); // Prevent default form submission
      login(name, pass);
  }

  return (
    <div className="login-wrapper">
      <form className="login-card" onSubmit={handleLogin}>
        <div className="logo-placeholder">🏔️</div>
        <h2>Trip Dashboard Access</h2>

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
          placeholder="Secret Password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          required
        />

        <button
          type="submit"
          className="login-btn"
        >
          🚀 Enter Dashboard
        </button>
      </form>
    </div>
  );
}

// --- Dashboard Component ---
function Dashboard({ user, payments, trip, myPayment, perHeadCost, paymentStatus, daysLeft, logout }) {
    
    // Format currency for better look
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
    }
    
    // Status colors mapping
    const statusClass = {
        'Paid': 'status-paid',
        'Partial': 'status-partial',
        'Pending': 'status-pending'
    };
    
    // Status Icon mapping (Using simple emojis for visual flair)
    const statusIcon = {
        'Paid': '✅',
        'Partial': '🟡',
        'Pending': '❌'
    };

    return (
      <div className="dashboard-layout">
        <header className="main-header">
          <div className="header-title">
            <span className="icon">🗺️</span> {trip.trip_name || "Chikmagalur"} Trip Tracker
          </div>
          <div className="user-profile">
            <span>Welcome, **{user.name}** ({user.role})</span>
            <button className="logout-btn" onClick={logout}>🚪 Logout</button>
          </div>
        </header>

        <section className="stat-summary">
          <h2 className="section-title">Trip Overview</h2>
          <div className="grid-cards-3">
            {/* Total Cost Card */}
            <div className="stat-card primary-card">
              <div className="stat-label">Total Trip Cost</div>
              <div className="stat-number">{formatCurrency(parseFloat(trip.total_cost) || 0)}</div>
              <div className="card-icon">💰</div>
            </div>

            {/* Per Head Card */}
            <div className="stat-card secondary-card">
              <div className="stat-label">Your Share (Per Head)</div>
              <div className="stat-number">{formatCurrency(perHeadCost)}</div>
              <div className="card-icon">🧑‍🤝‍🧑</div>
            </div>

            {/* Days Left Card */}
            <div className="stat-card tertiary-card">
              <div className="stat-label">Trip Starts In</div>
              <div className="stat-number days-left">{daysLeft}</div>
              <div className="small-label-text">Days</div>
              <div className="card-icon">⏳</div>
            </div>
          </div>
        </section>

        <section className="payment-summary">
          <h2 className="section-title">Your Contribution</h2>
          <div className={`my-payment-card ${statusClass[paymentStatus]}`}>
            <div className="payment-amount">{formatCurrency(myPayment)}</div>
            <div className="payment-status">
                {statusIcon[paymentStatus]} **{paymentStatus}**
                {paymentStatus !== 'Paid' && (
                    <span className="due-info"> (Due: {formatCurrency(Math.max(0, perHeadCost - myPayment))})</span>
                )}
            </div>
          </div>
        </section>

        <section className="member-list">
          <h2 className="section-title">All Members' Status</h2>
          <div className="members-grid">
            {payments
              .sort((a, b) => (a.name === user.name ? -1 : 1)) // Current user first
              .map((p) => {
                const memberStatus = p.paid >= perHeadCost ? 'Paid' : p.paid > 0 ? 'Partial' : 'Pending';
                return (
                  <div 
                    className={`member-card ${p.name === user.name ? 'current-user-highlight' : ''}`} 
                    key={p.name}
                  >
                    <div className="member-name">
                        {p.name} {p.name === user.name && <span className="you-tag">(You)</span>}
                    </div>
                    <div className={`member-payment-status ${statusClass[memberStatus]}`}>
                        <span className="status-dot"></span>
                        {formatCurrency(p.paid)}
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