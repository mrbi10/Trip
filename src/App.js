import React, { useCallback, useEffect, useMemo, useState } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import TripOpsPage from "./pages/TripOpsPage";

const SHEET_ID = process.env.REACT_APP_SHEET_ID;
const USERS_SHEET = process.env.REACT_APP_USERS_SHEET;
const PAYMENTS_SHEET = process.env.REACT_APP_PAYMENTS_SHEET;
const TRIP_SHEET = process.env.REACT_APP_TRIP_SHEET;
const EXPENSES_SHEET = process.env.REACT_APP_EXPENSES_SHEET;
const ANNOUNCEMENTS_SHEET = process.env.REACT_APP_ANNOUNCEMENTS_SHEET;
const TIMELINE_SHEET = process.env.REACT_APP_TIMELINE_SHEET;
const ROOMS_SHEET = process.env.REACT_APP_ROOMS_SHEET;
const INFO_SHEET = process.env.REACT_APP_INFO_SHEET;
const CONFIG_SHEET = process.env.REACT_APP_CONFIG_SHEET;

const TRIP_BRAND = "IV YEAR CSE";
const WEATHER_LAT = 10.0889;
const WEATHER_LON = 77.0595;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseBool = (value) => {
    const v = String(value ?? "").trim().toLowerCase();
    return v === "true" || v === "yes" || v === "1" || v === "active";
};

const toDate = (value) => {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

    const raw = String(value).trim();
    const gvizMatch = raw.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/i);
    if (gvizMatch) {
        const parsed = new Date(
            Number(gvizMatch[1]),
            Number(gvizMatch[2]),
            Number(gvizMatch[3]),
            Number(gvizMatch[4] || 0),
            Number(gvizMatch[5] || 0),
            Number(gvizMatch[6] || 0)
        );
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
};

