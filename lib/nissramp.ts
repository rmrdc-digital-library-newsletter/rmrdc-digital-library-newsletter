import bundledMockData from "../nissramp_mock_data.json";

export interface NissrampRecord {
  commodity_name?: string;
  hs_code?: string | number;
  primary_locations?: string | string[];
  [key: string]: unknown;
}

export interface NissrampSearchResult {
  record: NissrampRecord;
  score: number;
  matched_fields: string[];
}

export interface NissrampFetchResult {
  source: "live" | "mock";
  records: NissrampRecord[];
  warning?: string;
}

const DEFAULT_BASE_URL = "https://rmrdcstats.ng";
const DEFAULT_ENDPOINT = "/wp-json/rmrdc/v1/materials";
const DEFAULT_TIMEOUT_MS = 10_000;

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeHsCode(value: unknown): string {
  return String(value ?? "").replace(/[^\d]/g, "");
}

export function extractNissrampRecords(payload: unknown): NissrampRecord[] {
  if (Array.isArray(payload)) return payload.filter(isRecord) as NissrampRecord[];
  if (!payload || typeof payload !== "object") return [];

  const objectPayload = payload as Record<string, unknown>;
  const candidates = [
    objectPayload.records,
    objectPayload.results,
    objectPayload.data,
    objectPayload.commodities,
    objectPayload.materials,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord) as NissrampRecord[];
    }
  }

  const nestedData = objectPayload.data;
  if (nestedData && typeof nestedData === "object") {
    const nested = nestedData as Record<string, unknown>;
    for (const key of ["records", "results", "commodities", "materials"]) {
      if (Array.isArray(nested[key])) {
        return nested[key].filter(isRecord) as NissrampRecord[];
      }
    }
  }

  return isRecord(payload) ? [payload as NissrampRecord] : [];
}

function isRecord(value: unknown): value is NissrampRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function readMockNissrampData(): Promise<NissrampRecord[]> {
  // Bundling keeps demo data available in Netlify serverless runtimes where the
  // repository working directory and source JSON file are not guaranteed to exist.
  const payload = bundledMockData as unknown;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const indexed = payload as Record<string, unknown>;
    if (indexed.demonstration_records && typeof indexed.demonstration_records === "object") {
      return Object.entries(indexed.demonstration_records as Record<string, unknown>)
        .filter(([, value]) => isRecord(value))
        .map(([hsCode, value]) => ({
          ...(value as NissrampRecord),
          hs_code: hsCode,
          commodity_name: (value as Record<string, unknown>).commodity as string,
        }));
    }
  }
  return extractNissrampRecords(payload);
}

function buildNissrampUrl(hsCode: string): URL {
  const configuredEndpoint = process.env.NISSRAMP_API_ENDPOINT?.trim();
  const baseUrl = (process.env.NISSRAMP_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");

  if (configuredEndpoint && /^https?:\/\//i.test(configuredEndpoint)) {
    const url = new URL(configuredEndpoint);
    url.searchParams.set("hs_code", hsCode);
    return url;
  }

  const endpoint = configuredEndpoint || DEFAULT_ENDPOINT;
  const url = new URL(`${baseUrl}/${endpoint.replace(/^\/+/, "")}`);
  url.searchParams.set("hs_code", hsCode);
  return url;
}

/**
 * Fetches live NISSRAMP data from its custom WordPress REST endpoint.
 *
 * A missing production token is intentionally not treated as an error because
 * investor demos should continue from the local, version-controlled mock data.
 */
export async function fetchNissrampData(hsCode: string): Promise<NissrampFetchResult> {
  const normalizedHsCode = normalizeHsCode(hsCode);
  if (!normalizedHsCode) {
    throw new TypeError("A valid HS code is required.");
  }

  const token = process.env.NISSRAMP_PRODUCTION_TOKEN?.trim();
  if (!token) {
    try {
      return {
        source: "mock",
        records: await readMockNissrampData(),
        warning: "NISSRAMP production token is not configured; demo data is in use.",
      };
    } catch (error) {
      console.error("NISSRAMP mock fallback could not be read:", error);
      return { source: "mock", records: [], warning: "NISSRAMP demo data is unavailable." };
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const url = buildNissrampUrl(normalizedHsCode);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "RMRDC-CAS/1.0",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`NISSRAMP returned HTTP ${response.status}`);
    }

    const payload: unknown = await response.json();
    const records = extractNissrampRecords(payload);
    if (!records.length) {
      throw new Error("NISSRAMP returned no recognizable commodity records.");
    }

    return { source: "live", records };
  } catch (error) {
    console.error("NISSRAMP live request failed; using mock fallback:", error);
    try {
      return {
        source: "mock",
        records: await readMockNissrampData(),
        warning: "NISSRAMP is unavailable; demo data is in use.",
      };
    } catch (mockError) {
      console.error("NISSRAMP mock fallback could not be read:", mockError);
      return { source: "mock", records: [], warning: "NISSRAMP and demo data are unavailable." };
    }
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Filters and ranks NISSRAMP records by commodity name, normalized HS code,
 * and one or more primary locations.
 */
export function searchNissrampData(
  records: NissrampRecord[],
  query: string,
  hsCode?: string,
): NissrampSearchResult[] {
  if (!Array.isArray(records)) return [];

  const normalizedQuery = normalizeText(query);
  const normalizedHsCode = normalizeHsCode(hsCode);

  return records
    .map((record) => {
      const matchedFields: string[] = [];
      let score = 0;
      const commodity = normalizeText(record.commodity_name);
      const recordHsCode = normalizeHsCode(record.hs_code);
      const locations = Array.isArray(record.primary_locations)
        ? record.primary_locations.map(normalizeText).join(" ")
        : normalizeText(record.primary_locations);

      if (normalizedHsCode && recordHsCode) {
        if (recordHsCode === normalizedHsCode) {
          score += 60;
          matchedFields.push("hs_code");
        } else if (
          recordHsCode.startsWith(normalizedHsCode) ||
          normalizedHsCode.startsWith(recordHsCode)
        ) {
          score += 35;
          matchedFields.push("hs_code");
        }
      }

      if (normalizedQuery && commodity) {
        if (commodity === normalizedQuery) {
          score += 30;
          matchedFields.push("commodity_name");
        } else if (commodity.includes(normalizedQuery) || normalizedQuery.includes(commodity)) {
          score += 18;
          matchedFields.push("commodity_name");
        } else {
          const queryTokens = normalizedQuery.split(" ").filter(Boolean);
          const commodityTokens = commodity.split(" ").filter(Boolean);
          const tokenMatches = queryTokens.filter(token => commodityTokens.includes(token)).length;
          if (tokenMatches) {
            score += Math.min(15, tokenMatches * 5);
            matchedFields.push("commodity_name");
          }
        }
      }

      if (normalizedQuery && locations) {
        const queryTerms = normalizedQuery.split(" ");
        const locationMatches = queryTerms.filter(term => locations.includes(term)).length;
        if (locationMatches) {
          score += Math.min(15, locationMatches * 5);
          matchedFields.push("primary_locations");
        }
      }

      return { record, score, matched_fields: matchedFields };
    })
    .filter(result => result.score > 0 || !normalizedQuery && !normalizedHsCode)
    .sort((a, b) => b.score - a.score);
}
