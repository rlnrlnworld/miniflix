import Image from "next/image";
import Link from "next/link";
import logo from "../../../public/brand/logo.svg";
import mark from "../../../public/brand/mark.svg";

type Props = {
  variant?: "full" | "mark";
  height?: number;
  href?: string | null;
  className?: string;
  priority?: boolean;
};

export function Logo({
  variant = "full",
  height = 24,
  href = "/",
  className = "",
  priority,
}: Props) {
  const src = variant === "full" ? logo : mark;
  const width = Math.round((src.width / src.height) * height);
  const img = (
    <Image
      src={src}
      alt="miniflix"
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
  if (!href) return img;
  return (
    <Link
      href={href}
      aria-label="miniflix 홈"
      className="inline-flex shrink-0 items-center"
    >
      {img}
    </Link>
  );
}
