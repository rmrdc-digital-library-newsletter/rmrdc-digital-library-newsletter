export const PUBLICATION_EMBEDDING_MODEL = Deno.env.get("EMBEDDING_MODEL") || "sentence-transformers/all-MiniLM-L6-v2";
export const PUBLICATION_EMBEDDING_DIMENSIONS = 384;

function meanPool(rows: number[][]) {
  const dimensions = rows[0]?.length || 0;
  if (!dimensions || rows.some(row => row.length !== dimensions)) {
    throw new Error("Embedding provider returned inconsistent vector dimensions.");
  }
  return Array.from({ length: dimensions }, (_, index) =>
    rows.reduce((sum, row) => sum + row[index], 0) / rows.length
  );
}

function normalizeVectors(output: unknown, inputCount: number): number[][] {
  if (!Array.isArray(output) || output.length === 0) {
    throw new Error("Embedding provider returned an empty response.");
  }

  if (typeof output[0] === "number") {
    return [output as number[]];
  }

  if (Array.isArray(output[0]) && typeof output[0][0] === "number") {
    const rows = output as number[][];
    if (inputCount === 1 && rows.length !== 1 && rows[0].length !== PUBLICATION_EMBEDDING_DIMENSIONS) {
      return [meanPool(rows)];
    }
    if (rows.length !== inputCount) {
      if (inputCount === 1) return [meanPool(rows)];
      throw new Error(`Embedding provider returned ${rows.length} vectors for ${inputCount} inputs.`);
    }
    return rows;
  }

  if (Array.isArray(output[0]) && Array.isArray(output[0][0])) {
    const tokenRows = output as number[][][];
    if (tokenRows.length !== inputCount) {
      throw new Error(`Embedding provider returned ${tokenRows.length} token groups for ${inputCount} inputs.`);
    }
    return tokenRows.map(meanPool);
  }

  throw new Error("Embedding provider returned an unsupported response.");
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const key = Deno.env.get("HUGGINGFACE_API_KEY");
  if (!key) throw new Error("HUGGINGFACE_API_KEY is not configured.");

  const response = await fetch(`https://router.huggingface.co/hf-inference/models/${PUBLICATION_EMBEDDING_MODEL}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: texts }),
    signal: AbortSignal.timeout(45000)
  });
  if (!response.ok) throw new Error(`Embedding provider returned ${response.status}.`);

  const vectors = normalizeVectors(await response.json(), texts.length);
  if (vectors.length !== texts.length) throw new Error(`Expected ${texts.length} embeddings but received ${vectors.length}.`);
  for (const vector of vectors) {
    if (vector.length !== PUBLICATION_EMBEDDING_DIMENSIONS) {
      throw new Error(`Embedding model returned ${vector.length} dimensions; expected ${PUBLICATION_EMBEDDING_DIMENSIONS}.`);
    }
  }
  return vectors;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const [vector] = await generateEmbeddings([text]);
  return vector;
}