const fetchSheet = async (sheet) => {
    if (!sheet || !SHEET_ID) return { rows: [] };

    try {
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheet)}`;
        let response = null;
        let delay = 800;

        for (let i = 0; i < 3; i += 1) {
            response = await fetch(url);
            if (response.ok) break;
            await sleep(delay);
            delay *= 2;
        }

        if (!response?.ok) throw new Error(`Failed sheet fetch: ${sheet}`);

        const raw = await response.text();
        const payload = JSON.parse(raw.substring(47, raw.length - 2));
        return payload.table || { rows: [] };
    } catch (err) {
        console.error("Sheet fetch failed", sheet, err);
        return { rows: [] };
    }
};

const shouldShowCard = (cardName, cardConfig, user) => {
    if (!cardConfig || cardConfig.length === 0) return true;

    const normalize = (str) =>
        String(str || "")
            .toLowerCase()
            .replace(/\s+/g, "")
            .trim();

    const config = cardConfig.find((c) => normalize(c.card_name) === normalize(cardName));

    if (!config) return true;
    if (!config.visible) return false;
    if (config.admin_only && user.role !== "admin") return false;

    return true;
};

function GlobalStyles() {
    return (
        <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

            * { box-sizing: border-box; }
            html {
                -webkit-text-size-adjust: 100%;
                text-size-adjust: 100%;
            }
            body {
                margin: 0;
                font-family: 'Manrope', sans-serif;
                color: #0f172a;
                background: #eef3ff;
            }

            :root {
                --bg: #eef3ff;
                --bg-2: #dbeafe;
                --card: rgba(255, 255, 255, 0.86);
                --text: #0f172a;
                --muted: #64748b;
                --border: rgba(15, 23, 42, 0.11);
                --primary: #2563eb;
                --primary-soft: #dbeafe;
            }

            [data-theme="dark"] {
                --bg: #07101f;
                --bg-2: #0e1b33;
                --card: rgba(15, 23, 42, 0.78);
                --text: #e2e8f0;
                --muted: #94a3b8;
                --border: rgba(148, 163, 184, 0.28);
                --primary: #60a5fa;
                --primary-soft: #122542;
            }

            .app-root {
                min-height: 100vh;
                background:
                    radial-gradient(circle at 10% -10%, var(--bg-2), transparent 35%),
                    radial-gradient(circle at 90% -15%, #dcfce7, transparent 32%),
                    var(--bg);
                color: var(--text);
            }

            [data-theme="dark"] .app-root {
                background:
                    radial-gradient(circle at 8% -10%, #16345f, transparent 36%),
                    radial-gradient(circle at 88% -12%, #11463f, transparent 34%),
                    var(--bg);
            }

            .top-wrap {
                position: sticky;
                top: 0;
                z-index: 10;
                border-bottom: 1px solid var(--border);
                backdrop-filter: blur(10px);
                background: rgba(255, 255, 255, 0.72);
            }

            [data-theme="dark"] .top-wrap {
                background: rgba(4, 11, 23, 0.78);
            }

            .top-bar {
                max-width: 1200px;
                margin: 0 auto;
                padding: 12px 16px;
                display: flex;
                gap: 12px;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
            }

            .brand {
                display: flex;
                align-items: center;
                gap: 10px;
                font-weight: 800;
            }

            .brand-dot {
                width: 34px;
                height: 34px;
                border-radius: 10px;
                display: grid;
                place-items: center;
                color: white;
                background: linear-gradient(135deg, #2563eb, #0ea5e9);
            }

            .nav-btn-row {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }

            .nav-btn,
            .icon-btn,
            .logout-btn,
            .primary-btn {
                border: 1px solid var(--border);
                background: var(--card);
                color: var(--text);
                border-radius: 10px;
                padding: 8px 12px;
                cursor: pointer;
                font-weight: 700;
                transition: 0.2s ease;
            }

            .nav-btn.active {
                background: var(--primary);
                color: white;
                border-color: var(--primary);
            }

            .nav-btn:hover,
            .icon-btn:hover,
            .logout-btn:hover,
            .primary-btn:hover {
                transform: translateY(-1px);
            }

            .user-chip {
                border: 1px solid var(--border);
                background: var(--card);
                border-radius: 999px;
                padding: 6px 10px;
                font-size: 0.84rem;
                font-weight: 700;
            }

            .content-wrap {
                max-width: 1200px;
                margin: 0 auto;
                padding: 18px 16px 36px;
            }

            .page-stack {
                display: grid;
                gap: 14px;
            }

            .section-title-row {
                display: flex;
                justify-content: space-between;
                gap: 10px;
                align-items: center;
                flex-wrap: wrap;
            }

            .section-title-row h2,
            .section-title-row h3 {
                margin: 0;
            }

            .muted { color: var(--muted); font-size: 0.86rem; }

            .chip-row { display: flex; gap: 8px; flex-wrap: wrap; }

            .chip {
                border: 1px solid var(--border);
                border-radius: 999px;
                background: var(--primary-soft);
                padding: 4px 10px;
                font-size: 0.76rem;
                font-weight: 700;
            }

            .stats-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 12px;
            }

            .two-col-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 12px;
            }

            .stat-label {
                font-size: 0.74rem;
                text-transform: uppercase;
                color: var(--muted);
                letter-spacing: 0.05em;
                margin-bottom: 6px;
                font-weight: 700;
            }

            .stat-value { font-size: 1.5rem; font-weight: 800; margin-bottom: 4px; }

            .progress-track {
                width: 100%;
                height: 12px;
                border-radius: 999px;
                border: 1px solid var(--border);
                background: rgba(148, 163, 184, 0.18);
                overflow: hidden;
            }

            .progress-fill {
                height: 100%;
                border-radius: 999px;
                background: linear-gradient(90deg, #2563eb, #0ea5e9);
            }

            .personal-hero {
                border: 1px solid var(--border);
                border-radius: 16px;
                padding: 16px;
                background: linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(14, 165, 233, 0.08)), var(--card);
            }

            .personal-hero-top {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 12px;
                flex-wrap: wrap;
            }

            .personal-amount {
                font-size: clamp(1.5rem, 3vw, 2rem);
                line-height: 1.1;
                font-weight: 800;
                margin: 4px 0;
            }

            .personal-status-chip {
                border-radius: 999px;
                font-weight: 700;
                font-size: 0.78rem;
                padding: 6px 10px;
                border: 1px solid rgba(0, 0, 0, 0.06);
            }

            .personal-progress-track {
                height: 14px;
                margin-bottom: 12px;
            }

            .personal-meta-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 10px;
            }

            .personal-meta-card {
                border: 1px solid var(--border);
                border-radius: 10px;
                padding: 10px;
                background: rgba(255, 255, 255, 0.55);
            }

            [data-theme="dark"] .personal-meta-card {
                background: rgba(30, 41, 59, 0.55);
            }

            .split-row {
                display: flex;
                justify-content: space-between;
                gap: 10px;
                flex-wrap: wrap;
            }

            .summary-list { display: grid; gap: 8px; }

            .summary-item {
                border: 1px solid var(--border);
                border-radius: 10px;
                padding: 10px;
                background: rgba(148, 163, 184, 0.07);
            }

            .summary-k { font-size: 0.76rem; color: var(--muted); margin-bottom: 2px; }
            .summary-v { font-size: 1rem; font-weight: 700; }

            .info-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                gap: 10px;
            }

            .info-card {
                border: 1px solid var(--border);
                border-radius: 10px;
                padding: 10px;
                background: rgba(148, 163, 184, 0.07);
            }

            .info-k {
                font-size: 0.72rem;
                color: var(--muted);
                font-weight: 700;
                text-transform: uppercase;
                margin-bottom: 3px;
            }

            .info-v { font-size: 0.86rem; font-weight: 700; }

            .list { display: grid; gap: 8px; }

            .list-row {
                border: 1px solid var(--border);
                border-radius: 10px;
                background: rgba(148, 163, 184, 0.07);
                padding: 9px 10px;
                display: grid;
                grid-template-columns: auto 1fr auto;
                gap: 10px;
                align-items: center;
            }

            .timeline-list { display: grid; gap: 10px; }

            .timeline-item {
                border: 1px solid var(--border);
                border-radius: 10px;
                padding: 10px;
                background: rgba(148, 163, 184, 0.07);
            }

            .timeline-head {
                display: flex;
                justify-content: space-between;
                gap: 8px;
                margin-bottom: 6px;
                flex-wrap: wrap;
            }

            .rooms-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                gap: 10px;
            }

            .room-card {
                border: 1px solid var(--border);
                border-radius: 10px;
                padding: 10px;
                display: grid;
                gap: 4px;
                background: rgba(148, 163, 184, 0.07);
            }

            .text-input {
                width: 100%;
                border: 1px solid var(--border);
                border-radius: 10px;
                background: var(--card);
                color: var(--text);
                padding: 10px;
                font: inherit;
                outline: none;
            }

            .weather-head {
                display: flex;
                justify-content: space-between;
                gap: 10px;
                align-items: center;
                flex-wrap: wrap;
                margin-bottom: 10px;
            }

            .weather-main {
                display: flex;
                gap: 8px;
                align-items: center;
                font-size: 1.2rem;
            }

            .weather-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
                gap: 8px;
            }

            .weather-day {
                border: 1px solid var(--border);
                border-radius: 10px;
                text-align: center;
                padding: 8px;
                font-size: 0.8rem;
                background: rgba(148, 163, 184, 0.07);
            }

            .login-wrap {
                min-height: 100vh;
                display: grid;
                place-items: center;
                padding: 16px;
            }

            .login-card {
                width: min(420px, 100%);
                border: 1px solid var(--border);
                border-radius: 14px;
                background: var(--card);
                padding: 20px;
            }

            .label {
                font-size: 0.8rem;
                font-weight: 700;
                color: var(--muted);
                display: block;
                margin-bottom: 6px;
            }

            @media (max-width: 920px) {
                .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                .two-col-grid { grid-template-columns: 1fr; }
                .personal-meta-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            }

            @media (max-width: 560px) {
                .stats-grid { grid-template-columns: 1fr; }
                .top-bar { padding: 10px 12px; }
                .content-wrap { padding: 14px 12px 28px; }
                .nav-btn, .icon-btn, .logout-btn, .primary-btn { padding: 7px 10px; font-size: 0.8rem; }
                .personal-hero { padding: 12px; border-radius: 12px; }
                .personal-meta-grid { grid-template-columns: 1fr; }
                .personal-meta-card { padding: 9px; }
                .muted { font-size: 0.82rem; }
            }
        `}</style>
    );
}

