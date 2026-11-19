import ActivateAccount from "./pages/ActivateAccount";
import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
  UserRound,
  UserPlus,
  BriefcaseBusiness,
  ClipboardList,
  CalendarCheck,
  MessageSquare,
  Building2,
  TrendingUp,
  Wallet,
  X,
  Plus,
  ArrowUpRight,
  CircleHelp,
  Filter,
  Download,
  MoreHorizontal,
  HeartPulse,
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const AUTH_TOKEN_KEY = "st_teresa_hrms_token";

const ROLE_PORTAL_MAP = {
  SUPER_ADMIN: "Administrator",
  HR_MANAGER: "Administrator",
  FINANCE_OFFICER: "Administrator",
  DEPARTMENT_HEAD: "Administrator",
  EMPLOYEE: "Employee",
  PATIENT: "Patient / Client",
};

function getAllowedPortals(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const portals = [
    ...new Set(
      roles
        .map((role) => ROLE_PORTAL_MAP[String(role).toUpperCase()])
        .filter(Boolean),
    ),
  ];

  // Account type is a fallback for accounts whose token does not contain roles.
  const accountType = String(
    user?.accountType || user?.account_type || "",
  ).toUpperCase();
  if (!portals.length) {
    if (["ADMIN", "ADMINISTRATOR"].includes(accountType))
      portals.push("Administrator");
    if (accountType === "EMPLOYEE") portals.push("Employee");
    if (["PATIENT", "CLIENT"].includes(accountType))
      portals.push("Patient / Client");
  }
  return portals;
}

function getDisplayName(user) {
  return (
    user?.name || user?.full_name || user?.fullName || user?.email || "Account"
  );
}

function getInitials(user) {
  const name = getDisplayName(user);
  return (
    name
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "U"
  );
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onLogin(email.trim(), password);
    } catch (err) {
      setError(err.message || "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">
            <Stethoscope size={25} />
          </div>
          <div>
            <strong>ST TERESA</strong>
            <span>HOSPITAL HRMS</span>
          </div>
        </div>
        <div className="auth-heading">
          <span className="eyebrow">SECURE HOSPITAL PORTAL</span>
          <h1>Welcome back</h1>
          <p>Sign in using your hospital account credentials.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email address</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@stteresa.co.ke"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          <button
            className="btn btn-primary auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="auth-footnote">
          <ShieldCheck size={15} /> Your account access is protected by hospital
          authentication.
        </p>
      </section>
      <p className="auth-copyright">
        © 2026 St Teresa Hospital. All rights reserved.
      </p>
    </main>
  );
}

const menus = {
  Administrator: [
    ["Overview", LayoutDashboard],
    ["Employees", Users],
    ["Departments", Building2],
    ["Attendance", Clock3],
    ["Shift Management", CalendarDays],
    ["Leave Management", CalendarCheck],
    ["Payroll", Wallet],
    ["Recruitment", BriefcaseBusiness],
    ["Performance", TrendingUp],
    ["Reports", FileText],
    ["Settings", Settings],
  ],

  Employee: [
    ["My Dashboard", LayoutDashboard],
    ["My Profile", UserRound],
    ["My Attendance", Clock3],
    ["My Shifts", CalendarDays],
    ["Apply for Leave", CalendarCheck],
    ["My Payslips", Wallet],
    ["Notifications", Bell],
  ],
  "Patient / Client": [
    ["Patient Dashboard", LayoutDashboard],
    ["Book Appointment", CalendarDays],
    ["My Appointments", ClipboardList],
    ["My Profile", UserRound],
    ["Enquiries & Feedback", MessageSquare],
    ["Hospital Information", HeartPulse],
  ],
};

const employees = [
  {
    name: "Dr James Mwangi",
    role: "Medical Officer",
    dept: "Outpatient",
    status: "On duty",
    initials: "JM",
  },
  {
    name: "Mary Wanjiku",
    role: "Registered Nurse",
    dept: "Maternity",
    status: "On leave",
    initials: "MW",
  },
  {
    name: "Peter Otieno",
    role: "Lab Technologist",
    dept: "Laboratory",
    status: "On duty",
    initials: "PO",
  },
  {
    name: "Grace Njeri",
    role: "HR Officer",
    dept: "Human Resources",
    status: "On duty",
    initials: "GN",
  },
  {
    name: "David Kiptoo",
    role: "Pharmacist",
    dept: "Pharmacy",
    status: "Off shift",
    initials: "DK",
  },
];

const attendance = [
  ["Mon, 09 Nov 2026", "07:02 AM", "07:08 PM", "12h 06m", "Present"],
  ["Tue, 10 Nov 2026", "06:56 AM", "07:01 PM", "12h 05m", "Present"],
  ["Wed, 11 Nov 2026", "07:18 AM", "07:00 PM", "11h 42m", "Late"],
  ["Thu, 12 Nov 2026", "07:00 AM", "07:04 PM", "12h 04m", "Present"],
  ["Fri, 13 Nov 2026", "—", "—", "—", "Scheduled"],
];

