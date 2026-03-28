import type { Meta, StoryObj } from '@storybook/react';
import { Input } from '../components/input';
import { Button } from '../components/button';

const meta = {
  title: 'Components/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'search', 'url', 'tel'],
      description: 'HTML input type',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the input is disabled',
    },
  },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

// Default input
export const Default: Story = {
  args: {
    placeholder: 'Type something...',
  },
};

// Different types
export const Types: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '320px' }}>
      <div>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', opacity: 0.7 }}>
          Text
        </label>
        <Input type="text" placeholder="Enter your name" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', opacity: 0.7 }}>
          Email
        </label>
        <Input type="email" placeholder="user@example.com" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', opacity: 0.7 }}>
          Password
        </label>
        <Input type="password" placeholder="Enter password" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', opacity: 0.7 }}>
          Search
        </label>
        <Input type="search" placeholder="Search notes..." />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', opacity: 0.7 }}>
          Number
        </label>
        <Input type="number" placeholder="0" />
      </div>
    </div>
  ),
};

// Disabled state
export const Disabled: Story = {
  args: {
    placeholder: 'Disabled input',
    disabled: true,
  },
};

// With a value
export const WithValue: Story = {
  args: {
    defaultValue: 'My first note',
    type: 'text',
  },
};

// File input
export const File: Story = {
  args: {
    type: 'file',
  },
};

// Form composition
export const FormComposition: Story = {
  render: () => (
    <form
      style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '320px' }}
      onSubmit={(e) => e.preventDefault()}
    >
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
          Note Title
        </label>
        <Input type="text" placeholder="Untitled" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
          Tags
        </label>
        <Input type="text" placeholder="Add tags separated by commas" />
      </div>
      <Button type="submit">Save Note</Button>
    </form>
  ),
};
