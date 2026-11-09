import "server-only";

import { randomUUID } from "node:crypto";
import {
  IdentityConflictStatus,
  ServiceCategory,
  SyncStatus,
  TicketStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readMainSheet, SheetsReadError } from "@/lib/google-sheets";

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const MAX_ERROR_DETAILS = 100;
const REQUIRED_HEADERS = [
  [0, "INCIDENT"],
  [3, "REPORTED DATE"],
  [7, "SERVICE TYPE"],
  [10, "STATUS"],
  [64, "RESOLVE DATE"],
  [126, "Nama Teknisi Handle"],
  [142, "NIK Teknisi"],
] as const;

const serviceMappings = {
  ASTINET: ServiceCategory.DATIN,
  INTERNET: ServiceCategory.HSI,
  VOICE: ServiceCategory.HSI,
  LOC_AP: ServiceCategory.WIFI,
  WIFI: ServiceCategory.WIFI,
  SITE: ServiceCategory.SQUAT,
  INTERNET_OLO: ServiceCategory.SQUAT,
  "METRO-E": ServiceCategory.UNCLASSIFIED,
  MM_IPVPN: ServiceCategory.UNCLASSIFIED,
  NON_NUMBERING: ServiceCategory.UNCLASSIFIED,
} satisfies Record<string, ServiceCategory>;

const knownServiceTypes = [
  ...Object.entries(serviceMappings).map(([sourceValue, dashboardCategory]) => ({
    sourceValue,
    dashboardCategory,
  })),
  { sourceValue: "UNCLASSIFIED", dashboardCategory: ServiceCategory.UNCLASSIFIED },
];

type ParsedRow = {
  rowNumber: number;
  incident: string;
  incidentMatchKey: string;
  sourceStatus: string | null;
  status: TicketStatus;
  statusNeedsReview: boolean;
  sourceServiceType: string | null;
  serviceTypeNeedsReview: boolean;
  technicianSourceNikRaw: string | null;
  technicianName: string | null;
  reportedAt: Date;
  resolvedAt: Date | null;
};

type RowFailure = { row: number; code: string };
type ParseResult = { rowsRead: number; rows: ParsedRow[]; failures: RowFailure[] };

function trimUnicodeWhitespace(value: string) {
  return value.replace(/^\p{White_Space}+|\p{White_Space}+$/gu, "");
}

function normalizedIncidentKey(value: string) {
  return trimUnicodeWhitespace(value).normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("en-US");
}

function dateFromParts(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
) {
  if (
    year < 1000 || year > 9999 ||
    month < 1 || month > 12 ||
    day < 1 || hour > 23 || minute > 59 || second > 59 ||
    millisecond < 0 || millisecond > 999
  ) return null;

  const wallClock = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  if (
    wallClock.getUTCFullYear() !== year ||
    wallClock.getUTCMonth() !== month - 1 ||
    wallClock.getUTCDate() !== day
  ) return null;
  return new Date(wallClock.getTime() - JAKARTA_OFFSET_MS);
}

function parseSheetDate(value: unknown): Date | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    const timestamp = Date.UTC(1899, 11, 30) + Math.round(value * 86_400_000);
    if (!Number.isFinite(timestamp)) return null;
    return new Date(timestamp - JAKARTA_OFFSET_MS);
  }
  if (typeof value !== "string") return null;

  const text = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(text);
  if (iso) {
    const [, year, month, day, hour = "0", minute = "0", second = "0", fraction = "0", zone] = iso;
    const milliseconds = Number(fraction.padEnd(3, "0"));
    const localDate = dateFromParts(Number(year), Number(month), Number(day), Number(hour), Number(minute), Number(second), milliseconds);
    if (!localDate) return null;
    if (!zone) return localDate;
    if (zone === "Z") return new Date(localDate.getTime() + JAKARTA_OFFSET_MS);
    const offsetParts = /^([+-])(\d{2}):(\d{2})$/.exec(zone);
    if (!offsetParts) return null;
    const offsetHours = Number(offsetParts[2]);
    const offsetMinutes = Number(offsetParts[3]);
    if (offsetHours > 14 || offsetMinutes > 59) return null;
    const signedOffset =
      (offsetParts[1] === "+" ? 1 : -1) * (offsetHours * 60 + offsetMinutes) * 60_000;
    return new Date(localDate.getTime() + JAKARTA_OFFSET_MS - signedOffset);
  }

  const localized = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
  if (localized) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] = localized;
    return dateFromParts(Number(year), Number(month), Number(day), Number(hour), Number(minute), Number(second));
  }
  return null;
}

