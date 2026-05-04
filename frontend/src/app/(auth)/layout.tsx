import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServerSideUser } from "@/core/auth/server";
import { AuthProvider } from "@/core/auth/AuthProvider";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  const result = await getServerSideUser(token);

  if (result.status === "authenticated") {
    redirect("/workspace");
  }

  return (
    <AuthProvider initialUser={null}>
      {children}
    </AuthProvider>
  );
}
