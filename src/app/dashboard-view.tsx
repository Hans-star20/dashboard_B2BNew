"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type TicketStatus = "Open" | "Closed";
type Category = "HSI" | "DATIN" | "WIFI" | "SQUAT" | "UNCLASSIFIED";
type IconName =
  | "grid"
  | "ticket"
  | "users"
  | "chart"
  | "sync"
  | "shield"
  | "settings"
  | "search"
  | "bell"
  | "chevron"
  | "menu"
  | "close"
  | "arrow"
  | "clock"
  | "check"
  | "activity"
  | "wrench"
  | "calendar"
  | "filter"
  | "reset"
  | "external"
  | "alert";

type Ticket = {
  incident: string;
  reportedDate: string;
  serviceType: string;
  category: Category;
  sto: string;
  technician: string;
  status: TicketStatus;
  priority: "Tinggi" | "Sedang" | "Rendah";
};

type SyncRun = {
  status: "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED";
  startedAt: string;
  finishedAt: string | null;
  rowsRead: number | null;
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;
  failureDetails: { row: number; code: string }[] | null;
  errorSummary: string | null;
  errorCode: string | null;
};

function formatJakartaDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

const tickets: Ticket[] = [
  {
    incident: "INC-2026-08421",
    reportedDate: "05 Nov 2026, 09:42",
    serviceType: "Internet Dedicated",
    category: "DATIN",
    sto: "STO Gambir",
    technician: "Rizky Pratama",
    status: "Open",
    priority: "Tinggi",
  },
  {
    incident: "INC-2026-08418",
    reportedDate: "05 Nov 2026, 09:18",
    serviceType: "IndiHome",
    category: "HSI",
    sto: "STO Kebayoran",
    technician: "Dimas Saputra",
    status: "Open",
    priority: "Sedang",
  },
  {
    incident: "INC-2026-08402",
    reportedDate: "05 Nov 2026, 08:51",
    serviceType: "Managed WiFi",
    category: "WIFI",
    sto: "STO Bandung",
    technician: "Andi Wijaya",
    status: "Closed",
    priority: "Rendah",
  },
  {
    incident: "INC-2026-08397",
    reportedDate: "05 Nov 2026, 08:26",
    serviceType: "SQUAT Corporate",
    category: "SQUAT",
    sto: "STO Surabaya",
    technician: "Fajar Hidayat",
    status: "Open",
    priority: "Tinggi",
  },
  {
    incident: "INC-2026-08381",
    reportedDate: "05 Nov 2026, 07:54",
    serviceType: "Metro Ethernet",
    category: "DATIN",
    sto: "STO Semarang",
    technician: "Nadia Putri",
    status: "Closed",
    priority: "Sedang",
  },
  {
    incident: "INC-2026-08374",
    reportedDate: "04 Nov 2026, 23:16",
    serviceType: "IndiHome",
    category: "HSI",
    sto: "STO Medan",
    technician: "Budi Santoso",
    status: "Open",
    priority: "Sedang",
  },
  {
    incident: "INC-2026-08359",
    reportedDate: "04 Nov 2026, 22:48",
    serviceType: "Layanan belum dipetakan",
    category: "UNCLASSIFIED",
    sto: "STO Makassar",
    technician: "Siti Rahma",
    status: "Closed",
    priority: "Rendah",
  },
];

const categories: Category[] = [
  "HSI",
  "DATIN",
  "WIFI",
  "SQUAT",
  "UNCLASSIFIED",
];

const navigation: { label: string; icon: IconName; section?: string }[] = [
  { label: "Dashboard", icon: "grid", section: "UTAMA" },
  { label: "Monitoring Tiket", icon: "ticket" },
  { label: "Data Teknisi", icon: "users", section: "OPERASIONAL" },
  { label: "Evaluasi Teknisi", icon: "chart" },
  { label: "Sinkronisasi Data", icon: "sync", section: "PENGELOLAAN" },
  { label: "Manajemen Pengguna", icon: "shield" },
  { label: "Pengaturan", icon: "settings" },
];

