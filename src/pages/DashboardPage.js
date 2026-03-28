import React, { useMemo } from "react";

const EXPECTED_MIN_MEMBERS = 40;

const money = (amt) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(Number(amt) || 0);

const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const cardStyle = {
    border: "1px solid var(--border)",
    borderRadius: 14,
    background: "var(--card)",
    padding: 14,
};

export default function DashboardPage({
    user,
    users,
    payments,
    paymentEntries,
    tripInfo,
    expenses,
    infoEntries,
    announcements,
    lastUpdated,
    showCard,
}) {
    const perHead = Number(tripInfo.per_head) || 0;
    const memberCount = users.length;
    const targetMembers = Math.max(memberCount, EXPECTED_MIN_MEMBERS);
    const targetAmount = targetMembers * perHead;

    const totalPaid = useMemo(() => payments.reduce((sum, p) => sum + p.paid, 0), [payments]);
    const totalSpent = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);

    const myPaid = payments.find((p) => p.name === user.name)?.paid || 0;
    const myPending = Math.max(0, perHead - myPaid);
    const myPct = perHead > 0 ? Math.min((myPaid / perHead) * 100, 100) : 0;
    const groupPct = targetAmount > 0 ? Math.min((totalPaid / targetAmount) * 100, 100) : 0;

    const myEntries = useMemo(
        () => paymentEntries.filter((entry) => entry.name === user.name),
        [paymentEntries, user.name]
    );

    const lastPayment = useMemo(() => {
        if (myEntries.length === 0) return null;

        return [...myEntries].sort((a, b) => {
            const ta = new Date(a.date).getTime() || 0;
            const tb = new Date(b.date).getTime() || 0;
            return tb - ta;
        })[0];
    }, [myEntries]);

    const fullyPaidCount = useMemo(
        () => payments.filter((p) => p.paid >= perHead && perHead > 0).length,
        [payments, perHead]
    );

    const latestAnnouncement = announcements[0] || null;
    const visibleInfo = infoEntries.slice(0, 8);

    const insights = [
        `Fully paid members: ${fullyPaidCount}/${memberCount || 1}`,
        `Total collected: ${money(totalPaid)}`,
        `Total spent: ${money(totalSpent)}`,
    ];

    const stats = [
        { label: "Trip Budget", value: money(Number(tripInfo.total_cost) || 0), sub: "From trip sheet" },
        { label: "Per Head", value: money(perHead), sub: "Expected contribution" },
        { label: "Collected", value: money(totalPaid), sub: `${groupPct.toFixed(1)}% of target` },
        { label: "Spent", value: money(totalSpent), sub: "Total expenses logged" },
    ];

    return (
        <div className="page-stack">
            <div className="section-title-row">
                <h2>Dashboard</h2>
                {lastUpdated && <span className="muted">Updated {lastUpdated}</span>}
            </div>

            {showCard("Personal Dashboard") && (
                <div className="personal-hero">
                    <div className="personal-hero-top">
                        <div>
                            <div className="stat-label">Personal Payment Summary</div>
                            <div className="personal-amount">{money(myPaid)}</div>
                            <div className="muted">
                                {myPending > 0
                                    ? `Pending ${money(myPending)} to complete your share`
                                    : "You have completed your share"}
                            </div>
                        </div>
                        <div className="personal-status-chip" style={{ background: myPending > 0 ? "#ffedd5" : "#dcfce7", color: myPending > 0 ? "#9a3412" : "#14532d" }}>
                            {myPending > 0 ? "Payment Pending" : "Fully Paid"}
                        </div>
                    </div>

                    <div className="progress-track personal-progress-track">
                        <div className="progress-fill" style={{ width: `${myPct}%` }} />
                    </div>

                    <div className="personal-meta-grid">
                        <div className="personal-meta-card">
                            <div className="summary-k">Completion</div>
                            <div className="summary-v">{myPct.toFixed(1)}%</div>
                        </div>
                        <div className="personal-meta-card">
                            <div className="summary-k">Paid / Required</div>
                            <div className="summary-v">{money(myPaid)} / {money(perHead)}</div>
                        </div>
                        <div className="personal-meta-card">
                            <div className="summary-k">Transactions Made</div>
                            <div className="summary-v">{myEntries.length}</div>
                        </div>
                        <div className="personal-meta-card">
                            <div className="summary-k">Last Payment</div>
                            <div className="summary-v" style={{ fontSize: "0.9rem" }}>
                                {lastPayment
                                    ? `${money(lastPayment.amount)} on ${formatDateTime(lastPayment.date)}`
                                    : "No payments yet"}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showCard("Trip Budget Stats") && (
                <div className="stats-grid">
                    {stats.map((s) => (
                        <div key={s.label} style={cardStyle}>
                            <div className="stat-label">{s.label}</div>
                            <div className="stat-value">{s.value}</div>
                            <div className="muted">{s.sub}</div>
                        </div>
                    ))}
                </div>
            )}

            {showCard("Group Progress") && (
                <div style={cardStyle}>
                    <div className="section-title-row" style={{ marginBottom: 8 }}>
                        <h3>Group Progress</h3>
                        <span className="chip">Target {money(targetAmount)}</span>
                    </div>
                    <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${groupPct}%` }} />
                    </div>
                    <div className="split-row" style={{ marginTop: 8 }}>
                        <span className="muted">Collected {money(totalPaid)}</span>
                        <span className="muted">Expected members {targetMembers}</span>
                    </div>
                </div>
            )}

            <div className="two-col-grid">
                {showCard("Announcements") && (
                    <div style={cardStyle}>
                        <h3 style={{ marginBottom: 10 }}>Announcement Highlight</h3>
                        {latestAnnouncement ? (
                            <div>
                                <div style={{ fontWeight: 700, marginBottom: 8 }}>{latestAnnouncement.message}</div>
                                <div className="muted">{formatDateTime(latestAnnouncement.date)}</div>
                            </div>
                        ) : (
                            <div className="muted">No active announcements.</div>
                        )}
                    </div>
                )}

                <div style={cardStyle}>
                    <h3 style={{ marginBottom: 10 }}>Group Payment Snapshot</h3>
                    <div className="summary-list">
                        <div className="summary-item">
                            <div className="summary-k">Members Fully Paid</div>
                            <div className="summary-v">{fullyPaidCount} / {memberCount || 1}</div>
                        </div>
                        <div className="summary-item">
                            <div className="summary-k">Collection Progress</div>
                            <div className="summary-v">{groupPct.toFixed(1)}%</div>
                        </div>
                        <div className="summary-item">
                            <div className="summary-k">Total Collected</div>
                            <div className="summary-v">{money(totalPaid)}</div>
                        </div>
                    </div>
                </div>
            </div>

            {showCard("Smart Insights") && (
                <div style={cardStyle}>
                    <h3 style={{ marginBottom: 10 }}>Smart Insights</h3>
                    <div className="summary-list">
                        {insights.map((item) => (
                            <div key={item} className="summary-item">
                                <div className="summary-v" style={{ fontSize: "0.92rem" }}>{item}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showCard("Important Info") && (
                <div style={cardStyle}>
                    <h3 style={{ marginBottom: 10 }}>Important Info Highlights</h3>
                    {visibleInfo.length === 0 ? (
                        <div className="muted">No important info available.</div>
                    ) : (
                        <div className="info-grid">
                            {visibleInfo.map((item, idx) => (
                                <div key={`${item.key}-${idx}`} className="info-card">
                                    <div className="info-k">{item.key}</div>
                                    <div className="info-v">{item.value}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
