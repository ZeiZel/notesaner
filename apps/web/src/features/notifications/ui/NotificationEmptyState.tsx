'use client';

/**
 * NotificationEmptyState -- displayed when the user has no notifications.
 *
 * Renders an illustration SVG and descriptive text.
 * Uses Ant Design Empty component pattern with a custom illustration.
 */

import { Typography } from 'antd';
import { Box } from '@/shared/ui';

export function NotificationEmptyState() {
  return (
    <Box className="flex flex-col items-center justify-center py-12 px-4">
      {/* Minimalist inbox/bell illustration */}
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ opacity: 0.4 }}
      >
        {/* Bell body */}
        <path
          d="M60 20C44.536 20 32 32.536 32 48V68L24 84H96L88 68V48C88 32.536 75.464 20 60 20Z"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Bell clapper */}
        <path
          d="M48 84C48 90.627 53.373 96 60 96C66.627 96 72 90.627 72 84"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        {/* Top accent */}
        <circle cx="60" cy="16" r="3" fill="currentColor" />
        {/* Check mark (no notifications) */}
        <path
          d="M50 58L56 64L70 50"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      <Typography.Text strong style={{ display: 'block', marginTop: 16, fontSize: 14 }}>
        All caught up!
      </Typography.Text>
      <Typography.Text
        type="secondary"
        style={{ display: 'block', marginTop: 4, fontSize: 13, textAlign: 'center' }}
      >
        You have no notifications right now.
        <br />
        We will let you know when something needs your attention.
      </Typography.Text>
    </Box>
  );
}
