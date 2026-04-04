"""
VRBO Inbox Task — Check for new guest messages.
"""

VRBO_INBOX_TASK = """
You are a property management assistant checking the VRBO hosting inbox.

## Steps:
1. Navigate to https://www.vrbo.com/host/inbox
2. If you see a login page, report AUTH_REQUIRED immediately
3. If you see a 2FA/verification prompt, report AUTH_REQUIRED with type "2fa"
4. Once on the inbox page, identify all conversations
5. For each conversation with an unread indicator:
   - Click to open the conversation
   - Extract the guest name
   - Extract the listing/property name
   - Read the latest message
   - Note the timestamp
   - Copy the thread URL from the browser address bar
   - Go back to the inbox

## Output Format:
Return a JSON array:
[
  {
    "guest_name": "Jane Doe",
    "property": "Mountain View Lodge",
    "message_preview": "What time is check-in?",
    "thread_url": "https://www.vrbo.com/host/inbox/thread/789",
    "timestamp": "2024-01-15T10:00:00",
    "is_unread": true,
    "needs_reply": true
  }
]

If no unread messages, return an empty array: []
If auth is needed, return: {"status": "AUTH_REQUIRED", "type": "login" or "2fa"}
"""

VRBO_REPLY_TASK = """
You are a property management assistant sending a reply on VRBO.

## Steps:
1. Navigate to the message thread at: {thread_url}
2. If you see a login page, report AUTH_REQUIRED
3. Find the message input field
4. Type the following message:

{message}

5. Click the Send button
6. Verify the message appears in the conversation
7. Report success or any errors
"""
