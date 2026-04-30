import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import Login from "./pages/Login.tsx";
import Registration from "./pages/Registration";
import RoleSelection from "./pages/RoleSelection.tsx";
import HolderDashboard from "./pages/HolderDashboard.tsx";
import IssuerDashboard from "./pages/issuer/Dashboard.tsx";
import NotFound from "./pages/NotFound.tsx";
import HolderCredentials from "./pages/HolderCredentials";
import HolderProfile from "./pages/HolderProfile";
import HolderRequest from "./pages/HolderRequest";
import HolderUpload from "./pages/HolderUpload";
import HolderNotifications from "./pages/HolderNotifications";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/login" element={<Login />} />
          <Route path="/role-selection" element={<RoleSelection />} />
          <Route path="/registration" element={<Registration />} />
          <Route path="/holder" element={<HolderDashboard />} />
          <Route path="/issuer/dashboard" element={<IssuerDashboard />} />
          <Route path="/holder/credentials" element={<HolderCredentials />} />
          <Route path="/holder/profile" element={<HolderProfile />} />
          <Route path="/holder/request" element={<HolderRequest />} />
          <Route path="/holder/upload" element={<HolderUpload />} />
          <Route path="/holder/notifications" element={<HolderNotifications />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
