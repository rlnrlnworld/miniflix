"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { NICKNAME_MAX, NICKNAME_MIN, randomNickname } from "@/lib/nickname";
import { prisma } from "@/lib/prisma";

export type NicknameState = { error?: string; saved?: boolean } | null;

const schema = z
  .string()
  .trim()
  .min(NICKNAME_MIN, `닉네임은 ${NICKNAME_MIN}자 이상이어야 합니다.`)
  .max(NICKNAME_MAX, `닉네임은 ${NICKNAME_MAX}자 이하여야 합니다.`)
  .regex(
    /^[\p{L}\p{N} _.-]+$/u,
    "한글·영문·숫자·공백·_ . - 만 사용할 수 있습니다.",
  );

export async function updateNickname(
  _prev: NicknameState,
  formData: FormData,
): Promise<NicknameState> {
  const user = await getUser();
  if (!user) return { error: "로그인이 필요합니다." };
  const parsed = schema.safeParse(formData.get("nickname"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await prisma.profile.update({
    where: { id: user.id },
    data: { nickname: parsed.data },
  });
  revalidatePath("/settings");
  return { saved: true };
}

export async function rerollNickname() {
  const user = await getUser();
  if (!user) return;
  await prisma.profile.update({
    where: { id: user.id },
    data: { nickname: randomNickname() },
  });
  revalidatePath("/settings");
}
