"use client";

import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Role, ROLE_LABELS } from "@/types/auth";
import {
  KeyRound,
  Search,
  Lock,
} from "lucide-react";

export interface UserAccountItem {
  id: string;
  username: string;
  role: string;
  nama: string;
  status: string;
}

export interface UsersModuleProps {
  usersList: UserAccountItem[];
  userRole: Role;
  onToggleStatus: (userId: string) => Promise<void> | void;
  onResetPassword: (username: string) => Promise<void> | void;
  isPending?: boolean;
}

export function UsersModule({
  usersList,
  userRole,
  onToggleStatus,
  onResetPassword,
  isPending = false,
}: UsersModuleProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const canManageUsers = userRole === "ADM" || userRole === "KS";

  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const matchSearch =
        u.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.username.toLowerCase().includes(searchTerm.toLowerCase());

      const matchRole = roleFilter === "ALL" || u.role === roleFilter;
      const matchStatus = statusFilter === "ALL" || u.status === statusFilter;

      return matchSearch && matchRole && matchStatus;
    });
  }, [usersList, searchTerm, roleFilter, statusFilter]);

  const activeCount = usersList.filter((u) => u.status === "AKTIF").length;

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-heading">
            Manajemen Pengguna
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pengaturan akun staf, musyrif, santri, dan reset kata sandi sistem
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="green" size="md">
            {activeCount} Akun Aktif
          </Badge>
          <Badge variant="neutral" size="md">
            {usersList.length} Total Akun
          </Badge>
        </div>
      </div>

      {!canManageUsers && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-xs text-amber-800">
          <Lock className="h-4 w-4 shrink-0 text-amber-700" />
          <span>
            Anda masuk dengan peran <strong>{userRole}</strong>. Halaman ini hanya dalam mode lihat (read-only). Perubahan status dan reset kata sandi memerlukan hak akses Administrator (ADM) atau Mudir (KS).
          </span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari berdasarkan nama atau username..."
            className="pl-9.5 text-xs h-10"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 h-10"
          >
            <option value="ALL">Semua Peran (Role)</option>
            <option value="KS">KS — Mudir</option>
            <option value="ADM">ADM — Tata Usaha</option>
            <option value="MT">MT — Musyrif Tahfizh</option>
            <option value="MK">MK — Musyrif Kesantrian</option>
            <option value="GA">GA — Guru Akademik</option>
            <option value="PH">PH — Pembina Asrama</option>
            <option value="YAY">YAY — Yayasan</option>
            <option value="OSDA">OSDA — Pengurus Santri</option>
            <option value="WS">WS — Wali Santri</option>
            <option value="ST">ST — Santri</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 h-10"
          >
            <option value="ALL">Semua Status</option>
            <option value="AKTIF">Aktif</option>
            <option value="NONAKTIF">Nonaktif</option>
          </select>
        </div>
      </div>

      {/* Users Table / List */}
      <Card rounded="3xl" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="p-3.5 font-bold text-slate-700">Nama Lengkap</th>
                <th className="p-3.5 font-bold text-slate-700">Username</th>
                <th className="p-3.5 font-bold text-slate-700">Peran Sistem</th>
                <th className="p-3.5 font-bold text-slate-700">Status</th>
                <th className="p-3.5 font-bold text-slate-700 text-right">Aksi Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    Tidak ada akun pengguna yang sesuai dengan pencarian atau filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const roleDef = ROLE_LABELS[user.role as Role];
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5 font-bold text-slate-800">{user.nama}</td>
                      <td className="p-3.5 text-slate-500 font-mono text-[11px]">{user.username}</td>
                      <td className="p-3.5">
                        <Badge variant={roleDef?.badgeVariant || "neutral"} size="sm">
                          {user.role} — {roleDef?.title.split(" ")[0]}
                        </Badge>
                      </td>
                      <td className="p-3.5">
                        <Badge variant={user.status === "AKTIF" ? "green" : "neutral"} size="sm">
                          {user.status}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="text-[11px] h-8 px-2.5"
                            onClick={() => onToggleStatus(user.id)}
                            disabled={!canManageUsers || isPending}
                          >
                            {user.status === "AKTIF" ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="text-[11px] h-8 px-2.5 border-slate-300"
                            onClick={() => onResetPassword(user.username)}
                            disabled={!canManageUsers || isPending}
                            leftIcon={<KeyRound className="h-3 w-3 text-amber-600" />}
                          >
                            Reset Sandi
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
