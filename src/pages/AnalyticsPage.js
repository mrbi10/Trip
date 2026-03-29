import React, { useMemo } from "react";
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
    LineChart,
    Line,
} from "recharts";

const CHART_COLORS = ["#2563eb", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const money = (amt) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(Number(amt) || 0);

const toDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const formatShortDate = (value) => {
    const date = toDate(value);
    if (!date) return "-";
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const cardStyle = {
    border: "1px solid var(--border)",
    borderRadius: 14,
    background: "var(--card)",
    padding: 14,
};

export default function AnalyticsPage({ payments, paymentEntries, expenses, tripInfo, showCard }) {
    const perHead = Number(tripInfo.per_head) || 0;

    const totalPaid = useMemo(() => payments.reduce((sum, p) => sum + p.paid, 0), [payments]);
    const totalPending = useMemo(
        () => payments.reduce((sum, p) => sum + Math.max(0, perHead - p.paid), 0),
        [payments, perHead]
    );
    const totalSpent = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);

    const statusData = useMemo(() => {
        const paid = payments.filter((p) => p.paid >= perHead && perHead > 0).length;
        const partial = payments.filter((p) => p.paid > 0 && p.paid < perHead).length;
        const pending = payments.filter((p) => p.paid <= 0).length;

        return [
            { name: "Paid", value: paid, color: "#10b981" },
            { name: "Partial", value: partial, color: "#f59e0b" },
            { name: "Pending", value: pending, color: "#ef4444" },
        ].filter((d) => d.value > 0);
    }, [payments, perHead]);

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
        const group = new Map();
        expenses.forEach((e) => {
            const key = e.category || "Other";
            group.set(key, (group.get(key) || 0) + e.amount);
        });

        return [...group.entries()]
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount);
    }, [expenses]);

    const contributionStats = useMemo(() => {
        const totalMembers = payments.length;
        const fullyPaid = payments.filter((p) => p.paid >= perHead && perHead > 0).length;
        const partial = payments.filter((p) => p.paid > 0 && p.paid < perHead).length;
        const pending = payments.filter((p) => p.paid <= 0).length;
        const averagePaid = totalMembers ? totalPaid / totalMembers : 0;
        const completionRate = totalMembers ? Math.round((fullyPaid / totalMembers) * 100) : 0;

        return {
            totalMembers,
            fullyPaid,
            partial,
            pending,
            averagePaid,
            completionRate,
        };
    }, [payments, perHead, totalPaid]);

    const showPayment = showCard("Payment Analytics");
    const showExpense = showCard("Expense Analytics");
    const showLeaderboard = showCard("Leaderboard");

    return (
        <div className="page-stack">
            <div className="section-title-row">
                <h2>Analytics</h2>
                <div className="chip-row">
                    <span className="chip">Paid {money(totalPaid)}</span>
                    <span className="chip">Pending {money(totalPending)}</span>
                    <span className="chip">Spent {money(totalSpent)}</span>
                </div>
            </div>

            {showPayment && (
                <div className="two-col-grid">
                    <div style={cardStyle}>
                        <h3 style={{ marginBottom: 10 }}>Payment Distribution</h3>
                        <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                                <Pie data={statusData} dataKey="value" innerRadius={54} outerRadius={84}>
                                    {statusData.map((entry, i) => (
                                        <Cell key={`${entry.name}-${i}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(v) => [v, "Members"]} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div style={cardStyle}>
                        <h3 style={{ marginBottom: 10 }}>Daily Payment Trend</h3>
                        <ResponsiveContainer width="100%" height={260}>
                            <LineChart data={paymentTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} />
                                <Tooltip formatter={(v) => [money(v), "Collected"]} />
                                <Line type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            <div className="two-col-grid">
                {showExpense && (
                    <div style={cardStyle}>
                        <h3 style={{ marginBottom: 10 }}>Expense Category Breakdown</h3>
                        {categoryData.length === 0 ? (
                            <div className="muted">No expense entries yet.</div>
                        ) : (
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={categoryData.slice(0, 8)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted)" }} />
                                    <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} />
                                    <Tooltip formatter={(v) => [money(v), "Spent"]} />
                                    <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                                        {categoryData.map((entry, i) => (
                                            <Cell key={`${entry.name}-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                )}

                {showLeaderboard && (
                    <div style={cardStyle}>
                        <h3 style={{ marginBottom: 10 }}>Contribution Snapshot</h3>
                        {contributionStats.totalMembers === 0 ? (
                            <div className="muted">No payment entries yet.</div>
                        ) : (
                            <div className="list">
                                <div className="list-row">
                                    <span className="muted">Members</span>
                                    <strong>{contributionStats.totalMembers}</strong>
                                </div>
                                <div className="list-row">
                                    <span className="muted">Fully Paid</span>
                                    <strong>{contributionStats.fullyPaid}</strong>
                                </div>
                                <div className="list-row">
                                    <span className="muted">Partial</span>
                                    <strong>{contributionStats.partial}</strong>
                                </div>
                                <div className="list-row">
                                    <span className="muted">Pending</span>
                                    <strong>{contributionStats.pending}</strong>
                                </div>
                                <div className="list-row">
                                    <span className="muted">Average Paid</span>
                                    <strong>{money(contributionStats.averagePaid)}</strong>
                                </div>
                                <div className="list-row">
                                    <span className="muted">Completion Rate</span>
                                    <strong>{contributionStats.completionRate}%</strong>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {!showPayment && !showExpense && !showLeaderboard && (
                <div style={cardStyle}>
                    <div className="muted">All analytics sections are hidden in CONFIG.</div>
                </div>
            )}
        </div>
    );
}
