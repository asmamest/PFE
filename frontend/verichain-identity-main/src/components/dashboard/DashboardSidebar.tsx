import { useLocation, useNavigate } from "react-router-dom";
import {
  User,
  FileText,
  Send,
  Upload,
  Bell,
  Shield,
  LogOut,
  ChevronLeft,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { WalletAddress } from "@/components/ui/WalletAddress";
import logo from "@/assets/logo.png";

const menuItems = [
  { title: "Profile", url: "/dashboard", icon: User },
  { title: "My Credentials", url: "/dashboard/credentials", icon: FileText },
  { title: "Request Credential", url: "/dashboard/request", icon: Send },
  { title: "Upload Document", url: "/dashboard/upload", icon: Upload },
  { title: "Notifications", url: "/dashboard/notifications", icon: Bell },
];

interface DashboardSidebarProps {
  walletAddress: string;
}

export function DashboardSidebar({ walletAddress }: DashboardSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Branding */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-sidebar-border">
          <img src={logo} alt="QS·DID" className="h-8 w-8 shrink-0" />
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
              QS<span className="text-sidebar-primary">·</span>DID
            </span>
          )}
        </div>

        {/* Wallet badge */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-sidebar-border">
            <WalletAddress address={walletAddress} className="w-full justify-center text-[10px]" />
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => navigate("/onboarding")}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {!collapsed && <span>Disconnect</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!collapsed && (
          <div className="flex items-center justify-center gap-1.5 px-4 py-3 border-t border-sidebar-border">
            <Shield className="h-3 w-3 text-accent" />
            <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
              Quantum-Secure
            </span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
