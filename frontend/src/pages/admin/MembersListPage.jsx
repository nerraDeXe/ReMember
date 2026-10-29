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
    <div className="page-stack">
      {/* Top Header */}
      <div className="members-list-header">
        <div>
          <h1 className="page-title">
            <Users className="members-list-users-icon" />
            Member Directory & Governance
          </h1>
          <p className="page-description">
            Dynamic paginated member list retrieved from backend API with Google Wallet sync triggers.
          </p>
        </div>

        <div className="members-list-header-actions">
        <button type="button" onClick={() => loadMembers()} disabled={loading} className="members-list-refresh-button">
          <RefreshCw className={`icon-default ${loading ? "members-list-spinner" : ''}`} aria-hidden="true" />Refresh members
        </button>
        <button
          onClick={handleExportCsv}
          className="members-list-export-button"
        >
          <Download className="members-list-download-icon" />
          <span>Export Segmented CSV</span>
        </button>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="members-list-filter-bar">
        {/* Search Input */}
        <div className="members-list-search-field">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => updateQuery({ search: e.target.value || null, page: null }, { replace: true })}
            placeholder="Search by name, email, or member number..."
            className="members-list-search-input"
          />
          <Search className="members-list-search-icon" />
        </div>

        {/* Status Filter */}
        <div className="members-list-inline-controls">
          <select
            aria-label="Filter members by status"
            value={statusFilter}
            onChange={(e) => updateQuery({ status: e.target.value === 'all' ? null : e.target.value, page: null })}
            className="members-list-filter-select"
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
            className="members-list-filter-select"
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
          <div className="members-list-empty">
            <Users className="members-list-empty-icon" />
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
                  <th className="data-table-cell">Google Wallet</th>
                  <th className="members-list-actions-cell">Administrative Actions</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {members.map((member) => (
                  <tr key={member._id} className="data-table-row">
                    {/* Member Name & Email */}
                    <td className="data-table-cell">
                      <div className="members-list-member-identity">
                        <div className="members-list-avatar" role="img" aria-label={member.avatarUrl ? `${member.name} profile photo` : `${member.name || 'User'} profile icon`}>
                          {member.avatarUrl ? <img src={member.avatarUrl} alt={`${member.name} profile`} className="members-list-avatar-image" /> : <User className="members-list-avatar-placeholder" aria-hidden="true" />}
                        </div>
                        <div>
                          <div className="members-list-member-name">{member.name}</div>
                          <div className="members-list-member-email">{member.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Member ID */}
                    <td className="members-list-number-cell">
                      {member.membershipNumber}
                    </td>

                    {/* Tier */}
                    <td className="data-table-cell">
                      <div className="members-list-inline-controls">
                        <span className="members-list-current-tier">{member.tierName}</span>
                        <button
                          onClick={() => updateQuery({ memberTier: member._id })}
                          className="members-list-change-tier-button"
                          title="Change membership tier (auto-updates Google Wallet)"
                        >
                          Change
                        </button>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="data-table-cell">
                      <StatusBadge status={member.status} />
                      {member.status === 'cancelled' && <p className="members-list-cancellation-notice">
                        {member.cancellationScheduled && member.expirationDate ? `Access until ${member.expirationDate.split('T')[0]}` : 'Membership access ended'}
                      </p>}
                      {member.cancelledAt && <p className="members-list-cancellation-date">Cancelled on {member.cancelledAt.split('T')[0]}</p>}
                    </td>

                    {/* Expiration */}
                    <td className="members-list-expiry-cell">
                      {member.expirationDate ? member.expirationDate.split('T')[0] : 'Perpetual'}
                    </td>

                    {/* Google Wallet Sync */}
                    <td className="data-table-cell">
                      <span className="members-list-wallet-badge">
                        <Wallet className="icon-tiny" />
                        <span>Synced</span>
                      </span>
                    </td>

                    {/* Status Controls */}
                    <td className="members-list-actions-cell">
                      <div className="members-list-member-actions">
                        {!['active', 'cancelled'].includes(member.status) && (
                          <button
                            onClick={() => handleStatusChange(member, 'active')}
                            className="members-list-approve-button"
                            title="Approve / Activate Membership"
                          >
                            Approve
                          </button>
                        )}

                        {member.status !== 'suspended' && (
                          <button
                            onClick={() => handleStatusChange(member, 'suspended')}
                            className="members-list-suspend-button"
                            title="Suspend Membership Access"
                          >
                            Suspend
                          </button>
                        )}

                        {member.status !== 'revoked' && (
                          <button
                            onClick={() => handleStatusChange(member, 'revoked')}
                            className="members-list-revoke-button"
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
        <div className="members-list-pagination">
          <div>
            Showing <strong className="members-list-result-count">{members.length}</strong> of{' '}
            <strong className="members-list-result-count">{pagination.totalMembers}</strong> registered members
          </div>
          <div className="members-list-inline-controls">
            <button
              onClick={() => updateQuery({ page: pagination.page <= 2 ? null : String(pagination.page - 1) })}
              disabled={!pagination.hasPrevPage}
              className="members-list-page-button"
            >
              <ChevronLeft className="icon-default" />
            </button>
            <span className="members-list-page-indicator">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => updateQuery({ page: String(pagination.page + 1) })}
              disabled={!pagination.hasNextPage}
              className="members-list-page-button"
            >
              <ChevronRight className="icon-default" />
            </button>
          </div>
        </div>
      </div>

      {/* Tier Change & Automatic Google Wallet Update Modal */}
      {tierMemberId && (
        <div className="members-list-tier-overlay">
          <div className="members-list-tier-dialog">
            <div className="members-list-tier-dialog-header">
              <div className="members-list-inline-controls">
                <Layers className="members-list-layers-icon" />
                <h3 className="card-title">Adjust Membership Tier</h3>
              </div>
              <button
                onClick={closeTierChange}
                className="members-list-tier-close-button"
              >
                <X className="icon-medium" />
              </button>
            </div>

            {!tierChangeMember ? (
              <div className="members-list-tier-dialog-description">
                <p role={detailPending ? 'status' : 'alert'}>{detailPending ? 'Loading member...' : currentMemberDetail?.error || 'This member could not be found in your organisation.'}</p>
                <button onClick={closeTierChange} className="members-list-return-button">Return to members</button>
              </div>
            ) : <>
            <div className="members-list-tier-dialog-description">
              Select new tier for <strong>{tierChangeMember.name}</strong> ({tierChangeMember.membershipNumber}).
            </div>

            <div className="detail-stack">
              {tiers.map((t) => (
                <button
                  key={t._id}
                  onClick={() => { tierSelectionRoute.current = route; setSelectedNewTierId(t._id); }}
                  className={`members-list-tier-option ${
                    selectedNewTierId === t._id
                      ? "members-list-tier-option-selected"
                      : "members-list-tier-option-idle"
                  }`}
                >
                  <div>
                    <div className="members-list-tier-option-name">{t.name}</div>
                    <div className="members-list-tier-option-price">MYR {t.price} / {t.interval}</div>
                  </div>
                  {selectedNewTierId === t._id && (
                    <CheckCircle2 className="members-list-download-icon" />
                  )}
                </button>
              ))}
            </div>

            {/* Requirement Notice */}
            <div className="members-list-wallet-sync-notice">
              <Sparkles className="members-list-sparkles-icon" />
              <span>
                <strong>Automatic Wallet Sync:</strong> Saving this change will automatically trigger a Google Wallet REST API call to update the member's pass object.
              </span>
            </div>

            <div className="members-list-tier-dialog-actions">
              <button
                onClick={closeTierChange}
                className="members-list-tier-cancel-button"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyTierChange}
                disabled={updatingTier}
                className="members-list-tier-save-button"
              >
                {updatingTier ? (
                  <>
                    <RefreshCw className="members-list-tier-save-spinner" />
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
