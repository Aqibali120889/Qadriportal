/**
 * Frontend/src/app/pages/foundry/FoundryAIAssistant.tsx
 * ──────────────────────────────────────────────────────────────────────────────
 * Phase 8.1: Foundry AI Assistant — reuses the same live AIAssistant component
 * as the Cost Estimation department.
 *
 * Both departments get:
 *   ✅ Searchable RFQ selector (dept-scoped — Foundry users see only Foundry RFQs)
 *   ✅ Global mode (full knowledge base)
 *   ✅ Full webhook payload: project_id, rfq_number, department, user_id,
 *      session_id, conversation_id, timestamp
 *   ✅ Conversation memory persisted to database
 *   ✅ localStorage RFQ persistence across page reloads
 *
 * The backend's /api/v1/assistant/rfqs already scopes RFQs by department_id
 * from the authenticated user's context — no extra filtering needed here.
 */
import AIAssistant from "@/app/pages/AIAssistant";

export default AIAssistant;