function Icon({
  name,
  size = 18,
}: {
  name: IconName;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  const shapes: Record<IconName, ReactNode> = {
    grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
    ticket: <><path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v3a2.5 2.5 0 0 0 0 5v3a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-3a2.5 2.5 0 0 0 0-5z" /><path d="M9 8v1m0 3v1m0 3v1" /></>,
    users: <><path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" /><circle cx="10" cy="8" r="3.5" /><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M17 15h1.5a3.5 3.5 0 0 1 3.5 3.5V20" /></>,
    chart: <><path d="M4 19.5h16" /><path d="M6.5 16v-4m5 4V7m5 9v-6" /><circle cx="6.5" cy="10" r="1" /><circle cx="11.5" cy="5" r="1" /><circle cx="16.5" cy="8" r="1" /></>,
    sync: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.7 9a7 7 0 0 1 11.6-2L20 12M4 12l2.7 5a7 7 0 0 0 11.6-2" /></>,
    shield: <><path d="M12 3 19 6v5c0 4.5-2.9 8-7 10-4.1-2-7-5.5-7-10V6z" /><path d="m9 12 2 2 4-4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.1.9-1.6 2.8-1.4-.5a8 8 0 0 1-1.5.9l-.2 1.5h-3.2l-.2-1.5a8 8 0 0 1-1.5-.9l-1.4.5L8 16l1.1-.9a7 7 0 0 1 0-1.8L8 12.4l1.6-2.8 1.4.5a8 8 0 0 1 1.5-.9l.2-1.5h3.2l.2 1.5a8 8 0 0 1 1.5.9l1.4-.5 1.6 2.8-1.1.9a7 7 0 0 1-.1 1.7Z" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4 4" /></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
    wrench: <><path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3z" /></>,
    calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M7.5 3v4M16.5 3v4M3.5 10h17" /></>,
    filter: <><path d="M4 6h16M7 12h10m-7 6h4" /></>,
    reset: <><path d="M3 11a9 9 0 1 1 2.6 6.4" /><path d="M3 4v7h7" /></>,
    external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></>,
    alert: <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v5m0 3h.01" /></>,
  };

  return <svg {...common}>{shapes[name]}</svg>;
}

function MetricCard({
  title,
  value,
  note,
  icon,
  tone,
  trend,
}: {
  title: string;
  value: string;
  note: string;
  icon: IconName;
  tone: string;
  trend?: string;
}) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span className={`metric-icon ${tone}`}><Icon name={icon} size={19} /></span>
        {trend && <span className="metric-trend"><span>↗</span> {trend}</span>}
      </div>
      <p className="metric-title">{title}</p>
      <div className="metric-bottom">
        <strong>{value}</strong>
        <span>{note}</span>
      </div>
    </article>
  );
}

