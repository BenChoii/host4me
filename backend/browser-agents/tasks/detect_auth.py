"""
Auth Detection Task — Detect login/2FA screens via visual analysis.
"""

DETECT_AUTH_TASK = """
You are analyzing a web page to determine if authentication is needed.

Look at the current page and determine:

1. **Login Page**: Is this a login/sign-in page? Look for:
   - Email/username input fields
   - Password input fields
   - "Sign in" / "Log in" buttons
   - OAuth buttons (Google, Facebook, Apple sign-in)

2. **2FA/Verification**: Is this a verification page? Look for:
   - "Enter verification code" text
   - SMS code input fields
   - "We sent a code to..." messages
   - CAPTCHA challenges
   - "Verify your identity" prompts

3. **Session Expired**: Does the page indicate the session has expired? Look for:
   - "Session expired" messages
   - Redirect to login page
   - "Please sign in again" text

## Output Format:
Return a JSON object:
{
  "auth_needed": true/false,
  "type": "none" | "login" | "2fa_sms" | "2fa_email" | "2fa_app" | "captcha" | "session_expired",
  "details": "Description of what's shown on screen",
  "action_needed": "What the user needs to do"
}
"""
