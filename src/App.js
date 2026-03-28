import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Legend,
    LineChart,
    Line,
    AreaChart,
    Area,
} from "recharts";

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
const TRIP_START_AT = "2026-04-09 12:30";
const TRIP_END_AT = "2026-04-13 15:00";
const EXPECTED_MIN_MEMBERS = 40;
const WEATHER_LAT = 10.0889;
const WEATHER_LON = 77.0595;
const CHART_COLORS = ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6"];




const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n) => String(Math.max(0, n)).padStart(2, "0");
const money = (amt) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(Number(amt) || 0);

const getStatusMeta = (paid, perHead) => {
    if (paid >= perHead && perHead > 0) return { label: "Paid", color: "#10b981" };
    if (paid > 0) return { label: "Partial", color: "#f59e0b" };
    return { label: "Pending", color: "#ef4444" };
};

const parseBool = (value) => {
    const v = String(value ?? "").trim().toLowerCase();
    return v === "true" || v === "yes" || v === "1" || v === "active";
};

const toDate = (value) => {
    if (!value) return null;
    if (value instanceof Date && !isNaN(value.getTime())) return value;
    if (typeof value === "number") {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }
    const raw = String(value).trim();
    if (!raw) return null;

    const gvizMatch = raw.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/i);
    if (gvizMatch) {
        const y = Number(gvizMatch[1]);
        const m = Number(gvizMatch[2]);
        const d = Number(gvizMatch[3]);
        const hh = Number(gvizMatch[4] || 0);
        const mm = Number(gvizMatch[5] || 0);
        const ss = Number(gvizMatch[6] || 0);
        const parsed = new Date(y, m, d, hh, mm, ss);
        return isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? null : parsed;
};

