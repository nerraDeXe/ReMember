import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  User,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Layers,
  RefreshCw,
  CheckCircle2,
  Wallet,
  Sparkles,
  X
} from 'lucide-react';
import { api } from '../../api.js';
import { useToast } from '../../context/ToastContext.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useNavigation } from '../../routing.jsx';

export default function MembersListPage() {
  const { showToast } = useToast();
  const [members, setMembers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 8, totalMembers: 0, totalPages: 1 });
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { route, getSnapshot, updateQuery, closeQuery } = useNavigation();
  const query = route.query;
  const requestedPage = Number(query.get('page') || 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  // Filters
  const searchTerm = query.get('search') || '';
  const statusFilter = query.get('status') || 'all';
  const tierFilter = query.get('tier') || 'all';

  // Tier change modal
  const tierMemberId = query.get('memberTier') || '';
  const [memberDetail, setMemberDetail] = useState(null);
  const currentMemberDetail = memberDetail?.route === route ? memberDetail : null;
  const tierChangeMember = currentMemberDetail ? currentMemberDetail.member : members.find(member => member._id === tierMemberId);
  const detailPending = Boolean(tierMemberId) && !currentMemberDetail;
  const closeTierChange = () => closeQuery(['memberTier']);
  const [selectedNewTierId, setSelectedNewTierId] = useState('');
  const tierSelectionRoute = useRef(null);
  const [updatingTier, setUpdatingTier] = useState(false);
  const membersRequest = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const stillOnDirectory = previousRoute => mounted.current && getSnapshot().page === previousRoute.page
    && getSnapshot().query.get('organisation') === previousRoute.query.get('organisation');

  const loadMembers = useCallback(async (requestedPage = page) => {
    const request = ++membersRequest.current;
    setLoading(true);
    try {
      const [membersData, tiersData] = await Promise.all([
        api.getAdminMembers({
          page: requestedPage,
          limit: 8,
          search: searchTerm,
          status: statusFilter,
          tier: tierFilter,
        }),
        api.getTiers(),
      ]);
      if (request !== membersRequest.current) return;

      if (membersData.success) {
        if (membersData.pagination && requestedPage > membersData.pagination.totalPages) {
          updateQuery({ page: membersData.pagination.totalPages <= 1 ? null : String(membersData.pagination.totalPages) }, { replace: true });
          return;
        }
        setMembers(membersData.members || []);
        setPagination(membersData.pagination || { page: 1, limit: 8, totalMembers: 0, totalPages: 1 });
      }
      if (tiersData.success) {
        setTiers(tiersData.tiers || []);
      }
    } catch (err) {
      if (request !== membersRequest.current) return;
      console.error('Failed to load members:', err);
      showToast('Could not load member directory: ' + err.message, 'error');
    } finally {
      if (request === membersRequest.current) setLoading(false);
    }
  }, [page, searchTerm, statusFilter, tierFilter, showToast, updateQuery]);
  const reloadCurrentMembers = useRef(loadMembers);

  useEffect(() => {
    reloadCurrentMembers.current = loadMembers;
    loadMembers();
    return () => { membersRequest.current += 1; };
  }, [loadMembers]);

  useEffect(() => {
    if (!tierMemberId) return;
    let cancelled = false;
    api.getAdminMember(tierMemberId).then(data => {
      if (!data.success || !data.member) throw new Error(data.message || 'This member could not be found.');
      if (!cancelled) setMemberDetail({ route, member: data.member });
    }).catch(error => {
      if (!cancelled) setMemberDetail({ route, member: null, error: error.message });
    });
    return () => { cancelled = true; };
  }, [tierMemberId, route]);

  useEffect(() => {
    // A delayed earlier save can refresh this record after the editor reopens.
    // Keep a target the user has already chosen in this opening.
    if (tierSelectionRoute.current !== route) setSelectedNewTierId(tierChangeMember?.tierId || '');
  }, [route, tierChangeMember?._id, tierChangeMember?.tierId]);

  const handleStatusChange = async (member, newStatus) => {
    const savingRoute = getSnapshot();
    try {
      const response = await api.updateMemberStatus(member._id, newStatus, 'Administrative review');
      if (response.success) {
        showToast(response.message, 'success');
        if (stillOnDirectory(savingRoute)) await reloadCurrentMembers.current();
      }
    } catch (err) {
      showToast(err.message || 'Status update failed.', 'error');
    }
  };

  const handleApplyTierChange = async () => {
    if (!tierChangeMember || !selectedNewTierId) return;
    const savingRoute = getSnapshot();
    setUpdatingTier(true);
    try {
      const response = await api.updateMemberTier(tierChangeMember._id, selectedNewTierId);
      if (response.success) {
        showToast(
          `Tier updated to ${response.member?.tierName}! Google Wallet Object updated automatically via API.`,
          'success'
        );
        if (getSnapshot() === savingRoute) closeTierChange();
        if (stillOnDirectory(savingRoute)) {
          const currentRoute = getSnapshot();
          if (response.member && currentRoute.query.get('memberTier') === response.member._id) {
            setMemberDetail({ route: currentRoute, member: response.member });
          }
          await reloadCurrentMembers.current();
        }
      }
    } catch (err) {
      showToast(err.message || 'Tier update failed.', 'error');
    } finally {
      if (mounted.current) setUpdatingTier(false);
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
            onChange={(e) => updateQuery({ search: e.target.value || null, page: null }, { replace: true })}
            placeholder="Search by name, email, or member number..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => updateQuery({ status: e.target.value === 'all' ? null : e.target.value, page: null })}
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
            onChange={(e) => updateQuery({ tier: e.target.value === 'all' ? null : e.target.value, page: null })}
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
                        <div className="w-9 h-9 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center" role="img" aria-label={member.avatarUrl ? `${member.name} profile photo` : `${member.name || 'User'} profile icon`}>
                          {member.avatarUrl ? <img src={member.avatarUrl} alt={`${member.name} profile`} className="w-full h-full rounded-full object-cover" /> : <User className="w-5 h-5 text-slate-500" aria-hidden="true" />}
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
                          onClick={() => updateQuery({ memberTier: member._id })}
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
              onClick={() => updateQuery({ page: pagination.page <= 2 ? null : String(pagination.page - 1) })}
              disabled={!pagination.hasPrevPage}
              className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-700 shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-slate-900 px-2">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => updateQuery({ page: String(pagination.page + 1) })}
              disabled={!pagination.hasNextPage}
              className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-700 shadow-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tier Change & Automatic Google Wallet Update Modal */}
      {tierMemberId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-brand-muted/35 flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-brand-ink" />
                <h3 className="text-base font-bold text-slate-900">Adjust Membership Tier</h3>
              </div>
              <button
                onClick={closeTierChange}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!tierChangeMember ? (
              <div className="text-xs text-slate-600">
                <p role={detailPending ? 'status' : 'alert'}>{detailPending ? 'Loading member...' : currentMemberDetail?.error || 'This member could not be found in your organisation.'}</p>
                <button onClick={closeTierChange} className="mt-4 font-semibold underline">Return to members</button>
              </div>
            ) : <>
            <div className="text-xs text-slate-600">
              Select new tier for <strong>{tierChangeMember.name}</strong> ({tierChangeMember.membershipNumber}).
            </div>

            <div className="space-y-2">
              {tiers.map((t) => (
                <button
                  key={t._id}
                  onClick={() => { tierSelectionRoute.current = route; setSelectedNewTierId(t._id); }}
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
                onClick={closeTierChange}
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
            </>}
          </div>
        </div>
      )}
    </div>
  );
}
