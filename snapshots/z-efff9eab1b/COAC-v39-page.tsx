"use client";

import { FormEvent, useDeferredValue, useEffect, useMemo, useState } from "react";
import type { Models } from "appwrite";
import { account, appwriteConfig, ID, Query, tables } from "../lib/appwrite";

type View = "Dashboard" | "Inventory" | "Rooms & Keys" | "Borrowers" | "Transactions";
type ItemStatus = "Available" | "Borrowed" | "Maintenance";
type LoanStatus = "Pending" | "On time" | "Due today" | "Overdue" | "Key out" | "Returned" | "Declined";
type LoanKind = "Tool" | "Room Key";
type BorrowerType = "Student" | "Professor";
type AccessRole = "admin" | "student" | "professor" | "borrower";
type PrintFormMode = "release" | "return" | "complete";
type AccountPrefs = Models.Preferences & {
  role?: AccessRole;
  studentId?: string;
  program?: string;
  borrowerType?: BorrowerType;
};
type ModalMode = "tool" | "room";
type ManageModalMode = "addTool" | "addRoom";
type DeleteTarget = { kind: "tool" | "room"; id: string; label: string };
type ToolUnitSelection = { assetId: string; unitNumber: number };
type ToolUnitMeta = { label?: string; condition?: string; notes?: string };
type CloudStatus = "checking" | "offline" | "syncing" | "synced" | "error";
type CloudRow = Models.Row & { kind: "tool" | "room" | "loan"; data: string };

type Tool = {
  id: string;
  name: string;
  category: string;
  location: string;
  status: ItemStatus;
  quantity?: number;
  model?: string;
  condition?: string;
  notes?: string;
  maintenanceUnits?: number[];
  deletedUnits?: number[];
  unitDetails?: Record<string, ToolUnitMeta>;
};

type RoomKey = {
  id: string;
  room: string;
  use: string;
  storage: string;
  status: ItemStatus;
};

type Loan = {
  id: number;
  student: string;
  studentId: string;
  program: string;
  borrowerType?: BorrowerType;
  item: string;
  assetId: string;
  borrowed: string;
  borrowedAtIso?: string;
  requestedAt?: string;
  requestedAtIso?: string;
  requestedDays?: number;
  due: string;
  returnedAt?: string;
  returnCondition?: string;
  returnRemarks?: string;
  postReturnMaintenance?: boolean;
  status: LoanStatus;
  kind?: LoanKind;
  purpose?: string;
  unitNumber?: number;
  borrowBatchId?: string;
};

type ToolCategory =
  | "All Tools"
  | "Electrical Tools"
  | "Measuring Tools"
  | "Electronics Equipment"
  | "Power Tools"
  | "Kits & Modules";

const views: View[] = ["Dashboard", "Inventory", "Rooms & Keys", "Borrowers", "Transactions"];

const toolsSeed: Tool[] = [
  { id: "TL-VC-0123", name: "Vernier Caliper", category: "Measuring Tools", location: "Cabinet A", status: "Borrowed" },
  { id: "TL-DMM-0047", name: "Digital Multimeter", category: "Electrical Tools", location: "Cabinet B", status: "Borrowed" },
  { id: "TL-SS-0012", name: "Soldering Station", category: "Electronics Equipment", location: "Bench 03", status: "Borrowed" },
  { id: "TL-AK-0231", name: "Arduino Kit", category: "Kits & Modules", location: "Cabinet C", status: "Borrowed" },
  { id: "TL-CD-0088", name: "Cordless Drill", category: "Power Tools", location: "Tool Cage", status: "Borrowed" },
  { id: "TL-OS-0018", name: "Oscilloscope", category: "Electronics Equipment", location: "Bench 01", status: "Available" },
  { id: "TL-PS-0034", name: "DC Power Supply", category: "Electrical Tools", location: "Bench 02", status: "Available" },
  { id: "TL-TW-0106", name: "Torque Wrench", category: "Measuring Tools", location: "Cabinet A", status: "Available" },
  { id: "TL-PG-0015", name: "Pneumatic Gauge", category: "Measuring Tools", location: "Cabinet D", status: "Maintenance" },
  { id: "TL-RK-0042", name: "Raspberry Pi Kit", category: "Kits & Modules", location: "Cabinet C", status: "Available" },
  { id: "TL-HG-0029", name: "Heat Gun", category: "Power Tools", location: "Tool Cage", status: "Available" },
  { id: "TL-CR-0114", name: "Crimping Tool", category: "Electrical Tools", location: "Cabinet B", status: "Maintenance" },
];

const roomKeysSeed: RoomKey[] = [
  { id: "KEY-COAC-101", room: "COAC 101", use: "Automation Laboratory", storage: "Tool Crib Key Board", status: "Available" },
  { id: "KEY-COAC-102", room: "COAC 102", use: "Mechatronics Laboratory", storage: "Tool Crib Key Board", status: "Available" },
  { id: "KEY-COAC-103", room: "COAC 103", use: "Robotics Laboratory", storage: "Tool Crib Key Board", status: "Available" },
  { id: "KEY-COAC-104", room: "COAC 104", use: "Electronics Laboratory", storage: "Tool Crib Key Board", status: "Available" },
  { id: "KEY-COAC-105", room: "COAC 105", use: "Control Systems Laboratory", storage: "Tool Crib Key Board", status: "Available" },
  { id: "KEY-COAC-FAB", room: "Fabrication Room", use: "Machining and Fabrication", storage: "Tool Crib Key Board", status: "Available" },
];

const loansSeed: Loan[] = [
  { id: 1, student: "Miguel Santos", studentId: "TUPV-23-0412", program: "BSMxE 3A", item: "Vernier Caliper 1", assetId: "TL-VC-0123", unitNumber: 1, borrowed: "May 12, 2025, 9:15 AM", due: "May 19, 2025", status: "On time", kind: "Tool" },
  { id: 2, student: "Aisha Reyes", studentId: "TUPV-23-0188", program: "BETMxT 3A", item: "Digital Multimeter 1", assetId: "TL-DMM-0047", unitNumber: 1, borrowed: "May 10, 2025, 10:30 AM", due: "May 17, 2025", status: "Due today", kind: "Tool" },
  { id: 3, student: "Kenneth Lim", studentId: "TUPV-22-0304", program: "BSMxE 4A", item: "Soldering Station 1", assetId: "TL-SS-0012", unitNumber: 1, borrowed: "May 6, 2025, 1:45 PM", due: "May 13, 2025", status: "Overdue", kind: "Tool" },
  { id: 4, student: "Clara Delgado", studentId: "TUPV-24-0267", program: "BETMxT 2A", item: "Arduino Kit 1", assetId: "TL-AK-0231", unitNumber: 1, borrowed: "May 9, 2025, 2:10 PM", due: "May 16, 2025", status: "On time", kind: "Tool" },
  { id: 5, student: "Jose Cruz", studentId: "TUPV-23-0076", program: "BSMxE 3B", item: "Cordless Drill 1", assetId: "TL-CD-0088", unitNumber: 1, borrowed: "May 11, 2025, 3:25 PM", due: "May 18, 2025", status: "On time", kind: "Tool" },
];

const toolCategories: ToolCategory[] = [
  "All Tools",
  "Electrical Tools",
  "Measuring Tools",
  "Electronics Equipment",
  "Power Tools",
  "Kits & Modules",
];

const toolCategoryMeta: Record<ToolCategory, { subtitle: string }> = {
  "All Tools": { subtitle: "Complete inventory" },
  "Electrical Tools": { subtitle: "Meters & power" },
  "Measuring Tools": { subtitle: "Calipers & gauges" },
  "Electronics Equipment": { subtitle: "Bench equipment" },
  "Power Tools": { subtitle: "Portable equipment" },
  "Kits & Modules": { subtitle: "Boards & modules" },
};

function ToolCategoryIcon({ category }: { category: ToolCategory }) {
  if (category === "All Tools") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.6" />
        <rect x="14" y="3" width="7" height="7" rx="1.6" />
        <rect x="3" y="14" width="7" height="7" rx="1.6" />
        <rect x="14" y="14" width="7" height="7" rx="1.6" />
      </svg>
    );
  }

  if (category === "Electrical Tools") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13.5 2 5.5 13h6l-1 9L18.5 11h-6l1-9Z" />
      </svg>
    );
  }

  if (category === "Measuring Tools") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 16.5 16.5 4 20 7.5 7.5 20 4 16.5Z" />
        <path d="m9 14 1.8 1.8M12 11l1.8 1.8M15 8l1.8 1.8" />
      </svg>
    );
  }

  if (category === "Electronics Equipment") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="6" y="6" width="12" height="12" rx="2.2" />
        <path d="M9 9h6v6H9zM9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
      </svg>
    );
  }

  if (category === "Power Tools") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.8 4.1a5.2 5.2 0 0 0-6.7 6.7L3 15.9a2.2 2.2 0 0 0 3.1 3.1l5.1-5.1a5.2 5.2 0 0 0 6.7-6.7l-3.1 3.1-2.9-.8-.8-2.9 3.7-2.5Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12.1V21" />
    </svg>
  );
}

const fmt = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const fmtDateTime = (date: Date) =>
  date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

const kindOf = (loan: Loan): LoanKind => loan.kind ?? "Tool";
const borrowerTypeOf = (loan: Loan): BorrowerType => loan.borrowerType ?? "Student";
const unitNumberOf = (loan: Loan) => loan.unitNumber ?? 1;
const assetLabelOf = (loan: Loan) =>
  kindOf(loan) === "Tool" ? `${loan.assetId}-${unitNumberOf(loan)}` : loan.assetId;
const TRANSACTION_ERASE_PASSWORD = "REDACTED_CONFIG_VALUE";
const DEFAULT_RELEASING_OFFICER = "Sir John Ray";

const accountPrefsOf = (user: Models.User<Models.Preferences>): AccountPrefs =>
  user.prefs as AccountPrefs;

const accessRoleOf = (user: Models.User<Models.Preferences>): AccessRole => {
  const prefs = accountPrefsOf(user);
  const labels = Array.isArray((user as Models.User<Models.Preferences> & { labels?: string[] }).labels)
    ? (user as Models.User<Models.Preferences> & { labels?: string[] }).labels ?? []
    : [];
  if (labels.includes("admin")) return "admin";
  if (prefs.role === "borrower" || prefs.role === "student" || prefs.role === "professor") return prefs.role;
  // Legacy COAC accounts created before role support stay administrative.
  return "admin";
};

const transactionNumberOf = (loan: Loan) => {
  const date = new Date(loan.borrowedAtIso ?? loan.requestedAtIso ?? loan.id);
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  return `COAC-${year}-${String(loan.id).slice(-6).padStart(6, "0")}`;
};

const borrowingBatchKeyOf = (loan: Loan) => {
  if (loan.borrowBatchId) return loan.borrowBatchId;
  const moment = loan.borrowedAtIso ?? loan.requestedAtIso ?? loan.borrowed ?? loan.requestedAt ?? String(loan.id);
  return `${loan.studentId}::${loan.student}::${moment}`;
};

const borrowingBatchNumberOf = (loans: Loan[]) => {
  const primary = loans[0];
  if (!primary) return "COAC-TRANSACTION";
  const date = new Date(primary.borrowedAtIso ?? primary.requestedAtIso ?? primary.id);
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  const seed = primary.borrowBatchId ?? String(primary.id);
  const digits = seed.replace(/\D/g, "").slice(-6) || String(primary.id).slice(-6);
  return `COAC-${year}-${digits.padStart(6, "0")}`;
};

const cloudRowId = (kind: "tool" | "room" | "loan", value: string | number) => {
  const raw = String(value);
  const clean = raw.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^[^a-zA-Z0-9]+/, "");
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  }
  return `${kind}-${clean.slice(0, 23)}-${hash.toString(36)}`.slice(0, 36);
};

const appwriteErrorMessage = (error: unknown) => {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "The cloud service could not complete the request.";
};

const isToday = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

function HeroClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="hero-clock" aria-label="Current date and time">
      <span>{now.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
      <strong>{now.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", second: "2-digit" })}</strong>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("Dashboard");
  const [query, setQuery] = useState("");
  const [toolCategory, setToolCategory] = useState<ToolCategory>("All Tools");
  const [inventoryTab, setInventoryTab] = useState<"inventory" | "maintenance">("inventory");
  const [tools, setTools] = useState<Tool[]>(toolsSeed);
  const [roomKeys, setRoomKeys] = useState<RoomKey[]>(roomKeysSeed);
  const [loans, setLoans] = useState<Loan[]>(loansSeed);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [selectedAsset, setSelectedAsset] = useState("");
  const [selectedToolUnits, setSelectedToolUnits] = useState<ToolUnitSelection[]>([]);
  const [toolSearch, setToolSearch] = useState("");
  const [toolSearchOpen, setToolSearchOpen] = useState(false);
  const [alerts, setAlerts] = useState(false);
  const [openBorrower, setOpenBorrower] = useState<string | null>(null);
  const [openTransactionGroups, setOpenTransactionGroups] = useState<string[]>([]);
  const [transactionTab, setTransactionTab] = useState<"borrowing" | "key-logs" | "history">("borrowing");
  const [historyView, setHistoryView] = useState<"day" | "month" | "year">("month");
  const [historyDay, setHistoryDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [historyMonth, setHistoryMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [historyYear, setHistoryYear] = useState(() => String(new Date().getFullYear()));
  const [borrowerFilter, setBorrowerFilter] = useState<"all" | "first" | "second" | "third" | "fourth" | "professors">("all");
  const [borrowerCourseFilter, setBorrowerCourseFilter] = useState("all");
  const [borrowerSectionFilter, setBorrowerSectionFilter] = useState("all");
  const [toast, setToast] = useState("");
  const [ready, setReady] = useState(false);
  const [eraseModalOpen, setEraseModalOpen] = useState(false);
  const [erasePassword, setErasePassword] = useState("");
  const [eraseError, setEraseError] = useState("");
  const [manageModal, setManageModal] = useState<ManageModalMode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteInventoryOpen, setDeleteInventoryOpen] = useState(false);
  const [selectedToolDetails, setSelectedToolDetails] = useState<Tool | null>(null);
  const [selectedUnitEditor, setSelectedUnitEditor] = useState<{ toolId: string; unitNumber: number } | null>(null);
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<string | null>(null);
  const [selectedRoomHistoryId, setSelectedRoomHistoryId] = useState<string | null>(null);
  const [returnEvaluationLoanId, setReturnEvaluationLoanId] = useState<number | null>(null);
  const [returnCondition, setReturnCondition] = useState("Good");
  const [returnSendMaintenance, setReturnSendMaintenance] = useState(false);
  const [printLoanId, setPrintLoanId] = useState<number | null>(null);
  const [cloudUser, setCloudUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("checking");
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  const accessRole = cloudUser ? accessRoleOf(cloudUser) : "borrower";
  const isAdmin = accessRole === "admin";
  useEffect(() => {
    let cancelled = false;

    const openBorrowerSession = async () => {
      try {
        const user = await account.get();
        if (!cancelled) {
          setCloudUser(user);
          setCloudStatus("syncing");
        }
        return;
      } catch {
        // No signed-in session. Borrowers do not need personal accounts, so create
        // one anonymous Tool Crib session only for database access.
      }

      try {
        await account.createAnonymousSession();
        await account.updatePrefs({ prefs: { role: "borrower" } });
        const borrowerSession = await account.get();
        if (!cancelled) {
          setCloudUser(borrowerSession);
          setCloudStatus("syncing");
        }
      } catch (error) {
        console.error("Borrower access could not start", error);
        if (!cancelled) setCloudStatus("offline");
      }
    };

    void openBorrowerSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const savedTools = localStorage.getItem("coac-tools");
      const savedRooms = localStorage.getItem("coac-room-keys");
      const savedLoans = localStorage.getItem("coac-loans");

      if (savedTools) setTools(JSON.parse(savedTools) as Tool[]);
      if (savedRooms) setRoomKeys(JSON.parse(savedRooms) as RoomKey[]);
      if (savedLoans) {
        const parsed = JSON.parse(savedLoans) as Loan[];
        setLoans(
          parsed.map((loan) => {
            const kind = loan.kind ?? "Tool";
            const inferredBorrowedAt = loan.borrowedAtIso
              ? new Date(loan.borrowedAtIso)
              : loan.id > 1_000_000_000_000
                ? new Date(loan.id)
                : null;
            const hasValidBorrowedTime =
              inferredBorrowedAt && !Number.isNaN(inferredBorrowedAt.getTime());
            const normalizedLoan: Loan = {
              ...loan,
              kind,
              borrowed: hasValidBorrowedTime ? fmtDateTime(inferredBorrowedAt) : loan.borrowed,
              borrowedAtIso: hasValidBorrowedTime
                ? inferredBorrowedAt.toISOString()
                : loan.borrowedAtIso,
            };
            if (kind === "Tool" && !loan.unitNumber) {
              return {
                ...normalizedLoan,
                unitNumber: 1,
                item: /\s\d+$/.test(loan.item) ? loan.item : `${loan.item} 1`,
              };
            }
            return normalizedLoan;
          }),
        );
      }
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem("coac-tools", JSON.stringify(tools));
    localStorage.setItem("coac-room-keys", JSON.stringify(roomKeys));
    localStorage.setItem("coac-loans", JSON.stringify(loans));
  }, [tools, roomKeys, loans, ready]);

  useEffect(() => {
    if (!cloudUser || !ready) return;
    let cancelled = false;

    const loadCloudRecords = async () => {
      setCloudStatus("syncing");
      try {
        const response = await tables.listRows<CloudRow>({
          databaseId: appwriteConfig.databaseId,
          tableId: appwriteConfig.tableId,
          queries: [Query.limit(500)],
          ttl: 0,
        });
        if (cancelled) return;

        if (response.rows.length > 0) {
          const remoteTools = response.rows
            .filter((row) => row.kind === "tool")
            .map((row) => JSON.parse(row.data) as Tool);
          const remoteRooms = response.rows
            .filter((row) => row.kind === "room")
            .map((row) => JSON.parse(row.data) as RoomKey);
          const remoteLoans = response.rows
            .filter((row) => row.kind === "loan")
            .map((row) => JSON.parse(row.data) as Loan);
          setTools(remoteTools);
          setRoomKeys(remoteRooms);
          setLoans(remoteLoans);
        } else {
          const records = [
            ...tools.map((tool) => ({ kind: "tool" as const, id: tool.id, data: tool })),
            ...roomKeys.map((room) => ({ kind: "room" as const, id: room.id, data: room })),
            ...loans.map((loan) => ({ kind: "loan" as const, id: loan.id, data: loan })),
          ];
          await Promise.all(
            records.map((record) =>
              tables.upsertRow({
                databaseId: appwriteConfig.databaseId,
                tableId: appwriteConfig.tableId,
                rowId: cloudRowId(record.kind, record.id),
                data: { kind: record.kind, data: JSON.stringify(record.data) },
              }),
            ),
          );
        }

        if (!cancelled) {
          setCloudHydrated(true);
          setCloudStatus("synced");
        }
      } catch (error) {
        console.error("Cloud load failed", error);
        if (!cancelled) setCloudStatus("error");
      }
    };

    void loadCloudRecords();
    return () => {
      cancelled = true;
    };
    // Load once for each signed-in account after local storage is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudUser?.$id, ready]);

  useEffect(() => {
    if (!cloudUser || !cloudHydrated || !isAdmin) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setCloudStatus("syncing");
      try {
        const records = [
          ...tools.map((tool) => ({ kind: "tool" as const, id: tool.id, data: tool })),
          ...roomKeys.map((room) => ({ kind: "room" as const, id: room.id, data: room })),
          ...loans.map((loan) => ({ kind: "loan" as const, id: loan.id, data: loan })),
        ];
        const wantedIds = new Set(records.map((record) => cloudRowId(record.kind, record.id)));
        const existing = await tables.listRows<CloudRow>({
          databaseId: appwriteConfig.databaseId,
          tableId: appwriteConfig.tableId,
          queries: [Query.limit(500)],
          ttl: 0,
        });

        await Promise.all([
          ...records.map((record) =>
            tables.upsertRow({
              databaseId: appwriteConfig.databaseId,
              tableId: appwriteConfig.tableId,
              rowId: cloudRowId(record.kind, record.id),
              data: { kind: record.kind, data: JSON.stringify(record.data) },
            }),
          ),
          ...existing.rows
            .filter((row) => !wantedIds.has(row.$id))
            .map((row) =>
              tables.deleteRow({
                databaseId: appwriteConfig.databaseId,
                tableId: appwriteConfig.tableId,
                rowId: row.$id,
              }),
            ),
        ]);
        if (!cancelled) setCloudStatus("synced");
      } catch (error) {
        console.error("Cloud save failed", error);
        if (!cancelled) setCloudStatus("error");
      }
    }, 650);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [tools, roomKeys, loans, cloudUser, cloudHydrated, isAdmin]);

  const handleSignedIn = (user: Models.User<Models.Preferences>) => {
    setCloudHydrated(false);
    setCloudStatus("syncing");
    setCloudUser(user);
  };

  const signOut = async () => {
    try {
      await account.deleteSession({ sessionId: "current" });
    } finally {
      setCloudUser(null);
      setCloudHydrated(false);
      setCloudStatus("offline");
    }
  };

  const openAdminLogin = async () => {
    try {
      if (cloudUser) await account.deleteSession({ sessionId: "current" });
    } catch {
      // Continue to the protected admin sign-in even if the anonymous session already ended.
    } finally {
      setCloudUser(null);
      setCloudHydrated(false);
      setCloudStatus("offline");
      setAdminLoginOpen(true);
    }
  };

  const returnToBorrowerPage = async () => {
    setAdminLoginOpen(false);
    setCloudStatus("checking");
    try {
      try {
        await account.deleteSession({ sessionId: "current" });
      } catch {
        // There may be no current session when returning from the admin sign-in screen.
      }
      await account.createAnonymousSession();
      await account.updatePrefs({ prefs: { role: "borrower" } });
      handleSignedIn(await account.get());
    } catch (error) {
      console.error("Borrower access could not start", error);
      setCloudUser(null);
      setCloudHydrated(false);
      setCloudStatus("offline");
    }
  };

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  const active = loans.filter((loan) => !["Returned", "Pending", "Declined"].includes(loan.status));
  const activeToolLoans = active.filter((loan) => kindOf(loan) === "Tool");
  const activeRoomLoans = active.filter((loan) => kindOf(loan) === "Room Key");
  const toolQuantity = (tool: Tool) => Math.max(1, tool.quantity ?? 1);
  const deletedUnitNumbers = (tool: Tool) =>
    Array.from(
      new Set(
        (tool.deletedUnits ?? []).filter(
          (unitNumber) => unitNumber >= 1 && unitNumber <= toolQuantity(tool),
        ),
      ),
    ).sort((a, b) => a - b);
  const allUnitNumbers = (tool: Tool) => {
    const deleted = new Set(deletedUnitNumbers(tool));
    return Array.from({ length: toolQuantity(tool) }, (_, index) => index + 1).filter(
      (unitNumber) => !deleted.has(unitNumber),
    );
  };
  const toolUnitCount = (tool: Tool) => allUnitNumbers(tool).length;
  const unitMetaOf = (tool: Tool, unitNumber: number): ToolUnitMeta =>
    tool.unitDetails?.[String(unitNumber)] ?? {};
  const unitLabelOf = (tool: Tool, unitNumber: number) =>
    unitMetaOf(tool, unitNumber).label?.trim() || `${tool.name} ${unitNumber}`;
  const activeUnitNumbers = (toolId: string) =>
    new Set(
      activeToolLoans
        .filter((loan) => loan.assetId === toolId)
        .map((loan) => unitNumberOf(loan)),
    );
  const maintenanceUnitNumbers = (tool: Tool) => {
    const validUnits = new Set(allUnitNumbers(tool));
    if (tool.maintenanceUnits !== undefined) {
      return Array.from(
        new Set(tool.maintenanceUnits.filter((unitNumber) => validUnits.has(unitNumber))),
      ).sort((a, b) => a - b);
    }
    if (tool.status === "Maintenance") return allUnitNumbers(tool);
    return [];
  };
  const isUnitInMaintenance = (tool: Tool, unitNumber: number) =>
    maintenanceUnitNumbers(tool).includes(unitNumber);
  const maintenanceUnitCount = (tool: Tool) => maintenanceUnitNumbers(tool).length;
  const availableUnitNumbers = (tool: Tool) => {
    const occupied = activeUnitNumbers(tool.id);
    const blocked = new Set(maintenanceUnitNumbers(tool));
    return allUnitNumbers(tool).filter(
      (unitNumber) => !occupied.has(unitNumber) && !blocked.has(unitNumber),
    );
  };
  const toolLiveStatus = (tool: Tool) => {
    const totalCount = toolUnitCount(tool);
    const maintenanceCount = maintenanceUnitCount(tool);
    const availableCount = availableUnitNumbers(tool).length;
    const borrowedCount = allUnitNumbers(tool).filter((unitNumber) => activeUnitNumbers(tool.id).has(unitNumber)).length;
    if (totalCount > 0 && maintenanceCount === totalCount) return "Maintenance";
    if (maintenanceCount > 0) return "Maintenance";
    if (borrowedCount === totalCount && totalCount > 0) return "Borrowed";
    if (availableCount < totalCount) return "Partially borrowed";
    return "Available";
  };
  const detailedTool = selectedToolDetails
    ? tools.find((tool) => tool.id === selectedToolDetails.id) ?? selectedToolDetails
    : null;
  const detailedToolLoan = detailedTool
    ? activeToolLoans.find((loan) => loan.assetId === detailedTool.id)
    : undefined;
  const selectedUnitTool = selectedUnitEditor
    ? tools.find((tool) => tool.id === selectedUnitEditor.toolId) ?? null
    : null;
  const selectedUnitNumber = selectedUnitEditor?.unitNumber ?? null;
  const selectedUnitLoan = selectedUnitTool && selectedUnitNumber
    ? activeToolLoans.find(
        (loan) =>
          loan.assetId === selectedUnitTool.id &&
          unitNumberOf(loan) === selectedUnitNumber,
      )
    : undefined;
  const selectedUnitMeta = selectedUnitTool && selectedUnitNumber
    ? unitMetaOf(selectedUnitTool, selectedUnitNumber)
    : {};
  const returnEvaluationLoan = returnEvaluationLoanId
    ? loans.find((loan) => loan.id === returnEvaluationLoanId) ?? null
    : null;
  const printLoan = printLoanId
    ? loans.find((loan) => loan.id === printLoanId) ?? null
    : null;
  const printLoans = printLoan
    ? loans.filter((loan) => borrowingBatchKeyOf(loan) === borrowingBatchKeyOf(printLoan))
    : [];
  const selectedBorrower = selectedBorrowerId
    ? loans.find((loan) => loan.studentId === selectedBorrowerId)
    : undefined;
  const selectedBorrowerLoans = selectedBorrowerId
    ? loans.filter((loan) => loan.studentId === selectedBorrowerId)
    : [];
  const todayKeyTransactions = loans.filter(
    (loan) =>
      kindOf(loan) === "Room Key" &&
      isToday(loan.borrowedAtIso ?? loan.borrowed),
  );
  const students = useMemo(
    () => [...new Map(loans.map((loan) => [loan.studentId, loan])).values()],
    [loans],
  );

  const deferredQuery = useDeferredValue(query);
  const q = deferredQuery.toLowerCase();
  const match = (parts: string[]) => parts.join(" ").toLowerCase().includes(q);

  const visibleTools = tools.filter(
      (tool) =>
      (toolCategory === "All Tools" || tool.category === toolCategory) &&
      match([
        tool.id,
        tool.name,
        tool.category,
        tool.location,
        tool.status,
        tool.model ?? "",
        tool.condition ?? "",
        tool.notes ?? "",
      ]),
  );
  const maintenanceManagementTools = tools.filter((tool) =>
    match([
      tool.id,
      tool.name,
      tool.category,
      tool.location,
      tool.status,
      tool.model ?? "",
      tool.condition ?? "",
      tool.notes ?? "",
    ]),
  );

  const setToolMaintenance = (tool: Tool, checked: boolean) => {
    const hasActiveLoan = activeToolLoans.some((loan) => loan.assetId === tool.id);
    if (checked && hasActiveLoan) {
      setToast(`Return all borrowed units of ${tool.name} before putting it in maintenance.`);
      return;
    }

    setTools((current) =>
      current.map((entry) =>
        entry.id === tool.id
          ? {
              ...entry,
              status: "Available",
              maintenanceUnits: checked ? allUnitNumbers(entry) : [],
            }
          : entry,
      ),
    );
    setToast(`${tool.name} ${checked ? "moved to maintenance" : "marked ready for use"}.`);
  };

  const setToolUnitMaintenance = (tool: Tool, unitNumber: number, checked: boolean) => {
    const unitLoan = activeToolLoans.find(
      (loan) => loan.assetId === tool.id && unitNumberOf(loan) === unitNumber,
    );
    if (checked && unitLoan) {
      setToast(`Return ${tool.name} ${unitNumber} before marking it for maintenance.`);
      return;
    }

    setTools((current) =>
      current.map((entry) => {
        if (entry.id !== tool.id) return entry;
        const currentMaintenance = new Set(maintenanceUnitNumbers(entry));
        if (checked) currentMaintenance.add(unitNumber);
        else currentMaintenance.delete(unitNumber);
        return {
          ...entry,
          status: "Available",
          maintenanceUnits: Array.from(currentMaintenance).sort((a, b) => a - b),
        };
      }),
    );
    setToast(`${tool.name} ${unitNumber} ${checked ? "marked for maintenance" : "marked ready for use"}.`);
  };

  const deleteToolUnit = (tool: Tool, unitNumber: number) => {
    const unitLoan = activeToolLoans.find(
      (loan) => loan.assetId === tool.id && unitNumberOf(loan) === unitNumber,
    );
    if (unitLoan) {
      setToast(`Return ${tool.name} ${unitNumber} before deleting that specific unit.`);
      return;
    }
    if (toolUnitCount(tool) <= 1) {
      setToast(`Keep at least one unit, or use Delete item to remove ${tool.name} completely.`);
      return;
    }
    if (!window.confirm(`Delete ${tool.name} ${unitNumber}? Its unit number will stay reserved so old transaction records remain accurate.`)) {
      return;
    }

    setTools((current) =>
      current.map((entry) => {
        if (entry.id !== tool.id) return entry;
        const deleted = new Set(entry.deletedUnits ?? []);
        deleted.add(unitNumber);
        const maintenance = new Set(maintenanceUnitNumbers(entry));
        maintenance.delete(unitNumber);
        const nextUnitDetails = { ...(entry.unitDetails ?? {}) };
        delete nextUnitDetails[String(unitNumber)];
        return {
          ...entry,
          status: "Available",
          deletedUnits: Array.from(deleted).sort((a, b) => a - b),
          maintenanceUnits: Array.from(maintenance).sort((a, b) => a - b),
          unitDetails: nextUnitDetails,
        };
      }),
    );
    setToast(`${tool.name} ${unitNumber} deleted from the active inventory.`);
    if (selectedUnitEditor?.toolId === tool.id && selectedUnitEditor.unitNumber === unitNumber) {
      setSelectedUnitEditor(null);
    }
  };

  const saveToolUnitDetails = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedUnitTool || !selectedUnitNumber) return;
    const form = new FormData(event.currentTarget);
    const label = String(form.get("unitLabel") ?? "").trim();
    const condition = String(form.get("unitCondition") ?? "Good").trim();
    const notes = String(form.get("unitNotes") ?? "").trim();

    setTools((current) =>
      current.map((tool) => {
        if (tool.id !== selectedUnitTool.id) return tool;
        const nextUnitDetails = { ...(tool.unitDetails ?? {}) };
        nextUnitDetails[String(selectedUnitNumber)] = {
          label: label || undefined,
          condition: condition || undefined,
          notes: notes || undefined,
        };
        return { ...tool, unitDetails: nextUnitDetails };
      }),
    );
    setToast(`${label || `${selectedUnitTool.name} ${selectedUnitNumber}`} details updated.`);
  };
  const availableToolMatches = tools
    .flatMap((tool) =>
      availableUnitNumbers(tool).map((unitNumber) => ({ tool, unitNumber })),
    )
    .filter(
      ({ tool, unitNumber }) =>
        !selectedToolUnits.some(
          (selection) =>
            selection.assetId === tool.id && selection.unitNumber === unitNumber,
        ) &&
        (!toolSearch.trim() ||
          `${tool.name} ${unitNumber} ${tool.id}-${unitNumber} ${tool.category}`
            .toLowerCase()
            .includes(toolSearch.trim().toLowerCase())),
    )
    .slice(0, 8);

  const visibleRooms = roomKeys.filter((room) =>
    match([room.id, room.room, room.use, room.storage, room.status]),
  );

  const visibleLoans = loans.filter((loan) =>
    match([
      loan.student,
      loan.studentId,
      loan.program,
      loan.item,
      loan.assetId,
      assetLabelOf(loan),
      loan.status,
      kindOf(loan),
      borrowerTypeOf(loan),
      loan.purpose ?? "",
    ]),
  );
  const transactionGroups = Array.from(
    visibleLoans.reduce((groups, loan) => {
      const key = borrowingBatchKeyOf(loan);
      const group = groups.get(key) ?? [];
      group.push(loan);
      groups.set(key, group);
      return groups;
    }, new Map<string, Loan[]>()),
  )
    .map(([key, groupLoans]) => ({
      key,
      loans: [...groupLoans].sort((a, b) => a.id - b.id),
      borrower: groupLoans[0],
    }))
    .sort((a, b) => {
      const aTime = new Date(a.borrower.borrowedAtIso ?? a.borrower.requestedAtIso ?? a.borrower.id).getTime();
      const bTime = new Date(b.borrower.borrowedAtIso ?? b.borrower.requestedAtIso ?? b.borrower.id).getTime();
      return (Number.isNaN(bTime) ? b.borrower.id : bTime) - (Number.isNaN(aTime) ? a.borrower.id : aTime);
    });

  const borrowerClassificationOf = (borrower: Loan) => {
    if (borrowerTypeOf(borrower) === "Professor") return "Professor";
    const yearMatch = borrower.program.match(/\b([1-4])\s*[A-Z]?\b/i);
    if (!yearMatch) return "Student";
    return yearMatch[1] === "1"
      ? "1st Year"
      : yearMatch[1] === "2"
        ? "2nd Year"
        : yearMatch[1] === "3"
          ? "3rd Year"
          : "4th Year";
  };

  const borrowerMatchesYearFilter = (borrower: Loan) => {
    const classification = borrowerClassificationOf(borrower);
    if (borrowerFilter === "all") return true;
    if (borrowerFilter === "professors") return classification === "Professor";
    if (borrowerFilter === "first") return classification === "1st Year";
    if (borrowerFilter === "second") return classification === "2nd Year";
    if (borrowerFilter === "third") return classification === "3rd Year";
    return classification === "4th Year";
  };

  const borrowerCourseOf = (borrower: Loan) => {
    if (borrowerTypeOf(borrower) === "Professor") return "Faculty";
    const rawCourse = borrower.program.replace(/\s+[1-4]\s*[A-Z]\s*$/i, "").trim();
    const compact = rawCourse.toUpperCase().replace(/[^A-Z0-9]/g, "");

    if (["BETMXT", "MXT"].includes(compact)) return "BETMxT";
    if (["BSMXE", "BSEMT", "MXE"].includes(compact)) return "BSMxE";
    if (["BSICE", "BSCICE", "ICE"].includes(compact)) return "BSICE";
    return "Unspecified";
  };

  const borrowerSectionOf = (borrower: Loan) => {
    if (borrowerTypeOf(borrower) === "Professor") return "Faculty";
    const match = borrower.program.match(/\b([1-4])\s*([A-Z])\s*$/i);
    return match ? `${match[1]}${match[2].toUpperCase()}` : "Unspecified";
  };

  const searchedBorrowers = students.filter((student) =>
    match([
      student.student,
      student.studentId,
      student.program,
      borrowerTypeOf(student),
      borrowerClassificationOf(student),
      borrowerCourseOf(student),
      borrowerSectionOf(student),
    ]),
  );
  const yearFilteredBorrowers = searchedBorrowers.filter(borrowerMatchesYearFilter);
  const borrowerCourses = ["BETMxT", "BSMxE", "BSICE"] as const;
  const courseFilteredBorrowers = yearFilteredBorrowers.filter(
    (borrower) => borrowerCourseFilter === "all" || borrowerCourseOf(borrower) === borrowerCourseFilter,
  );
  const borrowerSections = Array.from(new Set(courseFilteredBorrowers.map(borrowerSectionOf))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  const visibleStudents = courseFilteredBorrowers.filter(
    (borrower) => borrowerSectionFilter === "all" || borrowerSectionOf(borrower) === borrowerSectionFilter,
  );
  const borrowerCourseCount = (course: string) =>
    yearFilteredBorrowers.filter((borrower) => course === "all" || borrowerCourseOf(borrower) === course).length;
  const borrowerSectionCount = (section: string) =>
    courseFilteredBorrowers.filter((borrower) => section === "all" || borrowerSectionOf(borrower) === section).length;
  const borrowerFilterCount = (filter: typeof borrowerFilter) =>
    students.filter((student) => {
      const classification = borrowerClassificationOf(student);
      if (filter === "all") return true;
      if (filter === "professors") return classification === "Professor";
      if (filter === "first") return classification === "1st Year";
      if (filter === "second") return classification === "2nd Year";
      if (filter === "third") return classification === "3rd Year";
      return classification === "4th Year";
    }).length;

  const borrowDateOf = (loan: Loan) => {
    const raw = loan.borrowedAtIso ?? loan.borrowed;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const historyYears = Array.from(
    new Set<number>(
      loans
        .map((loan) => borrowDateOf(loan)?.getFullYear())
        .filter((value): value is number => typeof value === "number"),
    ),
  )
    .sort((a: number, b: number) => b - a)
    .map((year: number) => String(year));

  const historyLoans = [...loans]
    .filter((loan) => {
      const borrowedDate = borrowDateOf(loan);
      if (!borrowedDate) return false;
      const year = String(borrowedDate.getFullYear());
      const month = `${year}-${String(borrowedDate.getMonth() + 1).padStart(2, "0")}`;
      const day = `${month}-${String(borrowedDate.getDate()).padStart(2, "0")}`;

      if (historyView === "day") return day === historyDay;
      if (historyView === "month") return month === historyMonth;
      return year === historyYear;
    })
    .sort((a, b) => {
      const aTime = borrowDateOf(a)?.getTime() ?? 0;
      const bTime = borrowDateOf(b)?.getTime() ?? 0;
      return bTime - aTime;
    });

  const selectedRoomHistory = selectedRoomHistoryId
    ? roomKeys.find((room) => room.id === selectedRoomHistoryId) ?? null
    : null;
  const selectedRoomHistoryLoans = selectedRoomHistoryId
    ? loans
        .filter((loan) => kindOf(loan) === "Room Key" && loan.assetId === selectedRoomHistoryId)
        .sort((a, b) => (borrowDateOf(b)?.getTime() ?? b.id) - (borrowDateOf(a)?.getTime() ?? a.id))
    : [];
  const selectedRoomActiveLoan = selectedRoomHistoryId
    ? activeRoomLoans.find((loan) => loan.assetId === selectedRoomHistoryId)
    : undefined;

  const openBorrowing = (mode: ModalMode, assetId = "", preferredUnitNumber?: number) => {
    const tool = mode === "tool" ? tools.find((entry) => entry.id === assetId) : undefined;
    const firstAvailableUnit =
      tool && preferredUnitNumber && availableUnitNumbers(tool).includes(preferredUnitNumber)
        ? preferredUnitNumber
        : tool
          ? availableUnitNumbers(tool)[0]
          : undefined;
    setSelectedAsset(
      mode === "tool" && tool && firstAvailableUnit
        ? `${tool.id}::${firstAvailableUnit}`
        : assetId,
    );
    setSelectedToolUnits(
      mode === "tool" && tool && firstAvailableUnit
        ? [{ assetId: tool.id, unitNumber: firstAvailableUnit }]
        : [],
    );
    setToolSearch(
      tool && firstAvailableUnit
        ? `${unitLabelOf(tool, firstAvailableUnit)} - ${tool.id}-${firstAvailableUnit}`
        : "",
    );
    setToolSearchOpen(false);
    setModalMode(mode);
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedAsset("");
    setSelectedToolUnits([]);
    setToolSearch("");
    setToolSearchOpen(false);
  };

  const scrollToRoom = (roomId: string) => {
    setQuery("");
    window.requestAnimationFrame(() => {
      document.getElementById(`room-${roomId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  };

  const openTransactionRecord = (loan: Loan) => {
    if (kindOf(loan) === "Tool") {
      const tool = tools.find((entry) => entry.id === loan.assetId);
      if (tool) {
        setSelectedToolDetails(tool);
      } else {
        setToast("This inventory item no longer exists.");
      }
      return;
    }

    setView("Rooms & Keys");
    setQuery("");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById(`room-${loan.assetId}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    });
  };

  const normalizeBorrowerName = (value: string) =>
    value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

  const normalizeBorrowerId = (value: string) =>
    value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

  const validateBorrowerIdentity = (rawName: string, rawId: string) => {
    const name = rawName.trim().replace(/\s+/g, " ");
    const id = normalizeBorrowerId(rawId);
    const normalizedName = normalizeBorrowerName(name);

    const sameId = loans.find(
      (loan) => normalizeBorrowerId(loan.studentId) === id,
    );
    const sameName = loans.find(
      (loan) => normalizeBorrowerName(loan.student) === normalizedName,
    );

    if (sameId && normalizeBorrowerName(sameId.student) !== normalizedName) {
      return {
        ok: false as const,
        message: `${id} is already registered to ${sameId.student}. Use the registered name for this TUPV ID.`,
      };
    }

    if (sameName && normalizeBorrowerId(sameName.studentId) !== id) {
      return {
        ok: false as const,
        message: `${sameName.student} is already registered under ${sameName.studentId}. A borrower name cannot use a second TUPV ID.`,
      };
    }

    const existing = sameId ?? sameName;
    return {
      ok: true as const,
      name: existing?.student ?? name,
      id: existing?.studentId ?? id,
    };
  };

  const borrowTool = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const validSelections = selectedToolUnits.filter((selection) => {
      const tool = tools.find((entry) => entry.id === selection.assetId);
      return tool && availableUnitNumbers(tool).includes(selection.unitNumber);
    });
    if (validSelections.length === 0 || validSelections.length !== selectedToolUnits.length) {
      setToast("Select one or more available numbered items.");
      return;
    }

    const due = new Date();
    due.setDate(due.getDate() + Number(form.get("days")));

    const borrowedAt = new Date();
    const identity = validateBorrowerIdentity(
      String(form.get("student")),
      String(form.get("studentId")),
    );
    if (!identity.ok) {
      setToast(identity.message);
      return;
    }
    const student = identity.name;
    const studentId = identity.id;
    const program = String(form.get("program"));
    const transactionId = Date.now();
    const borrowBatchId = `BORROW-${transactionId}`;
    const newLoans: Loan[] = validSelections.map((selection, index) => {
      const tool = tools.find((entry) => entry.id === selection.assetId)!;
      return {
        id: transactionId + index,
        student,
        studentId,
        program,
        borrowerType: "Student",
        item: unitLabelOf(tool, selection.unitNumber),
        assetId: tool.id,
        unitNumber: selection.unitNumber,
        borrowed: fmtDateTime(borrowedAt),
        borrowedAtIso: borrowedAt.toISOString(),
        due: fmt(due),
        status: "On time",
        kind: "Tool",
        borrowBatchId,
      };
    });

    setLoans((current) => [...newLoans, ...current]);
    setTools((current) =>
      current.map((tool) => {
        const selectedCount = validSelections.filter(
          (selection) => selection.assetId === tool.id,
        ).length;
        if (selectedCount === 0) return tool;
        return {
          ...tool,
          status:
            selectedCount >= availableUnitNumbers(tool).length
              ? "Borrowed"
              : "Available",
        };
      }),
    );
    closeModal();
    setView("Transactions");
    setToast(`${newLoans.length} item${newLoans.length === 1 ? "" : "s"} registered to ${student}.`);
  };

  const borrowRoom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const assetId = String(form.get("roomKey"));
    const room = roomKeys.find((entry) => entry.id === assetId && entry.status === "Available");
    if (!room) return;

    const borrowedAt = new Date();
    const identity = validateBorrowerIdentity(
      String(form.get("student")),
      String(form.get("studentId")),
    );
    if (!identity.ok) {
      setToast(identity.message);
      return;
    }

    const roomTransactionId = Date.now();
    const loan: Loan = {
      id: roomTransactionId,
      borrowBatchId: `BORROW-${roomTransactionId}`,
      student: identity.name,
      studentId: identity.id,
      program: String(form.get("program")),
      borrowerType: String(form.get("borrowerType")) as BorrowerType,
      item: `${room.room} key`,
      assetId,
      borrowed: fmtDateTime(borrowedAt),
      borrowedAtIso: borrowedAt.toISOString(),
      due: "",
      status: "Key out",
      kind: "Room Key",
      purpose: String(form.get("purpose")),
    };

    setLoans((current) => [loan, ...current]);
    setRoomKeys((current) =>
      current.map((entry) => (entry.id === assetId ? { ...entry, status: "Borrowed" } : entry)),
    );
    closeModal();
    setView("Rooms & Keys");
    setToast(`${room.room} key released to ${loan.student}.`);
  };

  const persistBorrowerRequest = async (request: Loan) => {
    try {
      await tables.upsertRow({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.tableId,
        rowId: cloudRowId("loan", request.id),
        data: { kind: "loan", data: JSON.stringify(request) },
      });
      setLoans((current) => [request, ...current.filter((entry) => entry.id !== request.id)]);
      return true;
    } catch (error) {
      console.error("Borrower request save failed", error);
      setToast(`Request could not be sent: ${appwriteErrorMessage(error)}`);
      return false;
    }
  };

  const requestToolForUser = async ({
    assetId,
    unitNumber,
    days,
    student,
    studentId,
    program,
    borrowerType,
    purpose,
  }: {
    assetId: string;
    unitNumber: number;
    days: number;
    student: string;
    studentId: string;
    program: string;
    borrowerType: BorrowerType;
    purpose: string;
  }) => {
    if (!cloudUser || isAdmin) return false;
    const tool = tools.find((entry) => entry.id === assetId);
    if (!tool || !availableUnitNumbers(tool).includes(unitNumber)) {
      setToast("That numbered tool is no longer available. Choose another unit.");
      return false;
    }

    const identity = validateBorrowerIdentity(student, studentId);
    if (!identity.ok) {
      setToast(identity.message);
      return false;
    }

    const normalizedId = normalizeBorrowerId(identity.id);
    const hasOverdue = loans.some(
      (loan) => normalizeBorrowerId(loan.studentId) === normalizedId && loan.status === "Overdue",
    );
    if (hasOverdue) {
      setToast("This borrower has an overdue item. Return it before sending another request.");
      return false;
    }

    const duplicatePending = loans.some(
      (loan) =>
        loan.status === "Pending" &&
        normalizeBorrowerId(loan.studentId) === normalizedId &&
        loan.assetId === assetId &&
        unitNumberOf(loan) === unitNumber,
    );
    if (duplicatePending) {
      setToast("This borrower already has a pending request for this exact unit.");
      return false;
    }

    const requestedAt = new Date();
    const requestId = Date.now();
    const request: Loan = {
      id: requestId,
      borrowBatchId: `REQUEST-${requestId}`,
      student: identity.name,
      studentId: identity.id,
      program: program.trim() || "Unspecified",
      borrowerType,
      item: unitLabelOf(tool, unitNumber),
      assetId: tool.id,
      unitNumber,
      borrowed: "Awaiting release",
      requestedAt: fmtDateTime(requestedAt),
      requestedAtIso: requestedAt.toISOString(),
      requestedDays: Math.max(1, days),
      due: "—",
      status: "Pending",
      kind: "Tool",
      purpose: purpose.trim(),
    };
    const saved = await persistBorrowerRequest(request);
    if (saved) setToast(`${request.item} request sent to Tool Crib for approval.`);
    return saved;
  };

  const requestRoomForUser = async ({
    roomId,
    purpose,
    student,
    studentId,
    program,
    borrowerType,
  }: {
    roomId: string;
    purpose: string;
    student: string;
    studentId: string;
    program: string;
    borrowerType: BorrowerType;
  }) => {
    if (!cloudUser || isAdmin) return false;
    const room = roomKeys.find((entry) => entry.id === roomId && entry.status === "Available");
    if (!room) {
      setToast("That room key is no longer available.");
      return false;
    }

    const identity = validateBorrowerIdentity(student, studentId);
    if (!identity.ok) {
      setToast(identity.message);
      return false;
    }

    const normalizedId = normalizeBorrowerId(identity.id);
    const hasOverdue = loans.some(
      (loan) => normalizeBorrowerId(loan.studentId) === normalizedId && loan.status === "Overdue",
    );
    if (hasOverdue) {
      setToast("This borrower has an overdue item. Return it before sending another request.");
      return false;
    }

    const duplicatePending = loans.some(
      (loan) =>
        loan.status === "Pending" &&
        kindOf(loan) === "Room Key" &&
        normalizeBorrowerId(loan.studentId) === normalizedId &&
        loan.assetId === roomId,
    );
    if (duplicatePending) {
      setToast("This borrower already has a pending request for this room key.");
      return false;
    }

    const requestedAt = new Date();
    const requestId = Date.now();
    const request: Loan = {
      id: requestId,
      borrowBatchId: `REQUEST-${requestId}`,
      student: identity.name,
      studentId: identity.id,
      program: program.trim() || "Unspecified",
      borrowerType,
      item: `${room.room} key`,
      assetId: room.id,
      borrowed: "Awaiting release",
      requestedAt: fmtDateTime(requestedAt),
      requestedAtIso: requestedAt.toISOString(),
      due: "—",
      status: "Pending",
      kind: "Room Key",
      purpose: purpose.trim(),
    };
    const saved = await persistBorrowerRequest(request);
    if (saved) setToast(`${room.room} key request sent to Tool Crib for approval.`);
    return saved;
  };

  const approveRequest = (loan: Loan) => {
    if (loan.status !== "Pending") return;
    const borrowedAt = new Date();
    if (kindOf(loan) === "Tool") {
      const tool = tools.find((entry) => entry.id === loan.assetId);
      const unitNumber = unitNumberOf(loan);
      if (!tool || !availableUnitNumbers(tool).includes(unitNumber)) {
        setToast(`${loan.item} is no longer available. Decline this request or release another unit manually.`);
        return;
      }
      const due = new Date(borrowedAt);
      due.setDate(due.getDate() + Math.max(1, loan.requestedDays ?? 7));
      setLoans((current) =>
        current.map((entry) =>
          entry.id === loan.id
            ? {
                ...entry,
                borrowed: fmtDateTime(borrowedAt),
                borrowedAtIso: borrowedAt.toISOString(),
                due: fmt(due),
                status: "On time",
              }
            : entry,
        ),
      );
      setTools((current) =>
        current.map((entry) =>
          entry.id === loan.assetId
            ? {
                ...entry,
                status: availableUnitNumbers(entry).length <= 1 ? "Borrowed" : "Available",
              }
            : entry,
        ),
      );
    } else {
      const room = roomKeys.find((entry) => entry.id === loan.assetId && entry.status === "Available");
      if (!room) {
        setToast(`${loan.item} is no longer available.`);
        return;
      }
      setLoans((current) =>
        current.map((entry) =>
          entry.id === loan.id
            ? {
                ...entry,
                borrowed: fmtDateTime(borrowedAt),
                borrowedAtIso: borrowedAt.toISOString(),
                status: "Key out",
              }
            : entry,
        ),
      );
      setRoomKeys((current) =>
        current.map((entry) =>
          entry.id === loan.assetId ? { ...entry, status: "Borrowed" } : entry,
        ),
      );
    }
    setToast(`${loan.item} approved and released to ${loan.student}.`);
  };

  const declineRequest = (loan: Loan) => {
    if (loan.status !== "Pending") return;
    setLoans((current) =>
      current.map((entry) => (entry.id === loan.id ? { ...entry, status: "Declined" } : entry)),
    );
    setToast(`${loan.item} request declined.`);
  };

  const openReturnEvaluation = (loan: Loan) => {
    setReturnEvaluationLoanId(loan.id);
    setReturnCondition("Good");
    setReturnSendMaintenance(false);
  };

  const closeReturnEvaluation = () => {
    setReturnEvaluationLoanId(null);
    setReturnCondition("Good");
    setReturnSendMaintenance(false);
  };

  const returned = (
    loan: Loan,
    evaluation: { condition: string; remarks: string; sendToMaintenance: boolean },
  ) => {
    const returnedAt = fmtDateTime(new Date());
    const remarks = evaluation.remarks.trim();

    setLoans((current) =>
      current.map((entry) =>
        entry.id === loan.id
          ? {
              ...entry,
              status: "Returned",
              returnedAt,
              returnCondition: evaluation.condition,
              returnRemarks: remarks || undefined,
              postReturnMaintenance: evaluation.sendToMaintenance || undefined,
            }
          : entry,
      ),
    );

    if (kindOf(loan) === "Room Key") {
      const roomNeedsMaintenance = ["Damaged", "Missing part", "Needs maintenance"].includes(evaluation.condition);
      setRoomKeys((current) =>
        current.map((entry) =>
          entry.id === loan.assetId
            ? { ...entry, status: roomNeedsMaintenance ? "Maintenance" : "Available" }
            : entry,
        ),
      );
    } else {
      const returnedUnit = unitNumberOf(loan);
      setTools((current) =>
        current.map((entry) => {
          if (entry.id !== loan.assetId) return entry;
          const maintenance = new Set(entry.maintenanceUnits ?? []);
          if (evaluation.sendToMaintenance) maintenance.add(returnedUnit);
          return {
            ...entry,
            status: "Available",
            maintenanceUnits: Array.from(maintenance).sort((a, b) => a - b),
          };
        }),
      );
    }

    closeReturnEvaluation();
    setToast(
      evaluation.sendToMaintenance ||
      (kindOf(loan) === "Room Key" && ["Damaged", "Missing part", "Needs maintenance"].includes(evaluation.condition))
        ? `${loan.item} returned and flagged for maintenance.`
        : `${loan.item} returned at ${returnedAt}.`,
    );
  };

  const submitReturnEvaluation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!returnEvaluationLoan) return;
    const form = new FormData(event.currentTarget);
    returned(returnEvaluationLoan, {
      condition: returnCondition,
      remarks: String(form.get("returnRemarks") ?? ""),
      sendToMaintenance: kindOf(returnEvaluationLoan) === "Tool" && returnSendMaintenance,
    });
  };

  const closeEraseModal = () => {
    setEraseModalOpen(false);
    setErasePassword("");
    setEraseError("");
  };

  const eraseAllTransactions = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (erasePassword !== TRANSACTION_ERASE_PASSWORD) {
      setEraseError("Incorrect password. Transactions were not erased.");
      return;
    }

    setLoans([]);
    setTools((current) =>
      current.map((tool) =>
        tool.status === "Borrowed" ? { ...tool, status: "Available" } : tool,
      ),
    );
    setRoomKeys((current) =>
      current.map((room) =>
        room.status === "Borrowed" ? { ...room, status: "Available" } : room,
      ),
    );
    setOpenBorrower(null);
    setOpenTransactionGroups([]);
    closeEraseModal();
    setToast("All transactions were erased.");
  };

  const closeManageModal = () => setManageModal(null);

  const addTool = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = String(form.get("assetId")).trim().toUpperCase();

    if (tools.some((tool) => tool.id.toUpperCase() === id)) {
      setToast(`Asset ID ${id} already exists.`);
      return;
    }

    const tool: Tool = {
      id,
      name: String(form.get("name")).trim(),
      category: String(form.get("category")),
      location: String(form.get("location")).trim(),
      status: String(form.get("status")) as ItemStatus,
      quantity: Math.max(1, Number(form.get("quantity")) || 1),
      model: String(form.get("model")).trim(),
      condition: String(form.get("condition")),
      notes: String(form.get("notes")).trim(),
    };

    setTools((current) => [tool, ...current]);
    setManageModal(null);
    setToolCategory("All Tools");
    setQuery("");
    setToast(`${tool.name} added to inventory.`);
  };

  const updateDetailedToolQuantity = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detailedTool) return;

    const form = new FormData(event.currentTarget);
    const quantity = Math.max(1, Number(form.get("quantity")) || 1);
    const highestBorrowedUnit = Math.max(
      0,
      ...activeToolLoans
        .filter((loan) => loan.assetId === detailedTool.id)
        .map((loan) => unitNumberOf(loan)),
    );

    if (quantity < highestBorrowedUnit) {
      setToast(`Keep at least ${highestBorrowedUnit} units while that numbered unit is borrowed.`);
      return;
    }

    setTools((current) =>
      current.map((tool) =>
        tool.id === detailedTool.id
          ? {
              ...tool,
              quantity,
              maintenanceUnits: (tool.maintenanceUnits ?? []).filter((unitNumber) => unitNumber <= quantity),
              deletedUnits: (tool.deletedUnits ?? []).filter((unitNumber) => unitNumber <= quantity),
              unitDetails: Object.fromEntries(
                Object.entries(tool.unitDetails ?? {}).filter(([unitNumber]) => Number(unitNumber) <= quantity),
              ),
            }
          : tool,
      ),
    );
    setToast(`${detailedTool.name} now has ${quantity} numbered unit${quantity === 1 ? "" : "s"}.`);
  };

  const addRoom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = String(form.get("keyId")).trim().toUpperCase();

    if (roomKeys.some((room) => room.id.toUpperCase() === id)) {
      setToast(`Key ID ${id} already exists.`);
      return;
    }

    const room: RoomKey = {
      id,
      room: String(form.get("room")).trim(),
      use: String(form.get("use")).trim(),
      storage: String(form.get("storage")).trim(),
      status: String(form.get("status")) as ItemStatus,
    };

    setRoomKeys((current) => [room, ...current]);
    setManageModal(null);
    setQuery("");
    setToast(`${room.room} added to Rooms & Keys.`);
  };

  const requestDeleteTool = (tool: Tool) => {
    if (active.some((loan) => loan.assetId === tool.id)) {
      setToast("Return this item before deleting it.");
      return;
    }
    setDeleteTarget({ kind: "tool", id: tool.id, label: tool.name });
  };

  const chooseInventoryToDelete = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const assetId = String(new FormData(event.currentTarget).get("assetId"));
    const tool = tools.find((entry) => entry.id === assetId);
    if (!tool) return;
    setDeleteInventoryOpen(false);
    requestDeleteTool(tool);
  };

  const requestDeleteRoom = (room: RoomKey) => {
    if (active.some((loan) => loan.assetId === room.id)) {
      setToast("Return this room key before deleting the room.");
      return;
    }
    setDeleteTarget({ kind: "room", id: room.id, label: room.room });
  };

  const confirmDeleteRecord = () => {
    if (!deleteTarget) return;

    if (deleteTarget.kind === "tool") {
      setTools((current) => current.filter((tool) => tool.id !== deleteTarget.id));
      if (selectedToolDetails?.id === deleteTarget.id) setSelectedToolDetails(null);
    } else {
      setRoomKeys((current) => current.filter((room) => room.id !== deleteTarget.id));
    }

    setToast(`${deleteTarget.label} deleted.`);
    setDeleteTarget(null);
  };

  const pageDescription =
    view === "Inventory"
      ? "Monitor every asset, condition, and location."
      : view === "Rooms & Keys"
        ? "Release room keys, track current holders, and complete key returns."
        : view === "Borrowers"
          ? "Review students registered in the borrowing system."
          : "Track tool loans, room key releases, due dates, and returns.";

  const availableRoomCount = roomKeys.filter((room) => room.status === "Available").length;
  const maintenanceRoomCount = roomKeys.filter((room) => room.status === "Maintenance").length;
  const totalToolUnitCount = tools.reduce((sum, tool) => sum + toolUnitCount(tool), 0);
  const availableToolCount = tools.reduce(
    (sum, tool) => sum + availableUnitNumbers(tool).length,
    0,
  );
  const maintenanceToolCount = tools.reduce((sum, tool) => sum + maintenanceUnitCount(tool), 0);
  const overdueLoans = activeToolLoans.filter((loan) => loan.status === "Overdue");
  const dueTodayLoans = activeToolLoans.filter((loan) => loan.status === "Due today");
  const borrowedTodayCount = loans.filter((loan) =>
    isToday(loan.borrowedAtIso ?? loan.borrowed),
  ).length;
  const returnedTodayCount = loans.filter(
    (loan) => loan.returnedAt && isToday(loan.returnedAt),
  ).length;
  const attentionCount =
    overdueLoans.length + dueTodayLoans.length + maintenanceToolCount + activeRoomLoans.length;

  if (adminLoginOpen) {
    return (
      <CloudLogin
        onSignedIn={(user) => {
          setAdminLoginOpen(false);
          handleSignedIn(user);
        }}
        onBack={() => void returnToBorrowerPage()}
      />
    );
  }

  if (cloudStatus === "checking") {
    return <CloudLoading />;
  }

  if (!cloudUser || !isAdmin) {
    return (
      <BorrowerPortal
        tools={tools}
        rooms={roomKeys}
        loans={loans}
        onRequestTool={requestToolForUser}
        onRequestRoom={requestRoomForUser}
        onAdminAccess={() => void openAdminLogin()}
        toast={toast}
      />
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setView("Dashboard")}>
          <img src="/coac-logo.png" alt="COAC logo" />
          <span>
            <strong>Tool Crib</strong>
            <small>College of Automation and Control</small>
          </span>
        </button>

        <nav className="top-nav">
          <span
            className="top-nav-slider"
            aria-hidden="true"
            style={{ transform: `translateX(${views.indexOf(view) * 100}%)` }}
          />
          {views.map((entry) => (
            <button
              key={entry}
              className={view === entry ? "active" : ""}
              onClick={() => setView(entry)}
            >
              {entry}
            </button>
          ))}
        </nav>

        <div className="actions">
          <label className="search">
            <span>⌕</span>
            <input
              aria-label="Search records"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${view.toLowerCase()}...`}
            />
            {query && <button onClick={() => setQuery("")}>×</button>}
          </label>

          <div className="alert-wrap">
            <button className="bell" aria-label="Open alerts" onClick={() => setAlerts(!alerts)}>
              ♧
              <b>{active.filter((loan) => loan.status === "Overdue" || loan.status === "Due today").length}</b>
            </button>
            {alerts && (
              <aside className="alerts">
                <div className="panel-head">
                  <strong>Action needed</strong>
                  <button onClick={() => setAlerts(false)}>×</button>
                </div>
                {active
                  .filter((loan) => loan.status === "Overdue" || loan.status === "Due today")
                  .map((loan) => (
                    <button
                      key={loan.id}
                      onClick={() => {
                        setView("Transactions");
                        setQuery(loan.student);
                        setAlerts(false);
                      }}
                    >
                      <i className={loan.status === "Overdue" ? "red" : "orange"} />
                      <span>
                        <strong>{loan.item}</strong>
                        <small>
                          {loan.student} · {loan.status}
                        </small>
                      </span>
                    </button>
                  ))}
              </aside>
            )}
          </div>
          <button className="cloud-account" onClick={() => void returnToBorrowerPage()} title="Sign out and return to borrower page">
            <span className="avatar">
              {(cloudUser.name || cloudUser.email).slice(0, 2).toUpperCase()}
            </span>
            <span>
              <strong>{cloudUser.name || "Tool Crib"}</strong>
              <small className={`cloud-state ${cloudStatus}`}>
                {cloudStatus === "syncing"
                  ? "Saving..."
                  : cloudStatus === "error"
                    ? "Sync needs attention"
                    : "Cloud saved"}
              </small>
            </span>
          </button>
        </div>
      </header>

      <div className="mobile-nav">
        {views.map((entry) => (
          <button
            key={entry}
            className={view === entry ? "active" : ""}
            onClick={() => setView(entry)}
          >
            {entry}
          </button>
        ))}
      </div>

      {view === "Dashboard" ? (
        <main>
          <section className="hero">
            <div className="gridlines" />
            <div className="gear">⚙</div>
            <span className="hero-luntian-side left" aria-hidden="true">POWERED BY LUNTIAN</span>
            <span className="hero-luntian-side right" aria-hidden="true">POWERED BY LUNTIAN</span>
            <HeroClock />
            <div className="hero-shell">
              <div className="hero-copy">
                <span className="eyebrow">COAC LABORATORY MANAGEMENT</span>
                <h1>
                  Tools and keys accounted for.
                  <br />
                  Students ready to build.
                </h1>
                <p>Manage tool inventory, room access, and borrowing with accuracy and accountability.</p>
                <div className="hero-actions">
                  <button className="primary" onClick={() => openBorrowing("tool")}>
                    Register tool borrowing <b>→</b>
                  </button>
                  <button className="hero-secondary" onClick={() => openBorrowing("room")}>
                    Borrow room &amp; key
                  </button>
                </div>
              </div>

              <aside className="hero-course-showcase" aria-label="COAC course logos">
                <div className="hero-course-showcase-head">
                  <span className="hero-course-kicker">COAC COURSES</span>
                  <strong>Programs under the college</strong>
                  <small>Visible at a glance for a more balanced dashboard header.</small>
                </div>
                <div className="hero-course-grid">
                  <article className="hero-course-card bsice">
                    <div className="hero-course-logo-wrap">
                      <img src="/course-logos/bsice-logo.png" alt="BSICE logo" className="hero-course-logo" />
                    </div>
                    <div className="hero-course-meta">
                      <strong>BSICE</strong>
                      <span>Instrumentation and Control Engineering</span>
                    </div>
                  </article>

                  <article className="hero-course-card bsmxe">
                    <div className="hero-course-logo-wrap">
                      <img src="/course-logos/bsmxe-logo.png" alt="BSMxE logo" className="hero-course-logo" />
                    </div>
                    <div className="hero-course-meta">
                      <strong>BSMxE</strong>
                      <span>Mechatronics Engineering</span>
                    </div>
                  </article>

                  <article className="hero-course-card betmxt">
                    <div className="hero-course-logo-wrap">
                      <img src="/course-logos/betmxt-logo.png" alt="BETMxT logo" className="hero-course-logo" />
                    </div>
                    <div className="hero-course-meta">
                      <strong>BETMxT</strong>
                      <span>Mechatronics Technology</span>
                    </div>
                  </article>
                </div>
              </aside>
            </div>
          </section>

          <section className="content dashboard-content">
            <section className="dashboard-zone tool-dashboard-zone">
              <div className="dashboard-zone-head">
                <div className="dashboard-zone-title dashboard-zone-title-compact">
                  <div>
                    <span className="dashboard-zone-kicker">TOOLS &amp; ITEMS</span>
                    <h2>Tool inventory overview</h2>
                    <p>Only tool and equipment activity is shown in this section.</p>
                  </div>
                </div>
                <button className="dashboard-zone-link" onClick={() => setView("Inventory")}>Open inventory →</button>
              </div>

              <div className="stats tool-stats">
                <Stat tone="blue" icon="▣" value={String(totalToolUnitCount)} label="Total Tool Units" click={() => setView("Inventory")} />
                <Stat
                  tone="green"
                  icon="✓"
                  value={String(availableToolCount)}
                  label="Available Tools"
                  click={() => {
                    setView("Inventory");
                    setQuery("Available");
                  }}
                />
                <Stat
                  tone="orange"
                  icon="♙"
                  value={String(activeToolLoans.length)}
                  label="Tools Borrowed"
                  click={() => {
                    setView("Transactions");
                    setQuery("Tool");
                  }}
                />
                <Stat
                  tone="red"
                  icon="⌁"
                  value={String(maintenanceToolCount)}
                  label="Tool Maintenance"
                  click={() => {
                    setView("Inventory");
                    setInventoryTab("maintenance");
                    setQuery("");
                  }}
                />
              </div>

              <div className="dash-grid dashboard-borrow-layout">
                <div className="dashboard-borrow-panels">
                  <section className="panel dashboard-loan-panel">
                    <div className="panel-head">
                      <div>
                        <strong>Recent tool loans</strong>
                        <small>Latest borrowed tools and equipment only</small>
                      </div>
                      <button
                        onClick={() => {
                          setView("Transactions");
                          setQuery("Tool");
                        }}
                      >
                        View tool loans →
                      </button>
                    </div>
                    <Table
                      loans={activeToolLoans.slice(0, 5)}
                      onLoanClick={(loan) => setSelectedBorrowerId(loan.studentId)}
                    />
                  </section>

                  <section className="panel dashboard-loan-panel borrowed-room-keys-panel">
                    <div className="panel-head">
                      <div>
                        <strong>Borrowed room keys</strong>
                        <small>Room keys currently released to borrowers</small>
                      </div>
                      <button onClick={() => setView("Rooms & Keys")}>
                        Manage room keys →
                      </button>
                    </div>
                    <RoomKeyLoansTable
                      loans={activeRoomLoans.slice(0, 5)}
                      onLoanClick={(loan) => setSelectedBorrowerId(loan.studentId)}
                      onReturn={(loan) => openReturnEvaluation(loan)}
                    />
                  </section>
                </div>

                <section className="panel dashboard-room-display">
                  <div className="panel-head">
                    <div>
                      <strong>Room display</strong>
                      <small>Green available · Red unavailable</small>
                    </div>
                  </div>
                  <div className="room-display-grid">
                    {roomKeys.map((room) => {
                      const isAvailable = room.status === "Available";

                      return (
                        <button
                          type="button"
                          className={`room-display-tile ${isAvailable ? "available" : "unavailable"}`}
                          key={room.id}
                          onClick={() => {
                            if (isAvailable) {
                              openBorrowing("room", room.id);
                            } else {
                              setView("Rooms & Keys");
                            }
                          }}
                          aria-label={`${room.room}: ${isAvailable ? "available" : "unavailable"}`}
                        >
                          <i aria-hidden="true" />
                          <strong>{room.room}</strong>
                          <span>{isAvailable ? "Available" : "Unavailable"}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button className="panel-link" onClick={() => setView("Rooms & Keys")}>
                    Manage rooms &amp; keys →
                  </button>
                </section>
              </div>

              <div className="dashboard-operations-grid">
                <section className="panel dashboard-recent-returns">
                  <div className="panel-head">
                    <div>
                      <strong>Recent returns</strong>
                      <small>Latest completed tool and room-key transactions</small>
                    </div>
                  </div>
                  <div className="recent-returns-list">
                    {loans.filter((loan) => loan.status === "Returned").slice(0, 4).map((loan) => (
                      <button
                        type="button"
                        className="recent-return-item"
                        key={loan.id}
                        onClick={() => setSelectedBorrowerId(loan.studentId)}
                      >
                        <span className={`return-kind-dot ${kindOf(loan) === "Room Key" ? "room" : "tool"}`} aria-hidden="true" />
                        <span>
                          <strong>{loan.item}</strong>
                          <small>{loan.student} · {assetLabelOf(loan)}</small>
                        </span>
                        <span className="recent-return-time">{loan.returnedAt ?? "Returned"}</span>
                        {(loan.returnCondition || loan.returnRemarks) && (
                          <span className="recent-return-evaluation">
                            {loan.returnCondition && <b>{loan.returnCondition}</b>}
                            {loan.returnRemarks && <small>{loan.returnRemarks}</small>}
                          </span>
                        )}
                      </button>
                    ))}
                    {loans.filter((loan) => loan.status === "Returned").length === 0 && (
                      <div className="recent-returns-empty">
                        <strong>No recent returns</strong>
                        <small>Completed returns will appear here automatically.</small>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="activity-link"
                    onClick={() => {
                      setView("Transactions");
                      setQuery("Returned");
                    }}
                  >
                    View return history →
                  </button>
                </section>

                <section className="panel dashboard-live-panel">
                  <div className="panel-head">
                    <div>
                      <strong>Today &amp; live</strong>
                      <small>Current borrowing activity</small>
                    </div>
                    <span className="live-indicator"><i /> Live</span>
                  </div>
                  <div className="live-metric-grid">
                    <button onClick={() => setView("Transactions")}>
                      <strong>{borrowedTodayCount}</strong>
                      <span>Borrowed today</span>
                    </button>
                    <button onClick={() => setView("Transactions")}>
                      <strong>{returnedTodayCount}</strong>
                      <span>Returned today</span>
                    </button>
                    <button onClick={() => setView("Rooms & Keys")}>
                      <strong>{activeRoomLoans.length}</strong>
                      <span>Keys currently out</span>
                    </button>
                    <button onClick={() => setView("Borrowers")}>
                      <strong>{students.length}</strong>
                      <span>Borrower records</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    className="activity-link"
                    onClick={() => {
                      setView("Transactions");
                      setQuery("");
                    }}
                  >
                    Open full activity log →
                  </button>
                </section>

                <section className="panel dashboard-attention-panel">
                  <div className="panel-head">
                    <div>
                      <strong>Needs attention</strong>
                      <small>Items that may need follow-up</small>
                    </div>
                    <span className={`attention-total ${attentionCount > 0 ? "has-items" : ""}`}>
                      {attentionCount}
                    </span>
                  </div>
                  <div className="attention-list">
                    <button onClick={() => { setView("Transactions"); setQuery("Overdue"); }}>
                      <i className="red" /><span><strong>Overdue loans</strong><small>Contact borrowers</small></span><b>{overdueLoans.length}</b>
                    </button>
                    <button onClick={() => { setView("Transactions"); setQuery("Due today"); }}>
                      <i className="orange" /><span><strong>Due today</strong><small>Prepare returns</small></span><b>{dueTodayLoans.length}</b>
                    </button>
                    <button onClick={() => { setView("Inventory"); setInventoryTab("maintenance"); setQuery(""); }}>
                      <i className="blue" /><span><strong>Maintenance</strong><small>Tools unavailable</small></span><b>{maintenanceToolCount}</b>
                    </button>
                    <button onClick={() => setView("Rooms & Keys")}>
                      <i className="purple" /><span><strong>Room keys out</strong><small>Currently occupied rooms</small></span><b>{activeRoomLoans.length}</b>
                    </button>
                  </div>
                </section>
              </div>
            </section>
          </section>
        </main>
      ) : (
        <main className={`workspace ${view === "Rooms & Keys" ? "rooms-workspace" : ""}`}>
          <section className="workspace-head">
            <div>
              <span className="eyebrow">COAC TOOL AID</span>
              <h1>{view}</h1>
              <p>{pageDescription}</p>
            </div>
            <div className="workspace-actions">
              {view === "Rooms & Keys" ? (
                <>
                  <button className="secondary" onClick={() => setManageModal("addRoom")}>
                    + Add room
                  </button>
                  <button className="primary" onClick={() => openBorrowing("room")}>
                    + Borrow room &amp; key
                  </button>
                </>
              ) : view === "Inventory" ? (
                <>
                  <button
                    className="delete-inventory-action"
                    onClick={() => setDeleteInventoryOpen(true)}
                    disabled={tools.length === 0}
                  >
                    Delete inventory
                  </button>
                  <button className="secondary" onClick={() => openBorrowing("tool")}>
                    Register borrowing
                  </button>
                  <button className="primary" onClick={() => setManageModal("addTool")}>
                    + Add inventory item
                  </button>
                </>
              ) : (
                <>
                  <button className="secondary" onClick={() => openBorrowing("room")}>
                    Room &amp; key
                  </button>
                  <button className="primary" onClick={() => openBorrowing("tool")}>
                    + Register borrowing
                  </button>
                </>
              )}
            </div>
          </section>

          {view === "Inventory" && (
            <section className="panel page-panel inventory-page-panel">
              <div className="inventory-subtabs" role="tablist" aria-label="Inventory views">
                <button
                  type="button"
                  role="tab"
                  aria-selected={inventoryTab === "inventory"}
                  className={inventoryTab === "inventory" ? "active" : ""}
                  onClick={() => setInventoryTab("inventory")}
                >
                  <span className="inventory-subtab-icon">▦</span>
                  <span><strong>Inventory</strong><small>Browse and assign tools</small></span>
                  <b>{tools.length}</b>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={inventoryTab === "maintenance"}
                  className={inventoryTab === "maintenance" ? "active maintenance" : "maintenance"}
                  onClick={() => setInventoryTab("maintenance")}
                >
                  <span className="inventory-subtab-icon">✓</span>
                  <span><strong>Maintenance</strong><small>Check or clear unavailable items</small></span>
                  <b>{maintenanceToolCount}</b>
                </button>
              </div>

              {inventoryTab === "inventory" ? (
                <>
                  <div className="panel-head">
                    <div>
                      <strong>{toolCategory === "All Tools" ? "Asset register" : toolCategory}</strong>
                      <small>{visibleTools.length} matching records</small>
                    </div>
                  </div>
                  <div className="category-tabs" role="tablist" aria-label="Tool categories">
                    {toolCategories.map((category) => {
                      const count =
                        category === "All Tools"
                          ? tools.length
                          : tools.filter((tool) => tool.category === category).length;
                      return (
                        <button
                          key={category}
                          role="tab"
                          aria-selected={toolCategory === category}
                          className={toolCategory === category ? "active" : ""}
                          onClick={() => setToolCategory(category)}
                        >
                          <span className="category-card-icon">
                            <ToolCategoryIcon category={category} />
                          </span>
                          <span className="category-card-copy">
                            <span className="category-card-name">{category}</span>
                            <small>{toolCategoryMeta[category].subtitle}</small>
                          </span>
                          <b>{count}</b>
                        </button>
                      );
                    })}
                  </div>
                  <div className="table-scroll inventory-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Asset ID</th>
                          <th>Tool</th>
                          <th>Units</th>
                          <th>Category</th>
                          <th>Location</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleTools.map((tool) => (
                          <tr
                            className="inventory-clickable-row"
                            key={tool.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`View details for ${tool.name}`}
                            onClick={() => setSelectedToolDetails(tool)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedToolDetails(tool);
                              }
                            }}
                          >
                            <td className="mono">{tool.id}</td>
                            <td>
                              <strong>{tool.name}</strong>
                              <small className="inventory-units-preview">
                                {allUnitNumbers(tool).map((unitNumber) => `${tool.name} ${unitNumber}`).join(" · ")}
                              </small>
                            </td>
                            <td>
                              <div className="unit-count-cell">
                                <span className="piece-count">{toolUnitCount(tool)}</span>
                                <small>{availableUnitNumbers(tool).length} ready</small>
                              </div>
                            </td>
                            <td>{tool.category}</td>
                            <td>{tool.location}</td>
                            <td><Status value={toolLiveStatus(tool)} /></td>
                            <td>
                              <div className="record-actions">
                                {availableUnitNumbers(tool).length > 0 && (
                                  <button
                                    className="small"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openBorrowing("tool", tool.id);
                                    }}
                                  >
                                    Assign
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="delete-record-button"
                                  disabled={active.some((loan) => loan.assetId === tool.id)}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    requestDeleteTool(tool);
                                  }}
                                  title={
                                    active.some((loan) => loan.assetId === tool.id)
                                      ? "Return this item before deleting it"
                                      : `Delete ${tool.name}`
                                  }
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {visibleTools.length === 0 && (
                      <div className="empty-state">
                        <strong>No tools found</strong>
                        <p>Try another category or clear your search.</p>
                        <button onClick={() => { setToolCategory("All Tools"); setQuery(""); }}>Show all tools</button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="panel-head maintenance-panel-head">
                    <div>
                      <strong>Maintenance checklist</strong>
                      <small>Check an item to make every unit unavailable. Uncheck it when the item is ready again.</small>
                    </div>
                    <span className="summary">{maintenanceToolCount} in maintenance</span>
                  </div>
                  <div className="maintenance-checklist">
                    {maintenanceManagementTools.map((tool) => {
                      const isMaintenance = toolUnitCount(tool) > 0 && maintenanceUnitCount(tool) === toolUnitCount(tool);
                      const hasActiveLoan = activeToolLoans.some((loan) => loan.assetId === tool.id);
                      return (
                        <article className={`maintenance-check-row ${isMaintenance ? "checked" : ""}`} key={tool.id}>
                          <label className="maintenance-checkbox">
                            <input
                              type="checkbox"
                              checked={isMaintenance}
                              disabled={!isMaintenance && hasActiveLoan}
                              onChange={(event) => setToolMaintenance(tool, event.target.checked)}
                            />
                            <span aria-hidden="true">✓</span>
                          </label>
                          <div className="maintenance-tool-copy">
                            <strong>{tool.name}</strong>
                            <small className="mono">{tool.id}</small>
                          </div>
                          <div className="maintenance-tool-meta">
                            <span>{tool.category}</span>
                            <small>{tool.location} · {toolUnitCount(tool)} unit{toolUnitCount(tool) === 1 ? "" : "s"}</small>
                          </div>
                          <div className="maintenance-tool-state">
                            <Status value={toolLiveStatus(tool)} />
                            {hasActiveLoan && !isMaintenance && <small>Return borrowed units first</small>}
                          </div>
                          <button type="button" className="maintenance-details-button" onClick={() => setSelectedToolDetails(tool)}>Details →</button>
                        </article>
                      );
                    })}
                    {maintenanceManagementTools.length === 0 && (
                      <div className="empty-state maintenance-empty">
                        <strong>No matching inventory items</strong>
                        <p>Clear the search to show the full maintenance checklist.</p>
                        <button onClick={() => setQuery("")}>Show all items</button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          )}

          {view === "Rooms & Keys" && (
            <>
              <section className="room-summary-grid">
                <RoomSummary label="Total room keys" value={roomKeys.length} tone="blue" />
                <RoomSummary label="Available" value={availableRoomCount} tone="green" />
                <RoomSummary label="Occupied / keys out" value={activeRoomLoans.length} tone="red" />
                <RoomSummary label="Maintenance" value={maintenanceRoomCount} tone="orange" />
              </section>

              <div className="rooms-workspace-layout">
                <div className="rooms-workspace-main">
              <section className="panel page-panel">
                <div className="panel-head">
                  <div>
                    <strong>Room availability board</strong>
                    <small>{visibleRooms.length} room status box{visibleRooms.length === 1 ? "" : "es"}</small>
                  </div>
                  <span className="summary">{availableRoomCount} available</span>
                </div>
                <div className="room-note">
                  <span>🔑</span>
                  <p>
                    Borrowing a room also releases its assigned key. Returning the key completes the room transaction and makes the room available again.
                  </p>
                </div>
                <div className="room-status-legend" aria-label="Room status colors">
                  <span><i className="vacant" /> Green means vacant</span>
                  <span><i className="borrowed" /> Red means occupied / key out</span>
                  <span><i className="maintenance" /> Orange means maintenance</span>
                </div>

                <div className="room-board">
                  {visibleRooms.map((room) => {
                    const currentLoan = activeRoomLoans.find((loan) => loan.assetId === room.id);
                    const lastReturn = loans.find(
                      (loan) =>
                        loan.assetId === room.id &&
                        kindOf(loan) === "Room Key" &&
                        loan.status === "Returned" &&
                        loan.returnedAt,
                    );
                    const roomState =
                      room.status === "Available"
                        ? "vacant"
                        : room.status === "Borrowed"
                          ? "borrowed"
                          : "maintenance";

                    return (
                      <article
                        className={`room-box ${roomState} room-box-history-clickable`}
                        id={`room-${room.id}`}
                        key={room.id}
                        tabIndex={0}
                        role="button"
                        aria-label={`View borrowing history for ${room.room}`}
                        title={`View ${room.room} borrowing history`}
                        onClick={(event) => {
                          if ((event.target as HTMLElement).closest("button")) return;
                          setSelectedRoomHistoryId(room.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedRoomHistoryId(room.id);
                          }
                        }}
                      >
                        <div className="room-box-status">
                          <span className="room-status-dot" />
                          <strong>
                            {roomState === "vacant"
                              ? "AVAILABLE"
                              : roomState === "borrowed"
                                ? "OCCUPIED"
                                : "MAINTENANCE"}
                          </strong>
                        </div>

                        <header className="room-box-head">
                          <div>
                            <small>ROOM</small>
                            <h2>{room.room}</h2>
                            <p>{room.use}</p>
                          </div>
                          <div className="room-box-head-actions">
                            <span
                              className={`room-key-icon room-key-icon-${roomState}`}
                              title={
                                roomState === "vacant"
                                  ? `${room.room} key is available on the key board`
                                  : roomState === "borrowed"
                                    ? `${room.room} key is currently out`
                                    : `${room.room} key is under maintenance`
                              }
                              aria-label={
                                roomState === "vacant"
                                  ? `${room.room} key available`
                                  : roomState === "borrowed"
                                    ? `${room.room} key out`
                                    : `${room.room} key maintenance`
                              }
                            >
                              🔑
                            </span>
                            <button
                              type="button"
                              className="room-delete-button"
                              disabled={Boolean(currentLoan)}
                              onClick={() => requestDeleteRoom(room)}
                              title={currentLoan ? "Return the room key before deleting" : `Delete ${room.room}`}
                              aria-label={`Delete ${room.room}`}
                            >
                              ×
                            </button>
                          </div>
                        </header>

                        <div className="room-box-details">
                          <div>
                            <small>Key ID</small>
                            <strong className="mono">{room.id}</strong>
                          </div>
                          <div>
                            <small>Key storage</small>
                            <strong>{room.storage}</strong>
                          </div>
                        </div>

                        {currentLoan ? (
                          <div className="room-holder">
                            <div className="room-holder-title">
                              <span>Current key holder</span>
                              <b>IN USE</b>
                            </div>
                            <strong>{currentLoan.student}</strong>
                            <small>{borrowerTypeOf(currentLoan)} · {currentLoan.studentId} · {currentLoan.program}</small>
                            {currentLoan.purpose && <p>Purpose: {currentLoan.purpose}</p>}
                            <div className="room-time-row">
                              <span>Borrowed<br /><b>{currentLoan.borrowed}</b></span>
                              <span>Returned<br /><b>Not returned yet</b></span>
                            </div>
                          </div>
                        ) : roomState === "vacant" ? (
                          <div className="room-vacant-message">
                            <strong>Ready for borrowing</strong>
                            <p>The room key is on the Tool Crib key board.</p>
                            {lastReturn?.returnedAt && (
                              <p>Last returned: <b>{lastReturn.returnedAt}</b></p>
                            )}
                            {lastReturn?.returnRemarks && (
                              <p className="room-last-return-remark">Post-evaluation: <b>{lastReturn.returnRemarks}</b></p>
                            )}
                          </div>
                        ) : (
                          <div className="room-maintenance-message">
                            <strong>Temporarily unavailable</strong>
                            <p>This room or its assigned key is under maintenance.</p>
                          </div>
                        )}

                        <div className="room-history-hint" aria-hidden="true">
                          <span>↗</span> Click room to view borrowing history
                        </div>
                        <footer className="room-box-actions">
                          {roomState === "vacant" ? (
                            <button className="room-borrow-button" onClick={() => openBorrowing("room", room.id)}>
                              Borrow room &amp; key
                            </button>
                          ) : currentLoan ? (
                            <button className="room-return-button" onClick={() => openReturnEvaluation(currentLoan)}>
                              Return key and mark vacant
                            </button>
                          ) : (
                            <button disabled>Unavailable</button>
                          )}
                        </footer>
                      </article>
                    );
                  })}
                </div>

                {visibleRooms.length === 0 && (
                  <div className="empty-state">
                    <strong>No rooms or keys found</strong>
                    <p>Clear the search to show the full room key register.</p>
                    <button onClick={() => setQuery("")}>Show all rooms</button>
                  </div>
                )}
              </section>

              <section className="panel page-panel key-day-log">
                <div className="panel-head">
                  <div>
                    <strong>Today&apos;s key transactions</strong>
                    <small>
                      {new Date().toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </small>
                  </div>
                  <span className="summary">
                    {todayKeyTransactions.length} key{" "}
                    {todayKeyTransactions.length === 1 ? "transaction" : "transactions"}
                  </span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Borrower</th>
                        <th>Room / Key</th>
                        <th>Purpose</th>
                        <th>Time borrowed</th>
                        <th>Time returned</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayKeyTransactions.map((loan) => (
                        <tr key={loan.id}>
                          <td>
                            <strong>{loan.student}</strong>
                            <small>{borrowerTypeOf(loan)} · {loan.studentId} · {loan.program}</small>
                          </td>
                          <td>
                            <strong>{loan.item}</strong>
                            <small className="mono">{assetLabelOf(loan)}</small>
                          </td>
                          <td>{loan.purpose ?? "Room access"}</td>
                          <td>{loan.borrowed}</td>
                          <td>{loan.returnedAt ?? "Not returned yet"}</td>
                          <td><Status value={loan.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {todayKeyTransactions.length === 0 && (
                    <div className="empty-state">
                      <strong>No key transactions today</strong>
                      <p>Borrowed room keys will appear here automatically.</p>
                    </div>
                  )}
                </div>
              </section>
                </div>

                <aside className="room-mini-map panel" aria-label="Sticky room status map">
                  <div className="room-mini-map-head">
                    <div>
                      <span className="dashboard-zone-kicker">LIVE ROOM MAP</span>
                      <strong>COAC rooms</strong>
                    </div>
                    <span className="room-mini-live"><i /> Live</span>
                  </div>
                  <div className="room-mini-summary">
                    <span><b>{availableRoomCount}</b> available</span>
                    <span><b>{activeRoomLoans.length}</b> occupied</span>
                  </div>
                  <div className="room-mini-grid">
                    {roomKeys.map((room) => {
                      const currentLoan = activeRoomLoans.find((loan) => loan.assetId === room.id);
                      const roomState =
                        room.status === "Available"
                          ? "available"
                          : room.status === "Borrowed"
                            ? "occupied"
                            : "maintenance";

                      return (
                        <button
                          type="button"
                          className={`room-mini-tile ${roomState}`}
                          key={room.id}
                          onClick={() => scrollToRoom(room.id)}
                          aria-label={`${room.room}: ${roomState}`}
                        >
                          <i aria-hidden="true" />
                          <strong>{room.room}</strong>
                          <small>
                            {currentLoan
                              ? currentLoan.student
                              : roomState === "available"
                                ? "Available"
                                : "Maintenance"}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                  <div className="room-mini-legend" aria-label="Mini map color guide">
                    <span><i className="available" /> Available</span>
                    <span><i className="occupied" /> Occupied</span>
                    <span><i className="maintenance" /> Maintenance</span>
                  </div>

                </aside>
              </div>
            </>
          )}

          {view === "Borrowers" && (
            <section className="borrower-directory panel">
              <div className="borrower-directory-toolbar borrower-directory-toolbar-rich">
                <div className="borrower-directory-heading">
                  <strong>Borrower directory</strong>
                  <small>
                    {visibleStudents.length} matching borrower{visibleStudents.length === 1 ? "" : "s"} · students and professors
                  </small>
                </div>
                <label className="borrower-search-box">
                  <span aria-hidden="true">⌕</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search name, TUPV ID, program or year..."
                    aria-label="Search borrowers"
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery("")} aria-label="Clear borrower search">×</button>
                  )}
                </label>
              </div>
              <div className="borrower-filter-tabs" role="tablist" aria-label="Borrower classification">
                {([
                  ["all", "All", "Everyone"],
                  ["first", "1st Year", "First year students"],
                  ["second", "2nd Year", "Second year students"],
                  ["third", "3rd Year", "Third year students"],
                  ["fourth", "4th Year", "Fourth year students"],
                  ["professors", "Professors", "Faculty borrowers"],
                ] as const).map(([filter, label, hint]) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={borrowerFilter === filter}
                    className={borrowerFilter === filter ? "active" : ""}
                    key={filter}
                    onClick={() => {
                      setBorrowerFilter(filter);
                      setBorrowerCourseFilter("all");
                      setBorrowerSectionFilter("all");
                    }}
                  >
                    <span>
                      <strong>{label}</strong>
                      <small>{hint}</small>
                    </span>
                    <b>{borrowerFilterCount(filter)}</b>
                  </button>
                ))}
              </div>
              {borrowerFilter !== "professors" && (
              <div className="borrower-drilldown" aria-label="Program and section filters">
                <div className="borrower-drilldown-row">
                  <div className="borrower-drilldown-label">
                    <strong>Course</strong>
                    <small>Filter by program</small>
                  </div>
                  <div className="borrower-drilldown-chips">
                    <button
                      type="button"
                      className={borrowerCourseFilter === "all" ? "active course" : "course"}
                      onClick={() => { setBorrowerCourseFilter("all"); setBorrowerSectionFilter("all"); }}
                    >
                      All courses <b>{borrowerCourseCount("all")}</b>
                    </button>
                    {borrowerCourses.map((course) => (
                      <button
                        type="button"
                        className={borrowerCourseFilter === course ? "active course" : "course"}
                        key={course}
                        onClick={() => { setBorrowerCourseFilter(course); setBorrowerSectionFilter("all"); }}
                      >
                        {course} <b>{borrowerCourseCount(course)}</b>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="borrower-drilldown-row">
                  <div className="borrower-drilldown-label">
                    <strong>Section</strong>
                    <small>Then narrow by class</small>
                  </div>
                  <div className="borrower-drilldown-chips section-chips">
                    <button
                      type="button"
                      className={borrowerSectionFilter === "all" ? "active section" : "section"}
                      onClick={() => setBorrowerSectionFilter("all")}
                    >
                      All sections <b>{borrowerSectionCount("all")}</b>
                    </button>
                    {borrowerSections.map((section) => (
                      <button
                        type="button"
                        className={borrowerSectionFilter === section ? "active section" : "section"}
                        key={section}
                        onClick={() => setBorrowerSectionFilter(section)}
                      >
                        {section} <b>{borrowerSectionCount(section)}</b>
                      </button>
                    ))}
                  </div>
                  {(borrowerCourseFilter !== "all" || borrowerSectionFilter !== "all") && (
                    <button
                      type="button"
                      className="borrower-clear-drilldown"
                      onClick={() => { setBorrowerCourseFilter("all"); setBorrowerSectionFilter("all"); }}
                    >
                      Clear course / section
                    </button>
                  )}
                </div>
              </div>
              )}
              <div className="borrower-list-head">
                <span>Borrower</span>
                <span>Classification</span>
                <span>Program / Section</span>
                <span>Active items</span>
                <span>Account</span>
                <span>Actions</span>
              </div>
              <div className="borrower-list">
                {visibleStudents.map((student) => {
                  const borrowerLoans = active.filter((loan) => loan.studentId === student.studentId);
                  const count = borrowerLoans.length;
                  const isOpen = openBorrower === student.studentId;

                  return (
                    <article key={student.studentId} className={isOpen ? "borrower-open" : ""}>
                      <div className="borrower-row">
                        <header>
                          <span>
                            {student.student
                              .split(" ")
                              .map((part) => part[0])
                              .join("")
                              .slice(0, 2)}
                          </span>
                          <div>
                            <h2>{student.student}</h2>
                            <p>{borrowerTypeOf(student)} · {student.studentId}</p>
                          </div>
                        </header>
                        <div className="borrower-cell borrower-classification-cell">
                          <small>Classification</small>
                          <strong className={`borrower-classification-badge ${borrowerClassificationOf(student).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                            {borrowerClassificationOf(student)}
                          </strong>
                        </div>
                        <div className="borrower-cell borrower-program-cell">
                          <small>Program / Section</small>
                          <button
                            type="button"
                            className="borrower-program-link"
                            title={`Show ${borrowerCourseOf(student)} · ${borrowerSectionOf(student)}`}
                            onClick={() => {
                              setBorrowerCourseFilter(borrowerCourseOf(student));
                              setBorrowerSectionFilter(borrowerSectionOf(student));
                            }}
                          >
                            <strong>{borrowerTypeOf(student) === "Professor" ? "COAC Faculty" : `${borrowerCourseOf(student)} ${borrowerSectionOf(student)}`}</strong>
                            <span>Filter group →</span>
                          </button>
                        </div>
                        <div className="borrower-cell borrower-count">
                          <small>Active items</small>
                          <strong>{count}</strong>
                        </div>
                        <div className="borrower-cell">
                          <small>Account</small>
                          <strong className={count === 0 ? "clear" : "pending"}>
                            {count === 0 ? "Clear" : "Pending return"}
                          </strong>
                        </div>
                        <div className="borrower-actions">
                          {count > 0 && (
                            <button
                              className="complete-toggle"
                              aria-expanded={isOpen}
                              onClick={() => setOpenBorrower(isOpen ? null : student.studentId)}
                            >
                              <span>Complete transaction{count > 1 ? "s" : ""}</span>
                              <b>{count}</b>
                              <i>{isOpen ? "−" : "+"}</i>
                            </button>
                          )}
                          <button
                            className="secondary"
                            onClick={() => {
                              setView("Transactions");
                              setQuery(student.studentId);
                            }}
                          >
                            {count > 0 ? "View transactions" : "Transaction history"}
                          </button>
                        </div>
                      </div>

                      {isOpen && count > 0 && (
                        <div className="borrower-loans">
                          <div className="borrower-loans-head">
                            <strong>Active borrowed items and room keys</strong>
                            <small>Mark an item returned to complete its transaction.</small>
                          </div>
                          {borrowerLoans.map((loan) => (
                            <div className="borrower-loan" key={loan.id}>
                              <div>
                                <strong>{loan.item}</strong>
                                <span>
                                  <span className={`kind-tag ${kindOf(loan) === "Room Key" ? "room" : "tool"}`}>
                                    {kindOf(loan)}
                                  </span>{" "}
                                  <span className="mono">{assetLabelOf(loan)}</span>
                                </span>
                                <small>
                                  {kindOf(loan) === "Room Key"
                                    ? `Borrowed ${loan.borrowed} · Not returned yet · ${loan.status}`
                                    : `Borrowed ${loan.borrowed} · Due ${loan.due} · ${loan.status}`}
                                  {loan.purpose ? ` · ${loan.purpose}` : ""}
                                </small>
                              </div>
                              <button className="small return" onClick={() => openReturnEvaluation(loan)}>
                                {kindOf(loan) === "Room Key" ? "Return key" : "Complete return"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
                {visibleStudents.length === 0 && (
                  <div className="empty-state">
                    <strong>No borrowers found</strong>
                    <p>Try another year level, choose All, or clear the borrower search.</p>
                    <button onClick={() => { setQuery(""); setBorrowerFilter("all"); }}>Show all borrowers</button>
                  </div>
                )}
              </div>
            </section>
          )}

          {view === "Transactions" && (
            <section className="panel page-panel transactions-page-panel">
              <div className="transaction-page-tabs" role="tablist" aria-label="Transaction views">
                <button
                  type="button"
                  role="tab"
                  aria-selected={transactionTab === "borrowing"}
                  className={`${transactionTab === "borrowing" ? "active " : ""}borrowing-tab`}
                  onClick={() => setTransactionTab("borrowing")}
                >
                  Borrowing transactions
                  <span>{loans.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={transactionTab === "key-logs"}
                  className={`${transactionTab === "key-logs" ? "active " : ""}keylogs-tab`}
                  onClick={() => setTransactionTab("key-logs")}
                >
                  Room key logs
                  <span>{loans.filter((loan) => kindOf(loan) === "Room Key").length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={transactionTab === "history"}
                  className={`${transactionTab === "history" ? "active " : ""}history-tab`}
                  onClick={() => setTransactionTab("history")}
                >
                  History
                  <span>{historyLoans.length}</span>
                </button>
              </div>

              {transactionTab === "borrowing" ? (
                <>
                  <div className="panel-head">
                    <div>
                      <strong>Borrowing transactions</strong>
                      <small>{transactionGroups.length} borrowing transaction{transactionGroups.length === 1 ? "" : "s"} · {visibleLoans.length} item records</small>
                    </div>
                    <div className="transaction-head-actions">
                      <span className="summary">{active.length} active</span>
                      <button
                        type="button"
                        className="transaction-expand-button"
                        disabled={transactionGroups.length === 0}
                        onClick={() => {
                          const allOpen = transactionGroups.every((group) =>
                            openTransactionGroups.includes(group.key),
                          );
                          setOpenTransactionGroups(allOpen ? [] : transactionGroups.map((group) => group.key));
                        }}
                      >
                        {transactionGroups.length > 0 && transactionGroups.every((group) => openTransactionGroups.includes(group.key))
                          ? "Collapse all"
                          : "Expand all"}
                      </button>
                      <button
                        type="button"
                        className="erase-transactions-button"
                        disabled={loans.length === 0}
                        onClick={() => {
                          setEraseError("");
                          setErasePassword("");
                          setEraseModalOpen(true);
                        }}
                      >
                        Erase all transactions
                      </button>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Borrower / Items</th>
                          <th>Type</th>
                          <th>Item / Asset</th>
                          <th>Time borrowed</th>
                          <th>Due</th>
                          <th>Status</th>
                          <th>Time returned</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      {transactionGroups.map((group) => {
                        const isOpen = openTransactionGroups.includes(group.key);
                        const activeCount = group.loans.filter((loan) => !["Returned", "Pending", "Declined"].includes(loan.status)).length;
                        const initials = group.borrower.student
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2);

                        return (
                          <tbody className={`transaction-group ${isOpen ? "open" : ""}`} key={group.key}>
                            <tr className="transaction-group-row">
                              <td colSpan={8}>
                                <div className="transaction-group-summary">
                                  <button
                                    type="button"
                                    className="transaction-group-toggle"
                                    aria-expanded={isOpen}
                                    onClick={() =>
                                      setOpenTransactionGroups((current) =>
                                        current.includes(group.key)
                                          ? current.filter((key) => key !== group.key)
                                          : [...current, group.key],
                                      )
                                    }
                                  >
                                    <span className="transaction-group-avatar">{initials}</span>
                                    <span className="transaction-group-person">
                                      <strong>{group.borrower.student}</strong>
                                      <small>{borrowerTypeOf(group.borrower)} · {group.borrower.studentId} · {group.borrower.program}</small>
                                    </span>
                                    <span className="transaction-group-preview">
                                      {group.loans.slice(0, 3).map((loan) => loan.item).join(" · ")}
                                      {group.loans.length > 3 ? ` +${group.loans.length - 3} more` : ""}
                                    </span>
                                    <span className="transaction-group-counts">
                                      <b>{group.loans.length} item{group.loans.length === 1 ? "" : "s"}</b>
                                      <small>{activeCount} active</small>
                                    </span>
                                    <i aria-hidden="true">{isOpen ? "−" : "+"}</i>
                                  </button>
                                  {group.loans.some((loan) => !["Pending", "Declined"].includes(loan.status)) && (
                                    <button
                                      type="button"
                                      className="transaction-batch-print"
                                      onClick={() => setPrintLoanId(group.loans[0].id)}
                                    >
                                      Print form
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {isOpen && group.loans.map((loan, index) => (
                              <tr
                                className="transaction-detail-row clickable"
                                key={loan.id}
                                role="button"
                                tabIndex={0}
                                aria-label={`Open details for ${loan.item}`}
                                onClick={() => openTransactionRecord(loan)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    openTransactionRecord(loan);
                                  }
                                }}
                              >
                                <td className="transaction-item-index">
                                  <span>{index + 1}</span>
                                  <small>of {group.loans.length}</small>
                                </td>
                                <td>
                                  <span className={`kind-tag ${kindOf(loan) === "Room Key" ? "room" : "tool"}`}>
                                    {kindOf(loan)}
                                  </span>
                                </td>
                                <td>
                                  <strong>{loan.item}</strong>
                                  <small className="mono">{assetLabelOf(loan)}</small>
                                  {loan.purpose && <small>Purpose: {loan.purpose}</small>}
                                </td>
                                <td>{loan.borrowed}</td>
                                <td>{kindOf(loan) === "Room Key" ? "—" : loan.due}</td>
                                <td><Status value={loan.status} /></td>
                                <td>
                                  {loan.status === "Returned" ? (
                                    <span className="return-evaluation-cell">
                                      <b>{loan.returnedAt ?? "Time not recorded"}</b>
                                      {loan.returnCondition && <small className="return-condition">{loan.returnCondition}</small>}
                                      {loan.returnRemarks && <small className="return-remark">{loan.returnRemarks}</small>}
                                    </span>
                                  ) : (
                                    "Not returned yet"
                                  )}
                                </td>
                                <td>
                                  <div className="transaction-row-actions">
                                    {loan.status === "Pending" ? (
                                      <>
                                        <button
                                          className="small approve-request"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            approveRequest(loan);
                                          }}
                                        >
                                          Approve
                                        </button>
                                        <button
                                          className="small decline-request"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            declineRequest(loan);
                                          }}
                                        >
                                          Decline
                                        </button>
                                      </>
                                    ) : loan.status !== "Returned" && loan.status !== "Declined" ? (
                                      <button
                                        className="small return"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          openReturnEvaluation(loan);
                                        }}
                                      >
                                        {kindOf(loan) === "Room Key" ? "Return key" : "Mark returned"}
                                      </button>
                                    ) : (
                                      <span className="muted">{loan.status === "Declined" ? "Declined" : "Completed"}</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        );
                      })}
                      {visibleLoans.length === 0 && (
                        <tbody>
                          <tr>
                            <td className="transactions-empty" colSpan={8}>
                              No transactions to display.
                            </td>
                          </tr>
                        </tbody>
                      )}
                    </table>
                  </div>
                </>
              ) : transactionTab === "key-logs" ? (
                <>
                  <div className="panel-head key-log-head">
                    <div>
                      <strong>Room key borrowing log</strong>
                      <small>Permanent activity view for every room key release and return</small>
                    </div>
                    <span className="summary">{loans.filter((loan) => kindOf(loan) === "Room Key").length} records</span>
                  </div>
                  <div className="table-scroll key-log-table-wrap">
                    <table className="key-log-table">
                      <thead>
                        <tr>
                          <th>Room / Key</th>
                          <th>Borrower</th>
                          <th>Section / Program</th>
                          <th>Purpose</th>
                          <th>Borrowed</th>
                          <th>Returned</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loans.filter((loan) => kindOf(loan) === "Room Key").map((loan) => (
                          <tr className="key-log-row" key={loan.id} onClick={() => openTransactionRecord(loan)}>
                            <td>
                              <strong>{loan.item}</strong>
                              <small className="mono">{assetLabelOf(loan)}</small>
                            </td>
                            <td>
                              <strong>{loan.student}</strong>
                              <small>{borrowerTypeOf(loan)} · {loan.studentId}</small>
                            </td>
                            <td><strong>{loan.program || "—"}</strong></td>
                            <td>{loan.purpose || "—"}</td>
                            <td className="key-log-time"><strong>{loan.borrowed}</strong></td>
                            <td className="key-log-time">
                              {loan.status === "Returned" ? (
                                <span className="return-evaluation-cell">
                                  <strong>{loan.returnedAt ?? "Time not recorded"}</strong>
                                  {loan.returnCondition && <small className="return-condition">{loan.returnCondition}</small>}
                                  {loan.returnRemarks && <small className="return-remark">{loan.returnRemarks}</small>}
                                </span>
                              ) : (
                                <strong>Not returned yet</strong>
                              )}
                            </td>
                            <td><Status value={loan.status} /></td>
                            <td>
                              <div className="transaction-row-actions">
                                {loan.status === "Pending" ? (
                                  <>
                                    <button className="small approve-request" onClick={(event) => { event.stopPropagation(); approveRequest(loan); }}>Approve</button>
                                    <button className="small decline-request" onClick={(event) => { event.stopPropagation(); declineRequest(loan); }}>Decline</button>
                                  </>
                                ) : loan.status !== "Returned" && loan.status !== "Declined" ? (
                                  <button
                                    className="small return"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openReturnEvaluation(loan);
                                    }}
                                  >
                                    Return key
                                  </button>
                                ) : (
                                  <span className="muted">{loan.status === "Declined" ? "Declined" : "Completed"}</span>
                                )}
                                {!(["Pending", "Declined"].includes(loan.status)) && (
                                  <button className="small print-record-button" onClick={(event) => { event.stopPropagation(); setPrintLoanId(loan.id); }}>Print form</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {loans.filter((loan) => kindOf(loan) === "Room Key").length === 0 && (
                          <tr>
                            <td className="transactions-empty" colSpan={8}>No room key borrowing has been recorded yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <>
                  <div className="panel-head history-head">
                    <div>
                      <strong>Borrowing history</strong>
                      <small>Filter the complete borrowing history by day, month, or year.</small>
                    </div>
                    <div className="history-head-tools">
                      <div className="history-mode-switch" role="tablist" aria-label="History period">
                        <button type="button" className={historyView === "day" ? "active" : ""} onClick={() => setHistoryView("day")}>Day</button>
                        <button type="button" className={historyView === "month" ? "active" : ""} onClick={() => setHistoryView("month")}>Month</button>
                        <button type="button" className={historyView === "year" ? "active" : ""} onClick={() => setHistoryView("year")}>Year</button>
                      </div>
                      {historyView === "day" ? (
                        <input
                          className="history-picker"
                          type="date"
                          value={historyDay}
                          onChange={(event) => setHistoryDay(event.target.value)}
                        />
                      ) : historyView === "month" ? (
                        <input
                          className="history-picker"
                          type="month"
                          value={historyMonth}
                          onChange={(event) => setHistoryMonth(event.target.value)}
                        />
                      ) : (
                        <select
                          className="history-picker"
                          value={historyYear}
                          onChange={(event) => setHistoryYear(event.target.value)}
                        >
                          {historyYears.map((year) => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      )}
                      <span className="summary">{historyLoans.length} records</span>
                    </div>
                  </div>
                  <div className="table-scroll history-table-wrap">
                    <table className="history-table">
                      <thead>
                        <tr>
                          <th>Borrowed</th>
                          <th>Borrower</th>
                          <th>Section / Program</th>
                          <th>Type</th>
                          <th>Item / Asset</th>
                          <th>Returned</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyLoans.map((loan) => (
                          <tr className="history-row" key={loan.id} onClick={() => openTransactionRecord(loan)}>
                            <td><strong>{loan.borrowed}</strong></td>
                            <td>
                              <strong>{loan.student}</strong>
                              <small>{borrowerTypeOf(loan)} · {loan.studentId}</small>
                            </td>
                            <td><strong>{loan.program || "—"}</strong></td>
                            <td><span className={`kind-tag ${kindOf(loan) === "Room Key" ? "room" : "tool"}`}>{kindOf(loan)}</span></td>
                            <td>
                              <strong>{loan.item}</strong>
                              <small className="mono">{assetLabelOf(loan)}</small>
                              {loan.purpose && <small>Purpose: {loan.purpose}</small>}
                            </td>
                            <td>
                              {loan.status === "Returned" ? (
                                <span className="return-evaluation-cell">
                                  <strong>{loan.returnedAt ?? "Time not recorded"}</strong>
                                  {loan.returnCondition && <small className="return-condition">{loan.returnCondition}</small>}
                                  {loan.returnRemarks && <small className="return-remark">{loan.returnRemarks}</small>}
                                </span>
                              ) : (
                                <strong>Not returned yet</strong>
                              )}
                            </td>
                            <td><Status value={loan.status} /></td>
                          </tr>
                        ))}
                        {historyLoans.length === 0 && (
                          <tr>
                            <td className="transactions-empty" colSpan={7}>No borrowing history matched the selected filter.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          )}
        </main>
      )}

      {modalMode === "tool" && (
        <div className="backdrop" onMouseDown={closeModal}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">NEW TOOL TRANSACTION</span>
                <h2>Register a borrower</h2>
                <p>Record the borrower once, then add every numbered item being released.</p>
              </div>
              <button onClick={closeModal}>×</button>
            </div>
            <form onSubmit={borrowTool}>
              <div className="form-grid">
                <label>
                  <span>Student full name</span>
                  <input name="student" required placeholder="Juan Dela Cruz" autoComplete="name" />
                </label>
                <label>
                  <span>Student ID</span>
                  <input name="studentId" required placeholder="TUPV-00-0000" autoComplete="off" />
                </label>
                <ProgramSectionFields />
                <label>
                  <span>Borrowing period</span>
                  <select name="days" defaultValue="7">
                    <option value="1">1 day</option>
                    <option value="3">3 days</option>
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                  </select>
                </label>
                <div className="full tool-search-field">
                  <span className="tool-search-label">Available items</span>
                  {selectedToolUnits.length > 0 && (
                    <div className="selected-tool-units">
                      <div className="selected-tool-units-head">
                        <strong>{selectedToolUnits.length} selected</strong>
                        <button type="button" onClick={() => setSelectedToolUnits([])}>Clear all</button>
                      </div>
                      <div className="selected-tool-unit-list">
                        {selectedToolUnits.map((selection) => {
                          const tool = tools.find((entry) => entry.id === selection.assetId);
                          if (!tool) return null;
                          return (
                            <span key={`${selection.assetId}-${selection.unitNumber}`}>
                              <b>{tool.name} {selection.unitNumber}</b>
                              <small className="mono">{tool.id}-{selection.unitNumber}</small>
                              <button
                                type="button"
                                aria-label={`Remove ${tool.name} ${selection.unitNumber}`}
                                onClick={() =>
                                  setSelectedToolUnits((current) =>
                                    current.filter(
                                      (item) =>
                                        item.assetId !== selection.assetId ||
                                        item.unitNumber !== selection.unitNumber,
                                    ),
                                  )
                                }
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div
                    className="tool-search-picker"
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setToolSearchOpen(false);
                      }
                    }}
                  >
                    <div className="tool-search-control">
                      <span aria-hidden="true">⌕</span>
                      <input
                        type="search"
                        value={toolSearch}
                        onClick={() => setToolSearchOpen(true)}
                        onChange={(event) => {
                          setToolSearch(event.target.value);
                          setSelectedAsset("");
                          setToolSearchOpen(true);
                        }}
                        placeholder="Search by tool name or asset ID"
                        autoComplete="off"
                        aria-label="Search available tools"
                        aria-expanded={toolSearchOpen}
                      />
                      {toolSearch && (
                        <button
                          type="button"
                          className="tool-search-clear"
                          onClick={() => {
                            setToolSearch("");
                            setSelectedAsset("");
                            setToolSearchOpen(true);
                          }}
                          aria-label="Clear tool search"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {toolSearchOpen && (
                      <div className="tool-search-results" role="listbox">
                        {availableToolMatches.map(({ tool, unitNumber }) => (
                          <button
                            type="button"
                            role="option"
                            aria-selected={selectedAsset === `${tool.id}::${unitNumber}`}
                            key={`${tool.id}-${unitNumber}`}
                            onClick={() => {
                              setSelectedToolUnits((current) => [
                                ...current.filter(
                                  (item) =>
                                    item.assetId !== tool.id ||
                                    item.unitNumber !== unitNumber,
                                ),
                                { assetId: tool.id, unitNumber },
                              ]);
                              setSelectedAsset("");
                              setToolSearch("");
                              setToolSearchOpen(true);
                            }}
                          >
                            <span>
                              <strong>{tool.name} {unitNumber}</strong>
                              <small>{tool.category}</small>
                            </span>
                            <b className="mono">{tool.id}-{unitNumber}</b>
                          </button>
                        ))}
                        {availableToolMatches.length === 0 && (
                          <div className="tool-search-empty">No available tool matches your search.</div>
                        )}
                      </div>
                    )}
                  </div>
                  <small className={`field-hint ${selectedToolUnits.length > 0 ? "selected" : ""}`}>
                    {selectedToolUnits.length > 0
                      ? "Add another item or submit this group borrowing."
                      : "Type a name or asset ID, then select one or more items."}
                  </small>
                </div>
              </div>
              <div className="note">
                <b>i</b>
                <p>Each selected unit gets its own tracked transaction under the same borrower. One TUPV ID is permanently tied to one borrower name, and one borrower name cannot be registered under a second ID.</p>
              </div>
              <footer>
                <button type="button" className="secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button className="primary">
                  Register {selectedToolUnits.length || "selected"} item{selectedToolUnits.length === 1 ? "" : "s"} →
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {modalMode === "room" && (
        <div className="backdrop" onMouseDown={closeModal}>
          <section
            className="modal room-access-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head room-modal-head">
              <div>
                <span className="eyebrow">ROOM ACCESS TRANSACTION</span>
                <h2>Borrow a room and key</h2>
                <p>Record who receives the key. Borrow and return times are captured automatically.</p>
              </div>
              <button onClick={closeModal} aria-label="Close room access form">×</button>
            </div>
            <form onSubmit={borrowRoom}>
              <div className="form-grid">
                <label>
                  <span>Borrower type</span>
                  <select name="borrowerType" defaultValue="Student" required>
                    <option value="Student">Student</option>
                    <option value="Professor">Professor</option>
                  </select>
                </label>
                <label>
                  <span>Borrower full name</span>
                  <input name="student" required placeholder="Juan Dela Cruz" autoComplete="name" />
                </label>
                <label>
                  <span>ID number</span>
                  <input name="studentId" required placeholder="Student or employee ID" autoComplete="off" />
                </label>
                <ProgramSectionFields includeFaculty />
                <label className="full">
                  <span>Available room and key</span>
                  <select name="roomKey" required defaultValue={selectedAsset}>
                    <option value="" disabled>
                      Select a room and assigned key
                    </option>
                    {roomKeys
                      .filter((room) => room.status === "Available")
                      .map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.room} - {room.use} - {room.id}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="full">
                  <span>Purpose of room use</span>
                  <input
                    name="purpose"
                    required
                    placeholder="Laboratory activity, project testing, organization meeting..."
                  />
                </label>
              </div>
              <div className="note room-note-modal">
                <b>🔑</b>
                <p>The room remains marked as borrowed until its assigned key is returned through Rooms &amp; Keys, Borrowers, or Transactions.</p>
              </div>
              <footer>
                <button type="button" className="secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button className="primary">Release room key →</button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {returnEvaluationLoan && (
        <div className="backdrop return-evaluation-backdrop" onMouseDown={closeReturnEvaluation}>
          <section
            className="modal return-evaluation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="return-evaluation-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head return-evaluation-head">
              <div>
                <span className="eyebrow">POST-RETURN EVALUATION</span>
                <h2 id="return-evaluation-title">Inspect {returnEvaluationLoan.item}</h2>
                <p>{returnEvaluationLoan.student} · {returnEvaluationLoan.studentId}</p>
              </div>
              <button type="button" onClick={closeReturnEvaluation} aria-label="Close return evaluation">×</button>
            </div>
            <form className="return-evaluation-form" onSubmit={submitReturnEvaluation}>
              <div className="return-evaluation-summary">
                <div><small>Borrower</small><strong>{returnEvaluationLoan.student}</strong></div>
                <div><small>Asset</small><strong>{assetLabelOf(returnEvaluationLoan)}</strong></div>
                <div><small>Borrowed</small><strong>{returnEvaluationLoan.borrowed}</strong></div>
              </div>

              <label className="return-evaluation-field">
                <span>Condition after return</span>
                <select
                  value={returnCondition}
                  onChange={(event) => {
                    const value = event.target.value;
                    setReturnCondition(value);
                    if (kindOf(returnEvaluationLoan) === "Tool") {
                      setReturnSendMaintenance(["Damaged", "Missing part", "Needs maintenance"].includes(value));
                    }
                  }}
                >
                  <option value="Good">Good</option>
                  <option value="Minor issue">Minor issue</option>
                  <option value="Damaged">Damaged</option>
                  <option value="Missing part">Missing part</option>
                  <option value="Needs maintenance">Needs maintenance</option>
                </select>
                {kindOf(returnEvaluationLoan) === "Room Key" && (
                  <small>Damaged, missing-part, or maintenance evaluations will keep this room key unavailable.</small>
                )}
              </label>

              <label className="return-evaluation-field">
                <span>Remarks / post evaluation</span>
                <textarea
                  name="returnRemarks"
                  rows={4}
                  placeholder='Example: "Student returned the unit with a destroyed fuse."'
                />
                <small>This note will stay attached to this return record in transaction and room history.</small>
              </label>

              {kindOf(returnEvaluationLoan) === "Tool" && (
                <label className={`return-maintenance-option ${returnSendMaintenance ? "checked" : ""}`}>
                  <input
                    type="checkbox"
                    checked={returnSendMaintenance}
                    onChange={(event) => setReturnSendMaintenance(event.target.checked)}
                  />
                  <span>
                    <strong>Send this unit to maintenance</strong>
                    <small>The returned numbered unit becomes unavailable for borrowing until cleared.</small>
                  </span>
                </label>
              )}

              <footer className="return-evaluation-actions">
                <button type="button" className="secondary" onClick={closeReturnEvaluation}>Cancel</button>
                <button type="submit" className="primary">Complete return &amp; save evaluation →</button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {selectedRoomHistory && (
        <div className="room-history-backdrop" onMouseDown={() => setSelectedRoomHistoryId(null)}>
          <section
            className="room-history-viewer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="room-history-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="room-history-head">
              <div>
                <span className="eyebrow">ROOM BORROWING HISTORY</span>
                <h2 id="room-history-title">{selectedRoomHistory.room}</h2>
                <p>{selectedRoomHistory.use} · <span className="mono">{selectedRoomHistory.id}</span></p>
              </div>
              <button type="button" onClick={() => setSelectedRoomHistoryId(null)} aria-label="Close room history">×</button>
            </div>

            <div className="room-history-summary">
              <div>
                <small>Total releases</small>
                <strong>{selectedRoomHistoryLoans.length}</strong>
              </div>
              <div>
                <small>Returned</small>
                <strong>{selectedRoomHistoryLoans.filter((loan) => loan.status === "Returned").length}</strong>
              </div>
              <div className={selectedRoomActiveLoan ? "active" : ""}>
                <small>Current state</small>
                <strong>{selectedRoomActiveLoan ? "Key out" : selectedRoomHistory.status}</strong>
              </div>
            </div>

            {selectedRoomActiveLoan && (
              <div className="room-history-current">
                <span className="room-history-live-dot" aria-hidden="true" />
                <div>
                  <small>CURRENT KEY HOLDER</small>
                  <strong>{selectedRoomActiveLoan.student}</strong>
                  <p>{borrowerTypeOf(selectedRoomActiveLoan)} · {selectedRoomActiveLoan.studentId} · {selectedRoomActiveLoan.program}</p>
                </div>
                <Status value={selectedRoomActiveLoan.status} />
              </div>
            )}

            <div className="room-history-list">
              {selectedRoomHistoryLoans.map((loan, index) => {
                const initials = loan.student
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <article className={`room-history-record ${loan.status !== "Returned" ? "current" : ""}`} key={loan.id}>
                    <span className="room-history-avatar">{initials}</span>
                    <div className="room-history-record-main">
                      <div className="room-history-record-title">
                        <div>
                          <strong>{loan.student}</strong>
                          <small>{borrowerTypeOf(loan)} · {loan.studentId} · {loan.program}</small>
                        </div>
                        <span className="room-history-sequence">#{selectedRoomHistoryLoans.length - index}</span>
                      </div>
                      {loan.purpose && <p><b>Purpose:</b> {loan.purpose}</p>}
                      <div className="room-history-times">
                        <span><small>Borrowed</small><b>{loan.borrowed}</b></span>
                        <span>
                          <small>Returned</small>
                          <b>{loan.returnedAt ?? "Not returned yet"}</b>
                          {loan.returnCondition && <em className="return-condition">{loan.returnCondition}</em>}
                          {loan.returnRemarks && <em className="return-remark">{loan.returnRemarks}</em>}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}

              {selectedRoomHistoryLoans.length === 0 && (
                <div className="room-history-empty">
                  <span aria-hidden="true">↺</span>
                  <strong>No borrowing history yet</strong>
                  <p>This room has not been released to a borrower in the recorded history.</p>
                </div>
              )}
            </div>

            <div className="room-history-footer">
              <span>{selectedRoomHistory.storage}</span>
              <button type="button" className="secondary" onClick={() => setSelectedRoomHistoryId(null)}>Close</button>
            </div>
          </section>
        </div>
      )}

      {selectedBorrower && (
        <div className="backdrop" onMouseDown={() => setSelectedBorrowerId(null)}>
          <section
            className="modal borrower-record-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="borrower-record-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head borrower-record-head">
              <div>
                <span className="eyebrow">READ-ONLY BORROWER RECORD</span>
                <h2 id="borrower-record-title">{selectedBorrower.student}</h2>
                <p>
                  {borrowerTypeOf(selectedBorrower)} · {selectedBorrower.studentId} · {selectedBorrower.program}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedBorrowerId(null)} aria-label="Close">×</button>
            </div>
            <div className="borrower-record-body">
              <div className="borrower-record-summary">
                <div>
                  <small>Total transactions</small>
                  <strong>{selectedBorrowerLoans.length}</strong>
                </div>
                <div>
                  <small>Currently borrowed</small>
                  <strong>{selectedBorrowerLoans.filter((loan) => loan.status !== "Returned").length}</strong>
                </div>
                <div>
                  <small>Returned</small>
                  <strong>{selectedBorrowerLoans.filter((loan) => loan.status === "Returned").length}</strong>
                </div>
              </div>

              <div className="borrower-record-list">
                {selectedBorrowerLoans.map((loan) => (
                  <article key={loan.id}>
                    <div className="borrower-record-item-head">
                      <div>
                        <span className={`kind-tag ${kindOf(loan) === "Room Key" ? "room" : "tool"}`}>
                          {kindOf(loan)}
                        </span>
                        <strong>{loan.item}</strong>
                        <small className="mono">{assetLabelOf(loan)}</small>
                      </div>
                      <Status value={loan.status} />
                    </div>
                    <div className="borrower-record-times">
                      <span><small>Time borrowed</small><b>{loan.borrowed}</b></span>
                      <span>
                        <small>{kindOf(loan) === "Room Key" ? "Due" : "Due date"}</small>
                        <b>{kindOf(loan) === "Room Key" ? "Return after use" : loan.due}</b>
                      </span>
                      <span>
                        <small>Time returned</small>
                        <b>{loan.returnedAt ?? "Not returned yet"}</b>
                      </span>
                    </div>
                    {loan.purpose && <p><b>Purpose:</b> {loan.purpose}</p>}
                  </article>
                ))}
              </div>

              <footer className="borrower-record-footer">
                <span>This record is view-only.</span>
                <button type="button" className="secondary" onClick={() => setSelectedBorrowerId(null)}>
                  Close
                </button>
              </footer>
            </div>
          </section>
        </div>
      )}

      {detailedTool && (
        <div className="backdrop" onMouseDown={() => setSelectedToolDetails(null)}>
          <section
            className="modal item-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="item-details-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head item-details-head">
              <div>
                <span className="eyebrow">INVENTORY ITEM DETAILS</span>
                <h2 id="item-details-title">{detailedTool.name}</h2>
                <p className="mono">{detailedTool.id}</p>
              </div>
              <button type="button" onClick={() => setSelectedToolDetails(null)} aria-label="Close">×</button>
            </div>
            <div className="item-details-body">
              <div className="item-details-overview">
                <div className="item-detail-icon" aria-hidden="true">🧰</div>
                <div>
                  <small>Current status</small>
                  <Status value={toolLiveStatus(detailedTool)} />
                </div>
                <div className="item-piece-total">
                  <strong>{toolUnitCount(detailedTool)}</strong>
                  <span>{toolUnitCount(detailedTool) === 1 ? "active piece" : "active pieces"}</span>
                </div>
              </div>

              <div className="item-details-grid">
                <div><small>Category</small><strong>{detailedTool.category}</strong></div>
                <div><small>Storage location</small><strong>{detailedTool.location}</strong></div>
                <div><small>Model / specification</small><strong>{detailedTool.model || "Not specified"}</strong></div>
                <div><small>Condition</small><strong>{detailedTool.condition || "Good"}</strong></div>
              </div>

              <div className="item-detail-notes">
                <small>Item notes</small>
                <p>{detailedTool.notes || "No additional notes recorded for this item."}</p>
              </div>

              <section className="item-unit-section">
                <div className="item-unit-section-head">
                  <div>
                    <strong>Numbered units</strong>
                    <small>Select the exact piece when borrowing.</small>
                  </div>
                  <div className="item-unit-head-actions">
                    <span>{availableUnitNumbers(detailedTool).length} available · {maintenanceUnitCount(detailedTool)} maintenance</span>
                    <form onSubmit={updateDetailedToolQuantity}>
                      <label htmlFor="detail-unit-quantity">Units</label>
                      <input
                        id="detail-unit-quantity"
                        name="quantity"
                        type="number"
                        min="1"
                        step="1"
                        defaultValue={toolQuantity(detailedTool)}
                        key={toolQuantity(detailedTool)}
                        aria-label="Number of units"
                      />
                      <button type="submit">Update</button>
                    </form>
                  </div>
                </div>
                <div className="item-unit-list">
                  {allUnitNumbers(detailedTool).map((unitNumber) => {
                    const unitLoan = activeToolLoans.find(
                      (loan) =>
                        loan.assetId === detailedTool.id &&
                        unitNumberOf(loan) === unitNumber,
                    );
                    const unitState =
                      isUnitInMaintenance(detailedTool, unitNumber)
                        ? "maintenance"
                        : unitLoan
                          ? "borrowed"
                          : "available";

                    const unitMeta = unitMetaOf(detailedTool, unitNumber);
                    return (
                      <article
                        className={`item-unit-row item-unit-row-clickable ${unitState}`}
                        key={unitNumber}
                        role="button"
                        tabIndex={0}
                        aria-label={`Manage ${unitLabelOf(detailedTool, unitNumber)}`}
                        onClick={() => setSelectedUnitEditor({ toolId: detailedTool.id, unitNumber })}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedUnitEditor({ toolId: detailedTool.id, unitNumber });
                          }
                        }}
                      >
                        <span className="item-unit-number">{unitNumber}</span>
                        <div className="item-unit-identity">
                          <strong>{unitLabelOf(detailedTool, unitNumber)}</strong>
                          <small className="mono">{detailedTool.id}-{unitNumber}</small>
                          {unitMeta.condition && <small>{unitMeta.condition}</small>}
                        </div>
                        <div className="item-unit-state">
                          <Status
                            value={
                              unitState === "available"
                                ? "Available"
                                : unitState === "borrowed"
                                  ? "Borrowed"
                                  : "Maintenance"
                            }
                          />
                          {unitLoan ? (
                            <small>{unitLoan.student} · due {unitLoan.due}</small>
                          ) : unitState === "maintenance" ? (
                            <small>Click to manage maintenance.</small>
                          ) : (
                            <small>Click the row to edit this exact unit.</small>
                          )}
                        </div>
                        <div className="item-unit-actions item-unit-actions-compact">
                          <button
                            type="button"
                            className="unit-edit-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedUnitEditor({ toolId: detailedTool.id, unitNumber });
                            }}
                          >
                            Edit
                          </button>

                          <label
                            className={`unit-inline-maintenance ${unitState === "maintenance" ? "checked" : ""} ${unitLoan ? "disabled" : ""}`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={unitState === "maintenance"}
                              disabled={Boolean(unitLoan)}
                              onChange={(event) => {
                                event.stopPropagation();
                                setToolUnitMaintenance(detailedTool, unitNumber, event.target.checked);
                              }}
                            />
                            <span>Maintenance</span>
                          </label>

                          <button
                            type="button"
                            className="unit-inline-delete"
                            disabled={Boolean(unitLoan) || toolUnitCount(detailedTool) <= 1}
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteToolUnit(detailedTool, unitNumber);
                            }}
                          >
                            Delete
                          </button>

                          {unitState === "available" && (
                            <button
                              type="button"
                              className="small unit-inline-borrow"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedToolDetails(null);
                                openBorrowing("tool", detailedTool.id, unitNumber);
                              }}
                            >
                              Borrow
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <footer className="item-details-footer">
                <button
                  type="button"
                  className="delete-record-button"
                  disabled={Boolean(detailedToolLoan)}
                  onClick={() => requestDeleteTool(detailedTool)}
                >
                  Delete item
                </button>
                <div>
                  <button type="button" className="secondary" onClick={() => setSelectedToolDetails(null)}>Close</button>
                  {availableUnitNumbers(detailedTool).length > 0 && (
                    <button
                      type="button"
                      className="primary"
                      onClick={() => {
                        setSelectedToolDetails(null);
                        openBorrowing("tool", detailedTool.id);
                      }}
                    >
                      Assign to borrower →
                    </button>
                  )}
                </div>
              </footer>
            </div>
          </section>
        </div>
      )}

      {selectedUnitTool && selectedUnitNumber && (
        <div className="backdrop unit-editor-backdrop" onMouseDown={() => setSelectedUnitEditor(null)}>
          <section
            className="modal unit-editor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unit-editor-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head unit-editor-head">
              <div>
                <span className="eyebrow">INDIVIDUAL UNIT</span>
                <h2 id="unit-editor-title">{unitLabelOf(selectedUnitTool, selectedUnitNumber)}</h2>
                <p className="mono">{selectedUnitTool.id}-{selectedUnitNumber}</p>
              </div>
              <button type="button" onClick={() => setSelectedUnitEditor(null)} aria-label="Close">×</button>
            </div>

            <form className="unit-editor-form" onSubmit={saveToolUnitDetails}>
              <div className="unit-editor-status-row">
                <Status
                  value={
                    isUnitInMaintenance(selectedUnitTool, selectedUnitNumber)
                      ? "Maintenance"
                      : selectedUnitLoan
                        ? "Borrowed"
                        : "Available"
                  }
                />
                {selectedUnitLoan ? (
                  <span>Borrowed by <b>{selectedUnitLoan.student}</b> · due {selectedUnitLoan.due}</span>
                ) : (
                  <span>This unit is not currently borrowed.</span>
                )}
              </div>

              <div className="unit-editor-grid">
                <label>
                  <span>Unit label</span>
                  <input
                    name="unitLabel"
                    defaultValue={selectedUnitMeta.label ?? `${selectedUnitTool.name} ${selectedUnitNumber}`}
                    key={`${selectedUnitTool.id}-${selectedUnitNumber}-label-${selectedUnitMeta.label ?? ""}`}
                    placeholder={`${selectedUnitTool.name} ${selectedUnitNumber}`}
                  />
                </label>
                <label>
                  <span>Condition</span>
                  <select
                    name="unitCondition"
                    defaultValue={selectedUnitMeta.condition ?? "Good"}
                    key={`${selectedUnitTool.id}-${selectedUnitNumber}-condition-${selectedUnitMeta.condition ?? "Good"}`}
                  >
                    <option>Good</option>
                    <option>Needs inspection</option>
                    <option>Needs repair</option>
                    <option>Damaged</option>
                  </select>
                </label>
                <label className="full">
                  <span>Unit notes</span>
                  <textarea
                    name="unitNotes"
                    rows={3}
                    defaultValue={selectedUnitMeta.notes ?? ""}
                    key={`${selectedUnitTool.id}-${selectedUnitNumber}-notes-${selectedUnitMeta.notes ?? ""}`}
                    placeholder="Optional note for this exact numbered unit..."
                  />
                </label>
              </div>

              <section className="unit-editor-maintenance">
                <div>
                  <strong>Maintenance status</strong>
                  <small>Only this numbered unit will be affected.</small>
                </div>
                <label className={`unit-editor-switch ${isUnitInMaintenance(selectedUnitTool, selectedUnitNumber) ? "checked" : ""} ${selectedUnitLoan ? "disabled" : ""}`}>
                  <input
                    type="checkbox"
                    checked={isUnitInMaintenance(selectedUnitTool, selectedUnitNumber)}
                    disabled={Boolean(selectedUnitLoan)}
                    onChange={(event) =>
                      setToolUnitMaintenance(selectedUnitTool, selectedUnitNumber, event.target.checked)
                    }
                  />
                  <span>{isUnitInMaintenance(selectedUnitTool, selectedUnitNumber) ? "In maintenance" : "Ready for use"}</span>
                </label>
              </section>

              <footer className="unit-editor-footer">
                <button
                  type="button"
                  className="unit-delete-button danger"
                  disabled={Boolean(selectedUnitLoan) || toolUnitCount(selectedUnitTool) <= 1}
                  onClick={() => deleteToolUnit(selectedUnitTool, selectedUnitNumber)}
                >
                  Delete this unit
                </button>
                <div>
                  <button type="button" className="secondary" onClick={() => setSelectedUnitEditor(null)}>Close</button>
                  {!selectedUnitLoan && !isUnitInMaintenance(selectedUnitTool, selectedUnitNumber) && (
                    <button
                      type="button"
                      className="secondary unit-borrow-from-editor"
                      onClick={() => {
                        setSelectedUnitEditor(null);
                        setSelectedToolDetails(null);
                        openBorrowing("tool", selectedUnitTool.id, selectedUnitNumber);
                      }}
                    >
                      Borrow unit
                    </button>
                  )}
                  <button type="submit" className="primary">Save changes</button>
                </div>
              </footer>
            </form>
          </section>
        </div>
      )}

      {deleteInventoryOpen && (
        <div className="backdrop" onMouseDown={() => setDeleteInventoryOpen(false)}>
          <section
            className="modal delete-inventory-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-inventory-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head delete-inventory-head">
              <div>
                <span className="eyebrow">INVENTORY MANAGEMENT</span>
                <h2 id="delete-inventory-title">Delete inventory item</h2>
                <p>Choose the item you want to remove from the inventory.</p>
              </div>
              <button type="button" onClick={() => setDeleteInventoryOpen(false)} aria-label="Close">×</button>
            </div>
            <form onSubmit={chooseInventoryToDelete}>
              <label className="delete-inventory-picker">
                <span>Inventory item</span>
                <select name="assetId" required defaultValue="">
                  <option value="" disabled>Select an inventory item</option>
                  {tools.map((tool) => {
                    const isBorrowed = active.some((loan) => loan.assetId === tool.id);
                    return (
                      <option key={tool.id} value={tool.id} disabled={isBorrowed}>
                        {tool.name} · {tool.id}{isBorrowed ? " · Currently borrowed" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
              <div className="delete-inventory-note">
                Borrowed items cannot be deleted until every numbered unit is returned.
              </div>
              <footer>
                <button type="button" className="secondary" onClick={() => setDeleteInventoryOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="delete-inventory-continue">
                  Continue to confirmation
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {manageModal && (
        <div className="backdrop" onMouseDown={closeManageModal}>
          <section
            className="modal manage-record-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">RECORD MANAGEMENT</span>
                <h2>{manageModal === "addTool" ? "Add inventory item" : "Add room and key"}</h2>
                <p>
                  {manageModal === "addTool"
                    ? "Create a tool record that can be assigned to borrowers."
                    : "Create a room record with its assigned key and storage location."}
                </p>
              </div>
              <button type="button" onClick={closeManageModal} aria-label="Close">×</button>
            </div>

            {manageModal === "addTool" ? (
              <form onSubmit={addTool}>
                <div className="form-grid">
                  <label>
                    <span>Asset ID</span>
                    <input name="assetId" required placeholder="TL-XX-0001" autoComplete="off" />
                  </label>
                  <label>
                    <span>Tool or item name</span>
                    <input name="name" required placeholder="Digital Caliper" autoComplete="off" />
                  </label>
                  <label>
                    <span>Category</span>
                    <select name="category" defaultValue="Measuring Tools" required>
                      {toolCategories.slice(1).map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Storage location</span>
                    <input name="location" required placeholder="Cabinet A" autoComplete="off" />
                  </label>
                  <label>
                    <span>Number of pieces</span>
                    <input name="quantity" type="number" min="1" step="1" required defaultValue="1" />
                  </label>
                  <label>
                    <span>Model or specification</span>
                    <input name="model" placeholder="Model, size, or specification" autoComplete="off" />
                  </label>
                  <label>
                    <span>Condition</span>
                    <select name="condition" defaultValue="Good" required>
                      <option value="New">New</option>
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                      <option value="Needs Repair">Needs repair</option>
                    </select>
                  </label>
                  <label>
                    <span>Starting status</span>
                    <select name="status" defaultValue="Available" required>
                      <option value="Available">Available</option>
                      <option value="Maintenance">Maintenance</option>
                    </select>
                  </label>
                  <label className="full">
                    <span>Notes</span>
                    <textarea name="notes" rows={3} placeholder="Accessories included, calibration notes, condition details..." />
                  </label>
                </div>
                <div className="note">
                  <b>i</b>
                  <p>Asset IDs must be unique. The new item is saved on this device.</p>
                </div>
                <footer>
                  <button type="button" className="secondary" onClick={closeManageModal}>Cancel</button>
                  <button className="primary">Add inventory item →</button>
                </footer>
              </form>
            ) : (
              <form onSubmit={addRoom}>
                <div className="form-grid">
                  <label>
                    <span>Room name or number</span>
                    <input name="room" required placeholder="COAC 106" autoComplete="off" />
                  </label>
                  <label>
                    <span>Assigned key ID</span>
                    <input name="keyId" required placeholder="KEY-COAC-106" autoComplete="off" />
                  </label>
                  <label className="full">
                    <span>Room purpose</span>
                    <input name="use" required placeholder="Computer Control Laboratory" autoComplete="off" />
                  </label>
                  <label>
                    <span>Key storage</span>
                    <input name="storage" required defaultValue="Tool Crib Key Board" autoComplete="off" />
                  </label>
                  <label>
                    <span>Starting status</span>
                    <select name="status" defaultValue="Available" required>
                      <option value="Available">Available</option>
                      <option value="Maintenance">Maintenance</option>
                    </select>
                  </label>
                </div>
                <div className="note room-note-modal">
                  <b>🔑</b>
                  <p>Key IDs must be unique. The room appears immediately on both room maps.</p>
                </div>
                <footer>
                  <button type="button" className="secondary" onClick={closeManageModal}>Cancel</button>
                  <button className="primary">Add room and key →</button>
                </footer>
              </form>
            )}
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="backdrop" onMouseDown={() => setDeleteTarget(null)}>
          <section
            className="modal delete-record-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-record-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">CONFIRM DELETE</span>
                <h2 id="delete-record-title">Delete {deleteTarget.label}?</h2>
                <p>This removes the {deleteTarget.kind === "tool" ? "inventory item" : "room and key"} from this device.</p>
              </div>
              <button type="button" onClick={() => setDeleteTarget(null)} aria-label="Close">×</button>
            </div>
            <div className="delete-record-body">
              <div className="delete-record-warning">
                <strong>This action cannot be undone.</strong>
                <span className="mono">{deleteTarget.id}</span>
              </div>
              <footer>
                <button type="button" className="secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button type="button" className="confirm-erase-button" onClick={confirmDeleteRecord}>Delete record</button>
              </footer>
            </div>
          </section>
        </div>
      )}

      {eraseModalOpen && (
        <div className="backdrop" onMouseDown={closeEraseModal}>
          <section
            className="modal erase-transactions-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="erase-transactions-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">PROTECTED ACTION</span>
                <h2 id="erase-transactions-title">Erase all transactions?</h2>
                <p>This permanently clears every tool and room-key transaction on this device.</p>
              </div>
              <button type="button" onClick={closeEraseModal} aria-label="Close">
                ×
              </button>
            </div>
            <form onSubmit={eraseAllTransactions}>
              <label className="erase-password-field">
                <span>Admin password</span>
                <input
                  autoFocus
                  type="password"
                  value={erasePassword}
                  onChange={(event) => {
                    setErasePassword(event.target.value);
                    setEraseError("");
                  }}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                />
              </label>
              {eraseError && (
                <p className="erase-password-error" role="alert">
                  {eraseError}
                </p>
              )}
              <div className="erase-warning">
                Borrowed tools and rooms will be marked available after their transaction records are erased.
              </div>
              <footer>
                <button type="button" className="secondary" onClick={closeEraseModal}>
                  Cancel
                </button>
                <button type="submit" className="confirm-erase-button">
                  Erase everything
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {printLoan && printLoans.length > 0 && (
        <BorrowingPrintModal
          loans={printLoans}
          releasedBy={DEFAULT_RELEASING_OFFICER}
          onClose={() => setPrintLoanId(null)}
        />
      )}

      <div className="luntian-corner-credit" aria-label="Powered by Luntian">
        <span>Powered by</span>
        <strong>Luntian</strong>
      </div>

      {toast && (
        <div className="toast">
          <b>✓</b>
          {toast}
        </div>
      )}
    </div>
  );
}


function BorrowerPortal({
  tools,
  rooms,
  loans,
  onRequestTool,
  onRequestRoom,
  onAdminAccess,
  toast,
}: {
  tools: Tool[];
  rooms: RoomKey[];
  loans: Loan[];
  onRequestTool: (request: {
    assetId: string;
    unitNumber: number;
    days: number;
    student: string;
    studentId: string;
    program: string;
    borrowerType: BorrowerType;
    purpose: string;
  }) => Promise<boolean>;
  onRequestRoom: (request: {
    roomId: string;
    purpose: string;
    student: string;
    studentId: string;
    program: string;
    borrowerType: BorrowerType;
  }) => Promise<boolean>;
  onAdminAccess: () => void;
  toast: string;
}) {
  type BorrowerView = "Home" | "Inventory" | "Rooms & Keys" | "Active";
  const borrowerViews: BorrowerView[] = ["Home", "Inventory", "Rooms & Keys", "Active"];
  const [view, setView] = useState<BorrowerView>("Home");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ToolCategory>("All Tools");
  const [toolRequest, setToolRequest] = useState<{ tool: Tool; unitNumber: number } | null>(null);
  const [roomRequest, setRoomRequest] = useState<RoomKey | null>(null);
  const [printLoan, setPrintLoan] = useState<Loan | null>(null);
  const [requestBusy, setRequestBusy] = useState(false);

  const normalizeId = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const activeLoans = loans.filter((loan) => !["Returned", "Pending", "Declined"].includes(loan.status));
  const pendingLoans = loans.filter((loan) => loan.status === "Pending");
  const toolQuantity = (tool: Tool) => Math.max(1, tool.quantity ?? 1);
  const existingUnits = (tool: Tool) => {
    const deleted = new Set(tool.deletedUnits ?? []);
    return Array.from({ length: toolQuantity(tool) }, (_, index) => index + 1).filter((unit) => !deleted.has(unit));
  };
  const maintenanceUnits = (tool: Tool) => {
    if (tool.maintenanceUnits !== undefined) return new Set(tool.maintenanceUnits);
    return new Set(tool.status === "Maintenance" ? existingUnits(tool) : []);
  };
  const occupiedUnits = (tool: Tool) =>
    new Set(
      activeLoans
        .filter((loan) => kindOf(loan) === "Tool" && loan.assetId === tool.id)
        .map((loan) => unitNumberOf(loan)),
    );
  const availableUnits = (tool: Tool) => {
    const maintenance = maintenanceUnits(tool);
    const occupied = occupiedUnits(tool);
    return existingUnits(tool).filter((unit) => !maintenance.has(unit) && !occupied.has(unit));
  };
  const readyToolUnits = tools.reduce((sum, tool) => sum + availableUnits(tool).length, 0);
  const availableRooms = rooms.filter((room) => room.status === "Available").length;

  const q = query.trim().toLowerCase();
  const visibleTools = tools.filter((tool) => {
    const categoryMatch = category === "All Tools" || tool.category === category;
    const textMatch = !q || `${tool.id} ${tool.name} ${tool.category} ${tool.location}`.toLowerCase().includes(q);
    return categoryMatch && textMatch;
  });
  const visibleRooms = rooms.filter(
    (room) => !q || `${room.id} ${room.room} ${room.use}`.toLowerCase().includes(q),
  );
  const categoryCount = (entry: ToolCategory) =>
    entry === "All Tools" ? tools.length : tools.filter((tool) => tool.category === entry).length;

  const publicActiveLoans = loans
    .filter((loan) => !["Returned", "Declined"].includes(loan.status))
    .sort((a, b) => {
      const aDate = new Date(a.requestedAtIso ?? a.borrowedAtIso ?? a.id).getTime();
      const bDate = new Date(b.requestedAtIso ?? b.borrowedAtIso ?? b.id).getTime();
      return bDate - aDate;
    });
  const pageTitle = view === "Home" ? "Tool Crib" : view;

  const submitToolRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!toolRequest || requestBusy) return;
    const form = new FormData(event.currentTarget);
    const studentId = String(form.get("studentId") ?? "").trim();
    setRequestBusy(true);
    const ok = await onRequestTool({
      assetId: toolRequest.tool.id,
      unitNumber: toolRequest.unitNumber,
      days: Math.max(1, Number(form.get("days")) || 7),
      student: String(form.get("student") ?? ""),
      studentId,
      program: String(form.get("program") ?? ""),
      borrowerType: String(form.get("borrowerType") ?? "Student") as BorrowerType,
      purpose: String(form.get("purpose") ?? ""),
    });
    setRequestBusy(false);
    if (ok) {
      setToolRequest(null);
      setView("Active");
    }
  };

  const submitRoomRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!roomRequest || requestBusy) return;
    const form = new FormData(event.currentTarget);
    const studentId = String(form.get("studentId") ?? "").trim();
    const selectedRoomId = String(form.get("roomKey") ?? roomRequest.id);
    setRequestBusy(true);
    const ok = await onRequestRoom({
      roomId: selectedRoomId,
      purpose: String(form.get("purpose") ?? ""),
      student: String(form.get("student") ?? ""),
      studentId,
      program: String(form.get("program") ?? ""),
      borrowerType: String(form.get("borrowerType") ?? "Student") as BorrowerType,
    });
    setRequestBusy(false);
    if (ok) {
      setRoomRequest(null);
      setView("Active");
    }
  };

  const borrowerFields = (
    <div className="borrower-request-fields">
      <label>
        <span>Full name</span>
        <input name="student" autoComplete="name" placeholder="Juan Dela Cruz" required />
      </label>
      <label>
        <span>TUPV / Faculty ID</span>
        <input name="studentId" placeholder="TUPV-00-0000" required />
      </label>
      <label>
        <span>Borrower type</span>
        <select name="borrowerType" defaultValue="Student">
          <option value="Student">Student</option>
          <option value="Professor">Professor</option>
        </select>
      </label>
      <label>
        <span>Program, year & section</span>
        <input name="program" placeholder="BETMxT 3A / COAC Faculty" required />
      </label>
    </div>
  );

  return (
    <div className="user-portal user-portal-rich borrower-portal">
      <header className="topbar user-rich-topbar borrower-topbar">
        <button className="brand user-rich-brand" type="button" onClick={() => setView("Home")}> 
          <img src="/coac-logo.png" alt="COAC logo" />
          <span>
            <strong>Tool Crib</strong>
            <small>Borrower Portal · College of Automation and Control</small>
          </span>
        </button>

        <nav className="top-nav user-rich-nav borrower-nav" aria-label="Borrower portal">
          <span
            className="top-nav-slider borrower-nav-slider"
            aria-hidden="true"
            style={{ transform: `translateX(${borrowerViews.indexOf(view) * 100}%)` }}
          />
          {borrowerViews.map((entry) => (
            <button key={entry} className={view === entry ? "active" : ""} onClick={() => setView(entry)}>
              {entry === "Home" ? "Tool Crib" : entry === "Active" ? "Active Borrowing" : entry}
            </button>
          ))}
        </nav>

        <div className="actions user-rich-actions borrower-topbar-actions">
          {view !== "Home" && view !== "Active" && (
            <label className="search user-rich-search">
              <span>⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${view.toLowerCase()}...`}
              />
              {query && <button type="button" onClick={() => setQuery("")}>×</button>}
            </label>
          )}
          <button className="borrower-admin-link" type="button" onClick={onAdminAccess}>Admin sign in</button>
        </div>
      </header>

      <div className="mobile-nav user-rich-mobile-nav borrower-mobile-nav">
        {borrowerViews.map((entry) => (
          <button key={entry} className={view === entry ? "active" : ""} onClick={() => setView(entry)}>{entry === "Home" ? "Tool Crib" : entry === "Active" ? "Active" : entry}</button>
        ))}
      </div>

      <main className={`user-main ${view === "Home" ? "user-main-home" : "user-main-workspace"}`}>
        {view !== "Home" && (
          <section className="workspace-head user-workspace-head borrower-workspace-head">
            <div>
              <span className="eyebrow">COAC TOOL AID</span>
              <h1>{view === "Active" ? "Active Borrowing" : pageTitle}</h1>
              <p>
                {view === "Inventory"
                  ? "Choose an available tool or exact numbered unit and submit the borrower's details."
                  : view === "Rooms & Keys"
                    ? "Check room-key availability and submit a borrowing request."
                    : "Active and pending borrowing records for all COAC students and faculty. Personal borrower details remain visible only to administrators."}
              </p>
            </div>
          </section>
        )}

        {view === "Home" && (
          <>
            <section className="borrower-tool-aid-home">
              <div className="borrower-tool-aid-title">
                <img src="/coac-logo.png" alt="COAC logo" />
                <div>
                  <span>COLLEGE OF AUTOMATION AND CONTROL</span>
                  <h1>Tool Crib</h1>
                  <p>Borrow equipment and room keys.</p>
                </div>
              </div>
              <div className="borrower-tool-aid-actions">
                <button className="primary" type="button" onClick={() => setView("Inventory")}>Browse equipment →</button>
                <button className="secondary" type="button" onClick={() => setView("Rooms & Keys")}>Rooms &amp; keys</button>
                <button className="secondary" type="button" onClick={() => setView("Active")}>Active borrowing</button>
              </div>
              <HeroClock />
            </section>

            <section className="dashboard user-home-dashboard borrower-home-dashboard">
              <section className="dashboard-zone user-dashboard-zone borrower-dashboard-zone">
                <div className="dashboard-zone-head">
                  <div><span className="eyebrow">LIVE TOOL AID</span><h2>Availability</h2><p>Equipment and room-key status for all COAC borrowers.</p></div>
                  <button className="dashboard-zone-link" type="button" onClick={() => setView("Active")}>View active →</button>
                </div>
                <div className="borrower-home-overview-grid">
                  <article className="panel borrower-home-stats-card">
                    <div className="panel-head">
                      <div><strong>Tool Crib status</strong><small>Live borrowing availability</small></div>
                    </div>
                    <div className="stats user-rich-stats borrower-stats">
                      <Stat tone="blue" icon="▣" value={String(readyToolUnits)} label="Tool Units Ready" foot="Available" click={() => setView("Inventory")} />
                      <Stat tone="green" icon="⌂" value={String(availableRooms)} label="Rooms & Keys" foot="Available" click={() => setView("Rooms & Keys")} />
                      <Stat tone="orange" icon="◷" value={String(pendingLoans.length)} label="Pending" foot="For approval" click={() => setView("Active")} />
                      <Stat tone="purple" icon="●" value={String(activeLoans.length)} label="Active" foot="Released" click={() => setView("Active")} />
                    </div>
                  </article>

                  <article className="panel dashboard-room-display user-room-display borrower-room-display">
                    <div className="panel-head">
                      <div><strong>Live rooms &amp; keys</strong><small>Green available · red key out · orange maintenance</small></div>
                      <button type="button" onClick={() => setView("Rooms & Keys")}>View all →</button>
                    </div>
                    <div className="room-display-grid">
                      {rooms.map((room) => (
                        <button
                          type="button"
                          key={room.id}
                          className={`room-display-tile ${room.status === "Available" ? "available" : room.status === "Borrowed" ? "borrowed" : "maintenance"}`}
                          onClick={() => setView("Rooms & Keys")}
                        >
                          <i />
                          <strong>{room.room}</strong>
                          <span>{room.status === "Available" ? "Available" : room.status === "Borrowed" ? "Key out" : "Maintenance"}</span>
                        </button>
                      ))}
                    </div>
                  </article>
                </div>
              </section>
            </section>
          </>
        )}

        {view === "Inventory" && (
          <section className="user-panel borrower-catalog-panel borrower-catalog-enhanced">
            <div className="user-panel-head borrower-panel-head-grid">
              <div><strong>Equipment catalog</strong><small>Request the exact numbered unit you need</small></div>
              <div className="borrower-catalog-head-actions">
                <label className="borrower-panel-search" aria-label="Search equipment catalog">
                  <span aria-hidden="true">⌕</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search tool name, asset ID, category or location..."
                  />
                  {query && (
                    <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>×</button>
                  )}
                </label>
                <span>{visibleTools.length} tools</span>
              </div>
            </div>
            <div className="user-category-tabs borrower-category-tabs borrower-category-cards">
              {toolCategories.map((entry) => (
                <button
                  key={entry}
                  className={category === entry ? "active" : ""}
                  onClick={() => setCategory(entry)}
                >
                  <span><ToolCategoryIcon category={entry} /></span>
                  <div className="borrower-category-copy">
                    <strong>{entry}</strong>
                    <small>{toolCategoryMeta[entry].subtitle}</small>
                  </div>
                  <b>{categoryCount(entry)}</b>
                </button>
              ))}
            </div>
            <div className="user-tool-grid borrower-tool-grid">
              {visibleTools.map((tool) => {
                const readyUnits = availableUnits(tool);
                const occupied = occupiedUnits(tool);
                const maintenance = maintenanceUnits(tool);
                return (
                  <article key={tool.id}>
                    <header><span className="mono">{tool.id}</span><Status value={readyUnits.length ? "Available" : maintenance.size ? "Maintenance" : "Borrowed"} /></header>
                    <h3>{tool.name}</h3>
                    <p>{tool.category} · {tool.location}</p>
                    <div className="user-unit-summary borrower-unit-summary">
                      <strong>Units</strong>
                      <span>{readyUnits.length} available · {occupied.size} borrowed{maintenance.size ? ` · ${maintenance.size} maintenance` : ""}</span>
                    </div>
                    <div className="user-unit-buttons borrower-unit-buttons">
                      {existingUnits(tool).map((unit) => {
                        const state = maintenance.has(unit) ? "maintenance" : occupied.has(unit) ? "borrowed" : "available";
                        const ready = state === "available";
                        return (
                          <button
                            type="button"
                            key={unit}
                            className={`borrower-unit-button ${state}`}
                            disabled={!ready}
                            onClick={() => setToolRequest({ tool, unitNumber: unit })}
                            aria-label={`${tool.name} unit ${unit}: ${state}`}
                          >
                            <b>Unit {unit}</b>
                            <span>{state === "available" ? "Available" : state === "borrowed" ? "Borrowed" : "Maintenance"}</span>
                          </button>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
              {visibleTools.length === 0 && <div className="user-empty">No equipment matches your search.</div>}
            </div>
          </section>
        )}

        {view === "Rooms & Keys" && (
          <section className="user-panel borrower-rooms-panel">
            <div className="user-panel-head">
              <div><strong>Room & key availability</strong><small>Green means available. Red means the key is borrowed. Borrower identities stay private.</small></div>
              <span>{availableRooms} available</span>
            </div>

            <div className="borrower-rooms-layout">
              <div className="user-room-grid borrower-room-grid">
                {visibleRooms.map((room) => (
                  <article id={`borrow-room-${room.id}`} key={room.id} className={`borrower-room-card ${room.status.toLowerCase()}`}>
                    <div className="user-room-state borrower-room-card-state">
                      <i />
                      <strong>{room.status === "Available" ? "AVAILABLE" : room.status === "Borrowed" ? "KEY OUT" : "MAINTENANCE"}</strong>
                    </div>
                    <div className="borrower-room-card-title">
                      <div>
                        <span>ROOM</span>
                        <h3>{room.room}</h3>
                        <p>{room.use}</p>
                      </div>
                      <span className={`borrower-key-mark ${room.status.toLowerCase()}`} aria-hidden="true">⌂</span>
                    </div>
                    <div className="borrower-room-card-details">
                      <span><small>Key ID</small><strong className="mono">{room.id}</strong></span>
                      <span><small>Key storage</small><strong>{room.storage || "Tool Crib"}</strong></span>
                    </div>
                    <div className="borrower-room-card-message">
                      <strong>{room.status === "Available" ? "Ready for borrowing" : room.status === "Borrowed" ? "Key currently out" : "Temporarily unavailable"}</strong>
                      <small>{room.status === "Available" ? "Key is ready at the Tool Crib." : room.status === "Borrowed" ? "The key is currently borrowed." : "Room or assigned key is under maintenance."}</small>
                    </div>
                    <button type="button" disabled={room.status !== "Available"} onClick={() => setRoomRequest(room)}>
                      {room.status === "Available" ? "Request room & key →" : room.status === "Borrowed" ? "Key borrowed" : "Maintenance"}
                    </button>
                  </article>
                ))}
                {visibleRooms.length === 0 && <div className="user-empty">No rooms match your search.</div>}
              </div>

              <aside className="room-mini-map borrower-room-sidebar" aria-label="Room and key status">
                <div className="room-mini-map-head">
                  <div><span className="dashboard-zone-kicker">LIVE ROOM MAP</span><strong>COAC rooms</strong></div>
                  <span className="room-mini-live"><i /> Live</span>
                </div>
                <div className="room-mini-summary">
                  <span><b>{availableRooms}</b> available</span>
                  <span><b>{rooms.filter((room) => room.status === "Borrowed").length}</b> occupied</span>
                </div>
                <div className="room-mini-grid">
                  {rooms.map((room) => {
                    const roomState = room.status === "Available" ? "available" : room.status === "Borrowed" ? "occupied" : "maintenance";
                    return (
                      <button
                        type="button"
                        className={`room-mini-tile ${roomState}`}
                        key={room.id}
                        onClick={() => document.getElementById(`borrow-room-${room.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                      >
                        <i aria-hidden="true" />
                        <strong>{room.room}</strong>
                        <small>{roomState === "available" ? "Available" : roomState === "occupied" ? "Key out" : "Maintenance"}</small>
                      </button>
                    );
                  })}
                </div>
                <div className="room-mini-legend">
                  <span><i className="available" /> Available</span>
                  <span><i className="occupied" /> Borrowed</span>
                  <span><i className="maintenance" /> Maintenance</span>
                </div>
              </aside>
            </div>
          </section>
        )}

        {view === "Active" && (
          <section className="user-panel borrower-active-panel">
            <div className="user-panel-head">
              <div><strong>Active borrowing</strong><small>Current requests and released items for all COAC students and faculty</small></div>
              <span>{publicActiveLoans.length} active</span>
            </div>
            <div className="borrower-active-note">
              <span>ALL COAC BORROWERS</span>
              <strong>Active and pending borrowing</strong>
              <small>Students can see availability and status. Names, IDs and full borrower records stay in the admin dashboard.</small>
            </div>
            <div className="table-scroll user-activity-table-wrap borrower-activity-table-wrap">
              <table className="user-activity-table">
                <thead><tr><th>Type</th><th>Item / Asset</th><th>Requested / Borrowed</th><th>Due</th><th>Status</th></tr></thead>
                <tbody>
                  {publicActiveLoans.length === 0 ? (
                    <tr><td colSpan={5}><div className="borrower-active-empty">No active borrowings or pending requests.</div></td></tr>
                  ) : publicActiveLoans.map((loan) => (
                    <tr key={loan.id}>
                      <td><span className={`kind-tag ${kindOf(loan) === "Room Key" ? "room" : "tool"}`}>{kindOf(loan)}</span></td>
                      <td><strong>{loan.item}</strong><small className="mono">{assetLabelOf(loan)}</small></td>
                      <td><strong>{loan.status === "Pending" ? loan.requestedAt ?? "Pending" : loan.borrowed}</strong>{loan.requestedAt && loan.status !== "Pending" && <small>Requested {loan.requestedAt}</small>}</td>
                      <td>{kindOf(loan) === "Room Key" ? "—" : loan.due}</td>
                      <td><Status value={loan.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {toolRequest && (
        <div className="backdrop" onMouseDown={() => !requestBusy && setToolRequest(null)}>
          <section className="modal user-request-modal borrower-request-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head"><div><span className="eyebrow">EQUIPMENT REQUEST</span><h2>Request {toolRequest.tool.name} {toolRequest.unitNumber}</h2><p>Enter the actual borrower information for this request. Tool Crib staff approve and physically release the item.</p></div><button disabled={requestBusy} onClick={() => setToolRequest(null)}>×</button></div>
            <form onSubmit={submitToolRequest}>
              <div className="user-request-summary"><span className="mono">{toolRequest.tool.id}-{toolRequest.unitNumber}</span><strong>{toolRequest.tool.name} {toolRequest.unitNumber}</strong><small>{toolRequest.tool.category} · {toolRequest.tool.location}</small></div>
              {borrowerFields}
              <div className="borrower-request-extra">
                <label><span>Borrowing period</span><select name="days" defaultValue="7"><option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option></select></label>
                <label><span>Purpose</span><input name="purpose" placeholder="Laboratory activity, project testing..." required /></label>
              </div>
              <div className="user-identity-lock borrower-request-note"><strong>Borrower record</strong><span>The name and TUPV/faculty ID entered above are attached to this request for admin approval and monitoring.</span></div>
              <footer><button type="button" className="secondary" disabled={requestBusy} onClick={() => setToolRequest(null)}>Cancel</button><button className="primary" disabled={requestBusy}>{requestBusy ? "Sending..." : "Send request →"}</button></footer>
            </form>
          </section>
        </div>
      )}

      {roomRequest && (
        <div className="backdrop" onMouseDown={() => !requestBusy && setRoomRequest(null)}>
          <section
            className="modal room-access-modal borrower-room-access-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head room-modal-head">
              <div>
                <span className="eyebrow">ROOM ACCESS REQUEST</span>
                <h2>Request a room and key</h2>
                <p>Enter the borrower details and selected room. Tool Crib staff approve the request before the key is released.</p>
              </div>
              <button
                type="button"
                disabled={requestBusy}
                onClick={() => setRoomRequest(null)}
                aria-label="Close room request form"
              >
                ×
              </button>
            </div>

            <form onSubmit={submitRoomRequest}>
              <div className="form-grid">
                <label>
                  <span>Borrower type</span>
                  <select name="borrowerType" defaultValue="Student" required>
                    <option value="Student">Student</option>
                    <option value="Professor">Professor</option>
                  </select>
                </label>

                <label>
                  <span>Borrower full name</span>
                  <input name="student" required placeholder="Juan Dela Cruz" autoComplete="name" />
                </label>

                <label>
                  <span>ID number</span>
                  <input name="studentId" required placeholder="Student or employee ID" autoComplete="off" />
                </label>

                <ProgramSectionFields includeFaculty />

                <label className="full">
                  <span>Available room and key</span>
                  <select name="roomKey" required defaultValue={roomRequest.id}>
                    {rooms
                      .filter((room) => room.status === "Available")
                      .map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.room} - {room.use} - {room.id}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="full">
                  <span>Purpose of room use</span>
                  <input
                    name="purpose"
                    required
                    placeholder="Laboratory activity, project testing, organization meeting..."
                  />
                </label>
              </div>

              <div className="note room-note-modal">
                <b>🔑</b>
                <p>The request appears in the admin monitoring view. The room is marked borrowed only after Tool Crib staff approve and release the assigned key.</p>
              </div>

              <footer>
                <button
                  type="button"
                  className="secondary"
                  disabled={requestBusy}
                  onClick={() => setRoomRequest(null)}
                >
                  Cancel
                </button>
                <button className="primary" disabled={requestBusy}>
                  {requestBusy ? "Sending..." : "Send room request →"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {printLoan && <BorrowingPrintModal loans={[printLoan]} releasedBy={DEFAULT_RELEASING_OFFICER} onClose={() => setPrintLoan(null)} />}
      {toast && <div className="toast user-toast"><b>✓</b>{toast}</div>}
      <div className="user-luntian-credit"><span>Powered by</span><strong>Luntian</strong></div>
    </div>
  );
}


function BorrowingPrintModal({
  loans,
  releasedBy,
  onClose,
}: {
  loans: Loan[];
  releasedBy: string;
  onClose: () => void;
}) {
  const primaryLoan = loans[0];
  const allReturned = loans.length > 0 && loans.every((loan) => loan.status === "Returned");
  const [mode, setMode] = useState<PrintFormMode>(allReturned ? "complete" : "release");
  if (!primaryLoan) return null;

  const transactionNo = borrowingBatchNumberOf(loans);
  const hasTools = loans.some((loan) => kindOf(loan) === "Tool");
  const hasRoomKeys = loans.some((loan) => kindOf(loan) === "Room Key");
  const typeLabel = hasTools && hasRoomKeys ? "Equipment & Room Key" : hasRoomKeys ? "Room Key" : "Equipment";
  const showRelease = mode === "release" || mode === "complete";
  const showReturn = mode === "return" || mode === "complete";
  const returnedCount = loans.filter((loan) => loan.status === "Returned").length;
  const statuses = Array.from(new Set(loans.map((loan) => loan.status)));
  const statusLabel = statuses.length === 1 ? statuses[0] : `${returnedCount}/${loans.length} returned`;
  const borrowedLabel = primaryLoan.borrowed === "Awaiting release"
    ? primaryLoan.requestedAt ?? "Awaiting release"
    : primaryLoan.borrowed;

  return (
    <div className="backdrop print-form-backdrop" onMouseDown={onClose}>
      <section className="print-form-dialog" role="dialog" aria-modal="true" aria-label="Printable COAC borrowing form" onMouseDown={(event) => event.stopPropagation()}>
        <div className="print-form-toolbar no-print">
          <div>
            <strong>COAC printable borrowing record</strong>
            <small>{transactionNo} · {loans.length} item{loans.length === 1 ? "" : "s"} on one form</small>
          </div>
          <div className="print-mode-tabs">
            <button type="button" className={mode === "release" ? "active" : ""} onClick={() => setMode("release")}>Release form</button>
            <button type="button" className={mode === "return" ? "active" : ""} onClick={() => setMode("return")}>Return form</button>
            <button type="button" className={mode === "complete" ? "active" : ""} onClick={() => setMode("complete")}>Complete record</button>
          </div>
          <div className="print-toolbar-actions"><button type="button" onClick={onClose}>Close</button><button type="button" className="print-now-button" onClick={() => window.print()}>Print A4</button></div>
        </div>

        <article className="coac-print-sheet">
          <header className="coac-print-header">
            <div className="coac-print-monogram"><b>COAC</b><span>TOOL CRIB</span></div>
            <div className="coac-print-heading">
              <span>TECHNOLOGICAL UNIVERSITY OF THE PHILIPPINES - VISAYAS</span>
              <strong>COLLEGE OF AUTOMATION AND CONTROL</strong>
              <h1>{typeLabel} Borrowing &amp; Release Form</h1>
            </div>
            <div className="coac-print-programs" aria-label="COAC programs">
              <img src="/course-logos/bsice-logo.png" alt="BSICE" />
              <img src="/course-logos/bsmxe-logo.png" alt="BSMxE" />
              <img src="/course-logos/betmxt-logo.png" alt="BETMxT" />
            </div>
          </header>

          <section className="coac-print-meta">
            <div><span>TRANSACTION NO.</span><strong>{transactionNo}</strong></div>
            <div><span>STATUS</span><strong>{statusLabel}</strong></div>
            <div><span>DATE / TIME BORROWED</span><strong>{borrowedLabel}</strong></div>
          </section>

          <section className="coac-print-block">
            <h2>Borrower Information</h2>
            <div className="coac-print-grid four">
              <label><span>Full Name</span><strong>{primaryLoan.student}</strong></label>
              <label><span>TUPV / Employee ID</span><strong>{primaryLoan.studentId}</strong></label>
              <label><span>Program / Section</span><strong>{primaryLoan.program || "—"}</strong></label>
              <label><span>Borrower Type</span><strong>{borrowerTypeOf(primaryLoan)}</strong></label>
            </div>
          </section>

          <section className="coac-print-block">
            <h2>Items Released · {loans.length} item{loans.length === 1 ? "" : "s"}</h2>
            <div className="coac-print-items-wrap">
              <table className="coac-print-items">
                <thead>
                  <tr><th>#</th><th>Type</th><th>Item / Room</th><th>Asset / Key ID</th><th>Due</th><th>Condition</th></tr>
                </thead>
                <tbody>
                  {loans.map((loan, index) => (
                    <tr key={loan.id}>
                      <td>{index + 1}</td>
                      <td>{kindOf(loan)}</td>
                      <td><strong>{loan.item}</strong>{loan.purpose && <small>Purpose: {loan.purpose}</small>}</td>
                      <td>{assetLabelOf(loan)}</td>
                      <td>{kindOf(loan) === "Room Key" ? "After room use" : loan.due || "—"}</td>
                      <td>Good / Serviceable</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {showRelease && (
            <section className="coac-print-block coac-release-section">
              <h2>Release Confirmation</h2>
              <p className="coac-print-acknowledgement">I acknowledge receipt of all equipment and/or room keys listed in this transaction in the stated condition and accept responsibility for their proper use, safekeeping, and return.</p>
              <div className="coac-signature-grid">
                <div><span className="signature-line" /><strong>{primaryLoan.student}</strong><small>Borrower's Signature</small><em>Date / Time: __________________</em></div>
                <div><span className="signature-line" /><strong>{releasedBy}</strong><small>Releasing Officer</small><em>Released: {borrowedLabel}</em></div>
              </div>
            </section>
          )}

          {showReturn && (
            <section className="coac-print-block coac-return-section">
              <h2>Return &amp; Post-Return Evaluation</h2>
              <div className="coac-print-items-wrap return-items">
                <table className="coac-print-items coac-return-items">
                  <thead><tr><th>#</th><th>Item</th><th>Returned</th><th>Condition</th><th>Remarks / Evaluation</th></tr></thead>
                  <tbody>
                    {loans.map((loan, index) => (
                      <tr key={loan.id}>
                        <td>{index + 1}</td>
                        <td><strong>{loan.item}</strong><small>{assetLabelOf(loan)}</small></td>
                        <td>{loan.status === "Returned" ? loan.returnedAt ?? "Recorded" : "________________"}</td>
                        <td>{loan.status === "Returned" ? loan.returnCondition ?? "Returned" : "________________"}</td>
                        <td>{loan.status === "Returned" ? loan.returnRemarks || "No remarks" : "____________________________"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="coac-signature-grid return">
                <div><span className="signature-line" /><strong>{primaryLoan.student}</strong><small>Borrower's Signature</small></div>
                <div><span className="signature-line" /><strong>{releasedBy}</strong><small>Received / Evaluated By</small></div>
              </div>
            </section>
          )}

          <footer className="coac-print-footer">
            <span>COAC TOOL CRIB · OFFICIAL BORROWING RECORD</span>
            <strong>{transactionNo}</strong>
            <small>One borrowing transaction, one form · {loans.length} recorded item{loans.length === 1 ? "" : "s"}</small>
          </footer>
        </article>
      </section>
    </div>
  );
}

function Stat({
  tone,
  icon,
  value,
  label,
  click,
  foot,
}: {
  tone: string;
  icon: string;
  value: string;
  label: string;
  click: () => void;
  foot?: string;
}) {
  return (
    <button className={`stat ${tone}`} onClick={click}>
      <span className="stat-topline">
        <small>{label}</small>
        <i>↗</i>
      </span>
      <strong>{value}</strong>
      <span className="stat-foot">
        <b className="stat-icon">{icon}</b>
        <em>{foot ?? (tone === "blue" ? "System total" : tone === "green" ? "Ready for use" : tone === "orange" ? "Currently out" : "Needs attention")}</em>
      </span>
    </button>
  );
}

function RoomSummary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "green" | "orange" | "red";
}) {
  return (
    <div className={`room-summary ${tone}`}>
      <span className="room-summary-top">
        <span>{label}</span>
        <i>↗</i>
      </span>
      <strong>{value}</strong>
      <small>{tone === "blue" ? "Room key register" : tone === "green" ? "Ready for release" : tone === "red" ? "Currently released" : "Needs attention"}</small>
    </div>
  );
}

function Status({ value }: { value: string }) {
  const tone = ["Available", "On time", "Returned"].includes(value)
    ? "good"
    : ["Borrowed", "Partially borrowed", "Due today", "Key out", "Pending"].includes(value)
      ? "warn"
      : "bad";
  return (
    <span className={`status ${tone}`}>
      <i />
      {value}
    </span>
  );
}

function ProgramSectionFields({ includeFaculty = false }: { includeFaculty?: boolean }) {
  const [course, setCourse] = useState("");
  const [year, setYear] = useState("");
  const [section, setSection] = useState("");
  const isFaculty = course === "COAC Faculty";
  const sectionOptions = course === "BETMxT" ? ["A", "B"] : ["A"];
  const programValue = isFaculty
    ? "COAC Faculty"
    : course && year && section
      ? `${course} ${year}${section}`
      : "";

  return (
    <section className="full academic-selector">
      <div className="academic-selector-head">
        <span className="academic-selector-icon" aria-hidden="true">🎓</span>
        <div>
          <strong>Academic information</strong>
          <small>Choose each detail separately for a cleaner record.</small>
        </div>
        {programValue && <b>{programValue}</b>}
      </div>
      <div className="academic-selector-grid">
        <label>
          <span>Course</span>
          <select
            required
            value={course}
            onChange={(event) => {
              setCourse(event.target.value);
              setYear("");
              setSection("");
            }}
          >
            <option value="" disabled>Select course</option>
            <option value="BETMxT">BETMxT</option>
            <option value="BSMxE">BSMxE</option>
            <option value="BSICE">BSICE</option>
            {includeFaculty && <option value="COAC Faculty">COAC Faculty / Professor</option>}
          </select>
        </label>
        <label>
          <span>Year level</span>
          <select
            required={!isFaculty}
            disabled={!course || isFaculty}
            value={year}
            onChange={(event) => setYear(event.target.value)}
          >
            <option value="" disabled>Select year</option>
            <option value="1">1st Year</option>
            <option value="2">2nd Year</option>
            <option value="3">3rd Year</option>
            <option value="4">4th Year</option>
          </select>
        </label>
        <label>
          <span>Section</span>
          <select
            required={!isFaculty}
            disabled={!course || isFaculty}
            value={section}
            onChange={(event) => setSection(event.target.value)}
          >
            <option value="" disabled>Select section</option>
            {sectionOptions.map((option) => (
              <option key={option} value={option}>Section {option}</option>
            ))}
          </select>
        </label>
      </div>
      <input type="hidden" name="program" value={programValue} />
    </section>
  );
}

function Table({
  loans,
  onLoanClick,
}: {
  loans: Loan[];
  onLoanClick: (loan: Loan) => void;
}) {
  return (
    <div className="table-scroll dashboard-loan-table-body">
      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th>Type</th>
            <th>Item</th>
            <th>Asset ID</th>
            <th>Due</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {loans.map((loan) => (
            <tr
              className="recent-loan-clickable"
              key={loan.id}
              role="button"
              tabIndex={0}
              aria-label={`Open details for ${loan.item}`}
              onClick={() => onLoanClick(loan)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onLoanClick(loan);
                }
              }}
            >
              <td>
                <strong>{loan.student}</strong>
                <small>{loan.studentId}</small>
              </td>
              <td>
                <span className={`kind-tag ${kindOf(loan) === "Room Key" ? "room" : "tool"}`}>
                  {kindOf(loan)}
                </span>
              </td>
              <td>{loan.item}</td>
              <td className="mono">{assetLabelOf(loan)}</td>
              <td>{loan.due}</td>
              <td>
                <Status value={loan.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {loans.length === 0 && (
        <div className="empty-state dashboard-loan-empty-state">
          <span className="dashboard-empty-icon" aria-hidden="true">▣</span>
          <strong>No borrowed tools</strong>
          <p>Active tool loans will appear here as soon as a tool is released.</p>
        </div>
      )}
    </div>
  );
}

function RoomKeyLoansTable({
  loans,
  onLoanClick,
  onReturn,
}: {
  loans: Loan[];
  onLoanClick: (loan: Loan) => void;
  onReturn: (loan: Loan) => void;
}) {
  return (
    <div className="table-scroll dashboard-loan-table-body">
      <table className="room-key-loans-table">
        <thead>
          <tr>
            <th>Room / Key</th>
            <th>Borrower</th>
            <th>Borrowed</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {loans.map((loan) => (
            <tr
              className="recent-loan-clickable"
              key={loan.id}
              role="button"
              tabIndex={0}
              aria-label={`Open details for ${loan.item}`}
              onClick={() => onLoanClick(loan)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onLoanClick(loan);
                }
              }}
            >
              <td>
                <strong>{loan.item}</strong>
                <small className="mono">{assetLabelOf(loan)}</small>
              </td>
              <td>
                <strong>{loan.student}</strong>
                <small>{borrowerTypeOf(loan)} · {loan.studentId}</small>
              </td>
              <td>
                <strong>{loan.borrowed}</strong>
                <small>{loan.purpose ?? "Room access"}</small>
              </td>
              <td>
                <Status value={loan.status} />
              </td>
              <td>
                <div className="table-inline-actions">
                  <button
                    type="button"
                    className="inline-return-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onReturn(loan);
                    }}
                  >
                    Return key
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {loans.length === 0 && (
        <div className="empty-state dashboard-loan-empty-state room-key-empty-state">
          <span className="dashboard-empty-icon key" aria-hidden="true">⌁</span>
          <strong>No borrowed room keys</strong>
          <p>Borrowed room keys will appear here once a room is released.</p>
        </div>
      )}
    </div>
  );
}

function CloudLoading() {
  return (
    <main className="auth-screen opening-screen">
      <span className="opening-side-brand opening-side-brand-left" aria-hidden="true">POWERED BY LUNTIAN</span>
      <span className="opening-side-brand opening-side-brand-right" aria-hidden="true">POWERED BY LUNTIAN</span>
      <section className="auth-card auth-loading" aria-live="polite">
        <img src="/coac-logo.png" alt="COAC logo" />
        <div className="cloud-spinner" />
        <strong>Opening Tool Crib</strong>
        <p>Connecting to the secure cloud record.</p>
        <div className="opening-luntian-brand">
          <span>Powered by</span>
          <b>Luntian</b>
        </div>
      </section>
    </main>
  );
}

function CloudLogin({
  onSignedIn,
  onBack,
}: {
  onSignedIn: (user: Models.User<Models.Preferences>) => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const signInAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await account.createEmailPasswordSession({ email: email.trim(), password });
      const user = await account.get();
      if (accessRoleOf(user) !== "admin") {
        await account.deleteSession({ sessionId: "current" });
        throw new Error("This account does not have COAC administrator access.");
      }
      onSignedIn(user);
    } catch (submitError) {
      setError(appwriteErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-screen admin-only-login-screen">
      <section className="auth-card admin-only-login-card">
        <div className="auth-brand admin-only-login-brand">
          <img src="/coac-logo.png" alt="COAC logo" />
          <div>
            <span>COLLEGE OF AUTOMATION AND CONTROL</span>
            <h1>Tool Crib</h1>
            <p>Admin access or public borrowing.</p>
          </div>
        </div>

        <div className="auth-tabs admin-entry-tabs" aria-label="Tool Crib access">
          <button type="button" className="active" aria-current="page">Admin Sign In</button>
          <button type="button" className="borrow-entry-button" onClick={onBack}>Borrow</button>
        </div>

        <form className="auth-form admin-only-login-form" onSubmit={signInAdmin}>
          <label>
            <span>Email address</span>
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="developer@example.invalid" required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Administrator password" minLength={8} required />
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="primary auth-submit" disabled={busy}>{busy ? "Signing in..." : "Sign in to Admin Dashboard"}</button>
        </form>
        <p className="auth-note">Only authorized Tool Crib administrators sign in. Students and faculty use <b>Borrow</b> without creating an account.</p>
      </section>
    </main>
  );
}