const formatShortDate = (value) => {
    const date = toDate(value);
    if (!date) return String(value || "-");
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const formatDateTime = (value) => {
    const date = toDate(value);
    if (!date) return String(value || "-");
    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const isRecentDate = (value, withinDays = 2) => {
    const date = toDate(value);
    if (!date) return false;
    const now = Date.now();
    const age = now - date.getTime();
    return age >= 0 && age <= withinDays * 24 * 60 * 60 * 1000;
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

        if (!response?.ok) throw new Error(`Failed: ${sheet}`);
        const raw = await response.text();
        const payload = JSON.parse(raw.substring(47, raw.length - 2));
        return payload.table || { rows: [] };
    } catch (err) {
        console.error("Sheet fetch failed:", sheet, err);
        return { rows: [] };
    }
};

const useDebouncedValue = (value, delay = 260) => {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
};

const useAnimatedNumber = (target, duration = 700) => {
    const [num, setNum] = useState(0);

    useEffect(() => {
        const end = Number(target) || 0;
        let raf = 0;
        const start = performance.now();

        const tick = (time) => {
            const progress = Math.min((time - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setNum(end * eased);
            if (progress < 1) raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, duration]);

    return num;
};

const weatherCodeToIcon = (code) => {
    if (code === 0) return "☀";
    if ([1, 2].includes(code)) return "⛅";
    if (code === 3) return "☁";
    if ([45, 48].includes(code)) return "🌫";
    if ([51, 53, 55, 56, 57].includes(code)) return "🌦";
    if ([61, 63, 65, 66, 67].includes(code)) return "🌧";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "🌨";
    if ([80, 81, 82].includes(code)) return "🌧";
    if ([95, 96, 99].includes(code)) return "⛈";
    return "🌤";
};

const GlobalStyles = () => (
    <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #eef3ff;
      --bg-accent: radial-gradient(circle at 15% -10%, #dbeafe 0%, rgba(219,234,254,0) 40%), radial-gradient(circle at 90% 10%, #dcfce7 0%, rgba(220,252,231,0) 35%);
      --surface: rgba(255,255,255,0.82);
      --surface-solid: #ffffff;
      --surface-soft: #f5f9ff;
      --text: #0f172a;
      --text2: #334155;
      --text3: #64748b;
      --primary: #2563eb;
      --primary-2: #14b8a6;
      --border: rgba(15, 23, 42, 0.08);
      --ring: rgba(37, 99, 235, 0.24);
      --green: #10b981;
      --amber: #f59e0b;
      --red: #ef4444;
      --radius: 18px;
      --radius-sm: 12px;
      --font: 'Manrope', sans-serif;
      --mono: 'JetBrains Mono', monospace;
      --shadow: 0 8px 32px rgba(2,6,23,0.08), 0 2px 8px rgba(2,6,23,0.04);
      --shadow-hover: 0 14px 40px rgba(2,6,23,0.12), 0 3px 10px rgba(2,6,23,0.06);
    }

    [data-theme="dark"] {
      --bg: #060b16;
      --bg-accent: radial-gradient(circle at 15% -10%, rgba(59,130,246,0.2) 0%, rgba(59,130,246,0) 35%), radial-gradient(circle at 85% 0%, rgba(20,184,166,0.18) 0%, rgba(20,184,166,0) 35%);
      --surface: rgba(15, 23, 42, 0.72);
      --surface-solid: #0f172a;
      --surface-soft: #15233b;
      --text: #f1f5f9;
      --text2: #d2deef;
      --text3: #93a4bf;
      --primary: #60a5fa;
      --primary-2: #2dd4bf;
      --border: rgba(148, 163, 184, 0.2);
      --ring: rgba(96, 165, 250, 0.28);
      --green: #34d399;
      --amber: #fbbf24;
      --red: #f87171;
      --shadow: 0 12px 36px rgba(0,0,0,0.32), 0 2px 10px rgba(0,0,0,0.2);
      --shadow-hover: 0 18px 48px rgba(0,0,0,0.38), 0 3px 12px rgba(0,0,0,0.24);
    }

    body {
      font-family: var(--font);
      color: var(--text);
      background: var(--bg);
      line-height: 1.5;
    }

    .app-shell {
      min-height: 100vh;
      background: var(--bg-accent), var(--bg);
      color: var(--text);
    }

    .top-wrap {
      position: sticky;
      top: 0;
      z-index: 120;
      backdrop-filter: blur(14px);
      background: linear-gradient(180deg, rgba(255,255,255,0.8), rgba(255,255,255,0.6));
      border-bottom: 1px solid var(--border);
    }
    [data-theme="dark"] .top-wrap {
      background: linear-gradient(180deg, rgba(5,10,18,0.88), rgba(5,10,18,0.72));
    }

    .announce-bar {
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      border-bottom: 1px solid var(--border);
      font-size: 0.8rem;
      color: var(--text2);
      gap: 10px;
    }
    .announce-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(37,99,235,0.12);
      color: var(--primary);
      font-weight: 700;
      white-space: nowrap;
    }
    .announce-msg {
      flex: 1;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-weight: 600;
    }
    .announce-date {
      color: var(--text3);
      font-size: 0.72rem;
      font-family: var(--mono);
    }

    .top-bar {
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      gap: 12px;
    }
    .top-bar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      font-weight: 800;
    }
    .brand-dot {
      width: 34px;
      height: 34px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, var(--primary), var(--primary-2));
      color: white;
      box-shadow: 0 8px 20px rgba(37,99,235,0.3);
      flex-shrink: 0;
    }
    .top-bar-right {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .icon-btn {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text2);
      cursor: pointer;
      transition: all 0.22s ease;
      display: grid;
      place-items: center;
    }
    .icon-btn:hover { transform: translateY(-1px); box-shadow: var(--shadow); }

    .user-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      border-radius: 999px;
      padding: 4px 10px 4px 4px;
      border: 1px solid var(--border);
      background: var(--surface);
      max-width: 220px;
    }
    .avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary), var(--primary-2));
      color: white;
      display: grid;
      place-items: center;
      font-size: 11px;
      font-weight: 800;
      flex-shrink: 0;
    }
    .user-name {
      font-size: 0.82rem;
      font-weight: 700;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }

    .logout-btn {
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text2);
      border-radius: 10px;
      padding: 7px 12px;
      font-size: 0.76rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .logout-btn:hover { border-color: var(--red); color: var(--red); background: rgba(239,68,68,0.08); }

    .last-updated {
      font-size: 0.72rem;
      color: var(--text3);
      font-family: var(--mono);
      white-space: nowrap;
    }

    .page-content {
      max-width: 1320px;
      margin: 0 auto;
      padding: 26px 20px 78px;
      display: grid;
      gap: 20px;
      width: 100%;
    }

    .card {
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--surface);
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
      transition: all 0.24s ease;
      overflow: hidden;
    }
    .card:hover { box-shadow: var(--shadow-hover); transform: translateY(-2px); }
    .card-p { padding: 20px; }

    .hero-grid {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 14px;
      width: 100%;
    }
    .hero-grid > * {
      min-height: 120px;
      overflow: hidden;
    }
    .span-3 { grid-column: span 3; }
    .span-4 { grid-column: span 4; }
    .span-5 { grid-column: span 5; }
    .span-6 { grid-column: span 6; }
    .span-7 { grid-column: span 7; }
    .span-8 { grid-column: span 8; }
    .span-12 { grid-column: span 12; }

    .stat-card {
      padding: 20px;
      position: relative;
      overflow: hidden;
    }
    .stat-card::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(37,99,235,0.12), transparent 50%);
      opacity: 0;
      transition: opacity 0.28s ease;
      pointer-events: none;
    }
    .stat-card:hover::after { opacity: 1; }
    .stat-label {
      font-size: 0.74rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 700;
      color: var(--text3);
      margin-bottom: 10px;
    }
    .stat-value {
      font-size: 2rem;
      font-weight: 800;
      line-height: 1;
      color: var(--text);
      font-family: var(--mono);
    }
    .stat-sub { margin-top: 8px; font-size: 0.8rem; color: var(--text3); }
    .accent-dot {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      position: absolute;
      right: 16px;
      top: 16px;
      background: var(--surface-soft);
      border: 1px solid var(--border);
      font-size: 16px;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 10px;
    }
    .sticky-header {
      position: sticky;
      top: 106px;
      z-index: 60;
      padding: 7px 0;
      background: linear-gradient(180deg, rgba(238,243,255,0.94), rgba(238,243,255,0.7));
      backdrop-filter: blur(8px);
    }
    [data-theme="dark"] .sticky-header {
      background: linear-gradient(180deg, rgba(6,11,22,0.94), rgba(6,11,22,0.72));
    }
    .section-title {
      font-size: 1.02rem;
      font-weight: 800;
      color: var(--text);
    }

    .timeline-list {
      display: grid;
      gap: 12px;
      position: relative;
      padding-left: 18px;
    }
    .timeline-list::before {
      content: "";
      position: absolute;
      left: 8px;
      top: 6px;
      bottom: 6px;
      width: 2px;
      background: linear-gradient(var(--primary), rgba(37,99,235,0.2));
    }
    .timeline-item {
      position: relative;
      border: 1px solid var(--border);
      background: var(--surface-soft);
      border-radius: 14px;
      padding: 12px 12px 12px 14px;
      margin-left: 8px;
    }
    .timeline-item::before {
      content: "";
      position: absolute;
      left: -20px;
      top: 16px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--primary);
      box-shadow: 0 0 0 4px rgba(37,99,235,0.2);
    }
    .timeline-item.current {
      border: 2px solid var(--primary);
      box-shadow: 0 0 0 2px var(--ring);
    }
    .timeline-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 6px;
    }
    .timeline-day {
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
      color: var(--primary);
      letter-spacing: 0.08em;
    }
    .timeline-date { font-size: 0.76rem; color: var(--text3); font-family: var(--mono); }
    .timeline-title { font-size: 0.92rem; font-weight: 800; color: var(--text); }
    .timeline-desc { margin-top: 3px; font-size: 0.83rem; color: var(--text2); }

    .chart-card { padding: 18px; }
    .chart-title {
      font-size: 0.82rem;
      font-weight: 800;
      color: var(--text2);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 10px;
    }

    .insight-stack { display: grid; gap: 10px; }
    .insight-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface-soft);
      padding: 10px 12px;
      font-size: 0.84rem;
      color: var(--text2);
    }
    .insight-pill strong { color: var(--text); }

    .leaderboard-row {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 10px;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding: 9px 0;
      font-size: 0.84rem;
    }
    .leaderboard-row:last-child { border-bottom: none; }
    .rank-num { color: var(--text3); font-family: var(--mono); font-size: 0.76rem; width: 20px; }
    .amt { font-family: var(--mono); font-weight: 700; color: var(--green); }

    .reminder-card {
      padding: 18px;
      border-radius: var(--radius);
      color: white;
      background: linear-gradient(135deg, #2563eb, #0ea5e9);
      box-shadow: 0 14px 28px rgba(37,99,235,0.36);
      display: grid;
      gap: 10px;
    }
    .reminder-card.pending {
      background: linear-gradient(135deg, #f59e0b, #f97316);
      box-shadow: 0 14px 28px rgba(245,158,11,0.34);
    }
    .rem-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.09em; opacity: 0.85; font-weight: 800; }
    .rem-value { font-size: 1.28rem; font-weight: 800; }

    .chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip {
      border-radius: 999px;
      font-size: 0.74rem;
      padding: 4px 10px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
      color: var(--text2);
      font-weight: 700;
    }

    .weather-card {
      padding: 18px;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 16px;
      align-items: center;
    }
    .weather-main {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.9rem;
      font-weight: 800;
      font-family: var(--mono);
    }
    .weather-icon { font-size: 2.2rem; }
    .weather-meta { color: var(--text3); font-size: 0.8rem; }
    .trip-days-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
      gap: 8px;
      margin-top: 8px;
    }
    .trip-day {
      border: 1px solid var(--border);
      border-radius: 11px;
      padding: 8px;
      background: var(--surface-soft);
      text-align: center;
      font-size: 0.75rem;
      color: var(--text2);
      font-weight: 700;
    }

    .progress-wrap { margin-top: 12px; }
    .progress-labels {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 0.78rem;
      color: var(--text3);
      margin-bottom: 6px;
      font-weight: 700;
    }
    .progress-track {
      height: 11px;
      border-radius: 999px;
      background: var(--surface-soft);
      overflow: hidden;
      border: 1px solid var(--border);
    }
    .progress-fill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--primary), var(--primary-2));
      transition: width 1.1s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .member-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
      align-items: center;
      width: 100%;
    }
    .search-input {
      flex: 1;
      min-width: 140px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
      color: var(--text);
      font-family: var(--font);
      padding: 10px 12px;
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      font-size: 0.86rem;
      box-sizing: border-box;
    }
    .search-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--ring); }
    .filter-btn {
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--surface-soft);
      color: var(--text2);
      font-size: 0.8rem;
      padding: 8px 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .filter-btn.active { background: var(--primary); color: white; border-color: var(--primary); }

    .members-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 10px;
    }
    .member-card {
      display: flex;
      align-items: center;
      gap: 9px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface-soft);
      padding: 11px;
    }
    .member-name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.86rem; font-weight: 700; }

    .room-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 10px;
    }
    .room-card {
      border: 1px solid var(--border);
      border-radius: 14px;
      background: var(--surface-soft);
      padding: 12px;
      display: grid;
      gap: 6px;
    }
    .room-no { font-size: 1.05rem; font-weight: 800; color: var(--primary); }
    .room-meta { font-size: 0.81rem; color: var(--text2); }
    .room-meta strong { color: var(--text); }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 10px;
    }
    .info-card {
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface-soft);
      padding: 12px;
      display: grid;
      gap: 6px;
    }
    .info-k { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text3); font-weight: 800; }
    .info-v { font-size: 0.86rem; color: var(--text); font-weight: 700; word-break: break-word; }

    .empty-state { padding: 28px; text-align: center; color: var(--text3); font-size: 0.86rem; }

    .skeleton {
      border-radius: 10px;
      background: linear-gradient(90deg, var(--surface-soft) 25%, rgba(148,163,184,0.22) 50%, var(--surface-soft) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .scroll-top {
      position: fixed;
      right: 20px;
      bottom: 22px;
      width: 44px;
      height: 44px;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      background: linear-gradient(135deg, var(--primary), var(--primary-2));
      color: white;
      box-shadow: 0 12px 26px rgba(37,99,235,0.35);
      z-index: 90;
      transition: transform 0.2s ease;
    }
    .scroll-top:hover { transform: translateY(-2px); }

    .welcome-splash {
      position: fixed;
      inset: 0;
      z-index: 999;
      background: var(--surface-solid);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      animation: splashOut 0.5s ease 1.4s forwards;
    }
    .welcome-logo {
      width: 84px;
      height: 84px;
      border-radius: 24px;
      background: linear-gradient(135deg, var(--primary), var(--primary-2));
      display: grid;
      place-items: center;
      color: white;
      font-size: 36px;
      margin-bottom: 12px;
      animation: pop 0.5s cubic-bezier(0.16,1,0.3,1);
    }
    .welcome-name { font-size: 1.25rem; font-weight: 800; }
    .welcome-sub { font-size: 0.86rem; color: var(--text3); margin-top: 5px; }
    @keyframes splashOut { to { opacity: 0; pointer-events: none; } }
    @keyframes pop { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }

    .confetti-wrap {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 998;
      overflow: hidden;
    }
    .confetti-piece {
      position: absolute;
      top: -20px;
      width: 10px;
      height: 14px;
      border-radius: 2px;
      animation: fall 2200ms linear forwards;
    }
    @keyframes fall {
      to { transform: translateY(105vh) rotate(560deg); opacity: 0.05; }
    }

    .chart-card { padding: 18px; min-height: 260px; width: 100%; }

    .collapsible-card {
      transition: all 0.24s ease;
    }
    .collapsible-header {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 12px;
      margin-bottom: 0;
      cursor: pointer;
      user-select: none;
      padding: 4px 0;
      transition: all 0.24s ease;
    }
    .collapsible-header:hover {
      transform: translateX(4px);
    }
    .collapsible-header .section-title {
      margin-bottom: 0;
      transition: all 0.24s ease;
      padding-bottom: 2px;
      border-bottom: 2px solid transparent;
    }
    .collapsible-header.open .section-title {
      color: var(--primary);
      border-bottom-color: var(--primary);
    }
    .collapsible-header.closed .section-title {
      color: var(--text2);
      opacity: 0.6;
    }
    .collapsible-header:hover .section-title {
      color: var(--primary);
    }
    .collapsible-content {
      max-height: 9999px;
      overflow: hidden;
      transition: max-height 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.32s ease;
      opacity: 1;
    }
    .collapsible-content.closed {
      max-height: 0;
      opacity: 0;
      pointer-events: none;
    }

    @media (max-width: 1120px) {
      .span-3 { grid-column: span 6; }
      .span-4 { grid-column: span 6; }
      .span-5 { grid-column: span 6; }
      .span-7 { grid-column: span 6; }
      .span-8 { grid-column: span 6; }
      .sticky-header { top: 80px; }
    }

    @media (max-width: 860px) {
      .announce-date, .last-updated { display: none; }
      .top-bar { height: auto; min-height: 60px; padding-top: 8px; padding-bottom: 8px; flex-wrap: wrap; }
      .top-bar-right { flex-wrap: wrap; justify-content: flex-end; }
      .hero-grid > * { min-height: 100px; }
      .span-3, .span-4, .span-5, .span-6, .span-7, .span-8, .span-12 { grid-column: span 12 !important; }
      .hero-grid { grid-template-columns: 1fr; gap: 12px; }
      .weather-card { grid-template-columns: 1fr; }
      .sticky-header { top: 80px; }
      .chart-card { min-height: 220px !important; }
    }

    @media (max-width: 600px) {
      .announce-bar { padding-left: 12px; padding-right: 12px; height: 36px; font-size: 0.75rem; }
      .top-bar { padding-left: 12px; padding-right: 12px; height: auto; padding-top: 6px; padding-bottom: 6px; }
      .top-bar-brand { gap: 6px; }
      .top-bar-brand span { font-size: 0.85rem; }
      .user-chip { max-width: 130px; font-size: 0.75rem; }
      .logout-btn { padding: 6px 8px; font-size: 0.7rem; }
      .icon-btn { width: 32px; height: 32px; font-size: 14px; }
      .page-content { padding: 14px 10px 60px; gap: 12px; }
      .card, .card-p { border-radius: 12px; }
      .card-p, .chart-card, .stat-card { padding: 12px; }
      .stat-value { font-size: 1.4rem; }
      .stat-label { font-size: 0.7rem; }
      .section-title { font-size: 0.95rem; }
      .members-grid, .room-grid, .info-grid { grid-template-columns: 1fr; gap: 8px; }
      .leaderboard-row { gap: 8px; padding: 7px 0; font-size: 0.78rem; }
      .timeline-item { padding: 10px 10px 10px 12px; margin-left: 6px; }
      .chart-title { font-size: 0.75rem; margin-bottom: 8px; }
      .hero-grid { gap: 10px; }
      .collapsible-header { padding: 3px 0; }
    }

    @media (max-width: 410px) {
      .top-bar-brand span { display: none; }
      .top-bar-brand { gap: 0; }
      .brand-dot { width: 30px; height: 30px; font-size: 14px; }
      .user-chip { max-width: 90px; font-size: 0.7rem; padding: 2px 6px; }
      .announce-pill { padding: 2px 6px; font-size: 0.65rem; }
      .announce-msg { font-size: 0.68rem; }
      .card-p { padding: 10px; }
      .stat-card { padding: 12px; }
      .accent-dot { width: 28px; height: 28px; right: 10px; top: 10px; font-size: 14px; }
      .hero-grid > * { min-height: 90px; }
      .members-grid { gap: 6px; }
      .member-card { padding: 8px; gap: 6px; }
      .member-name { font-size: 0.78rem; }
      .chart-card { min-height: 180px !important; }
      .page-content { padding: 10px 6px 50px; gap: 8px; }
      .collapsible-header { padding: 2px 0; }
    }
  `}</style>
);

const CollapsibleSection = memo(({ id, title, children, defaultOpen = true }) => {
    const [isOpen, setIsOpen] = useState(() => {
        const saved = localStorage.getItem(`section_${id}`);
        return saved !== null ? saved === "true" : defaultOpen;
    });

    const handleToggle = () => {
        const newState = !isOpen;
        setIsOpen(newState);
        localStorage.setItem(`section_${id}`, String(newState));
    };

    return (
        <div className="card card-p collapsible-card">
            <div className={`collapsible-header section-header ${isOpen ? "open" : "closed"}`} onClick={handleToggle}>
                <div className="section-title">{title}</div>
            </div>
            <div className={`collapsible-content ${isOpen ? "open" : "closed"}`}>
                {children}
            </div>
        </div>
    );
});

const StatCard = memo(({ label, value, sub, icon, className }) => (
    <div className={`card stat-card ${className || ''}`}>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
        {icon && <div className="accent-dot">{icon}</div>}
    </div>
));

const AnimatedStatCard = memo(({ label, value, formatter, sub, icon, className }) => {
    const animated = useAnimatedNumber(value);
    return (
        <StatCard
            label={label}
            value={formatter(animated)}
            sub={sub}
            icon={icon}
            className={className}
        />
    );
});

const ProgressBar = memo(({ pct }) => (
    <div className="progress-wrap">
        <div className="progress-labels">
            <span>Completion</span>
            <span>{pct.toFixed(1)}%</span>
        </div>
        <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
        </div>
    </div>
));

const CountdownCompact = memo(({ className }) => {
    const [tl, setTl] = useState({});
    const start = new Date(TRIP_START_AT).getTime();
    const end = new Date(TRIP_END_AT).getTime();

    useEffect(() => {
        const run = () => {
            const now = Date.now();
            const dist = start - now;
            if (dist < 0) {
                setTl(now < end ? { live: true } : { ended: true });
                return;
            }
            setTl({
                days: Math.floor(dist / 86400000),
                hours: Math.floor((dist % 86400000) / 3600000),
                minutes: Math.floor((dist % 3600000) / 60000),
            });
        };
        run();
        const t = setInterval(run, 1000);
        return () => clearInterval(t);
    }, [start, end]);

    if (tl.live) {
        return (
            <div className={`reminder-card ${className || ''}`}>
                <div className="rem-label">Trip Status</div>
                <div className="rem-value">Live Now</div>
                <div style={{ opacity: 0.85, fontSize: "0.82rem" }}>Kerala trip is currently happening</div>
            </div>
        );
    }

    if (tl.ended) {
        return (
            <div className={`reminder-card pending ${className || ''}`}>
                <div className="rem-label">Trip Status</div>
                <div className="rem-value">Trip Completed</div>
                <div style={{ opacity: 0.85, fontSize: "0.82rem" }}>Memories packed. Until next trip.</div>
            </div>
        );
    }

    return (
        <div className={`reminder-card ${className || ''}`}>
            <div className="rem-label">Trip Starts In</div>
            <div className="rem-value">{fmt(tl.days || 0)}d {fmt(tl.hours || 0)}h {fmt(tl.minutes || 0)}m</div>
            <div style={{ opacity: 0.85, fontSize: "0.82rem" }}>Get your essentials ready</div>
        </div>
    );
});

const AnnouncementBar = memo(({ announcements }) => {
    const [index, setIndex] = useState(0);
    useEffect(() => {
        if (announcements.length < 2) return undefined;
        const t = setInterval(() => setIndex((i) => (i + 1) % announcements.length), 4500);
        return () => clearInterval(t);
    }, [announcements]);

    const current = announcements[index] || null;

    return (
        <div className="announce-bar">
            <span className="announce-pill">Announcements</span>
            {current ? (
                <>
                    <div className="announce-msg">
                        {isRecentDate(current.date, 2) ? "NEW • " : ""}
                        {current.message}
                    </div>
                    <span className="announce-date">{formatDateTime(current.date)}</span>
                </>
            ) : (
                <div className="announce-msg">No active announcements</div>
            )}
        </div>
    );
});

const TimelineSection = memo(({ timeline }) => {
    const today = new Date();
    const todayLabel = today.toDateString();

    return (
        <div className="card card-p">
            <div className="section-header">
                <div className="section-title">Trip Timeline</div>
            </div>
            {timeline.length === 0 ? (
                <div className="empty-state">Add rows in TIMELINE sheet to show day-wise itinerary.</div>
            ) : (
                <div className="timeline-list">
                    {timeline.map((item, idx) => {
                        const d = toDate(item.date);
                        const isCurrent = d ? d.toDateString() === todayLabel : idx === 0;
                        return (
                            <div key={`${item.day}-${item.title}-${idx}`} className={`timeline-item ${isCurrent ? "current" : ""}`}>
                                <div className="timeline-head">
                                    <span className="timeline-day">{item.day || `Day ${idx + 1}`}</span>
                                    <span className="timeline-date">{formatShortDate(item.date)}</span>
                                </div>
                                <div className="timeline-title">{item.title || "Activity"}</div>
                                <div className="timeline-desc">{item.description || "Details will be updated soon."}</div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
});

const PaymentAnalytics = memo(({ statusData, trendData, totalPaid, totalPending }) => (
    <div>
        <div className="section-header" style={{ marginBottom: 14 }}>
            <div style={{ flex: 1 }} />
            <div className="chip-row">
                <span className="chip">Paid: {money(totalPaid)}</span>
                <span className="chip">Pending: {money(totalPending)}</span>
            </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
            <div className="card" style={{ padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                <div className="chart-title">Payment Distribution</div>
                <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                        <Pie data={statusData} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={50} paddingAngle={3}>
                            {statusData.map((entry, i) => <Cell key={`${entry.name}-${i}`} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(v) => [v, "Members"]} />
                        <Legend verticalAlign="bottom" height={18} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="card" style={{ padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                <div className="chart-title">Daily Payment Trend</div>
                <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trendData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--text3)" }} />
                        <YAxis tick={{ fontSize: 11, fill: "var(--text3)" }} />
                        <Tooltip formatter={(v) => [money(v), "Collected"]} />
                        <Line type="monotone" dataKey="amount" stroke="var(--primary)" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    </div>
));

const ExpenseAnalytics = memo(({ categoryData, topCategory, totalSpent }) => (
    <div>
        <div className="section-header" style={{ marginBottom: 14 }}>
            <div style={{ flex: 1 }} />
            <div className="chip-row">
                <span className="chip">Total Spent: {money(totalSpent)}</span>
                {topCategory && <span className="chip">Top Category: {topCategory.name}</span>}
            </div>
        </div>
        {categoryData.length === 0 ? (
            <div className="empty-state">No expense entries available yet.</div>
        ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                <div className="card" style={{ padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                    <div className="chart-title">Category Breakdown</div>
                    <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                            <Pie data={categoryData} dataKey="amount" cx="50%" cy="50%" outerRadius={80} innerRadius={46} paddingAngle={2}>
                                {categoryData.map((entry, i) => <Cell key={`${entry.name}-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(v) => [money(v), "Spent"]} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="card" style={{ padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                    <div className="chart-title">Top Expense Categories</div>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={categoryData.slice(0, 8)} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text3)" }} />
                            <YAxis tick={{ fontSize: 10, fill: "var(--text3)" }} />
                            <Tooltip formatter={(v) => [money(v), "Spent"]} />
                            <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                                {categoryData.map((entry, i) => <Cell key={`${entry.name}-${i}-bar`} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        )}
    </div>
));