function MonthlyChart() {
  const values = [42, 57, 48, 69, 61, 77, 67, 83, 72, 94, 80, 104];
  const points = values.map((value, index) => `${38 + index * 54},${150 - value}`).join(" ");
  const areaPoints = `38,150 ${points} 632,150`;

  return (
    <div className="line-chart">
      <div className="chart-y-labels" aria-hidden="true">
        <span>120</span><span>90</span><span>60</span><span>30</span><span>0</span>
      </div>
      <div className="chart-plot">
        <div className="chart-gridlines"><i /><i /><i /><i /><i /></div>
        <svg viewBox="0 0 670 170" role="img" aria-label="Grafik tren tiket Januari hingga Desember">
          <defs>
            <linearGradient id="ticketArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity=".18" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={areaPoints} fill="url(#ticketArea)" />
          <polyline points={points} fill="none" stroke="#2864df" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {values.map((value, index) => (
            <circle key={index} cx={38 + index * 54} cy={150 - value} r="3.5" fill="#fff" stroke="#2864df" strokeWidth="2.5" />
          ))}
        </svg>
        <div className="chart-x-labels">
          {["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"].map((month) => <span key={month}>{month}</span>)}
        </div>
      </div>
    </div>
  );
}

function CategoryChart() {
  return (
    <div className="category-chart-content">
      <div className="donut-wrap">
        <div className="donut"><div className="donut-center"><strong>1.284</strong><span>Total tiket</span></div></div>
      </div>
      <div className="category-legend">
        {[
          ["HSI", "42%", "#2864df", "539 tiket"],
          ["DATIN", "26%", "#22a68a", "334 tiket"],
          ["WIFI", "18%", "#f4a62a", "231 tiket"],
          ["SQUAT", "9%", "#8b72dc", "116 tiket"],
          ["UNCLASSIFIED", "5%", "#9aa7b8", "64 tiket"],
        ].map(([label, percent, color, count]) => (
          <div className="legend-row" key={label}>
            <span className="legend-name"><i style={{ backgroundColor: color }} />{label}</span>
            <span className="legend-count">{count}</span>
            <strong>{percent}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`status-badge ${status.toLowerCase()}`}><i />{status}</span>;
}

export default function DashboardView({
  user,
}: {
  user: { name: string; email: string; role: string; canSync: boolean };
}) {
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [category, setCategory] = useState("All");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [syncRun, setSyncRun] = useState<SyncRun | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState("");

  const loadSyncStatus = useCallback(async () => {
    setSyncLoading(true);
    setSyncError("");
    try {
      const response = await fetch("/api/sheets-sync", { cache: "no-store" });
      if (!response.ok) throw new Error("Status sinkronisasi tidak dapat dimuat.");
      const payload = await response.json() as { latest: SyncRun | null };
      setSyncRun(payload.latest);
    } catch {
      setSyncError("Status sinkronisasi tidak dapat dimuat. Silakan coba lagi.");
    } finally {
      setSyncLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeNav === "Sinkronisasi Data" && user.canSync) void loadSyncStatus();
  }, [activeNav, user.canSync, loadSyncStatus]);

  const runSyncNow = async () => {
    if (!window.confirm("Jalankan sinkronisasi tiket dari Google Sheets sekarang? Spreadsheet hanya akan dibaca.")) {
      return;
    }
    setSyncLoading(true);
    setSyncError("");
    try {
      const response = await fetch("/api/sheets-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const payload = await response.json() as {
        result?: { errorSummary: string | null };
        error?: string;
      };
      if (!payload.result) throw new Error(payload.error ?? "Sinkronisasi tidak dapat dijalankan.");
      await loadSyncStatus();
      if (!response.ok) setSyncError(payload.result.errorSummary ?? "Sinkronisasi gagal.");
    } catch {
      await loadSyncStatus();
      setSyncError("Sinkronisasi gagal dihubungi. Periksa status terbaru sebelum mencoba kembali.");
    } finally {
      setSyncLoading(false);
    }
  };

  const filteredTickets = useMemo(() => tickets.filter((ticket) => {
    const matchesIncident = ticket.incident.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = status === "All" || ticket.status === status;
    const matchesCategory = category === "All" || ticket.category === category;
    return matchesIncident && matchesStatus && matchesCategory;
  }), [category, query, status]);

  const resetFilters = () => {
    setQuery("");
    setStatus("All");
    setCategory("All");
  };

  const dashboardActive = activeNav === "Dashboard";

  return (
    <div className="app-shell">
      {mobileMenuOpen && <button className="sidebar-backdrop" aria-label="Tutup menu" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><span /><span /><span /><span /></div>
          <div><strong>B2B<span>Dashboard</span></strong><small>NETWORK OPERATIONS</small></div>
          <button className="sidebar-close" aria-label="Tutup menu" onClick={() => setMobileMenuOpen(false)}><Icon name="close" /></button>
        </div>

        <nav className="side-nav" aria-label="Navigasi utama">
          {navigation.filter((item) => item.label !== "Sinkronisasi Data" || user.canSync).map((item) => (
            <div key={item.label}>
              {item.section && <p className="nav-section">{item.section}</p>}
              <button
                className={`nav-link ${activeNav === item.label ? "active" : ""}`}
                onClick={() => {
                  setActiveNav(item.label);
                  setMobileMenuOpen(false);
                }}
              >
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
                {item.label === "Monitoring Tiket" && <span className="nav-count">12</span>}
              </button>
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="support-card">
            <div className="support-icon"><Icon name="activity" size={17} /></div>
            <strong>Butuh bantuan?</strong>
            <p>Tim support siap membantu operasional Anda.</p>
            <button onClick={() => setActiveNav("Pusat Bantuan")}>Hubungi support <Icon name="arrow" size={14} /></button>
          </div>
          <div className="sidebar-version"><span className="online-dot" /> Sistem beroperasi normal <span>v1.0.0</span></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu-button" aria-label="Buka menu" onClick={() => setMobileMenuOpen(true)}><Icon name="menu" /></button>
            <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{activeNav}</strong></div>
          </div>
          <div className="topbar-actions">
            <label className="global-search">
              <Icon name="search" size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nomor incident..." aria-label="Cari nomor incident" />
              <kbd>⌘ K</kbd>
            </label>
            <div className="notification-wrap">
              <button className={`icon-button ${notificationOpen ? "selected" : ""}`} aria-label="Notifikasi" onClick={() => setNotificationOpen(!notificationOpen)}>
                <Icon name="bell" size={19} /><i className="notification-dot" />
              </button>
              {notificationOpen && <div className="notification-popover"><strong>Notifikasi</strong><p><span className="notification-symbol"><Icon name="alert" size={15} /></span><span><b>3 tiket prioritas tinggi</b><small>Perlu segera ditindaklanjuti</small></span></p><p><span className="notification-symbol success"><Icon name="check" size={15} /></span><span><b>Sinkronisasi selesai</b><small>Data diperbarui 12 menit lalu</small></span></p></div>}
            </div>
            <div className="topbar-divider" />
            <button className="profile-button" aria-label={`Keluar dari akun ${user.email}`} title={`${user.email} · Keluar`} onClick={async () => {
              try {
                const response = await fetch("/api/auth/logout", { method: "POST" });
                if (!response.ok) throw new Error("Sesi tidak dapat ditutup.");
                window.location.assign("/login");
              } catch {
                window.alert("Tidak dapat menghubungi server untuk keluar. Silakan coba lagi.");
              }
            }}>
              <span className="avatar">{user.name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U"}</span>
              <span className="profile-copy"><strong>{user.name}</strong><small>{user.role} · Keluar</small></span>
              <span className="logout-label">Keluar</span>
              <Icon name="chevron" size={15} />
            </button>
          </div>
        </header>

        {dashboardActive ? (
          <div className="page-content">
            <div className="page-heading">
              <div>
                <div className="eyebrow"><span className="live-dot" /> RINGKASAN OPERASIONAL</div>
                <h1>Dashboard</h1>
                <p>Pantau performa dan status penanganan tiket gangguan Anda.</p>
              </div>
              <button className="date-button"><Icon name="calendar" size={16} /><span>1 Nov – 30 Nov 2026</span><Icon name="chevron" size={15} /></button>
            </div>

            <div className="simulation-notice"><span className="notice-icon"><Icon name="activity" size={15} /></span><span><strong>Mode pratinjau</strong> Data yang ditampilkan adalah simulasi dan belum terhubung ke MySQL atau Google Sheets.</span><button aria-label="Tutup pemberitahuan" onClick={(event) => event.currentTarget.parentElement?.remove()}><Icon name="close" size={15} /></button></div>

            <section className="metric-grid" aria-label="Ringkasan tiket">
              <MetricCard title="Total Tiket" value="1.284" note="Dibanding bulan lalu" icon="ticket" tone="blue" trend="+12,8%" />
              <MetricCard title="Tiket Open" value="186" note="24 perlu perhatian" icon="clock" tone="orange" />
              <MetricCard title="Tiket Closed" value="1.098" note="Resolusi bulan ini" icon="check" tone="green" trend="+8,2%" />
              <MetricCard title="Teknisi Terdaftar" value="64" note="52 aktif hari ini" icon="wrench" tone="purple" />
            </section>

            <section className="chart-grid" aria-label="Analisis tiket">
              <article className="panel trend-panel">
                <div className="panel-heading">
                  <div><h2>Tren Tiket</h2><p>Volume tiket gangguan sepanjang tahun</p></div>
                  <button className="period-select">Tahun ini <Icon name="chevron" size={14} /></button>
                </div>
                <div className="chart-summary"><strong>1.284</strong><span className="summary-label">Total tiket</span><span className="summary-growth">↗ 12,8%</span><span className="summary-period">vs. tahun lalu</span></div>
                <MonthlyChart />
              </article>
              <article className="panel category-panel">
                <div className="panel-heading">
                  <div><h2>Tiket per Kategori</h2><p>Distribusi layanan yang dilaporkan</p></div>
                  <button className="more-button" aria-label="Opsi grafik">···</button>
                </div>
                <CategoryChart />
              </article>
            </section>

            <section className="panel tickets-panel">
              <div className="tickets-heading">
                <div><div className="title-with-count"><h2>Tiket Terbaru</h2><span>{filteredTickets.length}</span></div><p>Daftar laporan gangguan terkini</p></div>
                <button className="view-all" onClick={() => setActiveNav("Monitoring Tiket")}>Lihat semua <Icon name="arrow" size={15} /></button>
              </div>
              <div className="filters">
                <label className="filter-search"><Icon name="search" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nomor incident..." aria-label="Cari berdasarkan incident" /></label>
                <div className="filter-select-wrap"><Icon name="filter" size={16} /><select aria-label="Filter status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="All">Semua status</option><option value="Open">Open</option><option value="Closed">Closed</option></select><Icon name="chevron" size={14} /></div>
                <div className="filter-select-wrap category-filter"><select aria-label="Filter kategori layanan" value={category} onChange={(event) => setCategory(event.target.value)}><option value="All">Semua kategori</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select><Icon name="chevron" size={14} /></div>
                <button className="reset-button" onClick={resetFilters}><Icon name="reset" size={15} /> Reset</button>
              </div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>INCIDENT</th><th>REPORTED DATE</th><th>SERVICE TYPE</th><th>KATEGORI</th><th>STO</th><th>TEKNISI</th><th>STATUS</th><th /></tr></thead>
                  <tbody>
                    {filteredTickets.map((ticket) => (
                      <tr key={ticket.incident}>
                        <td><button className="incident-link" onClick={() => setSelectedTicket(ticket)}>{ticket.incident}</button><small className={`priority ${ticket.priority.toLowerCase()}`}>{ticket.priority === "Tinggi" && <i />}Prioritas {ticket.priority.toLowerCase()}</small></td>
                        <td className="date-cell">{ticket.reportedDate}</td>
                        <td>{ticket.serviceType}</td>
                        <td><span className={`category-tag cat-${ticket.category.toLowerCase()}`}>{ticket.category}</span></td>
                        <td>{ticket.sto}</td>
                        <td><span className="tech-cell"><span className="tech-avatar">{ticket.technician.split(" ").map((word) => word[0]).slice(0, 2).join("")}</span>{ticket.technician}</span></td>
                        <td><StatusBadge status={ticket.status} /></td>
                        <td><button className="detail-button" aria-label={`Detail ${ticket.incident}`} onClick={() => setSelectedTicket(ticket)}><Icon name="external" size={16} /></button></td>
                      </tr>
                    ))}
                    {filteredTickets.length === 0 && <tr><td className="empty-row" colSpan={8}><span><Icon name="search" size={19} /></span><strong>Tiket tidak ditemukan</strong><small>Coba ubah kata pencarian atau filter Anda.</small><button onClick={resetFilters}>Reset filter</button></td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="table-footer"><span>Menampilkan <strong>{filteredTickets.length ? 1 : 0}–{filteredTickets.length}</strong> dari <strong>{filteredTickets.length}</strong> tiket simulasi</span><div className="pagination"><button disabled aria-label="Halaman sebelumnya">‹</button><button className="page-current">1</button><button disabled aria-label="Halaman selanjutnya">›</button></div></div>
            </section>
            <footer className="page-footer"><span>© 2026 B2B Dashboard <i /> Data simulasi untuk keperluan pratinjau</span><span>Terakhir diperbarui: 5 Nov 2026, 10:02 WIB</span></footer>
          </div>
        ) : activeNav === "Sinkronisasi Data" && user.canSync ? (
          <div className="page-content">
            <div className="page-heading">
              <div>
                <div className="eyebrow"><span className="live-dot" /> SUMBER DATA OPERASIONAL</div>
                <h1>Sinkronisasi Data</h1>
                <p>Impor tiket dari MainSheet ke database aplikasi. Spreadsheet hanya dibaca.</p>
              </div>
              <button className="sync-button" onClick={runSyncNow} disabled={syncLoading}>
                <Icon name="sync" size={16} />
                {syncLoading ? "Memproses..." : "Sinkronisasi Sekarang"}
              </button>
            </div>
            <section className="panel sync-panel" aria-live="polite">
              <div className="sync-panel-heading">
                <div><h2>Status sinkronisasi</h2><p>Spreadsheet TIF BGES DISTRIC BEKASI · MainSheet</p></div>
                {syncRun && <span className={`sync-status sync-${syncRun.status.toLowerCase()}`}>{syncRun.status}</span>}
              </div>
              {syncLoading && !syncRun ? (
                <p className="sync-message">Memuat status sinkronisasi…</p>
              ) : syncRun ? (
                <>
                  <dl className="sync-meta">
                    <div><dt>Terakhir dimulai</dt><dd>{formatJakartaDate(syncRun.startedAt)}</dd></div>
                    <div><dt>Terakhir selesai</dt><dd>{syncRun.finishedAt ? formatJakartaDate(syncRun.finishedAt) : "Belum selesai"}</dd></div>
                    <div><dt>Baris terbaca</dt><dd>{syncRun.rowsRead ?? "Tidak tersedia"}</dd></div>
                  </dl>
                  <div className="sync-counts">
                    <div><span>Berhasil diproses</span><strong>{syncRun.inserted + syncRun.updated + syncRun.unchanged}</strong></div>
                    <div><span>Diproses baru</span><strong>{syncRun.inserted}</strong></div>
                    <div><span>Diperbarui</span><strong>{syncRun.updated}</strong></div>
                    <div><span>Tidak berubah</span><strong>{syncRun.unchanged}</strong></div>
                    <div><span>Dilewati</span><strong>{syncRun.skipped}</strong></div>
                    <div><span>Gagal</span><strong>{syncRun.failed}</strong></div>
                  </div>
                  {syncRun.errorSummary && <p className="sync-message sync-warning">{syncRun.errorSummary}</p>}
                  {syncRun.errorCode && <p className="sync-message">Kode hasil: {syncRun.errorCode}</p>}
                  {!!syncRun.failureDetails?.length && (
                    <div className="sync-errors">
                      <strong>Detail validasi (nomor baris dan kode)</strong>
                      <ul>{syncRun.failureDetails.map((failure, index) => (
                        <li key={`${failure.row}-${failure.code}-${index}`}>Baris {failure.row || "transaksi"} · {failure.code}</li>
                      ))}</ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="sync-message">Belum ada proses sinkronisasi.</p>
              )}
              {syncError && <p className="sync-message sync-warning" role="alert">{syncError}</p>}
            </section>
          </div>
        ) : (
          <div className="placeholder-page">
            <div className="placeholder-icon"><Icon name={navigation.find((item) => item.label === activeNav)?.icon ?? "grid"} size={25} /></div>
            <span className="eyebrow">WORKSPACE</span>
            <h1>{activeNav}</h1>
            <p>Halaman <strong>{activeNav}</strong> sedang disiapkan dan akan tersedia pada pengembangan berikutnya.</p>
            <button onClick={() => setActiveNav("Dashboard")}>Kembali ke Dashboard <Icon name="arrow" size={16} /></button>
          </div>
        )}
      </main>

      {selectedTicket && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedTicket(null)}>
          <section className="ticket-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading"><div><span className="eyebrow">DETAIL TIKET</span><h2 id="modal-title">{selectedTicket.incident}</h2></div><button className="icon-button" aria-label="Tutup detail" onClick={() => setSelectedTicket(null)}><Icon name="close" /></button></div>
            <StatusBadge status={selectedTicket.status} />
            <div className="modal-details">
              <div><span>Tanggal dilaporkan</span><strong>{selectedTicket.reportedDate}</strong></div>
              <div><span>Service type</span><strong>{selectedTicket.serviceType}</strong></div>
              <div><span>Kategori layanan</span><strong>{selectedTicket.category}</strong></div>
              <div><span>STO</span><strong>{selectedTicket.sto}</strong></div>
              <div><span>Teknisi</span><strong>{selectedTicket.technician}</strong></div>
              <div><span>Prioritas</span><strong>{selectedTicket.priority}</strong></div>
            </div>
            <div className="modal-simulation"><Icon name="activity" size={15} /> Detail ini menggunakan data simulasi.</div>
            <button className="modal-done" onClick={() => setSelectedTicket(null)}>Tutup</button>
          </section>
        </div>
      )}
    </div>
  );
}