function TopBar({ user, darkMode, onToggleTheme, onLogout }) {
    const navigate = useNavigate();
    const location = useLocation();

    const pages = [
        { label: "Dashboard", path: "/dashboard" },
        { label: "Analytics", path: "/analytics" },
        { label: "Trip Ops", path: "/trip-ops" },
    ];

    return (
        <div className="top-wrap">
            <div className="top-bar">
                <div className="brand">
                    <div className="brand-dot">🧭</div>
                    <span>{TRIP_BRAND} Trip Dashboard</span>
                </div>

                <div className="nav-btn-row">
                    {pages.map((page) => (
                        <button
                            key={page.path}
                            className={`nav-btn ${location.pathname === page.path ? "active" : ""}`}
                            onClick={() => navigate(page.path)}
                            type="button"
                        >
                            {page.label}
                        </button>
                    ))}
                </div>

                <div className="nav-btn-row">
                    <button className="icon-btn" onClick={onToggleTheme} type="button" title="Toggle theme">
                        {darkMode ? "☀" : "☾"}
                    </button>
                    <div className="user-chip">{user.name}</div>
                    <button className="logout-btn" onClick={onLogout} type="button">Sign out</button>
                </div>
            </div>
        </div>
    );
}

function LoginScreen({ users, login, loginError, setLoginError }) {
    const [name, setName] = useState("");
    const [pass, setPass] = useState("");

    const onSubmit = (event) => {
        event.preventDefault();
        setLoginError(false);
        login(name, pass);
    };

    return (
        <div className="login-wrap">
            <div className="login-card">
                <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Kerala Trip 2026</div>
                <div className="muted" style={{ marginBottom: 16 }}>{TRIP_BRAND} Member Portal</div>

                <form onSubmit={onSubmit}>
                    <label className="label">Name</label>
                    <select className="text-input" value={name} onChange={(e) => setName(e.target.value)} required>
                        <option value="" disabled>Select your name</option>
                        {users.map((u) => (
                            <option key={u.name} value={u.name}>{u.name}</option>
                        ))}
                    </select>

                    <label className="label" style={{ marginTop: 12 }}>Password</label>
                    <input
                        type="password"
                        className="text-input"
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                        placeholder="Enter password"
                        required
                    />

                    {loginError && (
                        <div style={{ color: "#dc2626", fontWeight: 700, fontSize: "0.82rem", marginTop: 10 }}>
                            Invalid credentials.
                        </div>
                    )}

                    <button className="primary-btn" style={{ width: "100%", marginTop: 14 }} type="submit">
                        Sign In
                    </button>
                </form>
            </div>
        </div>
    );
}