const InsightsPanel = memo(({ insights }) => (
    <div className="card card-p">
        <div className="section-header">
            <div className="section-title">Smart Insights</div>
        </div>
        <div className="insight-stack">
            {insights.map((ins) => (
                <div className="insight-pill" key={ins.id}>
                    <span>{ins.icon}</span>
                    <span dangerouslySetInnerHTML={{ __html: ins.text }} />
                </div>
            ))}
        </div>
    </div>
));

const PersonalDashboard = memo(({ myPaid, perHead, rank, totalMembers }) => {
    const remaining = Math.max(0, perHead - myPaid);
    const pct = perHead > 0 ? Math.min((myPaid / perHead) * 100, 100) : 0;
    return (
        <div className="card card-p">
            <div className="section-header">
                <div className="section-title">Your Dashboard</div>
            </div>
            <div className="hero-grid" style={{ marginTop: 6 }}>
                <AnimatedStatCard className="span-3" label="Paid" value={myPaid} formatter={money} sub="Your total contribution" icon="💳" />
                <AnimatedStatCard className="span-3" label="Remaining" value={remaining} formatter={money} sub={remaining > 0 ? "Pending amount" : "All set"} icon="🎯" />
                <StatCard className="span-3" label="Completion" value={`${pct.toFixed(1)}%`} sub="Payment completion" icon="📈" />
                <StatCard className="span-3" label="Rank" value={`#${rank}/${Math.max(totalMembers, 1)}`} sub="Contribution ranking" icon="🏆" />
            </div>
            <ProgressBar pct={pct} />
        </div>
    );
});