function isBlank(value: unknown) {
  return value === undefined || value === null || value === "";
}

function parseRows(values: unknown[][]): ParseResult {
  const header = values[0];
  if (!header) throw new SheetsReadError("SHEETS_HEADER_MISSING");
  for (const [index, expected] of REQUIRED_HEADERS) {
    if (typeof header[index] !== "string" || header[index].trim() !== expected) {
      throw new SheetsReadError("SHEETS_HEADER_INVALID");
    }
  }

  const failures: RowFailure[] = [];
  const parsedRows: ParsedRow[] = [];
  let rowsRead = 0;
  const fail = (row: number, code: string) => failures.push({ row, code });

  for (let index = 1; index < values.length; index += 1) {
    const cells = values[index];
    if (!cells.some((cell) => !isBlank(cell))) continue;
    rowsRead += 1;
    const rowNumber = index + 1;
    const [incidentValue, reportedValue, serviceValue, statusValue, resolvedValue, technicianNameValue, nikValue] = [
      cells[0],
      cells[3],
      cells[7],
      cells[10],
      cells[64],
      cells[126],
      cells[142],
    ];

    if (typeof incidentValue !== "string") {
      fail(rowNumber, "INCIDENT_INVALID");
      continue;
    }
    const incidentMatchKey = trimUnicodeWhitespace(incidentValue);
    if (!incidentMatchKey || incidentValue.length > 128 || incidentMatchKey.length > 128) {
      fail(rowNumber, "INCIDENT_INVALID");
      continue;
    }
    const reportedAt = parseSheetDate(reportedValue);
    if (!reportedAt) {
      fail(rowNumber, "REPORTED_DATE_INVALID");
      continue;
    }
    const sourceServiceType = serviceValue === undefined || serviceValue === null ? null : serviceValue;
    const sourceStatus = statusValue === undefined || statusValue === null ? null : statusValue;
    const technicianName = isBlank(technicianNameValue) ? null : technicianNameValue;
    if (
      (sourceServiceType !== null && (typeof sourceServiceType !== "string" || sourceServiceType.length > 100)) ||
      (sourceStatus !== null && (typeof sourceStatus !== "string" || sourceStatus.length > 191)) ||
      (technicianName !== null && (typeof technicianName !== "string" || technicianName.length > 191))
    ) {
      fail(rowNumber, "TEXT_FIELD_INVALID");
      continue;
    }
    const resolvedAt = isBlank(resolvedValue) || (typeof resolvedValue === "string" && !resolvedValue.trim())
      ? null
      : parseSheetDate(resolvedValue);
    if (resolvedAt === null && !isBlank(resolvedValue) && !(typeof resolvedValue === "string" && !resolvedValue.trim())) {
      fail(rowNumber, "RESOLVE_DATE_INVALID");
      continue;
    }
    if (resolvedAt && resolvedAt < reportedAt) {
      fail(rowNumber, "RESOLVE_DATE_BEFORE_REPORTED_DATE");
      continue;
    }

    let technicianSourceNikRaw: string | null = null;
    if (!isBlank(nikValue) && !(typeof nikValue === "string" && !nikValue.trim())) {
      if (typeof nikValue !== "string" || !/^[0-9]{4,8}$/.test(nikValue)) {
        fail(rowNumber, "TECHNICIAN_NIK_INVALID");
        continue;
      }
      technicianSourceNikRaw = nikValue;
    }

    const serviceKey = typeof sourceServiceType === "string"
      ? trimUnicodeWhitespace(sourceServiceType).toLocaleUpperCase("en-US")
      : "";
    const knownService = Object.hasOwn(serviceMappings, serviceKey);
    parsedRows.push({
      rowNumber,
      incident: incidentValue,
      incidentMatchKey,
      sourceStatus,
      status: typeof sourceStatus === "string" && sourceStatus.trim().toUpperCase() === "CLOSED"
        ? TicketStatus.CLOSED
        : TicketStatus.OPEN,
      statusNeedsReview: sourceStatus === null || !sourceStatus.trim(),
      sourceServiceType,
      serviceTypeNeedsReview: !knownService,
      technicianSourceNikRaw,
      technicianName,
      reportedAt,
      resolvedAt,
    });
  }

  const rowsByKey = new Map<string, ParsedRow[]>();
  for (const row of parsedRows) {
    const key = normalizedIncidentKey(row.incident);
    const group = rowsByKey.get(key) ?? [];
    group.push(row);
    rowsByKey.set(key, group);
  }
  const duplicateRowNumbers = new Set<number>();
  for (const group of rowsByKey.values()) {
    if (group.length > 1) {
      for (const row of group) {
        duplicateRowNumbers.add(row.rowNumber);
        fail(row.rowNumber, "INCIDENT_DUPLICATE_IN_SOURCE");
      }
    }
  }

  return {
    rowsRead,
    rows: parsedRows.filter((row) => !duplicateRowNumbers.has(row.rowNumber)),
    failures,
  };
}

