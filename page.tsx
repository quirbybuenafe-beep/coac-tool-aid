"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Models } from "appwrite";
import { account, appwriteConfig, ID, Query, tables } from "../lib/appwrite";

type View = "Dashboard" | "Inventory" | "Rooms & Keys" | "Borrowers" | "Transactions";
type ItemStatus = "Available" | "Borrowed" | "Maintenance";
type LoanStatus = "On time" | "Due today" | "Overdue" | "Key out" | "Returned";
type LoanKind = "Tool" | "Room Key";
type BorrowerType = "Student" | "Professor";
type ModalMode = "tool" | "room";
type ManageModalMode = "addTool" | "addRoom";
type DeleteTarget = { kind: "tool" | "room"; id: string; label: string };
type ToolUnitSelection = { assetId: string; unitNumber: number };
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
  due: string;
  returnedAt?: string;
  status: LoanStatus;
  kind?: LoanKind;
  purpose?: string;
  unitNumber?: number;
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
  { id: "KEY-COAC-101", room: "COAC 101", use: "Automation Laboratory", storage: "Tool Aid Key Board", status: "Available" },
  { id: "KEY-COAC-102", room: "COAC 102", use: "Mechatronics Laboratory", storage: "Tool Aid Key Board", status: "Available" },
  { id: "KEY-COAC-103", room: "COAC 103", use: "Robotics Laboratory", storage: "Tool Aid Key Board", status: "Available" },
  { id: "KEY-COAC-104", room: "COAC 104", use: "Electronics Laboratory", storage: "Tool Aid Key Board", status: "Available" },
  { id: "KEY-COAC-105", room: "COAC 105", use: "Control Systems Laboratory", storage: "Tool Aid Key Board", status: "Available" },
  { id: "KEY-COAC-FAB", room: "Fabrication Room", use: "Machining and Fabrication", storage: "Tool Aid Key Board", status: "Available" },
];

const loansSeed: Loan[] = [
  { id: 1, student: "Miguel Santos", studentId: "TUPV-23-0412", program: "BSEMT 3A", item: "Vernier Caliper 1", assetId: "TL-VC-0123", unitNumber: 1, borrowed: "May 12, 2025, 9:15 AM", due: "May 19, 2025", status: "On time", kind: "Tool" },
  { id: 2, student: "Aisha Reyes", studentId: "TUPV-23-0188", program: "BET-MXT 3A", item: "Digital Multimeter 1", assetId: "TL-DMM-0047", unitNumber: 1, borrowed: "May 10, 2025, 10:30 AM", due: "May 17, 2025", status: "Due today", kind: "Tool" },
  { id: 3, student: "Kenneth Lim", studentId: "TUPV-22-0304", program: "BSEMT 4A", item: "Soldering Station 1", assetId: "TL-SS-0012", unitNumber: 1, borrowed: "May 6, 2025, 1:45 PM", due: "May 13, 2025", status: "Overdue", kind: "Tool" },
  { id: 4, student: "Clara Delgado", studentId: "TUPV-24-0267", program: "BET-MXT 2A", item: "Arduino Kit 1", assetId: "TL-AK-0231", unitNumber: 1, borrowed: "May 9, 2025, 2:10 PM", due: "May 16, 2025", status: "On time", kind: "Tool" },
  { id: 5, student: "Jose Cruz", studentId: "TUPV-23-0076", program: "BSEMT 3B", item: "Cordless Drill 1", assetId: "TL-CD-0088", unitNumber: 1, borrowed: "May 11, 2025, 3:25 PM", due: "May 18, 2025", status: "On time", kind: "Tool" },
];

const toolCategories: ToolCategory[] = [
  "All Tools",
  "Electrical Tools",
  "Measuring Tools",
  "Electronics Equipment",
  "Power Tools",
  "Kits & Modules",
];

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
const TRANSACTION_ERASE_PASSWORD = "coac123";

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

