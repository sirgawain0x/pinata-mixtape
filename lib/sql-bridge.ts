import type { InArgs, InStatement, InValue, ResultSet, Row, Transaction } from "@libsql/client";
import { dbReady, getLibsqlClient, getSqliteDatabase, useLibsql } from "./db";

export type ExecResult = { changes: number; lastInsertRowid: number };

function rowToRecord(row: Row, columns: string[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < columns.length; i++) {
    const v = row[i];
    obj[columns[i]!] =
      typeof v === "bigint" && v <= BigInt(Number.MAX_SAFE_INTEGER) && v >= BigInt(Number.MIN_SAFE_INTEGER)
        ? Number(v)
        : v;
  }
  return obj;
}

function firstRow<T extends Record<string, unknown>>(rs: ResultSet): T | undefined {
  if (rs.rows.length === 0) return undefined;
  return rowToRecord(rs.rows[0]!, rs.columns) as T;
}

function allRows<T extends Record<string, unknown>>(rs: ResultSet): T[] {
  return rs.rows.map((row) => rowToRecord(row, rs.columns) as T);
}

function libsqlStmt(sql: string, params?: Record<string, unknown> | unknown[]): InStatement {
  if (params === undefined) return sql;
  if (Array.isArray(params)) return { sql, args: params as InValue[] };
  return { sql, args: params as InArgs };
}

export async function txGet<T extends Record<string, unknown>>(
  tx: Transaction,
  sql: string,
  params?: Record<string, unknown> | unknown[]
): Promise<T | undefined> {
  const rs = await tx.execute(libsqlStmt(sql, params));
  return firstRow<T>(rs);
}

export async function txRun(
  tx: Transaction,
  sql: string,
  params?: Record<string, unknown> | unknown[]
): Promise<ExecResult> {
  const rs = await tx.execute(libsqlStmt(sql, params));
  const rid = rs.lastInsertRowid;
  return {
    changes: rs.rowsAffected,
    lastInsertRowid:
      rid === undefined ? 0 : typeof rid === "bigint" ? (rid <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(rid) : 0) : Number(rid)
  };
}

export async function sqlRun(
  sql: string,
  params?: Record<string, unknown> | unknown[]
): Promise<ExecResult> {
  await dbReady();
  if (useLibsql()) {
    const client = getLibsqlClient();
    const rs = await client.execute(libsqlStmt(sql, params));
    const rid = rs.lastInsertRowid;
    return {
      changes: rs.rowsAffected,
      lastInsertRowid:
        rid === undefined ? 0 : typeof rid === "bigint" ? (rid <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(rid) : 0) : Number(rid)
    };
  }
  const db = getSqliteDatabase();
  const stmt = db.prepare(sql);
  const info = Array.isArray(params) ? stmt.run(...params) : stmt.run(params ?? {});
  return { changes: info.changes, lastInsertRowid: Number(info.lastInsertRowid) };
}

export async function sqlGet<T extends Record<string, unknown>>(
  sql: string,
  params?: Record<string, unknown> | unknown[]
): Promise<T | undefined> {
  await dbReady();
  if (useLibsql()) {
    const rs = await getLibsqlClient().execute(libsqlStmt(sql, params));
    return firstRow<T>(rs);
  }
  const db = getSqliteDatabase();
  const stmt = db.prepare(sql);
  const row = Array.isArray(params) ? stmt.get(...params) : stmt.get(params ?? {});
  return row === undefined ? undefined : (row as T);
}

export async function sqlAll<T extends Record<string, unknown>>(
  sql: string,
  params?: Record<string, unknown> | unknown[]
): Promise<T[]> {
  await dbReady();
  if (useLibsql()) {
    const rs = await getLibsqlClient().execute(libsqlStmt(sql, params));
    return allRows<T>(rs);
  }
  const db = getSqliteDatabase();
  const stmt = db.prepare(sql);
  const rows = Array.isArray(params) ? stmt.all(...params) : stmt.all(params ?? {});
  return rows as T[];
}

/** Interactive write transaction — sqlite uses sync txn; Turso uses client.transaction('write'). */
export async function withWriteTransaction(work: {
  sqlite: () => void;
  libsql: (tx: Transaction) => Promise<void>;
}): Promise<void> {
  await dbReady();
  if (useLibsql()) {
    const client = getLibsqlClient();
    const tx = await client.transaction("write");
    try {
      await work.libsql(tx);
      await tx.commit();
    } finally {
      tx.close();
    }
    return;
  }
  getSqliteDatabase().transaction(work.sqlite)();
}