function capFailures(failures: RowFailure[]) {
  return failures.slice(0, MAX_ERROR_DETAILS);
}

function isSameTicketData(
  existing: {
    incidentSourceRaw: string;
    sourceStatus: string | null;
    status: TicketStatus;
    statusNeedsReview: boolean;
    sourceServiceType: string | null;
    serviceTypeNeedsReview: boolean;
    technicianSourceNikRaw: string | null;
    technicianNeedsReview: boolean;
    technicianSourceConflict: boolean;
    reportedAt: Date;
    resolvedAt: Date | null;
  },
  row: ParsedRow,
  technicianNeedsReview: boolean,
  technicianSourceConflict: boolean,
) {
  return existing.incidentSourceRaw === row.incident &&
    existing.sourceStatus === row.sourceStatus &&
    existing.status === row.status &&
    existing.statusNeedsReview === row.statusNeedsReview &&
    existing.sourceServiceType === row.sourceServiceType &&
    existing.serviceTypeNeedsReview === row.serviceTypeNeedsReview &&
    existing.technicianSourceNikRaw === row.technicianSourceNikRaw &&
    existing.technicianNeedsReview === technicianNeedsReview &&
    existing.technicianSourceConflict === technicianSourceConflict &&
    existing.reportedAt.getTime() === row.reportedAt.getTime() &&
    existing.resolvedAt?.getTime() === row.resolvedAt?.getTime();
}

function sanitizedFailureCode(error: unknown) {
  if (error instanceof Error && error.message === "DATABASE_TRANSACTION_FAILED") {
    return "DATABASE_TRANSACTION_FAILED";
  }
  return "SYNC_PROCESSING_FAILED";
}

async function writeSyncFailure(
  syncLogId: string,
  rowsRead: number | null,
  skipped: number,
  failed: number,
  errorCode: string,
  failures: RowFailure[],
) {
  await prisma.syncLog.update({
    where: { id: syncLogId },
    data: {
      status: SyncStatus.FAILED,
      rowsRead,
      skipped,
      failed,
      failureDetails: capFailures(failures) as Prisma.InputJsonValue,
      errorCode,
      errorSummary: errorCode.startsWith("SHEETS_") || errorCode.startsWith("GOOGLE_")
        ? "Pembacaan sumber gagal; data tiket lokal tidak diubah."
        : "Pemrosesan sinkronisasi gagal; transaksi tiket dibatalkan.",
      finishedAt: new Date(),
    },
  });
}

