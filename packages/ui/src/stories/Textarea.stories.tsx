import type { Meta, StoryObj } from '@storybook/react';
import { Textarea } from '../components/textarea';
import { Button } from '../components/button';

const meta = {
  title: 'Components/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  argTypes: {
    placeholder: {
      control: 'text',
      description: 'Placeholder text',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the textarea is disabled',
    },
    rows: {
      control: 'number',
      description: 'Number of visible text lines',
    },
  },
} satisfies Meta<typeof Textarea>;

export default meta;

type Story = StoryObj<typeof meta>;

// Default textarea
export const Default: Story = {
  args: {
    placeholder: 'Write your note content...',
  },
};

// With value
export const WithValue: Story = {
  args: {
    defaultValue:
      '# Meeting Notes\n\nDiscussed the new feature roadmap and assigned tasks for the next sprint.\n\n## Action Items\n- Review PR #42\n- Update documentation\n- Schedule design review',
    rows: 8,
  },
};

// Disabled
export const Disabled: Story = {
  args: {
    placeholder: 'This textarea is disabled',
    disabled: true,
  },
};

// Different sizes via rows
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '400px' }}>
      <div>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', opacity: 0.7 }}>
          Compact (3 rows)
        </label>
        <Textarea placeholder="Short note..." rows={3} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', opacity: 0.7 }}>
          Default (5 rows)
        </label>
        <Textarea placeholder="Medium note..." rows={5} />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', opacity: 0.7 }}>
          Large (10 rows)
        </label>
        <Textarea placeholder="Long form content..." rows={10} />
      </div>
    </div>
  ),
};

// Form composition
export const NoteEditor: Story = {
  render: () => (
    <form
      style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '480px' }}
      onSubmit={(e) => e.preventDefault()}
    >
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
          Quick Note
        </label>
        <Textarea placeholder="Capture your thoughts..." rows={6} />
        <p style={{ fontSize: '12px', opacity: 0.5, marginTop: '4px' }}>
          Supports Markdown syntax.
        </p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <Button variant="outline" type="button">
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  ),
};