const Leaderboard = memo(({ topContributors, fullyPaid, lowestPending }) => (
    <div className="card card-p">
        <div className="section-header sticky-header">
            <div className="section-title">Leaderboard</div>
            <div className="chip-row">
                <span className="chip">Top Contributors</span>
                <span className="chip">Fully Paid</span>
            </div>
        </div>
        <div className="hero-grid" style={{ marginTop: 10 }}>
            <div className="card chart-card span-4">
                <div className="chart-title">Top Contributors</div>
                {topContributors.slice(0, 6).map((p, i) => (
                    <div key={`top-${p.name}`} className="leaderboard-row">
                        <span className="rank-num">#{i + 1}</span>
                        <span>{p.name}</span>
                        <span className="amt">{money(p.paid)}</span>
                    </div>
                ))}
            </div>
            <div className="card chart-card span-4">
                <div className="chart-title">Fully Paid Members</div>
                {fullyPaid.length === 0 ? (
                    <div className="empty-state" style={{ padding: 16 }}>No fully paid members yet.</div>
                ) : fullyPaid.slice(0, 8).map((p, i) => (
                    <div key={`full-${p.name}`} className="leaderboard-row">
                        <span className="rank-num">#{i + 1}</span>
                        <span>{p.name}</span>
                        <span className="amt">{money(p.paid)}</span>
                    </div>
                ))}
            </div>
            <div className="card chart-card span-4">
                <div className="chart-title">Lowest Pending</div>
                {lowestPending.length === 0 ? (
                    <div className="empty-state" style={{ padding: 16 }}>No pending balances.</div>
                ) : lowestPending.slice(0, 8).map((p, i) => (
                    <div key={`low-${p.name}`} className="leaderboard-row">
                        <span className="rank-num">#{i + 1}</span>
                        <span>{p.name}</span>
                        <span style={{ fontFamily: "var(--mono)", color: "var(--amber)", fontWeight: 700 }}>{money(p.pending)}</span>
                    </div>
                ))}
            </div>
        </div>
    </div>
));

