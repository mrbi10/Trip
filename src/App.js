import React, { useState, useEffect } from "react";
import "./styles.css";

const SHEET_ID = process.env.REACT_APP_SHEET_ID;
const USERS_SHEET = process.env.REACT_APP_USERS_SHEET;
const PAYMENTS_SHEET = process.env.REACT_APP_PAYMENTS_SHEET;
const TRIP_SHEET = process.env.REACT_APP_TRIP_SHEET;

const fetchSheet = async (sheet) => {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheet}`;
    const res = await fetch(url);
    const text = await res.text();
    const json = JSON.parse(text.substring(47, text.length - 2));
    return json.table;
  } catch (e) {
    console.error("Error fetching sheet:", sheet, e);
    return null;
  }
};

function App() {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [tripInfo, setTripInfo] = useState({});
  const [loading, setLoading] = useState(true);

  // Load sheets
  useEffect(() => {
    const load = async () => {
      const usersData = await fetchSheet(USERS_SHEET);
      const payData = await fetchSheet(PAYMENTS_SHEET);
      const tripData = await fetchSheet(TRIP_SHEET);

      if (!usersData || !payData || !tripData) {
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
        paid: r.c[1]?.v ?? 0,
      }));
      setPayments(p);

      // TripInfo sheet
      const tripObj = {};
      tripData.rows.forEach((row) => {
        const key = row.c[0]?.v;
        const value = row.c[1]?.f || row.c[1]?.v;
        tripObj[key] = value;
      });
      setTripInfo(tripObj);

      setLoading(false);
    };

    load();
  }, []);

  // Login handler
  const login = (name, pass) => {
    const user = users.find((u) => u.name === name && u.password === pass);
    if (user) setLoggedInUser(user);
    else alert("Invalid login");
  };

  // Countdown
  const daysLeft = tripInfo.days ?? 0;

  // User payment
  const myPayment = loggedInUser
    ? payments.find((p) => p.name === loggedInUser.name)?.paid ?? 0
    : 0;

  return (
    <div className="page-container">

      {/* Loading */}
      {loading && (
        <div className="login-wrapper">
          <div className="login-card">Loading trip data...</div>
        </div>
      )}

      {!loading && !loggedInUser && <LoginScreen login={login} users={users} />}
      {!loading && loggedInUser && (
        <Dashboard
          user={loggedInUser}
          payments={payments}
          trip={tripInfo}
          myPayment={myPayment}
          daysLeft={daysLeft}
        />
      )}
    </div>
  );
}

function LoginScreen({ login, users }) {
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h2>Trip Dashboard Login</h2>

        <input
          className="login-input"
          placeholder="Select Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          list="usernames"
        />

        <datalist id="usernames">
          {users.map((u) => (
            <option key={u.name} value={u.name} />
          ))}
        </datalist>

        <input
          type="password"
          className="login-input"
          placeholder="Password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />

        <button
          className="login-btn"
          onClick={() => login(name, pass)}
        >
          Login
        </button>
      </div>
    </div>
  );
}

function Dashboard({ user, payments, trip, myPayment, daysLeft }) {
  return (
    <div style={{ padding: "20px" }}>
      <div className="header">
        <div className="header-title">Chikmagalur Trip Dashboard</div>
        <div>Welcome, {user.name}</div>
      </div>

      <div className="grid grid-3">
        <div className="card">
          <div className="stat-number">{trip.total_cost}</div>
          <div className="small-label">Total Trip Cost</div>
        </div>

        <div className="card">
          <div className="stat-number">{trip.per_head}</div>
          <div className="small-label">Per Head</div>
        </div>

        <div className="card">
          <div className="stat-number">{daysLeft}</div>
          <div className="small-label">Days Left</div>
        </div>
      </div>

      <h2 style={{ marginTop: "30px" }}>Your Contribution</h2>
      <div className="card">
        <div className="stat-number">{myPayment}</div>
        {myPayment >= trip.per_head ? (
          <div className="small-label" style={{ color: "#10b981" }}>
            Fully Paid
          </div>
        ) : (
          <div className="small-label" style={{ color: "#f59e0b" }}>
            Pending
          </div>
        )}
      </div>

      <h2 style={{ marginTop: "30px" }}>All Members</h2>
      <div className="members-grid">
        {payments.map((p) => (
          <div className="member-card" key={p.name}>
            <div>{p.name}</div>
            <div
              className={
                "status-dot " +
                (p.paid >= trip.per_head
                  ? "status-paid"
                  : p.paid > 0
                  ? "status-partial"
                  : "status-none")
              }
            ></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
