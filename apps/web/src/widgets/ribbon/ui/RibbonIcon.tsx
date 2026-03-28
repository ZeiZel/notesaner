'use client';

import { type CSSProperties, type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Tooltip, Button } from 'antd';
import {
  FolderOutlined,
  SearchOutlined,
  ApartmentOutlined,
  CalendarOutlined,
  FileAddOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { cn } from '@/shared/lib/utils';
import type { RibbonAction } from '@/shared/stores/ribbon-store';
import { formatCombo } from '@/shared/lib/keyboard-shortcuts';
import { keyboardManager } from '@/shared/lib/keyboard-manager';

// ---------------------------------------------------------------------------
// Icon registry — maps iconName to the Ant Design icon component
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, ReactNode> = {
  FolderOutlined: <FolderOutlined />,
  SearchOutlined: <SearchOutlined />,
  ApartmentOutlined: <ApartmentOutlined />,
  CalendarOutlined: <CalendarOutlined />,
  FileAddOutlined: <FileAddOutlined />,
  AppstoreOutlined: <AppstoreOutlined />,
};

function getIcon(action: RibbonAction): ReactNode {
  if (action.iconName && ICON_MAP[action.iconName]) {
    return ICON_MAP[action.iconName];
  }
  // Fallback for unknown/plugin icons
  return <AppstoreOutlined />;
}

// ---------------------------------------------------------------------------
// Tooltip label with shortcut
// ---------------------------------------------------------------------------

function buildTooltipLabel(action: RibbonAction): string {
  if (!action.shortcutId) return action.label;

  const combo = keyboardManager.getEffectiveCombo(action.shortcutId);
  if (!combo) return action.label;

  return `${action.label} (${formatCombo(combo)})`;
}

// ---------------------------------------------------------------------------
// RibbonIcon component
// ---------------------------------------------------------------------------

interface RibbonIconProps {
  action: RibbonAction;
  isActive: boolean;
  onClick: () => void;
}

export function RibbonIcon({ action, isActive, onClick }: RibbonIconProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: action.id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const tooltipLabel = buildTooltipLabel(action);

  return (
    <Tooltip title={tooltipLabel} placement="right" mouseEnterDelay={0.4}>
      <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
        <Button
          type="text"
          size="small"
          icon={getIcon(action)}
          onClick={onClick}
          aria-label={tooltipLabel}
          aria-pressed={action.isToggle ? isActive : undefined}
          className={cn(
            'ribbon-icon',
            '!flex !h-8 !w-8 !items-center !justify-center !rounded-md !p-0',
            '!text-foreground-muted !transition-colors',
            'hover:!bg-secondary hover:!text-foreground',
            isActive && '!bg-secondary !text-primary',
            isDragging && '!cursor-grabbing',
          )}
        />
      </div>
    </Tooltip>
  );
}
