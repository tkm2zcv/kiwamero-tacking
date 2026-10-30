export function cronAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === "development";
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : req.headers.get("x-cron-secret");
  return token === secret;
}
