import React, { useMemo, useState } from "react";

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

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatShortDate = (value) => {
    const date = toDate(value);
    if (!date) return "-";
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const weatherCodeToIcon = (code) => {
    if (code === 0) return "☀";
    if ([1, 2].includes(code)) return "⛅";
    if (code === 3) return "☁";
    if ([45, 48].includes(code)) return "🌫";
    if ([51, 53, 55, 56, 57].includes(code)) return "🌦";
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "🌧";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "🌨";
    if ([95, 96, 99].includes(code)) return "⛈";
    return "🌤";
};

const cardStyle = {
    border: "1px solid var(--border)",
    borderRadius: 14,
    background: "var(--card)",
    padding: 14,
};

export default function TripOpsPage({ user, timeline, rooms, weather, payments, tripInfo, showCard }) {
    const [search, setSearch] = useState("");

    const perHead = Number(tripInfo.per_head) || 0;

    const visibleRooms = useMemo(() => {
        if (user.role === "admin") return rooms;
        return rooms.filter((r) => r.name === user.name);
    }, [rooms, user.name, user.role]);

    const filteredMembers = useMemo(() => {
        if (user.role !== "admin") return [];
        const q = search.trim().toLowerCase();
        return [...payments]
            .filter((p) => (q ? p.name.toLowerCase().includes(q) : true))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [payments, search, user.role]);

    const weatherCards = useMemo(() => {
        if (!weather?.daily?.time) return [];
        return weather.daily.time.slice(0, 5).map((t, idx) => ({
            date: t,
            icon: weatherCodeToIcon((weather.daily.weather_code || [])[idx]),
            max: (weather.daily.temperature_2m_max || [])[idx],
            min: (weather.daily.temperature_2m_min || [])[idx],
        }));
    }, [weather]);

    return (
        <div className="page-stack">
            <div className="section-title-row">
                <h2>Trip Operations</h2>
                <span className="muted">Timeline, rooms, weather and members</span>
            </div>

            {showCard("Timeline") && (
                <div style={cardStyle}>
                    <h3 style={{ marginBottom: 10 }}>Trip Timeline</h3>
                    {timeline.length === 0 ? (
                        <div className="muted">No timeline entries available.</div>
                    ) : (
                        <div className="timeline-list">
                            {timeline.map((item, idx) => (
                                <div key={`${item.day}-${item.title}-${idx}`} className="timeline-item">
                                    <div className="timeline-head">
                                        <strong>{item.day || `Day ${idx + 1}`}</strong>
                                        <span className="muted">{formatShortDate(item.date)}</span>
                                    </div>
                                    <div style={{ fontWeight: 700 }}>{item.title || "Activity"}</div>
                                    <div className="muted">{item.description || "Details will be updated."}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {showCard("Weather") && weather?.current && (
                <div style={cardStyle}>
                    <h3 style={{ marginBottom: 10 }}>Weather Outlook</h3>
                    <div className="weather-head">
                        <div className="weather-main">
                            <span>{weatherCodeToIcon(weather.current.weather_code)}</span>
                            <strong>{Math.round(weather.current.temperature_2m)}°C</strong>
                        </div>
                        <span className="muted">
                            Feels like {Math.round(weather.current.apparent_temperature)}°C · Rain {weather.current.rain || 0} mm
                        </span>
                    </div>
                    <div className="weather-grid">
                        {weatherCards.map((w) => (
                            <div key={w.date} className="weather-day">
                                <div>{formatShortDate(w.date)}</div>
                                <div style={{ fontSize: 18 }}>{w.icon}</div>
                                <div>{Math.round(w.max || 0)}° / {Math.round(w.min || 0)}°</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showCard("Room Allocation") && (
                <div style={cardStyle}>
                    <h3 style={{ marginBottom: 10 }}>Room Allocation</h3>
                    {visibleRooms.length === 0 ? (
                        <div className="muted">No room mapping found for this user.</div>
                    ) : (
                        <div className="rooms-grid">
                            {visibleRooms.map((room, idx) => (
                                <div className="room-card" key={`${room.name}-${room.roomNo}-${idx}`}>
                                    <strong>Room {room.roomNo || "-"}</strong>
                                    <span><strong>Name:</strong> {room.name || "-"}</span>
                                    <span><strong>Roommates:</strong> {room.roommates || "-"}</span>
                                    <span><strong>Bus Seat:</strong> {room.busSeat || "-"}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {showCard("Member Tracker") && user.role === "admin" && (
                <div style={cardStyle}>
                    <div className="section-title-row" style={{ marginBottom: 10 }}>
                        <h3>Member Tracker</h3>
                        <span className="chip">{payments.length} members</span>
                    </div>
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search member"
                        className="text-input"
                    />
                    <div className="list" style={{ marginTop: 10 }}>
                        {filteredMembers.map((member, idx) => {
                            const status = getStatusMeta(member.paid, perHead);
                            return (
                                <div className="list-row" key={`${member.name}-${idx}`}>
                                    <span>{member.name}</span>
                                    <span style={{ color: status.color, fontWeight: 700 }}>
                                        {money(member.paid)} · {status.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
