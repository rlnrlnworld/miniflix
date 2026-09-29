import type { User } from "@supabase/supabase-js";
import { cache } from "react";
import { randomNickname } from "@/lib/nickname";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export async function ensureProfile(user: User) {
  const existing = await prisma.profile.findUnique({ where: { id: user.id } });
  if (existing) return existing;
  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null;
  return prisma.profile.create({
    data: { id: user.id, nickname: randomNickname(), avatarUrl },
  });
}

export const getProfile = cache(async () => {
  const user = await getUser();
  if (!user) return null;
  return ensureProfile(user);
});
