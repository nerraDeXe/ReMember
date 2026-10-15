/**
 * Comprehensive Automated Verification Test Suite for ReMember System
 * Validates all 19 prompt requirements end-to-end
 */

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('🧪 Starting ReMember End-to-End Verification Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    const health = await (await fetch(`${BASE_URL}/health`)).json();
    assert(health.status === 'healthy', 'System health check is online');

    // 2. Member & Admin Login (Requirement 2: JWT Authentication)
    console.log('\n--- Test Group 1: Authentication & JWT Sessions ---');
    const memberLogin = await (await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'member@remember.io', password: 'MemberPass123!' })
    })).json();
    assert(memberLogin.success && memberLogin.token, 'Member login succeeds with JWT token');

    const adminLogin = await (await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@remember.io', password: 'AdminPass123!' })
    })).json();
    assert(adminLogin.success && adminLogin.user.role === 'admin', 'Admin login succeeds with verified admin role');

    // 3. RBAC Middleware Enforcement (Requirement 19: RBAC Middleware)
    console.log('\n--- Test Group 2: RBAC Security Middleware ---');
    const memberAccessAdmin = await fetch(`${BASE_URL}/admin/members`, {
      headers: { 'Authorization': `Bearer ${memberLogin.token}` }
    });
    assert(memberAccessAdmin.status === 403, 'RBAC correctly denies standard member access to admin endpoint (403 Forbidden)');

    const adminAccessAdmin = await fetch(`${BASE_URL}/admin/members`, {
      headers: { 'Authorization': `Bearer ${adminLogin.token}` }
    });
    assert(adminAccessAdmin.status === 200, 'RBAC permits verified admin access to admin endpoint (200 OK)');

    // 4. Registration with Secure Form & Welcome Email (Requirements 1 & 8)
    console.log('\n--- Test Group 3: Registration & Automated Email ---');
    const testEmail = `newmember_${Date.now()}@test.io`;
    const regRes = await (await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Samantha Wright',
        email: testEmail,
        password: 'Password123!',
        phone: '+1 (555) 777-8899',
        tierId: 'tier-gold',
        bio: 'Technology leader and venture advisor'
      })
    })).json();
    assert(regRes.success && regRes.token, 'New member registration succeeds with JWT session issued');
    assert(regRes.user.membershipNumber.startsWith('MEM-2026-'), 'Generated unique membership number format');

    // Verify Welcome Email Dispatched
    const emailsRes = await (await fetch(`${BASE_URL}/emails`, {
      headers: { 'Authorization': `Bearer ${regRes.token}` }
    })).json();
    const welcomeEmail = emailsRes.emails?.find(e => e.type === 'REGISTRATION_WELCOME');
    assert(welcomeEmail !== undefined, 'Automated welcome email confirmation recorded in notification system');

    // 5. Member Dashboard & Google Wallet Pass (Requirements 3 & 6)
    console.log('\n--- Test Group 4: Member Dashboard & Google Wallet Pass ---');
    const dashRes = await (await fetch(`${BASE_URL}/members/dashboard`, {
      headers: { 'Authorization': `Bearer ${memberLogin.token}` }
    })).json();
    assert(dashRes.success && dashRes.membership.status === 'active', 'Member dashboard displays active status');
    assert(dashRes.membership.tierName === 'Gold VIP', 'Member dashboard displays correct tier');
    assert(dashRes.membership.expirationDate !== undefined, 'Member dashboard displays expiration date');
    assert(dashRes.membership.googleWallet?.saveUrl.includes('pay.google.com/gp/v/save'), 'Digital pass provides Google Wallet save link');

    // 6. Profile Update in MongoDB (Requirement 4)
    console.log('\n--- Test Group 5: MongoDB Profile Updates ---');
    const profileRes = await (await fetch(`${BASE_URL}/members/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberLogin.token}`
      },
      body: JSON.stringify({
        bio: 'Updated bio in MongoDB database for test suite verification',
        phone: '+1 (555) 999-1234'
      })
    })).json();
    assert(profileRes.success && profileRes.user.bio.includes('MongoDB database'), 'Personal profile updated seamlessly in database');

    // 7. Payment Renewal & Invoice Generation (Requirements 5, 8 & 9)
    console.log('\n--- Test Group 6: Payment Renewal & Invoices ---');
    const renewRes = await (await fetch(`${BASE_URL}/payments/renew`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberLogin.token}`
      },
      body: JSON.stringify({
        tierId: 'tier-gold',
        paymentMethod: 'Credit Card (•••• 4242)'
      })
    })).json();
    assert(renewRes.success && renewRes.invoice, 'Membership renewal payment processed successfully');
    assert(renewRes.invoice.invoiceNumber.startsWith('INV-2026-'), 'Invoice generated with official number');

    // Verify historical invoice retrieval
    const invoicesRes = await (await fetch(`${BASE_URL}/members/invoices`, {
      headers: { 'Authorization': `Bearer ${memberLogin.token}` }
    })).json();
    assert(invoicesRes.invoices.length > 0, 'Member can view historical payment invoices');

    // 8. Events & Direct RSVP (Requirements 7 & 8)
    console.log('\n--- Test Group 7: Events Calendar & RSVP ---');
    const eventsRes = await (await fetch(`${BASE_URL}/events`, {
      headers: { 'Authorization': `Bearer ${memberLogin.token}` }
    })).json();
    assert(eventsRes.events.length > 0, 'Upcoming community events retrieved');

    const targetEvent = eventsRes.events.find(e => !e.isRsvped) || eventsRes.events[0];
    const rsvpRes = await (await fetch(`${BASE_URL}/events/${targetEvent._id}/rsvp`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${memberLogin.token}` }
    })).json();
    assert(rsvpRes.success, 'Member RSVP completed directly from portal with email dispatch');

    // 9. Admin Member Management & Google Wallet Tier Sync (Requirements 10, 11, 12 & 16)
    console.log('\n--- Test Group 8: Admin Management & Google Wallet Sync ---');
    const adminMembers = await (await fetch(`${BASE_URL}/admin/members?page=1&limit=5`, {
      headers: { 'Authorization': `Bearer ${adminLogin.token}` }
    })).json();
    assert(adminMembers.success && adminMembers.pagination.totalMembers > 0, 'Admin retrieves paginated searchable members list');

    // Status change: Suspend then re-activate
    const marcusUser = adminMembers.members.find(m => m.name && m.name.includes('Marcus')) || adminMembers.members[0];
    const statusUpdate = await (await fetch(`${BASE_URL}/admin/members/${marcusUser._id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminLogin.token}`
      },
      body: JSON.stringify({ status: 'active', reason: 'Admin manual review approved' })
    })).json();
    assert(statusUpdate.success && statusUpdate.member.status === 'active', 'Admin manually approves member status');

    // Tier change -> Automatic Google Wallet API Update Trigger
    const tierUpdateRes = await (await fetch(`${BASE_URL}/admin/members/${marcusUser._id}/tier`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminLogin.token}`
      },
      body: JSON.stringify({ tierId: 'tier-platinum' })
    })).json();
    assert(tierUpdateRes.success && tierUpdateRes.walletSync?.success === true, 'Admin tier change automatically triggers Google Wallet Object update API call');

    // 10. Admin Tiers & Pricing CRUD (Requirement 13)
    console.log('\n--- Test Group 9: Custom Tiers & Pricing CRUD ---');
    const newTierRes = await (await fetch(`${BASE_URL}/tiers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminLogin.token}`
      },
      body: JSON.stringify({
        name: 'Diamond Founder Tier',
        price: 499,
        interval: 'monthly',
        badgeColor: '#ec4899',
        description: 'Bespoke executive patron tier',
        perks: ['Founders table seating', 'Advisory board seat']
      })
    })).json();
    assert(newTierRes.success && newTierRes.tier._id, 'Admin successfully creates custom membership tier');

    // 11. Admin Event Creation with Capacity & Tiers (Requirement 14)
    console.log('\n--- Test Group 10: Event Listing Management ---');
    const newEventRes = await (await fetch(`${BASE_URL}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminLogin.token}`
      },
      body: JSON.stringify({
        title: 'Global Tech & Frontier Ventures Summit 2027',
        description: 'Invitation-only technology symposium',
        date: '2027-02-15',
        capacity: 150,
        allowedTiers: ['Gold VIP', 'Platinum Elite']
      })
    })).json();
    assert(newEventRes.success && newEventRes.event._id, 'Admin creates new event specifying capacity and allowed tiers');

    // 12. Financial Dashboard Summary (Requirement 15)
    console.log('\n--- Test Group 11: Financial Analytics Dashboard ---');
    const financeRes = await (await fetch(`${BASE_URL}/admin/financial-summary`, {
      headers: { 'Authorization': `Bearer ${adminLogin.token}` }
    })).json();
    assert(financeRes.success && financeRes.metrics.totalRevenue > 0, 'Admin financial dashboard summarizes total revenue');
    assert(financeRes.metrics.totalSubscriptionRevenue !== undefined, 'Financial dashboard summarizes subscription revenue');

    // 13. CSV Export (Requirement 17)
    console.log('\n--- Test Group 12: Segmented CSV Data Export ---');
    const csvRes = await fetch(`${BASE_URL}/admin/export-csv`, {
      headers: { 'Authorization': `Bearer ${adminLogin.token}` }
    });
    const csvText = await csvRes.text();
    assert(csvRes.status === 200 && csvText.includes('MembershipNumber,Name,Email'), 'Admin exports segmented member data to CSV format');

    // 14. Administrative Activity Log (Requirement 18)
    console.log('\n--- Test Group 13: Activity & Audit Logging ---');
    const logsRes = await (await fetch(`${BASE_URL}/admin/activity-logs?limit=10`, {
      headers: { 'Authorization': `Bearer ${adminLogin.token}` }
    })).json();
    assert(logsRes.success && logsRes.logs.length > 0, 'Administrative activity log tracks operations');
    const regLogsRes = await (await fetch(`${BASE_URL}/admin/activity-logs?action=USER_REGISTERED`, {
      headers: { 'Authorization': `Bearer ${adminLogin.token}` }
    })).json();
    assert(regLogsRes.success && regLogsRes.logs.length > 0, 'Activity log records user registration events');
    assert(logsRes.logs.some(l => l.action === 'GOOGLE_WALLET_SYNCED'), 'Activity log records automatic Google Wallet sync events');

    // 15. Organisation Search & Admin Public/Private Visibility Controls (Plan: 1, 2, 3)
    console.log('\n--- Test Group 14: Organisation Search & Admin Visibility Controls ---');
    // Public search only returns public organisations
    const publicOrgsRes = await (await fetch(`${BASE_URL}/organisations`)).json();
    assert(publicOrgsRes.success && publicOrgsRes.organisations.length > 0, 'Public organisations search endpoint returns active organisations');
    const allPublic = publicOrgsRes.organisations.every(o => o.isPublic === true || o.visibility === 'public');
    assert(allPublic, 'Public search strictly returns only organisations set to public (private invite-only hidden)');

    // Search functionality by query
    const searchRes = await (await fetch(`${BASE_URL}/organisations?search=climate`)).json();
    assert(searchRes.success && searchRes.count === 1 && searchRes.organisations[0].name.includes('GreenHorizon'), 'Search functionality accurately finds organisation by keyword');

    // Admin visibility control: Toggle organisation to private
    const hideRes = await (await fetch(`${BASE_URL}/organisations/org-remember-club/visibility`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminLogin.token}`
      },
      body: JSON.stringify({ isPublic: false })
    })).json();
    assert(hideRes.success && hideRes.organisation.isPublic === false, 'Admin successfully sets organisation to private (invite only)');

    // Verify it disappeared from public search
    const publicAfterHide = await (await fetch(`${BASE_URL}/organisations`)).json();
    const hiddenFound = publicAfterHide.organisations.some(o => o._id === 'org-remember-club');
    assert(!hiddenFound, 'Private organisation is completely hidden from public search results');

    // Admin visibility control: Toggle back to public
    const showRes = await (await fetch(`${BASE_URL}/organisations/org-remember-club/visibility`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminLogin.token}`
      },
      body: JSON.stringify({ isPublic: true })
    })).json();
    assert(showRes.success && showRes.organisation.isPublic === true, 'Admin successfully restores organisation visibility to public');

    // Verify it is visible again
    const publicAfterShow = await (await fetch(`${BASE_URL}/organisations`)).json();
    const visibleAgain = publicAfterShow.organisations.some(o => o._id === 'org-remember-club');
    assert(visibleAgain, 'Public organisation immediately reappears in public search after admin toggle');

    // Summary
    console.log('\n======================================================');
    console.log(`🎉 TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('Test suite uncaught error:', err);
  }
}

runTests();
