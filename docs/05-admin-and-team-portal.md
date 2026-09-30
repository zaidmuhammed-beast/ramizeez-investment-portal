# 5. Admin & team portal

## 5.1 Team roles (role-based access)

| Role | Can do | Cannot do |
|------|--------|-----------|
| **Super Admin** | Everything, including team management, settings and final approvals | — |
| **Verification Officer** | Review KYC cases, approve or reject identity and profiles, run video interviews | See pitch financials, edit deals |
| **Deal Analyst** | Screen pitches, score them, request information, run due diligence | Approve KYC, release funds |
| **Investment Committee** | Approve or reject pitches for listing, approve high-value investors | Edit user data |
| **Legal** | Manage NDA and agreement templates, draft term sheets, handle disputes | Release funds |
| **Finance** | Monitor escrow, approve milestone payments (with a second approver), handle fees and invoices | Approve KYC |
| **Execution Manager** | Track funded companies' milestones and reports, flag problems | Change deal terms |
| **Marketing** | Run campaigns for funded businesses, manage public listings and the Tank events page | See KYC documents or financial details |
| **Support** | Answer user tickets, see basic account info | See documents or financials |

Every sensitive action requires 2FA. High-risk actions (releasing funds, approving large investors, deleting data) need **two different people** to approve (the "maker-checker" rule).

## 5.2 Modules

1. **Dashboard**: new sign-ups, KYC queue size, pitches by stage, active deals, funds in escrow, alerts.
2. **Verification queue**: cases sorted by risk and waiting time. Documents, liveness result, face-match score, AML hits and duplicate flags side by side, with a checklist and decision buttons.
3. **User management**: search, profile view, tier, trust score, notes, suspend or blacklist, full history.
4. **Pitch pipeline**: a kanban board from Submitted → Screening → Due diligence → Committee → Listed → In negotiation → Funded, with a scorecard and comments.
5. **Investor management**: verified budgets, unlock usage, behaviour flags, deal history.
6. **Tank sessions**: schedule live sessions, invite founders and investors, record them, capture offers.
7. **Deal room & agreements**: term sheet builder, template library, e-signature status, signed-document vault.
8. **Escrow & milestones**: funds received, milestone evidence submitted by founders, approval workflow, release history.
9. **Execution & marketing**: an assigned manager per funded company, task tracking, monthly investor reports.
10. **Compliance**: AML screening results, suspicious activity reports, re-KYC schedule, audit log search.
11. **Settings**: fees, tier rules, unlock quotas, document requirements, email/SMS templates, team and roles.
