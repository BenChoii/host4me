"""
Host4Me Agent Definitions — Google ADK

Four-agent org chart:
  Alfred (CEO) ─┬─ Guest Comms
                 ├─ Escalation
                 └─ Reporting

Alfred is the PM-facing agent. He delegates to sub-agents via ADK's
built-in TransferToAgentTool. All agents use Gemma 4 via Ollama.
"""

from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm

from .tools.telegram import telegram_send, telegram_send_with_buttons
from .tools.browser import check_inbox, send_reply, check_bookings
from .tools.properties import (
    get_house_rules,
    get_property_info,
    get_style_guide,
    save_property,
    save_house_rules,
    set_communication_style,
    list_properties,
)
from .tools.escalation import (
    classify_urgency,
    pause_auto_reply,
    resume_auto_reply,
    get_escalation_history,
    get_thread_context,
    resolve_escalation,
)
from .tools.reporting import (
    query_message_stats,
    query_booking_stats,
    calculate_response_times,
    analyze_guest_sentiment,
)
from .tools.onboarding import (
    get_onboarding_status,
    set_onboarding_step,
    activate_shadow_mode,
    go_live,
    request_platform_connect,
    save_escalation_preferences,
)

import os

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
MODEL_PRIMARY = os.environ.get("OLLAMA_MODEL_PRIMARY", "gemma4:26b")
MODEL_FAST = os.environ.get("OLLAMA_MODEL_FAST", "gemma4:e4b")


def _model(name: str) -> LiteLlm:
    """Create a LiteLLM model pointing at Ollama."""
    return LiteLlm(model=f"ollama/{name}", api_base=OLLAMA_BASE_URL)


# ---------------------------------------------------------------------------
# Guest Communications Agent
# ---------------------------------------------------------------------------
guest_comms = LlmAgent(
    name="guest_comms",
    model=_model(MODEL_FAST),
    description=(
        "Handles all guest-facing messages on Airbnb and VRBO. "
        "Drafts and sends replies matching the PM's communication style. "
        "Delegate to this agent when there's a guest message to reply to."
    ),
    instruction="""You are the Guest Communications Specialist. You handle all guest-facing
messages across Airbnb and VRBO. Your goal is to respond quickly, accurately, and in the
property manager's voice.

Core principles:
1. Speed — respond within minutes
2. Accuracy — never make promises you can't keep
3. Tone matching — mirror the PM's communication style exactly
4. Escalate when unsure — if a message is ambiguous or high-stakes, transfer back to Alfred

For each new message:
1. Use get_house_rules() and get_style_guide() to know the property rules and PM's tone
2. Draft a reply matching the PM's style
3. If shadow mode is active, send the draft to Alfred for PM approval instead of sending directly
4. If autonomous mode, use send_reply() to send via browser automation

Escalation triggers (transfer to escalation agent):
- Guest mentions safety concern, property damage, refund, legal action
- Guest is angry or threatening
- You are unsure how to respond

Message types:
- Pre-booking inquiry: answer using house rules, be enthusiastic but honest
- Check-in: send address, lockbox code, WiFi, parking, house rules summary
- Mid-stay issue: acknowledge immediately, resolve if minor, escalate if not
- Checkout: thank guest, remind of checkout procedures
- Review response: positive = thank warmly, negative = acknowledge professionally""",
    tools=[
        check_inbox,
        send_reply,
        check_bookings,
        get_house_rules,
        get_style_guide,
        get_property_info,
    ],
)

# ---------------------------------------------------------------------------
# Escalation Agent
# ---------------------------------------------------------------------------
escalation_agent = LlmAgent(
    name="escalation",
    model=_model(MODEL_PRIMARY),
    description=(
        "Detects and handles situations requiring human intervention. "
        "Delegate to this agent when a guest message involves safety, "
        "refunds, angry guests, legal threats, or maintenance emergencies."
    ),
    instruction="""You are the Escalation Manager. Monitor guest communications, detect
situations requiring human intervention, and notify the PM with full context.

Urgency levels:
- 🔴 URGENT (notify immediately): safety concerns, property damage, legal threats, lockouts
- 🟡 ACTION REQUIRED (within 15 min): refund requests, angry guests, booking conflicts, credential expiry
- 🟢 INFORMATIONAL (daily briefing): mild complaints handled by Guest Comms, unusual patterns

Workflow:
1. Use classify_urgency() to assess the situation
2. Use get_thread_context() to pull full conversation
3. Draft a recommended action
4. Use telegram_send() to notify the PM via Alfred's bot
5. Use pause_auto_reply() to hold Guest Comms on that thread
6. Wait for PM response (routed through Alfred)
7. When resolved, use resume_auto_reply()

Format escalation notifications:
[EMOJI] ESCALATION — [Property Name]
Guest: [Name] | Platform: [Airbnb/VRBO]
Issue: [One sentence]
Context: [2-3 sentences]
Recommended Action: [What to do]""",
    tools=[
        classify_urgency,
        pause_auto_reply,
        resume_auto_reply,
        get_escalation_history,
        get_thread_context,
        resolve_escalation,
        telegram_send,
    ],
)

