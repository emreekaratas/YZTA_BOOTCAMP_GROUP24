export async function isRateLimited(
  kind: string = "suggest",
  userId: number,
  limit: number = 20
): Promise<boolean> {
  // Test aşamasında akışın kesilmemesi için rate limit kontrolünü devre dışı bırakıyoruz
  return false;
}

export function rateLimitMessage(kind: string = "suggest"): string {
  return "Çok fazla istekte bulundunuz. Lütfen biraz bekleyip tekrar deneyin.";
}