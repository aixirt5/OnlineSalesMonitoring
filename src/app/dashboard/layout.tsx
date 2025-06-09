import { DashboardContent } from "@/components/DashboardContent";
import { SidebarProvider } from "@/context/SidebarContext";
export { metadata } from "./metadata";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <DashboardContent>{children}</DashboardContent>
    </SidebarProvider>
  );
}
