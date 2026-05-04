// src/layouts/HolderLayout.tsx
import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { SidebarProvider } from "@/components/ui/sidebar";
import { HolderSidebar } from "@/components/holder/HolderSidebar";
import { HolderTopbar } from "@/components/holder/HolderTopbar";
import { USER_REGISTRY_ADDRESS } from "@/lib/blockchain/constants";
import userRegistryAbi from "@/lib/blockchain/UserRegistryAbi.json";
import { fetchFromIPFS } from "@/lib/ipfs/ipfsClient";

interface Identity {
  did: string;
  walletAddress: string;
  fullName: string;
  createdAt: number;
  publicKey?: string;
}

export function HolderLayout() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadIdentity = async () => {
      try {
        if (!window.ethereum) throw new Error("MetaMask not installed");
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        let addr = accounts?.[0];
        if (!addr) {
          const newAccounts = await window.ethereum.request({ method: "eth_requestAccounts" });
          addr = newAccounts?.[0];
        }
        if (!addr) throw new Error("No wallet");

        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(USER_REGISTRY_ADDRESS, userRegistryAbi, provider);
        const user = await contract.getUser(addr);

        if (!user || !user.active) throw new Error("No active holder");

        const profile = await fetchFromIPFS(user.metadataCID);
        const fullName = profile.fullName || profile.name || "Holder";
        const did = `did:zk:${addr}`;
        const createdAt = Number(user.registeredAt) * 1000;

        setIdentity({
          did,
          walletAddress: addr,
          fullName,
          createdAt,
          publicKey: profile.publicKeyMultibase || "",
        });
      } catch (err) {
        console.error(err);
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };
    loadIdentity();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!identity) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <HolderSidebar did={identity.did} />
        <main className="flex-1 min-w-0 px-4 md:px-8 py-6">
          <HolderTopbar name={identity.fullName} />
          <Outlet context={{ identity }} />
        </main>
      </div>
    </SidebarProvider>
  );
}