const ImportantInfo = memo(({ infoEntries }) => {
    const visible = infoEntries.slice(0, 12);
    return (
        <div className="card card-p">
            <div className="section-header">
                <div className="section-title">Important Info</div>
            </div>
            {visible.length === 0 ? (
                <div className="empty-state">No INFO sheet entries found.</div>
            ) : (
                <div className="info-grid">
                    {visible.map((it, i) => (
                        <div className="info-card" key={`${it.key}-${i}`}>
                            <div className="info-k">{it.key}</div>
                            <div className="info-v">{it.value}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

const WeatherPanel = memo(({ weather }) => {
    if (!weather?.current) return null;
    const icon = weatherCodeToIcon(weather.current.weather_code);
    const daily = weather.daily || {};
    const cards = (daily.time || []).slice(0, 5).map((t, idx) => ({
        date: t,
        icon: weatherCodeToIcon((daily.weather_code || [])[idx]),
        max: (daily.temperature_2m_max || [])[idx],
        min: (daily.temperature_2m_min || [])[idx],
    }));

    return (
        <div className="card weather-card">
            <div>
                <div className="weather-main">
                    <span className="weather-icon">{icon}</span>
                    <span>{Math.round(weather.current.temperature_2m)}°C</span>
                </div>
                <div className="weather-meta">
                    Feels like {Math.round(weather.current.apparent_temperature)}°C · Rain {weather.current.rain || 0} mm
                </div>
            </div>
            <div>
                <div className="chart-title" style={{ marginBottom: 8 }}>Trip Weather Outlook</div>
                <div className="trip-days-grid">
                    {cards.map((d) => (
                        <div className="trip-day" key={d.date}>
                            <div>{formatShortDate(d.date)}</div>
                            <div style={{ fontSize: "1rem" }}>{d.icon}</div>
                            <div>{Math.round(d.max || 0)}° / {Math.round(d.min || 0)}°</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});

const RoomAllocation = memo(({ rooms, user, isAdmin }) => {
    const shownRooms = isAdmin ? rooms : rooms.filter((r) => r.name === user.name);
    return (
        <div className="card card-p">
            <div className="section-header">
                <div className="section-title">Room Allocation</div>
            </div>
            {shownRooms.length === 0 ? (
                <div className="empty-state">No room mapping found for current user.</div>
            ) : (
                <div className="room-grid">
                    {shownRooms.map((room, i) => (
                        <div className="room-card" key={`${room.name}-${room.roomNo}-${i}`}>
                            <div className="room-no">Room {room.roomNo || "-"}</div>
                            <div className="room-meta"><strong>Name:</strong> {room.name}</div>
                            <div className="room-meta"><strong>Roommates:</strong> {room.roommates || "-"}</div>
                            <div className="room-meta"><strong>Bus Seat:</strong> {room.busSeat || "-"}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

const MemberList = memo(({ user, perHeadCost, payments }) => {
    const [filter, setFilter] = useState("All");
    const [search, setSearch] = useState("");
    const [visible, setVisible] = useState(24);
    const debounced = useDebouncedValue(search, 240);

    const filtered = useMemo(() => {
        const q = debounced.trim().toLowerCase();
        return [...payments]
            .sort((a, b) => {
                if (a.name === user.name) return -1;
                if (b.name === user.name) return 1;
                return a.name.localeCompare(b.name);
            })
            .filter((p) => {
                const label = getStatusMeta(p.paid, perHeadCost).label;
                if (filter !== "All" && label !== filter) return false;
                if (q && !p.name.toLowerCase().includes(q)) return false;
                return true;
            });
    }, [debounced, filter, payments, perHeadCost, user.name]);

    useEffect(() => setVisible(24), [debounced, filter]);

    return (
        <div className="card card-p">
            <div className="section-header sticky-header">
                <div className="section-title">Member Tracker</div>
                <span className="chip">{payments.length} Members</span>
            </div>
            <div className="member-toolbar" style={{ marginTop: 8 }}>
                <input
                    className="search-input"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search members"
                />
                {["All", "Paid", "Partial", "Pending"].map((f) => (
                    <button key={f} className={`filter-btn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                        {f}
                    </button>
                ))}
            </div>
            <div style={{ maxHeight: 560, overflowY: "auto", paddingRight: 2 }}>
                <div className="members-grid">
                    {filtered.slice(0, visible).map((p) => {
                        const st = getStatusMeta(p.paid, perHeadCost);
                        return (
                            <div className="member-card" key={p.name}>
                                <div className="dot" style={{ width: 8, height: 8, borderRadius: "50%", background: st.color }} />
                                <div className="member-name">{p.name}</div>
                                <div style={{ textAlign: "right", minWidth: 88 }}>
                                    <div style={{ color: st.color, fontFamily: "var(--mono)", fontWeight: 700, fontSize: "0.8rem" }}>{money(p.paid)}</div>
                                    <div style={{ color: "var(--text3)", fontSize: "0.67rem", fontWeight: 700 }}>{st.label}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            {filtered.length === 0 && <div className="empty-state">No matching members found.</div>}
            {visible < filtered.length && (
                <button className="filter-btn" style={{ marginTop: 10, width: "100%" }} onClick={() => setVisible((v) => v + 24)}>
                    Load More
                </button>
            )}
        </div>
    );
});

const shouldShowCard = (cardName, cardConfig, user) => {
    if (!cardConfig || cardConfig.length === 0) return true;

    const normalize = (str) =>
        String(str || "")
            .toLowerCase()
            .replace(/\s+/g, "")
            .trim();

    const config = cardConfig.find(
        (c) => normalize(c.card_name) === normalize(cardName)
    );

    if (!config) return true;
    if (!config.visible) return false;
    if (config.admin_only && user.role !== "admin") return false;

    return true;
};

function Dashboard({
    user,
    users,
    payments,
    paymentEntries,
    trip,
    expenses,
    announcements,
    timeline,
    rooms,
    infoEntries,
    cardConfig,
    weather,
    darkMode,
    setDarkMode,
    logout,
    lastUpdated,
}) {
    const [showScroll, setShowScroll] = useState(false);
    const [showHeavy, setShowHeavy] = useState(false);

    const memberCount = users.length;
    const perHeadCost = Number(trip.per_head) || 0;
    const myPaid = payments.find((p) => p.name === user.name)?.paid || 0;
    const myPending = Math.max(0, perHeadCost - myPaid);
    const targetMembers = Math.max(memberCount, EXPECTED_MIN_MEMBERS);
    const targetAmount = targetMembers * perHeadCost;
    const totalPaid = payments.reduce((sum, p) => sum + p.paid, 0);
    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalPending = payments.reduce((sum, p) => sum + Math.max(0, perHeadCost - p.paid), 0);
    const groupPct = targetAmount > 0 ? Math.min((totalPaid / targetAmount) * 100, 100) : 0;

    const sortedByPaid = useMemo(() => [...payments].sort((a, b) => b.paid - a.paid), [payments]);
    const rank = Math.max(1, sortedByPaid.findIndex((p) => p.name === user.name) + 1);

    const statusData = useMemo(() => {
        const paid = payments.filter((p) => p.paid >= perHeadCost && perHeadCost > 0).length;
        const partial = payments.filter((p) => p.paid > 0 && p.paid < perHeadCost).length;
        const pending = payments.filter((p) => p.paid <= 0).length;
        return [
            { name: "Paid", value: paid, color: "#10b981" },
            { name: "Partial", value: partial, color: "#f59e0b" },
            { name: "Pending", value: pending, color: "#ef4444" },
        ].filter((d) => d.value > 0);
    }, [payments, perHeadCost]);



    const paymentTrend = useMemo(() => {
        const byDay = new Map();
        paymentEntries.forEach((entry) => {
            const date = toDate(entry.date);
            const key = date ? date.toISOString().slice(0, 10) : "Unknown";
            byDay.set(key, (byDay.get(key) || 0) + entry.amount);
        });

        return [...byDay.entries()]
            .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
            .slice(-14)
            .map(([day, amount]) => ({ day: formatShortDate(day), amount }));
    }, [paymentEntries]);

    const categoryData = useMemo(() => {
        const groups = new Map();
        expenses.forEach((e) => {
            const key = e.category || "Other";
            groups.set(key, (groups.get(key) || 0) + e.amount);
        });

        const total = [...groups.values()].reduce((s, x) => s + x, 0) || 1;
        return [...groups.entries()]
            .map(([name, amount]) => ({ name, amount, pct: (amount / total) * 100 }))
            .sort((a, b) => b.amount - a.amount);
    }, [expenses]);

    const topCategory = categoryData[0] || null;

    const insights = useMemo(() => {
        const completed = payments.filter((p) => p.paid >= perHeadCost && perHeadCost > 0).length;
        const completedPct = memberCount > 0 ? (completed / memberCount) * 100 : 0;
        const topContributor = sortedByPaid[0];
        return [
            {
                id: "completed",
                icon: "✅",
                text: `<strong>${completedPct.toFixed(1)}%</strong> members completed payment (${completed}/${memberCount || 1})`,
            },
            {
                id: "pending",
                icon: "⏳",
                text: `Total pending amount is <strong>${money(totalPending)}</strong>`,
            },
            {
                id: "top",
                icon: "🏆",
                text: `Highest contributor: <strong>${topContributor?.name || "-"}</strong> (${money(topContributor?.paid || 0)})`,
            },
            {
                id: "exp",
                icon: "💸",
                text: `Most expensive category: <strong>${topCategory?.name || "-"}</strong> (${money(topCategory?.amount || 0)})`,
            },
        ];
    }, [memberCount, payments, perHeadCost, sortedByPaid, topCategory, totalPending]);

    const fullyPaid = useMemo(() => sortedByPaid.filter((p) => p.paid >= perHeadCost && perHeadCost > 0), [sortedByPaid, perHeadCost]);
    const lowestPending = useMemo(
        () => payments
            .map((p) => ({ ...p, pending: Math.max(0, perHeadCost - p.paid) }))
            .filter((p) => p.pending > 0)
            .sort((a, b) => a.pending - b.pending),
        [payments, perHeadCost]
    );

    useEffect(() => {
        const onScroll = () => setShowScroll(window.scrollY > 360);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        const id = setTimeout(() => setShowHeavy(true), 180);
        return () => clearTimeout(id);
    }, []);

    return (
        <div className="app-shell" data-theme={darkMode ? "dark" : undefined}>
            <div className="top-wrap">
                <AnnouncementBar announcements={announcements} />
                <nav className="top-bar">
                    <div className="top-bar-brand">
                        <div className="brand-dot">🧭</div>
                        <span>{TRIP_BRAND} Premium Dashboard</span>
                    </div>
                    <div className="top-bar-right">
                        {lastUpdated && <span className="last-updated">Updated {lastUpdated}</span>}
                        <button className="icon-btn" onClick={() => setDarkMode((d) => !d)} title="Toggle theme">
                            {darkMode ? "☀" : "☾"}
                        </button>
                        <div className="user-chip">
                            <div className="avatar">{user.name.slice(0, 2).toUpperCase()}</div>
                            <span className="user-name">{user.name}</span>
                        </div>
                        <button className="logout-btn" onClick={logout}>Sign out</button>
                    </div>
                </nav>
            </div>

            <div className="page-content">
                <div className="hero-grid">
                    <AnimatedStatCard className="span-3" label="Trip Budget" value={Number(trip.total_cost) || 0} formatter={money} sub="From trip sheet" icon="💰" />
                    <AnimatedStatCard className="span-3" label="Per Head" value={perHeadCost} formatter={money} sub="Expected contribution" icon="👥" />
                    <AnimatedStatCard className="span-3" label="Collected" value={totalPaid} formatter={money} sub={`${groupPct.toFixed(1)}% of target`} icon="📥" />
                    <AnimatedStatCard className="span-3" label="Spent" value={totalSpent} formatter={money} sub="Total expense" icon="📤" />

                    <CountdownCompact className="span-5" />
                    <div className="span-7">
                        <div className={`reminder-card ${myPending > 0 ? "pending" : ""}`}>
                            <div className="rem-label">Reminder</div>
                            <div className="rem-value">
                                {myPending > 0 ? `You have pending ${money(myPending)}` : "You are fully paid"}
                            </div>
                            <div style={{ fontSize: "0.82rem", opacity: 0.9 }}>
                                {myPending > 0 ? `Trip starts soon. Complete payment to avoid last-minute rush.` : "Awesome. You are ready for the trip."}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card card-p">
                    <div className="section-header">
                        <div className="section-title">Group Progress Visualization</div>
                        <span className="chip">Target {money(targetAmount)}</span>
                    </div>
                    <ProgressBar pct={groupPct} />
                    <div className="progress-labels" style={{ marginTop: 10 }}>
                        <span>Collected: {money(totalPaid)}</span>
                        <span>Expected members: {targetMembers}</span>
                    </div>
                </div>

                {shouldShowCard("Timeline", cardConfig, user) && (
                    <CollapsibleSection id="timeline" title="Trip Timeline" defaultOpen={true}>
                        <TimelineSection timeline={timeline} />
                    </CollapsibleSection>
                )}

                {shouldShowCard("Payment Analytics", cardConfig, user) && (
                    showHeavy ? (
                        <CollapsibleSection id="payment_analytics" title="Payment Analytics" defaultOpen={true}>
                            <PaymentAnalytics statusData={statusData} trendData={paymentTrend} totalPaid={totalPaid} totalPending={totalPending} />
                        </CollapsibleSection>
                    ) : (
                        <div className="card card-p">
                            <div className="section-title" style={{ marginBottom: 10 }}>Loading analytics</div>
                            <div className="skeleton" style={{ height: 210 }} />
                        </div>
                    )
                )}

                {shouldShowCard("Expense Analytics", cardConfig, user) && (
                    showHeavy && (
                        <CollapsibleSection id="expense_analytics" title="Expense Analytics" defaultOpen={true}>
                            <ExpenseAnalytics categoryData={categoryData} topCategory={topCategory} totalSpent={totalSpent} />
                        </CollapsibleSection>
                    )
                )}

                <div className="hero-grid">
                    <div className="span-6"><PersonalDashboard myPaid={myPaid} perHead={perHeadCost} rank={rank} totalMembers={memberCount} /></div>
                    <div className="span-6"><InsightsPanel insights={insights} /></div>
                </div>

                {shouldShowCard("Leaderboard", cardConfig, user) && (
                    <CollapsibleSection id="leaderboard" title="Leaderboard" defaultOpen={true}>
                        <div style={{ paddingTop: 0 }}>
                            <Leaderboard topContributors={sortedByPaid} fullyPaid={fullyPaid} lowestPending={lowestPending} />
                        </div>
                    </CollapsibleSection>
                )}

                {shouldShowCard("Weather", cardConfig, user) && <WeatherPanel weather={weather} />}
                {shouldShowCard("Important Info", cardConfig, user) && <ImportantInfo infoEntries={infoEntries} />}
                {shouldShowCard("Room Allocation", cardConfig, user) && <RoomAllocation rooms={rooms} user={user} isAdmin={user.role === "admin"} />}

                {shouldShowCard("Member Tracker", cardConfig, user) && user.role === "admin" && (
                    <CollapsibleSection id="member_tracker" title="Member Tracker" defaultOpen={false}>
                        <div style={{ paddingTop: 0 }}>
                            <MemberList user={user} perHeadCost={perHeadCost} payments={payments} />
                        </div>
                    </CollapsibleSection>
                )}
            </div>

            {showScroll && (
                <button className="scroll-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                    ↑
                </button>
            )}
        </div>
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
        <div className="app-shell" style={{ display: "grid", placeItems: "center", padding: 20 }}>
            <div className="card" style={{ width: "100%", maxWidth: 420, padding: 26 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, display: "grid", placeItems: "center", fontSize: 24, color: "white", background: "linear-gradient(135deg, var(--primary), var(--primary-2))", marginBottom: 14 }}>🗺</div>
                <div style={{ fontSize: "1.45rem", fontWeight: 800, marginBottom: 4 }}>Kerala Trip 2026</div>
                <div style={{ color: "var(--text3)", marginBottom: 20, fontSize: "0.9rem" }}>{TRIP_BRAND} Member Portal</div>

                <form onSubmit={submit}>
                    <label style={{ display: "block", fontSize: "0.78rem", marginBottom: 6, color: "var(--text3)", fontWeight: 700 }}>Name</label>
                    <select className={`search-input ${loginError ? "error" : ""}`} style={{ marginBottom: 14 }} value={name} onChange={(e) => setName(e.target.value)} required>
                        <option value="" disabled>Select your name</option>
                        {users.map((u) => <option key={u.name} value={u.name}>{u.name}</option>)}
                    </select>

                    <label style={{ display: "block", fontSize: "0.78rem", marginBottom: 6, color: "var(--text3)", fontWeight: 700 }}>Password</label>
                    <input
                        type="password"
                        className={`search-input ${loginError ? "error" : ""}`}
                        placeholder="Enter password"
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                        required
                    />

                    {loginError && <div style={{ marginTop: 10, color: "var(--red)", fontWeight: 700, fontSize: "0.82rem" }}>Invalid credentials.</div>}

                    <button
                        type="submit"
                        style={{
                            width: "100%",
                            marginTop: 14,
                            border: "none",
                            cursor: "pointer",
                            borderRadius: 12,
                            padding: "12px 14px",
                            color: "white",
                            fontWeight: 800,
                            background: "linear-gradient(135deg, var(--primary), var(--primary-2))",
                            boxShadow: "0 10px 20px rgba(37,99,235,0.3)",
                        }}
                    >
                        Sign In
                    </button>
                </form>
            </div>
        </div>
    );
}

const LoadingView = () => (
    <div className="app-shell" style={{ display: "grid", placeItems: "center", padding: 20 }}>
        <div style={{ width: "min(420px, 100%)" }}>
            <div className="skeleton" style={{ height: 30, width: 200, marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 20, width: 120, marginBottom: 14 }} />
            <div className="loading-skeleton-grid">
                {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 66 }} />)}
            </div>
        </div>
    </div>
);

const Confetti = memo(({ show }) => {
    if (!show) return null;
    return (
        <div className="confetti-wrap">
            {[...Array(36)].map((_, i) => (
                <span
                    key={i}
                    className="confetti-piece"
                    style={{
                        left: `${(i * 97) % 100}%`,
                        background: CHART_COLORS[i % CHART_COLORS.length],
                        animationDelay: `${(i % 12) * 70}ms`,
                        opacity: 0.95,
                    }}
                />
            ))}
        </div>
    );
});

export default function App() {
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
    console.log(cardConfig);
    const [weather, setWeather] = useState(null);

    const [loading, setLoading] = useState(true);
    const [loginError, setLoginError] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
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
        const saved = localStorage.getItem("tripUser");
        if (saved) {
            try {
                setLoggedInUser(JSON.parse(saved));
            } catch {
                localStorage.removeItem("tripUser");
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem("tripTheme", darkMode ? "dark" : "light");
    }, [darkMode]);

    useEffect(() => {
        const fetchWeather = async () => {
            try {
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}&current=temperature_2m,apparent_temperature,rain,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`;
                const res = await fetch(url);
                if (!res.ok) return;
                const json = await res.json();
                setWeather(json);
            } catch (err) {
                console.error("Weather fetch failed", err);
            }
        };
        fetchWeather();
    }, []);

    useEffect(() => {
        const getCell = (row, i) => {
            const c = row?.c?.[i];
            if (!c) return "";
            return c.v ?? c.f ?? "";
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
                    .map((r) => ({
                        name: String(getCell(r, 0)).trim(),
                        password: String(getCell(r, 1)).trim(),
                        role: String(getCell(r, 2)).trim() || "member",
                    }))
                    .filter((u) => u.name && u.password && u.name.toLowerCase() !== "name");
                setUsers(loadedUsers);

                const paymentRows = (pS.rows || [])
                    .map((r) => ({
                        name: String(getCell(r, 0)).trim(),
                        amount: parseFloat(getCell(r, 1)) || 0,
                        date: getCell(r, 2),
                    }))
                    .filter((p) => p.name && p.amount > 0);
                setPaymentEntries(paymentRows);

                const trip = {};
                (tS.rows || []).forEach((r) => {
                    const key = String(getCell(r, 0)).trim();
                    const rawValue = getCell(r, 1);
                    if (!key) return;
                    trip[key] = isNaN(rawValue) ? rawValue : parseFloat(rawValue);
                });
                if (!trip.trip_name) trip.trip_name = TRIP_BRAND;
                if (!trip.start_date) trip.start_date = TRIP_START_AT;
                setTripInfo(trip);

                const loadedExpenses = (eS.rows || [])
                    .map((r) => ({
                        category: String(getCell(r, 0)).trim(),
                        amount: parseFloat(getCell(r, 1)) || 0,
                        date: getCell(r, 2),
                        notes: String(getCell(r, 3) || "No notes"),
                        addedBy: String(getCell(r, 4) || ""),
                    }))
                    .filter((e) => e.category && e.amount > 0);
                setExpenses(loadedExpenses);

                const loadedAnnouncements = (aS.rows || [])
                    .map((r) => ({
                        message: String(getCell(r, 0)).trim(),
                        date: getCell(r, 1),
                        priority: String(getCell(r, 2) || "medium").toLowerCase(),
                        active: parseBool(getCell(r, 3)),
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
                    .map((r) => ({
                        day: String(getCell(r, 0)).trim(),
                        title: String(getCell(r, 1)).trim(),
                        description: String(getCell(r, 2)).trim(),
                        date: getCell(r, 3),
                    }))
                    .filter((t) => t.day || t.title || t.description)
                    .sort((a, b) => {
                        const da = toDate(a.date)?.getTime() || 0;
                        const db = toDate(b.date)?.getTime() || 0;
                        return da - db;
                    });
                setTimeline(loadedTimeline);

                const loadedRooms = (rS.rows || [])
                    .map((r) => ({
                        name: String(getCell(r, 0)).trim(),
                        roomNo: String(getCell(r, 1)).trim(),
                        roommates: String(getCell(r, 2)).trim(),
                        busSeat: String(getCell(r, 3)).trim(),
                    }))
                    .filter((room) => room.name || room.roomNo);
                setRooms(loadedRooms);

                const loadedInfo = (iS.rows || [])
                    .map((r) => ({
                        key: String(getCell(r, 0)).trim(),
                        value: String(getCell(r, 1)).trim(),
                    }))
                    .filter((it) => it.key && it.value);
                setInfoEntries(loadedInfo);

                const loadedConfig = (cS.rows || [])
                    .map((r) => ({
                        card_name: String(getCell(r, 0)).trim(),
                        visible: parseBool(getCell(r, 1)),
                        admin_only: parseBool(getCell(r, 2)),
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
            setShowWelcome(true);
            setTimeout(() => setShowWelcome(false), 2100);
            setLoginError(false);
        },
        [users]
    );

    const logout = useCallback(() => {
        setLoggedInUser(null);
        localStorage.removeItem("tripUser");
    }, []);

    useEffect(() => {
        if (!loggedInUser) return;
        const perHead = Number(tripInfo.per_head) || 0;
        const myPaid = payments.find((p) => p.name === loggedInUser.name)?.paid || 0;
        if (perHead > 0 && myPaid >= perHead) {
            setShowConfetti(true);
            const t = setTimeout(() => setShowConfetti(false), 2400);
            return () => clearTimeout(t);
        }
        return undefined;
    }, [loggedInUser, payments, tripInfo.per_head]);

    return (
        <div data-theme={darkMode ? "dark" : undefined} style={{ minHeight: "100vh" }}>
            <GlobalStyles />
            <Confetti show={showConfetti} />

            {showWelcome && loggedInUser && (
                <div className="welcome-splash">
                    <div className="welcome-logo">🎒</div>
                    <div className="welcome-name">Welcome, {loggedInUser.name}</div>
                    <div className="welcome-sub">Your trip command center is ready</div>
                </div>
            )}

            {loading && <LoadingView />}

            {!loading && !loggedInUser && (
                <LoginScreen login={login} users={users} loginError={loginError} setLoginError={setLoginError} />
            )}

            {!loading && loggedInUser && (
                <Dashboard
                    user={loggedInUser}
                    users={users}
                    payments={payments}
                    paymentEntries={paymentEntries}
                    trip={tripInfo}
                    expenses={expenses}
                    announcements={announcements}
                    timeline={timeline}
                    rooms={rooms}
                    infoEntries={infoEntries}
                    cardConfig={cardConfig}
                    weather={weather}
                    darkMode={darkMode}
                    setDarkMode={setDarkMode}
                    logout={logout}
                    lastUpdated={lastUpdated}
                />
            )}
        </div>
    );
}
