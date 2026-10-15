import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  Shield,
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Wallet,
  Sparkles,
  X
} from 'lucide-react';
import { api } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';

export default function MembersListPage() {
  const { showToast } = useToast();
  const [members, setMembers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 8, totalMembers: 0, totalPages: 1 });
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');

  // Tier change modal
  const [tierChangeMember, setTierChangeMember] = useState(null);
  const [selectedNewTierId, setSelectedNewTierId] = useState('');
  const [updatingTier, setUpdatingTier] = useState(false);

  // Status reason modal
  const [statusChangeTarget, setStatusChangeTarget] = useState(null);
  const [statusReason, setStatusReason] = useState('');

  const loadMembers = async (page = 1) => {
    setLoading(true);
    try {
      const [membersData, tiersData] = await Promise.all([
        api.getAdminMembers({
          page,
          limit: 8,
          search: searchTerm,
          status: statusFilter,
          tier: tierFilter,
        }),
        api.getTiers(),
      ]);

      if (membersData.success) {
        setMembers(membersData.members || []);
        setPagination(membersData.pagination || { page: 1, limit: 8, totalMembers: 0, totalPages: 1 });
      }
      if (tiersData.success) {
        setTiers(tiersData.tiers || []);
      }
    } catch (err) {
      console.error('Failed to load members:', err);
      showToast('Could not load member directory: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers(1);
  }, [searchTerm, statusFilter, tierFilter]);

  const handleStatusChange = async (member, newStatus) => {
    try {
      const response = await api.updateMemberStatus(member._id, newStatus, 'Administrative review');
      if (response.success) {
        showToast(response.message, 'success');
        await loadMembers(pagination.page);
      }
    } catch (err) {
      showToast(err.message || 'Status update failed.', 'error');
    }
  };

  const handleApplyTierChange = async () => {
    if (!tierChangeMember || !selectedNewTierId) return;
    setUpdatingTier(true);
    try {
      const response = await api.updateMemberTier(tierChangeMember._id, selectedNewTierId);
      if (response.success) {
        showToast(
          `Tier updated to ${response.member?.tierName}! Google Wallet Object updated automatically via API.`,
          'success'
        );
        setTierChangeMember(null);
        await loadMembers(pagination.page);
      }
    } catch (err) {
      showToast(err.message || 'Tier update failed.', 'error');
    } finally {
      setUpdatingTier(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      showToast('Preparing segmented CSV download from backend...', 'info');
      const blob = await api.exportMembersCsv({
        status: statusFilter,
        tier: tierFilter,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `remember_members_export_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('CSV export downloaded successfully!', 'success');
    } catch (err) {
      showToast('CSV export failed: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-ink" />
            Member Directory & Governance
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Dynamic paginated member list retrieved from backend API with Google Wallet sync triggers.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="py-2 px-4 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-2 transition-colors self-start sm:self-auto shadow-sm"
        >
          <Download className="w-4 h-4 text-brand-ink" />
          <span>Export Segmented CSV</span>
        </button>
      </div>

      {/* Search & Filters Bar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, or member number..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
            <option value="revoked">Revoked</option>
          </select>

          {/* Tier Filter */}
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
          >
            <option value="all">All Tiers</option>
            {tiers.map((t) => (
              <option key={t._id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 flex justify-center">
            <RefreshCw className="w-8 h-8 text-brand-ink animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <Users className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            No members matched the search or filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4">Member</th>
                  <th className="p-4">Member ID</th>
                  <th className="p-4">Membership Tier</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Expiration Date</th>
                  <th className="p-4">Google Wallet</th>
                  <th className="p-4 text-right">Administrative Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((member) => (
                  <tr key={member._id} className="hover:bg-slate-50/75 transition-colors">
                    {/* Member Name & Email */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full border border-slate-200 bg-slate-50" aria-label={member.avatarUrl ? `${member.name} profile photo` : 'No profile photo'}>
                          {member.avatarUrl && <img src={member.avatarUrl} alt={`${member.name} profile`} className="w-full h-full rounded-full object-cover" />}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 leading-tight">{member.name}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{member.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Member ID */}
                    <td className="p-4 font-mono font-bold text-brand-ink">
                      {member.membershipNumber}
                    </td>

                    {/* Tier */}
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{member.tierName}</span>
                        <button
                          onClick={() => {
                            setTierChangeMember(member);
                            setSelectedNewTierId(member.tierId);
                          }}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-[10px] transition-colors"
                          title="Change membership tier (auto-updates Google Wallet)"
                        >
                          Change
                        </button>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-4">
                      <StatusBadge status={member.status} />
                    </td>

                    {/* Expiration */}
                    <td className="p-4 text-slate-600">
                      {member.expirationDate ? member.expirationDate.split('T')[0] : 'Perpetual'}
                    </td>

                    {/* Google Wallet Sync */}
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 text-[11px] text-brand-ink bg-brand-50 px-2 py-0.5 rounded border border-brand-primary/30">
                        <Wallet className="w-3 h-3" />
                        <span>Synced</span>
                      </span>
                    </td>

                    {/* Status Controls */}
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {member.status !== 'active' && (
                          <button
                            onClick={() => handleStatusChange(member, 'active')}
                            className="px-2 py-1 rounded bg-brand-50 hover:bg-brand-100 border border-brand-primary/30 text-brand-ink text-[10px] font-semibold transition-colors"
                            title="Approve / Activate Membership"
                          >
                            Approve
                          </button>
                        )}

                        {member.status !== 'suspended' && (
                          <button
                            onClick={() => handleStatusChange(member, 'suspended')}
                            className="px-2 py-1 rounded bg-brand-50 hover:bg-brand-100 border border-brand-accent/50 text-brand-ink text-[10px] font-semibold transition-colors"
                            title="Suspend Membership Access"
                          >
                            Suspend
                          </button>
                        )}

                        {member.status !== 'revoked' && (
                          <button
                            onClick={() => handleStatusChange(member, 'revoked')}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-brand-silver text-brand-ink text-[10px] font-semibold transition-colors"
                            title="Revoke Membership"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <div>
            Showing <strong className="text-slate-900">{members.length}</strong> of{' '}
            <strong className="text-slate-900">{pagination.totalMembers}</strong> registered members
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadMembers(pagination.page - 1)}
              disabled={!pagination.hasPrevPage}
              className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-700 shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-slate-900 px-2">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => loadMembers(pagination.page + 1)}
              disabled={!pagination.hasNextPage}
              className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-700 shadow-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tier Change & Automatic Google Wallet Update Modal */}
      {tierChangeMember && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-brand-muted/35 flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-brand-ink" />
                <h3 className="text-base font-bold text-slate-900">Adjust Membership Tier</h3>
              </div>
              <button
                onClick={() => setTierChangeMember(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600">
              Select new tier for <strong>{tierChangeMember.name}</strong> ({tierChangeMember.membershipNumber}).
            </div>

            <div className="space-y-2">
              {tiers.map((t) => (
                <button
                  key={t._id}
                  onClick={() => setSelectedNewTierId(t._id)}
                  className={`w-full p-3 rounded-lg border text-left transition-all flex items-center justify-between ${
                    selectedNewTierId === t._id
                      ? 'bg-brand-50 border-brand-primary shadow-sm'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">{t.name}</div>
                    <div className="text-[11px] text-brand-ink font-semibold">${t.price} / {t.interval}</div>
                  </div>
                  {selectedNewTierId === t._id && (
                    <CheckCircle2 className="w-4 h-4 text-brand-ink" />
                  )}
                </button>
              ))}
            </div>

            {/* Requirement Notice */}
            <div className="p-3 rounded-lg bg-brand-50 border border-brand-accent/50 text-[11px] text-slate-700 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-brand-ink shrink-0 mt-0.5" />
              <span>
                <strong>Automatic Wallet Sync:</strong> Saving this change will automatically trigger a Google Wallet REST API call to update the member's pass object.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setTierChangeMember(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyTierChange}
                disabled={updatingTier}
                className="px-5 py-2 rounded-lg bg-brand-primary hover:bg-brand-secondary text-brand-ink text-xs font-bold flex items-center gap-2 transition-colors shadow-sm active:scale-[0.99]"
              >
                {updatingTier ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Syncing Google Wallet...</span>
                  </>
                ) : (
                  <span>Update & Sync Pass</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
