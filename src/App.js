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
const PERSONAL_DETAILS_SHEET = process.env.REACT_APP_PERSONAL_DETAILS_SHEET || "personaldetails";

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

function parseGoogleSheetResponse(responseText) {
    const json = JSON.parse(
        responseText
            .replace("/*O_o*/", "")
            .replace("google.visualization.Query.setResponse(", "")
            .slice(0, -2)
    );

    const rows = json.table.rows;

    const payments = rows.map((row) => ({
        name: row.c[0]?.v || "",
        paid: row.c[1]?.v || 0,
    }));

    const paymentEntries = rows.map((row) => {
        const dateStr = row.c[2]?.v;

        let parsedDate = null;
        if (dateStr && dateStr.startsWith("Date(")) {
            const parts = dateStr.match(/\d+/g).map(Number);
            parsedDate = new Date(
                parts[0],
                parts[1],
                parts[2],
                parts[3],
                parts[4],
                parts[5]
            );
        }

        return {
            name: row.c[0]?.v || "",
            amount: row.c[1]?.v || 0,
            date: parsedDate,
        };
    });

    return { payments, paymentEntries };
}

const fetchSheetText = async (sheet) => {
    if (!sheet || !SHEET_ID) return "";

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
        return await response.text();
    } catch (err) {
        console.error("Sheet fetch failed", sheet, err);
        return "";
    }
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

const normalizeHeader = (value) =>
    String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

