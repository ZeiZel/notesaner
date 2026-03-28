import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '../components/badge';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline', 'success', 'warning', 'info'],
      description: 'Visual style variant of the badge',
    },
    children: {
      control: 'text',
      description: 'Badge content',
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

// Default badge
export const Default: Story = {
  args: {
    children: 'Badge',
  },
};

// All variants
export const Variants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="info">Info</Badge>
    </div>
  ),
};

// Note tags use case
export const NoteTags: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      <Badge variant="default">react</Badge>
      <Badge variant="secondary">typescript</Badge>
      <Badge variant="outline">architecture</Badge>
      <Badge variant="info">tutorial</Badge>
      <Badge variant="success">published</Badge>
    </div>
  ),
};

// Status indicators
export const StatusIndicators: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Badge variant="success">Synced</Badge>
        <span style={{ fontSize: '13px' }}>All changes saved</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Badge variant="warning">Pending</Badge>
        <span style={{ fontSize: '13px' }}>2 changes not synced</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Badge variant="destructive">Conflict</Badge>
        <span style={{ fontSize: '13px' }}>Merge required</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Badge variant="info">Draft</Badge>
        <span style={{ fontSize: '13px' }}>Not yet published</span>
      </div>
    </div>
  ),
};

// Compact usage
export const Compact: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '4px' }}>
      <Badge variant="outline">v1.2.0</Badge>
      <Badge variant="secondary">12 notes</Badge>
      <Badge variant="default">3 links</Badge>
    </div>
  ),
};
