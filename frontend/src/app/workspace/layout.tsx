import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServerSideUser } from "@/core/auth/server";
import { AuthProvider } from "@/core/auth/AuthProvider";
import { WorkspaceContent } from "./workspace-content";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  const result = await getServerSideUser(token);

  if (result.status !== "authenticated") {
    redirect("/login");
  }

  return (
    <AuthProvider initialUser={result.user}>
      <WorkspaceContent>{children}</WorkspaceContent>
    </AuthProvider>
  );
}
