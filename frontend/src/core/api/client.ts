export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, { ...init, credentials: "include" });
  if (res.status === 401) throw new Error("Unauthorized");
  return res;
}