function LoadingScreen() {
    return (
        <div className="login-wrap">
            <div className="login-card">
                <div style={{ fontSize: 18, fontWeight: 700 }}>Loading dashboard data...</div>
                <div className="muted" style={{ marginTop: 8 }}>Please wait a moment.</div>
            </div>
        </div>
    );
}

function AppContent() {
    const navigate = useNavigate();
    const location = useLocation();

    const [loggedInUser, setLoggedInUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [paymentEntries, setPaymentEntries] = useState([]);
    const [tripInfo, setTripInfo] = useState({});
    const [expenses, setExpenses] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [timeline, setTimeline] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [infoEntries, setInfoEntries] = useState([]);
    const [cardConfig, setCardConfig] = useState([]);
    const [weather, setWeather] = useState(null);

    const [loading, setLoading] = useState(true);
    const [loginError, setLoginError] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    const [darkMode, setDarkMode] = useState(() => {
        const savedTheme = localStorage.getItem("tripTheme");
        if (savedTheme === "dark") return true;
        if (savedTheme === "light") return false;
        return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    });

    const payments = useMemo(() => {
        const base = new Map(users.map((u) => [u.name, 0]));
        paymentEntries.forEach((entry) => {
            if (!entry.name) return;
            base.set(entry.name, (base.get(entry.name) || 0) + entry.amount);
        });
        return [...base.entries()].map(([name, paid]) => ({ name, paid }));
    }, [users, paymentEntries]);

    useEffect(() => {
        const savedUser = localStorage.getItem("tripUser");
        if (!savedUser) return;

        try {
            setLoggedInUser(JSON.parse(savedUser));
        } catch {
            localStorage.removeItem("tripUser");
        }
    }, []);

    useEffect(() => {
        localStorage.setItem("tripTheme", darkMode ? "dark" : "light");
    }, [darkMode]);

    useEffect(() => {
        const fetchWeather = async () => {
            try {
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}&current=temperature_2m,apparent_temperature,rain,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`;
                const response = await fetch(url);
                if (!response.ok) return;
                const json = await response.json();
                setWeather(json);
            } catch (err) {
                console.error("Weather fetch failed", err);
            }
        };

        fetchWeather();
    }, []);

    useEffect(() => {
        const getCell = (row, index) => {
            const cell = row?.c?.[index];
            if (!cell) return "";
            return cell.v ?? cell.f ?? "";
        };

        const load = async () => {
            try {
                const [uS, pS, tS, eS, aS, tlS, rS, iS, cS] = await Promise.all([
                    fetchSheet(USERS_SHEET),
                    fetchSheet(PAYMENTS_SHEET),
                    fetchSheet(TRIP_SHEET),
                    fetchSheet(EXPENSES_SHEET),
                    fetchSheet(ANNOUNCEMENTS_SHEET),
                    fetchSheet(TIMELINE_SHEET),
                    fetchSheet(ROOMS_SHEET),
                    fetchSheet(INFO_SHEET),
                    fetchSheet(CONFIG_SHEET),
                ]);

                const loadedUsers = (uS.rows || [])
                    .map((row) => ({
                        name: String(getCell(row, 0)).trim(),
                        password: String(getCell(row, 1)).trim(),
                        role: String(getCell(row, 2)).trim() || "member",
                    }))
                    .filter((u) => u.name && u.password && u.name.toLowerCase() !== "name");
                setUsers(loadedUsers);

                const loadedPayments = (pS.rows || [])
                    .map((row) => ({
                        name: String(getCell(row, 0)).trim(),
                        amount: parseFloat(getCell(row, 1)) || 0,
                        date: getCell(row, 2),
                    }))
                    .filter((p) => p.name && p.amount > 0);
                setPaymentEntries(loadedPayments);

                const loadedTrip = {};
                (tS.rows || []).forEach((row) => {
                    const key = String(getCell(row, 0)).trim();
                    const rawValue = getCell(row, 1);
                    if (!key) return;
                    loadedTrip[key] = Number.isNaN(Number(rawValue)) ? rawValue : Number(rawValue);
                });
                setTripInfo(loadedTrip);

                const loadedExpenses = (eS.rows || [])
                    .map((row) => ({
                        category: String(getCell(row, 0)).trim(),
                        amount: parseFloat(getCell(row, 1)) || 0,
                        date: getCell(row, 2),
                        notes: String(getCell(row, 3) || ""),
                        addedBy: String(getCell(row, 4) || ""),
                    }))
                    .filter((e) => e.category && e.amount > 0);
                setExpenses(loadedExpenses);

                const loadedAnnouncements = (aS.rows || [])
                    .map((row) => ({
                        message: String(getCell(row, 0)).trim(),
                        date: getCell(row, 1),
                        priority: String(getCell(row, 2) || "medium").toLowerCase(),
                        active: parseBool(getCell(row, 3)),
                    }))
                    .filter((a) => a.message && a.active)
                    .sort((a, b) => {
                        const pa = a.priority === "high" ? 2 : a.priority === "medium" ? 1 : 0;
                        const pb = b.priority === "high" ? 2 : b.priority === "medium" ? 1 : 0;
                        if (pb !== pa) return pb - pa;
                        return (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0);
                    });
                setAnnouncements(loadedAnnouncements);

                const loadedTimeline = (tlS.rows || [])
                    .map((row) => ({
                        day: String(getCell(row, 0)).trim(),
                        title: String(getCell(row, 1)).trim(),
                        description: String(getCell(row, 2)).trim(),
                        date: getCell(row, 3),
                    }))
                    .filter((t) => t.day || t.title || t.description)
                    .sort((a, b) => (toDate(a.date)?.getTime() || 0) - (toDate(b.date)?.getTime() || 0));
                setTimeline(loadedTimeline);

                const loadedRooms = (rS.rows || [])
                    .map((row) => ({
                        name: String(getCell(row, 0)).trim(),
                        roomNo: String(getCell(row, 1)).trim(),
                        roommates: String(getCell(row, 2)).trim(),
                        busSeat: String(getCell(row, 3)).trim(),
                    }))
                    .filter((room) => room.name || room.roomNo);
                setRooms(loadedRooms);

                const loadedInfo = (iS.rows || [])
                    .map((row) => ({
                        key: String(getCell(row, 0)).trim(),
                        value: String(getCell(row, 1)).trim(),
                    }))
                    .filter((item) => item.key && item.value);
                setInfoEntries(loadedInfo);

                const loadedConfig = (cS.rows || [])
                    .map((row) => ({
                        card_name: String(getCell(row, 0)).trim(),
                        visible: parseBool(getCell(row, 1)),
                        admin_only: parseBool(getCell(row, 2)),
                    }))
                    .filter((c) => c.card_name);
                setCardConfig(loadedConfig);

                setLastUpdated(
                    new Date().toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                    })
                );
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, []);

    const login = useCallback(
        (name, pass) => {
            const found = users.find(
                (u) => u.name.trim() === name.trim() && String(u.password).trim() === String(pass).trim()
            );

            if (!found) {
                setLoginError(true);
                return;
            }

            setLoggedInUser(found);
            localStorage.setItem("tripUser", JSON.stringify(found));
            setLoginError(false);
            navigate("/dashboard", { replace: true });
        },
        [users, navigate]
    );

    const logout = useCallback(() => {
        setLoggedInUser(null);
        localStorage.removeItem("tripUser");
    }, []);

    useEffect(() => {
        if (!loggedInUser) return;
        if (location.pathname === "/") {
            navigate("/dashboard", { replace: true });
        }
    }, [loggedInUser, location.pathname, navigate]);

    const showCard = useCallback(
        (cardName) => {
            if (!loggedInUser) return false;
            return shouldShowCard(cardName, cardConfig, loggedInUser);
        },
        [cardConfig, loggedInUser]
    );

    if (loading) {
        return (
            <div className="app-root" data-theme={darkMode ? "dark" : undefined}>
                <GlobalStyles />
                <LoadingScreen />
            </div>
        );
    }

    if (!loggedInUser) {
        return (
            <div className="app-root" data-theme={darkMode ? "dark" : undefined}>
                <GlobalStyles />
                <LoginScreen
                    users={users}
                    login={login}
                    loginError={loginError}
                    setLoginError={setLoginError}
                />
            </div>
        );
    }

    return (
        <div className="app-root" data-theme={darkMode ? "dark" : undefined}>
            <GlobalStyles />
            <TopBar
                user={loggedInUser}
                darkMode={darkMode}
                onToggleTheme={() => setDarkMode((d) => !d)}
                onLogout={logout}
            />
            <div className="content-wrap">
                <Routes>
                    <Route
                        path="/dashboard"
                        element={
                            <DashboardPage
                                user={loggedInUser}
                                users={users}
                                payments={payments}
                                paymentEntries={paymentEntries}
                                tripInfo={tripInfo}
                                expenses={expenses}
                                infoEntries={infoEntries}
                                announcements={announcements}
                                lastUpdated={lastUpdated}
                                showCard={showCard}
                            />
                        }
                    />
                    <Route
                        path="/analytics"
                        element={
                            <AnalyticsPage
                                payments={payments}
                                paymentEntries={paymentEntries}
                                expenses={expenses}
                                tripInfo={tripInfo}
                                showCard={showCard}
                            />
                        }
                    />
                    <Route
                        path="/trip-ops"
                        element={
                            <TripOpsPage
                                user={loggedInUser}
                                timeline={timeline}
                                rooms={rooms}
                                weather={weather}
                                payments={payments}
                                tripInfo={tripInfo}
                                showCard={showCard}
                            />
                        }
                    />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </div>
        </div>
    );
}

export default function App() {
    return (
        <HashRouter>
            <AppContent />
        </HashRouter>
    );
}