function GlobalStyles() {
    return (
        <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap');

            :root {
                --font-body: 'Manrope', 'Segoe UI', sans-serif;
                --font-display: 'Space Grotesk', 'Manrope', sans-serif;

                --space-1: 4px;
                --space-2: 8px;
                --space-3: 12px;
                --space-4: 16px;
                --space-5: 20px;
                --space-6: 24px;
                --space-8: 32px;

                --radius-sm: 10px;
                --radius-md: 14px;
                --radius-lg: 18px;
                --radius-pill: 999px;

                --bg: #f4f7fc;
                --bg-elev: #fbfdff;
                --bg-tint: #e6efff;
                --surface: rgba(255, 255, 255, 0.76);
                --surface-strong: rgba(255, 255, 255, 0.9);
                --card: rgba(255, 255, 255, 0.84);

                --text: #101828;
                --text-soft: #334155;
                --muted: #64748b;

                --border: rgba(15, 23, 42, 0.1);
                --border-soft: rgba(15, 23, 42, 0.06);

                --primary: #155eef;
                --secondary: #0e9384;
                --accent: #f79009;
                --primary-soft: #dce8ff;
                --focus: rgba(21, 94, 239, 0.28);

                --shadow-xs: 0 1px 2px rgba(16, 24, 40, 0.05);
                --shadow-sm: 0 8px 24px rgba(16, 24, 40, 0.08);
                --shadow-md: 0 14px 32px rgba(16, 24, 40, 0.12);
                --shadow-lg: 0 24px 44px rgba(16, 24, 40, 0.16);
            }

            * { box-sizing: border-box; }

            html {
                -webkit-text-size-adjust: 100%;
                text-size-adjust: 100%;
                scroll-behavior: smooth;
            }

            body {
                margin: 0;
                font-family: var(--font-body);
                color: var(--text);
                min-height: 100vh;
                background:
                    radial-gradient(circle at 8% -16%, #d5e4ff 0%, rgba(213, 228, 255, 0) 42%),
                    radial-gradient(circle at 96% -12%, #def6f0 0%, rgba(222, 246, 240, 0) 36%),
                    linear-gradient(175deg, #f7f9fd 0%, #eff3fa 48%, #f8faff 100%);
            }

            [data-theme="dark"] {
                --bg: #070d1d;
                --bg-elev: #0f1834;
                --bg-tint: #381557;
                --surface: rgba(12, 20, 42, 0.62);
                --surface-strong: rgba(15, 24, 52, 0.8);
                --card: rgba(13, 22, 44, 0.78);

                --text: #ebf2ff;
                --text-soft: #d2ddf8;
                --muted: #a9bddf;

                --border: rgba(148, 163, 184, 0.24);
                --border-soft: rgba(148, 163, 184, 0.16);

                --primary: #6bb4ff;
                --secondary: #2dd4bf;
                --accent: #fbbf24;
                --primary-soft: rgba(52, 94, 151, 0.44);
                --focus: rgba(107, 180, 255, 0.36);

                --shadow-xs: 0 2px 4px rgba(2, 6, 20, 0.42);
                --shadow-sm: 0 10px 24px rgba(2, 7, 20, 0.5);
                --shadow-md: 0 18px 34px rgba(2, 7, 20, 0.56);
                --shadow-lg: 0 28px 48px rgba(2, 7, 20, 0.62);
            }

            .app-root {
                min-height: 100vh;
                color: var(--text);
                background:
                    radial-gradient(circle at 10% -12%, var(--bg-elev), transparent 36%),
                    radial-gradient(circle at 92% -14%, var(--bg-tint), transparent 32%),
                    repeating-linear-gradient(130deg, rgba(21, 94, 239, 0.045) 0 1px, transparent 1px 18px),
                    var(--bg);
                transition: background 0.38s ease, color 0.32s ease;
            }

            [data-theme="dark"] .app-root {
                background:
                    radial-gradient(circle at 8% -12%, #17346a, transparent 38%),
                    radial-gradient(circle at 86% -14%, #542d74, transparent 34%),
                    radial-gradient(circle at 62% 132%, rgba(45, 212, 191, 0.2), transparent 58%),
                    repeating-linear-gradient(128deg, rgba(107, 180, 255, 0.1) 0 1px, transparent 1px 19px),
                    var(--bg);
            }

            .top-wrap {
                position: sticky;
                top: 0;
                z-index: 20;
                border-bottom: 1px solid var(--border-soft);
                backdrop-filter: blur(16px) saturate(1.2);
                background: linear-gradient(180deg, rgba(255, 255, 255, 0.83), rgba(255, 255, 255, 0.71));
                box-shadow: var(--shadow-sm);
                isolation: isolate;
            }

            .top-wrap::after {
                content: '';
                position: absolute;
                left: 0;
                right: 0;
                bottom: -1px;
                height: 1px;
                background: linear-gradient(90deg, transparent, rgba(21, 94, 239, 0.32), transparent);
            }

            [data-theme="dark"] .top-wrap {
                background: linear-gradient(180deg, rgba(8, 14, 31, 0.88), rgba(7, 13, 28, 0.74));
                box-shadow: var(--shadow-md);
            }

            .top-bar {
                max-width: 1240px;
                margin: 0 auto;
                padding: 12px var(--space-5);
                display: flex;
                gap: var(--space-3);
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
            }

            .brand {
                display: flex;
                align-items: center;
                gap: var(--space-3);
                font-weight: 700;
                font-family: var(--font-display);
                font-size: 1.02rem;
                letter-spacing: 0.01em;
            }

            .brand-dot {
                width: 38px;
                height: 38px;
                border-radius: 12px;
                display: grid;
                place-items: center;
                color: #fff;
                background: linear-gradient(140deg, var(--primary), #27a8ff 58%, var(--secondary));
                box-shadow: 0 8px 18px rgba(21, 94, 239, 0.32);
                animation: glow-pulse 2.9s ease-in-out infinite;
            }

            .nav-btn-row {
                display: flex;
                align-items: center;
                gap: var(--space-2);
                flex-wrap: wrap;
            }

            .nav-btn,
            .icon-btn,
            .logout-btn,
            .primary-btn {
                border: 1px solid var(--border);
                background: var(--surface);
                color: var(--text);
                border-radius: 12px;
                padding: 8px 13px;
                cursor: pointer;
                font-weight: 700;
                font-size: 0.86rem;
                line-height: 1;
                transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease, background 0.22s ease;
                box-shadow: var(--shadow-xs);
            }

            .nav-btn {
                position: relative;
                overflow: hidden;
            }

            .nav-btn::after {
                content: '';
                position: absolute;
                left: 14%;
                right: 14%;
                bottom: 4px;
                height: 2px;
                border-radius: var(--radius-pill);
                background: transparent;
                transition: background 0.22s ease;
            }

            .nav-btn.active {
                background: var(--surface-strong);
                border-color: rgba(21, 94, 239, 0.3);
                color: var(--text);
                box-shadow: 0 12px 20px rgba(21, 94, 239, 0.18);
            }

            .nav-btn.active::after {
                background: linear-gradient(90deg, var(--primary), #30b2ff);
            }

            .icon-btn {
                width: 36px;
                height: 36px;
                padding: 0;
                border-radius: 50%;
                display: grid;
                place-items: center;
                font-size: 0.95rem;
            }

            .logout-btn {
                background: linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.56));
            }

            [data-theme="dark"] .logout-btn {
                background: linear-gradient(180deg, rgba(22, 35, 67, 0.88), rgba(15, 27, 54, 0.76));
            }

            .primary-btn {
                background: linear-gradient(145deg, var(--primary), #298cff);
                color: #fff;
                border-color: transparent;
                box-shadow: 0 10px 22px rgba(21, 94, 239, 0.34);
            }

            .nav-btn:hover,
            .icon-btn:hover,
            .logout-btn:hover,
            .primary-btn:hover {
                transform: translateY(-2px);
                box-shadow: var(--shadow-sm);
            }

            .nav-btn:focus-visible,
            .icon-btn:focus-visible,
            .logout-btn:focus-visible,
            .primary-btn:focus-visible,
            .text-input:focus-visible {
                outline: none;
                border-color: var(--primary);
                box-shadow: 0 0 0 4px var(--focus);
            }

            .user-chip {
                border: 1px solid var(--border);
                background: var(--surface);
                border-radius: var(--radius-pill);
                padding: 7px 12px;
                font-size: 0.82rem;
                font-weight: 700;
                box-shadow: var(--shadow-xs);
            }

            .content-wrap {
                max-width: 1240px;
                margin: 0 auto;
                padding: var(--space-6) var(--space-4) 44px;
            }

            .page-stack {
                display: grid;
                gap: var(--space-5);
                animation: rise-in 0.4s ease-out;
            }

            .section-title-row {
                display: flex;
                justify-content: space-between;
                gap: var(--space-3);
                align-items: center;
                flex-wrap: wrap;
                margin-bottom: 2px;
            }

            .section-title-row h2,
            .section-title-row h3 {
                margin: 0;
                font-family: var(--font-display);
                letter-spacing: 0.005em;
                color: var(--text);
            }

            .section-title-row h2 {
                font-size: clamp(1.3rem, 2.1vw, 1.68rem);
                font-weight: 700;
            }

            .section-title-row h3 {
                font-size: clamp(1.02rem, 1.7vw, 1.2rem);
                font-weight: 700;
            }

            .muted {
                color: var(--muted);
                font-size: 0.83rem;
                line-height: 1.45;
            }

            .chip-row {
                display: flex;
                gap: var(--space-2);
                flex-wrap: wrap;
            }

            .chip {
                border: 1px solid var(--border);
                border-radius: var(--radius-pill);
                background: var(--primary-soft);
                padding: 6px 12px;
                font-size: 0.74rem;
                font-weight: 700;
                letter-spacing: 0.015em;
                color: var(--text-soft);
            }

            .stats-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: var(--space-4);
            }

            .two-col-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: var(--space-4);
            }

            .stat-label {
                font-size: 0.72rem;
                text-transform: uppercase;
                color: var(--muted);
                letter-spacing: 0.07em;
                margin-bottom: 6px;
                font-weight: 700;
            }

            .stat-value {
                font-size: clamp(1.35rem, 2.1vw, 1.72rem);
                font-weight: 800;
                line-height: 1.15;
                margin-bottom: 3px;
            }

            .progress-track {
                width: 100%;
                height: 12px;
                border-radius: var(--radius-pill);
                border: 1px solid var(--border);
                background: rgba(148, 163, 184, 0.16);
                overflow: hidden;
            }

            .progress-fill {
                height: 100%;
                border-radius: var(--radius-pill);
                background: linear-gradient(92deg, var(--primary), #27a8ff 56%, var(--secondary));
                box-shadow: inset 0 0 7px rgba(255, 255, 255, 0.28);
                transition: width 0.45s ease;
            }

            .personal-hero {
                border: 1px solid var(--border);
                border-radius: var(--radius-lg);
                padding: 20px;
                box-shadow: var(--shadow-md);
                background:
                    linear-gradient(148deg, rgba(21, 94, 239, 0.16), rgba(39, 168, 255, 0.1) 45%, rgba(14, 147, 132, 0.1)),
                    var(--card);
            }

            [data-theme="dark"] .personal-hero {
                box-shadow: 0 18px 36px rgba(6, 12, 28, 0.62);
            }

            .personal-hero-top {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: var(--space-4);
                margin-bottom: var(--space-4);
                flex-wrap: wrap;
            }

            .personal-amount {
                font-size: clamp(1.72rem, 3.1vw, 2.22rem);
                line-height: 1.06;
                font-weight: 800;
                margin: 4px 0;
                letter-spacing: -0.02em;
            }

            .personal-status-chip {
                border-radius: var(--radius-pill);
                font-weight: 700;
                font-size: 0.76rem;
                padding: 7px 12px;
                border: 1px solid rgba(0, 0, 0, 0.08);
                box-shadow: var(--shadow-xs);
            }

            .personal-progress-track {
                height: 14px;
                margin-bottom: var(--space-4);
            }

            .personal-meta-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: var(--space-3);
            }

            .personal-meta-card {
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                padding: 11px;
                background: rgba(255, 255, 255, 0.56);
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
            }

            [data-theme="dark"] .personal-meta-card {
                background: rgba(20, 34, 63, 0.58);
            }

            .split-row {
                display: flex;
                justify-content: space-between;
                gap: var(--space-3);
                flex-wrap: wrap;
            }

            .summary-list {
                display: grid;
                gap: var(--space-2);
            }

            .summary-item {
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                padding: 11px;
                background: rgba(148, 163, 184, 0.08);
                transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
            }

            .summary-item:hover {
                transform: translateY(-1px);
                border-color: rgba(21, 94, 239, 0.26);
                box-shadow: var(--shadow-sm);
            }

            .summary-k {
                font-size: 0.72rem;
                color: var(--muted);
                margin-bottom: 3px;
                letter-spacing: 0.015em;
            }

            .summary-v {
                font-size: 0.98rem;
                font-weight: 700;
                color: var(--text-soft);
            }

            .info-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
                gap: var(--space-3);
            }

            .info-card {
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                padding: 12px;
                background: rgba(148, 163, 184, 0.08);
                transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
            }

            .info-card:hover {
                transform: translateY(-2px);
                border-color: rgba(21, 94, 239, 0.28);
                box-shadow: var(--shadow-sm);
            }

            .info-k {
                font-size: 0.7rem;
                color: var(--muted);
                font-weight: 700;
                text-transform: uppercase;
                margin-bottom: 4px;
                letter-spacing: 0.08em;
            }

            .info-v {
                font-size: 0.88rem;
                font-weight: 700;
                color: var(--text-soft);
            }

            .list {
                display: grid;
                gap: var(--space-2);
            }

            .list-row {
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                background: rgba(148, 163, 184, 0.08);
                padding: 10px 11px;
                display: grid;
                grid-template-columns: auto 1fr auto;
                gap: var(--space-3);
                align-items: center;
                transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
            }

            .list-row:hover {
                transform: translateY(-1px);
                border-color: rgba(21, 94, 239, 0.24);
                box-shadow: var(--shadow-sm);
            }

            .timeline-list {
                display: grid;
                gap: var(--space-3);
            }

            .timeline-item {
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                padding: 12px;
                background: rgba(148, 163, 184, 0.08);
                transition: border-color 0.22s ease, background 0.22s ease, transform 0.22s ease;
            }

            .timeline-item:hover {
                border-color: rgba(21, 94, 239, 0.3);
                background: rgba(21, 94, 239, 0.08);
                transform: translateY(-1px);
            }

            .timeline-head {
                display: flex;
                justify-content: space-between;
                gap: var(--space-2);
                margin-bottom: 7px;
                flex-wrap: wrap;
            }

            .rooms-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                gap: var(--space-3);
            }

            .room-card {
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                padding: 12px;
                display: grid;
                gap: 5px;
                background: rgba(148, 163, 184, 0.08);
                transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
            }

            .room-card:hover {
                transform: translateY(-2px);
                border-color: rgba(21, 94, 239, 0.26);
                box-shadow: var(--shadow-sm);
            }

            .text-input {
                width: 100%;
                border: 1px solid var(--border);
                border-radius: 11px;
                background: var(--surface);
                color: var(--text);
                padding: 11px 12px;
                font: inherit;
                font-size: 0.9rem;
                outline: none;
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.36);
                transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
            }

            .text-input::placeholder {
                color: var(--muted);
            }

            .weather-head {
                display: flex;
                justify-content: space-between;
                gap: var(--space-3);
                align-items: center;
                flex-wrap: wrap;
                margin-bottom: var(--space-3);
            }

            .weather-main {
                display: flex;
                gap: var(--space-2);
                align-items: center;
                font-size: 1.18rem;
                font-weight: 700;
            }

            .weather-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(98px, 1fr));
                gap: var(--space-2);
            }

            .weather-day {
                border: 1px solid var(--border);
                border-radius: var(--radius-sm);
                text-align: center;
                padding: 10px 8px;
                font-size: 0.79rem;
                background: rgba(148, 163, 184, 0.08);
                transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
            }

            .weather-day:hover {
                transform: translateY(-2px);
                border-color: rgba(14, 147, 132, 0.34);
                box-shadow: var(--shadow-sm);
            }

            .login-wrap {
                min-height: 100vh;
                display: grid;
                place-items: center;
                padding: var(--space-4);
                position: relative;
                isolation: isolate;
            }

            .login-wrap::before,
            .login-wrap::after {
                content: "";
                position: absolute;
                border-radius: 50%;
                filter: blur(6px);
                z-index: -1;
                pointer-events: none;
            }

            .login-wrap::before {
                width: 220px;
                height: 220px;
                top: 12%;
                left: max(4%, calc(50% - 360px));
                background: radial-gradient(circle, rgba(21, 94, 239, 0.2), rgba(21, 94, 239, 0));
            }

            .login-wrap::after {
                width: 180px;
                height: 180px;
                right: max(5%, calc(50% - 340px));
                bottom: 14%;
                background: radial-gradient(circle, rgba(14, 147, 132, 0.22), rgba(14, 147, 132, 0));
            }

            .login-card {
                width: min(460px, 100%);
                border: 1px solid var(--border);
                border-radius: 20px;
                background: var(--card);
                padding: 26px;
                box-shadow: var(--shadow-lg);
                backdrop-filter: blur(14px) saturate(1.1);
                position: relative;
                overflow: hidden;
            }

            .login-card::before {
                content: "";
                position: absolute;
                inset: 0 0 auto 0;
                height: 4px;
                background: linear-gradient(90deg, var(--primary), #36a4ff, var(--secondary));
            }

            .login-head {
                display: grid;
                gap: 6px;
                margin-bottom: 18px;
            }

            .login-badge {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                width: fit-content;
                border-radius: var(--radius-pill);
                padding: 6px 11px;
                border: 1px solid var(--border);
                background: var(--surface-strong);
                font-size: 0.72rem;
                font-weight: 700;
                letter-spacing: 0.05em;
                text-transform: uppercase;
                color: var(--text-soft);
            }

            .login-badge-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: linear-gradient(135deg, var(--primary), var(--secondary));
                box-shadow: 0 0 0 5px rgba(21, 94, 239, 0.16);
            }

            .login-title {
                margin: 2px 0 0;
                font-family: var(--font-display);
                font-size: clamp(1.42rem, 3.8vw, 1.88rem);
                line-height: 1.1;
                letter-spacing: 0.01em;
                color: var(--text);
            }

            .login-subtitle {
                margin: 0;
                color: var(--muted);
                font-size: 0.88rem;
                line-height: 1.45;
            }

            .login-form {
                display: grid;
                gap: 12px;
            }

            .login-error {
                color: #dc2626;
                font-weight: 700;
                font-size: 0.82rem;
                margin-top: 2px;
                border: 1px solid rgba(220, 38, 38, 0.25);
                background: rgba(220, 38, 38, 0.08);
                border-radius: 10px;
                padding: 8px 10px;
            }

            [data-theme="dark"] .login-error {
                border-color: rgba(248, 113, 113, 0.35);
                background: rgba(185, 28, 28, 0.2);
                color: #fecaca;
            }

            .login-submit {
                width: 100%;
                margin-top: 4px;
                min-height: 40px;
                font-size: 0.9rem;
            }

            .login-footnote {
                margin: 4px 0 0;
                color: var(--muted);
                font-size: 0.76rem;
                text-align: center;
            }

            .stats-grid > div,
            .two-col-grid > div,
            .page-stack > div[style*="var(--card)"] {
                box-shadow: var(--shadow-md);
                border: 1px solid var(--border);
                backdrop-filter: blur(10px) saturate(1.1);
                transition: transform 0.24s ease, box-shadow 0.24s ease, border-color 0.24s ease;
            }

            .stats-grid > div:hover,
            .two-col-grid > div:hover,
            .page-stack > div[style*="var(--card)"]:hover {
                transform: translateY(-2px);
                border-color: rgba(21, 94, 239, 0.25);
                box-shadow: var(--shadow-lg);
            }

            .label {
                font-size: 0.79rem;
                font-weight: 700;
                color: var(--muted);
                display: block;
                margin-bottom: 6px;
                letter-spacing: 0.02em;
            }

            @keyframes rise-in {
                from {
                    opacity: 0;
                    transform: translateY(6px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes glow-pulse {
                0%, 100% {
                    box-shadow: 0 8px 18px rgba(21, 94, 239, 0.34);
                }
                50% {
                    box-shadow: 0 10px 24px rgba(45, 212, 191, 0.44);
                }
            }

            @media (prefers-reduced-motion: reduce) {
                *, *::before, *::after {
                    animation: none !important;
                    transition: none !important;
                    scroll-behavior: auto !important;
                }
            }

            @media (max-width: 1024px) {
                .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                .top-bar { padding-left: var(--space-4); padding-right: var(--space-4); }
                .personal-meta-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            }

            @media (max-width: 860px) {
                .two-col-grid { grid-template-columns: 1fr; }
            }

            @media (max-width: 560px) {
                .stats-grid { grid-template-columns: 1fr; }
                .top-bar { padding: 10px 12px; }
                .content-wrap { padding: 16px 12px 30px; }
                .nav-btn,
                .icon-btn,
                .logout-btn,
                .primary-btn { padding: 8px 10px; font-size: 0.8rem; }
                .personal-hero { padding: 14px; border-radius: 14px; }
                .personal-meta-grid { grid-template-columns: 1fr; }
                .personal-meta-card { padding: 10px; }
                .chip { font-size: 0.7rem; padding: 5px 9px; }
                .muted { font-size: 0.8rem; }
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
                <a
                    href="#/"
                    className="brand"
                    style={{ cursor: "pointer", textDecoration: "none" }}
                    aria-label="Go to homepage"
                >
                    <div className="brand-dot">❤️   </div>
                    <span>{TRIP_BRAND} Trip Dashboard</span>
                </a>

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
                <div className="login-head">
                    <h1 className="login-title">Kerala Trip 2026</h1>
                    <p className="login-subtitle">{TRIP_BRAND} Member Portal</p>
                </div>

                <form onSubmit={onSubmit} className="login-form">
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
                        <div className="login-error">
                            Invalid credentials.
                        </div>
                    )}

                    <button className="primary-btn login-submit" type="submit">
                        Sign In
                    </button>
                </form>

                <p className="login-footnote">Use your assigned name and password to continue.</p>
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
    const [personalDetails, setPersonalDetails] = useState([]);
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

    const currentProfile = useMemo(() => {
        if (!loggedInUser?.name) return null;
        const target = String(loggedInUser.name).trim().toLowerCase();
        return (
            personalDetails.find((item) => String(item.name).trim().toLowerCase() === target) || null
        );
    }, [loggedInUser, personalDetails]);

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

        const getCellFormatted = (row, index) => {
            const cell = row?.c?.[index];
            if (!cell) return "";
            return cell.f ?? cell.v ?? "";
        };

        const load = async () => {
            try {
                const [uS, pRaw, tS, eS, aS, tlS, rS, iS, cS, pdS] = await Promise.all([
                    fetchSheet(USERS_SHEET),
                    fetchSheetText(PAYMENTS_SHEET),
                    fetchSheet(TRIP_SHEET),
                    fetchSheet(EXPENSES_SHEET),
                    fetchSheet(ANNOUNCEMENTS_SHEET),
                    fetchSheet(TIMELINE_SHEET),
                    fetchSheet(ROOMS_SHEET),
                    fetchSheet(INFO_SHEET),
                    fetchSheet(CONFIG_SHEET),
                    fetchSheet(PERSONAL_DETAILS_SHEET),
                ]);

                const loadedUsers = (uS.rows || [])
                    .map((row) => ({
                        name: String(getCell(row, 0)).trim(),
                        password: String(getCell(row, 1)).trim(),
                        role: String(getCell(row, 2)).trim() || "member",
                    }))
                    .filter((u) => u.name && u.password && u.name.toLowerCase() !== "name");
                setUsers(loadedUsers);

                const { payments, paymentEntries } = pRaw
                    ? parseGoogleSheetResponse(pRaw)
                    : { payments: [], paymentEntries: [] };

                const loadedPayments = paymentEntries
                    .map((entry) => ({
                        name: String(entry.name || "").trim(),
                        amount: parseFloat(entry.amount) || 0,
                        date: entry.date,
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

                const personalRows = pdS.rows || [];
                let loadedPersonalDetails = [];

                if (personalRows.length > 0) {
                    const headers = (personalRows[0]?.c || []).map((cell) => normalizeHeader(cell?.v ?? cell?.f ?? ""));
                    const requiredHeaderSet = ["name", "phone", "phonenumber", "email", "dob", "dateofbirth", "age", "gender", "sex"];
                    const hasHeaderRow = headers.some((h) => requiredHeaderSet.includes(h));
                    const dataRows = hasHeaderRow ? personalRows.slice(1) : personalRows;

                    const findHeaderIndex = (candidates) =>
                        headers.findIndex((header) => candidates.includes(header));

                    const colName = hasHeaderRow ? findHeaderIndex(["name", "fullname", "studentname", "membername"]) : 0;
                    const colPhone = hasHeaderRow ? findHeaderIndex(["phone", "phonenumber", "mobile", "mobilenumber", "contact", "contactnumber"]) : 1;
                    const colEmail = hasHeaderRow ? findHeaderIndex(["email", "emailid", "mail"]) : 2;
                    const colDob = hasHeaderRow ? findHeaderIndex(["dob", "dateofbirth", "birthdate", "birthday"]) : 3;
                    const colAge = hasHeaderRow ? findHeaderIndex(["age"]) : 4;
                    const colGender = hasHeaderRow ? findHeaderIndex(["gender", "sex"]) : 5;

                    loadedPersonalDetails = dataRows
                        .map((row) => ({
                            name: String(getCell(row, colName >= 0 ? colName : 0)).trim(),
                            phone: String(getCell(row, colPhone >= 0 ? colPhone : 1)).trim(),
                            email: String(getCell(row, colEmail >= 0 ? colEmail : 2)).trim(),
                            dob: String(getCellFormatted(row, colDob >= 0 ? colDob : 3)).trim(),
                            age: String(getCell(row, colAge >= 0 ? colAge : 4)).trim(),
                            gender: String(getCell(row, colGender >= 0 ? colGender : 5)).trim(),
                        }))
                        .filter((item) => item.name);
                }

                setPersonalDetails(loadedPersonalDetails);

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
                                profile={currentProfile}
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
