import {
  IconBuildingStore,
  IconHelp,
  IconHome,
  IconListDetails,
  IconPlugConnected,
  IconSettings,
  IconShieldCheck,
  IconShoppingCart,
  IconTicket,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import type React from "react";
import { useLocation, useNavigate } from "react-router-dom";

import Logo from "@/assets/logo.svg";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNavigate = (path: string) => {
    navigate(path);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const navMain = [
    {
      title: "Home",
      icon: IconHome,
      isActive: pathname === "/dashboard",
      onClick: () => handleNavigate("/dashboard"),
    },
    {
      title: "Content Management",
      icon: IconBuildingStore,
      isActive:
        pathname === "/legal-documents" ||
        pathname === "/products" ||
        pathname === "/categories" ||
        pathname === "/images" ||
        pathname === "/vendors",
      onClick: () => handleNavigate("/products"),
      children: [
        {
          title: "Legal Documents",
          isActive: pathname.startsWith("/legal-documents"),
          onClick: () => handleNavigate("/legal-documents"),
        },
        {
          title: "Categories",
          isActive: pathname.startsWith("/categories"),
          onClick: () => handleNavigate("/categories"),
        },
        {
          title: "Images",
          isActive: pathname.startsWith("/images"),
          onClick: () => handleNavigate("/images"),
        },
        {
          title: "Vendors",
          isActive: pathname.startsWith("/vendors"),
          onClick: () => handleNavigate("/vendors"),
        },
        {
          title: "Products",
          isActive: pathname.startsWith("/products") || pathname === "/cms",
          onClick: () => handleNavigate("/products"),
        },
      ],
    },
    {
      title: "Orders",
      icon: IconShoppingCart,
      isActive: pathname.startsWith("/orders"),
      onClick: () => handleNavigate("/orders"),
    },
    {
      title: "Promo Codes",
      icon: IconTicket,
      isActive: pathname.startsWith("/promotion-codes"),
      onClick: () => handleNavigate("/promotion-codes"),
    },
    {
      title: "Customers",
      icon: IconUsers,
      isActive: pathname.startsWith("/customers"),
      onClick: () => handleNavigate("/customers"),
      children: [
        {
          title: "All Customers",
          isActive: pathname === "/customers",
          onClick: () => handleNavigate("/customers"),
        },
        {
          title: "Reviews",
          isActive: pathname.startsWith("/customers/reviews"),
          onClick: () => handleNavigate("/customers/reviews"),
        },
        {
          title: "Contact Submissions",
          isActive: pathname.startsWith("/customers/contact-submissions"),
          onClick: () => handleNavigate("/customers/contact-submissions"),
        },
      ],
    },
  ];
  const navAccount = [
    {
      title: "Webhooks",
      icon: IconPlugConnected,
      isActive: pathname.startsWith("/webhooks"),
      onClick: () => handleNavigate("/webhooks"),
    },
    {
      title: "Admin Action Logs",
      icon: IconListDetails,
      isActive: pathname.startsWith("/admin-action-logs"),
      onClick: () => handleNavigate("/admin-action-logs"),
    },
    {
      title: "Grant Admin",
      icon: IconShieldCheck,
      isActive: pathname.startsWith("/admins"),
      onClick: () => handleNavigate("/admins"),
    },
    {
      title: "Profile",
      icon: IconUser,
      isActive: pathname.startsWith("/profile"),
      onClick: () => handleNavigate("/profile"),
    },
  ];
  const navSecondary = [
    { title: "Settings", icon: IconSettings, disabled: true },
    { title: "Get Help", icon: IconHelp, disabled: true },
  ];

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              onClick={() => handleNavigate("/")}
            >
              <img src={Logo} alt="Acme Logo" className="h-8" />
              <span className="text-base font-semibold">Acme</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={navAccount} />
        <NavSecondary items={navSecondary} />
      </SidebarContent>
    </Sidebar>
  );
}
