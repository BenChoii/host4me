/**
 * Telegram Notification Templates
 *
 * Pre-formatted notification messages for common events.
 * All PM communication flows through Telegram.
 */

/**
 * Format a weekly report for Telegram delivery.
 */
function formatWeeklyReport(report) {
  return [
    `📊 *Weekly Report — ${report.dateRange}*`,
    '',
    `*📨 Messages*`,
    `  Total: ${report.totalMessages} (${report.trend.messages})`,
    `  Avg Response Time: ${report.avgResponseTime} (${report.trend.responseTime})`,
    `  Platforms: Airbnb ${report.airbnbMessages}, VRBO ${report.vrboMessages}`,
    '',
    `*🏠 Bookings*`,
    `  New: ${report.newBookings}`,
    `  Occupancy: ${report.occupancyRate}%`,
    `  Revenue (30d): $${report.revenue30d}`,
    '',
    `*😊 Guest Sentiment*`,
    `  Positive: ${report.sentimentPositive}%`,
    `  Neutral: ${report.sentimentNeutral}%`,
    `  Negative: ${report.sentimentNegative}%`,
    '',
    `*🔴 Escalations*`,
    `  Total: ${report.totalEscalations}`,
    `  Avg Resolution: ${report.avgResolutionTime}`,
    '',
    report.recommendations.length > 0
      ? `*💡 Recommendations*\n${report.recommendations.map((r) => `  ��� ${r}`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Format a new booking notification.
 */
function formatNewBooking(booking) {
  return [
    `🟢 *New Booking!*`,
    '',
    `*Guest:* ${booking.guestName}`,
    `*Property:* ${booking.property}`,
    `*Platform:* ${booking.platform}`,
    `*Check-in:* ${booking.checkIn}`,
    `*Check-out:* ${booking.checkOut}`,
    `*Guests:* ${booking.guestCount}`,
    `*Total:* $${booking.total}`,
  ].join('\n');
}

/**
 * Format a session expiry alert.
 */
function formatSessionExpired(platform) {
  return [
    `🟡 *Session Expired — ${platform}*`,
    '',
    `Your ${platform} session has expired. Alfred can't check messages until you re-authenticate.`,
    '',
    `Please log in to ${platform} and if a code is sent, use:`,
    `\`/auth ${platform.toLowerCase()} YOUR_CODE\``,
  ].join('\n');
}

/**
 * Format a system error alert.
 */
function formatSystemError(error) {
  return [
    `⚠️ *System Alert*`,
    '',
    `${error.message}`,
    '',
    `_This may resolve automatically. If it persists, contact support._`,
  ].join('\n');
}

/**
 * Format shadow mode review request.
 */
function formatShadowReview(draft) {
  return [
    `📝 *Draft Reply for Review*`,
    '',
    `*Guest:* ${draft.guestName}`,
    `*Property:* ${draft.property}`,
    `*Platform:* ${draft.platform}`,
    '',
    `*Guest said:*`,
    `> ${draft.guestMessage}`,
    '',
    `*Alfred's draft:*`,
    `> ${draft.draftReply}`,
    '',
    `Reply "approve" to send, or type a revised message.`,
  ].join('\n');
}

module.exports = {
  formatWeeklyReport,
  formatNewBooking,
  formatSessionExpired,
  formatSystemError,
  formatShadowReview,
};
