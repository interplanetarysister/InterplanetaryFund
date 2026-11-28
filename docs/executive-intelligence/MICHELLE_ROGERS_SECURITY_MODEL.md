# Michelle Rogers Executive Intelligence — Security Model & Data Governance
**Document ID:** MR-SEC-001  
**Classification:** Internal Security Architecture  
**Security Posture:** Zero-Trust, Deny-by-Default, Immutable Audit Trail  

---

## 1. Row-Level Security (RLS) Framework

All 24 relational tables in the Michelle Rogers schema have Row-Level Security explicitly enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).

### Access Control Matrix

| Table Category | Tables | Public Anon | Authenticated User | Verified Super-Admin | Service Role (Backend) |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Executive Core** | `mr_executive_profile`, `mr_operating_modes`, `mr_strategic_goals` | SELECT (Public Read Only) | SELECT | FULL ACCESS | FULL ACCESS |
| **Academy Knowledge** | `mr_educational_*`, `mr_competency_rubrics` | SELECT | SELECT | FULL ACCESS | FULL ACCESS |
| **Corporate Facts** | `mr_corporate_facts` | SELECT (Verified Only) | SELECT (Verified Only) | FULL ACCESS | FULL ACCESS |
| **Capital Pipeline & CRM** | `mr_investor_*`, `mr_capital_pipeline`, `mr_relationship_graph` | DENY | DENY | FULL ACCESS | FULL ACCESS |
| **Correspondence & Comms** | `mr_correspondence_*`, `mr_communication_suppressions` | DENY | DENY | FULL ACCESS | FULL ACCESS |
| **Data Room Core** | `mr_data_room_folders`, `mr_data_room_documents` | DENY | DENY | FULL ACCESS | FULL ACCESS |
| **Data Room Access** | `mr_data_room_access_grants` | DENY | Token Read (Scoped) | FULL ACCESS | FULL ACCESS |
| **Audit Ledger** | `mr_executive_audit_events` | DENY | DENY | SELECT ONLY | INSERT ONLY (NO UPDATE/DELETE) |

---

## 2. Immutable Audit Ledger (`mr_executive_audit_events`)

To prevent tampering, whitewashing, or unauthorized history modification, the audit ledger is protected at the database engine level by an immutable PostgreSQL trigger:

```sql
CREATE OR REPLACE FUNCTION mr_enforce_audit_immutability()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Executive audit log records are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mr_audit_immutability
BEFORE UPDATE OR DELETE ON mr_executive_audit_events
FOR EACH ROW
EXECUTE FUNCTION mr_enforce_audit_immutability();
```

### Audited Actions
- All operating mode changes (`training` -> `production`, etc.)
- All investor qualification fit scores calculated
- All outbound communications queued, approved, or transmitted
- All data room access tokens generated, viewed, or revoked
- All factual assertions made in formal correspondence
- Emergency stop activations and deactivations

---

## 3. Cryptographic Token Architecture

1. **Investor Meeting Room Tokens:**
   - Generated as high-entropy 256-bit hexadecimal strings (`replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')`).
   - Time-limited (default expiry 7 days).
   - Single-purpose: bound strictly to a specific scheduled meeting ID and investor profile.
2. **Data Room Access Grants:**
   - Granular permissions per folder (e.g., Folder 01-05 accessible, Folder 06 blocked without explicit signed NDA).
   - One-time access logging with IP and User-Agent capture.
