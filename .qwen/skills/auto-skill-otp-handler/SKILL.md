---
name: otp-handler-approach
description: Approach for implementing /getotp command to retrieve OTP from active session and +42777 messages
source: auto-skill
extracted_at: '2026-08-08T18:27:33.397Z'
---

## Approach Overview

Implement `/getotp` command with three core stages:

1. **Session Validation**
   - Verify user is owner (via `isOwner()` check)
   - Confirm active OTP session exists for `+42777` in `otp_sessions` table
   - Only proceed if session is active (`expires_at > NOW()`)

2. **OTP Message Retrieval**
   - Query `otp_messages` table for latest message from `+42777` 
   - Extract OTP code from message content using regex pattern matching
   - Handle edge cases (no messages, duplicates, partial codes)

3. **Response Delivery**
   - Send formatted OTP response to owner
   - Include session validation status in fallback messages
   - Maintain audit trail of OTP access

## Implementation Details

### Database Schema Additions
```sql
CREATE TABLE otp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  telegram_user_id BIGINT,
  telegram_chat_id BIGINT,
  message_text TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Key Code Patterns
- **Session Check Logic**: 
  ```ts
  const session = await queryOne<{ id: string }>(
    `SELECT id FROM otp_sessions WHERE phone = $1 AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1`,
    [TARGET_PHONE]
  );
  if (!session) { /* show inactive session message */ }
  ```

- **Message Storage Hook**:
  ```ts
  // In processUpdate(), store non-command messages from linked phones
  if (text && linkedUser && !text.startsWith("/")) {
    await execute(
      `INSERT INTO otp_messages (phone, telegram_user_id, telegram_chat_id, message_text) VALUES ($1, $2, $3, $4)`,
      [linkedUser.phone, userId, chatId, text]
    );
  }
  ```

- **OTP Extraction Example**:
  ```ts
  // Use regex to extract 4-6 digit codes from message
  const otpMatch = message_text.match(/\d{4,6}/);
  const otpCode = otpMatch ? otpMatch[0] : null;
  ```

## Critical Considerations
- **Security**: 
  - Always validate session linkage before OTP disclosure
  - Consider adding rate limiting for `/getotp` requests
  - Store OTP messages with expiration (e.g., 5 minutes)

- **Edge Cases**:
  - Handle multiple OTP messages (use `ORDER BY received_at DESC LIMIT 1`)
  - Account for partial/duplicated messages
  - Provide clear guidance for session creation

- **Testing Strategy**:
  - Verify conditional behavior with/without active sessions
  - Test session expiration logic
  - Validate message parsing across different OTP formats

This approach ensures OTP retrieval only occurs when:
1. User is authorized owner
2. Active session exists for target number
3. Valid OTP message is stored in database