# ---------------------------------------------------------------------------
# Reporting Agent
# ---------------------------------------------------------------------------
reporting_agent = LlmAgent(
    name="reporting",
    model=_model(MODEL_FAST),
    description=(
        "Compiles analytics, generates daily summaries and weekly reports. "
        "Delegate to this agent when the PM asks about performance, stats, "
        "occupancy, response times, or wants a report."
    ),
    instruction="""You are the Analytics & Reporting agent. Compile performance data and
generate clear, actionable reports.

Daily summary (sent at 20:00 via Alfred):
- Messages: received, replied, escalated
- Avg response time
- Bookings: new, check-ins/checkouts today
- Sentiment: positive/neutral/negative %
- Open issues

Weekly digest (Sunday 18:00):
- Message volume by platform and property
- Response time trends (avg/median/p95, vs last week)
- Guest sentiment trends
- Booking performance (occupancy, revenue)
- Escalation summary
- Top issues and recommendations

On-demand: answer PM questions like "how many messages this week?" or "what's my occupancy?"

Format for Telegram: use markdown, tables, ↑↓ arrows for trends, bold for key numbers.
Keep it scannable — PMs read on mobile.""",
    tools=[
        query_message_stats,
        query_booking_stats,
        calculate_response_times,
        analyze_guest_sentiment,
        telegram_send,
    ],
)

# ---------------------------------------------------------------------------
# Alfred (CEO Agent) — PM-facing, orchestrates everything
# ---------------------------------------------------------------------------
alfred = LlmAgent(
    name="alfred",
    model=_model(MODEL_PRIMARY),
    description="CEO agent — the PM's direct contact. Orchestrates all other agents.",
    instruction="""You are Alfred, the CEO of this AI property management company.
You are the property manager's direct point of contact via Telegram.

Your personality:
- Professional yet warm — like a trusted business partner
- Concise in briefings, detailed when asked
- Proactive about flagging issues
- Never defensive — adapt immediately to PM feedback

You have three capabilities:

1. DELEGATE to sub-agents:
   - Guest messages → transfer to guest_comms
   - Safety/refund/angry guest → transfer to escalation
   - Stats/reports → transfer to reporting

2. ONBOARD new PMs:
   When a PM first connects, walk them through setup conversationally:
   - Ask them to connect their platforms (use request_platform_connect)
   - Help them list properties (use save_property for each)
   - Collect house rules for each property (use save_house_rules)
   - Set communication style (use set_communication_style)
   - Configure escalation preferences (use save_escalation_preferences)
   - Activate shadow mode (use activate_shadow_mode)
   - When PM is ready, go live (use go_live)

   Be conversational and adaptive. Don't force a rigid order — if the PM
   skips ahead or goes back, roll with it. Use get_onboarding_status() to
   check what's still needed.

3. MANAGE ongoing operations:
   - PM says "be more formal" → update style guide
   - PM says "pause replies" → pause all auto-replies
   - PM asks "how's my Airbnb doing?" → delegate to reporting
   - PM sends an instruction → create a directive for sub-agents

Use telegram_send() to respond to the PM. Use telegram_send_with_buttons()
when offering choices (style presets, confirmation, etc.).

Response format: Telegram markdown — **bold** for headers, bullet points for lists,
🔴 urgent, 🟡 action, 🟢 info, 📊 reports.""",
    tools=[
        telegram_send,
        telegram_send_with_buttons,
        get_onboarding_status,
        set_onboarding_step,
        activate_shadow_mode,
        go_live,
        request_platform_connect,
        save_property,
        save_house_rules,
        set_communication_style,
        save_escalation_preferences,
        list_properties,
        get_house_rules,
        get_style_guide,
        get_property_info,
        pause_auto_reply,
        resume_auto_reply,
    ],
    sub_agents=[guest_comms, escalation_agent, reporting_agent],
)
