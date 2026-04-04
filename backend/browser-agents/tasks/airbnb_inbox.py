"""
Airbnb Inbox Task — Check for new guest messages.

This is a higher-level task definition that can be used by the agent manager
or called directly for testing.
"""

AIRBNB_INBOX_TASK = """
You are a property management assistant checking the Airbnb hosting inbox.

## Steps:
1. Navigate to https://www.airbnb.com/hosting/inbox
2. If you see a login page, report AUTH_REQUIRED immediately
3. If you see a 2FA/verification prompt, report AUTH_REQUIRED with type "2fa"
4. Once on the inbox page, identify all conversations
5. For each conversation with an unread indicator (bold text, dot, badge):
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
    "guest_name": "John Smith",
    "property": "Sunset Beach Cottage",
    "message_preview": "Hi, I was wondering about parking...",
    "thread_url": "https://www.airbnb.com/hosting/inbox/123456",
    "timestamp": "2024-01-15T14:30:00",
    "is_unread": true,
    "needs_reply": true
  }
]

If no unread messages, return an empty array: []
If auth is needed, return: {"status": "AUTH_REQUIRED", "type": "login" or "2fa"}
"""

AIRBNB_REPLY_TASK = """
You are a property management assistant sending a reply on Airbnb.

## Steps:
1. Navigate to the message thread at: {thread_url}
2. If you see a login page, report AUTH_REQUIRED
3. Find the message input field at the bottom of the conversation
4. Type the following message:

{message}

5. Click the Send button
6. Verify the message appears in the conversation thread
7. Report success or any errors

## Important:
- Do NOT modify the message text
- Make sure to click Send, not just type
- If the message fails to send, report the error
"""