export default function Home() {
  const [view, setView] = useState<View>("Dashboard");
  const [query, setQuery] = useState("");
  const [toolCategory, setToolCategory] = useState<ToolCategory>("All Tools");
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
  const [toast, setToast] = useState("");
  const [ready, setReady] = useState(false);
  const [eraseModalOpen, setEraseModalOpen] = useState(false);
  const [erasePassword, setErasePassword] = useState("");
  const [eraseError, setEraseError] = useState("");
  const [manageModal, setManageModal] = useState<ManageModalMode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteInventoryOpen, setDeleteInventoryOpen] = useState(false);
  const [selectedToolDetails, setSelectedToolDetails] = useState<Tool | null>(null);
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<string | null>(null);
  const [cloudUser, setCloudUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("checking");
  const [cloudHydrated, setCloudHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    account
      .get()
      .then((user) => {
        if (!cancelled) setCloudUser(user);
      })
      .catch(() => {
        if (!cancelled) setCloudStatus("offline");
      });
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
    if (!cloudUser || !cloudHydrated) return;
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
  }, [tools, roomKeys, loans, cloudUser, cloudHydrated]);

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

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  const active = loans.filter((loan) => loan.status !== "Returned");
  const activeToolLoans = active.filter((loan) => kindOf(loan) === "Tool");
  const activeRoomLoans = active.filter((loan) => kindOf(loan) === "Room Key");
  const toolQuantity = (tool: Tool) => Math.max(1, tool.quantity ?? 1);
  const activeUnitNumbers = (toolId: string) =>
    new Set(
      activeToolLoans
        .filter((loan) => loan.assetId === toolId)
        .map((loan) => unitNumberOf(loan)),
    );
  const availableUnitNumbers = (tool: Tool) => {
    if (tool.status === "Maintenance") return [];
    const occupied = activeUnitNumbers(tool.id);
    return Array.from({ length: toolQuantity(tool) }, (_, index) => index + 1).filter(
      (unitNumber) => !occupied.has(unitNumber),
    );
  };
  const toolLiveStatus = (tool: Tool) => {
    if (tool.status === "Maintenance") return "Maintenance";
    const availableCount = availableUnitNumbers(tool).length;
    if (availableCount === 0) return "Borrowed";
    if (availableCount < toolQuantity(tool)) return "Partially borrowed";
    return "Available";
  };
  const detailedTool = selectedToolDetails
    ? tools.find((tool) => tool.id === selectedToolDetails.id) ?? selectedToolDetails
    : null;
  const detailedToolLoan = detailedTool
    ? activeToolLoans.find((loan) => loan.assetId === detailedTool.id)
    : undefined;
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

  const q = query.toLowerCase();
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
      const key = `${loan.studentId}::${loan.student}`;
      const group = groups.get(key) ?? [];
      group.push(loan);
      groups.set(key, group);
      return groups;
    }, new Map<string, Loan[]>()),
  ).map(([key, groupLoans]) => ({ key, loans: groupLoans, borrower: groupLoans[0] }));

  const visibleStudents = students.filter((student) =>
    match([student.student, student.studentId, student.program]),
  );

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
        ? `${tool.name} ${firstAvailableUnit} - ${tool.id}-${firstAvailableUnit}`
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
    const student = String(form.get("student"));
    const studentId = String(form.get("studentId"));
    const program = String(form.get("program"));
    const transactionId = Date.now();
    const newLoans: Loan[] = validSelections.map((selection, index) => {
      const tool = tools.find((entry) => entry.id === selection.assetId)!;
      return {
        id: transactionId + index,
        student,
        studentId,
        program,
        borrowerType: "Student",
        item: `${tool.name} ${selection.unitNumber}`,
        assetId: tool.id,
        unitNumber: selection.unitNumber,
        borrowed: fmtDateTime(borrowedAt),
        borrowedAtIso: borrowedAt.toISOString(),
        due: fmt(due),
        status: "On time",
        kind: "Tool",
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

    const loan: Loan = {
      id: Date.now(),
      student: String(form.get("student")),
      studentId: String(form.get("studentId")),
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

  const returned = (loan: Loan) => {
    const returnedAt = fmtDateTime(new Date());

    setLoans((current) =>
      current.map((entry) =>
        entry.id === loan.id ? { ...entry, status: "Returned", returnedAt } : entry,
      ),
    );

    if (kindOf(loan) === "Room Key") {
      setRoomKeys((current) =>
        current.map((entry) =>
          entry.id === loan.assetId ? { ...entry, status: "Available" } : entry,
        ),
      );
    } else {
      setTools((current) =>
        current.map((entry) =>
          entry.id === loan.assetId ? { ...entry, status: "Available" } : entry,
        ),
      );
    }

    setToast(`${loan.item} returned at ${returnedAt}.`);
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
        tool.id === detailedTool.id ? { ...tool, quantity } : tool,
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
  const totalToolUnitCount = tools.reduce((sum, tool) => sum + toolQuantity(tool), 0);
  const availableToolCount = tools.reduce(
    (sum, tool) => sum + availableUnitNumbers(tool).length,
    0,
  );
  const maintenanceToolCount = tools
    .filter((tool) => tool.status === "Maintenance")
    .reduce((sum, tool) => sum + toolQuantity(tool), 0);
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

  if (cloudStatus === "checking") {
    return <CloudLoading />;
  }

  if (!cloudUser) {
    return <CloudLogin onSignedIn={handleSignedIn} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setView("Dashboard")}>
          <img src="/coac-logo.png" alt="COAC logo" />
          <span>
            <strong>COAC Tool Aid</strong>
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
          <button className="cloud-account" onClick={() => void signOut()} title="Sign out">
            <span className="avatar">
              {(cloudUser.name || cloudUser.email).slice(0, 2).toUpperCase()}
            </span>
            <span>
              <strong>{cloudUser.name || "Tool Aid"}</strong>
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
                <div className="dashboard-zone-title">
                  <span className="dashboard-zone-icon tool-icon" aria-hidden="true">🧰</span>
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
                    setQuery("Maintenance");
                  }}
                />
              </div>

              <div className="dash-grid dashboard-borrow-layout">
                <div className="dashboard-borrow-panels">
                  <section className="panel">
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

                  <section className="panel borrowed-room-keys-panel">
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
                      onReturn={(loan) => returned(loan)}
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
                          onClick={() => setView("Rooms & Keys")}
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
                <section className="panel dashboard-quick-actions">
                  <div className="panel-head">
                    <div>
                      <strong>Quick actions</strong>
                      <small>Start common Tool Aid tasks</small>
                    </div>
                  </div>
                  <div className="quick-action-grid">
                    <button type="button" onClick={() => openBorrowing("tool")}>
                      <span className="quick-action-icon blue" aria-hidden="true">+</span>
                      <span><strong>New tool loan</strong><small>Register a borrower</small></span>
                    </button>
                    <button type="button" onClick={() => openBorrowing("room")}>
                      <span className="quick-action-icon purple" aria-hidden="true">🔑</span>
                      <span><strong>Borrow room</strong><small>Release a room key</small></span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setView("Transactions");
                        setQuery("");
                      }}
                    >
                      <span className="quick-action-icon green" aria-hidden="true">↩</span>
                      <span><strong>Process return</strong><small>Complete an active loan</small></span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setView("Borrowers");
                        setQuery("");
                      }}
                    >
                      <span className="quick-action-icon orange" aria-hidden="true">⌕</span>
                      <span><strong>Find borrower</strong><small>Open borrower records</small></span>
                    </button>
                  </div>
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
                    <button onClick={() => { setView("Inventory"); setQuery("Maintenance"); }}>
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
            <section className="panel page-panel">
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
                      <span>{category}</span>
                      <b>{count}</b>
                    </button>
                  );
                })}
              </div>
              <div className="table-scroll">
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
                            {Array.from(
                              { length: toolQuantity(tool) },
                              (_, index) => `${tool.name} ${index + 1}`,
                            ).join(" · ")}
                          </small>
                        </td>
                        <td>
                          <div className="unit-count-cell">
                            <span className="piece-count">{toolQuantity(tool)}</span>
                            <small>{availableUnitNumbers(tool).length} ready</small>
                          </div>
                        </td>
                        <td>{tool.category}</td>
                        <td>{tool.location}</td>
                        <td>
                          <Status value={toolLiveStatus(tool)} />
                        </td>
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
                    <button
                      onClick={() => {
                        setToolCategory("All Tools");
                        setQuery("");
                      }}
                    >
                      Show all tools
                    </button>
                  </div>
                )}
              </div>
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
                        className={`room-box ${roomState}`}
                        id={`room-${room.id}`}
                        key={room.id}
                      >
                        <div className="room-box-status">
                          <span className="room-status-dot" />
                          <strong>
                            {roomState === "vacant"
                              ? "VACANT"
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
                            <span className="room-key-icon" aria-hidden="true">🔑</span>
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
                            <p>The room key is on the Tool Aid key board.</p>
                            {lastReturn?.returnedAt && (
                              <p>Last returned: <b>{lastReturn.returnedAt}</b></p>
                            )}
                          </div>
                        ) : (
                          <div className="room-maintenance-message">
                            <strong>Temporarily unavailable</strong>
                            <p>This room or its assigned key is under maintenance.</p>
                          </div>
                        )}

                        <footer className="room-box-actions">
                          {roomState === "vacant" ? (
                            <button className="room-borrow-button" onClick={() => openBorrowing("room", room.id)}>
                              Borrow room &amp; key
                            </button>
                          ) : currentLoan ? (
                            <button className="room-return-button" onClick={() => returned(currentLoan)}>
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
                  <button
                    type="button"
                    className="room-mini-borrow"
                    onClick={() => openBorrowing("room")}
                  >
                    + Borrow room &amp; key
                  </button>
                </aside>
              </div>
            </>
          )}

          {view === "Borrowers" && (
            <section className="borrower-directory panel">
              <div className="borrower-directory-toolbar">
                <div>
                  <strong>Borrower directory</strong>
                  <small>
                    {visibleStudents.length} borrower{visibleStudents.length === 1 ? "" : "s"} shown
                  </small>
                </div>
                <span className="summary">List view</span>
              </div>
              <div className="borrower-list-head">
                <span>Student</span>
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
                        <div className="borrower-cell">
                          <small>Program / Section</small>
                          <strong>{student.program}</strong>
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
                              <button className="small return" onClick={() => returned(loan)}>
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
                    <p>Clear the search to show all registered students.</p>
                    <button onClick={() => setQuery("")}>Show all borrowers</button>
                  </div>
                )}
              </div>
            </section>
          )}

          {view === "Transactions" && (
            <section className="panel page-panel">
              <div className="panel-head">
                <div>
                  <strong>Borrowing transactions</strong>
                  <small>{transactionGroups.length} borrower{transactionGroups.length === 1 ? "" : "s"} · {visibleLoans.length} item records</small>
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
                    const activeCount = group.loans.filter((loan) => loan.status !== "Returned").length;
                    const initials = group.borrower.student
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2);

                    return (
                      <tbody className={`transaction-group ${isOpen ? "open" : ""}`} key={group.key}>
                        <tr className="transaction-group-row">
                          <td colSpan={8}>
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
                              {loan.status === "Returned"
                                ? loan.returnedAt ?? "Time not recorded"
                                : "Not returned yet"}
                            </td>
                            <td>
                              {loan.status !== "Returned" ? (
                                <button
                                  className="small return"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    returned(loan);
                                  }}
                                >
                                  {kindOf(loan) === "Room Key" ? "Return key" : "Mark returned"}
                                </button>
                              ) : (
                                <span className="muted">Completed</span>
                              )}
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
                  <input name="student" required placeholder="Juan Dela Cruz" />
                </label>
                <label>
                  <span>Student ID</span>
                  <input name="studentId" required placeholder="TUPV-00-0000" />
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
                <p>Each selected unit gets its own tracked transaction under the same borrower.</p>
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
                  <input name="studentId" required placeholder="Student or employee ID" />
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
                  <strong>{detailedTool.quantity ?? 1}</strong>
                  <span>{(detailedTool.quantity ?? 1) === 1 ? "piece" : "pieces"}</span>
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
                    <span>{availableUnitNumbers(detailedTool).length} available</span>
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
                  {Array.from({ length: toolQuantity(detailedTool) }, (_, index) => {
                    const unitNumber = index + 1;
                    const unitLoan = activeToolLoans.find(
                      (loan) =>
                        loan.assetId === detailedTool.id &&
                        unitNumberOf(loan) === unitNumber,
                    );
                    const unitState =
                      detailedTool.status === "Maintenance"
                        ? "maintenance"
                        : unitLoan
                          ? "borrowed"
                          : "available";

                    return (
                      <article className={`item-unit-row ${unitState}`} key={unitNumber}>
                        <span className="item-unit-number">{unitNumber}</span>
                        <div className="item-unit-identity">
                          <strong>{detailedTool.name} {unitNumber}</strong>
                          <small className="mono">{detailedTool.id}-{unitNumber}</small>
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
                          {unitLoan && <small>{unitLoan.student} · due {unitLoan.due}</small>}
                        </div>
                        {unitState === "available" && (
                          <button
                            type="button"
                            className="small"
                            onClick={() => {
                              setSelectedToolDetails(null);
                              openBorrowing("tool", detailedTool.id, unitNumber);
                            }}
                          >
                            Borrow this unit
                          </button>
                        )}
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
                    <input name="storage" required defaultValue="Tool Aid Key Board" autoComplete="off" />
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

      {toast && (
        <div className="toast">
          <b>✓</b>
          {toast}
        </div>
      )}
    </div>
  );
}

function Stat({
  tone,
  icon,
  value,
  label,
  click,
}: {
  tone: string;
  icon: string;
  value: string;
  label: string;
  click: () => void;
}) {
  return (
    <button className={`stat ${tone}`} onClick={click}>
      <span className="stat-icon">{icon}</span>
      <span>
        <strong>{value}</strong>
        <small>{label}</small>
      </span>
      <i>↗</i>
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
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Status({ value }: { value: string }) {
  const tone = ["Available", "On time", "Returned"].includes(value)
    ? "good"
    : ["Borrowed", "Partially borrowed", "Due today", "Key out"].includes(value)
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
    <div className="table-scroll">
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
    <div className="table-scroll">
      {loans.length > 0 ? (
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
      ) : (
        <div className="empty-state room-key-empty-state">
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
        <strong>Opening COAC Tool Aid</strong>
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
}: {
  onSignedIn: (user: Models.User<Models.Preferences>) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "register") {
        await account.create({
          userId: ID.unique(),
          email: email.trim(),
          password,
          name: name.trim() || "COAC Tool Aid",
        });
      }
      await account.createEmailPasswordSession({ email: email.trim(), password });
      onSignedIn(await account.get());
    } catch (submitError) {
      setError(appwriteErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-brand">
          <img src="/coac-logo.png" alt="COAC logo" />
          <div>
            <span>COAC LABORATORY MANAGEMENT</span>
            <h1>COAC Tool Aid</h1>
            <p>Online inventory, room keys, borrowers, and transaction records.</p>
          </div>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="Account access">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => {
              setMode("register");
              setError("");
            }}
          >
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && (
            <label>
              <span>Administrator name</span>
              <input
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="COAC Tool Aid administrator"
                required
              />
            </label>
          )}
          <label>
            <span>Email address</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@tup.edu.ph"
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="primary auth-submit" disabled={busy}>
            {busy ? "Please wait..." : mode === "login" ? "Sign in to dashboard" : "Create account & continue"}
          </button>
        </form>

        <p className="auth-note">
          Your records are saved in the COAC Tool Aid cloud database and remain available on other devices.
        </p>
      </section>
    </main>
  );
}