function App() {
  const isActivationPage = window.location.pathname === "/activate-account";

  if (isActivationPage) {
    return <ActivateAccount />;
  }
  const [token, setToken] = useState(
    () => sessionStorage.getItem(AUTH_TOKEN_KEY) || "",
  );
  const [authenticatedUser, setAuthenticatedUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(
    Boolean(sessionStorage.getItem(AUTH_TOKEN_KEY)),
  );

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      if (!token) {
        setCheckingSession(false);
        return;
      }
      try {
        const response = await fetch(`${API_BASE_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Session expired.");
        if (active) setAuthenticatedUser(data.user || data);
      } catch {
        sessionStorage.removeItem(AUTH_TOKEN_KEY);
        if (active) {
          setToken("");
          setAuthenticatedUser(null);
        }
      } finally {
        if (active) setCheckingSession(false);
      }
    }
    restoreSession();
    return () => {
      active = false;
    };
  }, [token]);

  async function handleLogin(email, password) {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(data.message || "Invalid email or password.");
    if (!data.token)
      throw new Error("The server did not return an authentication token.");

    const user = data.user || data.account || {};
    const allowed = getAllowedPortals(user);
    if (!allowed.length)
      throw new Error(
        "Your account has no portal role assigned. Contact the hospital administrator.",
      );

    sessionStorage.setItem(AUTH_TOKEN_KEY, data.token);
    setToken(data.token);
    setAuthenticatedUser(user);
  }

  function handleLogout() {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    setToken("");
    setAuthenticatedUser(null);
  }

  if (checkingSession) {
    return (
      <div className="auth-loading">
        <div className="auth-spinner" />
        <span>Verifying your session...</span>
      </div>
    );
  }
  if (!authenticatedUser) return <LoginScreen onLogin={handleLogin} />;

  const allowedPortals = getAllowedPortals(authenticatedUser);
  if (!allowedPortals.length) {
    handleLogout();
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <HospitalApp
      user={authenticatedUser}
      token={token}
      allowedPortals={allowedPortals}
      onLogout={handleLogout}
    />
  );
}

function HospitalApp({ user, token, allowedPortals, onLogout }) {
  const [portal, setPortal] = useState(allowedPortals[0]);
  const [page, setPage] = useState(menus[allowedPortals[0]][0][0]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState("");
  const [employeeProfile, setEmployeeProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [adminLeaveData, setAdminLeaveData] = useState(null);
  const [adminLeaveLoading, setAdminLeaveLoading] = useState(false);
  const [adminLeaveError, setAdminLeaveError] = useState("");
  const [leaveDecisionRemarks, setLeaveDecisionRemarks] = useState({});
  const [processingLeaveId, setProcessingLeaveId] = useState(null);

  // Administrator Attendance State
  const [adminAttendanceData, setAdminAttendanceData] = useState(null);
  const [adminAttendanceLoading, setAdminAttendanceLoading] = useState(false);
  const [adminAttendanceError, setAdminAttendanceError] = useState("");

  const [adminAttendanceDate, setAdminAttendanceDate] = useState("");
  const [adminAttendanceSearch, setAdminAttendanceSearch] = useState("");
  const [adminAttendanceDepartment, setAdminAttendanceDepartment] =
    useState("");

  // Shift Management
  const [adminShiftData, setAdminShiftData] = useState(null);
  const [adminShiftLoading, setAdminShiftLoading] = useState(false);
  const [adminShiftError, setAdminShiftError] = useState("");

  const [adminShiftDate, setAdminShiftDate] = useState(
    new Date().toLocaleDateString("en-CA", {
      timeZone: "Africa/Nairobi",
    }),
  );

  const [shiftEmployeeId, setShiftEmployeeId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [shiftSubmitting, setShiftSubmitting] = useState(false);
  const [shiftMessage, setShiftMessage] = useState("");

  // Administrator Payroll State
  const [adminPayrollPeriods, setAdminPayrollPeriods] = useState([]);
  const [adminPayrollEmployees, setAdminPayrollEmployees] = useState([]);
  const [adminPayrollEmployeesLoading, setAdminPayrollEmployeesLoading] =
    useState(false);
  const [adminPayrollEmployeesError, setAdminPayrollEmployeesError] =
    useState("");
  const [selectedPayrollEmployee, setSelectedPayrollEmployee] = useState("");
  const [payrollGenerating, setPayrollGenerating] = useState(false);
  const [adminPayrollLoading, setAdminPayrollLoading] = useState(false);
  const [adminPayrollError, setAdminPayrollError] = useState("");
  const [selectedPayrollPeriod, setSelectedPayrollPeriod] = useState("");
  const [adminPayrollRecords, setAdminPayrollRecords] = useState([]);
  const [adminPayrollSummary, setAdminPayrollSummary] = useState(null);
  const [adminPayrollPeriodDetails, setAdminPayrollPeriodDetails] =
    useState(null);
  const [adminPayrollRecordsLoading, setAdminPayrollRecordsLoading] =
    useState(false);
  const [adminPayrollRecordsError, setAdminPayrollRecordsError] = useState("");

  async function loadEmployeeProfile() {
    if (!token) return;

    setProfileLoading(true);
    setProfileError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/employees/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to retrieve your employee profile.",
        );
      }

      setEmployeeProfile(data.employee);
    } catch (error) {
      setProfileError(error.message);
    } finally {
      setProfileLoading(false);
    }
  }

  async function loadAdminPayrollPeriods() {
    if (!token) return;

    setAdminPayrollLoading(true);
    setAdminPayrollError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/payroll/periods`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Unable to retrieve payroll periods.");
      }

      setAdminPayrollPeriods(data.periods || []);
    } catch (error) {
      setAdminPayrollError(error.message);
    } finally {
      setAdminPayrollLoading(false);
    }
  }

  async function loadAdminPayrollRecords(periodId) {
    if (!token || !periodId) return;

    setAdminPayrollRecordsLoading(true);
    setAdminPayrollRecordsError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/payroll/periods/${encodeURIComponent(periodId)}/records`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Unable to retrieve payroll records.");
      }

      setAdminPayrollRecords(data.records || []);
      setAdminPayrollSummary(data.summary || null);
      setAdminPayrollPeriodDetails(data.period || null);
    } catch (error) {
      setAdminPayrollRecordsError(error.message);
      setAdminPayrollRecords([]);
      setAdminPayrollSummary(null);
      setAdminPayrollPeriodDetails(null);
    } finally {
      setAdminPayrollRecordsLoading(false);
    }
  }

  async function loadAdminLeaveData() {
    if (!token) return;

    setAdminLeaveLoading(true);
    setAdminLeaveError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/employees/leave-management`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to retrieve leave management data.",
        );
      }

      setAdminLeaveData(data);
    } catch (error) {
      setAdminLeaveError(error.message);
    } finally {
      setAdminLeaveLoading(false);
    }
  }

  async function loadAdminAttendanceData() {
    if (!token) return;

    setAdminAttendanceLoading(true);
    setAdminAttendanceError("");

    try {
      const params = new URLSearchParams();

      if (adminAttendanceDate) {
        params.append("date", adminAttendanceDate);
      }

      if (adminAttendanceSearch.trim()) {
        params.append("search", adminAttendanceSearch.trim());
      }

      if (adminAttendanceDepartment) {
        params.append("department", adminAttendanceDepartment);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/employees/attendance-management?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to retrieve attendance management data.",
        );
      }

      setAdminAttendanceData(data);
    } catch (error) {
      setAdminAttendanceError(error.message);
    } finally {
      setAdminAttendanceLoading(false);
    }
  }

  async function loadAdminShiftData() {
    if (!token) return;

    setAdminShiftLoading(true);
    setAdminShiftError("");

    try {
      const params = new URLSearchParams();

      if (adminShiftDate) {
        params.append("date", adminShiftDate);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/employees/shift-management?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to retrieve shift management data.",
        );
      }

      setAdminShiftData(data);
    } catch (error) {
      setAdminShiftError(error.message);
    } finally {
      setAdminShiftLoading(false);
    }
  }

  async function assignEmployeeShift() {
    if (!shiftEmployeeId || !shiftId || !adminShiftDate) {
      setShiftMessage("Please select an employee, shift and date.");
      return;
    }

    setShiftSubmitting(true);
    setShiftMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/employees/shift-management/assign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            employee_id: shiftEmployeeId,
            shift_id: shiftId,
            shift_date: adminShiftDate,
          }),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Unable to assign employee shift.");
      }

      setShiftMessage("Employee shift assigned successfully.");

      setShiftEmployeeId("");
      setShiftId("");

      await loadAdminShiftData();
    } catch (error) {
      setShiftMessage(error.message);
    } finally {
      setShiftSubmitting(false);
    }
  }

  async function processLeaveRequest(requestId, decision) {
    const remarks = leaveDecisionRemarks[requestId] || "";

    if (decision === "REJECTED" && !remarks.trim()) {
      notify("Please provide a reason for rejecting this request.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to ${decision.toLowerCase()} this leave request?`,
    );

    if (!confirmed) return;

    setProcessingLeaveId(requestId);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/employees/leave-requests/${requestId}/decision`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            decision,
            decision_remarks: remarks,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to process leave request.");
      }

      notify(data.message);

      setLeaveDecisionRemarks((previous) => {
        const updated = { ...previous };
        delete updated[requestId];
        return updated;
      });

      await loadAdminLeaveData();
    } catch (error) {
      notify(error.message);
    } finally {
      setProcessingLeaveId(null);
    }
  }

  useEffect(() => {
    if (portal === "Administrator" && page === "Attendance") {
      loadAdminAttendanceData();
    }
  }, [
    portal,
    page,
    token,
    adminAttendanceDate,
    adminAttendanceSearch,
    adminAttendanceDepartment,
  ]);

  useEffect(() => {
    if (portal === "Administrator" && page === "Shift Management") {
      loadAdminShiftData();
    }
  }, [portal, page, token, adminShiftDate]);

  useEffect(() => {
    if (portal === "Administrator" && page === "Leave Management") {
      loadAdminLeaveData();
    }
  }, [portal, page, token]);

  useEffect(() => {
    if (portal === "Administrator" && page === "Payroll") {
      loadAdminPayrollPeriods();
    }
  }, [portal, page, token]);

  useEffect(() => {
    if (
      portal === "Administrator" &&
      page === "Payroll" &&
      selectedPayrollPeriod
    ) {
      loadAdminPayrollRecords(selectedPayrollPeriod);
    } else {
      setAdminPayrollRecords([]);
    }
  }, [portal, page, selectedPayrollPeriod, token]);

  useEffect(() => {
    if (portal === "Employee") {
      loadEmployeeProfile();
    }
  }, [portal, token]);
  const [appointments, setAppointments] = useState([
    {
      service: "General consultation",
      date: "18 Nov 2026",
      time: "10:30 AM",
      status: "Pending",
    },
    {
      service: "Dental consultation",
      date: "21 Nov 2026",
      time: "02:00 PM",
      status: "Confirmed",
    },
  ]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    service: "General consultation",
    date: "",
  });

  const nav = menus[portal];
  const switchPortal = (p) => {
    setPortal(p);
    setPage(menus[p][0][0]);
    setMobileOpen(false);
  };
  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const title = page;
  const subtitle =
    portal === "Administrator"
      ? "Hospital workforce overview and management"
      : portal === "Employee"
        ? "Your personal employment information"
        : "Your hospital services and appointment information";

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Stethoscope size={23} />
          </div>
          <div>
            <strong>ST TERESA</strong>
            <span>HOSPITAL HRMS</span>
          </div>
          <button
            className="mobile-close icon-btn"
            onClick={() => setMobileOpen(false)}
          >
            <X size={19} />
          </button>
        </div>
        <div className="portal-label">WORKSPACE</div>
        <div className="portal-switch">
          <span className="portal-dot"></span>
          <select
            value={portal}
            onChange={(e) => switchPortal(e.target.value)}
            aria-label="Choose portal"
          >
            {allowedPortals.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <ChevronDown size={15} />
        </div>
        <div className="nav-caption">MENU</div>
        <nav className="side-nav">
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              className={`nav-item ${page === label ? "active" : ""}`}
              onClick={() => {
                setPage(label);
                setMobileOpen(false);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === "Notifications" && <i className="nav-count">3</i>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">
              <CircleHelp size={18} />
            </div>
            <strong>Need assistance?</strong>
            <p>Contact the hospital support team for help.</p>
            <button
              onClick={() =>
                notify("Support contact: support@stteresahospital.co.ke")
              }
            >
              Contact support <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="profile-mini">
            <div className="avatar avatar-orange">{getInitials(user)}</div>
            <div className="profile-copy">
              <strong>{getDisplayName(user)}</strong>
              <span>{portal}</span>
            </div>
            <button
              className="icon-btn logout-mini"
              title="Sign out"
              onClick={onLogout}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="scrim" onClick={() => setMobileOpen(false)} />
      )}
      <main className="main-area">
        <header className="topbar">
          <div className="top-left">
            <button
              className="icon-btn mobile-menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={21} />
            </button>
            <div className="breadcrumb">
              St Teresa Hospital <span>/</span> <b>{page}</b>
            </div>
          </div>
          <div className="top-actions">
            <label className="search-box">
              <Search size={16} />
              <input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>⌘ K</kbd>
            </label>
            <button
              className="icon-btn notification-btn"
              onClick={() =>
                notify("You are all caught up with notifications.")
              }
            >
              <Bell size={19} />
              <i></i>
            </button>
            <button className="btn btn-light top-logout" onClick={onLogout}>
              <LogOut size={15} /> Sign out
            </button>
            <div className="top-avatar">{getInitials(user)}</div>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">{portal.toUpperCase()} PORTAL</div>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            <div className="heading-actions">
              <button
                className="btn btn-light"
                onClick={() => notify("Report export is a prototype action.")}
              >
                <Download size={16} /> Export
              </button>
              {portal === "Administrator" && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowModal(true)}
                >
                  <Plus size={17} /> Add employee
                </button>
              )}
              {portal === "Patient / Client" && page === "Book Appointment" && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowModal(true)}
                >
                  <Plus size={17} /> Request appointment
                </button>
              )}
            </div>
          </div>

          {portal === "Administrator" && (
            <AdminPage
              page={page}
              notify={notify}
              token={token}
              adminLeaveData={adminLeaveData}
              adminLeaveLoading={adminLeaveLoading}
              adminLeaveError={adminLeaveError}
              loadAdminLeaveData={loadAdminLeaveData}
              leaveDecisionRemarks={leaveDecisionRemarks}
              setLeaveDecisionRemarks={setLeaveDecisionRemarks}
              processingLeaveId={processingLeaveId}
              processLeaveRequest={processLeaveRequest}
              adminAttendanceData={adminAttendanceData}
              adminAttendanceLoading={adminAttendanceLoading}
              adminAttendanceError={adminAttendanceError}
              adminShiftData={adminShiftData}
              adminShiftLoading={adminShiftLoading}
              adminShiftError={adminShiftError}
              adminShiftDate={adminShiftDate}
              setAdminShiftDate={setAdminShiftDate}
              shiftEmployeeId={shiftEmployeeId}
              setShiftEmployeeId={setShiftEmployeeId}
              shiftId={shiftId}
              setShiftId={setShiftId}
              shiftSubmitting={shiftSubmitting}
              shiftMessage={shiftMessage}
              loadAdminShiftData={loadAdminShiftData}
              assignEmployeeShift={assignEmployeeShift}
              loadAdminAttendanceData={loadAdminAttendanceData}
              adminAttendanceDate={adminAttendanceDate}
              setAdminAttendanceDate={setAdminAttendanceDate}
              adminAttendanceSearch={adminAttendanceSearch}
              setAdminAttendanceSearch={setAdminAttendanceSearch}
              adminAttendanceDepartment={adminAttendanceDepartment}
              setAdminAttendanceDepartment={setAdminAttendanceDepartment}
              adminPayrollPeriods={adminPayrollPeriods}
              adminPayrollLoading={adminPayrollLoading}
              adminPayrollError={adminPayrollError}
              loadAdminPayrollPeriods={loadAdminPayrollPeriods}
              selectedPayrollPeriod={selectedPayrollPeriod}
              setSelectedPayrollPeriod={setSelectedPayrollPeriod}
              adminPayrollRecords={adminPayrollRecords}
              adminPayrollSummary={adminPayrollSummary}
              adminPayrollPeriodDetails={adminPayrollPeriodDetails}
              adminPayrollRecordsLoading={adminPayrollRecordsLoading}
              adminPayrollRecordsError={adminPayrollRecordsError}
              loadAdminPayrollRecords={loadAdminPayrollRecords}
            />
          )}
          {portal === "Employee" && (
            <EmployeePage
              page={page}
              notify={notify}
              token={token}
              employeeProfile={employeeProfile}
              profileLoading={profileLoading}
              profileError={profileError}
              onRetryProfile={loadEmployeeProfile}
            />
          )}
          {portal === "Patient / Client" && (
            <PatientPage
              page={page}
              appointments={appointments}
              onBook={() => setShowModal(true)}
              notify={notify}
            />
          )}
        </div>
        <footer className="footer">
          <span>© 2026 St Teresa Hospital. Prototype interface.</span>
          <span>Trusted care. Here for you.</span>
        </footer>
      </main>

      {showModal && (
        <Modal
          portal={portal}
          form={form}
          setForm={setForm}
          onClose={() => setShowModal(false)}
          onSubmit={() => {
            if (portal === "Patient / Client") {
              if (!form.name || !form.phone || !form.date)
                return notify("Please complete the required fields.");
              setAppointments([
                ...appointments,
                {
                  service: form.service,
                  date: form.date,
                  time: "To be confirmed",
                  status: "Pending",
                },
              ]);
              setForm({
                name: "",
                phone: "",
                service: "General consultation",
                date: "",
              });
              setPage("My Appointments");
              notify("Appointment request added to this prototype.");
            } else notify("Employee form submitted in prototype mode.");
            setShowModal(false);
          }}
        />
      )}
      {toast && (
        <div className="toast">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}

function AdminPage({
  page,
  notify,
  token,
  adminPayrollPeriods,
  adminPayrollLoading,
  adminPayrollError,
  loadAdminPayrollPeriods,
  selectedPayrollPeriod,
  setSelectedPayrollPeriod,
  adminPayrollRecords,
  adminPayrollSummary,
  adminPayrollPeriodDetails,
  adminPayrollRecordsLoading,
  adminPayrollRecordsError,
  loadAdminPayrollRecords,
  adminAttendanceData,
  adminAttendanceLoading,
  adminAttendanceError,
  loadAdminAttendanceData,
  adminAttendanceDate,
  setAdminAttendanceDate,
  adminAttendanceSearch,
  setAdminAttendanceSearch,
  adminAttendanceDepartment,
  setAdminAttendanceDepartment,

  adminLeaveData,
  adminLeaveLoading,
  adminLeaveError,
  loadAdminLeaveData,
  leaveDecisionRemarks,
  setLeaveDecisionRemarks,
  processingLeaveId,
  processLeaveRequest,

  adminShiftData,
  adminShiftLoading,
  adminShiftError,
  adminShiftDate,
  setAdminShiftDate,
  shiftEmployeeId,
  setShiftEmployeeId,
  shiftId,
  setShiftId,
  shiftSubmitting,
  shiftMessage,
  loadAdminShiftData,
  assignEmployeeShift,
}) {
  const [editingAttendance, setEditingAttendance] = React.useState(null);

  const [correctionForm, setCorrectionForm] = React.useState({
    clock_in: "",
    clock_out: "",
    attendance_status: "PRESENT",
    reason: "",
  });

  const [correctionSaving, setCorrectionSaving] = React.useState(false);
  const [correctionError, setCorrectionError] = React.useState("");
  const [correctionMessage, setCorrectionMessage] = React.useState("");

  const toNairobiInput = (value) => {
    if (!value) return "";

    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .format(new Date(value))
      .replace(" ", "T");
  };

  const openAttendanceCorrection = (record) => {
    setEditingAttendance(record);

    setCorrectionForm({
      clock_in: toNairobiInput(record.clock_in),
      clock_out: toNairobiInput(record.clock_out),
      attendance_status:
        record.attendance_status || record.calculated_status || "PRESENT",
      reason: "",
    });

    setCorrectionError("");
    setCorrectionMessage("");
  };

  const saveAttendanceCorrection = async () => {
    if (!editingAttendance) return;

    if (!correctionForm.reason.trim()) {
      setCorrectionError("Please provide a correction reason.");
      return;
    }

    if (correctionForm.clock_out && !correctionForm.clock_in) {
      setCorrectionError("Clock-in is required when clock-out is provided.");
      return;
    }

    setCorrectionSaving(true);
    setCorrectionError("");
    setCorrectionMessage("");

    try {
      const toNairobiISO = (value) =>
        value ? new Date(`${value}:00+03:00`).toISOString() : null;

      const response = await fetch(
        `http://localhost:5000/api/employees/attendance-management/${editingAttendance.attendance_id}/correction`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            clock_in: toNairobiISO(correctionForm.clock_in),
            clock_out: toNairobiISO(correctionForm.clock_out),
            attendance_status: correctionForm.attendance_status,
            reason: correctionForm.reason,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to correct attendance.");
      }

      setCorrectionMessage("Attendance corrected successfully.");

      await loadAdminAttendanceData();

      setEditingAttendance(null);

      notify("Attendance corrected successfully.", "success");
    } catch (error) {
      setCorrectionError(error.message);
    } finally {
      setCorrectionSaving(false);
    }
  };

  if (page === "Employees") {
    const filtered = employees.filter((e) =>
      `${e.name} ${e.role} ${e.dept}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
    return (
      <>
        <div className="section-toolbar">
          <div>
            <h2>Employee directory</h2>
            <p>Manage hospital staff profiles and employment details.</p>
          </div>
          <button className="btn btn-primary" onClick={onAdd}>
            <UserPlus size={16} /> Add employee
          </button>
        </div>
        <div className="table-card">
          <div className="table-top">
            <strong>
              All employees <span className="count-pill">263</span>
            </strong>
            <button
              className="btn btn-light btn-sm"
              onClick={() =>
                notify("Filters are available in the full application.")
              }
            >
              <Filter size={15} /> Filters
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>EMPLOYEE</th>
                  <th>POSITION</th>
                  <th>DEPARTMENT</th>
                  <th>STATUS</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.name}>
                    <td>
                      <div className="person-cell">
                        <div className="avatar">{e.initials}</div>
                        <strong>{e.name}</strong>
                      </div>
                    </td>
                    <td>{e.role}</td>
                    <td>{e.dept}</td>
                    <td>
                      <Status value={e.status} />
                    </td>
                    <td>
                      <button
                        className="icon-btn"
                        onClick={() => notify(`${e.name} profile preview`)}
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  if (page === "Attendance")
    return (
      <>
        {adminAttendanceLoading && !adminAttendanceData ? (
          <Panel title="Loading attendance">
            <p className="muted">Retrieving hospital attendance records...</p>
          </Panel>
        ) : adminAttendanceError && !adminAttendanceData ? (
          <Panel title="Unable to load attendance">
            <div className="notice">{adminAttendanceError}</div>
            <button
              className="btn btn-primary"
              onClick={loadAdminAttendanceData}
            >
              Try again
            </button>
          </Panel>
        ) : (
          <>
            {(() => {
              const statistics = adminAttendanceData?.statistics || {};
              const records = adminAttendanceData?.attendance || [];
              const departments = adminAttendanceData?.departments || [];

              return (
                <>
                  <Stats
                    items={[
                      [
                        "Present",
                        String(statistics.days_present ?? 0),
                        "Selected date",
                        Users,
                      ],
                      [
                        "Absent",
                        String(statistics.days_absent ?? 0),
                        "Selected date",
                        Clock3,
                      ],
                      [
                        "Late arrivals",
                        String(statistics.days_late ?? 0),
                        "Selected date",
                        Activity,
                      ],
                      [
                        "On approved leave",
                        String(statistics.on_leave ?? 0),
                        "Selected date",
                        CalendarCheck,
                      ],
                      [
                        "Awaiting attendance",
                        String(statistics.awaiting ?? 0),
                        "Within shift schedule",
                        Clock3,
                      ],
                      [
                        "Not scheduled",
                        String(statistics.not_scheduled ?? 0),
                        "No shift assigned",
                        CalendarDays,
                      ],
                    ]}
                  />

                  <Panel
                    title="Attendance Overview"
                    subtitle={`Active employees: ${statistics.total_employees ?? 0} | Recorded attendance: ${statistics.total_records ?? 0} | Scheduled: ${statistics.total_scheduled ?? 0} | Hours worked: ${Number(statistics.total_hours ?? 0).toFixed(2)}`}
                  >
                    <div className="form-grid">
                      <Field label="Attendance date">
                        <input
                          type="date"
                          value={adminAttendanceDate}
                          onChange={(e) =>
                            setAdminAttendanceDate(e.target.value)
                          }
                        />
                      </Field>

                      <Field label="Search employee">
                        <input
                          type="text"
                          placeholder="Name, employee number or email"
                          value={adminAttendanceSearch}
                          onChange={(e) =>
                            setAdminAttendanceSearch(e.target.value)
                          }
                        />
                      </Field>

                      <Field label="Department">
                        <select
                          value={adminAttendanceDepartment}
                          onChange={(e) =>
                            setAdminAttendanceDepartment(e.target.value)
                          }
                        >
                          <option value="">All departments</option>
                          {departments.map((department) => (
                            <option
                              key={department.id}
                              value={department.department_name}
                            >
                              {department.department_name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <div className="form-actions">
                      <button
                        className="btn btn-primary"
                        onClick={loadAdminAttendanceData}
                        disabled={adminAttendanceLoading}
                      >
                        {adminAttendanceLoading
                          ? "Refreshing..."
                          : "Refresh attendance"}
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setAdminAttendanceDate("");
                          setAdminAttendanceSearch("");
                          setAdminAttendanceDepartment("");
                        }}
                      >
                        Clear filters
                      </button>
                    </div>
                  </Panel>

                  {adminAttendanceError && (
                    <div className="notice">{adminAttendanceError}</div>
                  )}

                  {editingAttendance && (
                    <Panel title="Correct Attendance Record">
                      <div className="form-grid">
                        <Field label="Employee">
                          <input
                            type="text"
                            value={`${editingAttendance.first_name} ${editingAttendance.last_name}`}
                            disabled
                          />
                        </Field>

                        <Field label="Attendance Date">
                          <input
                            type="text"
                            value={editingAttendance.attendance_date || ""}
                            disabled
                          />
                        </Field>

                        <Field label="Clock In">
                          <input
                            type="datetime-local"
                            value={correctionForm.clock_in}
                            onChange={(e) =>
                              setCorrectionForm((prev) => ({
                                ...prev,
                                clock_in: e.target.value,
                              }))
                            }
                          />
                        </Field>

                        <Field label="Clock Out">
                          <input
                            type="datetime-local"
                            value={correctionForm.clock_out}
                            onChange={(e) =>
                              setCorrectionForm((prev) => ({
                                ...prev,
                                clock_out: e.target.value,
                              }))
                            }
                          />
                        </Field>

                        <Field label="Attendance Status">
                          <select
                            value={correctionForm.attendance_status}
                            onChange={(e) =>
                              setCorrectionForm((prev) => ({
                                ...prev,
                                attendance_status: e.target.value,
                              }))
                            }
                          >
                            <option value="PRESENT">Present</option>
                            <option value="ABSENT">Absent</option>
                            <option value="LATE">Late</option>
                            <option value="HALF_DAY">Half Day</option>
                            <option value="ON_LEAVE">On Leave</option>
                          </select>
                        </Field>

                        <Field label="Correction Reason">
                          <textarea
                            value={correctionForm.reason}
                            onChange={(e) =>
                              setCorrectionForm((prev) => ({
                                ...prev,
                                reason: e.target.value,
                              }))
                            }
                            placeholder="Explain why this attendance record is being corrected..."
                            required
                          />
                        </Field>
                      </div>

                      {correctionError && (
                        <p className="error-message">{correctionError}</p>
                      )}

                      <div className="form-actions">
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={saveAttendanceCorrection}
                          disabled={correctionSaving}
                        >
                          {correctionSaving ? "Saving..." : "Save Correction"}
                        </button>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setEditingAttendance(null);
                            setCorrectionError("");
                          }}
                          disabled={correctionSaving}
                        >
                          Cancel
                        </button>
                      </div>
                    </Panel>
                  )}

                  <Panel
                    title="Employee Attendance Register"
                    subtitle={`${records.length} employees shown`}
                  >
                    {records.length === 0 ? (
                      <div className="empty-state">
                        <h3>No employees found</h3>
                        <p className="muted">
                          No employees match your selected filters.
                        </p>
                      </div>
                    ) : (
                      <SimpleTable
                        headers={[
                          "ACTIONS",
                          "EMPLOYEE",
                          "EMPLOYEE NUMBER",
                          "DEPARTMENT",
                          "POSITION",
                          "SHIFT",
                          "CLOCK IN",
                          "CLOCK OUT",
                          "HOURS",
                          "STATUS",
                        ]}
                        rows={records.map((record) => {
                          const status =
                            record.calculated_status ||
                            record.attendance_status ||
                            "Pending";

                          return [
                            <button
                              key={record.attendance_id || record.employee_id}
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => openAttendanceCorrection(record)}
                              disabled={!record.attendance_id}
                            >
                              Edit
                            </button>,

                            `${record.first_name} ${record.last_name}`,
                            record.employee_number,
                            record.department_name || "Unassigned",
                            record.position_title || "Unassigned",

                            record.shift_name
                              ? `${record.shift_name} (${record.start_time?.slice(0, 5) || ""} - ${record.end_time?.slice(0, 5) || ""})`
                              : "Not assigned",

                            record.clock_in
                              ? new Date(record.clock_in).toLocaleTimeString(
                                  "en-KE",
                                  {
                                    timeZone: "Africa/Nairobi",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )
                              : "—",

                            record.clock_out
                              ? new Date(record.clock_out).toLocaleTimeString(
                                  "en-KE",
                                  {
                                    timeZone: "Africa/Nairobi",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )
                              : "—",

                            record.hours_worked == null
                              ? "—"
                              : `${record.hours_worked} hrs`,

                            status,
                          ];
                        })}
                      />
                    )}
                  </Panel>
                </>
              );
            })()}
          </>
        )}
      </>
    );

  if (page === "Shift Management") {
    const shifts = adminShiftData?.shifts || [];
    const employees = adminShiftData?.employees || [];
    const assignments = adminShiftData?.assignments || [];

    return (
      <>
        {adminShiftLoading && !adminShiftData ? (
          <Panel title="Loading shift management">
            <p className="muted">
              Retrieving shifts and employee assignments...
            </p>
          </Panel>
        ) : adminShiftError && !adminShiftData ? (
          <Panel title="Unable to load shift management">
            <div className="notice">{adminShiftError}</div>
            <button className="btn btn-primary" onClick={loadAdminShiftData}>
              Try again
            </button>
          </Panel>
        ) : (
          <>
            <Stats
              items={[
                [
                  "Available shifts",
                  String(shifts.length),
                  "Active shift schedules",
                  Clock3,
                ],
                [
                  "Active employees",
                  String(employees.length),
                  "Eligible employees",
                  Users,
                ],
                [
                  "Assigned employees",
                  String(assignments.length),
                  "Selected date",
                  CalendarCheck,
                ],
              ]}
            />

            <Panel
              title="Assign Employee to Shift"
              subtitle="Schedule an active employee for a selected working date."
            >
              <div className="form-grid">
                <Field label="Shift date">
                  <input
                    type="date"
                    value={adminShiftDate}
                    onChange={(e) => setAdminShiftDate(e.target.value)}
                  />
                </Field>

                <Field label="Select employee">
                  <select
                    value={shiftEmployeeId}
                    onChange={(e) => setShiftEmployeeId(e.target.value)}
                  >
                    <option value="">Choose employee</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.first_name} {employee.last_name} (
                        {employee.employee_number})
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Select shift">
                  <select
                    value={shiftId}
                    onChange={(e) => setShiftId(e.target.value)}
                  >
                    <option value="">Choose shift</option>
                    {shifts.map((shift) => (
                      <option key={shift.id} value={shift.id}>
                        {shift.shift_name} (
                        {String(shift.start_time).slice(0, 5)}
                        {" - "}
                        {String(shift.end_time).slice(0, 5)})
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {shiftMessage && <div className="notice">{shiftMessage}</div>}

              <div className="form-actions">
                <button
                  className="btn btn-primary"
                  onClick={assignEmployeeShift}
                  disabled={shiftSubmitting}
                >
                  {shiftSubmitting ? "Assigning..." : "Assign Shift"}
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={loadAdminShiftData}
                  disabled={adminShiftLoading}
                >
                  Refresh assignments
                </button>
              </div>
            </Panel>

            <Panel
              title="Employee Shift Assignments"
              subtitle={`${assignments.length} assignments for ${adminShiftDate}`}
            >
              {assignments.length === 0 ? (
                <div className="empty-state">
                  <h3>No shift assignments found</h3>
                  <p className="muted">
                    No employees have been assigned shifts for this date.
                  </p>
                </div>
              ) : (
                <SimpleTable
                  headers={[
                    "EMPLOYEE",
                    "EMPLOYEE NUMBER",
                    "DEPARTMENT",
                    "SHIFT",
                    "START TIME",
                    "END TIME",
                  ]}
                  rows={assignments.map((assignment) => [
                    `${assignment.first_name} ${assignment.last_name}`,
                    assignment.employee_number,
                    assignment.department_name || "Unassigned",
                    assignment.shift_name,
                    String(assignment.start_time).slice(0, 5),
                    String(assignment.end_time).slice(0, 5),
                  ])}
                />
              )}
            </Panel>
          </>
        )}
      </>
    );
  }

  if (page === "Leave Management") {
    const statistics = adminLeaveData?.statistics || {};
    const requests = adminLeaveData?.requests || [];

    return (
      <>
        <Stats
          items={[
            [
              "Pending requests",
              statistics.pending_requests || "0",
              "Awaiting review",
              CalendarCheck,
            ],
            [
              "Approved this month",
              statistics.approved_this_month || "0",
              "November 2026",
              Check,
            ],
            [
              "On leave today",
              statistics.employees_on_leave_today || "0",
              "Across departments",
              Users,
            ],
            [
              "Rejected",
              statistics.rejected_this_month || "0",
              "This month",
              X,
            ],
          ]}
        />

        <Panel
          title="Employee leave requests"
          action="Refresh"
          onAction={loadAdminLeaveData}
        >
          {adminLeaveError && (
            <div className="alert alert-error">{adminLeaveError}</div>
          )}

          {adminLeaveLoading ? (
            <p>Loading employee leave requests...</p>
          ) : requests.length === 0 ? (
            <p>No leave requests found.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>EMPLOYEE</th>
                    <th>DEPARTMENT</th>
                    <th>LEAVE TYPE</th>
                    <th>DATES</th>
                    <th>DAYS</th>
                    <th>REASON</th>
                    <th>STATUS</th>
                    <th>DECISION</th>
                  </tr>
                </thead>

                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <strong>
                          {request.first_name} {request.last_name}
                        </strong>
                        <br />
                        <small>{request.employee_number}</small>
                      </td>

                      <td>{request.department_name}</td>

                      <td>{request.leave_name}</td>

                      <td>
                        {String(request.start_date).slice(0, 10)}
                        <br />
                        to
                        <br />
                        {String(request.end_date).slice(0, 10)}
                      </td>

                      <td>{request.total_days}</td>

                      <td>{request.reason || "Not provided"}</td>

                      <td>
                        <strong>{request.request_status}</strong>
                      </td>

                      <td>
                        {request.request_status === "PENDING" ? (
                          <div
                            style={{
                              minWidth: "190px",
                              display: "grid",
                              gap: "8px",
                            }}
                          >
                            <textarea
                              placeholder="Decision remarks..."
                              value={leaveDecisionRemarks[request.id] || ""}
                              onChange={(e) =>
                                setLeaveDecisionRemarks((previous) => ({
                                  ...previous,
                                  [request.id]: e.target.value,
                                }))
                              }
                            />

                            <button
                              className="btn btn-primary"
                              disabled={processingLeaveId === request.id}
                              onClick={() =>
                                processLeaveRequest(request.id, "APPROVED")
                              }
                            >
                              Approve
                            </button>

                            <button
                              className="btn btn-danger"
                              disabled={processingLeaveId === request.id}
                              onClick={() =>
                                processLeaveRequest(request.id, "REJECTED")
                              }
                            >
                              Reject
                            </button>

                            {processingLeaveId === request.id && (
                              <small>Processing decision...</small>
                            )}
                          </div>
                        ) : (
                          <div>
                            <strong>{request.reviewer_name || "HR"}</strong>
                            <br />
                            <small>
                              {request.decision_remarks || "No remarks"}
                            </small>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </>
    );
  }

  if (page === "Payroll") {
    const summary = adminPayrollSummary || {};

    const formatPayrollMoney = (amount) =>
      `KSh ${Number(amount || 0).toLocaleString("en-KE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

    return (
      <>
        <Panel
          title="Payroll Management"
          action="Refresh"
          onAction={loadAdminPayrollPeriods}
        >
          {adminPayrollError && (
            <div className="alert alert-error">{adminPayrollError}</div>
          )}

          {adminPayrollLoading ? (
            <p>Loading payroll periods...</p>
          ) : adminPayrollPeriods.length === 0 ? (
            <p>
              No payroll periods found. Create a payroll period to get started.
            </p>
          ) : (
            <div style={{ maxWidth: "420px" }}>
              <label>Select payroll period</label>
              <select
                value={selectedPayrollPeriod}
                onChange={(e) => setSelectedPayrollPeriod(e.target.value)}
                style={{ width: "100%", padding: "10px" }}
              >
                <option value="">Choose a payroll period</option>
                {adminPayrollPeriods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.period_name} — {period.period_status}
                  </option>
                ))}
              </select>
            </div>
          )}
        </Panel>

        {selectedPayrollPeriod && (
          <>
            <Stats
              items={[
                [
                  "Employees",
                  summary.total_employees || 0,
                  "In selected period",
                  Users,
                ],
                [
                  "Gross salary",
                  formatPayrollMoney(summary.total_gross_salary),
                  "Total gross earnings",
                  Wallet,
                ],
                [
                  "Total deductions",
                  formatPayrollMoney(summary.total_deductions),
                  "Employee deductions",
                  TrendingDown,
                ],
                [
                  "Net payroll",
                  formatPayrollMoney(summary.total_net_salary),
                  "Take-home pay",
                  Banknote,
                ],
              ]}
            />

            <Panel title="Selected payroll period">
              {adminPayrollPeriodDetails ? (
                <div>
                  <p>
                    <strong>Period:</strong>{" "}
                    {adminPayrollPeriodDetails.period_name}
                  </p>
                  <p>
                    <strong>Start date:</strong>{" "}
                    {String(adminPayrollPeriodDetails.start_date).slice(0, 10)}
                  </p>
                  <p>
                    <strong>End date:</strong>{" "}
                    {String(adminPayrollPeriodDetails.end_date).slice(0, 10)}
                  </p>
                  <p>
                    <strong>Payment date:</strong>{" "}
                    {adminPayrollPeriodDetails.payment_date
                      ? String(adminPayrollPeriodDetails.payment_date).slice(
                          0,
                          10,
                        )
                      : "Not scheduled"}
                  </p>
                  <p>
                    <strong>Status:</strong>{" "}
                    {adminPayrollPeriodDetails.period_status}
                  </p>
                </div>
              ) : (
                <p>Select a payroll period to view its details.</p>
              )}
            </Panel>

            <Panel
              title="Employee payroll records"
              action="Refresh records"
              onAction={() => loadAdminPayrollRecords(selectedPayrollPeriod)}
            >
              {adminPayrollRecordsError && (
                <div className="alert alert-error">
                  {adminPayrollRecordsError}
                </div>
              )}

              {adminPayrollRecordsLoading ? (
                <p>Loading employee payroll records...</p>
              ) : adminPayrollRecords.length === 0 ? (
                <p>No employee payroll records found for this period.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>EMPLOYEE</th>
                        <th>DEPARTMENT</th>
                        <th>BASIC SALARY</th>
                        <th>GROSS SALARY</th>
                        <th>DEDUCTIONS</th>
                        <th>NET SALARY</th>
                        <th>PAYMENT STATUS</th>
                      </tr>
                    </thead>

                    <tbody>
                      {adminPayrollRecords.map((record) => (
                        <tr key={record.id}>
                          <td>
                            <strong>
                              {record.first_name} {record.last_name}
                            </strong>
                            <br />
                            <small>{record.employee_number}</small>
                          </td>

                          <td>{record.department_name || "Not assigned"}</td>

                          <td>{formatPayrollMoney(record.basic_salary)}</td>

                          <td>{formatPayrollMoney(record.gross_salary)}</td>

                          <td>{formatPayrollMoney(record.total_deductions)}</td>

                          <td>
                            <strong>
                              {formatPayrollMoney(record.net_salary)}
                            </strong>
                          </td>

                          <td>
                            <strong>{record.payment_status}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </>
        )}
      </>
    );
  }

  if (page === "Departments")
    return (
      <div className="card-grid">
        {[
          ["Outpatient", "42 employees"],
          ["Maternity", "36 employees"],
          ["Laboratory", "18 employees"],
          ["Pharmacy", "14 employees"],
          ["Nursing", "78 employees"],
          ["Human Resources", "8 employees"],
        ].map(([n, c]) => (
          <div className="department-card" key={n}>
            <div className="dept-icon">
              <Building2 size={20} />
            </div>
            <h3>{n}</h3>
            <p>{c}</p>
            <button onClick={() => notify(`${n} department selected`)}>
              View department <ArrowUpRight size={14} />
            </button>
          </div>
        ))}
      </div>
    );
  if (page === "Recruitment")
    return (
      <>
        <Stats
          items={[
            ["Open vacancies", "12", "Across departments", BriefcaseBusiness],
            ["Applications", "86", "Received this month", FileText],
            ["Shortlisted", "18", "Awaiting interviews", Users],
            ["Interviews", "7", "Scheduled", CalendarDays],
          ]}
        />
        <Panel
          title="Active vacancies"
          action="Create vacancy"
          onAction={() =>
            notify("Vacancy form is planned for the next prototype iteration.")
          }
        >
          <SimpleTable
            headers={[
              "POSITION",
              "DEPARTMENT",
              "APPLICANTS",
              "CLOSING DATE",
              "STATUS",
            ]}
            rows={[
              ["Registered Nurse", "Nursing", "24", "30 Nov 2026", "Open"],
              ["Medical Officer", "Outpatient", "18", "25 Nov 2026", "Open"],
              ["Accounts Assistant", "Finance", "12", "28 Nov 2026", "Open"],
            ]}
          />
        </Panel>
      </>
    );
  if (page === "Performance")
    return (
      <>
        <Stats
          items={[
            ["Reviews due", "28", "This quarter", ClipboardList],
            ["Completed", "74", "This quarter", Check],
            ["Average score", "86%", "Illustrative", TrendingUp],
            ["Development plans", "19", "Active", Activity],
          ]}
        />
        <Panel title="Performance review activity">
          <SimpleTable
            headers={["EMPLOYEE", "DEPARTMENT", "REVIEW PERIOD", "STATUS"]}
            rows={[
              ["Dr James Mwangi", "Outpatient", "Q4 2026", "In progress"],
              ["Mary Wanjiku", "Maternity", "Q4 2026", "Pending"],
              ["Peter Otieno", "Laboratory", "Q4 2026", "Completed"],
            ]}
          />
        </Panel>
      </>
    );
  if (page === "Reports")
    return (
      <>
        <div className="report-grid">
          <div className="report-card">
            <Activity />
            <h3>Workforce report</h3>
            <p>Headcount, staffing and department distribution.</p>
            <button
              onClick={() => notify("Report preview is a prototype action.")}
            >
              Open report <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="report-card">
            <Clock3 />
            <h3>Attendance report</h3>
            <p>Daily attendance, lateness and overtime.</p>
            <button
              onClick={() => notify("Report preview is a prototype action.")}
            >
              Open report <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="report-card">
            <Wallet />
            <h3>Payroll report</h3>
            <p>Payroll summaries and deduction breakdowns.</p>
            <button
              onClick={() => notify("Report preview is a prototype action.")}
            >
              Open report <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
      </>
    );
  if (page === "Settings")
    return (
      <Panel title="System settings">
        <div className="settings-row">
          <div>
            <strong>Portal appearance</strong>
            <p>St Teresa dark blue and orange theme</p>
          </div>
          <span className="theme-swatches">
            <i></i>
            <i></i>
          </span>
        </div>
        <div className="settings-row">
          <div>
            <strong>Role-based access</strong>
            <p>Manage user roles and permissions</p>
          </div>
          <button
            className="btn btn-light btn-sm"
            onClick={() =>
              notify("Role management is planned for backend integration.")
            }
          >
            Manage roles
          </button>
        </div>
      </Panel>
    );
  return (
    <>
      <Stats
        items={[
          ["Total employees", "263", "+8 this quarter", Users],
          ["Present today", "218", "83% attendance", CalendarCheck],
          ["On leave", "16", "Across departments", Clock3],
          ["Open vacancies", "12", "Recruitment", BriefcaseBusiness],
        ]}
      />
      <div className="dashboard-grid">
        <Panel
          title="Attendance overview"
          subtitle="Workforce attendance today"
        >
          <div className="attendance-chart">
            <div className="donut">
              <div>
                <strong>83%</strong>
                <span>Present</span>
              </div>
            </div>
            <div className="chart-legend">
              <span>
                <i className="legend-blue"></i>Present <b>218</b>
              </span>
              <span>
                <i className="legend-orange"></i>On leave <b>16</b>
              </span>
              <span>
                <i className="legend-grey"></i>Absent <b>29</b>
              </span>
            </div>
          </div>
        </Panel>
        <Panel
          title="Department distribution"
          subtitle="Employees by department"
        >
          <div className="bar-list">
            {[
              ["Nursing", 78, 90],
              ["Outpatient", 42, 65],
              ["Maternity", 36, 55],
              ["Laboratory", 18, 35],
              ["Pharmacy", 14, 25],
            ].map(([n, v, w]) => (
              <div className="bar-row" key={n}>
                <div>
                  <span>{n}</span>
                  <b>{v}</b>
                </div>
                <div className="bar-track">
                  <i style={{ width: `${w}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel
        title="Recent employee activity"
        action="View directory"
        onAction={() =>
          notify("Select Employees from the sidebar to open the directory.")
        }
      >
        <SimpleTable
          headers={["EMPLOYEE", "POSITION", "DEPARTMENT", "STATUS"]}
          rows={employees
            .slice(0, 4)
            .map((e) => [e.name, e.role, e.dept, e.status])}
        />
      </Panel>
    </>
  );
}

function EmployeePage({
  page,
  notify,
  token,
  employeeProfile,
  profileLoading,
  profileError,
  onRetryProfile,
}) {
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [attendanceHistoryLoading, setAttendanceHistoryLoading] =
    useState(false);
  const [attendanceHistoryError, setAttendanceHistoryError] = useState("");
  const [payslips, setPayslips] = useState([]);
  const [payslipsLoading, setPayslipsLoading] = useState(false);
  const [payslipsError, setPayslipsError] = useState("");
  const [attendanceActionLoading, setAttendanceActionLoading] = useState(false);
  const [attendanceActionMessage, setAttendanceActionMessage] = useState("");

  const [leaveForm, setLeaveForm] = useState({
    leave_type_id: "",
    start_date: "",
    end_date: "",
    reason: "",
  });

  async function loadAttendanceHistory() {
    if (!token) return;

    setAttendanceHistoryLoading(true);
    setAttendanceHistoryError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/employees/attendance/me`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to retrieve attendance history.",
        );
      }

      setAttendanceHistory(data.attendance || []);
    } catch (error) {
      setAttendanceHistoryError(error.message);
    } finally {
      setAttendanceHistoryLoading(false);
    }
  }

  async function loadPayslips() {
    if (!token) return;

    setPayslipsLoading(true);
    setPayslipsError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/payroll/my-payslips`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Unable to retrieve payslips.");
      }

      setPayslips(data.payslips || []);
    } catch (error) {
      setPayslipsError(error.message);
    } finally {
      setPayslipsLoading(false);
    }
  }

  async function handleDownloadPayslip(recordId, periodName) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/payroll/my-payslips/${recordId}/pdf`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Unable to download payslip.");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `Payslip_${periodName}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(downloadUrl);

      notify("Payslip downloaded successfully.");
    } catch (error) {
      notify(error.message);
    }
  }

  useEffect(() => {
    if (page === "My Payslips" && token) {
      loadPayslips();
    }
  }, [page, token]);

  async function handleAttendanceAction(action) {
    if (!token || attendanceActionLoading) return;

    setAttendanceActionLoading(true);
    setAttendanceActionMessage("");
    setAttendanceHistoryError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/employees/attendance/${action}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Attendance action failed.");
      }

      setAttendanceActionMessage(data.message);

      await loadAttendanceHistory();
      await loadDashboard();
    } catch (error) {
      setAttendanceActionMessage(error.message);
    } finally {
      setAttendanceActionLoading(false);
    }
  }

  async function loadLeaveData() {
    if (!token) return;

    setLeaveLoading(true);
    setLeaveError("");

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [typesResponse, requestsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/employees/leave-types`, { headers }),
        fetch(`${API_BASE_URL}/api/employees/leave-requests`, { headers }),
      ]);

      const typesData = await typesResponse.json();
      const requestsData = await requestsResponse.json();

      if (!typesResponse.ok) {
        throw new Error(typesData.message || "Unable to load leave types.");
      }

      if (!requestsResponse.ok) {
        throw new Error(
          requestsData.message || "Unable to load leave requests.",
        );
      }

      setLeaveTypes(typesData.leave_types || []);
      setLeaveRequests(requestsData.requests || []);
    } catch (error) {
      setLeaveError(error.message);
    } finally {
      setLeaveLoading(false);
    }
  }

  async function submitLeaveRequest() {
    if (!token) return;

    if (
      !leaveForm.leave_type_id ||
      !leaveForm.start_date ||
      !leaveForm.end_date
    ) {
      setLeaveError("Please complete the leave type and date fields.");
      return;
    }

    if (leaveForm.end_date < leaveForm.start_date) {
      setLeaveError("End date cannot be earlier than start date.");
      return;
    }

    setLeaveSubmitting(true);
    setLeaveError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/employees/leave-requests`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(leaveForm),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to submit leave request.");
      }

      notify(data.message || "Leave request submitted successfully.");

      setLeaveForm({
        leave_type_id: "",
        start_date: "",
        end_date: "",
        reason: "",
      });

      await loadLeaveData();
    } catch (error) {
      setLeaveError(error.message);
    } finally {
      setLeaveSubmitting(false);
    }
  }

  useEffect(() => {
    if (page === "My Attendance") {
      loadAttendanceHistory();
    }
  }, [page, token]);

  useEffect(() => {
    loadLeaveData();
  }, [token]);

  async function loadDashboard() {
    if (!token) return;

    setDashboardLoading(true);
    setDashboardError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/employees/dashboard`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to retrieve dashboard information.",
        );
      }

      setDashboardData(data.dashboard);
    } catch (error) {
      setDashboardError(error.message);
    } finally {
      setDashboardLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [token]);

  const employeeName = employeeProfile
    ? `${employeeProfile.first_name} ${employeeProfile.last_name}`
    : "Employee";

  const department = employeeProfile?.department_name || "Not assigned";
  const position = employeeProfile?.position_title || "Not assigned";

  const formatDate = (value) => {
    if (!value) return "Not provided";

    return new Date(value).toLocaleDateString("en-KE", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === "") {
      return "Not available";
    }

    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 2,
    }).format(Number(value));
  };

  const formatTime = (value) => {
    if (!value) return "—";

    return new Date(value).toLocaleTimeString("en-KE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const attendance = dashboardData?.attendance;
  const leave = dashboardData?.leave;
  const shifts = dashboardData?.upcoming_shifts || [];
  const payroll = dashboardData?.latest_payroll;
  const notifications = dashboardData?.notifications || [];

  const leaveBalances = leave?.balances || [];

  const annualLeave = leaveBalances.find(
    (item) => item.leave_name?.toLowerCase() === "annual leave",
  );

  if (profileLoading && !employeeProfile) {
    return (
      <Panel title="Loading employee profile">
        <p className="muted">Retrieving your information securely...</p>
      </Panel>
    );
  }

  if (profileError && !employeeProfile) {
    return (
      <Panel title="Unable to load employee profile">
        <div className="notice">
          <ShieldCheck size={18} />
          <span>{profileError}</span>
        </div>

        <button className="btn btn-primary" onClick={onRetryProfile}>
          Try again
        </button>
      </Panel>
    );
  }

  if (page === "My Attendance") {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const todayAttendance = attendanceHistory.find(
      (record) => String(record.attendance_date).slice(0, 10) === today,
    );

    const hasClockedIn = Boolean(todayAttendance?.clock_in);
    const hasClockedOut = Boolean(todayAttendance?.clock_out);

    return (
      <>
        <Stats
          items={[
            [
              "Days present",
              String(attendance?.days_present ?? 0),
              "This month",
              CalendarCheck,
            ],
            [
              "Days absent",
              String(attendance?.days_absent ?? 0),
              "This month",
              Clock3,
            ],
            [
              "Late arrivals",
              String(attendance?.days_late ?? 0),
              "This month",
              Activity,
            ],
            [
              "Hours worked",
              `${Number(attendance?.total_hours ?? 0).toFixed(1)} hrs`,
              "This month",
              TrendingUp,
            ],
          ]}
        />

        <Panel
          title="Today's Attendance"
          subtitle="Record your daily working hours"
        >
          {attendanceHistoryLoading && !attendanceHistory.length ? (
            <p className="muted">Checking today's attendance...</p>
          ) : (
            <>
              <div className="form-grid">
                <div>
                  <strong>Clock-in</strong>
                  <p>{formatTime(todayAttendance?.clock_in)}</p>
                </div>

                <div>
                  <strong>Clock-out</strong>
                  <p>{formatTime(todayAttendance?.clock_out)}</p>
                </div>

                <div>
                  <strong>Hours worked</strong>
                  <p>
                    {todayAttendance?.hours_worked != null
                      ? `${todayAttendance.hours_worked} hrs`
                      : "—"}
                  </p>
                </div>

                <div>
                  <strong>Status</strong>
                  <p>
                    {todayAttendance?.attendance_status || "Not clocked in"}
                  </p>
                </div>
              </div>

              {attendanceActionMessage && (
                <div className="notice">{attendanceActionMessage}</div>
              )}

              {attendanceHistoryError && (
                <div className="notice">{attendanceHistoryError}</div>
              )}

              <div className="form-actions">
                <button
                  className="btn btn-primary"
                  disabled={attendanceActionLoading || hasClockedIn}
                  onClick={() => handleAttendanceAction("clock-in")}
                >
                  {attendanceActionLoading
                    ? "Processing..."
                    : hasClockedIn
                      ? "Already Clocked In"
                      : "Clock In"}
                </button>

                <button
                  className="btn btn-secondary"
                  disabled={
                    attendanceActionLoading || !hasClockedIn || hasClockedOut
                  }
                  onClick={() => handleAttendanceAction("clock-out")}
                >
                  {hasClockedOut ? "Clock-out Completed" : "Clock Out"}
                </button>
              </div>
            </>
          )}
        </Panel>

        <Panel
          title="My Attendance History"
          subtitle="Your personal attendance records"
        >
          {attendanceHistoryError ? (
            <div className="notice">
              {attendanceHistoryError}
              <button
                className="btn btn-primary"
                onClick={loadAttendanceHistory}
              >
                Try again
              </button>
            </div>
          ) : attendanceHistoryLoading && !attendanceHistory.length ? (
            <p className="muted">Loading attendance records...</p>
          ) : (
            <SimpleTable
              headers={["DATE", "CLOCK IN", "CLOCK OUT", "HOURS", "STATUS"]}
              rows={attendanceHistory.map((record) => [
                formatDate(record.attendance_date),
                formatTime(record.clock_in),
                formatTime(record.clock_out),
                record.hours_worked == null
                  ? "—"
                  : `${record.hours_worked} hrs`,
                record.attendance_status || "Pending",
              ])}
            />
          )}
        </Panel>
      </>
    );
  }

  if (page === "My Payslips") {
    const latestPayslip = payslips[0];

    return (
      <>
        {payslipsLoading && payslips.length === 0 ? (
          <Panel title="My Payslips">
            <p>Loading your payslips...</p>
          </Panel>
        ) : payslipsError ? (
          <Panel title="My Payslips">
            <div className="notice">
              <ShieldCheck size={18} />
              {payslipsError}
            </div>
            <button className="btn btn-primary" onClick={loadPayslips}>
              Retry
            </button>
          </Panel>
        ) : payslips.length === 0 ? (
          <Panel title="My Payslips">
            <p>No approved or paid payslips are available yet.</p>
          </Panel>
        ) : (
          <>
            <div className="page-actions">
              <button
                className="btn btn-secondary"
                onClick={loadPayslips}
                disabled={payslipsLoading}
              >
                {payslipsLoading ? "Refreshing..." : "Refresh payslips"}
              </button>
            </div>

            <div className="payslip-highlight">
              <div>
                <span>{latestPayslip.period_name} · Net salary</span>
                <h2>{formatCurrency(latestPayslip.net_salary)}</h2>
                <small>Payment status: {latestPayslip.payment_status}</small>
                <small>
                  Payment date:{" "}
                  {latestPayslip.payment_date
                    ? formatDate(latestPayslip.payment_date)
                    : "Not yet paid"}
                </small>
              </div>
              <button
                className="btn btn-primary"
                onClick={() =>
                  handleDownloadPayslip(
                    latestPayslip.payroll_record_id,
                    latestPayslip.period_name,
                  )
                }
              >
                <Download size={16} />
                Download payslip
              </button>
            </div>

            <div className="dashboard-grid">
              <Panel title="Earnings">
                {latestPayslip.payroll_items
                  ?.filter((item) => item.item_type === "EARNING")
                  .map((item) => (
                    <MoneyRow
                      key={item.id}
                      label={item.description}
                      value={formatCurrency(item.amount)}
                    />
                  ))}

                <MoneyRow
                  label="Gross pay"
                  value={formatCurrency(latestPayslip.gross_salary)}
                  total
                />
              </Panel>

              <Panel title="Deductions">
                {latestPayslip.payroll_items
                  ?.filter((item) => item.item_type === "DEDUCTION")
                  .map((item) => (
                    <MoneyRow
                      key={item.id}
                      label={item.description}
                      value={formatCurrency(item.amount)}
                    />
                  ))}

                <MoneyRow
                  label="Total deductions"
                  value={formatCurrency(latestPayslip.total_deductions)}
                  total
                />
              </Panel>
            </div>

            <Panel title="Employer Contributions">
              {latestPayslip.payroll_items
                ?.filter((item) => item.item_type === "EMPLOYER_CONTRIBUTION")
                .map((item) => (
                  <MoneyRow
                    key={item.id}
                    label={item.description}
                    value={formatCurrency(item.amount)}
                  />
                ))}

              {!latestPayslip.payroll_items?.some(
                (item) => item.item_type === "EMPLOYER_CONTRIBUTION",
              ) && <p>No employer contributions recorded.</p>}
            </Panel>

            <Panel title="Previous payslips">
              <SimpleTable
                headers={["PERIOD", "GROSS PAY", "NET PAY", "STATUS"]}
                rows={payslips
                  .slice(1)
                  .map((payslip) => [
                    payslip.period_name,
                    formatCurrency(payslip.gross_salary),
                    formatCurrency(payslip.net_salary),
                    payslip.payment_status,
                  ])}
              />
              {payslips.length === 1 && <p>No previous payslips available.</p>}
            </Panel>
          </>
        )}
      </>
    );
  }

  if (page === "My Shifts") {
    return (
      <Panel title="My shift schedule" subtitle="Upcoming assigned shifts">
        {shifts.length === 0 ? (
          <p className="muted">No upcoming shifts have been assigned.</p>
        ) : (
          <SimpleTable
            headers={["DATE", "SHIFT", "START", "END"]}
            rows={shifts.map((shift) => [
              formatDate(shift.shift_date),
              shift.shift_name,
              shift.start_time,
              shift.end_time,
            ])}
          />
        )}
      </Panel>
    );
  }

  if (page === "Apply for Leave")
    return (
      <div className="page-content">
        <Panel title="Leave application">
          {leaveError && <div className="alert alert-error">{leaveError}</div>}

          {leaveLoading ? (
            <p>Loading leave information...</p>
          ) : (
            <>
              <div className="form-grid">
                <Field label="Leave type">
                  <select
                    value={leaveForm.leave_type_id}
                    onChange={(e) =>
                      setLeaveForm({
                        ...leaveForm,
                        leave_type_id: e.target.value,
                      })
                    }
                    required
                  >
                    <option value="">Select leave type</option>

                    {leaveTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.leave_name}
                        {type.is_paid ? " (Paid)" : " (Unpaid)"}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Start date">
                  <input
                    type="date"
                    value={leaveForm.start_date}
                    onChange={(e) =>
                      setLeaveForm({
                        ...leaveForm,
                        start_date: e.target.value,
                      })
                    }
                    required
                  />
                </Field>

                <Field label="End date">
                  <input
                    type="date"
                    min={leaveForm.start_date || undefined}
                    value={leaveForm.end_date}
                    onChange={(e) =>
                      setLeaveForm({
                        ...leaveForm,
                        end_date: e.target.value,
                      })
                    }
                    required
                  />
                </Field>

                <Field label="Reason">
                  <textarea
                    placeholder="Provide a brief reason..."
                    value={leaveForm.reason}
                    onChange={(e) =>
                      setLeaveForm({
                        ...leaveForm,
                        reason: e.target.value,
                      })
                    }
                  />
                </Field>
              </div>

              <button
                className="btn btn-primary"
                onClick={submitLeaveRequest}
                disabled={leaveSubmitting || leaveTypes.length === 0}
              >
                {leaveSubmitting ? "Submitting..." : "Submit application"}
              </button>
            </>
          )}
        </Panel>

        <Panel title="My leave history">
          {leaveLoading ? (
            <p>Loading leave history...</p>
          ) : leaveRequests.length === 0 ? (
            <p>No leave requests found.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Leave type</th>
                    <th>Start date</th>
                    <th>End date</th>
                    <th>Days</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {leaveRequests.map((request) => (
                    <tr key={request.id}>
                      <td>{request.leave_name}</td>
                      <td>{request.start_date?.slice(0, 10)}</td>
                      <td>{request.end_date?.slice(0, 10)}</td>
                      <td>{request.total_days}</td>
                      <td>{request.request_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    );

  if (page === "My Profile")
    return (
      <Panel
        title="My employee profile"
        subtitle="Your employment information retrieved from the hospital database."
      >
        <div className="profile-banner">
          <div className="avatar avatar-large">
            {employeeProfile
              ? `${employeeProfile.first_name?.[0] || ""}${employeeProfile.last_name?.[0] || ""}`
              : "U"}
          </div>

          <div>
            <h2>{employeeName}</h2>
            <p>
              {position} · {department}
            </p>

            <span
              className={`status ${
                employeeProfile?.employment_status === "ACTIVE"
                  ? "status-green"
                  : "status-orange"
              }`}
            >
              {employeeProfile?.employment_status || "Status unavailable"}
            </span>
          </div>
        </div>

        <div className="detail-grid">
          <Detail
            label="Employee number"
            value={employeeProfile?.employee_number || "Not provided"}
          />

          <Detail
            label="Login email"
            value={employeeProfile?.login_email || "Not provided"}
          />

          <Detail
            label="Personal email"
            value={employeeProfile?.personal_email || "Not provided"}
          />

          <Detail
            label="Phone number"
            value={employeeProfile?.phone || "Not provided"}
          />

          <Detail label="Department" value={department} />

          <Detail label="Position" value={position} />

          <Detail
            label="Employment type"
            value={employeeProfile?.employment_type || "Not provided"}
          />

          <Detail
            label="Date joined"
            value={formatDate(employeeProfile?.hire_date)}
          />

          <Detail
            label="Date of birth"
            value={formatDate(employeeProfile?.date_of_birth)}
          />

          <Detail
            label="Gender"
            value={employeeProfile?.gender || "Not provided"}
          />

          <Detail
            label="Supervisor"
            value={employeeProfile?.supervisor_name || "Not assigned"}
          />

          <Detail
            label="Base salary"
            value={formatCurrency(employeeProfile?.base_salary)}
          />

          <Detail
            label="Address"
            value={employeeProfile?.address || "Not provided"}
          />
        </div>

        <div className="notice">
          <ShieldCheck size={18} />
          Your profile information is retrieved using your authenticated
          employee account.
        </div>

        <button
          className="btn btn-light"
          onClick={onRetryProfile}
          disabled={profileLoading}
        >
          {profileLoading ? "Refreshing..." : "Refresh profile"}
        </button>
      </Panel>
    );

  if (page === "Notifications") {
    return (
      <Panel title="Notifications">
        {notifications.length === 0 ? (
          <p className="muted">You have no recent notifications.</p>
        ) : (
          notifications.map((item) => (
            <Notification
              key={item.id}
              title={item.title}
              body={item.message}
              time={formatDate(item.sent_at || item.created_at)}
            />
          ))
        )}
      </Panel>
    );
  }

  return (
    <>
      <div className="welcome-card">
        <div>
          <span className="eyebrow light">EMPLOYEE SELF-SERVICE</span>
          <h2>
            Welcome, {employeeProfile?.first_name || "Employee"} <span>☀️</span>
          </h2>
          <p>
            {position} · {department}
          </p>
        </div>

        <div className="welcome-icon">
          <UserRound size={42} />
        </div>
      </div>

      {dashboardLoading && !dashboardData ? (
        <Panel title="Loading your dashboard">
          <p className="muted">Retrieving your latest hospital records...</p>
        </Panel>
      ) : dashboardError && !dashboardData ? (
        <Panel title="Unable to load dashboard">
          <div className="notice">
            <ShieldCheck size={18} />
            <span>{dashboardError}</span>
          </div>

          <button className="btn btn-primary" onClick={loadDashboard}>
            Try again
          </button>
        </Panel>
      ) : (
        <>
          <Stats
            items={[
              [
                "Attendance this month",
                `${attendance?.days_present ?? 0} days`,
                `${attendance?.days_absent ?? 0} days absent`,
                CalendarCheck,
              ],
              [
                "Annual leave balance",
                annualLeave?.days_remaining == null
                  ? "Not available"
                  : `${annualLeave.days_remaining} days`,
                "Based on approved leave",
                Clock3,
              ],
              [
                "Next shift",
                shifts.length > 0 ? shifts[0].start_time : "Not assigned",
                shifts.length > 0
                  ? formatDate(shifts[0].shift_date)
                  : "No upcoming shift",
                CalendarDays,
              ],
              [
                "Latest payslip",
                payroll ? formatCurrency(payroll.net_salary) : "Not available",
                payroll?.period_name || "No payroll record",
                Wallet,
              ],
            ]}
          />

          <div className="dashboard-grid">
            <Panel title="Upcoming shift">
              {shifts.length > 0 ? (
                <>
                  <div className="shift-panel">
                    <div className="shift-time">
                      <strong>{shifts[0].start_time}</strong>
                      <span>Start</span>
                    </div>

                    <div className="shift-line">
                      <i />
                    </div>

                    <div className="shift-time">
                      <strong>{shifts[0].end_time}</strong>
                      <span>Finish</span>
                    </div>
                  </div>

                  <p className="muted small">
                    {shifts[0].shift_name} · {formatDate(shifts[0].shift_date)}
                  </p>
                </>
              ) : (
                <p className="muted">No upcoming shift assigned.</p>
              )}
            </Panel>

            <Panel title="Quick actions">
              <div className="quick-actions">
                <button
                  onClick={() =>
                    notify("Choose Apply for Leave from the sidebar.")
                  }
                >
                  <CalendarCheck />
                  Apply for leave
                </button>

                <button
                  onClick={() => notify("Choose My Payslips from the sidebar.")}
                >
                  <Wallet />
                  View payslip
                </button>

                <button
                  onClick={() =>
                    notify("Choose My Attendance from the sidebar.")
                  }
                >
                  <Clock3 />
                  Attendance history
                </button>
              </div>
            </Panel>
          </div>

          <Panel title="Recent notifications">
            {notifications.length === 0 ? (
              <p className="muted">No recent notifications.</p>
            ) : (
              notifications
                .slice(0, 3)
                .map((item) => (
                  <Notification
                    key={item.id}
                    title={item.title}
                    body={item.message}
                    time={formatDate(item.sent_at || item.created_at)}
                  />
                ))
            )}
          </Panel>
        </>
      )}
    </>
  );
}

function PatientPage({ page, appointments, onBook, notify }) {
  if (page === "Book Appointment")
    return (
      <Panel
        title="Request an appointment"
        subtitle="Submit your preferred service and date. The hospital will confirm availability."
      >
        <div className="form-grid">
          <Field label="Full name">
            <input placeholder="Enter your full name" />
          </Field>
          <Field label="Phone number">
            <input placeholder="+254 7XX XXX XXX" />
          </Field>
          <Field label="Service">
            <select>
              <option>General consultation</option>
              <option>Dental consultation</option>
              <option>Maternity services</option>
              <option>Laboratory services</option>
              <option>Pharmacy</option>
            </select>
          </Field>
          <Field label="Preferred date">
            <input type="date" />
          </Field>
        </div>
        <button className="btn btn-primary" onClick={onBook}>
          Continue appointment request
        </button>
        <p className="muted small">
          This prototype does not transmit or book real appointments.
        </p>
      </Panel>
    );
  if (page === "My Appointments")
    return (
      <Panel
        title="My appointment requests"
        action="Request appointment"
        onAction={onBook}
      >
        <div className="appointment-list">
          {appointments.map((a, i) => (
            <div className="appointment-row" key={i}>
              <div className="appointment-icon">
                <CalendarDays />
              </div>
              <div className="appointment-info">
                <strong>{a.service}</strong>
                <span>
                  {a.date} · {a.time}
                </span>
              </div>
              <Status value={a.status} />
            </div>
          ))}
        </div>
      </Panel>
    );
  if (page === "My Profile")
    return (
      <Panel title="My profile">
        <div className="profile-banner">
          <div className="avatar avatar-large">PC</div>
          <div>
            <h2>Patient / Client</h2>
            <p>Portal account</p>
            <span className="status status-green">Account active · Demo</span>
          </div>
        </div>
        <div className="notice">
          Your personal information will be managed separately from employee HR
          records.
        </div>
      </Panel>
    );
  if (page === "Enquiries & Feedback")
    return (
      <Panel
        title="Contact the hospital"
        subtitle="Send a question or feedback to the hospital team."
      >
        <div className="form-grid">
          <Field label="Full name">
            <input placeholder="Your name" />
          </Field>
          <Field label="Phone or email">
            <input placeholder="Contact details" />
          </Field>
          <Field label="Subject">
            <input placeholder="How can we help?" />
          </Field>
          <Field label="Message">
            <textarea placeholder="Write your message..." />
          </Field>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => notify("Enquiry submitted in prototype mode.")}
        >
          Submit enquiry
        </button>
      </Panel>
    );
  if (page === "Hospital Information")
    return (
      <div className="info-grid">
        <div className="info-card">
          <HeartPulse />
          <h3>Our hospital</h3>
          <p>
            St Teresa Hospital provides healthcare services with a commitment to
            trusted, patient-centred care.
          </p>
        </div>
        <div className="info-card">
          <Clock3 />
          <h3>Availability</h3>
          <p>
            Contact the hospital to confirm service hours and appointment
            availability.
          </p>
        </div>
        <div className="info-card">
          <MessageSquare />
          <h3>Get in touch</h3>
          <p>
            Use the Enquiries & Feedback section to send a message to the
            hospital.
          </p>
        </div>
      </div>
    );
  return (
    <>
      <div className="patient-hero">
        <div>
          <span className="eyebrow light">ST TERESA HOSPITAL</span>
          <h2>Your care journey, made simpler.</h2>
          <p>
            Request appointments, check appointment updates and contact our team
            from one place.
          </p>
          <button className="btn btn-primary" onClick={onBook}>
            <CalendarDays size={16} /> Request an appointment
          </button>
        </div>
        <div className="hero-symbol">
          <HeartPulse size={74} />
        </div>
      </div>
      <div className="dashboard-grid">
        <Panel title="Upcoming appointments">
          <div className="appointment-list">
            {appointments.slice(0, 2).map((a, i) => (
              <div className="appointment-row" key={i}>
                <div className="appointment-icon">
                  <CalendarDays />
                </div>
                <div className="appointment-info">
                  <strong>{a.service}</strong>
                  <span>
                    {a.date} · {a.time}
                  </span>
                </div>
                <Status value={a.status} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Patient portal services">
          <div className="quick-actions">
            <button onClick={onBook}>
              <CalendarDays />
              Book appointment
            </button>
            <button
              onClick={() => notify("Open My Appointments from the sidebar.")}
            >
              <ClipboardList />
              View appointments
            </button>
            <button
              onClick={() =>
                notify("Open Enquiries & Feedback from the sidebar.")
              }
            >
              <MessageSquare />
              Send an enquiry
            </button>
          </div>
        </Panel>
      </div>
    </>
  );
}

function Stats({ items }) {
  return (
    <div className="stats-grid">
      {items.map(([label, value, sub, Icon]) => (
        <div className="stat-card" key={label}>
          <div className="stat-top">
            <span>{label}</span>
            <div className="stat-icon">
              <Icon size={18} />
            </div>
          </div>
          <strong>{value}</strong>
          <small>{sub}</small>
        </div>
      ))}
    </div>
  );
}
function Panel({ title, subtitle, action, onAction, children }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action && (
          <button className="text-action" onClick={onAction}>
            {action}
            <ArrowUpRight size={14} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
function SimpleTable({ headers, rows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td key={j}>
                  {j === r.length - 1 &&
                  [
                    "Present",
                    "On duty",
                    "On leave",
                    "Off shift",
                    "Late",
                    "Scheduled",
                    "Pending",
                    "Approved",
                    "Paid",
                    "Open",
                    "Draft",
                    "Confirmed",
                    "Completed",
                  ].includes(v) ? (
                    <Status value={v} />
                  ) : (
                    v
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Status({ value }) {
  const cls = [
    "Present",
    "On duty",
    "Approved",
    "Paid",
    "Confirmed",
    "Completed",
    "Active",
  ].includes(value)
    ? "green"
    : ["Pending", "Late", "Scheduled", "Draft", "On leave", "Open"].includes(
          value,
        )
      ? "orange"
      : "grey";
  return (
    <span className={`status status-${cls}`}>
      <i />
      {value}
    </span>
  );
}
function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function MoneyRow({ label, value, total }) {
  return (
    <div className={`money-row ${total ? "money-total" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Detail({ label, value }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Notification({ title, body, time }) {
  return (
    <div className="notification-row">
      <div className="notification-bullet" />
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
        <small>{time}</small>
      </div>
    </div>
  );
}

function Modal({ portal, form, setForm, onClose, onSubmit }) {
  const isPatient = portal === "Patient / Client";
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal">
        <div className="modal-head">
          <div>
            <h2>{isPatient ? "Request an appointment" : "Add employee"}</h2>
            <p>
              {isPatient
                ? "Enter your details and preferred date."
                : "Create a staff record (demo form)."}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="modal-body">
          <Field label={isPatient ? "Full name *" : "Employee full name"}>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Full name"
            />
          </Field>
          <Field label={isPatient ? "Phone number *" : "Work email"}>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder={
                isPatient ? "+254 7XX XXX XXX" : "name@stteresahospital.co.ke"
              }
            />
          </Field>
          {isPatient && (
            <>
              <Field label="Service">
                <select
                  value={form.service}
                  onChange={(e) =>
                    setForm({ ...form, service: e.target.value })
                  }
                >
                  <option>General consultation</option>
                  <option>Dental consultation</option>
                  <option>Maternity services</option>
                  <option>Laboratory services</option>
                </select>
              </Field>
              <Field label="Preferred date *">
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </Field>
            </>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn btn-light" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onSubmit}>
            {isPatient ? "Submit request" : "Save employee"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
