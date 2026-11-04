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

  const loadMembers = useCallback(async (requestedPage = page, { background = false } = {}) => {
    const request = ++membersRequest.current;
    if (!background) setLoading(true);
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
      if (!background) {
        console.error('Failed to load members:', err);
        showToast('Could not load member directory: ' + err.message, 'error');
      }
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
    const refresh = () => {
      if (document.visibilityState === 'visible') reloadCurrentMembers.current(undefined, { background: true });
    };
    const timer = setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);

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
          `Tier updated to ${response.member?.tierName}.`,
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
    <div className="page-stack">
      {/* Top Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Users className="icon-brand-large" />
            Member Directory & Governance
          </h1>
          <p className="page-description">
            Search members and manage their membership tiers and status.
          </p>
        </div>

        <div className="members-header-actions">
        <button type="button" onClick={() => loadMembers()} disabled={loading} className="surface-rounded row-inline button-small members-refresh">
          <RefreshCw className={`icon-default ${loading ? "animate-spin" : ''}`} aria-hidden="true" />Refresh members
        </button>
        <button
          onClick={handleExportCsv}
          className="surface-rounded row-inline button-small members-invite"
        >
          <Download className="icon-brand" />
          <span>Export Segmented CSV</span>
        </button>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="surface-card members-toolbar">
        {/* Search Input */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => updateQuery({ search: e.target.value || null, page: null }, { replace: true })}
            placeholder="Search by name, email, or member number..."
            className="control control-ring members-search"
          />
          <Search className="icon-default members-search-icon" />
        </div>

        {/* Status Filter */}
        <div className="row-inline">
          <select
            aria-label="Filter members by status"
            value={statusFilter}
            onChange={(e) => updateQuery({ status: e.target.value === 'all' ? null : e.target.value, page: null })}
            className="control-filter control-ring"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
            <option value="revoked">Revoked</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Tier Filter */}
          <select
            value={tierFilter}
            onChange={(e) => updateQuery({ tier: e.target.value === 'all' ? null : e.target.value, page: null })}
            className="control-filter control-ring"
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
      <div className="table-frame">
        {loading ? (
          <div className="loading-container">
            <RefreshCw className="loading-spinner" />
          </div>
        ) : members.length === 0 ? (
          <div className="empty-state">
            <Users className="empty-state-icon" />
            No members matched the search or filter criteria.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table-base">
              <thead className="table-heading">
                <tr>
                  <th className="data-table-cell">Member</th>
                  <th className="data-table-cell">Member ID</th>
                  <th className="data-table-cell">Membership Tier</th>
                  <th className="data-table-cell">Status</th>
                  <th className="data-table-cell">Expiration Date</th>
                  <th className="data-table-cell text-right">Administrative Actions</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {members.map((member) => (
                  <tr key={member._id} className="data-table-row">
                    {/* Member Name & Email */}
                    <td className="data-table-cell">
                      <div className="row-inline-wide">
                        <div className="icon-center member-avatar" role="img" aria-label={member.avatarUrl ? `${member.name} profile photo` : `${member.name || 'User'} profile icon`}>
                          {member.avatarUrl ? <img src={member.avatarUrl} alt={`${member.name} profile`} className="avatar-photo" /> : <User className="icon-medium text-slate-500" aria-hidden="true" />}
                        </div>
                        <div>
                          <div className="member-name">{member.name}</div>
                          <div className="text-note mt-0.5">{member.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Member ID */}
                    <td className="data-table-cell text-identifier">
                      {member.membershipNumber}
                    </td>

                    {/* Tier */}
                    <td className="data-table-cell">
                      <div className="row-inline">
                        <span className="text-strong">{member.tierName}</span>
                        <button
                          onClick={() => updateQuery({ memberTier: member._id })}
                          className="badge-neutral badge-small hover:bg-slate-200 transition-colors"
                          title="Change membership tier"
                        >
                          Change
                        </button>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="data-table-cell">
                      <StatusBadge status={member.status} />
                      {member.status === 'cancelled' && <p className="member-cancellation-access">
                        {member.cancellationScheduled && member.expirationDate ? `Access until ${member.expirationDate.split('T')[0]}` : 'Membership access ended'}
                      </p>}
                      {member.cancelledAt && <p className="member-cancellation-date">Cancelled on {member.cancelledAt.split('T')[0]}</p>}
                    </td>

                    {/* Expiration */}
                    <td className="data-table-cell text-slate-600">
                      {member.expirationDate ? member.expirationDate.split('T')[0] : 'Perpetual'}
                    </td>

                    {/* Status Controls */}
                    <td className="data-table-cell text-right">
                      <div className="row-inline-tight justify-end">
                        {!['active', 'cancelled'].includes(member.status) && (
                          <button
                            onClick={() => handleStatusChange(member, 'active')}
                            className="badge-brand member-tier-action"
                            title="Approve / Activate Membership"
                          >
                            Approve
                          </button>
                        )}

                        {member.status !== 'suspended' && (
                          <button
                            onClick={() => handleStatusChange(member, 'suspended')}
                            className="member-renew-action"
                            title="Suspend Membership Access"
                          >
                            Suspend
                          </button>
                        )}

                        {member.status !== 'revoked' && (
                          <button
                            onClick={() => handleStatusChange(member, 'revoked')}
                            className="member-remove-action"
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
        <div className="row-between members-pagination">
          <div>
            Showing <strong className="text-slate-900">{members.length}</strong> of{' '}
            <strong className="text-slate-900">{pagination.totalMembers}</strong> registered members
          </div>
          <div className="row-inline">
            <button
              onClick={() => updateQuery({ page: pagination.page <= 2 ? null : String(pagination.page - 1) })}
              disabled={!pagination.hasPrevPage}
              className="surface-rounded members-page-button"
            >
              <ChevronLeft className="icon-default" />
            </button>
            <span className="text-strong px-2">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => updateQuery({ page: String(pagination.page + 1) })}
              disabled={!pagination.hasNextPage}
              className="surface-rounded members-page-button"
            >
              <ChevronRight className="icon-default" />
            </button>
          </div>
        </div>
      </div>

      {/* Tier Change Modal */}
      {tierMemberId && (
        <div className="dialog-overlay overflow-y-auto">
          <div className="surface-card member-tier-dialog">
            <div className="row-between admin-dialog-header">
              <div className="row-inline">
                <Layers className="icon-brand-medium" />
                <h3 className="card-title">Adjust Membership Tier</h3>
              </div>
              <button
                onClick={closeTierChange}
                className="admin-dialog-close"
              >
                <X className="icon-medium" />
              </button>
            </div>

            {!tierChangeMember ? (
              <div className="text-detail">
                <p role={detailPending ? 'status' : 'alert'}>{detailPending ? 'Loading member...' : currentMemberDetail?.error || 'This member could not be found in your organisation.'}</p>
                <button onClick={closeTierChange} className="link-underlined mt-4">Return to members</button>
              </div>
            ) : <>
            <div className="text-detail">
              Select new tier for <strong>{tierChangeMember.name}</strong> ({tierChangeMember.membershipNumber}).
            </div>

            <div className="detail-stack">
              {tiers.map((t) => (
                <button
                  key={t._id}
                  onClick={() => { tierSelectionRoute.current = route; setSelectedNewTierId(t._id); }}
                  className={`row-between member-tier-choice ${
                    selectedNewTierId === t._id
                      ? "choice-selected shadow-sm"
                      : "member-tier-idle"
                  }`}
                >
                  <div>
                    <div className="heading-small">{t.name}</div>
                    <div className="member-tier-price">MYR {t.price} / {t.interval}</div>
                  </div>
                  {selectedNewTierId === t._id && (
                    <CheckCircle2 className="icon-brand" />
                  )}
                </button>
              ))}
            </div>

            {/* Requirement Notice */}
            <div className="member-tier-notice">
              <Sparkles className="icon-brand shrink-0 mt-0.5" />
              <span>
                Saving this change updates the tier shown on the member's membership card when they next load it.
              </span>
            </div>

            <div className="member-tier-actions">
              <button
                onClick={closeTierChange}
                className="button-muted-bordered button-small"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyTierChange}
                disabled={updatingTier}
                className="button-primary row-inline member-tier-save"
              >
                {updatingTier ? (
                  <>
                    <RefreshCw className="icon-small-spinner" />
                    <span>Updating tier...</span>
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