export async function runTicketSync(initiatedByUserId: string) {
  const syncLog = await prisma.syncLog.create({
    data: { runKey: randomUUID(), initiatedByUserId },
    select: { id: true },
  });

  let parsed: ParseResult;
  try {
    parsed = parseRows(await readMainSheet());
  } catch (error) {
    const code = error instanceof SheetsReadError ? error.code : "SHEETS_READ_FAILED";
    await writeSyncFailure(syncLog.id, null, 0, 0, code, []);
    return {
      status: SyncStatus.FAILED,
      rowsRead: null,
      processed: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      skipped: 0,
      failed: 0,
      failureDetails: [],
      errorSummary: "Pembacaan sumber gagal; data tiket lokal tidak diubah.",
    };
  }

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  try {
    await prisma.$transaction(async (tx) => {
      const catalog = new Map<string, number>();
      for (const item of knownServiceTypes) {
        const key = trimUnicodeWhitespace(item.sourceValue);
        let serviceType = await tx.serviceType.findUnique({ where: { sourceValueMatchKey: key } });
        if (!serviceType) {
          serviceType = await tx.serviceType.create({
            data: {
              sourceValue: item.sourceValue,
              sourceValueMatchKey: key,
              dashboardCategory: item.dashboardCategory,
              isActive: true,
            },
          });
        }
        if (
          serviceType.sourceValue !== item.sourceValue ||
          serviceType.sourceValueMatchKey !== key ||
          serviceType.dashboardCategory !== item.dashboardCategory ||
          !serviceType.isActive
        ) {
          throw new Error("SERVICE_CATALOG_CONFLICT");
        }
        catalog.set(item.sourceValue, serviceType.id);
      }
      const fallbackServiceTypeId = catalog.get("UNCLASSIFIED");
      if (!fallbackServiceTypeId) throw new Error("SERVICE_CATALOG_CONFLICT");

      for (const row of parsed.rows) {
        const existing = await tx.ticket.findUnique({
          where: { incidentMatchKey: row.incidentMatchKey },
          select: {
            incident: true,
            incidentSourceRaw: true,
            sourceStatus: true,
            status: true,
            statusNeedsReview: true,
            sourceServiceType: true,
            serviceTypeNeedsReview: true,
            technicianId: true,
            technicianSourceNikRaw: true,
            technicianNeedsReview: true,
            technicianSourceConflict: true,
            reportedAt: true,
            resolvedAt: true,
          },
        });
        const linkedTechnician = existing?.technicianId
          ? await tx.technician.findUnique({
              where: { id: existing.technicianId },
              select: { id: true, sourceNik: true, nik: true, name: true, sourceName: true },
            })
          : null;

        let candidateTechnician = null;
        if (row.technicianSourceNikRaw) {
          candidateTechnician = await tx.technician.findFirst({
            where: {
              OR: [
                { sourceNik: row.technicianSourceNikRaw },
                { nik: row.technicianSourceNikRaw },
              ],
            },
            select: { id: true },
          });
          if (!candidateTechnician) {
            const historicalIdentity = await tx.technicianIdentityHistory.findFirst({
              where: { nik: row.technicianSourceNikRaw },
              orderBy: { recordedAt: "desc" },
              select: { technicianId: true },
            });
            if (historicalIdentity) candidateTechnician = { id: historicalIdentity.technicianId };
          }
        }

        const sourceIdentityMatchesLink = Boolean(
          row.technicianSourceNikRaw &&
          linkedTechnician &&
          linkedTechnician.sourceNik === row.technicianSourceNikRaw,
        );
        const technicianSourceConflict = Boolean(
          linkedTechnician &&
          row.technicianSourceNikRaw &&
          linkedTechnician.sourceNik !== row.technicianSourceNikRaw,
        );
        const technicianNeedsReview = !row.technicianSourceNikRaw || !sourceIdentityMatchesLink;
        const serviceKey = row.sourceServiceType
          ? trimUnicodeWhitespace(row.sourceServiceType).toLocaleUpperCase("en-US")
          : "";
        const serviceTypeId = Object.hasOwn(serviceMappings, serviceKey)
          ? catalog.get(serviceKey) ?? fallbackServiceTypeId
          : fallbackServiceTypeId;
        const ticketData = {
          incident: row.incident,
          incidentMatchKey: row.incidentMatchKey,
          incidentSourceRaw: row.incident,
          sourceStatus: row.sourceStatus,
          status: row.status,
          statusNeedsReview: row.statusNeedsReview,
          sourceServiceType: row.sourceServiceType,
          serviceTypeId,
          serviceTypeNeedsReview: row.serviceTypeNeedsReview,
          technicianSourceNikRaw: row.technicianSourceNikRaw,
          technicianNeedsReview,
          technicianSourceConflict,
          reportedAt: row.reportedAt,
          resolvedAt: row.resolvedAt,
          lastSeenAt: new Date(),
        };

        const savedTicket = await tx.ticket.upsert({
          where: { incidentMatchKey: row.incidentMatchKey },
          create: ticketData,
          update: {
            incidentSourceRaw: row.incident,
            sourceStatus: row.sourceStatus,
            status: row.status,
            statusNeedsReview: row.statusNeedsReview,
            sourceServiceType: row.sourceServiceType,
            serviceTypeId,
            serviceTypeNeedsReview: row.serviceTypeNeedsReview,
            technicianSourceNikRaw: row.technicianSourceNikRaw,
            technicianNeedsReview,
            technicianSourceConflict,
            reportedAt: row.reportedAt,
            resolvedAt: row.resolvedAt,
            lastSeenAt: ticketData.lastSeenAt,
          },
          select: { incident: true },
        });

        if (existing) {
          if (isSameTicketData(existing, row, technicianNeedsReview, technicianSourceConflict)) unchanged += 1;
          else updated += 1;
        } else {
          inserted += 1;
        }

        if (linkedTechnician && sourceIdentityMatchesLink && row.technicianName) {
          const knownNames = [linkedTechnician.name, linkedTechnician.sourceName].filter(
            (name): name is string => name !== null,
          );
          if (knownNames.some((name) => name !== row.technicianName)) {
            await tx.technician.update({
              where: { id: linkedTechnician.id },
              data: { nameNeedsReview: true },
            });
          }
        }

        if (row.technicianSourceNikRaw && technicianNeedsReview) {
          await tx.technicianIdentityConflict.create({
            data: {
              ticketIncident: savedTicket.incident,
              suspectedTechnicianId: technicianSourceConflict
                ? linkedTechnician?.id ?? candidateTechnician?.id ?? null
                : candidateTechnician?.id ?? null,
              sourceNik: row.technicianSourceNikRaw,
              detectedBySyncLogId: syncLog.id,
              status: IdentityConflictStatus.PENDING,
            },
          });
        }
      }

      const skipped = parsed.failures.length;
      const processed = parsed.rows.length;
      const failed = 0;
      const status = skipped ? SyncStatus.PARTIAL : SyncStatus.SUCCEEDED;
      await tx.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status,
          rowsRead: parsed.rowsRead,
          inserted,
          updated,
          unchanged,
          skipped,
          failed,
          failureDetails: capFailures(parsed.failures) as Prisma.InputJsonValue,
          errorCode: null,
          errorSummary: parsed.failures.length
            ? "Sebagian baris dilewati karena validasi data."
            : null,
          finishedAt: new Date(),
        },
      });

      if (inserted + updated + unchanged !== processed) {
        throw new Error("SYNC_COUNT_MISMATCH");
      }
    }, { timeout: 120_000 });
  } catch (error) {
    const failed = parsed.rows.length;
    const errorCode = sanitizedFailureCode(error);
    const failureDetails = failed ? [{ row: 0, code: errorCode }] : [];
    await writeSyncFailure(
      syncLog.id,
      parsed.rowsRead,
      parsed.failures.length,
      failed,
      errorCode,
      [...parsed.failures, ...failureDetails],
    );
    return {
      status: SyncStatus.FAILED,
      rowsRead: parsed.rowsRead,
      processed: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      skipped: parsed.failures.length,
      failed,
      failureDetails: capFailures([...parsed.failures, ...failureDetails]),
      errorSummary: "Pemrosesan sinkronisasi gagal; transaksi tiket dibatalkan.",
    };
  }

  const processed = inserted + updated + unchanged;
  return {
    status: parsed.failures.length ? SyncStatus.PARTIAL : SyncStatus.SUCCEEDED,
    rowsRead: parsed.rowsRead,
    processed,
    inserted,
    updated,
    unchanged,
    skipped: parsed.failures.length,
    failed: 0,
    failureDetails: capFailures(parsed.failures),
    errorSummary: parsed.failures.length ? "Sebagian baris dilewati karena validasi data." : null,
  };
}
