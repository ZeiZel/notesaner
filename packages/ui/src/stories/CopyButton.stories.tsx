import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { within, userEvent, expect } from '@storybook/test';
import { CopyButton } from '../components/CopyButton';

const meta = {
  title: 'Components/CopyButton',
  component: CopyButton,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['icon', 'label'],
      description: 'Visual variant',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the button is disabled',
    },
    value: {
      control: 'text',
      description: 'Text to copy to clipboard',
    },
  },
} satisfies Meta<typeof CopyButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 'Hello, world!',
  },
};

export const LabelVariant: Story = {
  args: {
    value: 'Copy this text',
    variant: 'label',
  },
};

export const Disabled: Story = {
  args: {
    value: 'Cannot copy',
    disabled: true,
  },
};

export const Controlled: Story = {
  args: {
    value: 'Controlled copied state',
    copied: true,
  },
};

// Interaction: click triggers onCopy handler and shows success state
export const ClickInteraction: Story = {
  args: {
    onCopy: fn(() => true),
    variant: 'label',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /copy to clipboard/i });
    await userEvent.click(button);
    await expect(args.onCopy).toHaveBeenCalledTimes(1);
    // After successful copy, button should show "Copied!" label
    await expect(canvas.getByRole('button', { name: /copied/i })).toBeVisible();
  },
};
